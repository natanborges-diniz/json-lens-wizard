
# Mapeamento AS-IS -- Sistema de Catalogo de Lentes Opticas

## 1. Visao Geral da Arquitetura

O sistema e uma aplicacao SPA (Single Page Application) construida com React + Vite + TypeScript + Tailwind CSS, com backend no Lovable Cloud (Supabase). O catalogo de lentes e armazenado como um unico arquivo JSON no Supabase Storage (bucket: `catalogs`, arquivo: `catalog-default.json`), servindo como fonte unica de verdade.

```text
+-------------------+     +------------------+     +------------------+
|   Frontend SPA    |     | Lovable Cloud    |     | Supabase Storage |
|   (React/Vite)    |<--->| (Auth, DB, Edge) |<--->| (catalogs bucket)|
+-------------------+     +------------------+     +------------------+
        |                        |
   lensStore (Zustand)     3 Edge Functions
   (cache local)           - generate-budget-text
                           - smart-search
                           - catalog-audit
```

---

## 2. Telas e Rotas Existentes

| Rota | Pagina | Acesso | Status |
|------|--------|--------|--------|
| `/` | Index (landing) | Publico | Funcional |
| `/login` | Login | Publico | Funcional |
| `/dashboard` | Dashboard principal | admin, manager, seller | Funcional |
| `/seller` | Fluxo de Venda (7 etapas) | admin, manager, seller | Funcional |
| `/management` | Gestao (Atendimentos, Orcamentos, Vendas, Equipe) | admin, manager, seller | Funcional |
| `/settings` | Configuracoes da Empresa | admin | Funcional |
| `/users` | Gerenciamento de Usuarios | admin | Funcional |
| `/stores` | Gerenciamento de Lojas | admin | Funcional |
| `/admin` | Admin Dashboard (Importacao/Exportacao de catalogo) | admin | Funcional |
| `/audit` | Edicao Manual do Catalogo (Governanca) | admin | Funcional |
| `/catalog-audit` | Pagina alternativa de auditoria | admin | Duplicidade -- ver item 7 |
| `/docs` | Documentacao do Catalogo | admin | Funcional |

---

## 3. Fluxos Principais

### 3.1 Fluxo de Venda (`/seller`) -- 7 etapas
1. **Perfil de Uso** -- Nome do cliente + uso primario, telas, direcao noturna
2. **Queixas Visuais** -- Selecao multipla de sintomas
3. **Estilo de Vida** -- Ar livre, preferencia de lente clara, prioridade estetica
4. **Receituario** -- Esfera, cilindro, eixo, adicao (OD/OE)
5. **Armacao** -- Horizontal, vertical, ponte, DP, altura
6. **Recomendacoes** -- Grid com 4 tiers (Essential, Comfort, Advanced, Top)
7. **Orcamento** -- Finalizacao com descontos, 2o par, pagamento, geracao de texto via IA

### 3.2 Fluxo de Importacao de Catalogo (`/admin`)
1. Admin cola JSON no textarea
2. Seleciona modo (Substituicao ou Incremento)
3. Validacao pre-import (engine assincrona com regras externas)
4. Preview com relatorio de erros/alertas
5. Confirmacao e execucao
6. Auto-save para Supabase Storage
7. Registro de versao no banco de dados
8. Opcao de rollback (1 nivel)

### 3.3 Fluxo de Edicao Manual (`/audit`)
- Tabs: Familias, Macros, Fornecedores, Tecnologias, Regras de Match, Integridade
- Cards editaveis com toggle ativo/inativo
- Acoes em lote (batch)
- Exportacao Excel/PDF
- Relatorio de classificacao SKU
- Filtros por fornecedor, categoria, tier, alerta

---

## 4. Entidades de Dados

### 4.1 Banco de Dados (10 tabelas)

| Tabela | Descricao | RLS | FK |
|--------|-----------|-----|-----|
| `profiles` | Nome, email, telefone, avatar do usuario | Sim | user_id -> auth.users |
| `user_roles` | Papeis (admin, manager, seller) | Sim | user_id -> auth.users |
| `user_store_access` | Controle de acesso por loja | Sim | user_id, store_id |
| `stores` | Lojas (multi-loja) | Sim | - |
| `company_settings` | Config global (nome, logo, prioridades fornecedor) | Sim | - |
| `customers` | Clientes da otica | Sim | created_by -> auth.users |
| `services` | Atendimentos (anamnese, receita, armacao em JSONB) | Sim | customer_id, seller_id |
| `budgets` | Orcamentos gerados | Sim | service_id |
| `sales` | Vendas finalizadas | Sim | budget_id, service_id, seller_id, customer_id |
| `catalog_versions` | Historico de importacoes do catalogo | Sim | imported_by |

