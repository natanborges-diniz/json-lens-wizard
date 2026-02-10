# Plan – UX / Fluxo

## Diagnóstico de Dívidas Técnicas

### CRÍTICO

| # | Item | Evidência |
|---|------|-----------|
| U1 | **Persistência do fluxo de venda inexistente** | Dados da venda (anamnese, receita, armação) vivem em `useState` do `SellerFlow`. Reload da página = perda total do contexto. |
| U2 | **Rotas duplicadas de auditoria** | `/audit` (CatalogAudit) e `/catalog-audit` (CatalogAuditPage) coexistem com funcionalidades sobrepostas. Confuso para o admin. |

### IMPORTANTE

| # | Item | Evidência |
|---|------|-----------|
| U3 | **Nomenclatura de tiers inconsistente entre telas** | Frontend mostra "Essential/Comfort/Advanced/Top", edge function usa "Premium", catálogo original pode ter "Classic/Standard". |
| U4 | **Fluxo de venda sem seleção manual de tipo clínico** | Vendedor não pode escolher OCUPACIONAL ou BIFOCAL manualmente; sistema decide sozinho pela adição. |
| U5 | **Cards de recomendação podem mostrar menos de 5 tecnologias** | Limite foi atualizado para 5 mas depende de `technology_refs` populados na família. Famílias sem refs mostram card vazio. |

### DESEJÁVEL

| # | Item | Evidência |
|---|------|-----------|
| U6 | **Bloco comparativo entre tiers não implementado** | O TierComparisonCard existe mas não mostra tecnologias exclusivas de cada tier nem diferença de preço incremental conforme solicitado. |
| U7 | **Rota `/catalog-debug` mencionada em memória mas não declarada em App.tsx** | Ferramenta de diagnóstico sem rota oficial. |
