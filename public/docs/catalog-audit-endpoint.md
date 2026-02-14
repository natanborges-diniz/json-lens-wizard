# Catalog Audit Edge Function

## Endpoint

```
GET  /functions/v1/catalog-audit?mode={mode}
POST /functions/v1/catalog-audit?mode={mode}
```

**Base URL**: `https://ovufvwgqzmnbfrtwijfu.supabase.co`

## Modes

### 1. `field-audit` (default)
Checks presence of technical fields (sphere, cylinder, addition, diameter, index) in catalog structure.

**Parameters**:
- `mode=field-audit`
- `clinical_type` (optional): Filter by clinical type (MONOFOCAL, PROGRESSIVA, OCUPACIONAL, BIFOCAL)
- `family` (optional): Filter by family name/ID

**Example**:
```bash
curl -X GET \
  "https://ovufvwgqzmnbfrtwijfu.supabase.co/functions/v1/catalog-audit?mode=field-audit&clinical_type=PROGRESSIVA" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92dWZ2d2dxem1uYmZydHdpamZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0OTI0MzEsImV4cCI6MjA4NDA2ODQzMX0.hofc_jdppxNgtdKrMGogEVXkH5jQ4vSxy09CHTPqREA"
```

### 2. `coverage`
Simulates 18 synthetic prescription scenarios per clinical type to calculate theoretical eligibility. Returns a dropout funnel with reasons (no_technical_data, sphere_out_of_range, etc.) and aggregations:
- Top suppliers by missing technical data
- Top families by missing technical data (with field-level breakdown)
- Best/worst scenarios

**Parameters**:
- `mode=coverage`
- `clinical_type` (optional): Filter by clinical type (returns summary if not specified)

**Example**:
```bash
curl -X GET \
  "https://ovufvwgqzmnbfrtwijfu.supabase.co/functions/v1/catalog-audit?mode=coverage&clinical_type=PROGRESSIVA" \
  -H "apikey: <ANON_KEY>"
```

### 3. `variants`
Generates a technical variant matrix per family:
- Extracts refractive index (regex `\b1\.\d{2}\b`) from SKU descriptions
- Classifies lens state as `clear` or `photo` (keywords: transitions, photofusion, sensity, xtractive, fotossens, fotocrom)
- Identifies variants (index|state combinations) lacking technical data
- Aggregates by family and supplier

**Parameters**:
- `mode=variants`

**Example**:
```bash
curl -X GET \
  "https://ovufvwgqzmnbfrtwijfu.supabase.co/functions/v1/catalog-audit?mode=variants" \
  -H "apikey: <ANON_KEY>"
```

**Response structure**:
```json
{
  "mode": "variants",
  "meta": {
    "total_skus": 1234,
    "total_families": 45,
    "generated_at": "2025-02-14T10:30:00Z"
  },
  "families": [
    {
      "family_id": "ZEISS_SMARTLIFE_SV",
      "family_name": "SmartLife SV",
      "supplier": "ZEISS",
      "clinical_type": "MONOFOCAL",
      "total_skus": 15,
      "indexes_found": ["1.50", "1.60", "1.67", "1.74"],
      "by_lens_state": {
        "clear": 10,
        "photo": 5
      },
      "variants": [
        {
          "index": "1.50",
          "state": "clear",
          "sku_count": 3,
          "has_technical_data": false
        }
      ],
      "variants_needing_grading": ["1.50|clear", "1.50|photo"]
    }
  ],
  "summary": {
    "total_variants": 156,
    "variants_with_data": 120,
    "variants_without_data": 36,
    "pct_with_data": "76.9%",
    "by_supplier": [
      {
        "supplier": "ZEISS",
        "total_variants": 45,
        "variants_needing_grading": 12,
        "pct_needing_grading": "26.7%"
      }
    ]
  }
}
```

## Authentication

The function requires authentication via one of:
- **API Key** (anon key): `Authorization: Bearer <ANON_KEY>` or `apikey: <ANON_KEY>`
- **Service Role**: For backend calls requiring elevated permissions

**Anon Key** (safe for client-side):
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92dWZ2d2dxem1uYmZydHdpamZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0OTI0MzEsImV4cCI6MjA4NDA2ODQzMX0.hofc_jdppxNgtdKrMGogEVXkH5jQ4vSxy09CHTPqREA
```

## CORS

All endpoints support CORS with the following headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version
```

## Error Handling

All errors return JSON with `error` field and appropriate HTTP status:

```json
{
  "error": "Failed to download catalog: Not found"
}
```

Common status codes:
- `200`: Success
- `405`: Method not allowed
- `500`: Server error (e.g., catalog download failure)
- `401`/`403`: Authentication error

## Testing

### Using cURL (GET)
```bash
curl -X GET \
  "https://ovufvwgqzmnbfrtwijfu.supabase.co/functions/v1/catalog-audit?mode=variants" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92dWZ2d2dxem1uYmZydHdpamZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0OTI0MzEsImV4cCI6MjA4NDA2ODQzMX0.hofc_jdppxNgtdKrMGogEVXkH5jQ4vSxy09CHTPqREA" \
  -v
```

### Using cURL (POST)
```bash
curl -X POST \
  "https://ovufvwgqzmnbfrtwijfu.supabase.co/functions/v1/catalog-audit?mode=variants" \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Using JavaScript/TypeScript
```typescript
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase.functions.invoke('catalog-audit', {
  body: {},
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
});

if (error) console.error(error);
else console.log(data);
```

---

**Last Updated**: 2025-02-14
**Function Status**: Deployed and operational
