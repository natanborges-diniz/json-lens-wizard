import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── Synthetic Scenarios ───────────────────────────────────────────

interface Scenario {
  name: string;
  sphere: number;
  cylinder: number;
  addition?: number;
}

function generateSyntheticScenarios(clinicalType: string): Scenario[] {
  switch (clinicalType) {
    case 'MONOFOCAL':
      return [
        { name: 'leve_tipico', sphere: -2.00, cylinder: -0.75 },
        { name: 'miopia_moderada', sphere: -5.00, cylinder: -1.50 },
        { name: 'miopia_alta', sphere: -8.00, cylinder: -2.00 },
        { name: 'hipermetropia_alta', sphere: 6.00, cylinder: -1.00 },
        { name: 'cilindro_alto', sphere: -3.00, cylinder: -4.00 },
        { name: 'borda_maxima', sphere: -10.00, cylinder: -6.00 },
      ];
    case 'PROGRESSIVA':
      return [
        { name: 'presbiopia_inicial', sphere: -2.00, cylinder: -0.50, addition: 1.00 },
        { name: 'presbiopia_tipica', sphere: -2.00, cylinder: -1.00, addition: 2.00 },
        { name: 'presbiopia_avancada', sphere: 3.00, cylinder: -1.50, addition: 3.00 },
        { name: 'adicao_maxima', sphere: -1.00, cylinder: -0.75, addition: 3.50 },
        { name: 'miopia_alta_prog', sphere: -7.00, cylinder: -2.00, addition: 2.50 },
        { name: 'cilindro_alto_prog', sphere: -3.00, cylinder: -4.00, addition: 2.00 },
      ];
    case 'OCUPACIONAL':
      return [
        { name: 'office_leve', sphere: -1.00, cylinder: -0.50, addition: 1.00 },
        { name: 'office_tipico', sphere: -2.00, cylinder: -1.00, addition: 1.75 },
        { name: 'office_avancado', sphere: 2.00, cylinder: -1.50, addition: 2.50 },
      ];
    case 'BIFOCAL':
      return [
        { name: 'bifocal_leve', sphere: 1.00, cylinder: -0.50, addition: 1.50 },
        { name: 'bifocal_tipico', sphere: -2.00, cylinder: -1.00, addition: 2.50 },
        { name: 'bifocal_alto', sphere: 4.00, cylinder: -2.00, addition: 3.50 },
      ];
    default:
      return [];
  }
}

// ─── Eligibility Validation ────────────────────────────────────────

type DiscardReason =
  | 'no_technical_data'
  | 'sphere_out_of_range'
  | 'cylinder_out_of_range'
  | 'addition_out_of_range'
  | 'no_diameter_data'
  | 'diameter_out_of_range'
  | 'no_active_price'
  | 'eligible';

interface TechnicalLimits {
  sphere_min: number;
  sphere_max: number;
  cylinder_min: number;
  cylinder_max: number;
  addition_min?: number;
  addition_max?: number;
  diameters_mm?: number[];
}

function resolveTechnicalLimits(price: any): TechnicalLimits | null {
  const avail = price.availability;

  // V3.6.x availability format (priority)
  if (avail?.sphere?.min != null && avail?.sphere?.max != null) {
    const limits: TechnicalLimits = {
      sphere_min: avail.sphere.min,
      sphere_max: avail.sphere.max,
      cylinder_min: avail.cylinder?.min ?? 0,
      cylinder_max: avail.cylinder?.max ?? 0,
    };
    if (avail.addition?.min != null && avail.addition?.max != null) {
      limits.addition_min = avail.addition.min;
      limits.addition_max = avail.addition.max;
    }
    if (Array.isArray(avail.diameters_mm) && avail.diameters_mm.length > 0) {
      limits.diameters_mm = avail.diameters_mm;
    }
    return limits;
  }

  // Legacy specs format (fallback)
  const specs = price.specs;
  if (specs && specs.sphere_min !== undefined && specs.sphere_max !== undefined) {
    const limits: TechnicalLimits = {
      sphere_min: specs.sphere_min,
      sphere_max: specs.sphere_max,
      cylinder_min: specs.cyl_min ?? 0,
      cylinder_max: specs.cyl_max ?? 0,
    };
    if (specs.add_min !== undefined && specs.add_max !== undefined) {
      limits.addition_min = specs.add_min;
      limits.addition_max = specs.add_max;
    }
    return limits;
  }

  return null; // no technical data
}

