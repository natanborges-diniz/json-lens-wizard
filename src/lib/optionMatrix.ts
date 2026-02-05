/**
 * OptionMatrix - Builds selectable options from real SKUs/Prices
 * 
 * RULES:
 * 1. Options derived ONLY from active, unblocked prices compatible with prescription
 * 2. Toggle appears ONLY if count >= 1 real SKU backs it
 * 3. Prices come from actual SKU prices (no inference, no calculation)
 * 4. Audit trail: every option references source SKU erp_codes
 * 
 * This module does NOT infer treatments. It reads `addons_detected` as-is.
 * If the catalog needs inference, that must happen in catalogEnricher (build step).
 */

import type { Price, Prescription } from '@/types/lens';

// ============================================================================
// TYPES
// ============================================================================

export interface IndexOption {
  index: string;
  label: string;
  minPairPrice: number;
  deltaFromBase: number;
  skuCount: number;
  sourceErpCodes: string[];
}

export interface TreatmentOption {
  id: string;
  label: string;
  shortLabel: string;
  icon: string; // icon key for UI mapping
  minPairPrice: number;
  deltaFromBase: number;
  skuCount: number;
  sourceErpCodes: string[];
}

export interface OptionMatrix {
  familyId: string;
  prescriptionUsed: { sphere: number; cylinder: number; addition?: number } | null;
  compatiblePriceCount: number;
  indexOptions: IndexOption[];
  treatmentOptions: TreatmentOption[];
  /** Find the best matching SKU for given selections */
  resolve: (index: string, treatments: string[]) => ResolvedSku | null;
}

