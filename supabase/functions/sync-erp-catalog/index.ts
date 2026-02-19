import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function toBool(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') {
    const s = val.toLowerCase();
    return s === 'true' || s === '1' || s === 'sim';
  }
  return false;
}

function toNum(val: unknown): number | undefined {
  if (val == null || val === '') return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}

function normalizeRow(raw: Record<string, unknown>, cm: Record<string, string[]>) {
  const get = (field: string): unknown => {
    const aliases = cm[field] || [];
    for (const a of aliases) {
      if (raw[a] != null && raw[a] !== '') return raw[a];
    }
    return undefined;
  };
  const codigo = String(get('codigo') || '').trim();
  if (!codigo) return null;
  const ativoVal = get('ativo');
  const bloqVal = get('bloqueado');
  return {
    codigo,
    descricao: String(get('descricao') || '').trim(),
    tipo_lente: get('tipo_lente') as string | undefined,
    esferico_min: toNum(get('esferico_min')),
    esferico_max: toNum(get('esferico_max')),
    cilindrico_min: toNum(get('cilindrico_min')),
    cilindrico_max: toNum(get('cilindrico_max')),
    adicao_min: toNum(get('adicao_min')),
    adicao_max: toNum(get('adicao_max')),
    diametro_min: toNum(get('diametro_min')),
    diametro_max: toNum(get('diametro_max')),
    ativo: ativoVal != null ? toBool(ativoVal) : undefined,
    bloqueado: bloqVal != null ? toBool(bloqVal) : undefined,
    preco: toNum(get('preco')),
  };
}

function hasData(r: ReturnType<typeof normalizeRow>) {
  if (!r) return false;
  return !!(r.tipo_lente || r.esferico_min != null || r.esferico_max != null ||
    r.cilindrico_min != null || r.cilindrico_max != null ||
    r.adicao_min != null || r.adicao_max != null ||
    r.diametro_min != null || r.diametro_max != null);
}

function resolveFamily(
  desc: string,
  dict: Array<{ contains: string[]; family_id: string; priority: number }>,
  engine: { rules?: Array<{ supplier?: string; patterns?: string[]; family_id?: string }> } | undefined,
  familyIds: Set<string>,
  supplier: string,
): string | null {
  const dl = desc.toLowerCase();
  const sorted = [...dict].sort((a, b) => a.priority - b.priority);
  for (const r of sorted) {
    if (r.contains.every(k => dl.includes(k.toLowerCase())) && familyIds.has(r.family_id)) {
      return r.family_id;
    }
  }
  if (engine?.rules) {
    for (const r of engine.rules) {
      if (r.supplier && r.supplier.toUpperCase() !== supplier) continue;
      if ((r.patterns || []).every(p => dl.includes(p.toLowerCase())) && r.family_id && familyIds.has(r.family_id)) {
        return r.family_id;
      }
    }
  }
  return null;
}

