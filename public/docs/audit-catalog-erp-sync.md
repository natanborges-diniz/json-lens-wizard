# Catalog Audit — ERP Sync Mode

## Endpoint

```
GET  /functions/v1/audit-catalog?mode=erp-sync&supplier={SUPPLIER}
POST /functions/v1/audit-catalog?mode=erp-sync&supplier={SUPPLIER}
```

**Base URL**: `https://ovufvwgqzmnbfrtwijfu.supabase.co`

## Description

Syncs ERP data into the lens catalog via the existing `audit-catalog` function. The frontend parses the XLSX client-side and sends normalized JSON rows. Operates in **Mode A** (full supplier replacement for availability data).

## Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `mode` | string | *required* | Must be `erp-sync` |
| `supplier` | string | *required* | Supplier code (e.g. `ESSILOR`, `ZEISS`, `HOYA`) |
| `dry_run` | boolean | `true` | When `false` and `apply=true`, saves changes |
| `apply` | boolean | `false` | When `true` (and `dry_run=false`), persists to catalog |
| `create_missing` | boolean | `false` | When `true`, creates new SKU entries for unmatched ERP codes |

## GET — Supplier Info

Returns supplier profile summary, pending SKU count, and last sync run.

```bash
curl -X GET \
  "https://ovufvwgqzmnbfrtwijfu.supabase.co/functions/v1/audit-catalog?mode=erp-sync&supplier=ESSILOR" \
  -H "apikey: <ANON_KEY>"
```

**Response**:
```json
{
  "mode": "erp-sync",
  "method": "GET",
  "supplier": "ESSILOR",
  "profile_active": true,
  "column_mapping_fields": ["codigo", "descricao", "esferico_min", ...],
  "family_dictionary_rules": 20,
  "pending_skus": 0,
  "last_run": null
}
```

## POST — Dry-Run

Send JSON rows (parsed client-side from XLSX).

```bash
curl -X POST \
  "https://ovufvwgqzmnbfrtwijfu.supabase.co/functions/v1/audit-catalog?mode=erp-sync&supplier=ESSILOR&dry_run=true&create_missing=true" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"rows": [{"Codigo": "001234", "DescricaoCadunif": "VARILUX COMFORT MAX 1.67", "ESFERICO_MIN": -12, "ESFERICO_MAX": 8}]}'
```

## POST — Apply

```bash
curl -X POST \
  "https://ovufvwgqzmnbfrtwijfu.supabase.co/functions/v1/audit-catalog?mode=erp-sync&supplier=ESSILOR&dry_run=false&apply=true" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"rows": [...]}'
```

## Response (Dry-Run)

```json
{
  "mode": "erp-sync",
  "supplier": "ESSILOR",
  "dry_run": true,
  "applied": false,
  "rows_read": 1500,
  "rows_ignored": 23,
  "normalized": 1477,
  "matched": 1200,
  "updated": 1200,
  "created": 50,
  "pending_created": 12,
  "missing_family_mapping": 12,
  "missing_family_mapping_examples": [...],
  "supplier_mismatch_conflicts": 0,
  "active_skus_without_availability": 35,
  "sample_updates": [...],
  "sample_created": [...],
  "sync_run_id": "uuid"
}
```

## Gates (Apply Blocked — 409)

When `apply=true` and any gate fails, returns **HTTP 409**:

| Gate | Condition | Reason |
|------|-----------|--------|
| Pending SKUs | `catalog_pending_skus` with `status=pending` for supplier | Must resolve pending items first |
| Missing Availability | Active SKUs without sphere data | All active SKUs must have technical data |
| Supplier Mismatch | ERP code exists but belongs to different supplier | Data integrity conflict |

## Using TypeScript (Frontend)

```typescript
import { supabase } from '@/integrations/supabase/client';

// Parse XLSX client-side first, then:
const { data, error } = await supabase.functions.invoke('audit-catalog', {
  body: { rows: parsedXlsxRows },
  headers: { 'Content-Type': 'application/json' },
  // Query params via URL:
  // ?mode=erp-sync&supplier=ESSILOR&dry_run=true&create_missing=true
});
```

> **Note**: `supabase.functions.invoke` doesn't support query params natively. Construct the full URL:

```typescript
const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audit-catalog?mode=erp-sync&supplier=ESSILOR&dry_run=true&create_missing=true`;
const response = await fetch(url, {
  method: 'POST',
  headers: {
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ rows: parsedXlsxRows }),
});
```

---

**Last Updated**: 2026-02-19
**Function Status**: Deployed (inside `audit-catalog`)
