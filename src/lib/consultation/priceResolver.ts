/**
 * Price Resolver
 * 
 * Provides structured price lookup from supplier_prices (L4).
 * Resolves price by family × material_index × treatment_combo × lens_state.
 */

import { supabase } from '@/integrations/supabase/client';

export interface ResolvedPrice {
  id: string;
  supplierCode: string;
  familyId: string;
  materialIndex: string;
  treatmentCombo: string[];
  lensState: string;
  priceValue: number;
  currency: string;
  confidence: string;
}

export interface PriceLookupParams {
  familyId: string;
  materialIndex?: string;
  lensState?: string;
  treatmentCombo?: string[];
}

export interface FamilyPriceSummary {
  familyId: string;
  supplierCode: string;
  minPrice: number;
  maxPrice: number;
  indexOptions: string[];
  treatmentOptions: string[];
  lensStates: string[];
  totalCombinations: number;
  prices: ResolvedPrice[];
}

/**
 * Loads all active prices for a set of family IDs.
 */
export async function loadPricesForFamilies(
  familyIds: string[]
): Promise<Map<string, ResolvedPrice[]>> {
  if (!familyIds.length) return new Map();

  // Helper to build map from generic rows
  const buildMap = (rows: Array<{
    id: string; supplier_code: string; family_id: string | null;
    material_index: string; treatment_combo: string[] | null;
    lens_state: string; price_value: number; confidence: string;
    currency?: string;
  }>) => {
    const map = new Map<string, ResolvedPrice[]>();
    for (const row of rows) {
      const familyId = row.family_id;
      if (!familyId) continue;
      const resolved: ResolvedPrice = {
        id: row.id,
        supplierCode: row.supplier_code,
        familyId,
        materialIndex: row.material_index,
        treatmentCombo: row.treatment_combo || [],
        lensState: row.lens_state,
        priceValue: row.price_value,
        currency: row.currency || 'BRL',
        confidence: row.confidence,
      };
      const existing = map.get(familyId) || [];
      existing.push(resolved);
      map.set(familyId, existing);
    }
    return map;
  };

  // Primary: supplier_final_prices (L4 official)
  const { data: finalData, error: finalError } = await supabase
    .from('supplier_final_prices')
    .select('id, supplier_code, family_id, material_index, treatment_combo, lens_state, price_value, confidence')
    .eq('active', true)
    .in('family_id', familyIds);

  if (!finalError && finalData && finalData.length > 0) {
    console.log(`[PriceResolver] Loaded ${finalData.length} prices from supplier_final_prices`);
    return buildMap(finalData.map(r => ({ ...r, price_value: r.price_value ?? 0, confidence: r.confidence as string })));
  }

  if (finalError) {
    console.error('[PriceResolver] supplier_final_prices error:', finalError);
  }

  // Fallback: legacy supplier_prices
  console.warn('[PriceResolver] Falling back to supplier_prices');
  const { data: legacyData, error: legacyError } = await supabase
    .from('supplier_prices')
    .select('id, supplier_code, family_id, material_index, treatment_combo, lens_state, price_value, confidence, currency')
    .eq('active', true)
    .in('family_id', familyIds);

  if (legacyError) {
    console.error('[PriceResolver] Failed to load legacy prices:', legacyError);
    return new Map();
  }

  console.log(`[PriceResolver] Loaded ${legacyData?.length || 0} prices from supplier_prices (fallback)`);
  return buildMap((legacyData || []).map(r => ({ ...r, family_id: r.family_id ?? '', confidence: r.confidence as string })));
}

/**
 * Finds the best price match for specific parameters.
 */
export function findBestPrice(
  prices: ResolvedPrice[],
  params: PriceLookupParams
): ResolvedPrice | null {
  let candidates = prices.filter(p => p.familyId === params.familyId);

  if (params.materialIndex) {
    candidates = candidates.filter(p => p.materialIndex === params.materialIndex);
  }
  if (params.lensState) {
    candidates = candidates.filter(p => p.lensState === params.lensState);
  }

  if (!candidates.length) return null;

  // Sort by price ascending, return cheapest
  candidates.sort((a, b) => a.priceValue - b.priceValue);
  return candidates[0];
}

/**
 * Builds a summary of pricing for each family.
 */
export function buildFamilyPriceSummaries(
  priceMap: Map<string, ResolvedPrice[]>
): FamilyPriceSummary[] {
  const summaries: FamilyPriceSummary[] = [];

  priceMap.forEach((prices, familyId) => {
    if (!prices.length) return;

    const indices = [...new Set(prices.map(p => p.materialIndex))].sort();
    const treatments = [...new Set(prices.flatMap(p => p.treatmentCombo))].sort();
    const states = [...new Set(prices.map(p => p.lensState))].sort();
    const priceValues = prices.map(p => p.priceValue);

    summaries.push({
      familyId,
      supplierCode: prices[0].supplierCode,
      minPrice: Math.min(...priceValues),
      maxPrice: Math.max(...priceValues),
      indexOptions: indices,
      treatmentOptions: treatments,
      lensStates: states,
      totalCombinations: prices.length,
      prices,
    });
  });

  return summaries;
}
