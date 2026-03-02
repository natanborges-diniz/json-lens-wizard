
# Plan 7 (Revisado): Clinical Engine Real v2

## Resumo

Corrigir o bug critico de frame nunca chegar ao pipeline. Implementar calculo canonico de diametro com DNP robusto, gate de product_kind baseado em resolucao semantica (nao em `process`), ClinicalFitScore como bonus de ordenacao para elegiveis, e labels resolvidos na saida.

---

## Estado Atual Confirmado

- `FrameMeasurements` tem apenas `dp: number` (binocular unico), sem DNP monocular
- `FrameStep` coleta `dp` com label "Mono ou binocular" mas e um campo so
- `useRecommendationEngine` NAO recebe nem passa `frameData` (linhas 325-330 de SellerFlow)
- `index.ts` linha 106: `undefined` hardcoded para frame
- Nao existe campo `product_kind` em `Price` nem `Family`
- Nao existe funcao `resolveProductKind`

---

## Entregaveis

### E1: Estender FrameMeasurements + UI para DNP

**Modificar `src/types/lens.ts`:**
```typescript
export interface FrameMeasurements {
  horizontalSize: number;   // A
  verticalSize: number;     // B
  bridge: number;           // DBL
  dp: number;               // binocular (fallback)
  dnpOD?: number;           // monocular OD
  dnpOE?: number;           // monocular OE
  altura?: number;          // altura de montagem
}
```

**Modificar `src/components/anamnesis/FrameStep.tsx`:**
- Adicionar campos opcionais `dnpOD` e `dnpOE` abaixo do DP existente
- Label: "DNP monocular (opcional)" com hint "Se disponivel, informar OD e OE separados"
- Manter DP binocular como campo principal

### E2: Calculo Canonico de Diametro

**Novo arquivo: `src/lib/clinical/calcRequiredDiameter.ts`**

```typescript
interface PupillaryData {
  dnpOD?: number;
  dnpOE?: number;
  dp?: number;
}

interface DiameterCalcResult {
  requiredOD: number;
  requiredOE: number;
  maxRequired: number;
  debug: {
    GCD: number;
    decentrationOD: number;
    decentrationOE: number;
    methodUsed: 'monocular' | 'binocular_half' | 'fallback_no_pd';
  };
}

function calcRequiredDiameter(
  frame: { horizontalSize: number; verticalSize: number; bridge: number },
  pd: PupillaryData,
  safetyMarginMm: number = 2
): DiameterCalcResult
```

Logica de resolucao de DNP:
1. Se `pd.dnpOD` e `pd.dnpOE` presentes: usar diretamente, `methodUsed = 'monocular'`
2. Se apenas `pd.dp` presente: `dnpOD = dnpOE = dp / 2`, `methodUsed = 'binocular_half'`
3. Se nenhum disponivel: `dnpOD = dnpOE = frame.horizontalSize / 2`, `methodUsed = 'fallback_no_pd'`

Calculo MBS por olho:
```text
GCD = A + DBL
decentration = abs((GCD / 2) - dnp_eye)
horizontal_need = A + 2 * decentration
required = max(horizontal_need, B) + safetyMarginMm
```

### E3: resolveProductKind (funcao canonica)

**Novo arquivo: `src/lib/clinical/resolveProductKind.ts`**

```typescript
type ProductKind = 'LP' | 'VS' | 'PR' | 'OC' | 'BF' | 'UNKNOWN';

interface ProductKindResult {
  kind: ProductKind;
  source: 'product_kind' | 'clinical_type' | 'manufacturing_type' | 'description' | 'fallback';
}

function resolveProductKind(sku: Price, family?: FamilyExtended): ProductKindResult
```

Prioridade de resolucao:
1. `(sku as any).product_kind` se existir como campo explicito
2. `sku.clinical_type` ou `family.clinical_type`:
   - MONOFOCAL -> LP ou VS (depende de process/manufacturing_type)
   - PROGRESSIVA -> PR
   - OCUPACIONAL -> OC
   - BIFOCAL -> BF
3. `sku.manufacturing_type` + `sku.process`:
   - Se PRONTA + MONOFOCAL context -> LP
   - Se SURFACADA + MONOFOCAL context -> VS
4. Regex na `sku.description`: procurar "progressiv", "ocupacional", "bifocal"
5. Fallback: UNKNOWN com `source = 'fallback'`

