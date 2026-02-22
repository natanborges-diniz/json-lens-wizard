

# Auditoria Comercial Estrutural do Catalogo (com ajustes)

## Ajustes aplicados ao plano original

### 1. Resolucao de tier sem inferencia por nome
- Usar apenas `family.tier_target` e `macro.tier_key` do catalogo
- Se nenhum dos dois existir, marcar como `unknown` em vez de inferir pelo nome da macro
- Familias `unknown` aparecerao em secao separada no relatorio

### 2. Anomalia por limiar quantitativo
- Para cada tecnologia, calcular `high_tier_bias` = (usos em advanced+top) / (usos totais)
- Anomalia = familia em essential ou comfort que referencia tecnologia com `high_tier_bias >= 0.70`
- Exibir o valor do bias ao lado de cada anomalia

### 3. Narrativas com dados reais + aviso demonstrativo
- Selecionar 3 familias reais do catalogo (1 mono essential, 1 prog comfort, 1 prog top)
- Usar dados reais da familia (attributes, technologies, knowledge)
- Anamnese sintetica fixa (perfil padrao)
- Banner amarelo "Narrativa demonstrativa -- gerada com anamnese sintetica" acima de cada exemplo

## Arquivos a criar/modificar

### Novo: `src/components/audit/CommercialAuditTab.tsx`
Componente principal com 5 secoes em Cards:

1. **Media de attributes_base por tier** -- Tabela com tiers nas colunas, atributos nas linhas, medias calculadas. Tier `unknown` incluso se houver familias sem tier resolvido.

2. **Familias sem technology_refs** -- Lista agrupada por tier (incluindo unknown), com nome e fornecedor de cada familia.

3. **Tecnologias mais usadas por tier** -- Ranking por tier mostrando nome da tech, contagem, e o `high_tier_bias` calculado.

4. **Anomalias de posicionamento** -- Familias essential/comfort com techs cujo `high_tier_bias >= 0.70`. Badge vermelha com o valor do bias.

5. **Narrativas de exemplo** -- 3 accordions expandiveis, cada um com banner "demonstrativa", dados da familia usada, e narrativa gerada.

### Modificar: `src/pages/CatalogAudit.tsx`
- Adicionar aba "Comercial" com icone `Activity`
- Importar e renderizar `CommercialAuditTab` passando dados do store

## Logica de resolucao de tier (funcao local)

```text
function resolveStrictTier(family, catalogMacros):
  if family.tier_target in [essential, comfort, advanced, top]:
    return family.tier_target
  if catalogMacros has macro matching family.macro with valid tier_key:
    return macro.tier_key
  return 'unknown'
```

Esta funcao substitui `determineTierKey` do scorer (que infere por nome) neste contexto de auditoria.

## Anamnese sintetica fixa para narrativas

```text
{
  usageProfile: 'general',
  visualComplaints: ['fadiga_digital'],
  lifestyle: ['office'],
  prescription: { rightSphere: -2.00, leftSphere: -1.75, rightCylinder: -0.50, leftCylinder: -0.75 }
}
```

## Sem dependencias novas
Usa componentes UI existentes (Card, Table, Badge, Accordion, Alert) e imports de `narrativeEngine` e tipos do `lens.ts`.

