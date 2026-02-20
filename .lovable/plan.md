
# Preview de Classificação Determinística das 50 Pendências ESSILOR

## Objetivo

Adicionar um componente de análise somente leitura dentro do `ErpImportTab.tsx` que classifica os 50 SKUs pendentes usando lógica determinística de tokens, sem nenhuma escrita no banco, e exporta um "ActionPlan JSON" estruturado para revisão humana.

---

## Ajustes do Usuário Aplicados

1. Labels trocadas: "IA" → "Análise determinística (tokens)"
2. `NOISE_TOKENS` e `ABBREVIATION_MAP` movidos para `supplier_profiles` como colunas `noise_tokens` (text[]) e `abbreviation_map` (jsonb), com override por fornecedor
3. Exportação gera "ActionPlan JSON" com estrutura `groups[{group_key, suggested_family_id, confidence, erp_codes[], patterns_suggested[]}]`
4. Componente lê `noise_tokens` e `abbreviation_map` do perfil do fornecedor no banco (não hardcoded)

---

## Análise dos 50 SKUs Reais (banco atual)

Com base nos dados reais da tabela `catalog_pending_skus`:

```
GRUPO 1 — LG LP DMAX (4 SKUs)
  Códigos: 0077256-0077259
  Descrições: "LG LP DMAX 1.50/1.59/1.60/1.67 FOTO CZ BLUE AR"
  Tokens removidos: FOTO, CZ, BLUE, AR
  Base: "LG LP DMAX"
  Índices: 1.50, 1.59, 1.60, 1.67
  blue_filter: true | photo: true
  family_id sugerido: null — "DMAX" sem regra no dict
  Confiança: none

GRUPO 2 — LG LP GEN (9 SKUs)
  Códigos: 0077260-0077268
  Descrições: "LG LP GEN 1.50/59/60/67/74 AR INC" e sem AR
  Tokens removidos: AR, INC
  Base: "LG LP GEN"
  blue_filter: false | photo: false
  family_id sugerido: null — "GEN" sem regra
  Confiança: none

GRUPO 3 — LG OC DIGITIME NEAR/MID (4 SKUs)
  Códigos: 0077274-0077277
  Descrições: "LG OC DIGITIME NEAR/MID BLUE UV TRIO 1.50/1.59"
  Tokens removidos: BLUE, UV, TRIO
  Base: "LG OC DIGITIME NEAR" / "LG OC DIGITIME MID"
  blue_filter: true | photo: false
  family_id sugerido: null — "DIGITIME" sem regra
  Confiança: none

GRUPO 4 — LG PR VARILUX LIBE 3.0 BLUE (1 SKU)
  Código: 0077278
  Tokens removidos: BLUE, INC
  Base após abreviação: "LG PR VARILUX LIBERTY 3.0"
  blue_filter: true
  family_id sugerido: essilor-varilux-liberty (via LIBE→liberty + match dict)
  Confiança: medium

GRUPO 5 — LG PR VARILUX PHY EXTE TRACK BLUE (5 SKUs)
  Códigos: 0077299-0077303
  Tokens removidos: BLUE, EASY, OPTIFOG, PREV, ROCK, SAPPHIRE
  Base após abreviação: "LG PR VARILUX PHYSIO EXTENSEE TRACK"
  blue_filter: true
  family_id sugerido: essilor-varilux-x-track (via "track")
  Confiança: medium

GRUPO 6 — LG PR VARILUX PHY EXTENSEE BLUE (5 SKUs)
  Códigos: 0077304-0077308
  Base após abreviação: "LG PR VARILUX PHYSIO EXTENSEE"
  blue_filter: true
  family_id sugerido: essilor-varilux-physio (via PHY→physio)
  Confiança: medium

GRUPO 7 — LG PR VARILUX XR TRACK CVP TRANS EXT (5+ SKUs)
  Códigos: 0077279-0077283
  Tokens removidos: CVP, CZ, TRANS, EXT, EASY, OPTIFOG, PREVENCIA, ROCK, SAPPHIRE
  Base após abreviação: "LG PR VARILUX XR TRACK"
  blue_filter: false (não tem BLUE)
  family_id sugerido: essilor-varilux-xr-series ou essilor-varilux-x-track
  Confiança: medium (ambiguidade entre xr e x-track)
```

---

## Parte 1 — Migração de Banco

Adicionar duas colunas à tabela `supplier_profiles`:

| Coluna | Tipo | Default |
|--------|------|---------|
| `noise_tokens` | text[] | `'{BLUE,UV,CZ,CVP,AR,INC,CLE,FOTO,TRIO,EASY,ROCK,SAPPHIRE,OPTIFOG,PREV,TRANS,EXT,EAYS}'` |
| `abbreviation_map` | jsonb | `'{"LIBE":"liberty","PHY":"physio","EXTE":"extensee","DMAX":"dmax","GEN":"gen","OC":"ocupacional"}'` |

O seed será aplicado para ESSILOR com os defaults acima. Outros fornecedores herdam os defaults e poderão ter overrides individuais depois.

Nenhuma nova tabela. Nenhuma RLS nova (herda as políticas existentes de `supplier_profiles`).

---

