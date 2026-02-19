import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BUCKET = "catalogs";
const CATALOG_FILE = "catalog-default.json";

function getSupabase() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function downloadCatalog() {
  const sb = getSupabase();
  const { data, error } = await sb.storage.from(BUCKET).download(CATALOG_FILE);
  if (error || !data) throw new Error("Failed to download catalog: " + (error?.message || "no data"));
  const text = new TextDecoder("utf-8").decode(await data.arrayBuffer());
  return JSON.parse(text);
}

// ══════════════════════════════════════════════════════════════
// ERP-SYNC LOGIC
// ══════════════════════════════════════════════════════════════

interface NRow {
  codigo: string; descricao: string; tipo_lente: string;
  esferico_min: number|null; esferico_max: number|null;
  cilindrico_min: number|null; cilindrico_max: number|null;
  adicao_min: number|null; adicao_max: number|null;
  diametro_min: number|null; diametro_max: number|null;
  ativo: boolean; bloqueado: boolean; preco: number|null;
}

function normalize(raw: Record<string,any>, mapping: Record<string,string[]>): NRow | null {
  const find = (f: string): any => {
    for (const a of (mapping[f]||[])) { if (raw[a] != null && raw[a] !== "") return raw[a]; }
    if (raw[f] != null && raw[f] !== "") return raw[f];
    return null;
  };
  const codigo = String(find("codigo") || "").trim();
  if (!codigo) return null;
  const pn = (v: any): number|null => { const n = Number(v); return isNaN(n) ? null : n; };
  const pb = (v: any): boolean => {
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v === 1;
    return ["true","1","sim"].includes(String(v).toLowerCase());
  };
  const hasTech = find("esferico_min") != null || find("esferico_max") != null || find("cilindrico_min") != null || find("diametro_min") != null;
  const tl = String(find("tipo_lente") || "").trim();
  if (!tl && !hasTech) return null;
  return {
    codigo, descricao: String(find("descricao")||"").trim(), tipo_lente: tl,
    esferico_min: pn(find("esferico_min")), esferico_max: pn(find("esferico_max")),
    cilindrico_min: pn(find("cilindrico_min")), cilindrico_max: pn(find("cilindrico_max")),
    adicao_min: pn(find("adicao_min")), adicao_max: pn(find("adicao_max")),
    diametro_min: pn(find("diametro_min")), diametro_max: pn(find("diametro_max")),
    ativo: pb(find("ativo") ?? true), bloqueado: pb(find("bloqueado") ?? false),
    preco: pn(find("preco"))
  };
}

function resolveFamily(desc: string, dict: Array<{contains:string[];family_id:string;priority:number}>, global?: any[]): string|null {
  const lo = desc.toLowerCase();
  const sorted = [...dict].sort((a,b) => a.priority - b.priority);
  for (const r of sorted) {
    if (r.contains.every(k => lo.includes(k.toLowerCase()))) return r.family_id;
  }
  if (global) {
    for (const r of global) {
      const kw = r.contains || r.patterns || [];
      if (kw.every((k: string) => lo.includes(k.toLowerCase()))) return r.family_id;
    }
  }
  return null;
}

function buildAv(row: NRow, re: RegExp): Record<string,any> {
  const av: Record<string,any> = {};
  if (row.esferico_min != null && row.esferico_max != null) av.sphere = { min: row.esferico_min, max: row.esferico_max };
  if (row.cilindrico_min != null && row.cilindrico_max != null) av.cylinder = { min: row.cilindrico_min, max: row.cilindrico_max };
  if (row.adicao_min != null && row.adicao_max != null) av.addition = { min: row.adicao_min, max: row.adicao_max };
  const d: number[] = [];
  if (row.diametro_min != null) d.push(row.diametro_min);
  if (row.diametro_max != null && row.diametro_max !== row.diametro_min) d.push(row.diametro_max);
  if (d.length) av.diameters_mm = d;
  const m = row.descricao.match(re);
  if (m) av.index = m[0];
  return av;
}

