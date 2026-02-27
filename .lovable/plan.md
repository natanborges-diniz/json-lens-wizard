
# Fase 4: Motor Multi-Fornecedor SKU-first + Grid 1 por Tier + "Ver Similares"

## Resumo

Refatorar o motor de recomendacao para operar em modo SKU-first, classificar tiers globalmente por preco+tecnologia, aplicar prioridade comercial por loja (nao global), e apresentar 1 vencedor por tier com expansao "Ver similares".

---

## Arquitetura Atual vs. Proposta

```text
ATUAL:
  families -> filter clinicalType -> score (clinical+commercial) -> tier by macro
    -> rebalanceTiersByPrice -> organizeTiersWithFallback

PROPOSTA:
  SKUs -> isSkuEligibleForRx(sku, rx, frame) -> eligibleFamilies
    -> TierScore global (price median + tech weighted score)
    -> tier_assigned (runtime only)
    -> StoreBoost (ranking interno do tier, cap 15)
    -> 1 winner/tier + similares list
```

---

## E1: Pipeline SKU-first Eligibility

**Arquivo novo:** `src/lib/recommendationEngine/skuEligibility.ts`

Funcao canonica `isSkuEligibleForRx(sku, rx, frame)` com gates sequenciais:
1. `active === true && blocked === false`
2. Esfera OD/OE dentro de `sphere_min..sphere_max` (specs ou availability)
3. Cilindro OD/OE dentro de `cyl_min..cyl_max`
4. Adicao: se Rx tem adicao > 0, exigir `add_min <= add <= add_max`
5. Diametro: se frame fornecida, calcular diametro requerido e validar `diameter_max_mm >= required`
6. Altura minima (quando `altura_min_mm` disponivel)

Retorna `{ eligible: boolean; failedGate: string | null }` para funil de auditoria.

Funcao `getEligibleSkusAndFamilies(prices, families, rx, frame)`:
- Filtra SKUs elegiveis
- Agrupa por family_id
- Familia so entra se tiver >= 1 SKU elegivel
- Retorna `{ eligibleSkus, eligibleFamilies: Map<string, Price[]>, funnelCounts }`

**Impacto:** Substitui `isPriceCompatible` e `findStartingPrice` atuais.

---

## E2: Tier Global por Preco + Tecnologia (com techScore ponderado)

**Arquivo:** Refatorar `recommendationScorer.ts`, remover `determineTierKey` baseado em macro e `MACRO_TO_TIER`.

Para cada familia elegivel:
- `familyPriceMedian` = mediana dos `price_sale_half_pair` dos SKUs elegiveis
- `familyTechScore` = soma ponderada dos `technology_refs`:
  - Se `technology_library.items[ref].weight` existir, usar esse peso
  - Se nao existir, peso default = 1
  - Score = soma dos pesos de todos refs resolvidos

Normalizacao global (todas familias elegiveis de todos fornecedores):
- `PricePercentileGlobal` (0-100): percentil do preco mediano
- `TechPercentileGlobal` (0-100): percentil do tech score ponderado

```text
TierScore = 0.6 * PricePercentileGlobal + 0.4 * TechPercentileGlobal

Essential:  0-25
Comfort:   25-55
Advanced:  55-80
Top:       80-100
```

O `tier_assigned` e salvo apenas em runtime (no `ScoredFamily.score.tierKey`), nunca gravado no catalogo.

**Tratamento de tiers vazios (pool pequeno < 8 familias):**
- Calcular TierScore global normalmente (tier puro)
- Se algum tier ficar vazio apos classificacao:
  - Permitir puxar 1 candidato do tier adjacente apenas na UI
  - Marcar como `isFallback: true` com `fallbackReason: "Tier sugerido por metadata (pool pequeno)"`
  - Registrar no audit log
  - Nao alterar o `tier_assigned` original da familia (tier global permanece puro)

---

## E3: Prioridade Comercial por Loja

**Migracao de banco:** Adicionar coluna `supplier_priorities JSONB DEFAULT '[]'` na tabela `stores`.

**Logica de resolucao (via `resolveBusinessContext` existente ou `useStoreContext`):**
- Fonte primaria: `stores.supplier_priorities` (loja selecionada)
- Fallback: `company_settings.supplier_priorities` (global, ja existe)

**Modificacoes em `commercialEngine.ts`:**
- Renomear score de fornecedor para `StoreBoost`
- Aplicar boost APOS `tier_assigned`, apenas para ordenar dentro do mesmo tier

```text
AdjustedScore = BaseScore + StoreBoost
```

- Tetos: boost por regra <= 10, acumulado <= 15
- O boost NUNCA altera ClinicalScore, elegibilidade ou tier

