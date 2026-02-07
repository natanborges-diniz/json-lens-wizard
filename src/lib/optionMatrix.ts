/**
 * OptionMatrix - Builds selectable options from real SKUs/Prices
 * 
 * v3.6.2.2 RULES:
 * 1. Uses prices[].index_value as index source (NOT inferred from description)
 * 2. Uses prices[].addons_detected[] as addon source (NOT inferred by regex)
 * 3. Uses families[].options to know WHAT toggles to show per family
 * 4. Uses addons[] library for labels/names
 * 5. Toggle appears ONLY if count >= 1 real SKU backs it
 * 6. Prices from actual SKU (no inference, no calculation)
 * 7. Audit trail: every option references source SKU erp_codes
 */

import type { Price, FamilyExtended, CatalogAddon } from '@/types/lens';

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
  icon: string;
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

// Friendly short labels for common addon IDs
const ADDON_SHORT_LABELS: Record<string, string> = {
  'ADDON_BLUE': 'Filtro Azul',
  'ADDON_BLUE_UV': 'Filtro Azul UV',
  'ADDON_AR': 'Antirreflexo',
  'ADDON_AR_PREMIUM': 'AR Premium',
  'ADDON_PHOTO': 'Fotossensível',
  'ADDON_PHOTO_GRAY': 'Foto Cinza',
  'ADDON_PHOTO_BROWN': 'Foto Marrom',
  'ADDON_TRANSITIONS': 'Transitions',
  'ADDON_POLAR': 'Polarizada',
  'ADDON_MIRROR': 'Espelhada',
  'ADDON_DLC': 'DLC',
  'ADDON_HIDRO': 'Hidrofóbico',
};

// Fallback icons by addon group
const GROUP_ICON_MAP: Record<string, string> = {
  'Blue': 'eye',
  'AR': 'sparkles',
  'Photo': 'sun',
  'Sun': 'shield',
  'Protection': 'shield',
};

// ============================================================================
// HELPERS
// ============================================================================

/** Get the refractive index from price using index_value (v3.6.2.2) */
const getIndex = (price: Price): string => {
  // v3.6.2.2: Use formal index_value field
  if ((price as any).index_value != null) {
    return String((price as any).index_value);
  }
  // Fallback: availability.index
  const avail = (price as any).availability;
  if (avail?.index) return avail.index;
  // Legacy fallback
  if (price.index) return price.index;
  return '1.50';
};

/** Normalize index string for consistent comparison (1.5 -> 1.50) */
const normalizeIndex = (idx: string): string => {
  const num = parseFloat(idx);
  if (isNaN(num)) return idx;
  // 1.5 -> 1.50, 1.59 -> 1.59, 1.6 -> 1.60
  if (num === 1.5) return '1.50';
  if (num === 1.6) return '1.60';
  return num.toFixed(2);
};

/** Check if a price is compatible with a prescription */
function isPrescriptionCompatible(
  price: Price,
  prescription: { sphere: number; cylinder: number; addition?: number } | null
): boolean {
  if (!prescription) return true;
  
  const specs = price.specs;
  if (specs) {
    if (prescription.sphere < specs.sphere_min || prescription.sphere > specs.sphere_max) return false;
    if (prescription.cylinder < specs.cyl_min || prescription.cylinder > specs.cyl_max) return false;
    if (prescription.addition !== undefined && specs.add_min !== undefined && specs.add_max !== undefined) {
      if (prescription.addition < specs.add_min || prescription.addition > specs.add_max) return false;
    }
  }
  
  const avail = (price as any).availability;
  if (avail?.sphere) {
    // Null min/max = unrestricted
    if (avail.sphere.min != null && prescription.sphere < avail.sphere.min) return false;
    if (avail.sphere.max != null && prescription.sphere > avail.sphere.max) return false;
    if (avail.cylinder) {
      if (avail.cylinder.min != null && prescription.cylinder < avail.cylinder.min) return false;
      if (avail.cylinder.max != null && prescription.cylinder > avail.cylinder.max) return false;
    }
    if (prescription.addition !== undefined && avail.addition) {
      if (avail.addition.min != null && prescription.addition < avail.addition.min) return false;
      if (avail.addition.max != null && prescription.addition > avail.addition.max) return false;
    }
  }
  
  return true;
}

// ============================================================================
// RESOLVER HELPER
// ============================================================================

function buildResolver(compatible: Price[]) {
  return (index: string, treatments: string[]): ResolvedSku | null => {
    const normalizedIdx = normalizeIndex(index);
    const candidates = compatible.filter(p => normalizeIndex(getIndex(p)) === normalizedIdx);
    if (candidates.length === 0) return null;

    if (treatments.length > 0) {
      const exact = candidates.filter(p => {
        const detected = p.addons_detected || [];
        return treatments.every(t => detected.includes(t));
      });
      if (exact.length > 0) {
        const best = exact.sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0];
        return {
          price: best, erpCode: best.erp_code, pairPrice: best.price_sale_half_pair * 2,
          matchedIndex: normalizedIdx, matchedTreatments: treatments,
        };
      }
    }

    const cheapest = candidates.sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0];
    return {
      price: cheapest, erpCode: cheapest.erp_code, pairPrice: cheapest.price_sale_half_pair * 2,
      matchedIndex: normalizedIdx, matchedTreatments: [],
    };
  };
}

// ============================================================================
// MAIN BUILDER
// ============================================================================