async function erpSync(req: Request, params: URLSearchParams) {
  const supplier = params.get("supplier")?.toUpperCase();
  if (!supplier) return jsonResponse({ error: "Missing required param: supplier" }, 400);
  const dryRun = params.get("dry_run") !== "false";
  const apply = params.get("apply") === "true";
  const createMissing = params.get("create_missing") === "true";
  const sb = getSupabase();

  const { data: profile, error: profErr } = await sb
    .from("supplier_profiles").select("*")
    .eq("supplier_code", supplier).eq("is_active", true).single();
  if (profErr || !profile) return jsonResponse({ error: "Supplier profile not found for " + supplier, detail: profErr?.message }, 404);

  // GET = info
  if (req.method === "GET") {
    const { count: pc } = await sb.from("catalog_pending_skus").select("id", { count: "exact", head: true }).eq("supplier_code", supplier).eq("status", "pending");
    const { data: lr } = await sb.from("catalog_sync_runs").select("*").eq("supplier_code", supplier).order("created_at", { ascending: false }).limit(1);
    return jsonResponse({
      mode: "erp-sync", method: "GET", supplier, profile_active: true,
      column_mapping_fields: Object.keys(profile.column_mapping || {}),
      family_dictionary_rules: ((profile.family_dictionary || []) as any[]).length,
      pending_skus: pc || 0, last_run: lr?.[0] || null
    });
  }

  // POST = process rows
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return jsonResponse({ error: "Send application/json with {rows:[...]}" }, 400);

  const body = await req.json();
  const rawRows: Record<string,any>[] = body.rows || body.data || (Array.isArray(body) ? body : []);
  if (!rawRows.length) return jsonResponse({ error: "No rows provided" }, 400);

  const mapping = profile.column_mapping as Record<string,string[]>;
  const dict = (profile.family_dictionary || []) as Array<{contains:string[];family_id:string;priority:number}>;
  const ixRe = new RegExp(((profile.index_parsing as any)?.regex) || "1\\.\\d{2}");
  const photoKw = (profile.keywords_photo || []) as string[];

  const catalog = await downloadCatalog();
  const prices: any[] = catalog.prices || [];
  const globalEngine = catalog.family_matching_engine || [];
  const families: any[] = catalog.families || [];
  const familyIds = new Set(families.map((f: any) => f.id));

  const normalized: NRow[] = [];
  let ignored = 0;
  for (const raw of rawRows) {
    const n = normalize(raw, mapping);
    if (n) normalized.push(n); else ignored++;
  }

  // Build indexes: raw and trimmed (strip leading zeros)
  const erpIdxRaw = new Map<string,number>();
  const erpIdxTrimmed = new Map<string,number>();
  const trimLeadingZeros = (s: string) => s.replace(/^0+/, '') || '0';
  prices.forEach((p: any, i: number) => {
    const c = String(p.erp_code || p.sku_erp || '').trim();
    if (c) { erpIdxRaw.set(c, i); erpIdxTrimmed.set(trimLeadingZeros(c), i); }
  });

  let matched = 0, matchedRaw = 0, matchedTrimmed = 0, updated = 0, created = 0;
  const notFound: any[] = [];
  const missingFam: any[] = [];
  const mismatch: any[] = [];
  const sampleUp: any[] = [];
  const sampleCr: any[] = [];
  const pendingList: any[] = [];
  const newPrices = [...prices];

  for (const row of normalized) {
    let idx = erpIdxRaw.get(row.codigo);
    let matchType: 'raw' | 'trimmed' | null = idx !== undefined ? 'raw' : null;
    if (idx === undefined) {
      idx = erpIdxTrimmed.get(trimLeadingZeros(row.codigo));
      matchType = idx !== undefined ? 'trimmed' : null;
    }
    if (idx !== undefined && matchType) {
      matched++;
      if (matchType === 'raw') matchedRaw++; else matchedTrimmed++;
      const ex = newPrices[idx];
      const exFam = families.find((f: any) => f.id === ex.family_id);
      if (exFam?.supplier && exFam.supplier.toUpperCase() !== supplier) {
        mismatch.push({ erp_code: row.codigo, catalog_supplier: exFam.supplier, erp_supplier: supplier });
        continue;
      }
      const av = buildAv(row, ixRe);
      newPrices[idx] = { ...ex, availability: { ...ex.availability, ...av }, active: row.ativo && !row.bloqueado };
      if (row.preco != null) newPrices[idx].price = row.preco;
      updated++;
      if (sampleUp.length < 5) sampleUp.push({ erp_code: row.codigo, description: row.descricao, availability: av, active: newPrices[idx].active });
    } else if (createMissing) {
      const fid = resolveFamily(row.descricao, dict, globalEngine);
      if (fid && familyIds.has(fid)) {
        const av = buildAv(row, ixRe);
        const isPhoto = photoKw.some(k => row.descricao.toLowerCase().includes(k.toLowerCase()));
        const ns: any = {
          erp_code: row.codigo, sku_erp: row.codigo, description: row.descricao,
          family_id: fid, availability: av, active: row.ativo && !row.bloqueado,
          lens_state: isPhoto ? "photo" : "clear"
        };
        if (row.preco != null) ns.price = row.preco;
        newPrices.push(ns); created++;
        if (sampleCr.length < 5) sampleCr.push(ns);
      } else {
        missingFam.push({ erp_code: row.codigo, description: row.descricao, resolved_family_id: fid, family_exists: fid ? familyIds.has(fid) : false });
        pendingList.push({ erp_code: row.codigo, description: row.descricao, raw_data: row, supplier_code: supplier });
      }
    } else {
      notFound.push({ erp_code: row.codigo, description: row.descricao });
    }
  }

  let activeNoAv = 0;
  for (const p of newPrices) {
    const fm = families.find((f: any) => f.id === p.family_id);
    if (!fm || fm.supplier?.toUpperCase() !== supplier || !p.active) continue;
    if (!p.availability?.sphere || p.availability.sphere.min === undefined) activeNoAv++;
  }

  const report: any = {
    mode: "erp-sync", supplier, dry_run: dryRun, applied: false, create_missing: createMissing,
    rows_read: rawRows.length, rows_ignored: ignored, normalized: normalized.length,
    matched, matched_raw: matchedRaw, matched_trimmed: matchedTrimmed, updated, created,
    not_found_in_catalog: notFound.length, pending_created: pendingList.length,
    missing_family_mapping: missingFam.length,
    missing_family_mapping_examples: missingFam.slice(0, 10),
    supplier_mismatch_conflicts: mismatch.length,
    supplier_mismatch_examples: mismatch.slice(0, 5),
    active_skus_without_availability: activeNoAv,
    sample_updates: sampleUp, sample_created: sampleCr,
    not_found_examples: notFound.slice(0, 10)
  };

  // Record run
  const { data: runData } = await sb.from("catalog_sync_runs").insert({
    supplier_code: supplier, run_type: dryRun ? "dry_run" : "apply", status: "completed",
    rows_read: rawRows.length, rows_matched: matched, rows_updated: updated,
    rows_created: created, rows_not_found: notFound.length + missingFam.length,
    pending_skus_count: pendingList.length, report
  }).select("id").single();
  const rid = runData?.id;
  if (rid) report.sync_run_id = rid;

  // Insert pending
  if (rid && pendingList.length) {
    await sb.from("catalog_pending_skus").insert(
      pendingList.map(ps => ({
        sync_run_id: rid, supplier_code: ps.supplier_code,
        erp_code: ps.erp_code, description: ps.description,
        raw_data: ps.raw_data, status: "pending"
      }))
    );
  }

  // Apply gates
  if (apply && !dryRun) {
    const { count: ep } = await sb.from("catalog_pending_skus").select("id", { count: "exact", head: true }).eq("supplier_code", supplier).eq("status", "pending");
    if ((ep || 0) > 0) return jsonResponse({ ...report, gate_blocked: true, gate_reason: ep + " pending SKUs for " + supplier }, 409);
    if (activeNoAv > 0) return jsonResponse({ ...report, gate_blocked: true, gate_reason: activeNoAv + " active SKUs lack availability" }, 409);
    if (mismatch.length > 0) return jsonResponse({ ...report, gate_blocked: true, gate_reason: mismatch.length + " supplier mismatch conflicts" }, 409);

    catalog.prices = newPrices;
    const blob = new Blob([JSON.stringify(catalog, null, 2)], { type: "application/json" });
    const { error: ue } = await sb.storage.from(BUCKET).upload(CATALOG_FILE, blob, { upsert: true, contentType: "application/json" });
    if (ue) return jsonResponse({ ...report, error: "Upload failed: " + ue.message }, 500);

    await sb.from("catalog_versions").insert({
      version_number: "erp-sync-" + supplier.toLowerCase() + "-" + Date.now(),
      schema_version: catalog.schema_version || "1.0", import_mode: "erp-sync",
      dataset_name: "ERP Sync " + supplier, families_count: families.length,
      prices_count: newPrices.length,
      notes: ["ERP sync " + supplier + ": " + updated + " updated, " + created + " created"],
      changes_summary: { updated, created, matched, supplier }
    });
    if (rid) await sb.from("catalog_sync_runs").update({ status: "applied", report: { ...report, applied: true } }).eq("id", rid);
    report.applied = true;
  }

  return jsonResponse(report);
}

