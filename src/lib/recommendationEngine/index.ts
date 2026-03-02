/**
 * Recommendation Engine - Motor de Recomendação Óptica (Phase 4: SKU-first)
 * 
 * Pipeline:
 * SKUs → isSkuEligibleForRx → eligibleFamilies
 *   → TierScore global (price median + tech percentile)
 *   → tier_assigned (runtime only)
 *   → StoreBoost (ranking within tier, cap 15)
 *   → 1 winner/tier + similares list
 */

import type { ClinicalType, Technology, FamilyExtended } from '@/types/lens';
import type { 
  RecommendationInput, 
  RecommendationResult,
  TierKey,
  ScoredFamily,
  TierRecommendation,
} from './types';

// Re-export types
export * from './types';

// Import engines
import { calculateClinicalScore, isClinicallyEligible } from './clinicalEngine';
import { calculateCommercialScore, isCommerciallyViable } from './commercialEngine';
import { 
  calculateRecommendationScore, 
  scoreFamilyComplete, 
  scoreAndRankFamilies,
  determineTierKey,
  SCORE_WEIGHTS 
} from './recommendationScorer';
import { 
  organizeTiersWithFallback, 
  countFallbackTiers, 
  hasCompleteLadder,
  listFallbacks 
} from './fallbackStrategy';
import { 
  createAuditLog, 
  getRecentAuditLogs, 
  logRecommendationSummary 
} from './auditLogger';
import {
  generateNarratives,
  generateFamilyNarrative,
  generateTierComparison,
  generateOpeningScript,
  generateClosingScript,
} from './narrativeEngine';

// Re-export SKU eligibility
export { isSkuEligibleForRx, getEligibleSkusAndFamilies } from './skuEligibility';
export type { EligibilityFunnel, EligibilityOutput, SkuEligibilityResult } from './skuEligibility';

// Re-export clinical utilities
export { calcRequiredDiameter } from '@/lib/clinical/calcRequiredDiameter';
export { resolveProductKind } from '@/lib/clinical/resolveProductKind';
export { computeClinicalFitScore } from '@/lib/clinical/computeClinicalFitScore';

// Re-export individual engines
export { calculateClinicalScore, isClinicallyEligible } from './clinicalEngine';
export { calculateCommercialScore, isCommerciallyViable } from './commercialEngine';
export { determineTierKey, SCORE_WEIGHTS } from './recommendationScorer';
export { organizeTiersWithFallback, hasCompleteLadder, listFallbacks } from './fallbackStrategy';
export { createAuditLog, getRecentAuditLogs, logRecommendationSummary } from './auditLogger';

// Re-export narrative engine
export {
  generateNarratives,
  generateFamilyNarrative,
  generateTierComparison,
  generateOpeningScript,
  generateClosingScript,
} from './narrativeEngine';
export type { 
  ConsultativeNarrative, 
  TierComparison, 
  NarrativeResult 
} from './narrativeEngine';

// ============================================
// MAIN RECOMMENDATION FUNCTION
// ============================================

/**
 * Executa o motor de recomendação completo (Phase 4: SKU-first pipeline)
 */
