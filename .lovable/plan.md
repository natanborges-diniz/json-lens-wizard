
# Procedimento Padrao de Atualizacao do Catalogo (ERP Soberano)

## Objetivo

Transformar o ERP em fonte unica e soberana de dados de disponibilidade tecnica (availability), substituindo Safe Defaults e dados manuais. O fluxo sera: **Upload XLSX por fornecedor -> Dry-run -> Resolucao de pendencias -> Apply -> Auditoria automatica**.

---

## Cenario Atual

- Catalogo v3.7: 137 familias, 6.250 SKUs, sem nenhuma sincronizacao ERP aplicada
- ~2.450 SKUs monofocais sem dados de availability reais
- Edge function `sync-erp-catalog` funcional mas com matching limitado (usa `family_matching_engine` do JSON, formato legado `patterns[]`)
- Mapeamento de colunas hardcoded no frontend (lista fixa de aliases)
- Sem historico de sincronizacoes ERP
- Sem fila de SKUs pendentes de resolucao

---

## Entregaveis

### 1. Novas Tabelas no Banco de Dados

**Tabela `supplier_profiles`** — Perfil de configuracao por fornecedor

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| supplier_code | text UNIQUE | Ex: ESSILOR, ZEISS, HOYA |
| display_name | text | Nome para exibicao |
| column_mapping | jsonb | Mapa de colunas XLSX para campos padrao |
| family_dictionary | jsonb | Array de regras `{contains: string[], family_id, priority}` |
| index_parsing | jsonb | Regras para extrair indice da descricao |
| keywords_photo | text[] | Palavras-chave para deteccao de lentes fotossensiveis |
| is_active | boolean | |
| created_at, updated_at | timestamptz | |

Exemplo de `column_mapping`:
```text
{
  "codigo": ["Codigo", "COD", "ERP_CODE"],
  "descricao": ["DescricaoCadunif", "Descricao"],
  "esferico_min": ["ESFERICO_MIN", "EsfericoMin", "sph_min"],
  ...
}
```

Exemplo de `family_dictionary`:
```text
[
  { "contains": ["varilux", "comfort"], "family_id": "essilor-varilux-comfort", "priority": 10 },
  { "contains": ["eyezen"], "family_id": "essilor-eyezen-start", "priority": 20 }
]
```

**Tabela `catalog_sync_runs`** — Historico de sincronizacoes

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| supplier_code | text FK supplier_profiles | Fornecedor |
| run_type | text | 'dry_run' ou 'apply' |
| status | text | 'pending', 'completed', 'failed' |
| rows_read | int | |
| rows_matched | int | |
| rows_updated | int | |
| rows_created | int | |
| rows_not_found | int | |
| pending_skus_count | int | |
| report | jsonb | Relatorio completo retornado pela edge function |
| file_name | text | Nome do arquivo XLSX original |
| executed_by | uuid | Usuario que executou |
| created_at | timestamptz | |

**Tabela `catalog_pending_skus`** — Fila de SKUs nao resolvidos

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| sync_run_id | uuid FK catalog_sync_runs | Run que originou |
| supplier_code | text | |
| erp_code | text | Codigo ERP |
| description | text | Descricao do ERP |
| raw_data | jsonb | Dados completos da linha XLSX |
| status | text | 'pending', 'resolved', 'ignored' |
| resolved_family_id | text | Familia atribuida manualmente |
| resolved_by | uuid | Usuario que resolveu |
| resolved_at | timestamptz | |
| created_at | timestamptz | |

**Politicas RLS**: Todas as tres tabelas acessiveis apenas por admin/manager (leitura e escrita). Sellers sem acesso.

### 2. Evolucao da Edge Function `sync-erp-catalog`

Mudancas na logica:

1. **Buscar `supplier_profiles` do banco** em vez de usar mapping hardcoded. O `column_mapping` do perfil substitui a normalizacao fixa do frontend.

2. **Usar `family_dictionary` do perfil** para resolucao de familias em vez do `family_matching_engine` do JSON (que continuara como fallback).

3. **Gravar SKUs nao resolvidos** na tabela `catalog_pending_skus` em vez de apenas reporta-los no JSON de resposta.

4. **Registrar cada execucao** na tabela `catalog_sync_runs` (tanto dry-run quanto apply).

5. **Retornar `sync_run_id`** na resposta para rastreabilidade.

### 3. Gates de Publicacao

Antes de aplicar (apply=true), a edge function verificara:

- **Gate 1 — Pendencias abertas**: Se existem registros em `catalog_pending_skus` com status 'pending' para o mesmo fornecedor, emitir warning (nao bloqueia, mas exibe no relatorio).
- **Gate 2 — Availability incompleta**: Apos aplicar, contar SKUs ativos sem campos sphere/cylinder preenchidos. Se > 0, registrar no relatorio como alerta.
- **Gate 3 — Grade Matrix**: Manter o gate existente (`skipGradeGate`) que verifica variantes sem grade na tabela `catalog_variant_grades`.

### 4. Interface do Wizard "Atualizacao por Fornecedor"

Substituir o `ErpImportTab` atual por um wizard de 5 etapas:

```text
[1. Fornecedor] -> [2. Upload] -> [3. Dry-Run] -> [4. Pendencias] -> [5. Aplicar]
```

**Etapa 1 — Selecao de Fornecedor**
- Select com fornecedores da tabela `supplier_profiles`
- Exibir ultima sincronizacao (data, resultado) se houver
- Botao "Configurar Perfil" para editar column_mapping e family_dictionary

**Etapa 2 — Upload XLSX**
- Drag-and-drop ou seletor de arquivo
- Parsing client-side via `xlsx` (mantido)
- Normalizar colunas usando `column_mapping` do perfil do fornecedor
- Preview com todas as colunas + indicador visual de quais foram mapeadas

**Etapa 3 — Dry-Run (Pre-visualizacao)**
- Chamar `sync-erp-catalog?dry_run=true`
- Exibir metricas: Lidos, Encontrados, Atualizados, Nao Encontrados
- Tabela com exemplos de atualizacoes e conflitos
- Se houver SKUs nao encontrados, exibir contagem e amostra

**Etapa 4 — Resolucao de Pendencias**
- Listar SKUs nao encontrados do dry-run
- Para cada SKU: campo para atribuir `family_id` manualmente (select com familias ativas)
- Opcoes: Resolver, Ignorar, Resolver em Lote (selecionar varios + atribuir mesma familia)
- Salvar resolucoes na `catalog_pending_skus`

**Etapa 5 — Aplicar e Auditar**
- Resumo final: o que sera aplicado
- Exibir gates (warnings se houver)
- Botao "Confirmar e Aplicar" -> chama `sync-erp-catalog?apply=true`
- Apos sucesso: recarregar catalogo na store + mostrar relatorio final
- Link para historico de sincronizacoes

### 5. Tela de Configuracao de Perfil de Fornecedor

Nova sub-tela acessivel pela Etapa 1 ou por um botao na aba ERP:

- **Mapeamento de Colunas**: Interface visual para mapear nomes de colunas XLSX para campos padrao do sistema (Codigo, Descricao, Esferico_min, etc.)
- **Dicionario de Familias**: Editor de regras `contains[]` -> `family_id` com prioridade, similar ao MatchingRulesEditor mas simplificado e armazenado no banco
- **Parsing de Indice**: Configurar regex para extrair indice refrativo da descricao
- **Keywords Fotossensiveis**: Lista de palavras para deteccao de lentes photo

### 6. Historico de Sincronizacoes

Nova sub-aba ou secao na pagina /audit:

- Tabela com todas as execucoes de `catalog_sync_runs`
- Colunas: Data, Fornecedor, Tipo (dry-run/apply), Status, Linhas lidas/atualizadas/criadas/pendentes
- Expandir para ver relatorio completo
- Filtros por fornecedor e periodo

---

## Secao Tecnica — Sequencia de Implementacao

1. **Migracao DB**: Criar tabelas `supplier_profiles`, `catalog_sync_runs`, `catalog_pending_skus` com RLS
2. **Seed inicial**: Inserir perfis para ESSILOR, ZEISS, HOYA com column_mapping basico derivado dos aliases atuais
3. **Edge function**: Refatorar `sync-erp-catalog` para consultar `supplier_profiles`, gravar em `catalog_sync_runs` e `catalog_pending_skus`
4. **Deploy edge function**
5. **Frontend — Wizard**: Substituir `ErpImportTab` pelo wizard de 5 etapas
6. **Frontend — Perfil de Fornecedor**: Tela de edicao de supplier_profiles
7. **Frontend — Historico**: Sub-aba com lista de sync_runs
8. **Frontend — Pendencias**: Interface de resolucao de SKUs pendentes

---

## Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|----------|
| Perfis de fornecedor incorretos bloqueiam mapeamento | Seed inicial com mapeamentos testados + preview antes do dry-run |
| SKUs pendentes acumulam sem resolucao | Alerta visual na dashboard com contagem de pendencias |
| Edge function com timeout em catalogos grandes | Processar em batches de 500 linhas se necessario |
| Perda de dados no apply | Dry-run obrigatorio antes do apply (UI nao permite pular) |