// ══════════════════════════════════════════════════════════════
// GRADES LOGIC (original)
// ══════════════════════════════════════════════════════════════

async function handleGrades(req: Request, url: URL) {
  const supabase = getSupabase();
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const subRoute = pathSegments[pathSegments.length - 1];
  const isMissing = subRoute === 'missing';

  // GET /missing
  if (req.method === 'GET' && isMissing) {
    const catalog = await downloadCatalog();
    const ixRe = /\b1\.\d{2}\b/;
    const photoKw = ["transitions","photofusion","sensity","xtractive","fotossens","fotocrom"];
    
    const { data: grades, error: gradesErr } = await supabase
      .from('catalog_variant_grades')
      .select('family_id, index, lens_state');
    if (gradesErr) throw gradesErr;

    const gradeSet = new Set(
      (grades || []).map((g: any) => `${g.family_id}|${g.index}|${g.lens_state}`)
    );

    const missing: any[] = [];
    for (const fam of (catalog.families || [])) {
      const fp = (catalog.prices || []).filter((p: any) => p.family_id === fam.id);
      for (const p of fp) {
        const d = (p.description || "").toLowerCase();
        const m = d.match(ixRe);
        const idx = m ? m[0] : "unknown";
        const st = photoKw.some(k => d.includes(k)) ? "photo" : "clear";
        const key = `${fam.id}|${idx}|${st}`;
        if (!gradeSet.has(key)) {
          missing.push({
            family_id: fam.id, family_name: fam.name,
            supplier: fam.supplier, clinical_type: fam.clinical_type,
            index: idx, lens_state: st, sku_count: 1,
          });
        }
      }
    }

    return jsonResponse({ total_missing: missing.length, total_graded: gradeSet.size, missing });
  }

  // GET — list grades
  if (req.method === 'GET') {
    const supplier = url.searchParams.get('supplier');
    const familyId = url.searchParams.get('family_id');
    let query = supabase.from('catalog_variant_grades').select('*');
    if (supplier) query = query.ilike('family_id', `%${supplier}%`);
    if (familyId) query = query.eq('family_id', familyId);
    const { data, error } = await query.order('family_id').order('index');
    if (error) throw error;
    return jsonResponse({ total: data?.length || 0, grades: data });
  }

  // POST/PUT — upsert grade
  if (req.method === 'POST' || req.method === 'PUT') {
    const body = await req.json();
    const required = ['family_id', 'index', 'lens_state'];
    for (const field of required) {
      if (!body[field]) return jsonResponse({ error: `Missing required field: ${field}` }, 400);
    }
    const record = {
      company_id: body.company_id || '00000000-0000-0000-0000-000000000000',
      family_id: body.family_id, index: body.index, lens_state: body.lens_state,
      sphere_min: body.sphere_min ?? null, sphere_max: body.sphere_max ?? null,
      cylinder_min: body.cylinder_min ?? null, cylinder_max: body.cylinder_max ?? null,
      addition_min: body.addition_min ?? null, addition_max: body.addition_max ?? null,
      diameters_mm: body.diameters_mm ?? null, notes: body.notes ?? null,
      created_by: body.created_by ?? null,
    };
    const { data, error } = await supabase
      .from('catalog_variant_grades')
      .upsert(record, { onConflict: 'company_id,family_id,index,lens_state' })
      .select().single();
    if (error) throw error;
    return jsonResponse({ success: true, grade: data }, req.method === 'POST' ? 201 : 200);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
}

// ══════════════════════════════════════════════════════════════
// ROUTER
// ══════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get("mode");

    if (mode === "erp-sync") return await erpSync(req, url.searchParams);

    // Default: grades
    return await handleGrades(req, url);
  } catch (error: any) {
    console.error('Error:', error);
    return jsonResponse({ error: error.message || 'Unknown error' }, 500);
  }
});
