import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toBool(val: unknown, defaultVal = false): boolean {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const l = val.toLowerCase().trim();
    return l === 'true' || l === 'sim' || l === 's' || l === '1';
  }
  return defaultVal;
}

function normalizeErpCode(val: unknown): string {
  return String(val ?? '').trim();
}

interface ErpRow {
  Codigo: string;
  DescricaoCadunif: string;
  TipoLente?: string;
  ESFERICO_MIN?: number | null;
  ESFERICO_MAX?: number | null;
  CILINDRICO_MIN?: number | null;
  CILINDRICO_MAX?: number | null;
  ADICAO_MIN?: number | null;
  ADICAO_MAX?: number | null;
  DIAMETRO_MIN?: number | null;
  DIAMETRO_MAX?: number | null;
  Ativo?: number | boolean;
  Bloqueado?: number | boolean;
  PrecoVendaMeioPar?: number | null;
}

function hasAnyTechnicalData(row: ErpRow): boolean {
  return [
    row.ESFERICO_MIN, row.ESFERICO_MAX, row.CILINDRICO_MIN, row.CILINDRICO_MAX,
    row.ADICAO_MIN, row.ADICAO_MAX, row.DIAMETRO_MIN, row.DIAMETRO_MAX
  ].some(v => toNumber(v) !== null);
}

function tryMatchFamily(desc: string, families: any[], engine: any): string | null {
  if (!desc || !families?.length) return null;
  const up = desc.toUpperCase();

  if (engine?.matching_rules) {
    const rules = [...engine.matching_rules].filter((r: any) => r.enabled).sort((a: any, b: any) => a.priority - b.priority);
    for (const rule of rules) {
      const ok = (rule.conditions || []).map((c: any) => {
        const v = (c.value || '').toUpperCase();
        const f = c.field === 'description' ? up : '';
        switch (c.operator) {
          case 'contains': return f.includes(v);
          case 'not_contains': return !f.includes(v);
          case 'equals': return f === v;
          case 'starts_with': return f.startsWith(v);
          case 'ends_with': return f.endsWith(v);
          case 'regex': try { return new RegExp(c.value, 'i').test(desc); } catch { return false; }
          default: return false;
        }
      });
      const match = rule.match_type === 'all' ? ok.every(Boolean) : ok.some(Boolean);
      if (match && families.some((f: any) => f.id === rule.target_family_id)) return rule.target_family_id;
    }
  }

  for (const fam of families) {
    const n = (fam.name_original || '').toUpperCase();
    if (n.length >= 4 && up.includes(n)) return fam.id;
  }
  return null;
}

function buildAvailability(row: ErpRow) {
  const a: any = {};
  const sMin = toNumber(row.ESFERICO_MIN), sMax = toNumber(row.ESFERICO_MAX);
  if (sMin !== null || sMax !== null) a.sphere = { min: sMin ?? -20, max: sMax ?? 20 };
  const cMin = toNumber(row.CILINDRICO_MIN), cMax = toNumber(row.CILINDRICO_MAX);
  if (cMin !== null || cMax !== null) a.cylinder = { min: cMin ?? -6, max: cMax ?? 0 };
  const aMin = toNumber(row.ADICAO_MIN), aMax = toNumber(row.ADICAO_MAX);
  if (aMin !== null || aMax !== null) a.addition = { min: aMin ?? 0.75, max: aMax ?? 3.50 };
  const dMin = toNumber(row.DIAMETRO_MIN), dMax = toNumber(row.DIAMETRO_MAX);
  if (dMin !== null || dMax !== null) { a.diameter_min = dMin ?? 50; a.diameter_max = dMax ?? 80; }
  const idxM = (row.DescricaoCadunif || '').match(/\b1\.\d{2}\b/);
  if (idxM) a.index = idxM[0];
  return a;
}