### 4.2 Catalogo JSON (Supabase Storage)

Estrutura principal do JSON v3.7:
- `meta` -- versao, nome, contagens
- `scales` -- escalas de atributos
- `attribute_defs` -- definicoes de atributos
- `macros` -- categorias de lentes com tier_key
- `families` -- familias de lentes (entidade central)
- `addons` -- tratamentos adicionais
- `prices` -- SKUs com disponibilidade e precos
- `technology_library` -- biblioteca de tecnologias
- `benefit_rules` -- regras de beneficios
- `quote_explainer` -- explicador de orcamentos
- `index_display` -- configuracoes de exibicao de indices

### 4.3 Estado Local (Zustand -- `lensStore`)
- Cache completo do catalogo em memoria
- Persistencia via `zustand/persist`
- Sync com cloud via debounced auto-save (2s)
- Suporte a rollback (1 nivel)
- Rastreamento de status de sincronizacao

---

## 5. Motores Logicos (lib/)

| Modulo | Arquivo | Funcao |
|--------|---------|--------|
| **Recommendation Engine** | `recommendationEngine/index.ts` | Orquestracao principal |
| Clinical Engine | `recommendationEngine/clinicalEngine.ts` | Score clinico (60%) |
| Commercial Engine | `recommendationEngine/commercialEngine.ts` | Score comercial (40%) |
| Recommendation Scorer | `recommendationEngine/recommendationScorer.ts` | Calculo final 60/40 |
| Fallback Strategy | `recommendationEngine/fallbackStrategy.ts` | Garante 4 tiers |
| Narrative Engine | `recommendationEngine/narrativeEngine.ts` | Resumos e comparacoes |
| Audit Logger | `recommendationEngine/auditLogger.ts` | Log de decisoes |
| Budget Generator | `budgetGenerator.ts` | Texto do orcamento (local fallback) |
| Catalog Enricher | `catalogEnricher.ts` | Normalizacao de macros, enriquecimento |
| Catalog Importer | `catalogImporter.ts` | Validacao e merge de importacao |
| Catalog Validation | `catalogValidationEngine.ts` | Validacao pre-import com regras |
| SKU Classifier | `skuClassificationEngine.ts` | Classificacao automatica de SKUs |
| SKU Code Resolver | `skuCodeResolver.ts` | Resolucao de codigos ERP |
| Option Matrix | `optionMatrix.ts` | Opcoes de indice/tratamento por familia |
| Product Suggestion | `productSuggestionEngine.ts` | Sugestoes de upsell |
| Catalog Governance | `catalogGovernance.ts` | Politicas de governanca |

---

## 6. Edge Functions (Backend)

| Funcao | Endpoint | Modelo IA | Funcao |
|--------|----------|-----------|--------|
| `generate-budget-text` | POST | Gemini 2.5 Flash | Gera texto consultivo do orcamento |
| `smart-search` | POST | Gemini 2.5 Flash | Busca inteligente por linguagem natural |
| `catalog-audit` | POST | - | Consultas diretas no JSON do catalogo |

---

## 7. Inconsistencias e Lacunas Identificadas

