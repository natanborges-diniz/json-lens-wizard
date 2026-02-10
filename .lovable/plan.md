
# PLAN 4 — Roadmap de Implementacao (AS-IS para TO-BE)

Baseado no PLAN 3 (TO BE) como referencia soberana.

---

## Premissas Atualizadas (pos-investigacao)

Antes de detalhar as fases, e importante registrar correcoes ao diagnostico anterior:

- **Foreign Keys**: JA EXISTEM nas tabelas `services`, `budgets` e `sales`. Nao e necessario cria-las.
- **Trigger `handle_new_user`**: ESTA CONECTADO e funcional (`on_auth_user_created` em `auth.users`). Cria profile + role automaticamente.
- **Impacto**: Dois itens previamente classificados como "criticos" (D1 e D2 do plan-dados.md) ja estao resolvidos no banco. O foco da Fase 1 muda.

---

## FASE 0 — Alinhamento com PLAN 3

**Objetivo**: Eliminar toda contradicao explicita com o PLAN 3.

### 0.1 Remover normalizacao de macros em runtime
- **Arquivo**: `src/lib/catalogEnricher.ts`
  - Remover `LEGACY_TIER_KEYWORDS` (linhas 72-82)
  - Remover `normalizeMacroName()` (linhas 88-96)
  - Remover `normalizeMacros()` (linhas 101-107)
- **Arquivo**: `src/store/lensStore.ts`
  - Remover import de `normalizeMacros`
  - Nas 3 ocorrencias (linhas 203, 269, 324): trocar `normalizeMacros(data.macros)` por `data.macros` diretamente
- **Justificativa PLAN 3**: Secao 3.2 (Zero Criacao) e 4.2 (Normalizacao proibida em runtime)

### 0.2 Corrigir fallback para nao promover tiers
- **Arquivo**: `src/lib/recommendationEngine/fallbackStrategy.ts`
  - Remover `FALLBACK_STRATEGIES` que busca em tiers adjacentes (linhas 23-28)
  - Remover `applyFallbackForTier` estrategias 1 e 3 (busca em outros tiers, linhas 85-98, 113-126)
  - Manter apenas: selecionar outra familia do MESMO tier (estrategia 2, relaxar criterios no proprio tier, linhas 100-111)
  - Se nenhuma familia no mesmo tier: `primary = null`, tier marcado como indisponivel
- **Justificativa PLAN 3**: Secao 4.3 (Fallback nao decide posicionamento)

### 0.3 Corrigir label legado na edge function
- **Arquivo**: `supabase/functions/generate-budget-text/index.ts`
  - Linha 112: trocar `'top': 'Premium - o melhor disponível no mercado'` por `'top': 'Top - o melhor disponível no mercado'`
- **Justificativa PLAN 3**: Secao 4.1 (Labels legados proibidos em todas as camadas)

### Criterio de aceite Fase 0
- Grep por "Classic", "Premium", "Standard" no codigo retorna zero resultados em contexto de tier/label
- `normalizeMacroName` e `normalizeMacros` nao existem mais
- Fallback nunca promove familia de tier diferente

---

## FASE 1 — Governanca e Integridade de Dados

**Objetivo**: Garantir que dados invalidos nao entrem e nao permanecam invisiveis.

### 1.1 Adicionar `store_id` em budgets
- Migrar tabela `budgets`: adicionar coluna `store_id UUID REFERENCES stores(id)`
- Nullable inicialmente (retrocompatibilidade)
- Atualizar `BudgetFinalization` para passar `store_id` ao criar budget
- **Justificativa PLAN 3**: Secao 8.2 (Multi-loja)

### 1.2 Desativacao automatica de familias sem preco ativo
- No fluxo de importacao (`catalogImporter.ts`): apos merge, verificar cada familia
- Se familia nao tem nenhum SKU com `active: true` e `blocked: false` → setar `family.active = false`
- Registrar no log de importacao quantas familias foram desativadas e motivo
- **Justificativa PLAN 3**: Secao 5.2 (Familias sem precos ativos devem ser desativadas)

### 1.3 Validacao de catálogo v3.7 como versao oficial
- Remover arquivo `public/data/catalogo_v3_7_full_consolidado_tech_deep.json` (nao referenciado, apenas ocupa espaco)
- Remover fallback para `lenses.json` no `AdminDashboard.tsx` se existir
- Confirmar que `catalog-default.json` no Storage e a unica fonte
- **Justificativa PLAN 3**: Secao 5.1 (Cloud-Only) e 3.1 (Fonte Unica)

### 1.4 Definir precedencia store vs company
- Criar helper `resolveBusinessContext(storeId?)`:
  - Dados visuais e contato (nome, logo, telefone, WhatsApp) → `stores` (se `storeId` informado)
  - Politicas, prioridades e regras → `company_settings` (sempre)
  - Fallback: se nao tem `storeId`, usa `company_settings` para tudo
- Usar esse helper no `BudgetFinalization` e `generate-budget-text`
- **Justificativa PLAN 3**: Secao 8.2