function parseRow(raw: any): ErpRow {
  return {
    Codigo: raw.Codigo ?? raw.codigo ?? raw.CODIGO ?? '',
    DescricaoCadunif: raw.DescricaoCadunif ?? raw.descricaocadunif ?? raw.DESCRICAOCADUNIF ?? '',
    TipoLente: raw.TipoLente ?? raw.tipolente ?? raw.TIPOLENTE ?? null,
    ESFERICO_MIN: raw.ESFERICO_MIN ?? raw.esferico_min ?? null,
    ESFERICO_MAX: raw.ESFERICO_MAX ?? raw.esferico_max ?? null,
    CILINDRICO_MIN: raw.CILINDRICO_MIN ?? raw.cilindrico_min ?? null,
    CILINDRICO_MAX: raw.CILINDRICO_MAX ?? raw.cilindrico_max ?? null,
    ADICAO_MIN: raw.ADICAO_MIN ?? raw.adicao_min ?? null,
    ADICAO_MAX: raw.ADICAO_MAX ?? raw.adicao_max ?? null,
    DIAMETRO_MIN: raw.DIAMETRO_MIN ?? raw.diametro_min ?? null,
    DIAMETRO_MAX: raw.DIAMETRO_MAX ?? raw.diametro_max ?? null,
    Ativo: raw.Ativo ?? raw.ativo ?? raw.ATIVO ?? null,
    Bloqueado: raw.Bloqueado ?? raw.bloqueado ?? raw.BLOQUEADO ?? null,
    PrecoVendaMeioPar: raw.PrecoVendaMeioPar ?? raw.precovendameiopar ?? null,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const supplier = url.searchParams.get('supplier');
    const dryRun = url.searchParams.get('dry_run') !== 'false';
    const apply = url.searchParams.get('apply') === 'true';
    const createMissing = url.searchParams.get('create_missing') === 'true';

    if (!supplier) return jsonResponse({ error: 'Missing required query param: supplier' }, 400);
    const supplierUpper = supplier.toUpperCase();

    if (req.method === 'GET') {
      return jsonResponse({
        endpoint: 'catalog-erp-sync',
        description: 'Syncs ERP data into catalog availability fields (Mode A)',
        params: { supplier: 'Required', dry_run: 'Default true', apply: 'Default false', create_missing: 'Default false' },
        usage: 'POST JSON: { "rows": [...] } — parse XLSX client-side, send rows as JSON.',
      });
    }

    if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

    const body = await req.json();
    const rawRows: any[] = body.rows;
    if (!rawRows || !Array.isArray(rawRows) || !rawRows.length) {
      return jsonResponse({ error: 'Body must contain "rows" array' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: catFile, error: dlErr } = await supabase.storage.from('catalogs').download('catalog-default.json');
    if (dlErr || !catFile) return jsonResponse({ error: 'Failed to download catalog', details: dlErr?.message }, 500);

    const catalog = JSON.parse(await catFile.text());
    const prices: any[] = catalog.prices || [];
    const families: any[] = catalog.families || [];
    const engine = catalog.family_matching_engine || null;

    const erpIdx = new Map<string, number>();
    prices.forEach((p: any, i: number) => { const c = normalizeErpCode(p.erp_code); if (c) erpIdx.set(c, i); });

    const report: any = {
      supplier: supplierUpper, dry_run: dryRun && !apply, applied: false,
      rows_read: rawRows.length, rows_ignored: 0, matched: 0, updated: 0, created: 0,
      not_found_in_catalog: 0, missing_family_mapping: [], supplier_mismatch_conflicts: [],
      sample_updates: [], sample_created: [],
    };

    const newPrices: any[] = [];

    for (const raw of rawRows) {
      const row = parseRow(raw);
      const erpCode = normalizeErpCode(row.Codigo);
      if (!erpCode) { report.rows_ignored++; continue; }
      if (!row.TipoLente && !hasAnyTechnicalData(row)) { report.rows_ignored++; continue; }

      const pi = erpIdx.get(erpCode);
      if (pi !== undefined) {
        const ep = prices[pi];
        if (ep.supplier && ep.supplier.toUpperCase() !== supplierUpper) {
          report.supplier_mismatch_conflicts.push({ erp_code: erpCode, catalog_supplier: ep.supplier, erp_supplier: supplierUpper });
          continue;
        }
        report.matched++;
        const avail = buildAvailability(row);
        prices[pi] = {
          ...ep,
          availability: { ...(ep.availability || {}), ...avail },
          active: toBool(row.Ativo, ep.active),
          blocked: toBool(row.Bloqueado, ep.blocked),
          ...(toNumber(row.PrecoVendaMeioPar) !== null ? { price_sale_half_pair: toNumber(row.PrecoVendaMeioPar) } : {}),
        };
        report.updated++;
        if (report.sample_updates.length < 5) report.sample_updates.push({ erp_code: erpCode, description: row.DescricaoCadunif, availability: avail });
      } else {
        report.not_found_in_catalog++;
        if (createMissing) {
          const fid = tryMatchFamily(row.DescricaoCadunif, families, engine);
          if (!fid) { report.missing_family_mapping.push({ erp_code: erpCode, description: row.DescricaoCadunif }); continue; }
          const avail = buildAvailability(row);
          newPrices.push({
            family_id: fid, erp_code: erpCode, description: row.DescricaoCadunif, supplier: supplierUpper,
            lens_category_raw: row.TipoLente || '', manufacturing_type: '', index: avail.index || '',
            price_purchase_half_pair: 0, price_sale_half_pair: toNumber(row.PrecoVendaMeioPar) ?? 0,
            active: toBool(row.Ativo, true), blocked: toBool(row.Bloqueado, false),
            specs: { sphere_min: avail.sphere?.min ?? -20, sphere_max: avail.sphere?.max ?? 20, cylinder_min: avail.cylinder?.min ?? -6, cylinder_max: avail.cylinder?.max ?? 0, diameter_min_mm: avail.diameter_min ?? 50, diameter_max_mm: avail.diameter_max ?? 80, altura_min_mm: 0, altura_max_mm: 0, ...(avail.addition ? { add_min: avail.addition.min, add_max: avail.addition.max } : {}) },
            availability: avail,
          });
          report.created++;
          if (report.sample_created.length < 5) report.sample_created.push({ erp_code: erpCode, description: row.DescricaoCadunif, family_id: fid });
        }
      }
    }

    if (apply) {
      const finalPrices = [...prices, ...newPrices];
      catalog.prices = finalPrices;
      catalog.meta = { ...catalog.meta, counts: { ...catalog.meta?.counts, skus_prices: finalPrices.length }, generated_at: new Date().toISOString(), notes: [...(catalog.meta?.notes || []), `ERP sync (${supplierUpper}): ${report.updated} upd, ${report.created} new @ ${new Date().toISOString()}`] };

      const json = JSON.stringify(catalog, null, 2);
      const { error: upErr } = await supabase.storage.from('catalogs').upload('catalog-default.json', new Blob([json], { type: 'application/json' }), { upsert: true, contentType: 'application/json' });
      if (upErr) return jsonResponse({ error: 'Upload failed', details: upErr.message }, 500);

      await supabase.from('catalog_versions').insert({
        version_number: `erp-sync-${supplierUpper}-${Date.now()}`,
        schema_version: catalog.meta?.schema_version || '1.0',
        import_mode: 'erp-sync',
        dataset_name: `ERP Sync ${supplierUpper}`,
        families_count: catalog.families?.length || 0,
        prices_count: finalPrices.length,
        file_size_bytes: new TextEncoder().encode(json).length,
        notes: [`ERP sync: ${report.updated} updated, ${report.created} created`],
        changes_summary: { supplier: supplierUpper, updated: report.updated, created: report.created, not_found: report.not_found_in_catalog, missing_family: report.missing_family_mapping.length },
      });
      report.applied = true;
      report.dry_run = false;
    }

    return jsonResponse({ mode: 'erp-sync', ...report });
  } catch (error) {
    console.error('catalog-erp-sync error:', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
