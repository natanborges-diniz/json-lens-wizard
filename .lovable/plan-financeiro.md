# Plan – Financeiro

## Diagnóstico de Dívidas Técnicas

### CRÍTICO

| # | Item | Evidência |
|---|------|-----------|
| F1 | **Orçamento sem vínculo com loja** | Tabela `budgets` não possui `store_id`. Relatórios financeiros por loja são impossíveis. |

### IMPORTANTE

| # | Item | Evidência |
|---|------|-----------|
| F2 | **Contagem de orçamentos no Dashboard = 0 fixo** | `totalBudgets` e `myBudgets` hardcoded. Gestores não veem volume real de orçamentos. |
| F3 | **7 famílias sem preços identificadas** | ZEISS Precision Pure/Plus, SmartLife Plus, SmartLife SV BlueGuard, HOYA Easy/EP, Essilor VS — aparecem no catálogo mas sem SKUs precificados. Podem gerar cards vazios. |
| F4 | **Importação complementar de preços não implementada** | Mencionada como pendência. Hoje só é possível substituição ou incremento total do catálogo. |

### DESEJÁVEL

| # | Item | Evidência |
|---|------|-----------|
| F5 | **Sem relatório de vendas por período/vendedor/loja** | Tabela `sales` existe mas não há tela de relatórios financeiros consolidados. |
| F6 | **Desconto no orçamento sem regra de teto** | `BudgetFinalization` permite descontos arbitrários sem limite configurável por role ou política. |
