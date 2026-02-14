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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const pathSegments = url.pathname.split('/').filter(Boolean);
    // Last segment after function name, e.g. /catalog-grade-matrix/missing → "missing"
    const subRoute = pathSegments[pathSegments.length - 1];
    const isMissing = subRoute === 'missing';

    // ─── GET /missing — variants missing grade ───
    if (req.method === 'GET' && isMissing) {
      // Call catalog-audit?mode=variants to get the full matrix
      const auditUrl = `${supabaseUrl}/functions/v1/catalog-audit?mode=variants`;
      const auditRes = await fetch(auditUrl, {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
      });
      if (!auditRes.ok) {
        const errText = await auditRes.text();
        return jsonResponse({ error: 'Failed to fetch variants from catalog-audit', details: errText }, 502);
      }
      const auditData = await auditRes.json();

      // Get all existing grades
      const { data: grades, error: gradesErr } = await supabase
        .from('catalog_variant_grades')
        .select('family_id, index, lens_state');
      if (gradesErr) throw gradesErr;

      const gradeSet = new Set(
        (grades || []).map((g: any) => `${g.family_id}|${g.index}|${g.lens_state}`)
      );

      // Build missing list
      const missing: any[] = [];
      for (const fam of auditData.families || []) {
        for (const v of fam.variants || []) {
          const key = `${fam.family_id}|${v.index}|${v.state}`;
          if (!gradeSet.has(key)) {
            missing.push({
              family_id: fam.family_id,
              family_name: fam.family_name,
              supplier: fam.supplier,
              clinical_type: fam.clinical_type,
              index: v.index,
              lens_state: v.state,
              sku_count: v.sku_count,
            });
          }
        }
      }

      return jsonResponse({
        total_missing: missing.length,
        total_graded: gradeSet.size,
        missing,
      });
    }

    // ─── GET — list grades ───
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

    // ─── POST/PUT — upsert grade ───
    if (req.method === 'POST' || req.method === 'PUT') {
      const body = await req.json();

      const required = ['family_id', 'index', 'lens_state'];
      for (const field of required) {
        if (!body[field]) {
          return jsonResponse({ error: `Missing required field: ${field}` }, 400);
        }
      }

      const record = {
        company_id: body.company_id || '00000000-0000-0000-0000-000000000000',
        family_id: body.family_id,
        index: body.index,
        lens_state: body.lens_state,
        sphere_min: body.sphere_min ?? null,
        sphere_max: body.sphere_max ?? null,
        cylinder_min: body.cylinder_min ?? null,
        cylinder_max: body.cylinder_max ?? null,
        addition_min: body.addition_min ?? null,
        addition_max: body.addition_max ?? null,
        diameters_mm: body.diameters_mm ?? null,
        notes: body.notes ?? null,
        created_by: body.created_by ?? null,
      };

      const { data, error } = await supabase
        .from('catalog_variant_grades')
        .upsert(record, { onConflict: 'company_id,family_id,index,lens_state' })
        .select()
        .single();

      if (error) throw error;

      return jsonResponse({ success: true, grade: data }, req.method === 'POST' ? 201 : 200);
    }

    return jsonResponse({ error: 'Method not allowed' }, 405);

  } catch (error) {
    console.error('Error:', error);
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});
