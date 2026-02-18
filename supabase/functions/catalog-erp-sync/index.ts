// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function toNumber(val: any): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toBool(val: any, defaultVal = false): boolean {
  if (val === null || val === undefined) return defaultVal;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val !== 0;
  if (typeof val === 'string') {
    const l = val.toLowerCase().trim();
    return l === 'true' || l === 'sim' || l === 's' || l === '1';
  }
  return defaultVal;
}

console.log('catalog-erp-sync loaded, toNumber test:', toNumber('5'), toBool('sim'));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const supplier = url.searchParams.get('supplier');
  if (!supplier) return jsonResponse({ error: 'Missing supplier' }, 400);

  return jsonResponse({
    endpoint: 'catalog-erp-sync',
    supplier: supplier.toUpperCase(),
    status: 'helpers-loaded',
  });
});
