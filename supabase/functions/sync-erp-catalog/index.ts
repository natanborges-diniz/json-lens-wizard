import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ErpRow {
  Codigo: string;
  DescricaoCadunif?: string;
  TipoLente?: string;
  ESFERICO_MIN?: number;
  ESFERICO_MAX?: number;
  CILINDRICO_MIN?: number;
  CILINDRICO_MAX?: number;
  ADICAO_MIN?: number;
  ADICAO_MAX?: number;
  DIAMETRO_MIN?: number;
  DIAMETRO_MAX?: number;
  Ativo?: boolean | number;
  Bloqueado?: boolean | number;
  PrecoVendaMeioPar?: number;
}

function toBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1' || val.toLowerCase() === 'sim';
  return false;
}

function hasRelevantData(row: ErpRow): boolean {
  return !!(
    row.TipoLente ||
    row.ESFERICO_MIN != null || row.ESFERICO_MAX != null ||
    row.CILINDRICO_MIN != null || row.CILINDRICO_MAX != null ||
    row.ADICAO_MIN != null || row.ADICAO_MAX != null ||
    row.DIAMETRO_MIN != null || row.DIAMETRO_MAX != null
  );
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supplier = url.searchParams.get('supplier')?.toUpperCase();
  const dryRun = url.searchParams.get('dry_run') !== 'false';
  const apply = url.searchParams.get('apply') === 'true';
  const createMissing = url.searchParams.get('create_missing') === 'true';

  if (!supplier) {
    return new Response(JSON.stringify({ error: 'Missing required param: supplier' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      status: 'sync-erp-catalog-ready',
      supplier,
      dry_run: dryRun,
      apply,
      create_missing: createMissing,
      ts: Date.now(),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Parse incoming ERP data (JSON array from client-side XLSX parsing)
    const body = await req.json();
    const erpRows: ErpRow[] = body.rows || body;

    if (!Array.isArray(erpRows) || erpRows.length === 0) {
      return new Response(JSON.stringify({ error: 'No rows provided. Send { rows: [...] }' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download current catalog from storage
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: catalogFile, error: downloadError } = await supabase.storage
      .from('catalogs')
      .download('catalog-default.json');

    if (downloadError || !catalogFile) {
      return new Response(JSON.stringify({ error: 'Failed to download catalog', details: downloadError?.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const catalog = JSON.parse(await catalogFile.text());
    const prices: any[] = catalog.prices || [];
    const families: any[] = catalog.families || [];
    const matchingEngine = catalog.family_matching_engine;

    // Build ERP code index from catalog
    const erpCodeIndex = new Map<string, number>();
    prices.forEach((p: any, idx: number) => {
      if (p.erp_code) {
        erpCodeIndex.set(String(p.erp_code), idx);
      }
    });

    // Process rows
    let rowsRead = 0;
    let rowsIgnored = 0;
    let matched = 0;
    let updated = 0;
    let created = 0;
    const notFoundInCatalog: string[] = [];
    const missingFamilyMapping: string[] = [];
    const supplierMismatchConflicts: any[] = [];
    const sampleUpdates: any[] = [];
    const sampleCreated: any[] = [];

    for (const row of erpRows) {
      rowsRead++;

      if (!row.Codigo) {
        rowsIgnored++;
        continue;
      }

      if (!hasRelevantData(row)) {
        rowsIgnored++;
        continue;
      }

      const erpCode = String(row.Codigo);
      const priceIdx = erpCodeIndex.get(erpCode);

      if (priceIdx != null) {
        // Found in catalog - update
        matched++;
        const price = prices[priceIdx];

        // Check supplier mismatch
        const familyId = price.family_id;
        const family = families.find((f: any) => f.id === familyId);
        if (family && family.supplier.toUpperCase() !== supplier) {
          supplierMismatchConflicts.push({
            erp_code: erpCode,
            catalog_supplier: family.supplier,
            requested_supplier: supplier,
          });
        }

        // Update availability
        const availability: any = {};
        if (row.ESFERICO_MIN != null || row.ESFERICO_MAX != null) {
          availability.sphere = {
            min: row.ESFERICO_MIN ?? price.availability?.sphere?.min,
            max: row.ESFERICO_MAX ?? price.availability?.sphere?.max,
          };
        }
        if (row.CILINDRICO_MIN != null || row.CILINDRICO_MAX != null) {
          availability.cylinder = {
            min: row.CILINDRICO_MIN ?? price.availability?.cylinder?.min,
            max: row.CILINDRICO_MAX ?? price.availability?.cylinder?.max,
          };
        }
        if (row.ADICAO_MIN != null || row.ADICAO_MAX != null) {
          availability.addition = {
            min: row.ADICAO_MIN ?? price.availability?.addition?.min,
            max: row.ADICAO_MAX ?? price.availability?.addition?.max,
          };
        }
        if (row.DIAMETRO_MIN != null || row.DIAMETRO_MAX != null) {
          availability.diameter_min = row.DIAMETRO_MIN ?? price.availability?.diameter_min;
          availability.diameter_max = row.DIAMETRO_MAX ?? price.availability?.diameter_max;
        }

        // Apply updates
        if (Object.keys(availability).length > 0) {
          price.availability = { ...price.availability, ...availability };
        }

        if (row.Ativo != null) price.active = toBool(row.Ativo);
        if (row.Bloqueado != null) price.blocked = toBool(row.Bloqueado);
        if (row.PrecoVendaMeioPar != null && row.PrecoVendaMeioPar > 0) {
          price.price_sale_half_pair = row.PrecoVendaMeioPar;
        }

        updated++;

        if (sampleUpdates.length < 5) {
          sampleUpdates.push({
            erp_code: erpCode,
            description: row.DescricaoCadunif || price.description,
            availability: price.availability,
            active: price.active,
            blocked: price.blocked,
            price: price.price_sale_half_pair,
          });
        }
      } else {
        // Not found in catalog
        if (createMissing && matchingEngine) {
          // Try to resolve family via matching engine
          const resolvedFamilyId = resolveFamily(row.DescricaoCadunif || '', matchingEngine, families, supplier);

          if (resolvedFamilyId) {
            const newPrice = {
              erp_code: erpCode,
              description: row.DescricaoCadunif || '',
              family_id: resolvedFamilyId,
              index: extractIndex(row.DescricaoCadunif || ''),
              active: row.Ativo != null ? toBool(row.Ativo) : true,
              blocked: row.Bloqueado != null ? toBool(row.Bloqueado) : false,
              price_sale_half_pair: row.PrecoVendaMeioPar || 0,
              availability: {
                sphere: { min: row.ESFERICO_MIN || 0, max: row.ESFERICO_MAX || 0 },
                cylinder: { min: row.CILINDRICO_MIN || 0, max: row.CILINDRICO_MAX || 0 },
                addition: { min: row.ADICAO_MIN || 0, max: row.ADICAO_MAX || 0 },
                diameter_min: row.DIAMETRO_MIN || 0,
                diameter_max: row.DIAMETRO_MAX || 0,
              },
            };

            prices.push(newPrice);
            created++;

            if (sampleCreated.length < 5) {
              sampleCreated.push(newPrice);
            }
          } else {
            missingFamilyMapping.push(erpCode + ' - ' + (row.DescricaoCadunif || ''));
            notFoundInCatalog.push(erpCode);
          }
        } else {
          notFoundInCatalog.push(erpCode);
        }
      }
    }

    // Save if not dry run and apply is true
    let applied = false;
    if (!dryRun && apply) {
      catalog.prices = prices;

      const catalogJson = JSON.stringify(catalog);
      const { error: uploadError } = await supabase.storage
        .from('catalogs')
        .upload('catalog-default.json', new Blob([catalogJson], { type: 'application/json' }), {
          upsert: true,
          cacheControl: '0',
        });

      if (uploadError) {
        return new Response(JSON.stringify({ error: 'Failed to upload catalog', details: uploadError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create version record
      const activeFamilies = families.filter((f: any) => f.active).length;
      const activePrices = prices.filter((p: any) => p.active && !p.blocked).length;

      await supabase.from('catalog_versions').insert({
        version_number: `erp-sync-${new Date().toISOString().split('T')[0]}`,
        schema_version: catalog.schema_version || '1.2',
        import_mode: 'erp-sync',
        dataset_name: `ERP Sync - ${supplier}`,
        families_count: activeFamilies,
        prices_count: activePrices,
        changes_summary: {
          supplier,
          matched,
          updated,
          created,
          not_found: notFoundInCatalog.length,
        },
        notes: [`ERP sync for ${supplier}: ${updated} updated, ${created} created`],
      });

      applied = true;
    }

    const report = {
      mode: 'erp-sync',
      supplier,
      dry_run: dryRun,
      applied,
      rows_read: rowsRead,
      rows_ignored: rowsIgnored,
      matched,
      updated,
      created,
      not_found_in_catalog: notFoundInCatalog.length,
      not_found_codes: notFoundInCatalog.slice(0, 20),
      missing_family_mapping: missingFamilyMapping.slice(0, 20),
      supplier_mismatch_conflicts: supplierMismatchConflicts.slice(0, 10),
      sample_updates: sampleUpdates,
      sample_created: sampleCreated,
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('sync-erp-catalog error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Resolve family ID using matching engine rules
function resolveFamily(
  description: string,
  engine: any,
  families: any[],
  supplier: string
): string | null {
  if (!engine?.rules || !Array.isArray(engine.rules)) return null;

  const descLower = description.toLowerCase();

  for (const rule of engine.rules) {
    if (rule.supplier && rule.supplier.toUpperCase() !== supplier) continue;

    const patterns = rule.patterns || [];
    const allMatch = patterns.every((p: string) => descLower.includes(p.toLowerCase()));

    if (allMatch && rule.family_id) {
      // Verify family exists
      const family = families.find((f: any) => f.id === rule.family_id);
      if (family) return rule.family_id;
    }
  }

  return null;
}

// Extract refractive index from description
function extractIndex(description: string): string {
  const match = description.match(/1\.\d{2}/);
  return match ? match[0] : '1.50';
}
