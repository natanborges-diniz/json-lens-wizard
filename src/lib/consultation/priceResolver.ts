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

  const { data, error } = await supabase
    .from('supplier_prices')
    .select('*')
    .eq('active', true)
    .in('family_id', familyIds);

  if (error) {
    console.error('[PriceResolver] Failed to load prices:', error);
    return new Map();
  }

  const map = new Map<string, ResolvedPrice[]>();
  for (const row of data || []) {
    const resolved: ResolvedPrice = {
      id: row.id,
      supplierCode: row.supplier_code,
      familyId: row.family_id!,
      materialIndex: row.material_index,
      treatmentCombo: row.treatment_combo || [],
      lensState: row.lens_state,
      priceValue: row.price_value,
      currency: row.currency,
      confidence: row.confidence,
    };

    const existing = map.get(row.family_id!) || [];
    existing.push(resolved);
    map.set(row.family_id!, existing);
  }

  return map;
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
