/**
 * Recommendation Engine - Motor de Recomendação Óptica
 * 
 * Implementação do Blueprint Oficial seguindo 5 camadas:
 * 1. Catalog Layer (dados do catálogo)
 * 2. Clinical Engine (score clínico - 60%)
 * 3. Commercial Engine (score comercial - 40%)
 * 4. Narrative Engine (Sprint 3 - IMPLEMENTADO)
 * 5. UX Layer (Sprint 2 - IMPLEMENTADO)
 * 
 * Fórmula oficial:
 * final_score = (clinical_score * 0.60) + (commercial_score * 0.40)
 */

import type { ClinicalType, Technology } from '@/types/lens';
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

// Re-export individual engines
export { calculateClinicalScore, isClinicallyEligible } from './clinicalEngine';
export { calculateCommercialScore, isCommerciallyViable } from './commercialEngine';
export { determineTierKey, SCORE_WEIGHTS } from './recommendationScorer';
export { organizeTiersWithFallback, hasCompleteLadder, listFallbacks } from './fallbackStrategy';
export { createAuditLog, getRecentAuditLogs, logRecommendationSummary } from './auditLogger';

// Re-export narrative engine (Sprint 3)
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
// TIER REBALANCING BY PRICE QUARTILE
// ============================================

/**
 * Reclassifica famílias por quartil de preço quando a classificação por metadata
 * está desequilibrada (>70% das famílias num único tier).
 * 
 * Isso resolve o problema de catálogos onde tier_target está ausente/incorreto,
 * garantindo que a escada de valor tenha preços ascendentes.
 */
function rebalanceTiersByPrice(families: ScoredFamily[]): ScoredFamily[] {
  const withPrice = families.filter(f => f.startingPrice !== null && f.startingPrice > 0);
  if (withPrice.length < 4) return families;
  
  // Check for price inversions: get median price per tier
  const tierOrder: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];
  const tierMedians: Record<TierKey, number> = { essential: 0, comfort: 0, advanced: 0, top: 0 };
  const tierFamilyCounts: Record<TierKey, number> = { essential: 0, comfort: 0, advanced: 0, top: 0 };
  
  tierOrder.forEach(tier => {
    const tierPrices = withPrice
      .filter(f => f.score.tierKey === tier)
      .map(f => f.startingPrice!)
      .sort((a, b) => a - b);
    
    tierFamilyCounts[tier] = tierPrices.length;
    if (tierPrices.length > 0) {
      tierMedians[tier] = tierPrices[Math.floor(tierPrices.length / 2)];
    }
  });
  
  // Detect inversions: check if higher tiers have lower median prices
  let hasInversion = false;
  const activeTiers = tierOrder.filter(t => tierFamilyCounts[t] > 0);
  
  for (let i = 0; i < activeTiers.length - 1; i++) {
    if (tierMedians[activeTiers[i]] > tierMedians[activeTiers[i + 1]] && tierMedians[activeTiers[i + 1]] > 0) {
      hasInversion = true;
      console.warn(`[RecommendationEngine] Price inversion: ${activeTiers[i]} median R$${tierMedians[activeTiers[i]]} > ${activeTiers[i+1]} median R$${tierMedians[activeTiers[i+1]]}`);
    }
  }
  
  // Also check: >70% in one tier
  const maxTierCount = Math.max(...Object.values(tierFamilyCounts));
  const isImbalanced = maxTierCount / withPrice.length > 0.70;
  
  if (!hasInversion && !isImbalanced) {
    console.log('[RecommendationEngine] Tier distribution balanced, no rebalancing needed');
    return families;
  }
  
  console.warn(`[RecommendationEngine] Applying price-based quartile rebalancing (inversion=${hasInversion}, imbalance=${isImbalanced})`);
  
  // Sort ALL priced families by price ascending
  const sorted = [...withPrice].sort((a, b) => (a.startingPrice || 0) - (b.startingPrice || 0));
  
  // Assign to quartiles
  const q1 = Math.floor(sorted.length * 0.25);
  const q2 = Math.floor(sorted.length * 0.50);
  const q3 = Math.floor(sorted.length * 0.75);
  
  sorted.forEach((sf, idx) => {
    let newTier: TierKey;
    if (idx < q1) newTier = 'essential';
    else if (idx < q2) newTier = 'comfort';
    else if (idx < q3) newTier = 'advanced';
    else newTier = 'top';
    
    sf.score.tierKey = newTier;
  });
  
  // Re-rank within each tier
  const byTier: Record<TierKey, ScoredFamily[]> = { essential: [], comfort: [], advanced: [], top: [] };
  sorted.forEach(sf => byTier[sf.score.tierKey].push(sf));
  Object.values(byTier).forEach(tierFams => {
    tierFams.sort((a, b) => b.score.final - a.score.final);
    tierFams.forEach((sf, idx) => { sf.score.rankInTier = idx + 1; });
  });
  
  const newCounts = Object.entries(byTier).map(([k, v]) => `${k}:${v.length}`).join(', ');
  console.log(`[RecommendationEngine] Rebalanced tiers: ${newCounts}`);
  
  const withoutPrice = families.filter(f => f.startingPrice === null || f.startingPrice === 0);
  return [...sorted, ...withoutPrice];
}

