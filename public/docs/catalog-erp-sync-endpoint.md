# Catalog ERP Sync Edge Function

## Endpoint

```
GET  /functions/v1/catalog-erp-sync?supplier={SUPPLIER}
POST /functions/v1/catalog-erp-sync?supplier={SUPPLIER}
```

**Base URL**: `https://ovufvwgqzmnbfrtwijfu.supabase.co`

## Description

Syncs ERP data (XLSX file) into the lens catalog, updating availability fields (sphere, cylinder, addition, diameter), active/blocked status, and optionally prices. Operates in **Mode A** (full supplier replacement).

## Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `supplier` | string | *required* | Supplier name (e.g. `ESSILOR`, `ZEISS`, `HOYA`) |
| `dry_run` | boolean | `true` | When true, returns report without saving changes |
| `apply` | boolean | `false` | When true, saves updated catalog to cloud and creates version record |
| `create_missing` | boolean | `false` | When true, creates new SKU entries for ERP codes not found in catalog |

## XLSX Format

Expected columns (case-insensitive):

| Column | Type | Required | Description |
|--------|------|----------|-------------|
| `Codigo` | string | ✅ | ERP code (preserved as-is, including leading zeros) |
| `DescricaoCadunif` | string | ✅ | Product description |
| `TipoLente` | string | - | Lens type identifier |
| `ESFERICO_MIN` | number | - | Minimum sphere |
| `ESFERICO_MAX` | number | - | Maximum sphere |
| `CILINDRICO_MIN` | number | - | Minimum cylinder |
| `CILINDRICO_MAX` | number | - | Maximum cylinder |
| `ADICAO_MIN` | number | - | Minimum addition |
| `ADICAO_MAX` | number | - | Maximum addition |
| `DIAMETRO_MIN` | number | - | Minimum diameter (mm) |
| `DIAMETRO_MAX` | number | - | Maximum diameter (mm) |
| `Ativo` | boolean/number | - | Active status |
| `Bloqueado` | boolean/number | - | Blocked status |
| `PrecoVendaMeioPar` | number | - | Sale price per half pair (optional) |

**Row filtering**: Rows without `TipoLente` AND without any technical data are ignored.

## Matching Logic

1. ERP `Codigo` is matched against `prices[].erp_code` in the catalog
2. If found: availability fields are overwritten, status is updated
3. If not found and `create_missing=true`:
   - Family is resolved via the catalog's `family_matching_engine` rules
   - If no family match: SKU is NOT created (reported in `missing_family_mapping`)
   - If family matched: new SKU is created with full availability data

## Response

```json
{
  "mode": "erp-sync",
  "supplier": "ESSILOR",
  "dry_run": true,
  "applied": false,
  "rows_read": 1500,
  "rows_ignored": 23,
  "matched": 1200,
  "updated": 1200,
  "created": 0,
  "not_found_in_catalog": 277,
  "missing_family_mapping": [],
  "supplier_mismatch_conflicts": [],
  "sample_updates": [
    {
      "erp_code": "001234",
      "description": "VARILUX COMFORT MAX 1.67",
      "availability": {
        "sphere": { "min": -12, "max": 8 },
        "cylinder": { "min": -4, "max": 0 },
        "addition": { "min": 0.75, "max": 3.5 },
        "diameter_min": 60,
        "diameter_max": 75,
        "index": "1.67"
      },
      "active": true,
      "blocked": false
    }
  ],
  "sample_created": []
}
```

## Examples

### GET (Info)

```bash
curl -X GET \
  "https://ovufvwgqzmnbfrtwijfu.supabase.co/functions/v1/catalog-erp-sync?supplier=ESSILOR" \
  -H "apikey: <ANON_KEY>"
```

### POST Dry-Run

```bash
curl -X POST \
  "https://ovufvwgqzmnbfrtwijfu.supabase.co/functions/v1/catalog-erp-sync?supplier=ESSILOR&dry_run=true" \
  -H "apikey: <ANON_KEY>" \
  -F "file=@TabelaEssilorNovo_10dez2025.xlsx"
```

### POST Apply

```bash
curl -X POST \
  "https://ovufvwgqzmnbfrtwijfu.supabase.co/functions/v1/catalog-erp-sync?supplier=ESSILOR&dry_run=false&apply=true" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -F "file=@TabelaEssilorNovo_10dez2025.xlsx"
```

### POST Apply with Create Missing

```bash
curl -X POST \
  "https://ovufvwgqzmnbfrtwijfu.supabase.co/functions/v1/catalog-erp-sync?supplier=ESSILOR&dry_run=false&apply=true&create_missing=true" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -F "file=@TabelaEssilorNovo_10dez2025.xlsx"
```

### Using TypeScript

```typescript
const formData = new FormData();
formData.append('file', xlsxFile);

const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/catalog-erp-sync?supplier=ESSILOR&dry_run=true`,
  {
    method: 'POST',
    headers: {
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: formData,
  }
);

const report = await response.json();
console.log(report);
```

## Error Handling

| Status | Description |
|--------|-------------|
| 200 | Success (dry-run or apply) |
| 400 | Missing supplier or file |
| 405 | Method not allowed |
| 500 | Server error (catalog download/upload failure) |

## CORS

All endpoints support CORS with standard Supabase headers.

---

**Last Updated**: 2026-02-18
**Function Status**: Deployed
