

# Plano: Expandir Dicionario de Familias HOYA

## Problema

402 SKUs HOYA nao foram mapeados durante o sync ERP porque:
1. O dicionario de familias (`family_dictionary`) so tem 4 regras
2. Os `family_id` referenciados nao existem no catalogo JSON (`family_exists: false`)

Ou seja: mesmo que uma regra acerte o matching, o `family_id` destino nao existe no catalogo, entao o SKU vai para pendencias.

## Produtos Pendentes (18 linhas de produto)

```text
PRODUTO                QTD   TIPO ERP    CLINICAL_TYPE
────────────────────────────────────────────────────────
LIFESTYLE 4            77    LG PR       PROGRESSIVA
LIFESTYLE 4I           65    LG PR       PROGRESSIVA
DAYNAMIC               56    LG PR       PROGRESSIVA
SPORTIVE (VS)          42    LG VS       MONOFOCAL
SPORTIVE (PR)          36    LG PR       PROGRESSIVA
AMPLUS                 31    LG PR       PROGRESSIVA
BALANSIS               21    LG PR       PROGRESSIVA
NULUX (VS)             17    LG VS       MONOFOCAL
MYSELF                 12    LG PR       PROGRESSIVA
MYSTYLE V+             12    LG PR       PROGRESSIVA
IDENTITY V+            11    LG VS       MONOFOCAL
AMPLITUDE              6     LG PR       PROGRESSIVA
SYNC III (VS)          6     LG VS       MONOFOCAL
TRUEFORM               4     LG VS       MONOFOCAL
WORKSMART ROOM         3     LG OC       OCUPACIONAL
WORKSTYLE 3            1     LG OC       OCUPACIONAL
ARGOS FF               1     LG PR       PROGRESSIVA
HILUX (VS)             1     LG VS       MONOFOCAL
```

## O que precisa ser feito

Duas acoes obrigatorias (uma sem a outra nao funciona):

### Etapa 1 — Criar familias HOYA no catalogo JSON

As familias precisam existir no array `families` do catalogo (`catalog-default.json` no Storage). Cada familia precisa de:
- `id` (ex: `HOYA_LIFESTYLE_4`)
- `supplier`: `"HOYA"`
- `clinical_type`: `PROGRESSIVA`, `MONOFOCAL` ou `OCUPACIONAL`
- `macro`: vinculo ao macro correto (`PROG_CONFORTO`, `MONO_INTER`, etc.)
- `attributes_base`, `active: true`

Familias a criar (14 novas, as 4 existentes ja mapeadas no dict):

| family_id | Produto | clinical_type | macro sugerido |
|-----------|---------|---------------|----------------|
| HOYA_LIFESTYLE_4 | Lifestyle 4 | PROGRESSIVA | PROG_CONFORTO |
| HOYA_LIFESTYLE_4I | Lifestyle 4i | PROGRESSIVA | PROG_AVANCADO |
| HOYA_DAYNAMIC | Daynamic | PROGRESSIVA | PROG_AVANCADO |
| HOYA_SPORTIVE_PR | Sportive (prog) | PROGRESSIVA | PROG_CONFORTO |
| HOYA_SPORTIVE_VS | Sportive (mono) | MONOFOCAL | MONO_INTER |
| HOYA_AMPLUS | Amplus | PROGRESSIVA | PROG_CONFORTO |
| HOYA_BALANSIS | Balansis | PROGRESSIVA | PROG_AVANCADO |
| HOYA_NULUX | Nulux | MONOFOCAL | MONO_ENTRADA |
| HOYA_MYSELF | MySelf | PROGRESSIVA | PROG_TOP |
| HOYA_MYSTYLE_V | MyStyle V+ | PROGRESSIVA | PROG_TOP |
| HOYA_IDENTITY_V | iDentity V+ | MONOFOCAL | MONO_TOP |
| HOYA_AMPLITUDE | Amplitude | PROGRESSIVA | PROG_BASICO |
| HOYA_TRUEFORM | TrueForm | MONOFOCAL | MONO_BASICO |
| HOYA_WORKSMART | WorkSmart Room | OCUPACIONAL | OC_CONFORTO |
| HOYA_WORKSTYLE | WorkStyle 3 | OCUPACIONAL | OC_AVANCADO |
| HOYA_ARGOS | Argos FF | PROGRESSIVA | PROG_BASICO |
| HOYA_HILUX | Hilux | MONOFOCAL | MONO_BASICO |

### Etapa 2 — Expandir o `family_dictionary` no perfil HOYA

Atualizar `supplier_profiles.family_dictionary` para HOYA com 17 novas regras (total: ~21 regras). Regras especificas primeiro (alta prioridade), genericas depois.

```text
REGRA                          CONTAINS               FAMILY_ID           PRIORIDADE
───────────────────────────────────────────────────────────────────────────────────────
Lifestyle 4i (antes de 4)      ["lifestyle","4i"]      HOYA_LIFESTYLE_4I   10
Lifestyle 4                    ["lifestyle","4"]       HOYA_LIFESTYLE_4    5
MyStyle V+                     ["mystyle"]             HOYA_MYSTYLE_V      5
MySelf                         ["myself"]              HOYA_MYSELF         5
iDentity V+                    ["identity"]            HOYA_IDENTITY_V     5
Daynamic                       ["daynamic"]            HOYA_DAYNAMIC       5
Balansis                       ["balansis"]            HOYA_BALANSIS       5
Amplus                         ["amplus"]              HOYA_AMPLUS         5
Amplitude                      ["amplitude"]           HOYA_AMPLITUDE      5
Sportive + PR                  ["sportive","lg pr"]    HOYA_SPORTIVE_PR    8
Sportive + VS                  ["sportive","lg vs"]    HOYA_SPORTIVE_VS    8
WorkSmart Room                 ["worksmart"]           HOYA_WORKSMART      5
WorkStyle                      ["workstyle"]           HOYA_WORKSTYLE      5
Argos FF                       ["argos"]               HOYA_ARGOS          3
TrueForm                       ["trueform"]            HOYA_TRUEFORM       5
Nulux (generico, sem EP)       ["nulux"]               HOYA_NULUX          2
Hilux                          ["hilux"]               HOYA_HILUX          2
```

### Etapa 3 — Limpar pendencias e refazer sync

1. Marcar os 402 `catalog_pending_skus` com status `resolved` ou deleta-los
2. Refazer o sync ERP com `create_missing=true` — agora as familias existem e o dicionario cobre todos os 18 produtos

## Implementacao Tecnica

1. **Edge function `audit-catalog`**: Adicionar um novo modo `inject-families` que recebe um array de familias e as insere no catalogo JSON no Storage (ou fazer via script direto)
2. **Alternativa mais simples**: Criar um script que:
   - Baixa o catalogo do Storage
   - Adiciona as 17 familias ao array `families`
   - Faz upload do catalogo atualizado
   - Atualiza o `family_dictionary` no `supplier_profiles` via SQL
   - Limpa os pending SKUs
3. **Tudo executado via edge function existente ou nova**

## Arquivos Afetados

- `supabase/functions/audit-catalog/index.ts` — possivel novo modo `inject-families`
- `supplier_profiles` (tabela) — atualizar `family_dictionary` para HOYA
- `catalog_pending_skus` (tabela) — limpar pendencias HOYA
- Catalogo JSON no Storage (`catalog-default.json`) — adicionar familias

## Resultado

- 402 SKUs pendentes resolvidos
- Cobertura HOYA completa para sincronizacao ERP
- De 4 para ~21 regras de matching