function validateEligibility(
  price: any,
  scenario: Scenario,
  clinicalType: string,
  requiredDiameter?: number
): DiscardReason {
  // 1. Resolve technical limits
  const limits = resolveTechnicalLimits(price);
  if (!limits) return 'no_technical_data';

  // 2. Validate sphere: value must be within [min, max]
  const sphereVal = scenario.sphere;
  if (sphereVal < limits.sphere_min || sphereVal > limits.sphere_max) {
    return 'sphere_out_of_range';
  }

  // 3. Validate cylinder: value must be within [min, max]
  const cylVal = scenario.cylinder;
  const cylMin = Math.min(limits.cylinder_min, limits.cylinder_max);
  const cylMax = Math.max(limits.cylinder_min, limits.cylinder_max);
  if (cylVal < cylMin || cylVal > cylMax) {
    return 'cylinder_out_of_range';
  }

  // 4. Validate addition (only for non-MONOFOCAL)
  if (clinicalType !== 'MONOFOCAL') {
    if (scenario.addition != null) {
      if (limits.addition_min == null || limits.addition_max == null) {
        return 'addition_out_of_range';
      }
      const addMin = Math.min(limits.addition_min, limits.addition_max);
      const addMax = Math.max(limits.addition_min, limits.addition_max);
      if (scenario.addition < addMin || scenario.addition > addMax) {
        return 'addition_out_of_range';
      }
    }
  }

  // 5. Validate diameter (when data exists and is required)
  if (requiredDiameter != null && requiredDiameter > 0) {
    if (!limits.diameters_mm || limits.diameters_mm.length === 0) {
      return 'no_diameter_data';
    }
    const maxDiameter = Math.max(...limits.diameters_mm);
    if (requiredDiameter > maxDiameter) {
      return 'diameter_out_of_range';
    }
  }

  // 6. Validate price
  if (
    !price.active ||
    price.blocked ||
    !price.price_sale_half_pair ||
    price.price_sale_half_pair <= 0
  ) {
    return 'no_active_price';
  }

  return 'eligible';
}

// ─── Missing Fields Analyzer ───────────────────────────────────────

interface MissingFieldsBreakdown {
  sphere_missing: boolean;
  cylinder_missing: boolean;
  addition_missing: boolean;
  diameter_missing: boolean;
  index_missing: boolean;
}

function analyzeMissingFields(price: any): MissingFieldsBreakdown {
  const avail = price.availability;
  const specs = price.specs;

  const hasSphere = (avail?.sphere?.min != null && avail?.sphere?.max != null) ||
    (specs?.sphere_min !== undefined && specs?.sphere_max !== undefined);

  const hasCylinder = (avail?.cylinder?.min != null && avail?.cylinder?.max != null) ||
    (specs?.cyl_min !== undefined && specs?.cyl_max !== undefined);

  const hasAddition = (avail?.addition?.min != null && avail?.addition?.max != null) ||
    (specs?.add_min !== undefined && specs?.add_max !== undefined);

  const hasDiameter = (Array.isArray(avail?.diameters_mm) && avail.diameters_mm.length > 0);

  const hasIndex = (avail?.index != null) || (price.index != null);

  return {
    sphere_missing: !hasSphere,
    cylinder_missing: !hasCylinder,
    addition_missing: !hasAddition,
    diameter_missing: !hasDiameter,
    index_missing: !hasIndex,
  };
}

// ─── Coverage Mode Handler ─────────────────────────────────────────

