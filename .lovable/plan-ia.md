# Plan – IA / Automações

## Diagnóstico de Dívidas Técnicas

### CRÍTICO

| # | Item | Evidência |
|---|------|-----------|
| A1 | **Edge function `generate-budget-text` usa label "Premium" em vez de "Top"** | `tierLabels` na edge function mantém nomenclatura legada, inconsistente com o frontend normalizado. |

### IMPORTANTE

| # | Item | Evidência |
|---|------|-----------|
| A2 | **Fallback strategy pode "criar" posicionamento** | `fallbackStrategy.ts` promove famílias de tiers adjacentes quando um tier está vazio, o que pode ser interpretado como violação da política Zero Criação. |
| A3 | **Inferência de ClinicalType limitada** | `SellerFlow` infere apenas PROGRESSIVA vs MONOFOCAL pela presença de adição. Não há opção para OCUPACIONAL ou BIFOCAL direto. Recomendação ocupacional é calculada em paralelo mas exibida separadamente. |
| A4 | **SmartSearch sem validação de contexto de catálogo carregado** | A edge function `smart-search` recebe queries mas não valida se o catálogo do store está sincronizado com o que o vendedor vê. |

### DESEJÁVEL

| # | Item | Evidência |
|---|------|-----------|
| A5 | **Audit Logger registra decisões mas sem interface de consulta** | `auditLogger.ts` grava logs de recomendação, mas não há tela para admin consultar histórico de decisões do motor. |
| A6 | **Edge function `catalog-audit` sem uso claro no fluxo principal** | Existe como endpoint mas seu papel no fluxo de governança não está documentado na UI. |