## Parte 2 — Componente `PendingClassificationPreview`

### Onde aparece

Dentro do `ErpImportTab.tsx`, na seção "Pendências do Banco" (`PendingSkusSection`), atrás de um botão:

```
[ Analisar Pendências (Determinístico) ]
```

Ao clicar, o componente:
1. Carrega `catalog_pending_skus` (status=pending, supplier=selecionado)
2. Carrega `supplier_profiles` para o fornecedor (pega `noise_tokens`, `abbreviation_map`, `family_dictionary`)
3. Executa `classifyPendingSkus()` localmente — sem edge function
4. Renderiza a tabela agrupada

### Lógica pura `classifyPendingSkus()`

```
Para cada SKU:
1. Extrair índice via regex \b1\.\d{2}\b
2. Detectar blue_filter = tokens originais contêm "BLUE"
3. Detectar photo = tokens originais contêm "FOTO" ou estão em keywords_photo do perfil
4. Remover noise_tokens do perfil da descrição
5. Substituir abreviações usando abbreviation_map do perfil
6. String base resultante usada para matching contra family_dictionary

Matching em dois níveis:
  - Nível 1 (high): contém palavra-chave do dict diretamente na base limpa
  - Nível 2 (medium): contém palavra-chave após expansão de abreviação
  - Nível 3 (none): sem match

Agrupamento: por base_description normalizada (trim + lowercase)
```

### Interface do Componente

Tabela com as colunas:

| Grupo Base | family_id Sugerido | Qtd | Índices | Blue | Foto | Confiança | Motivo do Match |
|---|---|---|---|---|---|---|---|

- Badge de confiança: verde (high), amarelo (medium), cinza (none)
- Expandir linha para ver ERPs individuais do grupo
- Rodapé: "Análise determinística (tokens) — somente leitura, nenhuma alteração foi aplicada"
- Botão "Exportar ActionPlan JSON"

### Estrutura do ActionPlan JSON exportado

```json
{
  "generated_at": "2026-02-20T...",
  "supplier": "ESSILOR",
  "total_pending": 50,
  "groups": [
    {
      "group_key": "LG LP DMAX",
      "suggested_family_id": null,
      "confidence": "none",
      "erp_codes": ["0077256", "0077257", "0077258", "0077259"],
      "blue_filter": true,
      "photo": true,
      "detected_indexes": ["1.50", "1.59", "1.60", "1.67"],
      "patterns_suggested": []
    },
    {
      "group_key": "LG PR VARILUX LIBERTY 3.0",
      "suggested_family_id": "essilor-varilux-liberty",
      "confidence": "medium",
      "erp_codes": ["0077278"],
      "blue_filter": true,
      "photo": false,
      "detected_indexes": ["1.50"],
      "patterns_suggested": ["varilux liberty"]
    }
  ]
}
```

O JSON é gerado via `JSON.stringify` no browser e disparado como download.

---

## Arquivos Modificados

### 1. Migração de banco (nova)
- Adiciona colunas `noise_tokens` e `abbreviation_map` à `supplier_profiles`
- Seed para ESSILOR com os defaults mapeados acima

### 2. `src/components/audit/ErpImportTab.tsx`
- Adiciona interface `ClassificationGroup`
- Adiciona função pura `classifyPendingSkus(skus, profile)` com as lógicas de token/abreviação/agrupamento
- Adiciona componente `PendingClassificationPreview` que carrega o perfil do banco e executa a análise
- Adiciona botão "Analisar Pendências (Determinístico)" dentro de `PendingSkusSection`
- Lógica de exportação do ActionPlan JSON

---

## O Que NÃO Será Feito

- Nenhuma escrita em `catalog_pending_skus`
- Nenhuma modificação do `family_dictionary`
- Nenhum apply ou resolução automática
- Nenhuma nova edge function
- Nenhuma modificação em outros componentes

---

## Pré-visualização do Resultado Esperado

Ao clicar em "Analisar Pendências (Determinístico)" para ESSILOR, o usuário verá:

```
Análise Determinística (tokens) — ESSILOR — 50 pendências — 7 grupos

Grupo Base                          Family Sugerida              Qtd  Blue  Foto  Confiança
─────────────────────────────────────────────────────────────────────────────────────────────
LG LP DMAX                          —                             4    ✓     ✓     [none]
LG LP GEN                           —                             9    ✗     ✗     [none]
LG OC DIGITIME NEAR                 —                             2    ✓     ✗     [none]
LG OC DIGITIME MID                  —                             2    ✓     ✗     [none]
LG PR VARILUX LIBERTY 3.0           essilor-varilux-liberty       1    ✓     ✗     [medium]
LG PR VARILUX PHYSIO EXTE TRACK     essilor-varilux-x-track       5    ✓     ✗     [medium]
LG PR VARILUX PHYSIO EXTENSEE       essilor-varilux-physio        5    ✓     ✗     [medium]
LG PR VARILUX XR TRACK              essilor-varilux-xr-series    20+  ✗     ✗     [medium]

[ Exportar ActionPlan JSON ]
────────────────────────────────────────────────────────────────────────
Análise determinística (tokens) — somente leitura, nenhuma alteração foi aplicada
```
