

# Plano de Correção: Motor de Recomendação + Auditoria

## Problemas Identificados

### 1. Adição registrada como +0,00 no log
**Causa raiz:** O motor de recomendação roda via `useMemo` assim que o catálogo carrega (antes do usuário preencher a receita). O `hasLoggedRef` no `SellerFlow.tsx` (linha 291-321) persiste o log apenas na PRIMEIRA vez que `engineReady` se torna `true` -- ou seja, com a receita vazia (`maxAddition: 0`). Quando o usuário preenche adição = 2 depois, o log já foi gravado e não atualiza.

**Correção:** Mover a persistência do audit log para o momento em que o vendedor avança para a etapa "Recomendações" (step = 'recommendations'), garantindo que a receita completa já esteja preenchida. Remover o log automático baseado em `engineReady`.

### 2. Prioridades de fornecedor não aplicadas (supplierPriorities: [])
**Causa raiz dupla:**
- No `SellerFlow.tsx` linha 308, o `persistLog` passa `supplierPriorities: []` hardcoded ao invés de usar as prioridades carregadas pelo hook `useRecommendationEngine`.
- O hook `useRecommendationEngine` carrega as prioridades internamente (via Supabase), mas o `SellerFlow` não tem acesso a esse valor para repassar ao logger.

**Correção:**
- Expor `supplierPriorities` do `useRecommendationEngine` para que o `SellerFlow` possa passá-las ao audit logger.
- Atualizar o `persistLog` para usar as prioridades reais.

### 3. TierPosition = 10 para TODOS os tiers
**Causa raiz:** No `commercialEngine.ts`, o score de tier usa `TIER_BASE_SCORES[tierKey]` que corretamente mapeia essential=10, comfort=15, advanced=20, top=25. Porém, o `determineTierKey()` no `recommendationScorer.ts` usa um mapeamento `MACRO_TO_TIER` estático que aparentemente não encontra as macros reais do catálogo. Quando nenhuma macro bate, cai no fallback `'essential'` (tier score = 10 para todas). O log confirma: todos os tiers mostram `tierPosition: 10`.

**Correção:** 
- Tornar `determineTierKey` dinâmico: consultar o array de macros do catálogo (que tem `tier_key`) ao invés de depender de um mapa hardcoded.
- Passar a lista de macros como parâmetro para o scorer, de modo que cada família resolva seu tier a partir dos dados reais do catálogo.

### 4. Integridade: tipos clínicos incompletos
**Causa raiz:** O filtro de categorias no `CatalogAudit.tsx` mostra apenas as categorias (clinical_type) que existem nas famílias do catálogo. Se a maioria das famílias tem `category: "PROGRESSIVA"` e apenas algumas têm `"OCUPACIONAL"`, o usuário não vê uma distribuição real de tipos. Falta uma visão resumo por clinical_type na aba de integridade.

**Correção:** Adicionar um painel de resumo na aba de integridade que mostre a contagem de famílias por `category/clinical_type`, destacando tipos sem famílias associadas e famílias cujo `category` pode estar indefinido ou incorreto.

---

## Detalhes Técnicos das Alterações

### A. `src/hooks/useRecommendationEngine.ts`
- Expor `supplierPriorities` no retorno do hook para que o caller possa usá-las no audit log.

### B. `src/pages/SellerFlow.tsx`
- Remover o `useEffect` que persiste o log automaticamente quando `engineReady` se torna true.
- Adicionar lógica para persistir o audit log quando o step muda para `'recommendations'` (receita já preenchida).
- Usar as `supplierPriorities` reais do hook no `persistLog`.

### C. `src/lib/recommendationEngine/recommendationScorer.ts`
- Alterar `determineTierKey` para aceitar um array de macros do catálogo como parâmetro opcional.
- Prioridade: (1) `family.tier_target`, (2) macro do catálogo com `tier_key`, (3) mapa estático `MACRO_TO_TIER` como fallback, (4) inferência por nome.
- Propagar o parâmetro de macros em `calculateRecommendationScore`, `scoreFamilyComplete` e `scoreAndRankFamilies`.

### D. `src/lib/recommendationEngine/index.ts`
- Passar `input.macros` (novo campo) para `scoreAndRankFamilies`.

### E. `src/lib/recommendationEngine/types.ts`
- Adicionar campo opcional `macros` ao `RecommendationInput`.

### F. `src/pages/CatalogAudit.tsx`
- Adicionar painel de resumo por clinical_type na aba de integridade, mostrando contagem de famílias ativas/inativas, SKUs ativos e famílias sem tipo definido.

### G. `src/types/lens.ts` (se necessário)
- Verificar se `MacroExtended` inclui `tier_key` -- caso contrário, tipar corretamente.

---

## Sequencia de Implementacao

1. Corrigir `determineTierKey` para usar macros reais do catalogo (C, D, E)
2. Expor `supplierPriorities` do hook (A)
3. Mover audit log para momento correto no fluxo e passar dados reais (B)
4. Adicionar resumo por clinical_type na integridade (F)
5. Testar end-to-end

