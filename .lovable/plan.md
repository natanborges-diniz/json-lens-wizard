

# Plan 6 (Revisado): Importacao ERP Nativa (XLSX/JSON Patch) + Merge Granular de Prices por erp_code

## Resumo

Evoluir o sistema de importacao para suportar um novo modo "ERP Patch" que realiza merge granular de prices por chave `supplier:erp_code`, sem substituir o array inteiro. Adicionar upload de arquivo (.json/.xlsx) no AdminDashboard e criar parser XLSX generico.

---

## Ajustes Incorporados (vs. versao anterior)

### Ajuste 1: family_id condicional no patch
- SKU **novo** (key nao existe no catalogo): `family_id` obrigatorio -- sem ele, item rejeitado
- SKU **existente** (key ja existe): `family_id` opcional e **sempre ignorado** -- se vier no payload, registrado em `ignored_fields: ['family_id']` no relatorio, nunca aplicado

### Ajuste 2: description nunca sobrescrita por padrao
- Patch **nunca** sobrescreve `description` automaticamente
- Para permitir atualizacao de descricao, o payload deve incluir flag explicita:
```typescript
interface ErpPatchPayload {
  prices_patch: PricePatch[];
  supplier_family_map_patch?: SupplierFamilyMapEntry[];
  options?: {
    allow_description_update?: boolean; // default false
  };
}
```
- Sem a flag (ou `false`): campo `description` do patch e ignorado, logado em `ignored_fields`
- Com a flag `true`: `description` aplicada normalmente

### Ajuste 3: ordem estavel no rebuild de prices
- Prices existentes mantem sua posicao original no array
- Novos SKUs sao anexados ao final
- Nenhuma reordenacao automatica

---

## Tipos Novos (src/types/lens.ts)

```typescript
type ImportMode = 'increment' | 'replace' | 'erp_patch';

interface PricePatch {
  supplier: string;        // obrigatorio sempre
  erp_code: string;        // obrigatorio sempre
  family_id?: string;      // obrigatorio apenas para SKU novo
  price_sale_half_pair?: number;
  price_purchase_half_pair?: number;
  active?: boolean;
  blocked?: boolean;
  clinical_type?: ClinicalType;
  manufacturing_type?: string;
  process?: ProcessType;
  description?: string;    // aplicado somente se allow_description_update=true
  specs?: Partial<PriceSpec>;
}

interface ErpPatchPayload {
  prices_patch: PricePatch[];
  supplier_family_map_patch?: SupplierFamilyMapEntry[];
  options?: {
    allow_description_update?: boolean;
  };
}

interface PatchReport {
  added: number;
  updated: number;
  unchanged: number;
  ignored: number;
  ignored_fields_log: Array<{ erp_code: string; fields: string[] }>;
  errors: string[];
}
```

---

## Logica do mergeErpPatch (catalogImporter.ts)

```text
mergeErpPatch(currentData, patchPayload):
  1. Build Map<string, {price: Price, originalIndex: number}> do currentData.prices
     key = supplier:erp_code
  2. allowDescUpdate = patchPayload.options?.allow_description_update === true
  3. For each pricePatch in patchPayload.prices_patch:
     a. key = pricePatch.supplier + ":" + pricePatch.erp_code
     b. IF key exists in map (SKU existente):
        - ignoredFields = ['family_id'] se family_id presente no patch
        - se description presente E !allowDescUpdate: add 'description' a ignoredFields
        - Shallow merge: { ...existing, ...patchWithoutIgnored }
        - Se nenhum campo mudou: increment "unchanged"
        - Senao: increment "updated"
        - Log ignored_fields se nao vazio
     c. ELSE (SKU novo):
        - Validar family_id presente e existente em families[]
        - Se ausente: add to errors, increment "ignored", skip
        - Append ao final do array
        - Increment "added"
  4. Rebuild prices: existentes na ordem original + novos ao final
  5. Return merged LensData + PatchReport
```

### Campos protegidos (nunca sobrescritos em SKU existente)
- `family_id` -- sempre ignorado, logado
- `description` -- ignorado por padrao, so aplicado com `allow_description_update: true`
- `index`, `index_value` -- preservados

### Campos atualizaveis
- `price_sale_half_pair`, `price_purchase_half_pair`
- `active`, `blocked`
- `specs` (sphere/cyl/add/diameter/altura ranges)
- `clinical_type`, `manufacturing_type`, `process`

