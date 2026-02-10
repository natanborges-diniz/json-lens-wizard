# Plan – Dados

## Diagnóstico de Dívidas Técnicas

### CRÍTICO

| # | Item | Evidência |
|---|------|-----------|
| D1 | **Foreign Keys ausentes no banco** | `services`, `budgets`, `sales`, `customers` referenciam IDs sem FK declaradas. Integridade referencial depende apenas do código. |
| D2 | **Trigger `handle_new_user` desconectada** | Função existe no banco mas não há trigger associado. Novos usuários podem não receber profile e role automaticamente. |
| D3 | **Normalização de macros em runtime viola Zero Criação** | `catalogEnricher.ts` substitui "Classic"→"Essential", "Premium"→"Top" em runtime, contradizendo a política de não alterar dados do catálogo. |
| D4 | **Catálogo v3.7 copiado mas não utilizado** | `public/data/catalogo_v3_7_full_consolidado_tech_deep.json` existe no projeto mas nenhum código o referencia. Fonte de verdade continua sendo o Storage. |

### IMPORTANTE

| # | Item | Evidência |
|---|------|-----------|
| D5 | **Prioridade de fornecedor: dupla implementação** | `lensStore` gera prioridades POR MACRO, mas `company_settings.supplier_priorities` armazena como array simples global. A engine só usa o global. |
| D6 | **Store vs. Company Settings: sobreposição de campos** | Ambas têm nome, logo, telefone, endereço, CNPJ, WhatsApp, Instagram, Facebook, slogan, footer_text, budget_terms. Sem regra de precedência. |
| D7 | **Tabela `budgets` sem `store_id`** | Em cenário multi-loja, impossível filtrar orçamentos por loja. |
| D8 | **Dashboard com métricas hardcoded** | `totalBudgets` e `myBudgets` fixados em `0`. Contagem real nunca é buscada do banco. |

### DESEJÁVEL

| # | Item | Evidência |
|---|------|-----------|
| D9 | **Fallback local inexistente referenciado** | `AdminDashboard` tenta carregar `/data/lenses.json` que não existe, apesar da arquitetura Cloud-Only. |
| D10 | **Famílias sem preços ativos não são desativadas automaticamente** | Mencionado como pendente mas não implementado. |
