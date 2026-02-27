/**
 * Catalog Consistency Auditor - Phase 5
 * Pure function that audits family/SKU consistency.
 * 9 critical checks + safe auto-fixes.
 * Zero Creation: only validates and suggests, never creates.
 */

import type { FamilyExtended, Price, TechnologyLibrary, ClinicalType } from '@/types/lens';

// ─── Types ─────────────────────────────────────────────────────

export interface ConsistencyConflict {
  type: string;
  familyId?: string;
  details: string;
  affectedSkus?: string[];
}

export interface AutoFix {
  type: string;
  familyId: string;
  field: string;
  currentValue: string | undefined;
  suggestedValue: string;
  confidence: number; // 0-1
  description: string;
}

export interface ConsistencyAuditResult {
  critical: ConsistencyConflict[];
  warnings: ConsistencyConflict[];
  autoFixes: AutoFix[];
  summary: {
    totalCritical: number;
    totalWarnings: number;
    totalAutoFixes: number;
    canPublish: boolean;
  };
}

// ─── Helpers ───────────────────────────────────────────────────

const VALID_CLINICAL_TYPES = new Set<string>(['MONOFOCAL', 'PROGRESSIVA', 'OCUPACIONAL', 'BIFOCAL']);

function deriveClinicalType(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  if (VALID_CLINICAL_TYPES.has(upper)) return upper;
  // Map common legacy values
  if (upper.includes('PROG')) return 'PROGRESSIVA';
  if (upper.includes('MONO') || upper === 'VS' || upper === 'VISAO_SIMPLES') return 'MONOFOCAL';
  if (upper.includes('OCUP') || upper === 'OC') return 'OCUPACIONAL';
  if (upper.includes('BIFO')) return 'BIFOCAL';
  return raw;
}

function getSkuClinicalType(price: Price): string | undefined {
  return deriveClinicalType(price.clinical_type || price.lens_category_raw);
}

function getFamilyClinicalType(family: FamilyExtended): string | undefined {
  return deriveClinicalType(family.clinical_type || family.category);
}

// ─── Main Auditor ──────────────────────────────────────────────

