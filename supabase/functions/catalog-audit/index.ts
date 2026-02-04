import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download catalog from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('catalogs')
      .download('catalog-default.json');

    if (downloadError || !fileData) {
      throw new Error(`Failed to download catalog: ${downloadError?.message}`);
    }

    const catalogText = await fileData.text();
    const catalog = JSON.parse(catalogText);

    const url = new URL(req.url);
    const clinicalType = url.searchParams.get('clinical_type') || 'PROGRESSIVA';
    const familyFilter = url.searchParams.get('family'); // Optional specific family ID

    // Get families by clinical_type
    let families = (catalog.families || []).filter((f: any) => 
      (f.clinical_type || f.category) === clinicalType && f.active
    );

    // Filter by specific family if provided
    if (familyFilter) {
      families = families.filter((f: any) => 
        f.id.toLowerCase().includes(familyFilter.toLowerCase()) ||
        (f.name_original || '').toLowerCase().includes(familyFilter.toLowerCase())
      );
    }

    // Get prices for each family
    const prices = catalog.prices || [];
    
    const familiesWithPrices = families.map((family: any) => {
      const familyPrices = prices.filter((p: any) => 
        p.family_id === family.id && p.active && !p.blocked
      );
      
      // Sort by price (ascending)
      familyPrices.sort((a: any, b: any) => 
        a.price_sale_half_pair - b.price_sale_half_pair
      );

      const minPrice = familyPrices[0]?.price_sale_half_pair * 2 || 0;
      const maxPrice = familyPrices[familyPrices.length - 1]?.price_sale_half_pair * 2 || 0;

      return {
        id: family.id,
        name: family.name_original,
        supplier: family.supplier,
        tier_target: family.tier_target,
        macro: family.macro,
        clinical_type: family.clinical_type || family.category,
        sku_count: familyPrices.length,
        min_price_pair: minPrice,
        max_price_pair: maxPrice,
        skus: familyPrices.slice(0, 5).map((p: any) => ({
          erp_code: p.erp_code,
          description: p.description,
          index: p.availability?.index || p.index || '1.50',
          price_half: p.price_sale_half_pair,
          price_pair: p.price_sale_half_pair * 2,
          addons_detected: p.addons_detected || [],
        })),
        has_more_skus: familyPrices.length > 5,
      };
    });

    // Sort by tier then by price
    const tierOrder = { essential: 0, comfort: 1, advanced: 2, top: 3 };
    familiesWithPrices.sort((a: any, b: any) => {
      const tierA = tierOrder[a.tier_target as keyof typeof tierOrder] ?? 99;
      const tierB = tierOrder[b.tier_target as keyof typeof tierOrder] ?? 99;
      if (tierA !== tierB) return tierA - tierB;
      return a.min_price_pair - b.min_price_pair;
    });

    return new Response(JSON.stringify({
      success: true,
      clinical_type: clinicalType,
      total_families: familiesWithPrices.length,
      families: familiesWithPrices,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