function extractIdx(desc: string, regex?: string): string {
  const m = desc.match(new RegExp(regex || '1\\.\\d{2}'));
  return m ? m[0] : '1.50';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supplier = url.searchParams.get('supplier')?.toUpperCase();
  const dryRun = url.searchParams.get('dry_run') !== 'false';
  const applyFlag = url.searchParams.get('apply') === 'true';
  const createMissing = url.searchParams.get('create_missing') === 'true';

  if (!supplier) {
    return new Response(JSON.stringify({ error: 'Missing required param: supplier' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: profile, error: pErr } = await supabase
    .from('supplier_profiles').select('*')
    .eq('supplier_code', supplier).eq('is_active', true).single();

  if (pErr || !profile) {
    return new Response(JSON.stringify({ error: 'Supplier profile not found: ' + supplier }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // GET: return status info
  if (req.method === 'GET') {
    const { data: lastRun } = await supabase.from('catalog_sync_runs').select('*')
      .eq('supplier_code', supplier).order('created_at', { ascending: false }).limit(1).single();
    const { count: pc } = await supabase.from('catalog_pending_skus')
      .select('*', { count: 'exact', head: true }).eq('supplier_code', supplier).eq('status', 'pending');
    return new Response(JSON.stringify({
      status: 'ready', supplier,
      profile: { display_name: profile.display_name, dict_count: Array.isArray(profile.family_dictionary) ? profile.family_dictionary.length : 0 },
      last_sync: lastRun || null, pending_skus: pc || 0, ts: Date.now(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // POST: process sync
  try {
    const body = await req.json();
    const erpRows: Record<string, unknown>[] = body.rows || body;
    const fileName: string = body.file_name || 'unknown';
    if (!Array.isArray(erpRows) || erpRows.length === 0) {
      return new Response(JSON.stringify({ error: 'No rows provided' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download catalog
    const { data: catFile, error: dlErr } = await supabase.storage.from('catalogs').download('catalog-default.json');
    if (dlErr || !catFile) {
      return new Response(JSON.stringify({ error: 'Catalog download failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const catalog = JSON.parse(await catFile.text());
    const prices = catalog.prices || [];
    const families = catalog.families || [];
    const engine = catalog.family_matching_engine;
    const cm = profile.column_mapping as Record<string, string[]>;
    const dict = (profile.family_dictionary || []) as Array<{ contains: string[]; family_id: string; priority: number }>;
    const idxRegex = (profile.index_parsing as Record<string, string> | null)?.regex;
    const familyIdSet = new Set(families.map((f: Record<string, unknown>) => f.id as string));

    // Build erp_code index
    const codeIdx = new Map<string, number>();
    prices.forEach((p: Record<string, unknown>, i: number) => {
      if (p.erp_code) codeIdx.set(String(p.erp_code), i);
    });

    // Counters
    let rowsRead = 0, rowsIgnored = 0, matched = 0, updated = 0, created = 0;
    const notFound: string[] = [];
    const missingMap: Array<{ erp_code: string; description: string }> = [];
    const conflicts: Array<Record<string, string>> = [];
    const sampUpd: Array<Record<string, unknown>> = [];
    const sampCre: Array<Record<string, unknown>> = [];
    const pendingToCreate: Array<Record<string, unknown>> = [];

    // Process rows
    for (const raw of erpRows) {
      rowsRead++;
      const row = normalizeRow(raw, cm);
      if (!row || !hasData(row)) { rowsIgnored++; continue; }

      const ec = row.codigo;
      const pi = codeIdx.get(ec);

      if (pi != null) {
        // Existing SKU - update
        matched++;
        const price = prices[pi];
        const fam = families.find((f: Record<string, unknown>) => f.id === price.family_id);
        if (fam && (fam.supplier as string)?.toUpperCase() !== supplier) {
          conflicts.push({ erp_code: ec, catalog_supplier: fam.supplier as string, requested_supplier: supplier });
        }
        const av: Record<string, unknown> = {};
        if (row.esferico_min != null || row.esferico_max != null) {
          av.sphere = { min: row.esferico_min ?? price.availability?.sphere?.min, max: row.esferico_max ?? price.availability?.sphere?.max };
        }
        if (row.cilindrico_min != null || row.cilindrico_max != null) {
          av.cylinder = { min: row.cilindrico_min ?? price.availability?.cylinder?.min, max: row.cilindrico_max ?? price.availability?.cylinder?.max };
        }
        if (row.adicao_min != null || row.adicao_max != null) {
          av.addition = { min: row.adicao_min ?? price.availability?.addition?.min, max: row.adicao_max ?? price.availability?.addition?.max };
        }
        if (row.diametro_min != null || row.diametro_max != null) {
          av.diameter_min = row.diametro_min ?? price.availability?.diameter_min;
          av.diameter_max = row.diametro_max ?? price.availability?.diameter_max;
        }
        if (Object.keys(av).length > 0) price.availability = { ...(price.availability || {}), ...av };
        if (row.ativo != null) price.active = row.ativo;
        if (row.bloqueado != null) price.blocked = row.bloqueado;
        if (row.preco != null && row.preco > 0) price.price_sale_half_pair = row.preco;
        updated++;
        if (sampUpd.length < 5) {
          sampUpd.push({ erp_code: ec, description: row.descricao, availability: price.availability, active: price.active, blocked: price.blocked });
        }
      } else if (createMissing) {
        // New SKU - try to resolve family
        const fid = resolveFamily(row.descricao, dict, engine, familyIdSet, supplier);
        if (fid) {
          const np = {
            erp_code: ec, description: row.descricao, family_id: fid,
            index: extractIdx(row.descricao, idxRegex),
            active: row.ativo ?? true, blocked: row.bloqueado ?? false,
            price_sale_half_pair: row.preco || 0,
            availability: {
              sphere: { min: row.esferico_min ?? 0, max: row.esferico_max ?? 0 },
              cylinder: { min: row.cilindrico_min ?? 0, max: row.cilindrico_max ?? 0 },
              addition: { min: row.adicao_min ?? 0, max: row.adicao_max ?? 0 },
              diameter_min: row.diametro_min ?? 0, diameter_max: row.diametro_max ?? 0,
            },
          };
          prices.push(np);
          created++;
          if (sampCre.length < 5) sampCre.push(np);
        } else {
          missingMap.push({ erp_code: ec, description: row.descricao });
          pendingToCreate.push({ supplier_code: supplier, erp_code: ec, description: row.descricao, raw_data: raw, status: 'pending' });
          notFound.push(ec);
        }
      } else {
        notFound.push(ec);
      }
    }

    // Gates (only checked when apply is requested)
    const gates: Array<{ gate: string; status: string; detail: string }> = [];
    if (applyFlag && !dryRun) {
      const { count: ep } = await supabase.from('catalog_pending_skus')
        .select('*', { count: 'exact', head: true }).eq('supplier_code', supplier).eq('status', 'pending');
      const tp = (ep || 0) + pendingToCreate.length;
      gates.push(tp > 0
        ? { gate: 'pending_skus', status: 'block', detail: tp + ' pendentes (' + (ep || 0) + ' ant + ' + pendingToCreate.length + ' novos)' }
        : { gate: 'pending_skus', status: 'pass', detail: '0' });

      const supFamIds = families
        .filter((f: Record<string, unknown>) => (f.supplier as string)?.toUpperCase() === supplier && f.active)
        .map((f: Record<string, unknown>) => f.id);
      const noAv = prices.filter((p: Record<string, unknown>) =>
        supFamIds.includes(p.family_id) && p.active && !p.blocked &&
        (!p.availability || (!(p.availability as Record<string, unknown>).sphere && !(p.availability as Record<string, unknown>).cylinder))
      );
      gates.push(noAv.length > 0
        ? { gate: 'availability', status: 'block', detail: noAv.length + ' SKUs sem availability' }
        : { gate: 'availability', status: 'pass', detail: 'OK' });

      if (gates.some(g => g.status === 'block')) {
        const { data: run } = await supabase.from('catalog_sync_runs').insert({
          supplier_code: supplier, run_type: 'apply_blocked', status: 'blocked',
          rows_read: rowsRead, rows_matched: matched, rows_updated: updated, rows_created: created,
          rows_not_found: notFound.length, pending_skus_count: pendingToCreate.length,
          file_name: fileName, report: { gates },
        }).select('id').single();
        const rid = run?.id;
        if (rid && pendingToCreate.length > 0) {
          for (const p of pendingToCreate) p.sync_run_id = rid;
          await supabase.from('catalog_pending_skus').insert(pendingToCreate);
        }
        return new Response(JSON.stringify({
          mode: 'erp-sync', supplier, dry_run: false, applied: false, blocked: true, gates,
          sync_run_id: rid, rows_read: rowsRead, rows_ignored: rowsIgnored, matched, updated, created,
          not_found_in_catalog: notFound.length, pending_created: pendingToCreate.length,
          missing_family_mapping: missingMap.slice(0, 20),
          supplier_mismatch_conflicts: conflicts.slice(0, 10),
          sample_updates: sampUpd, sample_created: sampCre,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Record run
    const { data: run } = await supabase.from('catalog_sync_runs').insert({
      supplier_code: supplier, run_type: dryRun ? 'dry_run' : 'apply',
      status: dryRun ? 'completed' : 'pending',
      rows_read: rowsRead, rows_matched: matched, rows_updated: updated, rows_created: created,
      rows_not_found: notFound.length, pending_skus_count: pendingToCreate.length,
      file_name: fileName, report: { gates, sample_updates: sampUpd },
    }).select('id').single();
    const runId = run?.id || null;

    if (pendingToCreate.length > 0 && runId) {
      for (const p of pendingToCreate) p.sync_run_id = runId;
      await supabase.from('catalog_pending_skus').insert(pendingToCreate);
    }

    // Apply changes to catalog
    let applied = false;
    if (!dryRun && applyFlag) {
      catalog.prices = prices;
      const { error: upErr } = await supabase.storage.from('catalogs').upload(
        'catalog-default.json',
        new Blob([JSON.stringify(catalog)], { type: 'application/json' }),
        { upsert: true, cacheControl: '0' },
      );
      if (upErr) {
        if (runId) await supabase.from('catalog_sync_runs').update({ status: 'failed' }).eq('id', runId);
        return new Response(JSON.stringify({ error: 'Upload failed', details: upErr.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const af = families.filter((f: Record<string, unknown>) => f.active).length;
      const ap = prices.filter((p: Record<string, unknown>) => p.active && !p.blocked).length;
      await supabase.from('catalog_versions').insert({
        version_number: 'erp-sync-' + supplier.toLowerCase() + '-' + new Date().toISOString().split('T')[0],
        schema_version: catalog.schema_version || '1.2', import_mode: 'erp-sync',
        dataset_name: 'ERP Sync - ' + supplier, families_count: af, prices_count: ap,
        changes_summary: { supplier, matched, updated, created, not_found: notFound.length, gates },
        notes: ['ERP sync ' + supplier + ': ' + updated + ' updated, ' + created + ' created'],
      });
      if (runId) await supabase.from('catalog_sync_runs').update({ status: 'completed' }).eq('id', runId);
      applied = true;
    }

    return new Response(JSON.stringify({
      mode: 'erp-sync', supplier, dry_run: dryRun, applied, blocked: false, gates,
      sync_run_id: runId, rows_read: rowsRead, rows_ignored: rowsIgnored, matched, updated, created,
      not_found_in_catalog: notFound.length, not_found_codes: notFound.slice(0, 20),
      pending_created: pendingToCreate.length, missing_family_mapping: missingMap.slice(0, 20),
      supplier_mismatch_conflicts: conflicts.slice(0, 10), sample_updates: sampUpd, sample_created: sampCre,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('sync-erp-catalog error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: String(error) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