export function auditFamilyConsistency(
  families: FamilyExtended[],
  prices: Price[],
  technologyLibrary?: TechnologyLibrary | null
): ConsistencyAuditResult {
  const critical: ConsistencyConflict[] = [];
  const warnings: ConsistencyConflict[] = [];
  const autoFixes: AutoFix[] = [];

  const familyMap = new Map(families.map(f => [f.id, f]));
  const pricesByFamily = new Map<string, Price[]>();
  
  for (const p of prices) {
    const list = pricesByFamily.get(p.family_id) || [];
    list.push(p);
    pricesByFamily.set(p.family_id, list);
  }

  // ─── Check 1: SKU_WITHOUT_FAMILY ────────────────────────────
  const orphanSkus = prices.filter(p => !familyMap.has(p.family_id));
  if (orphanSkus.length > 0) {
    critical.push({
      type: 'SKU_WITHOUT_FAMILY',
      details: `${orphanSkus.length} SKU(s) sem família válida`,
      affectedSkus: orphanSkus.slice(0, 50).map(p => p.erp_code),
    });
  }

  // ─── Per-family checks ──────────────────────────────────────
  for (const family of families) {
    const familyPrices = pricesByFamily.get(family.id) || [];
    const activePrices = familyPrices.filter(p => p.active && !p.blocked);
    const familyClinical = getFamilyClinicalType(family);

    // ─── Check 7: FAMILY_WITHOUT_SUPPLIER ─────────────────────
    if (!family.supplier || family.supplier.trim() === '') {
      critical.push({
        type: 'FAMILY_WITHOUT_SUPPLIER',
        familyId: family.id,
        details: `Família "${family.name_original}" sem fornecedor definido`,
      });
    }

    // ─── Check 4: FAMILY_WITHOUT_ACTIVE_SKU ───────────────────
    if (family.active && activePrices.length === 0) {
      critical.push({
        type: 'FAMILY_WITHOUT_ACTIVE_SKU',
        familyId: family.id,
        details: `Família ativa "${family.name_original}" sem nenhum SKU ativo (${familyPrices.length} total)`,
      });
    }

    if (familyPrices.length === 0) continue;

    // ─── Check 6: MIXED_SUPPLIER_FAMILY ───────────────────────
    const uniqueSuppliers = [...new Set(familyPrices.map(p => p.supplier).filter(Boolean))];
    if (uniqueSuppliers.length > 1) {
      critical.push({
        type: 'MIXED_SUPPLIER_FAMILY',
        familyId: family.id,
        details: `Família "${family.name_original}" possui SKUs de ${uniqueSuppliers.length} fornecedores: ${uniqueSuppliers.join(', ')}`,
        affectedSkus: familyPrices.map(p => p.erp_code),
      });
    }

    // ─── Check 8: SKU_NULL_CLINICAL_TYPE ──────────────────────
    const nullClinicalSkus = familyPrices.filter(p => !getSkuClinicalType(p));
    if (nullClinicalSkus.length > 0) {
      critical.push({
        type: 'SKU_NULL_CLINICAL_TYPE',
        familyId: family.id,
        details: `${nullClinicalSkus.length} SKU(s) sem clinical_type na família "${family.name_original}"`,
        affectedSkus: nullClinicalSkus.slice(0, 20).map(p => p.erp_code),
      });
    }

    // ─── Check 2: MIXED_PRODUCT_KIND ──────────────────────────
    const skuClinicals = familyPrices
      .map(p => getSkuClinicalType(p))
      .filter(Boolean) as string[];
    const uniqueClinicals = [...new Set(skuClinicals)];
    
    if (uniqueClinicals.length > 1) {
      // Check if they're fundamentally incompatible (e.g. MONOFOCAL + PROGRESSIVA)
      const groups = new Set(uniqueClinicals.map(c => {
        if (c === 'MONOFOCAL') return 'SV';
        if (c === 'PROGRESSIVA' || c === 'OCUPACIONAL') return 'MULTI';
        return c;
      }));
      
      if (groups.size > 1) {
        critical.push({
          type: 'MIXED_PRODUCT_KIND',
          familyId: family.id,
          details: `Família "${family.name_original}" mistura tipos incompatíveis: ${uniqueClinicals.join(', ')}`,
          affectedSkus: familyPrices.map(p => p.erp_code),
        });
      } else {
        warnings.push({
          type: 'MIXED_PRODUCT_KIND',
          familyId: family.id,
          details: `Família "${family.name_original}" tem variantes: ${uniqueClinicals.join(', ')}`,
        });
      }
    }

    // ─── Check 3: CLINICAL_TYPE_MISMATCH ──────────────────────
    if (familyClinical && skuClinicals.length > 0) {
      const matching = skuClinicals.filter(c => c === familyClinical).length;
      const matchRate = matching / skuClinicals.length;
      
      if (matchRate < 0.8) {
        critical.push({
          type: 'CLINICAL_TYPE_MISMATCH',
          familyId: family.id,
          details: `Família "${family.name_original}" (${familyClinical}): apenas ${Math.round(matchRate * 100)}% dos SKUs convergem`,
        });
      }

      // Auto-fix: if >=85% converge to a DIFFERENT type, suggest fix
      if (matchRate < 0.85 && uniqueClinicals.length > 0) {
        const counts = new Map<string, number>();
        skuClinicals.forEach(c => counts.set(c, (counts.get(c) || 0) + 1));
        const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        const dominantRate = dominant[1] / skuClinicals.length;
        
        if (dominantRate >= 0.85 && dominant[0] !== familyClinical) {
          autoFixes.push({
            type: 'CLINICAL_TYPE_FIX',
            familyId: family.id,
            field: 'clinical_type',
            currentValue: familyClinical,
            suggestedValue: dominant[0],
            confidence: dominantRate,
            description: `Ajustar clinical_type de "${familyClinical}" para "${dominant[0]}" (${Math.round(dominantRate * 100)}% dos SKUs convergem)`,
          });
        }
      }
    }

    // ─── Check 9: SKU_MISSING_ESSENTIAL_RANGE ─────────────────
    const activeMissingRange = activePrices.filter(p => {
      const specs = p.specs;
      if (!specs) return true;
      return (specs.sphere_min === 0 && specs.sphere_max === 0) ||
             (specs.cyl_min === 0 && specs.cyl_max === 0);
    });
    
    if (activeMissingRange.length > 0) {
      critical.push({
        type: 'SKU_MISSING_ESSENTIAL_RANGE',
        familyId: family.id,
        details: `${activeMissingRange.length} SKU(s) ativo(s) sem range essencial (esfera/cilindro) na família "${family.name_original}"`,
        affectedSkus: activeMissingRange.slice(0, 20).map(p => p.erp_code),
      });
    }

    // ─── Auto-fix: product_kind convergence (100%) ────────────
    if (uniqueClinicals.length === 1 && familyClinical !== uniqueClinicals[0]) {
      autoFixes.push({
        type: 'PRODUCT_KIND_FIX',
        familyId: family.id,
        field: 'clinical_type',
        currentValue: familyClinical,
        suggestedValue: uniqueClinicals[0],
        confidence: 1.0,
        description: `Ajustar clinical_type para "${uniqueClinicals[0]}" (100% dos SKUs convergem)`,
      });
    }
  }

  // ─── Check 5: INCOMPATIBLE_TECHNOLOGY ───────────────────────
  if (technologyLibrary?.items) {
    for (const family of families) {
      const techRefs = family.technology_refs || [];
      if (techRefs.length === 0) continue;
      
      const familyClinical = getFamilyClinicalType(family);
      if (!familyClinical) continue;

      for (const techId of techRefs) {
        const tech = technologyLibrary.items[techId];
        if (!tech) continue;
        
        // Check group-based incompatibility
        const group = tech.group?.toUpperCase();
        if (group === 'PROGRESSIVE' && familyClinical === 'MONOFOCAL') {
          critical.push({
            type: 'INCOMPATIBLE_TECHNOLOGY',
            familyId: family.id,
            details: `Tecnologia "${tech.name_common}" (grupo: Progressive) associada à família monofocal "${family.name_original}"`,
          });
          
          autoFixes.push({
            type: 'REMOVE_INCOMPATIBLE_TECH',
            familyId: family.id,
            field: 'technology_refs',
            currentValue: techId,
            suggestedValue: 'REMOVE',
            confidence: 1.0,
            description: `Remover tecnologia "${tech.name_common}" incompatível com família monofocal`,
          });
        }
      }
    }
  }

  return {
    critical,
    warnings,
    autoFixes,
    summary: {
      totalCritical: critical.length,
      totalWarnings: warnings.length,
      totalAutoFixes: autoFixes.length,
      canPublish: critical.length === 0,
    },
  };
}