### E4: Gate product_kind no skuEligibility

**Modificar `src/lib/recommendationEngine/skuEligibility.ts`:**

Novo gate entre addition e diameter (Gate 4b):

```typescript
// Gate 4b: ProductKind coherence
const pkResult = resolveProductKind(sku, familyMap.get(sku.family_id));
const hasAddition = maxAdd > 0;

if (hasAddition && (pkResult.kind === 'LP' || pkResult.kind === 'VS')) {
  return { eligible: false, failedGate: 'product_kind' };
}
if (!hasAddition && (pkResult.kind === 'PR' || pkResult.kind === 'OC')) {
  return { eligible: false, failedGate: 'product_kind' };
}
```

Expandir `SkuEligibilityResult` com debug:
```typescript
export interface SkuEligibilityResult {
  eligible: boolean;
  failedGate: string | null;
  debug?: {
    requiredDiameterMm?: number;
    skuDiameterMaxMm?: number;
    productKind?: string;
    productKindSource?: string;
  };
}
```

Expandir `EligibilityFunnel` com `passedProductKind`.

Gate order final: active -> price -> no_specs -> sphere -> cyl -> add -> product_kind -> diameter -> height

### E5: ClinicalFitScore (apenas para elegiveis)

**Novo arquivo: `src/lib/clinical/computeClinicalFitScore.ts`**

```typescript
interface ClinicalFitResult {
  score: number;  // 0-100
  penalties: {
    sphereNearLimit: number;
    cylinderNearLimit: number;
    additionNearLimit: number;
    diameterTight: number;
    heightUnknown: number;
    dnpMissing: number;
  };
  reasons: string[];
}

function computeClinicalFitScore(
  sku: Price,
  rx: Partial<Prescription>,
  frame: FrameMeasurements | null,
  pd: PupillaryData | null
): ClinicalFitResult
```

Regras:
- Comeca em 100
- Para cada eixo: calcula margem entre valor Rx e limite do SKU
  - Margem < 10% do range: -15
  - Margem < 25% do range: -10
  - Margem < 50% do range: -5
- Diametro (margem entre sku.diameter_max e requiredDiameter):
  - < 2mm: -20
  - < 5mm: -10
  - < 10mm: -5
- Altura desconhecida em PR/OC: -10
- DNP faltante: -5

**REGRA CRITICA**: FitScore so e calculado para SKUs que JA passaram todos os gates. Nunca reintroduz SKU reprovado.

### E6: Integracao no Pipeline

**Modificar `src/lib/recommendationEngine/types.ts`:**
- Adicionar `frame?: FrameMeasurements` ao `RecommendationInput`

**Modificar `src/lib/recommendationEngine/index.ts`:**
- Linha 106: trocar `undefined` por `input.frame`

**Modificar `src/hooks/useRecommendationEngine.ts`:**
- Adicionar `frameData?: Partial<FrameMeasurements>` nas props
- Passar `frame: frameData as FrameMeasurements` no input do motor

**Modificar `src/pages/SellerFlow.tsx`:**
- Passar `frameData` nas duas chamadas de `useRecommendationEngine` (linhas 325-330 e 335-340)

**Modificar `src/lib/recommendationEngine/clinicalEngine.ts`:**
- `prescriptionMatch` permanece 40pts (compatibilidade binaria ratio)
- Adicionar componente `clinicalFit` ao `ClinicalScore`:
  - `clinicalFit: number` (0-15pts) baseado no melhor FitScore da familia normalizado
  - Formula: `clinicalFit = (bestFitScore / 100) * 15`
- Ajustar `prescriptionMatch` de 40 para 25pts
- Total clinico: 25 (prescriptionMatch) + 15 (clinicalFit) + 30 (complaints) + 30 (lifestyle) = 100

### E7: Campos resolvidos na saida

**Modificar `ScoredFamily` em types.ts:**
```typescript
export interface ScoredFamily {
  // ... campos existentes
  resolvedClinicalType?: ClinicalType;
  resolvedProductKind?: string;  // LP/VS/PR/OC/BF
}
```

Preenchidos no `scoreFamilyComplete` a partir do clinical_type efetivo e do product_kind do SKU vencedor (menor preco).

**UI usa esses campos para label** em vez de macro/tier legacy.

### E8: Debug Clinico Expandido

