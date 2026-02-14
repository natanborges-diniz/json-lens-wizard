

# Auditoria Completa do Catálogo - Modo Coverage
## Plano de Implementação

### 1. Objetivo e Escopo
Expandir a edge function `supabase/functions/catalog-audit/index.ts` para adicionar um **modo coverage** (além do mode padrão field-audit), que:
- Gera **cenários sintéticos** de prescrição por `clinical_type`
- Executa a lógica de **elegibilidade clínica** contra todos os SKUs
- Reporta um **funil de descarte** quantificando falhas por motivo específico
- NÃO modifica dados do catálogo (diagnóstico puro)

### 2. Estrutura de Cenários Sintéticos

Os cenários são gerados automaticamente com **bordas e medianas** por tipo clínico:

#### MONOFOCAL (6 cenários)
- **leve_tipico**: -2.00 / -0.75
- **miopia_moderada**: -5.00 / -1.50
- **miopia_alta**: -8.00 / -2.00
- **hipermetropia_alta**: +6.00 / -1.00
- **cilindro_alto**: -3.00 / -4.00
- **borda_maxima**: -10.00 / -6.00

#### PROGRESSIVA (6 cenários)
- **presbiopia_inicial**: -2.00 / -0.50 / 1.00
- **presbiopia_tipica**: -2.00 / -1.00 / 2.00
- **presbiopia_avancada**: +3.00 / -1.50 / 3.00
- **adicao_maxima**: -1.00 / -0.75 / 3.50
- **miopia_alta_prog**: -7.00 / -2.00 / 2.50
- **cilindro_alto_prog**: -3.00 / -4.00 / 2.00

#### OCUPACIONAL (3 cenários)
- **office_leve**: -1.00 / -0.50 / 1.00
- **office_tipico**: -2.00 / -1.00 / 1.75
- **office_avancado**: +2.00 / -1.50 / 2.50

#### BIFOCAL (3 cenários)
- **bifocal_leve**: +1.00 / -0.50 / 1.50
- **bifocal_tipico**: -2.00 / -1.00 / 2.50
- **bifocal_alto**: +4.00 / -2.00 / 3.50

### 3. Lógica de Elegibilidade (Replicação do clinicalEngine)

Para cada **cenário × SKU**, executar a cadeia de validação:

```text
1. Resolver limites técnicos do SKU:
   - Tentar: availability.sphere/cylinder/addition (V3.6.x)
   - Se vazio: specs.sphere_min/cyl_min/add_min (legacy)
   - Se ainda vazio: REJEITAR com "no_technical_data"

2. Validar esférico:
   - max(|rx_sphere_OD|, |rx_sphere_OE|) <= max(|limit_min|, |limit_max|)
   - Se falha: registrar "sphere_out_of_range"

3. Validar cilindro:
   - max(|rx_cylinder_OD|, |rx_cylinder_OE|) <= |limit_min|
   - Se falha: registrar "cylinder_out_of_range"

4. Validar preço:
   - price_sale_half_pair > 0 AND active AND NOT blocked
   - Se falha: registrar "no_active_price"

5. Validar adição (apenas se clinical_type != MONOFOCAL):
   - addition_min <= rx_addition <= addition_max
   - Se falha: registrar "addition_out_of_range"

6. Se todas as validações passam: registrar "eligible"
```

### 4. Motivos de Descarte (Funil)

O relatório quantifica:
- `no_technical_data`: SKU sem availability nem specs preenchidos
- `sphere_out_of_range`: esférico da prescrição excede a grade do SKU
- `cylinder_out_of_range`: cilindro da prescrição excede a grade do SKU
- `addition_out_of_range`: adição fora dos limites (aplicável apenas para PROG/OC/BIF)
- `no_active_price`: preço zero, bloqueado ou inativo
- `eligible`: SKU passou em todos os filtros

### 5. Estrutura de Resposta (Coverage Mode)