function runCoverageMode(catalog: any, filterClinicalType?: string) {
  const allTypes = ['MONOFOCAL', 'PROGRESSIVA', 'OCUPACIONAL', 'BIFOCAL'];
  const typesToRun = filterClinicalType
    ? allTypes.filter(t => t === filterClinicalType.toUpperCase())
    : allTypes;

  const families = catalog.families || [];
  const prices = catalog.prices || [];

  // Build family map for clinical_type resolution
  const familyMap = new Map<string, any>();
  for (const f of families) {
    familyMap.set(f.id, f);
  }

  const byClinicalType: Record<string, any> = {};
  const allScenarioResults: { clinical_type: string; scenario: string; pct: number; main_blocker: string }[] = [];
  const eligibleRateByType: Record<string, string> = {};
  let totalScenariosCount = 0;

  // Accumulators for no_technical_data aggregations
  const supplierNoTechCount = new Map<string, number>();
  const supplierTotalCount = new Map<string, number>();
  const familyNoTechCount = new Map<string, number>();
  const familyTotalCount = new Map<string, number>();
  const familyMissingFields = new Map<string, { sphere: number; cylinder: number; addition: number; diameter: number; index: number; total: number }>();

  for (const clinicalType of typesToRun) {
    const scenarios = generateSyntheticScenarios(clinicalType);
    if (scenarios.length === 0) continue;

    // Filter prices by clinical_type
    const typePrices = prices.filter((p: any) => {
      const fam = familyMap.get(p.family_id);
      const pType = (p.clinical_type || fam?.clinical_type || fam?.category || 'MONOFOCAL').toUpperCase();
      return pType === clinicalType;
    });

    // Collect no_technical_data stats (once per clinical_type, not per scenario)
    for (const price of typePrices) {
      const fam = familyMap.get(price.family_id);
      const supplier = fam?.supplier || price.supplier || 'UNKNOWN';
      const familyId = price.family_id || 'UNKNOWN';

      supplierTotalCount.set(supplier, (supplierTotalCount.get(supplier) || 0) + 1);
      familyTotalCount.set(familyId, (familyTotalCount.get(familyId) || 0) + 1);

      const limits = resolveTechnicalLimits(price);
      if (!limits) {
        supplierNoTechCount.set(supplier, (supplierNoTechCount.get(supplier) || 0) + 1);
        familyNoTechCount.set(familyId, (familyNoTechCount.get(familyId) || 0) + 1);

        // Analyze which fields are missing
        const missing = analyzeMissingFields(price);
        if (!familyMissingFields.has(familyId)) {
          familyMissingFields.set(familyId, { sphere: 0, cylinder: 0, addition: 0, diameter: 0, index: 0, total: 0 });
        }
        const acc = familyMissingFields.get(familyId)!;
        acc.total++;
        if (missing.sphere_missing) acc.sphere++;
        if (missing.cylinder_missing) acc.cylinder++;
        if (missing.addition_missing) acc.addition++;
        if (missing.diameter_missing) acc.diameter++;
        if (missing.index_missing) acc.index++;
      }
    }

    const scenarioResults: Record<string, any> = {};
    let typeEligibleTotal = 0;
    let typeEvaluatedTotal = 0;

    for (const scenario of scenarios) {
      totalScenariosCount++;
      const funnel: Record<string, number> = {
        no_technical_data: 0,
        sphere_out_of_range: 0,
        cylinder_out_of_range: 0,
        addition_out_of_range: 0,
        no_diameter_data: 0,
        diameter_out_of_range: 0,
        no_active_price: 0,
      };
      let eligible = 0;
      const eligibleFamilies = new Set<string>();

      for (const price of typePrices) {
        const reason = validateEligibility(price, scenario, clinicalType);
        if (reason === 'eligible') {
          eligible++;
          eligibleFamilies.add(price.family_id);
        } else {
          funnel[reason]++;
        }
      }

      const totalEvaluated = typePrices.length;
      const pctEligible = totalEvaluated > 0
        ? parseFloat(((eligible / totalEvaluated) * 100).toFixed(1))
        : 0;

      typeEligibleTotal += eligible;
      typeEvaluatedTotal += totalEvaluated;

      // Find main blocker
      let mainBlocker = 'none';
      let maxBlock = 0;
      for (const [reason, count] of Object.entries(funnel)) {
        if (count > maxBlock) {
          maxBlock = count;
          mainBlocker = reason;
        }
      }

      allScenarioResults.push({
        clinical_type: clinicalType,
        scenario: scenario.name,
        pct: pctEligible,
        main_blocker: mainBlocker,
      });

      const prescription: Record<string, number> = {
        rightSphere: scenario.sphere,
        rightCylinder: scenario.cylinder,
        leftSphere: scenario.sphere,
        leftCylinder: scenario.cylinder,
      };
      if (scenario.addition != null) {
        prescription.rightAddition = scenario.addition;
        prescription.leftAddition = scenario.addition;
      }

      scenarioResults[scenario.name] = {
        prescription,
        total_skus_evaluated: totalEvaluated,
        eligible,
        discard_funnel: funnel,
        eligible_families: Array.from(eligibleFamilies),
        pct_eligible: `${pctEligible}%`,
      };
    }

    byClinicalType[clinicalType] = { scenarios: scenarioResults };

    const typeRate = typeEvaluatedTotal > 0
      ? parseFloat(((typeEligibleTotal / typeEvaluatedTotal) * 100).toFixed(1))
      : 0;
    eligibleRateByType[clinicalType] = `${typeRate}%`;
  }

  // Worst scenarios (bottom 5 by pct eligible)
  allScenarioResults.sort((a, b) => a.pct - b.pct);
  const worstScenarios = allScenarioResults.slice(0, 5).map(s => ({
    clinical_type: s.clinical_type,
    scenario: s.scenario,
    pct_eligible: `${s.pct}%`,
    main_blocker: s.main_blocker,
  }));

  // Build top_suppliers_by_no_technical_data
  const totalAllPrices = Array.from(supplierTotalCount.values()).reduce((a, b) => a + b, 0) || 1;
  const topSuppliers = Array.from(supplierNoTechCount.entries())
    .map(([supplier, count]) => ({
      supplier,
      count,
      pct: `${((count / (supplierTotalCount.get(supplier) || 1)) * 100).toFixed(1)}%`,
    }))
    .sort((a, b) => b.count - a.count);

  // Build top_families_by_no_technical_data with missing fields breakdown
  const topFamilies = Array.from(familyNoTechCount.entries())
    .map(([family_id, count]) => {
      const fam = familyMap.get(family_id);
      const mf = familyMissingFields.get(family_id);
      return {
        family_id,
        family_name: fam?.name_original || family_id,
        supplier: fam?.supplier || 'UNKNOWN',
        count,
        pct: `${((count / (familyTotalCount.get(family_id) || 1)) * 100).toFixed(1)}%`,
        missing_fields: mf ? {
          sphere_missing: mf.sphere,
          cylinder_missing: mf.cylinder,
          addition_missing: mf.addition,
          diameter_missing: mf.diameter,
          index_missing: mf.index,
        } : undefined,
      };
    })
    .sort((a, b) => b.count - a.count);

  return {
    mode: 'coverage',
    meta: {
      total_skus: prices.length,
      total_families: families.length,
      scenarios_tested: totalScenariosCount,
      generated_at: new Date().toISOString(),
    },
    by_clinical_type: byClinicalType,
    summary: {
      worst_scenarios: worstScenarios,
      total_eligible_rate_by_type: eligibleRateByType,
      top_suppliers_by_no_technical_data: topSuppliers,
      top_families_by_no_technical_data: topFamilies,
    },
  };
}

// ─── Main Handler ──────────────────────────────────────────────────

serve(async (req) => {
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
    const mode = url.searchParams.get('mode') || 'field-audit';

    // ─── Coverage Mode ───
    if (mode === 'coverage') {
      const filterType = url.searchParams.get('clinical_type') || undefined;
      const result = runCoverageMode(catalog, filterType);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ─── Field-Audit Mode (original behavior) ───
    const clinicalType = url.searchParams.get('clinical_type') || 'PROGRESSIVA';
    const familyFilter = url.searchParams.get('family');

    let filteredFamilies = (catalog.families || []).filter((f: any) =>
      (f.clinical_type || f.category) === clinicalType && f.active
    );

    if (familyFilter) {
      filteredFamilies = filteredFamilies.filter((f: any) =>
        f.id.toLowerCase().includes(familyFilter.toLowerCase()) ||
        (f.name_original || '').toLowerCase().includes(familyFilter.toLowerCase())
      );
    }

    const prices = catalog.prices || [];

    const familiesWithPrices = filteredFamilies.map((family: any) => {
      const familyPrices = prices.filter((p: any) =>
        p.family_id === family.id && p.active && !p.blocked
      );
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
