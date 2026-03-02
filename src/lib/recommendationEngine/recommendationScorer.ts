/**
 * Recommendation Scorer - SKU-first + Global Tier Assignment
 * 
 * Phase 4: TierScore = 0.6 * PricePercentile + 0.4 * TechPercentile
 * Tiers are assigned at runtime, never persisted to catalog.
 */

import type { FamilyExtended, Price, AnamnesisData, Prescription, Technology, FrameMeasurements } from '@/types/lens';
import type { 
  RecommendationScore, 
  ScoredFamily, 
  TierKey, 
} from './types';
import { calculateClinicalScore, isClinicallyEligible } from './clinicalEngine';
import { calculateCommercialScore, isCommerciallyViable } from './commercialEngine';
import { getEligibleSkusAndFamilies, type EligibilityOutput } from './skuEligibility';
import { computeClinicalFitScore } from '@/lib/clinical/computeClinicalFitScore';
import { resolveProductKind } from '@/lib/clinical/resolveProductKind';

// ============================================
// CONSTANTS
// ============================================

/** Pesos oficiais do Blueprint */
export const SCORE_WEIGHTS = {
  CLINICAL: 0.60,
  COMMERCIAL: 0.40,
};

/** Global tier thresholds based on TierScore percentile */
const TIER_THRESHOLDS: { tier: TierKey; min: number; max: number }[] = [
  { tier: 'essential', min: 0, max: 25 },
  { tier: 'comfort', min: 25, max: 55 },
  { tier: 'advanced', min: 55, max: 80 },
  { tier: 'top', min: 80, max: 100 },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate weighted tech score for a family using technology_library weights.
 * If weight is not defined, default = 1.
 */
function calculateWeightedTechScore(
  family: FamilyExtended,
  technologyLibrary?: Record<string, Technology>
): number {
  const refs = family.technology_refs || [];
  if (refs.length === 0 || !technologyLibrary) return 0;

  let score = 0;
  for (const ref of refs) {
    const tech = technologyLibrary[ref];
    if (tech) {
      score += (tech as any).weight ?? 1;
    }
  }
  return score;
}

/**
 * Calculate median of an array of numbers
 */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Calculate percentile rank of a value within a sorted array
 */
function percentileRank(value: number, allValues: number[]): number {
  if (allValues.length <= 1) return 50;
  const sorted = [...allValues].sort((a, b) => a - b);
  const below = sorted.filter(v => v < value).length;
  const equal = sorted.filter(v => v === value).length;
  return ((below + equal * 0.5) / sorted.length) * 100;
}

/**
 * Assign tier based on TierScore
 */
function assignTierFromScore(tierScore: number): TierKey {
  for (const { tier, min, max } of TIER_THRESHOLDS) {
    if (tierScore >= min && tierScore < max) return tier;
  }
  return 'top'; // score === 100
}

/**
 * Determina o tier de uma família — kept for backward compatibility
 * In Phase 4, this is only used as hint for small pools
 */
export function determineTierKey(
  family: FamilyExtended,
  catalogMacros?: Array<{ id: string; tier_key?: string; category?: string }>
): TierKey {
  // 1. Direct tier_target
  const tierTarget = family.tier_target;
  if (tierTarget && ['essential', 'comfort', 'advanced', 'top'].includes(tierTarget)) {
    return tierTarget as TierKey;
  }
  
  // 2. Via macro tier_key
  if (catalogMacros && catalogMacros.length > 0) {
    const matchingMacro = catalogMacros.find(m => m.id === family.macro);
    if (matchingMacro?.tier_key && ['essential', 'comfort', 'advanced', 'top'].includes(matchingMacro.tier_key)) {
      return matchingMacro.tier_key as TierKey;
    }
  }
  
  return 'essential';
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Calculates clinical+commercial score for a single family.
 * Note: tierKey is set to 'essential' initially; global tier assignment happens in scoreAndRankFamilies.
 */
export function calculateRecommendationScore(
  family: FamilyExtended,
  eligiblePrices: Price[],
  anamnesis: AnamnesisData,
  prescription: Partial<Prescription>,
  technologyLibrary?: Record<string, Technology>,
  supplierPriorities?: string[],
  _catalogMacros?: Array<{ id: string; tier_key?: string; category?: string }>
): RecommendationScore {
  // Placeholder tier — will be overridden by global tier assignment
  const placeholderTier: TierKey = 'essential';
  
  const clinicalScore = calculateClinicalScore(family, eligiblePrices, anamnesis, prescription, placeholderTier);
  const commercialScore = calculateCommercialScore(family, eligiblePrices, placeholderTier, technologyLibrary, undefined); // No supplier priority in base score

  const finalScore = (clinicalScore.total * SCORE_WEIGHTS.CLINICAL) + 
                     (commercialScore.total * SCORE_WEIGHTS.COMMERCIAL);

  const clinicallyEligible = isClinicallyEligible(clinicalScore);
  const commerciallyViable = isCommerciallyViable(commercialScore);
  const isEligible = clinicallyEligible && commerciallyViable;

  let ineligibilityReason: string | undefined;
  if (!clinicallyEligible) {
    ineligibilityReason = clinicalScore.flags.prescriptionIncompatible 
      ? 'Incompatível com a receita' 
      : 'Score clínico insuficiente';
  } else if (!commerciallyViable) {
    ineligibilityReason = 'Sem disponibilidade comercial';
  }

  return {
    final: Math.round(finalScore * 100) / 100,
    clinical: clinicalScore,
    commercial: commercialScore,
    tierKey: placeholderTier,
    rankInTier: 0,
    isEligible,
    ineligibilityReason,
    storeBoost: 0,
    adjustedScore: Math.round(finalScore * 100) / 100,
  };
}

/**
 * Extracts enriched data from a family
 */
function extractFamilyData(
  family: FamilyExtended,
  technologyLibrary?: Record<string, Technology>
): {
  technologies: Technology[];
  salesPills: string[];
  knowledgeConsumer: string | null;
  knowledgeConsultant: string | null;
} {
  const techRefs = family.technology_refs || [];
  const technologies: Technology[] = [];
  
  if (technologyLibrary) {
    techRefs.forEach(ref => {
      if (technologyLibrary[ref]) {
        technologies.push(technologyLibrary[ref]);
      }
    });
  }
  
  const knowledge = (family as any).knowledge || {};
  const salesPills = (family as any).sales_pills || [];
  
  return {
    technologies,
    salesPills,
    knowledgeConsumer: knowledge.consumer || null,
    knowledgeConsultant: knowledge.consultant || null,
  };
}

/**
 * Processa uma família completa com score e dados enriquecidos
 */
export function scoreFamilyComplete(
  family: FamilyExtended,
  eligiblePrices: Price[],
  anamnesis: AnamnesisData,
  prescription: Partial<Prescription>,
  technologyLibrary?: Record<string, Technology>,
  supplierPriorities?: string[],
  catalogMacros?: Array<{ id: string; tier_key?: string; category?: string }>,
  frame?: FrameMeasurements | null
): ScoredFamily {
  const score = calculateRecommendationScore(family, eligiblePrices, anamnesis, prescription, technologyLibrary, supplierPriorities, catalogMacros);
  
  // Starting price = cheapest eligible SKU * 2 (pair)
  const compatiblePrices = eligiblePrices.filter(p => p.family_id === family.id);
  compatiblePrices.sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair);
  const startingPrice = compatiblePrices.length > 0 ? compatiblePrices[0].price_sale_half_pair * 2 : null;
  
  const enrichedData = extractFamilyData(family, technologyLibrary);

  // Compute ClinicalFitScore for eligible SKUs and use best as bonus
  let bestFitScore = 50; // neutral default
  const pd = frame ? { dnpOD: frame.dnpOD, dnpOE: frame.dnpOE, dp: frame.dp } : null;
  for (const sku of compatiblePrices) {
    const fit = computeClinicalFitScore(sku, prescription, frame || null, pd);
    if (fit.score > bestFitScore) bestFitScore = fit.score;
  }

  // Inject clinicalFit bonus into score (0-15 pts)
  const clinicalFitBonus = Math.round((bestFitScore / 100) * 15 * 100) / 100;
  score.clinical.components.clinicalFit = clinicalFitBonus;
  score.clinical.total = Math.round((score.clinical.total + clinicalFitBonus) * 100) / 100;
  // Recalculate final score with updated clinical total
  score.final = Math.round((score.clinical.total * SCORE_WEIGHTS.CLINICAL + score.commercial.total * SCORE_WEIGHTS.COMMERCIAL) * 100) / 100;
  score.adjustedScore = score.final + score.storeBoost;

  // Resolve product kind from cheapest SKU
  const primarySku = compatiblePrices[0];
  const pkResult = primarySku ? resolveProductKind(primarySku, family) : null;
  
  return {
    family,
    score,
    startingPrice,
    compatiblePrices,
    ...enrichedData,
    resolvedClinicalType: family.clinical_type || family.category,
    resolvedProductKind: pkResult?.kind,
    bestFitScore,
  };
}

/**
 * Phase 4: SKU-first scoring + global tier assignment
 * 
 * Pipeline:
 * 1. Get eligible SKUs via skuEligibility
 * 2. Score each eligible family
 * 3. Calculate TierScore (0.6*PricePercentile + 0.4*TechPercentile)
 * 4. Assign tiers globally
 * 5. Apply StoreBoost for ranking within tier
 */
export function scoreAndRankFamilies(
  families: FamilyExtended[],
  prices: Price[],
  anamnesis: AnamnesisData,
  prescription: Partial<Prescription>,
  technologyLibrary?: Record<string, Technology>,
  supplierPriorities?: string[],
  catalogMacros?: Array<{ id: string; tier_key?: string; category?: string }>,
  clinicalType?: string,
  frame?: any,
  storePriorities?: string[]
): { scoredFamilies: ScoredFamily[]; eligibility: EligibilityOutput } {
  
  // Step 1: SKU-first eligibility
  const eligibility = getEligibleSkusAndFamilies(prices, families, prescription, frame, clinicalType);
  
  // Step 2: Score each eligible family
  const scoredFamilies: ScoredFamily[] = [];
  
  eligibility.eligibleFamilies.forEach((eligiblePrices, familyId) => {
    const family = families.find(f => f.id === familyId);
    if (!family || family.active === false) return;
    
    const sf = scoreFamilyComplete(family, eligiblePrices, anamnesis, prescription, technologyLibrary, undefined, catalogMacros, frame as FrameMeasurements | null);
    scoredFamilies.push(sf);
  });

  if (scoredFamilies.length === 0) {
    return { scoredFamilies, eligibility };
  }

  // Step 3: Calculate TierScore for global tier assignment
  // familyPriceMedian and familyTechScore for each family
  const priceMedians: number[] = [];
  const techScores: number[] = [];
  const familyMetrics: Map<string, { priceMedian: number; techScore: number }> = new Map();

  for (const sf of scoredFamilies) {
    const familyPrices = sf.compatiblePrices.map(p => p.price_sale_half_pair).filter(p => p > 0);
    const priceMedian = median(familyPrices);
    const techScore = calculateWeightedTechScore(sf.family as FamilyExtended, technologyLibrary);
    
    priceMedians.push(priceMedian);
    techScores.push(techScore);
    familyMetrics.set(sf.family.id, { priceMedian, techScore });
  }

  // Step 4: Assign tiers globally using percentiles
  for (const sf of scoredFamilies) {
    const metrics = familyMetrics.get(sf.family.id)!;
    const pricePercentile = percentileRank(metrics.priceMedian, priceMedians);
    const techPercentile = percentileRank(metrics.techScore, techScores);
    const tierScore = 0.6 * pricePercentile + 0.4 * techPercentile;
    
    sf.score.tierKey = assignTierFromScore(tierScore);
    sf.score.tierScore = Math.round(tierScore * 100) / 100;
  }

  // Step 5: Apply StoreBoost (supplier priorities from store, then global fallback)
  const effectivePriorities = (storePriorities && storePriorities.length > 0) 
    ? storePriorities 
    : supplierPriorities;

  if (effectivePriorities && effectivePriorities.length > 0) {
    for (const sf of scoredFamilies) {
      const idx = effectivePriorities.indexOf(sf.family.supplier);
      if (idx === -1) {
        sf.score.storeBoost = 0;
      } else {
        // Linear decay: first gets max (10), last gets ~1
        const positionRatio = 1 - (idx / effectivePriorities.length);
        sf.score.storeBoost = Math.min(Math.round(positionRatio * 10 * 100) / 100, 10);
      }
      // Cap accumulated boost at 15
      sf.score.storeBoost = Math.min(sf.score.storeBoost, 15);
      sf.score.adjustedScore = Math.round((sf.score.final + sf.score.storeBoost) * 100) / 100;
    }
  }

  // Step 6: Sort by tier, then by adjustedScore within tier
  const byTier: Record<TierKey, ScoredFamily[]> = {
    essential: [], comfort: [], advanced: [], top: [],
  };

  scoredFamilies.forEach(sf => {
    byTier[sf.score.tierKey].push(sf);
  });

  const tierOrder: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];
  const result: ScoredFamily[] = [];

  tierOrder.forEach(tier => {
    byTier[tier].sort((a, b) => b.score.adjustedScore - a.score.adjustedScore);
    byTier[tier].forEach((sf, idx) => {
      sf.score.rankInTier = idx + 1;
    });
    result.push(...byTier[tier]);
  });

  const tierCounts = tierOrder.map(t => `${t}:${byTier[t].length}`).join(', ');
  console.log(`[RecommendationScorer] Global tier assignment: ${tierCounts} (${scoredFamilies.length} families)`);

  return { scoredFamilies: result, eligibility };
}

export default {
  calculateRecommendationScore,
  scoreFamilyComplete,
  scoreAndRankFamilies,
  determineTierKey,
  SCORE_WEIGHTS,
};