export interface ResolvedSku {
  price: Price;
  erpCode: string;
  pairPrice: number;
  matchedIndex: string;
  matchedTreatments: string[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const INDEX_LABELS: Record<string, string> = {
  '1.50': 'Padrão (1.50)',
  '1.56': 'Fino (1.56)',
  '1.59': 'Extra Fino (1.59)',
  '1.60': 'Extra Fino (1.60)',
  '1.67': 'Ultra Fino (1.67)',
  '1.74': 'Super Fino (1.74)',
};

const TREATMENT_DISPLAY: Record<string, { label: string; shortLabel: string; icon: string }> = {
  'BLUE': { label: 'Filtro Luz Azul', shortLabel: 'Blue', icon: 'eye' },
  'BLUEGUARD': { label: 'BlueGuard', shortLabel: 'BlueG', icon: 'eye' },
  'BLUECONTROL': { label: 'BlueControl', shortLabel: 'BlueC', icon: 'eye' },
  'BLUE_UV_FILTER': { label: 'Blue UV Filter', shortLabel: 'BlueUV', icon: 'eye' },
  'FOTOSSENSIVEL': { label: 'Fotossensível', shortLabel: 'Foto', icon: 'sun' },
  'FOTO': { label: 'Fotossensível', shortLabel: 'Foto', icon: 'sun' },
  'PHOTOCHROMIC': { label: 'Fotossensível', shortLabel: 'Foto', icon: 'sun' },
  'TRANSITIONS': { label: 'Transitions', shortLabel: 'Trans.', icon: 'sun' },
  'SENSITY': { label: 'Sensity', shortLabel: 'Sensity', icon: 'sun' },
  'PHOTOFUSION': { label: 'PhotoFusion', shortLabel: 'Photo', icon: 'sun' },
  'AR': { label: 'Antirreflexo', shortLabel: 'AR', icon: 'sparkles' },
  'AR_PREMIUM': { label: 'AR Premium', shortLabel: 'AR+', icon: 'sparkles' },
  'AR_BASICO': { label: 'AR Básico', shortLabel: 'AR', icon: 'sparkles' },
  'POLARIZADO': { label: 'Polarizado', shortLabel: 'Polar.', icon: 'shield' },
  'POLARIZED': { label: 'Polarizado', shortLabel: 'Polar.', icon: 'shield' },
};

// ============================================================================
// HELPERS
// ============================================================================

/** Extract refractive index from price (V3.6.x compatible) */
const getIndex = (price: Price): string => {
  const avail = (price as any).availability;
  if (avail?.index) return avail.index;
  if ((price as any).index) return (price as any).index;
  return '1.50';
};

/** Check if a price is compatible with a prescription */
function isPrescriptionCompatible(
  price: Price,
  prescription: { sphere: number; cylinder: number; addition?: number } | null
): boolean {
  if (!prescription) return true; // No prescription = show all
  
  // Check specs (legacy)
  const specs = price.specs;
  if (specs) {
    if (prescription.sphere < specs.sphere_min || prescription.sphere > specs.sphere_max) return false;
    if (prescription.cylinder < specs.cyl_min || prescription.cylinder > specs.cyl_max) return false;
    if (prescription.addition !== undefined && specs.add_min !== undefined && specs.add_max !== undefined) {
      if (prescription.addition < specs.add_min || prescription.addition > specs.add_max) return false;
    }
  }
  
  // Check availability (new schema)
  const avail = (price as any).availability;
  if (avail?.sphere) {
    if (prescription.sphere < avail.sphere.min || prescription.sphere > avail.sphere.max) return false;
    if (avail.cylinder && (prescription.cylinder < avail.cylinder.min || prescription.cylinder > avail.cylinder.max)) return false;
    if (prescription.addition !== undefined && avail.addition) {
      if (prescription.addition < avail.addition.min || prescription.addition > avail.addition.max) return false;
    }
  }
  
  return true;
}

// ============================================================================
// MAIN BUILDER
// ============================================================================

/**
 * Build OptionMatrix for a family from its real prices.
 * 
 * @param familyId - The family ID
 * @param allFamilyPrices - ALL prices for this family (pre-filtered by family_id)
 * @param prescription - Client prescription (null = no filter)
 * @returns OptionMatrix with real options backed by SKUs
 */
export function buildOptionMatrix(
  familyId: string,
  allFamilyPrices: Price[],
  prescription: { sphere: number; cylinder: number; addition?: number } | null = null
): OptionMatrix {
  // Step 1: Filter to active, unblocked, prescription-compatible prices
  const compatible = allFamilyPrices.filter(p => 
    p.active && !p.blocked && isPrescriptionCompatible(p, prescription)
  );

  // Step 2: Build index options from compatible prices
  const indexMap = new Map<string, { minHalf: number; erpCodes: string[] }>();
  compatible.forEach(price => {
    const idx = getIndex(price);
    const existing = indexMap.get(idx);
    if (!existing) {
      indexMap.set(idx, { minHalf: price.price_sale_half_pair, erpCodes: [price.erp_code] });
    } else {
      if (price.price_sale_half_pair < existing.minHalf) {
        existing.minHalf = price.price_sale_half_pair;
      }
      existing.erpCodes.push(price.erp_code);
    }
  });

  const sortedIndices = Array.from(indexMap.entries())
    .sort(([a], [b]) => parseFloat(a) - parseFloat(b));
  
  const baseIndexMinHalf = sortedIndices.length > 0 ? sortedIndices[0][1].minHalf : 0;

  const indexOptions: IndexOption[] = sortedIndices.map(([idx, data]) => ({
    index: idx,
    label: INDEX_LABELS[idx] || idx,
    minPairPrice: data.minHalf * 2,
    deltaFromBase: (data.minHalf - baseIndexMinHalf) * 2,
    skuCount: data.erpCodes.length,
    sourceErpCodes: data.erpCodes,
  }));

  // Step 3: Build treatment options from addons_detected on compatible prices
  const treatmentMap = new Map<string, { minHalf: number; erpCodes: string[] }>();
  
  // Find base price (no addons) for delta calculation
  const basePrices = compatible.filter(p => !p.addons_detected?.length);
  const baseHalf = basePrices.length > 0
    ? Math.min(...basePrices.map(p => p.price_sale_half_pair))
    : (compatible.length > 0 ? Math.min(...compatible.map(p => p.price_sale_half_pair)) : 0);

  compatible.forEach(price => {
    (price.addons_detected || []).forEach(addonId => {
      const existing = treatmentMap.get(addonId);
      if (!existing) {
        treatmentMap.set(addonId, { minHalf: price.price_sale_half_pair, erpCodes: [price.erp_code] });
      } else {
        if (price.price_sale_half_pair < existing.minHalf) {
          existing.minHalf = price.price_sale_half_pair;
        }
        existing.erpCodes.push(price.erp_code);
      }
    });
  });

  const treatmentOptions: TreatmentOption[] = Array.from(treatmentMap.entries()).map(([id, data]) => {
    const display = TREATMENT_DISPLAY[id] || { 
      label: id.replace(/_/g, ' '), 
      shortLabel: id.substring(0, 5), 
      icon: 'plus' 
    };
    return {
      id,
      label: display.label,
      shortLabel: display.shortLabel,
      icon: display.icon,
      minPairPrice: data.minHalf * 2,
      deltaFromBase: (data.minHalf - baseHalf) * 2,
      skuCount: data.erpCodes.length,
      sourceErpCodes: data.erpCodes,
    };
  });

  // Step 4: Resolver function
  const resolve = (index: string, treatments: string[]): ResolvedSku | null => {
    const candidates = compatible.filter(p => getIndex(p) === index);
    if (candidates.length === 0) return null;

    // Try exact match: all requested treatments present
    if (treatments.length > 0) {
      const exact = candidates.filter(p => {
        const detected = p.addons_detected || [];
        return treatments.every(t => detected.includes(t));
      });
      if (exact.length > 0) {
        const best = exact.sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0];
        return {
          price: best,
          erpCode: best.erp_code,
          pairPrice: best.price_sale_half_pair * 2,
          matchedIndex: index,
          matchedTreatments: treatments,
        };
      }
    }

    // Fallback: cheapest for this index (no treatment match)
    const cheapest = candidates.sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0];
    return {
      price: cheapest,
      erpCode: cheapest.erp_code,
      pairPrice: cheapest.price_sale_half_pair * 2,
      matchedIndex: index,
      matchedTreatments: [],
    };
  };

  return {
    familyId,
    prescriptionUsed: prescription,
    compatiblePriceCount: compatible.length,
    indexOptions,
    treatmentOptions,
    resolve,
  };
}