/**
 * Build OptionMatrix for a family from its real prices.
 * v3.6.2.4: Uses family.options.indexes_available & addons_available as ONLY source.
 * Delta calculation preserves same index for accurate comparison.
 * 
 * @param familyId - The family ID
 * @param allFamilyPrices - ALL prices for this family (pre-filtered by family_id)
 * @param prescription - Client prescription (null = no filter)
 * @param family - Family object (REQUIRED for options metadata)
 * @param addonsLibrary - Addons library (optional, for labels)
 */
export function buildOptionMatrix(
  familyId: string,
  allFamilyPrices: Price[],
  prescription: { sphere: number; cylinder: number; addition?: number } | null = null,
  family?: FamilyExtended | null,
  addonsLibrary?: CatalogAddon[]
): OptionMatrix {
  // Step 1: Filter to active, unblocked, prescription-compatible prices
  const compatible = allFamilyPrices.filter(p => 
    p.active && !p.blocked && isPrescriptionCompatible(p, prescription)
  );

  // Step 2: Build index options ONLY from family.options.indexes_available
  const allowedIndexes = family?.options?.indexes_available;
  
  const indexMap = new Map<string, { minHalf: number; erpCodes: string[] }>();
  compatible.forEach(price => {
    const idx = normalizeIndex(getIndex(price));
    
    // v3.6.2.4: If family defines indexes_available, ONLY show those
    if (allowedIndexes && allowedIndexes.length > 0) {
      const idxAllowed = allowedIndexes.some(ai => normalizeIndex(String(ai)) === idx);
      if (!idxAllowed) return;
    }
    
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

  // Step 3: Build treatment options from family.options.addons_available (REQUIRED)
  const allowedAddons = family?.options?.addons_available;
  
  // If family has no options.addons_available, NO treatment toggles
  if (!allowedAddons || allowedAddons.length === 0) {
    const resolve = buildResolver(compatible);
    return {
      familyId,
      prescriptionUsed: prescription,
      compatiblePriceCount: compatible.length,
      indexOptions,
      treatmentOptions: [],
      resolve,
    };
  }
  
  // v3.6.2.4: Delta calculation — compare base SKU vs addon SKU at SAME index
  // Build per-index base prices (SKUs with no addons)
  const baseByIndex = new Map<string, number>();
  compatible.forEach(p => {
    if ((p.addons_detected || []).length === 0) {
      const idx = normalizeIndex(getIndex(p));
      const existing = baseByIndex.get(idx);
      if (!existing || p.price_sale_half_pair < existing) {
        baseByIndex.set(idx, p.price_sale_half_pair);
      }
    }
  });
  
  // Global base price fallback
  const globalBaseHalf = compatible.length > 0
    ? Math.min(...compatible.map(p => p.price_sale_half_pair))
    : 0;

  const treatmentMap = new Map<string, { 
    minHalf: number; 
    erpCodes: string[];
    bestDelta: number; // best delta maintaining same index
  }>();
  
  compatible.forEach(price => {
    (price.addons_detected || []).forEach(addonId => {
      // v3.6.2.4: STRICT filter - only if in family.options.addons_available
      if (!allowedAddons.includes(addonId)) return;
      
      const idx = normalizeIndex(getIndex(price));
      const sameIndexBase = baseByIndex.get(idx);
      const delta = sameIndexBase != null
        ? (price.price_sale_half_pair - sameIndexBase) * 2
        : (price.price_sale_half_pair - globalBaseHalf) * 2;
      
      const existing = treatmentMap.get(addonId);
      if (!existing) {
        treatmentMap.set(addonId, { 
          minHalf: price.price_sale_half_pair, 
          erpCodes: [price.erp_code],
          bestDelta: delta,
        });
      } else {
        if (price.price_sale_half_pair < existing.minHalf) {
          existing.minHalf = price.price_sale_half_pair;
        }
        if (delta < existing.bestDelta) {
          existing.bestDelta = delta;
        }
        existing.erpCodes.push(price.erp_code);
      }
    });
  });

  // Build addon map for label resolution
  const addonMap = new Map<string, CatalogAddon>();
  if (addonsLibrary) {
    addonsLibrary.forEach(a => addonMap.set(a.id, a));
  }

  const treatmentOptions: TreatmentOption[] = Array.from(treatmentMap.entries()).map(([id, data]) => {
    const addonDef = addonMap.get(id);
    // v3.6.2.4: Use label_short from addons_definitions if available
    const label = addonDef?.label_short || addonDef?.name || addonDef?.name_common || id.replace(/^ADDON_/, '').replace(/_/g, ' ');
    const shortLabel = ADDON_SHORT_LABELS[id] || (label.length > 16 ? label.substring(0, 14) + '…' : label);
    const icon = addonDef?.group ? (GROUP_ICON_MAP[addonDef.group] || 'plus') : 'plus';
    
    return {
      id,
      label,
      shortLabel,
      icon,
      minPairPrice: data.minHalf * 2,
      deltaFromBase: Math.max(0, data.bestDelta), // never negative
      skuCount: data.erpCodes.length,
      sourceErpCodes: data.erpCodes,
    };
  });

  const resolve = buildResolver(compatible);

  return {
    familyId,
    prescriptionUsed: prescription,
    compatiblePriceCount: compatible.length,
    indexOptions,
    treatmentOptions,
    resolve,
  };
}