// ============================================
// MAIN RECOMMENDATION FUNCTION
// ============================================

/**
 * Executa o motor de recomendação completo
 * 
 * @param input - Dados de entrada (famílias, preços, anamnese, receita)
 * @returns Resultado completo com 4 tiers e estatísticas
 */
export function generateRecommendations(input: RecommendationInput): RecommendationResult {
  const startTime = Date.now();
  
  // 1. Filtrar famílias pelo tipo clínico
  const relevantFamilies = input.families.filter(f => {
    const category = (f as any).clinical_type || f.category;
    return category === input.clinicalType && f.active !== false;
  });
  
  // Aplicar filtros opcionais
  let filteredFamilies = relevantFamilies;
  
  if (input.filters?.suppliers?.length) {
    filteredFamilies = filteredFamilies.filter(f => 
      input.filters!.suppliers!.includes(f.supplier)
    );
  }
  
  if (input.filters?.excludeFamilyIds?.length) {
    filteredFamilies = filteredFamilies.filter(f => 
      !input.filters!.excludeFamilyIds!.includes(f.id)
    );
  }
  
  // 2. Converter technology library para formato esperado
  const techLib: Record<string, Technology> = {};
  if (input.technologyLibrary) {
    Object.entries(input.technologyLibrary).forEach(([key, value]) => {
      techLib[key] = value;
    });
  }
  
  // 3. Calcular scores para todas as famílias
  const scoredFamilies = scoreAndRankFamilies(
    filteredFamilies,
    input.prices,
    input.anamnesis,
    input.prescription,
    techLib
  );
  
  // 4. Aplicar filtros de preço (pós-score)
  let finalFamilies = scoredFamilies;
  
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
  
  // 4.5. Reclassificar tiers por quartil de preço se metadata estiver desequilibrada
  finalFamilies = rebalanceTiersByPrice(finalFamilies);
  
  // 5. Organizar em 4 tiers com fallback
  const tiers = organizeTiersWithFallback(finalFamilies);
  
  // 6. Encontrar top recommendation
  const eligibleFamilies = finalFamilies.filter(sf => sf.score.isEligible);
  const topRecommendation = eligibleFamilies.length > 0
    ? eligibleFamilies.reduce((best, current) => 
        current.score.final > best.score.final ? current : best
      )
    : null;
  
  // 7. Calcular estatísticas
  const stats = {
    totalFamiliesAnalyzed: filteredFamilies.length,
    totalEligible: eligibleFamilies.length,
    totalWithFallback: countFallbackTiers(tiers),
    averageScore: eligibleFamilies.length > 0
      ? eligibleFamilies.reduce((sum, sf) => sum + sf.score.final, 0) / eligibleFamilies.length
      : 0,
  };
  
  // 8. Gerar ID de auditoria
  const auditId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // 9. Criar log de auditoria
  const auditLog = createAuditLog(input, finalFamilies, tiers);
  
  // 10. Log resumido no console
  logRecommendationSummary(finalFamilies, tiers);
  
  const endTime = Date.now();
  console.log(`[RecommendationEngine] Completed in ${endTime - startTime}ms`);
  
  return {
    clinicalType: input.clinicalType,
    tiers,
    topRecommendation,
    stats,
    timestamp: Date.now(),
    auditId: auditLog.auditId,
  };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Recalcula recomendações quando filtros mudam
 */
export function updateRecommendationsWithFilters(
  previousResult: RecommendationResult,
  input: RecommendationInput
): RecommendationResult {
  return generateRecommendations(input);
}

/**
 * Verifica se o motor está pronto para uso
 */
export function isEngineReady(input: Partial<RecommendationInput>): {
  ready: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  
  if (!input.families || input.families.length === 0) {
    missing.push('families');
  }
  
  if (!input.prices || input.prices.length === 0) {
    missing.push('prices');
  }
  
  if (!input.anamnesis) {
    missing.push('anamnesis');
  }
  
  if (!input.clinicalType) {
    missing.push('clinicalType');
  }
  
  return {
    ready: missing.length === 0,
    missing,
  };
}

// ============================================
// DEFAULT EXPORT
// ============================================

export default {
  generateRecommendations,
  updateRecommendationsWithFilters,
  isEngineReady,
  
  // Sub-modules
  clinical: {
    calculateClinicalScore,
    isClinicallyEligible,
  },
  commercial: {
    calculateCommercialScore,
    isCommerciallyViable,
  },
  scoring: {
    calculateRecommendationScore,
    scoreFamilyComplete,
    scoreAndRankFamilies,
    determineTierKey,
    SCORE_WEIGHTS,
  },
  fallback: {
    organizeTiersWithFallback,
    countFallbackTiers,
    hasCompleteLadder,
    listFallbacks,
  },
  audit: {
    createAuditLog,
    getRecentAuditLogs,
    logRecommendationSummary,
  },
  // Narrative Engine (Sprint 3)
  narrative: {
    generateNarratives,
    generateFamilyNarrative,
    generateTierComparison,
    generateOpeningScript,
    generateClosingScript,
  },
};