**Tipo atualizado em `types.ts`:**
```typescript
interface RecommendationScore {
  // ...campos existentes
  storeBoost: number;
  adjustedScore: number;  // final + storeBoost
}
```

**UI:** Adicionar campo `supplier_priorities` na tela de edicao de lojas (StoreManagement) com o mesmo componente `SupplierPriorityManager` ja existente.

---

## E4: Grid 1 Vencedor por Tier

**Arquivo:** `RecommendationsGrid.tsx`

Logica simplificada no `tierOptions` useMemo:
- Para cada tier: `winner = max(adjustedScore)` entre familias do tier
- Remover logica de "price inversion swap" (desnecessaria com tier global por preco)
- Remover `rebalanceTiersByPrice` do `index.ts` (substituido por E2)

---

## E5: Expansao "Ver Similares"

**Arquivo novo:** `src/components/recommendations/SimilarLensesSheet.tsx`

Para cada tier, gerar `similarOptions(tier)`:
- Familias no mesmo tier (exceto o winner)
- Mesmas regras de elegibilidade SKU-first
- Ordenadas por `adjustedScore`
- Diversidade: intercalar fornecedores (round-robin por supplier)
- Max 6-8 items

UI:
- Botao "Ver similares (N)" no `SimplifiedLensCard` (ja tem props `alternativeCount` e `onViewAlternatives`)
- Abrir Sheet lateral com lista de cards compactos
- Acao "Selecionar este" substitui o winner no estado do fluxo
- Usar componente `Sheet` existente

---

## E6: Auditoria e Debug

Em cada execucao do motor, registrar:

```typescript
interface EligibilityFunnel {
  totalSkus: number;
  passedActive: number;
  passedSphere: number;
  passedCylinder: number;
  passedAddition: number;
  passedDiameter: number;
  passedHeight: number;
  finalEligible: number;
}
```

- Winners por tier + boosts aplicados
- Lista resumida de similares por tier (top 3 IDs)
- Se todos tiers vazios: painel diagnostico existente (`pipelineDebug`) atualizado com funil

---

## Sequencia de Implementacao

1. Migracao DB: `stores.supplier_priorities` (JSONB)
2. `skuEligibility.ts` (E1) - funcao pura, testavel isoladamente
3. Refatorar `recommendationScorer.ts` para tier global com techScore ponderado (E2)
4. Ajustar `commercialEngine.ts` para StoreBoost com cap (E3)
5. Atualizar `types.ts` com `storeBoost` e `adjustedScore`
6. Refatorar `index.ts` (remover `rebalanceTiersByPrice`, usar novo pipeline)
7. Atualizar `useRecommendationEngine.ts` (funil + novos campos + ler store priorities)
8. Criar `SimilarLensesSheet.tsx` (E5)
9. Atualizar `RecommendationsGrid.tsx` e `SimplifiedLensCard.tsx` (E4 + E5)
10. Adicionar `SupplierPriorityManager` na tela de lojas
11. Atualizar painel de debug (E6)

---

## Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| Pool pequeno gera tiers vazios | Puxar 1 candidato do tier adjacente na UI, marcado como fallback (tier global permanece puro) |
| techScore por contagem simples distorce ranking | Usar soma ponderada (weight do technology_library, default=1) |
| Prioridade global confundida com por loja | stores.supplier_priorities como fonte primaria, company_settings como fallback |
| Prioridade por loja altera resultado inesperadamente | Cap de 15 pts e auditoria explicita |
| Performance com 6250 SKUs | Pipeline O(n), sem loops aninhados |

---

## Arquivos Afetados

**Novos:**
- `src/lib/recommendationEngine/skuEligibility.ts`
- `src/components/recommendations/SimilarLensesSheet.tsx`

**Modificados:**
- `src/lib/recommendationEngine/types.ts` (storeBoost, adjustedScore)
- `src/lib/recommendationEngine/index.ts` (remover rebalanceTiersByPrice, usar novo pipeline)
- `src/lib/recommendationEngine/recommendationScorer.ts` (tier global, techScore ponderado)
- `src/lib/recommendationEngine/commercialEngine.ts` (StoreBoost com cap)
- `src/lib/recommendationEngine/clinicalEngine.ts` (delegar eligibilidade ao skuEligibility)
- `src/hooks/useRecommendationEngine.ts` (funil, ler store priorities)
- `src/components/recommendations/RecommendationsGrid.tsx` (1 winner/tier, sheet similares)
- `src/components/recommendations/SimplifiedLensCard.tsx` (ajustes menores)
- `src/pages/StoreManagement.tsx` (SupplierPriorityManager por loja)

**Migracao DB:**
- `ALTER TABLE stores ADD COLUMN supplier_priorities JSONB DEFAULT '[]'`

**Nao alterados (Zero Criacao):**
- Catalogo JSON
- Edge functions existentes
- Persistencia de draft
