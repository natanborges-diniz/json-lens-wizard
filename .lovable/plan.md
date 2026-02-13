
# Auditoria Completa do Catálogo - Dados Tecnico-Clinicos

## Objetivo
Criar uma edge function dedicada que leia o `catalog-default.json` do bucket `catalogs` e produza um relatorio estruturado com contagens e percentuais de preenchimento dos campos tecnicos de cada SKU, quebrando por `clinical_type` e `supplier`.

## Campos Auditados

Para cada SKU (item do array `prices`), verificar a presenca e preenchimento de:

| Campo | Fonte V3.6.x (`availability`) | Fonte Legacy (`specs`) |
|-------|-------------------------------|------------------------|
| **Cilindro** | `availability.cylinder.min/max` | `specs.cyl_min/cyl_max` |
| **Adicao** | `availability.addition.min/max` | `specs.add_min/add_max` |
| **Diametro** | `availability.diameter_min/max` | `specs.diameter_min_mm/diameter_max_mm` |
| **Indice** | `availability.index` | `price.index` ou `price.index_value` |

## Estrutura do Relatorio de Saida

```text
{
  meta: { total_skus, total_families, generated_at },
  
  global: {
    cylinder:  { filled: N, missing: N, pct_filled: "XX%" },
    addition:  { filled: N, missing: N, pct_filled: "XX%", na: N },
    diameter:  { filled: N, missing: N, pct_filled: "XX%" },
    index:     { filled: N, missing: N, pct_filled: "XX%" }
  },

  by_clinical_type: {
    "MONOFOCAL": { total_skus, cylinder: {...}, addition: {...}, ... },
    "PROGRESSIVA": { ... },
    "OCUPACIONAL": { ... },
    "BIFOCAL": { ... }
  },

  by_supplier: {
    "ZEISS": { total_skus, cylinder: {...}, addition: {...}, ... },
    "HOYA": { ... },
    ...
  }
}
```

## Implementacao

### 1. Nova edge function: `catalog-field-audit`

- Caminho: `supabase/functions/catalog-field-audit/index.ts`
- Metodo: GET (sem parametros obrigatorios)
- Logica:
  1. Baixar `catalog-default.json` do storage
  2. Iterar sobre todos os `prices` (ativos e inativos, sem filtro)
  3. Para cada SKU, resolver `clinical_type` pelo proprio SKU ou pela familia correspondente
  4. Verificar presenca de cada campo nas duas fontes possiveis (V3.6.x e legacy)
  5. Agregar contagens globais, por `clinical_type` e por `supplier`
  6. Calcular percentuais
  7. Retornar JSON estruturado

### 2. Logica de deteccao de campo preenchido

```text
cylinder_filled = 
  (availability?.cylinder?.min != null AND availability?.cylinder?.max != null)
  OR (specs?.cyl_min != null AND specs?.cyl_max != null)

addition_filled =
  (availability?.addition?.min != null AND availability?.addition?.max != null)
  OR (specs?.add_min != null AND specs?.add_max != null)

addition_na = clinical_type == 'MONOFOCAL'  (nao requer adicao)

diameter_filled =
  (availability?.diameter_min != null AND availability?.diameter_max != null)
  OR (specs?.diameter_min_mm != null AND specs?.diameter_max_mm != null)

index_filled =
  availability?.index != null
  OR price.index != null
  OR price.index_value != null
```

### 3. Nenhuma modificacao em arquivos existentes

- Nao altera o motor de recomendacao
- Nao altera o catalogIntegrityAnalyzer
- Nao altera o catalog-audit existente
- Apenas cria uma nova edge function isolada para diagnostico

## Resultado Esperado

Um endpoint chamavel que retorna o panorama completo de preenchimento dos dados tecnicos do catalogo, permitindo identificar exatamente onde estao as lacunas sem propor correcoes.
