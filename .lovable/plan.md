

# Diagnostico: Recomendacoes Desconectadas da Anamnese

## Problemas Identificados

### 1. Gate `no_grade` elimina 90% dos SKUs
O funil mostra claramente:
- MONOFOCAL: 2495 SKUs → 2293 passam `active` → **354 passam `no_grade`** → 5 familias
- OCUPACIONAL: 195 SKUs → 176 passam `active` → **0 passam `no_grade`** → 0 familias

Ou seja, ~85% dos SKUs tem `sphere_min=0, sphere_max=0` (dados do ERP sem grade real). O gate `no_grade` esta correto conceitualmente, mas o resultado pratico e que sobram apenas **5 familias monofocais** e **zero ocupacionais**.

### 2. Score clinico nao diferencia as 5 familias restantes
Das 5 familias que sobrevivem, todas recebem score identico (52.9). Isso acontece porque:
- **Complaints score**: verifica `attributes_base` das familias — provavelmente vazio ou sem atributos mapeados
- **Lifestyle score**: verifica `technology_refs` por keywords (`blue`, `digital`, `photo`) — pode funcionar parcialmente, mas com 5 familias identicas nao ha variacao
- **Prescription score**: todas compativeis = score igual

### 3. Sugestoes adicionais (ocupacional/solar) estao vazias
O log mostra `[AdditionalProductModal] Occupational families received: 0`. O motor de sugestoes (`productSuggestionEngine`) detecta corretamente a necessidade de ocupacional via anamnese, mas:
- Filtra familias por `category === 'OCUPACIONAL'`
- Todas as 11 familias ocupacionais tem SKUs com grade zerada → 0 passam no `no_grade`

### 4. Escada de valor incompleta
- Essential: 0, Comfort: 3, Advanced: 2, Top: 0
- Sem Essential e sem Top, a escada fica desconectada

## Causa Raiz

O gate `no_grade` resolveu o problema conceitual (nao recomendar sem dados clinicos reais), mas criou um problema pratico: **quase nenhum produto sobrevive ao funil**. Os dados do ERP raramente trazem grades de dioptria preenchidas.

## Plano de Correcao

### Etapa 1 — Modo hibrido no gate `no_grade`

Em vez de bloquear totalmente, criar um **flag** que diferencia:
- SKU com grade real → elegivel normalmente (score cheio)
- SKU sem grade (zeros) → elegivel com **penalidade** no score clinico (-15pts no prescriptionMatch) e um flag `gradeSource: 'safe_default'`

Isso permite que o motor funcione com o catalogo real enquanto grades nao sao preenchidas, mas **prioriza** SKUs com dados reais quando existirem.

**Arquivo**: `src/lib/recommendationEngine/skuEligibility.ts`
- Remover o gate `no_grade` como bloqueio
- Adicionar flag `usingSafeDefaults: boolean` no resultado
- No `recommendationScorer.ts`, aplicar penalidade de -15 no prescriptionMatch para SKUs com safe defaults

### Etapa 2 — Enriquecer `attributes_base` das familias

O complaints score depende de `attributes_base` (ex: `PROG_CONFORTO >= 2`), mas esse campo esta vazio na maioria das familias. Precisamos popular com base no posicionamento de mercado.

**Implementacao**: Adicionar modo `inject-attributes` na edge function `audit-catalog` que receba um mapa de atributos por familia e atualize o catalogo JSON.

Mapa exemplo:
```text
FAMILIA                    attributes_base
───────────────────────────────────────────
Varilux XR Pro             { PROG_CONFORTO: 5, PROG_NITIDEZ: 5, PROG_ADAPTACAO: 5 }
Varilux Comfort            { PROG_CONFORTO: 4, PROG_ADAPTACAO: 3 }
Hilux                      { MONO_CONFORTO: 2, durability: 3 }
Lifestyle 4                { PROG_CONFORTO: 3, digital_comfort: 3 }
```

### Etapa 3 — Corrigir fluxo de sugestoes ocupacionais/solares

O `AdditionalProductModal` recebe `occupationalRecommendations` do motor, que tambem passa pelo gate `no_grade`. Com a Etapa 1, as familias ocupacionais voltarao a aparecer com o flag de safe defaults.

Adicionalmente, o `productSuggestionEngine.ts` filtra por `f.category === 'OCUPACIONAL'` — verificar se as familias injetadas tem `clinical_type` correto.

### Etapa 4 — Melhorar diferenciacao de score entre familias

Atualmente todas as 5 familias recebem 52.9. Para diferenciar:
- Com `attributes_base` populado (Etapa 2), o complaints score passara a variar
- Com `technology_refs` ja vinculados, o lifestyle score ja deveria variar — mas so se os refs conterem keywords relevantes
- Adicionar **bonus por tier_target**: familias com tier mais alto recebem bonus proporcional no lifestyle score quando a anamnese indica prioridade estetica alta

**Arquivo**: `src/lib/recommendationEngine/clinicalEngine.ts`
- No `calculateLifestyleScore`, usar `tier_target` da familia (ja classificado) em vez do `tierKey` placeholder

## Arquivos Afetados

- `src/lib/recommendationEngine/skuEligibility.ts` — modo hibrido no gate no_grade
- `src/lib/recommendationEngine/recommendationScorer.ts` — penalidade safe defaults
- `src/lib/recommendationEngine/clinicalEngine.ts` — usar tier_target, melhor diferenciacao
- `supabase/functions/audit-catalog/index.ts` — novo modo `inject-attributes`
- Catalogo JSON no Storage — popular `attributes_base`

## Ordem de Execucao

1. Modo hibrido no `no_grade` (desbloqueia imediatamente o catalogo)
2. Corrigir lifestyle score para usar `tier_target` real
3. Injetar `attributes_base` nas familias (melhora complaints score)
4. Verificar sugestoes ocupacionais/solares

## Resultado Esperado

- De 5 familias → ~60+ familias elegiveis para MONOFOCAL
- De 0 → ~10+ familias elegiveis para OCUPACIONAL
- Scores diferenciados por familia baseados na anamnese real
- Escada de valor completa (4 tiers populados)
- Sugestoes de produtos adicionais funcionais