---

## Validacao de Patch (validateErpPatch)

```typescript
function validateErpPatch(
  patch: ErpPatchPayload,
  currentFamilies: FamilyExtended[],
  currentPrices: Price[]
): { valid: boolean; errors: string[]; warnings: string[] }
```

Regras:
- Cada item deve ter `supplier` e `erp_code` (bloqueante)
- SKU novo sem `family_id`: erro bloqueante para esse item (item ignorado, nao bloqueia todo o patch)
- SKU novo com `family_id` inexistente em families[]: erro bloqueante para esse item
- Patch vazio (0 items validos apos validacao): erro bloqueante global

---

## Parser XLSX (src/lib/erp/xlsxToPricesPatch.ts)

```typescript
interface XlsxPatchResult {
  prices_patch: PricePatch[];
  stats: { rows_read: number; rows_valid: number; rows_ignored: number; rows_error: number };
  errors: string[];
}

function xlsxToPricesPatch(
  workbook: XLSX.WorkBook,
  supplier: string,
  columnMapping: Record<string, string>,
  familyDictionary: any[],
  catalogFamilies: FamilyExtended[]
): XlsxPatchResult
```

Logica:
1. Ler primeira sheet do workbook
2. Mapear colunas via columnMapping (supplier_profiles)
3. Para cada row: extrair erp_code, ranges, precos, status; resolver family_id via familyDictionary
4. family_id nao resolvido: registrar em errors, nao incluir no patch
5. Normalizar numeros (string para number, virgula para ponto)

---

## UI no AdminDashboard

Adicionar na secao de importacao:
- **Seletor de tipo**: "Catalogo Completo (JSON)" | "Patch ERP (JSON)" | "Patch ERP (XLSX)"
- **Upload de arquivo**: `<input type="file" accept=".json,.xlsx">`
- **Checkbox**: "Permitir atualizacao de descricao" (mapeia para `allow_description_update`)
- **Preview**: Mostrar PatchReport (added/updated/unchanged/ignored) antes de confirmar
- **Confirmar**: Aplica patch, roda auditoria, salva na cloud

---

## Integracao Pos-Patch com Governanca

Apos aplicar patch:
1. Rodar `runConsistencyAudit()` do lensStore
2. Atualizar `catalogStatus` para `draft`
3. Registrar resultado em `catalog_validation_runs`
4. Banner no /audit reflete novos conflitos
5. Publicacao bloqueada se conflitos criticos existirem

---

## Sequencia de Implementacao

1. **Tipos**: Adicionar `erp_patch` ao ImportMode, criar PricePatch, ErpPatchPayload, PatchReport em types/lens.ts
2. **catalogImporter.ts**: Implementar `mergeErpPatch()` + `validateErpPatch()` com regras de family_id condicional, description protegida, e ordem estavel
3. **xlsxToPricesPatch.ts**: Parser XLSX usando column_mapping
4. **AdminDashboard.tsx**: Seletor de tipo, file upload, checkbox description, preview report
5. **lensStore.ts**: Suporte a erp_patch no importCatalog, auditoria pos-patch

---

## Arquivos Afetados

**Novos:**
- `src/lib/erp/xlsxToPricesPatch.ts`

**Modificados:**
- `src/types/lens.ts` (ImportMode + PricePatch + ErpPatchPayload + PatchReport)
- `src/lib/catalogImporter.ts` (mergeErpPatch, validateErpPatch, executeImport)
- `src/pages/AdminDashboard.tsx` (seletor, upload, preview, checkbox)
- `src/store/lensStore.ts` (importCatalog erp_patch, auditoria pos-patch)

---

## Garantias

| Garantia | Mecanismo |
|----------|-----------|
| Patch nao apaga prices existentes | Map por chave, preserva nao-mencionados |
| Idempotencia | Reimportar = mesmos updates, sem duplicatas |
| Multi-fornecedor seguro | Patch HOYA nao afeta ESSILOR |
| family_id protegido em existentes | Sempre ignorado, logado em ignored_fields |
| description protegida por padrao | So atualiza com allow_description_update=true |
| Ordem estavel | Existentes mantidos na posicao, novos ao final |
| Auditoria pos-patch | runConsistencyAudit() automatico |
| Publicacao bloqueada se conflitos | Gate existente no saveCatalogToCloud |