### Criterio de aceite Fase 1
- `budgets` tem coluna `store_id`
- Familias sem SKU ativo sao desativadas na importacao
- Nenhum fallback local para arquivos JSON

---

## FASE 2 — Fluxo de Venda Confiavel

**Objetivo**: Evitar perda de contexto e decisoes forcadas pelo sistema.

### 2.1 Persistencia de rascunho
- Ao iniciar venda no `SellerFlow`, criar registro em `services` com `status = 'draft'` (requer novo valor no enum `service_status`)
- A cada mudanca de step, salvar `anamnesis_data`, `prescription_data`, `frame_data` via update
- Ao retornar ao `/seller`, verificar se existe service em draft para o usuario e oferecer "Continuar atendimento?"
- **Justificativa PLAN 3**: Secao 7.1

### 2.2 Selecao manual de ClinicalType
- Adicionar select no step "Receita" (`PrescriptionStep`) com opcoes: MONOFOCAL, PROGRESSIVA, OCUPACIONAL, BIFOCAL
- Sistema pre-seleciona baseado na adicao (sugestao), mas vendedor pode alterar
- Remover auto-set forcado no `useEffect` do `SellerFlow` (linhas 148-152) — trocar por sugestao com toast
- **Justificativa PLAN 3**: Secao 6.2

### 2.3 Narrativa "Por que esta lente?"
- Ja implementado via `ConsultativeNarrativePanel` e `TierComparisonCard`
- Validar que estes componentes estao integrados no `RecommendationsGrid`
- Garantir que usam apenas dados do catalogo (knowledge.consumer, knowledge.consultant)

### Criterio de aceite Fase 2
- Reload da pagina no meio do fluxo nao perde dados
- Vendedor pode selecionar OCUPACIONAL ou BIFOCAL manualmente
- Recomendacao explica "por que" sem inventar dados

---

## FASE 3 — Auditoria Real e Explicabilidade

**Objetivo**: Transformar auditoria em ferramenta estrategica.

### 3.1 Unificar rotas de auditoria
- Manter `/audit` (CatalogAudit) como rota oficial — e a mais completa (tabs, batch, export)
- Remover rota `/catalog-audit` do `App.tsx`
- Remover arquivo `CatalogAuditPage.tsx` ou redirecionar para `/audit`
- **Justificativa PLAN 3**: Secao 7.2

### 3.2 Expor logs do motor de recomendacao
- O `auditLogger.ts` ja gera logs estruturados
- Criar aba "Logs de Recomendacao" na tela de auditoria (`/audit`)
- Exibir: familia selecionada, scores clinico/comercial, motivo, fallbacks aplicados
- Admin consegue responder: "por que esta lente foi recomendada para este cliente?"

### 3.3 Justificativa explicita por recomendacao
- No `SimplifiedLensCard` ou `LensCard`, exibir tooltip/drawer com:
  - Score clinico e comercial (numerico)
  - Criterios que pesaram (queixas visuais, estilo de vida)
  - Tecnologias que justificam o posicionamento

### Criterio de aceite Fase 3
- Existe uma unica rota `/audit`
- Admin consegue ver scores e motivos de recomendacao
- Nenhum "por que" e inventado — tudo vem do catalogo

---

## FASE 4 — Consolidacao Operacional

**Objetivo**: Fechar buracos restantes e preparar crescimento.

### 4.1 Dashboard com metricas reais
- `Dashboard.tsx` linhas 99 e 104: buscar contagem real de `budgets`
- Adicionar queries:
  - `totalBudgets`: count de budgets (admin/manager)
  - `myBudgets`: count de budgets via join com services.seller_id

### 4.2 Politica de desconto por role
- Adicionar campo `max_discount_percent` em `company_settings` (ou por role)
- Validar no `BudgetFinalization` que desconto nao excede o permitido para o role do usuario

### 4.3 Revisao de seguranca do bucket catalogs
- Verificar se bucket `catalogs` precisa ser publico
- Considerar tornar privado com acesso via signed URLs para usuarios autenticados

### 4.4 Remover arquivo v3.7 local nao utilizado
- Deletar `public/data/catalogo_v3_7_full_consolidado_tech_deep.json`
- Confirmar que nenhum import o referencia

### Criterio de aceite Fase 4
- Dashboard mostra numeros reais de orcamentos
- Desconto e limitado por politica
- Bucket nao expoe catalogo publicamente (se aplicavel)

---

## Fora de Escopo (conforme PLAN 3, Secao 9)

- BI avancado
- CRM completo
- Precificacao dinamica
- Marketplace
- Multiplos catalogos simultaneos

---

## Ordem de Execucao Sugerida

```text
FASE 0 (obrigatoria, pre-requisito)
  |
  v
FASE 1 (dados e governanca)
  |
  v
FASE 2 (UX e persistencia)
  |
  v
FASE 3 (auditoria e explicabilidade)
  |
  v
FASE 4 (consolidacao)
```

Cada fase e independente apos a Fase 0. As fases 1-4 podem ser reordenadas conforme prioridade do negocio, mas a Fase 0 e obrigatoria antes de qualquer outra.