**Modificar `PipelineDebugInfo` no hook:**
```typescript
clinicalDebug?: {
  requiredDiameterOD?: number;
  requiredDiameterOE?: number;
  diameterMethod?: string;
  frameAltura?: number;
  productKindDistribution?: Record<string, number>;
  avgFitScore?: number;
  topRejectionReasons?: Array<{ gate: string; count: number }>;
};
```

**Modificar `RecommendationsGrid.tsx`:**
- No painel debug existente, adicionar secao "Diagnostico Clinico" com os campos acima quando disponiveis

---

## Sequencia de Implementacao

1. **Tipos**: Estender `FrameMeasurements` (dnpOD/dnpOE), adicionar `frame` ao `RecommendationInput`, expandir `SkuEligibilityResult`, `EligibilityFunnel`, `ScoredFamily`, `ClinicalScore`
2. **`src/lib/clinical/calcRequiredDiameter.ts`**: Funcao pura com PupillaryData robusto
3. **`src/lib/clinical/resolveProductKind.ts`**: Funcao canonica com prioridade de fontes
4. **`src/lib/clinical/computeClinicalFitScore.ts`**: Score 0-100 apenas para elegiveis
5. **`src/lib/recommendationEngine/skuEligibility.ts`**: Refatorar gates (usar calcRequiredDiameter, adicionar gate product_kind, expandir debug)
6. **`src/lib/recommendationEngine/clinicalEngine.ts`**: Integrar clinicalFit (25+15 = 40pts prescricao)
7. **`src/lib/recommendationEngine/recommendationScorer.ts`**: Passar frame, computar fitScore por familia
8. **`src/lib/recommendationEngine/index.ts`**: Corrigir `undefined` -> `input.frame`
9. **`src/hooks/useRecommendationEngine.ts`**: Receber e passar frameData
10. **`src/pages/SellerFlow.tsx`**: Passar frameData nas chamadas do hook
11. **`src/components/anamnesis/FrameStep.tsx`**: Campos DNP monocular opcionais
12. **`src/components/recommendations/RecommendationsGrid.tsx`**: Expandir debug clinico

---

## Arquivos Afetados

**Novos:**
- `src/lib/clinical/calcRequiredDiameter.ts`
- `src/lib/clinical/resolveProductKind.ts`
- `src/lib/clinical/computeClinicalFitScore.ts`

**Modificados:**
- `src/types/lens.ts` (FrameMeasurements + dnpOD/dnpOE)
- `src/lib/recommendationEngine/skuEligibility.ts` (gates + debug)
- `src/lib/recommendationEngine/types.ts` (frame no input, ScoredFamily resolvedFields)
- `src/lib/recommendationEngine/clinicalEngine.ts` (clinicalFit 15pts)
- `src/lib/recommendationEngine/recommendationScorer.ts` (frame passado, fitScore)
- `src/lib/recommendationEngine/index.ts` (corrigir undefined)
- `src/hooks/useRecommendationEngine.ts` (frameData prop)
- `src/pages/SellerFlow.tsx` (passar frameData)
- `src/components/anamnesis/FrameStep.tsx` (campos DNP mono)
- `src/components/recommendations/RecommendationsGrid.tsx` (debug clinico)

**Nao alterados:**
- commercialEngine.ts, fallbackStrategy.ts, narrativeEngine.ts
- Catalogo JSON (Zero Criacao mantido)

---

## Garantias

| Garantia | Mecanismo |
|----------|-----------|
| Frame data chega ao pipeline | Bug corrigido: input.frame passado em toda a cadeia |
| DNP robusto | 3 fallbacks: monocular -> dp/2 -> A/2, com methodUsed no debug |
| Gate product_kind correto | resolveProductKind com 5 niveis de prioridade, nunca usa `process` sozinho |
| Rx com adicao nunca gera LP/VS | Gate product_kind rejeita SKUs incompativeis |
| FitScore so em elegiveis | Calculado apos gates, como bonus de ordenacao |
| Score 60/40 preservado | 25 + 15 + 30 + 30 = 100 clinico; formula 60/40 inalterada |
| Labels corretos na UI | resolvedClinicalType e resolvedProductKind expostos na ScoredFamily |
| Ordem de gates estavel | active -> price -> no_specs -> sphere -> cyl -> add -> product_kind -> diameter -> height |
