

# Block 1 Materialization: Nea MCP → Product Foundation

## What Already Exists

### In Nea MCP (source of truth)
| Data | Status |
|---|---|
| 13 families (Essilor, Hoya, Zeiss) with clinical/commercial categories | Available |
| 15+ materials with canonical mapping (1.50 to 1.74, poly, trivex) | Available |
| 14+ treatments with canonical types and supplier mapping | Available |
| Executive plan and 5-block backlog | Available |
| Comparison docs and visual requirements | Available |

### In the Database (already implemented)
| Table | Count | Notes |
|---|---|---|
| supplier_families | 79 (27E + 28H + 24Z) | 21 approved, 58 draft |
| supplier_materials | 39 (9E + 17H + 13Z) | Populated |
| supplier_treatments | 37 (13E + 14H + 10Z) | Populated |
| supplier_technologies | 33 | Populated |
| supplier_benefits | 21 | Populated |
| supplier_source_documents | **0** | EMPTY — no document provenance |
| canonical_families | **0** | EMPTY — no canonical layer |
| canonical_materials | **0** | EMPTY — no canonical layer |
| canonical_treatments | **0** | EMPTY — no canonical layer |
| family_equivalences | **0** | EMPTY — no cross-supplier links |
| material_equivalences | **0** | EMPTY |
| treatment_equivalences | **0** | EMPTY |

### In the UI (already implemented)
- `SupplierHub` — supplier overview, documents tab, families tab
- `ComparisonHub` — tabs for families, materials, treatments (reads from DB)
- Comparison components: `FamilyComparison`, `MaterialComparison`, `TreatmentComparison`

## Gap Analysis: What's Missing

The L2 layer (supplier entities) is populated. The gaps are:

1. **L1 — Source Documents**: `supplier_source_documents` is empty. No provenance trail.
2. **L3 — Canonical Layer**: All 3 canonical tables are empty. No cross-supplier normalization in DB.
3. **Equivalences**: No links between supplier entities and canonical entities.
4. **L4 — Price Pipeline Separation**: No dedicated price tables exist. Price is still in the legacy catalog JSON.

## Implementation Plan

### Step 1: Populate Source Documents (L1)
Insert document records for the 6 known source documents (Essilor Aug 2025, Hoya Apr 2025, Zeiss Apr 2025 — price tables and catalogs) using data from the `data/suppliers/` directory and nea-mcp context.

### Step 2: Populate Canonical Families (L3)
Using nea-mcp normalized data, insert canonical families for the main comparable categories:
- Progressive Premium (Varilux XR Pro ↔ iD MySelf ↔ SmartLife Individual 3)
- Progressive Mid (Varilux XR Track ↔ iD LifeStyle 4i ↔ Light 2)
- Single Vision Entry (Eyezen Start ↔ Hilux ↔ ClearView)
- Myopia Control (Stellest ↔ MiYOSMART ↔ MyoCare)
- Occupational (OfficeLens, etc.)

### Step 3: Populate Canonical Materials (L3)
Insert canonical materials from nea-mcp: organico 1.50, organico 1.53, policarbonato, alto indice 1.60, 1.67, 1.74, trivex.

### Step 4: Populate Canonical Treatments (L3)
Insert canonical treatments: AR standard, AR premium, blue filter, photochromic, polarized, UV filter, scratch resistant.

### Step 5: Create Equivalence Links
Link supplier families/materials/treatments to their canonical counterparts using the confidence levels from nea-mcp.

### Step 6: Create Price Pipeline Table (L4)
New migration to create `supplier_prices` table with strict separation:
- supplier_code, family_id, material_index, treatment_combo, price_value, currency, effective_date, source_document_id, confidence
- RLS: admin/manager manage, sellers view

### Step 7: Update ComparisonHub to Use Canonical Layer
Modify `ComparisonHub` to query canonical families with their equivalences, showing true cross-supplier comparison groups instead of just listing all supplier families side by side.

## Files Affected
- `supabase/migrations/` — new migration for `supplier_prices` table
- Data inserts via insert tool for all canonical + equivalence + source document data
- `src/pages/ComparisonHub.tsx` — query canonical families with equivalences
- `src/components/comparison/FamilyComparison.tsx` — render comparison groups from canonical layer

## Technical Notes
- All inserts use the insert tool, not migrations
- The `supplier_prices` table schema change requires a migration
- Equivalence confidence levels (low/medium/high) come directly from nea-mcp
- No existing data is deleted; canonical layer is additive