```json
{
  "mode": "coverage",
  "meta": {
    "total_skus": N,
    "total_families": N,
    "scenarios_tested": N,
    "generated_at": "ISO8601"
  },
  "by_clinical_type": {
    "PROGRESSIVA": {
      "scenarios": {
        "presbiopia_tipica": {
          "prescription": {
            "rightSphere": -2.00,
            "rightCylinder": -1.00,
            "rightAddition": 2.00,
            "leftSphere": -2.00,
            "leftCylinder": -1.00,
            "leftAddition": 2.00
          },
          "total_skus_evaluated": N,
          "eligible": N,
          "discard_funnel": {
            "no_technical_data": N,
            "sphere_out_of_range": N,
            "cylinder_out_of_range": N,
            "addition_out_of_range": N,
            "no_active_price": N
          },
          "eligible_families": ["ZEISS_Family_A", "HOYA_Family_B"],
          "pct_eligible": "XX.X%"
        }
      }
    }
  },
  "summary": {
    "worst_scenarios": [
      {
        "clinical_type": "MONOFOCAL",
        "scenario": "borda_maxima",
        "pct_eligible": "5.2%",
        "main_blocker": "cylinder_out_of_range"
      }
    ],
    "total_eligible_rate_by_type": {
      "MONOFOCAL": "XX.X%",
      "PROGRESSIVA": "XX.X%",
      "OCUPACIONAL": "XX.X%",
      "BIFOCAL": "XX.X%"
    }
  }
}
```

### 6. Implementação Técnica

#### 6.1 Refatoração da Edge Function
- **Arquivo**: `supabase/functions/catalog-audit/index.ts`
- **Mudanças**:
  1. Adicionar parâmetro `?mode=coverage` (default: `field-audit`)
  2. Implementar função `generateSyntheticScenarios(clinicalType)` retornando array de prescrições
  3. Implementar função `validateEligibility(price, scenario, clinicalType)` que retorna `{eligible, reason}`
  4. Iterar cenários × SKUs e acumular estatísticas por cenário
  5. Construir resposta final conforme estrutura acima

#### 6.2 Casos Especiais
- **MONOFOCAL**: Ignorar validação de adição (não requer)
- **Prescrições com zeros**: Tratar `rightSphere = 0, leftSphere = 0` como prescrição plana válida
- **Funil**: Um SKU pode ter **apenas um motivo de rejeição** (registrar o **primeiro** em ordem de validação)

#### 6.3 Sem Modificações em Arquivos Existentes
- ✅ Não altera `clinicalEngine.ts` (lógica copiada/replicada, não importada)
- ✅ Não altera `catalogIntegrityAnalyzer.ts`
- ✅ Não altera o behavior da função `catalog-audit` existente
- ✅ Apenas expande a edge function `catalog-audit` com novo mode

### 7. Fluxo de Execução

```
GET /catalog-field-audit
  ├─ ?mode=field-audit (default)
  │   └─ Retorna cobertura de campos técnicos (formato atual)
  │
  └─ ?mode=coverage&clinical_type=PROGRESSIVA (opcional filtro)
      ├─ Baixar catalog-default.json
      ├─ Resolver clinical_types das famílias
      ├─ Se clinical_type filtrado: usar apenas aquele
      ├─ Se não: iterar MONOFOCAL, PROGRESSIVA, OCUPACIONAL, BIFOCAL
      ├─ Para cada tipo:
      │   ├─ Gerar 3-6 cenários sintéticos
      │   ├─ Para cada cenário:
      │   │   ├─ Iterar todos os SKUs (prices)
      │   │   ├─ Validar elegibilidade
      │   │   └─ Acumular estatísticas e categorizar rejeições
      │   └─ Calcular percentual e listar famílias elegíveis
      ├─ Identificar piores cenários
      ├─ Calcular taxa total por tipo clínico
      └─ Retornar JSON estruturado
```

### 8. Impacto Zero em Produção
- Edge function isolada, sem estado persistido
- Sem alteração de dados do catálogo
- Parâmetro `mode` garante compatibilidade backwards
- Endpoint existente continua funcionando identicamente

### 9. Saída Esperada

Um diagnóstico quantitativo que responde:
- "Quantos SKUs seriam elegíveis para uma prescrição -5.00 / -1.50 (miopia moderada, monofocal)?"
- "Qual é o maior gargalo: falta de dados técnicos, incompatibilidade de esférico, ou cilindro?"
- "Qual tipo clínico tem melhor cobertura geral de elegibilidade?"

