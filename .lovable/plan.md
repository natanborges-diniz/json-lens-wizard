
# Auditoria Completa do Catálogo - Dados Tecnico-Clinicos + Coverage

## Objetivo
Edge function `catalog-field-audit` com dois modos:
1. **field-audit** (default): relatório de preenchimento de campos técnicos
2. **coverage**: simulação de elegibilidade com cenários sintéticos, reportando funil de descarte

---

## MODO 1: Field Audit (já planejado)

### Campos Auditados

| Campo | Fonte V3.6.x (`availability`) | Fonte Legacy (`specs`) |
|-------|-------------------------------|------------------------|
| **Cilindro** | `availability.cylinder.min/max` | `specs.cyl_min/cyl_max` |
| **Adição** | `availability.addition.min/max` | `specs.add_min/add_max` |
| **Diâmetro** | `availability.diameter_min/max` | `specs.diameter_min_mm/diameter_max_mm` |
| **Índice** | `availability.index` | `price.index` ou `price.index_value` |

### Lógica de detecção

```text
cylinder_filled = 
  (availability?.cylinder?.min != null AND availability?.cylinder?.max != null)
  OR (specs?.cyl_min != null AND specs?.cyl_max != null)

addition_filled =
  (availability?.addition?.min != null AND availability?.addition?.max != null)
  OR (specs?.add_min != null AND specs?.add_max != null)

addition_na = clinical_type == 'MONOFOCAL'

diameter_filled =
  (availability?.diameter_min != null AND availability?.diameter_max != null)
  OR (specs?.diameter_min_mm != null AND specs?.diameter_max_mm != null)

index_filled =
  availability?.index != null
  OR price.index != null
  OR price.index_value != null
```

### Saída field-audit

```text
{
  meta: { total_skus, total_families, generated_at },
  global: { cylinder: { filled, missing, pct_filled }, ... },
  by_clinical_type: { "MONOFOCAL": { total_skus, cylinder, ... }, ... },
  by_supplier: { "ZEISS": { total_skus, cylinder, ... }, ... }
}
```

---

## MODO 2: Coverage (novo)

### Objetivo
Gerar cenários de prescrição sintéticos por `clinical_type`, executar a lógica de elegibilidade contra todos os SKUs e reportar quantos passam/falham e por qual motivo.

### Cenários sintéticos por clinical_type

Para cada tipo clínico, gerar automaticamente combinações de borda e mediana:

#### MONOFOCAL
| Cenário | Esférico | Cilindro | Adição |
|---------|----------|----------|--------|
| leve_tipico | -2.00 | -0.75 | — |
| miopia_moderada | -5.00 | -1.50 | — |
| miopia_alta | -8.00 | -2.00 | — |
| hipermetropia_alta | +6.00 | -1.00 | — |
| cilindro_alto | -3.00 | -4.00 | — |
| borda_maxima | -10.00 | -6.00 | — |

#### PROGRESSIVA
| Cenário | Esférico | Cilindro | Adição |
|---------|----------|----------|--------|
| presbiopia_inicial | +1.00 | -0.50 | 1.00 |
| presbiopia_tipica | -2.00 | -1.00 | 2.00 |
| presbiopia_avancada | +3.00 | -1.50 | 3.00 |
| adicao_maxima | -1.00 | -0.75 | 3.50 |
| miopia_alta_prog | -7.00 | -2.00 | 2.50 |
| cilindro_alto_prog | -3.00 | -4.00 | 2.00 |

#### OCUPACIONAL
| Cenário | Esférico | Cilindro | Adição |
|---------|----------|----------|--------|
| office_leve | -1.00 | -0.50 | 1.00 |
| office_tipico | -2.00 | -1.00 | 1.75 |
| office_avancado | +2.00 | -1.50 | 2.50 |

#### BIFOCAL
| Cenário | Esférico | Cilindro | Adição |
|---------|----------|----------|--------|
| bifocal_leve | +1.00 | -0.50 | 1.50 |
| bifocal_tipico | -2.00 | -1.00 | 2.50 |
| bifocal_alto | +4.00 | -2.00 | 3.50 |

### Lógica de elegibilidade (reproduz clinicalEngine)

Para cada cenário × cada SKU:
1. Resolver limites técnicos do SKU (availability > specs > REJEITAR)
2. Validar esférico: `|rx_sphere| <= max(|sphere_min|, |sphere_max|)`
3. Validar cilindro: `|rx_cylinder| <= |cylinder_min|`
4. Validar adição (se aplicável): `addition_min <= rx_addition <= addition_max`
5. Se algum passo falha, registrar o motivo

### Motivos de descarte (funil)

```text
- no_technical_data: SKU sem availability nem specs
- sphere_out_of_range: esférico fora da grade
- cylinder_out_of_range: cilindro fora da grade
- addition_out_of_range: adição fora da grade
- no_active_price: preço zero ou bloqueado
- eligible: passou todos os filtros
```

### Saída coverage

```text
{
  mode: "coverage",
  meta: { total_skus, total_families, scenarios_tested, generated_at },
  
  by_clinical_type: {
    "PROGRESSIVA": {
      scenarios: {
        "presbiopia_tipica": {
          prescription: { sphere: -2.00, cylinder: -1.00, addition: 2.00 },
          total_skus_evaluated: N,
          eligible: N,
          discard_funnel: {
            no_technical_data: N,
            sphere_out_of_range: N,
            cylinder_out_of_range: N,
            addition_out_of_range: N,
            no_active_price: N
          },
          eligible_families: ["family_id_1", "family_id_2"],
          pct_eligible: "XX%"
        },
        ...
      }
    },
    ...
  },
  
  summary: {
    worst_scenarios: [
      { clinical_type, scenario, pct_eligible, main_blocker }
    ],
    total_eligible_rate_by_type: {
      "MONOFOCAL": "XX%",
      "PROGRESSIVA": "XX%",
      ...
    }
  }
}
```

---

## Implementação

### Endpoint único: `catalog-field-audit`

- `GET /catalog-field-audit` → modo field-audit (default)
- `GET /catalog-field-audit?mode=coverage` → modo coverage
- `GET /catalog-field-audit?mode=coverage&clinical_type=PROGRESSIVA` → filtro opcional

### Nenhuma modificação em arquivos existentes

- Não altera o motor de recomendação
- Não altera o catalogIntegrityAnalyzer
- Não altera o catalog-audit existente
- Apenas cria/atualiza a edge function isolada para diagnóstico

## Resultado Esperado

Um endpoint que além de mapear lacunas de dados (modo field-audit), simula cenários reais de prescrição e quantifica exatamente quantos SKUs seriam elegíveis para cada situação clínica, identificando os gargalos sem propor correções.
