/**
 * Canonical ProductKind Resolution
 * 
 * Resolves the effective product kind (LP/VS/PR/OC/BF) from SKU and family data
 * using a 5-level priority chain. Never relies on `process` alone.
 */

import type { Price, FamilyExtended, ClinicalType } from '@/types/lens';

export type ProductKind = 'LP' | 'VS' | 'PR' | 'OC' | 'BF' | 'UNKNOWN';

export interface ProductKindResult {
  kind: ProductKind;
  source: 'product_kind' | 'clinical_type' | 'manufacturing_type' | 'description' | 'fallback';
}

/**
 * Resolve product kind from SKU + family with 5-level priority.
 * 
 * 1. Explicit `product_kind` field on SKU
 * 2. `clinical_type` on SKU or family → map to kind
 * 3. `manufacturing_type` + clinical context → LP or VS
 * 4. Regex on description
 * 5. Fallback UNKNOWN
 */
export function resolveProductKind(sku: Price, family?: FamilyExtended): ProductKindResult {
  // Level 1: explicit product_kind on SKU
  const explicitKind = (sku as any).product_kind;
  if (explicitKind && isValidKind(explicitKind)) {
    return { kind: explicitKind as ProductKind, source: 'product_kind' };
  }

  // Level 2: clinical_type → kind mapping
  const clinicalType: ClinicalType | undefined = sku.clinical_type || family?.clinical_type || family?.category;
  if (clinicalType) {
    const mapped = mapClinicalTypeToKind(clinicalType, sku);
    if (mapped) return { kind: mapped, source: 'clinical_type' };
  }

  // Level 3: manufacturing_type + process context
  const mfg = (sku.manufacturing_type || '').toUpperCase();
  const process = (sku.process || '').toUpperCase();
  if (mfg || process) {
    // Only infer LP/VS for monofocal context (or unknown context)
    const isMonoContext = !clinicalType || clinicalType === 'MONOFOCAL';
    if (isMonoContext) {
      if (process === 'PRONTA' || mfg === 'PRONTA' || mfg === 'LP') {
        return { kind: 'LP', source: 'manufacturing_type' };
      }
      if (process === 'SURFACADA' || mfg === 'SURFACADA' || mfg === 'SF' || mfg === 'VS') {
        return { kind: 'VS', source: 'manufacturing_type' };
      }
    }
  }

  // Level 4: regex on description
  const desc = (sku.description || '').toLowerCase();
  if (/progressiv/i.test(desc)) return { kind: 'PR', source: 'description' };
  if (/ocupacional/i.test(desc)) return { kind: 'OC', source: 'description' };
  if (/bifocal/i.test(desc)) return { kind: 'BF', source: 'description' };
  if (/\bvs\b|visão simples|visao simples|monofocal/i.test(desc)) {
    return { kind: 'VS', source: 'description' };
  }

  // Level 5: fallback
  return { kind: 'UNKNOWN', source: 'fallback' };
}

function isValidKind(value: string): boolean {
  return ['LP', 'VS', 'PR', 'OC', 'BF'].includes(value.toUpperCase());
}

function mapClinicalTypeToKind(ct: ClinicalType, sku: Price): ProductKind | null {
  switch (ct) {
    case 'PROGRESSIVA':
      return 'PR';
    case 'OCUPACIONAL':
      return 'OC';
    case 'BIFOCAL':
      return 'BF';
    case 'MONOFOCAL': {
      // For monofocal, differentiate LP vs VS using manufacturing info
      const mfg = (sku.manufacturing_type || '').toUpperCase();
      const process = (sku.process || '').toUpperCase();
      if (process === 'PRONTA' || mfg === 'PRONTA' || mfg === 'LP') return 'LP';
      if (process === 'SURFACADA' || mfg === 'SURFACADA' || mfg === 'SF' || mfg === 'VS') return 'VS';
      // Default monofocal without manufacturing info → VS (more general)
      return 'VS';
    }
    default:
      return null;
  }
}
