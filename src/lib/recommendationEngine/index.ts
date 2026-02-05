/**
 * Recommendation Engine - Motor de Recomendação Óptica
 * 
 * Implementação do Blueprint Oficial seguindo 5 camadas:
 * 1. Catalog Layer (dados do catálogo)
 * 2. Clinical Engine (score clínico - 60%)
 * 3. Commercial Engine (score comercial - 40%)
 * 4. Narrative Engine (a ser implementado Sprint 3)
 * 5. UX Layer (a ser implementado Sprint 2)
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

// Re-export individual engines
export { calculateClinicalScore, isClinicallyEligible } from './clinicalEngine';
export { calculateCommercialScore, isCommerciallyViable } from './commercialEngine';
export { determineTierKey, SCORE_WEIGHTS } from './recommendationScorer';
export { organizeTiersWithFallback, hasCompleteLadder, listFallbacks } from './fallbackStrategy';
export { createAuditLog, getRecentAuditLogs, logRecommendationSummary } from './auditLogger';

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
};