### 7.1 Duplicidade de Rotas
- **`/audit` (CatalogAudit)** e **`/catalog-audit` (CatalogAuditPage)`** -- duas rotas para funcionalidades similares de auditoria. Nao esta claro qual e a principal e qual deveria ser removida.

### 7.2 Nomenclatura Legada vs. Padrao
- O `generate-budget-text` ainda usa o label "Premium" no mapa `tierLabels` (linha 113), apesar da normalizacao no frontend ter trocado para "Top".
- A funcao `normalizeMacroName` no `catalogEnricher.ts` faz substituicao em runtime (Classic->Essential, Premium->Top), o que contradiz a diretriz do usuario de "NAO normalizar dados em runtime".

### 7.3 Fonte de Dados Inconsistente
- `AdminDashboard` (linha 154) tenta carregar `/data/lenses.json` como fallback local, mas a arquitetura e "Cloud-Only". Esse arquivo nao existe mais (removido), porem o fallback esta hardcoded.
- Existe agora o arquivo `public/data/catalogo_v3_7_full_consolidado_tech_deep.json` (copiado recentemente), mas nenhum codigo o referencia diretamente.

### 7.4 Foreign Keys Ausentes no Banco
- As tabelas `services`, `budgets`, `sales`, `customers` nao possuem foreign keys declaradas no schema (apesar de referenciarem `customer_id`, `seller_id`, `service_id`, `budget_id`). Isso pode causar inconsistencias de integridade referencial.

### 7.5 Dashboard -- Dados Incompletos
- O campo `totalBudgets` e `myBudgets` no Dashboard estao hardcoded como `0` (linhas 99, 106 do Dashboard.tsx). A contagem de orcamentos nunca e buscada.

### 7.6 Store vs. Company Settings -- Sobreposicao
- Existe `company_settings` (configuracao global) e `stores` (multi-loja) com campos quase identicos (nome, logo, telefone, endereco, CNPJ, WhatsApp, Instagram, Facebook, slogan, footer_text, budget_terms). Nao ha logica para decidir qual configuracao usar no orcamento: a da empresa ou a da loja.

### 7.7 Prioridade de Fornecedor -- Dupla Implementacao
- `lensStore` mantem `supplierPriorities` como array de `{ macroId, suppliers[] }` (por macro).
- `company_settings.supplier_priorities` armazena como array simples `string[]` (global).
- `SupplierPriorityManager` salva na company_settings (global).
- `useRecommendationEngine` busca de company_settings (global).
- O lensStore gera prioridades POR MACRO ao importar, mas essa granularidade nao e usada pela engine.

### 7.8 Determinacao Automatica de ClinicalType
- O `SellerFlow` infere `PROGRESSIVA` vs `MONOFOCAL` apenas pela presenca de adicao na receita (linhas 149-152). Nao ha opcao para o vendedor selecionar `OCUPACIONAL` ou `BIFOCAL` diretamente. A recomendacao ocupacional e calculada em paralelo mas exibida separadamente.

### 7.9 Persistencia do Fluxo de Venda
- Os dados da venda em andamento (anamnese, receita, armacao) vivem apenas no estado local do componente `SellerFlow` (useState). Se o usuario recarregar a pagina, tudo e perdido. Nao ha salvamento intermediario no banco.

### 7.10 Politica de "Zero Criacao" vs. Codigo Atual
- O `catalogEnricher.ts` faz normalizacao de nomes de macros em runtime, o que viola a diretriz recente do usuario de "NAO normalizar dados em runtime".
- O `fallbackStrategy` pode promover familias de tiers adjacentes, o que pode ser interpretado como "criacao" de posicionamento.

### 7.11 Trigger `handle_new_user` Referenciado mas Ausente
- O schema indica a funcao `handle_new_user()` existe, mas nao ha trigger associado na listagem. Novos usuarios podem nao receber perfil e role automaticamente.

### 7.12 Orcamento -- Sem Campo `store_id`
- A tabela `budgets` nao possui referencia a qual loja gerou o orcamento. Em cenario multi-loja, nao ha como filtrar orcamentos por loja.

---

## 8. O Que Funciona

- Autenticacao completa (login/signup com roles admin/manager/seller)
- Fluxo de venda de 7 etapas com anamnese, receituario e recomendacoes
- Motor de recomendacao com score 60/40 (clinico/comercial) e 4 tiers
- Importacao/exportacao de catalogo JSON com validacao e rollback
- Edicao manual do catalogo (familias, macros, fornecedores, tecnologias)
- Geracao de orcamento com texto consultivo via IA (Gemini 2.5 Flash)
- Envio de orcamento por WhatsApp com texto formatado
- Exportacao de orcamento em PDF
- Gerenciamento de usuarios com roles e acesso por loja
- Gerenciamento de lojas (CRUD completo)
- Configuracoes da empresa com upload de logo
- Prioridade de fornecedores (global) impactando recomendacoes
- Sincronizacao automatica do catalogo com cloud (debounced)
- Historico de versoes do catalogo
- Busca inteligente com IA

## 9. O Que Esta Incompleto

- Contagem de orcamentos no Dashboard (hardcoded = 0)
- Selecao manual de tipo clinico pelo vendedor (OCUPACIONAL, BIFOCAL)
- Persistencia do fluxo de venda entre sessoes
- Associacao de orcamento/venda a loja especifica
- Resolucao de conflito entre company_settings e stores para dados do orcamento
- Desativacao automatica de familias sem precos ativos (mencionada como pendente)
- Importacao complementar de precos (mencionada como pendente)
- Uso efetivo do arquivo de catalogo v3.7 recem-copiado

## 10. O Que Gera Duvida ou Retrabalho

- Duas rotas de auditoria (`/audit` e `/catalog-audit`) com propositos sobrepostos
- Normalizacao de nomes em runtime contradiz a diretriz de nao alterar dados
- Prioridade de fornecedor: implementacao global vs. por macro nunca convergiu
- Fallback de dados locais (`lenses.json`) referenciado mas arquivo inexistente
- Trigger de criacao de usuario possivelmente desconectada