export function generateRecommendations(input: RecommendationInput): RecommendationResult {
  const startTime = Date.now();
  
  // Convert technology library
  const techLib: Record<string, Technology> = {};
  if (input.technologyLibrary) {
    Object.entries(input.technologyLibrary).forEach(([key, value]) => {
      techLib[key] = value;
    });
  }

  // Phase 4: Use SKU-first scoring pipeline
  const { scoredFamilies: allScored, eligibility } = scoreAndRankFamilies(
    input.families,
    input.prices,
    input.anamnesis,
    input.prescription,
    techLib,
    input.supplierPriorities,
    input.macros,
    input.clinicalType,
    input.frame, // frame measurements for diameter/height gates
    input.storePriorities // store-level priorities
  );

  // Apply optional price filters
  let finalFamilies = allScored;
  
  if (input.filters?.suppliers?.length) {
    finalFamilies = finalFamilies.filter(sf => 
      input.filters!.suppliers!.includes(sf.family.supplier)
    );
  }
  
  if (input.filters?.excludeFamilyIds?.length) {
    finalFamilies = finalFamilies.filter(sf => 
      !input.filters!.excludeFamilyIds!.includes(sf.family.id)
    );
  }
  
  if (input.filters?.minPrice !== undefined) {
    finalFamilies = finalFamilies.filter(sf => 
      sf.startingPrice === null || sf.startingPrice >= input.filters!.minPrice!
    );
  }
  
  if (input.filters?.maxPrice !== undefined) {
    finalFamilies = finalFamilies.filter(sf => 
      sf.startingPrice === null || sf.startingPrice <= input.filters!.maxPrice!
    );
  }

  // Organize into 4 tiers with fallback
  const tiers = organizeTiersWithFallback(finalFamilies);
  
  // Find top recommendation (by adjustedScore)
  const eligibleFamilies = finalFamilies.filter(sf => sf.score.isEligible);
  const topRecommendation = eligibleFamilies.length > 0
    ? eligibleFamilies.reduce((best, current) => 
        current.score.adjustedScore > best.score.adjustedScore ? current : best
      )
    : null;
  
  // Stats
  const stats = {
    totalFamiliesAnalyzed: input.families.filter(f => {
      const ct = f.clinical_type || f.category;
      return ct === input.clinicalType && f.active !== false;
    }).length,
    totalEligible: eligibleFamilies.length,
    totalWithFallback: countFallbackTiers(tiers),
    averageScore: eligibleFamilies.length > 0
      ? eligibleFamilies.reduce((sum, sf) => sum + sf.score.final, 0) / eligibleFamilies.length
      : 0,
  };

  // Strict mode block check
  const isStrictBlocked = input.clinicalEligibilityMode === 'strict' && eligibleFamilies.length === 0 && stats.totalFamiliesAnalyzed > 0;

  // Audit
  const auditId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const auditLog = createAuditLog(input, finalFamilies, tiers);
  logRecommendationSummary(finalFamilies, tiers);
  
  const endTime = Date.now();
  console.log(`[RecommendationEngine] Completed in ${endTime - startTime}ms | Funnel: ${eligibility.funnelCounts.totalSkus} SKUs → ${eligibility.funnelCounts.finalEligible} eligible → ${eligibleFamilies.length} families`);
  
  return {
    clinicalType: input.clinicalType,
    tiers,
    topRecommendation,
    stats,
    timestamp: Date.now(),
    auditId: auditLog.auditId,
    strictModeBlocked: isStrictBlocked,
    strictModeBlockReason: isStrictBlocked ? 'Sem opções compatíveis com a receita — todos os SKUs elegíveis dependem de Safe Defaults (modo estrito ativo)' : undefined,
    eligibilityFunnel: eligibility.funnelCounts,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function updateRecommendationsWithFilters(
  previousResult: RecommendationResult,
  input: RecommendationInput
): RecommendationResult {
  return generateRecommendations(input);
}

export function isEngineReady(input: Partial<RecommendationInput>): {
  ready: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!input.families || input.families.length === 0) missing.push('families');
  if (!input.prices || input.prices.length === 0) missing.push('prices');
  if (!input.anamnesis) missing.push('anamnesis');
  if (!input.clinicalType) missing.push('clinicalType');
  return { ready: missing.length === 0, missing };
}

export default {
  generateRecommendations,
  updateRecommendationsWithFilters,
  isEngineReady,
  clinical: { calculateClinicalScore, isClinicallyEligible },
  commercial: { calculateCommercialScore, isCommerciallyViable },
  scoring: { calculateRecommendationScore, scoreFamilyComplete, scoreAndRankFamilies, determineTierKey, SCORE_WEIGHTS },
  fallback: { organizeTiersWithFallback, countFallbackTiers, hasCompleteLadder, listFallbacks },
  audit: { createAuditLog, getRecentAuditLogs, logRecommendationSummary },
  narrative: { generateNarratives, generateFamilyNarrative, generateTierComparison, generateOpeningScript, generateClosingScript },
};
