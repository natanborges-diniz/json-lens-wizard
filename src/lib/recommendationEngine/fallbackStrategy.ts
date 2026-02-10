/**
 * Fallback Strategy - Garante sempre 4 níveis na escada
 * 
 * Se um tier não tiver famílias elegíveis, aplica estratégias de fallback:
 * 1. Buscar família do tier adjacente (inferior primeiro, depois superior)
 * 2. Relaxar critérios de elegibilidade
 * 3. Marcar como fallback para transparência
 */

import type { 
  ScoredFamily, 
  TierRecommendation, 
  TierKey
} from './types';

// ============================================
// CONSTANTS
// ============================================

const TIER_ORDER: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];

// REMOVED: FALLBACK_STRATEGIES cross-tier lookup (PLAN 3 §4.3)
// Fallback NEVER promotes families from other tiers.
// Only relaxes eligibility within the SAME tier, or marks as unavailable.

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Filtra famílias elegíveis de um tier
 */
function getEligibleFamilies(
  families: ScoredFamily[],
  tierKey: TierKey
): ScoredFamily[] {
  return families.filter(f => 
    f.score.tierKey === tierKey && 
    f.score.isEligible &&
    f.startingPrice !== null
  );
}

/**
 * Filtra famílias com score relaxado (inclui inelegíveis com preço)
 */
function getRelaxedFamilies(
  families: ScoredFamily[],
  tierKey: TierKey
): ScoredFamily[] {
  return families.filter(f => 
    f.score.tierKey === tierKey && 
    f.startingPrice !== null
  );
}

/**
 * Encontra a melhor família de um tier (maior score final)
 */
function findBestFamily(families: ScoredFamily[]): ScoredFamily | null {
  if (families.length === 0) return null;
  
  return families.reduce((best, current) => 
    current.score.final > best.score.final ? current : best
  );
}

/**
 * Aplica fallback para um tier vazio (PLAN 3 §4.3 compliant)
 * ONLY relaxes eligibility within the SAME tier.
 * NEVER promotes families from other tiers.
 */
function applyFallbackForTier(
  tierKey: TierKey,
  allFamilies: ScoredFamily[]
): { 
  primary: ScoredFamily | null; 
  isFallback: boolean; 
  fallbackReason?: string 
} {
  // Only strategy: Relax eligibility criteria within the SAME tier
  const relaxed = getRelaxedFamilies(allFamilies, tierKey);
  if (relaxed.length > 0) {
    const best = findBestFamily(relaxed);
    if (best) {
      return {
        primary: best,
        isFallback: true,
        fallbackReason: `Critérios relaxados para exibir opção em "${tierKey}"`,
      };
    }
  }
  
  // No product available in this tier — mark as unavailable
  return {
    primary: null,
    isFallback: false,
    fallbackReason: `Nenhum produto disponível para "${tierKey}"`,
  };
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Organiza famílias em 4 tiers, aplicando fallback quando necessário
 */
export function organizeTiersWithFallback(
  scoredFamilies: ScoredFamily[]
): Record<TierKey, TierRecommendation> {
  const result: Record<TierKey, TierRecommendation> = {
    essential: { tierKey: 'essential', primary: null, alternatives: [], totalOptions: 0, isFallback: false },
    comfort: { tierKey: 'comfort', primary: null, alternatives: [], totalOptions: 0, isFallback: false },
    advanced: { tierKey: 'advanced', primary: null, alternatives: [], totalOptions: 0, isFallback: false },
    top: { tierKey: 'top', primary: null, alternatives: [], totalOptions: 0, isFallback: false },
  };
  
  // Processar cada tier
  for (const tierKey of TIER_ORDER) {
    const eligible = getEligibleFamilies(scoredFamilies, tierKey);
    
    if (eligible.length > 0) {
      // Tier tem famílias elegíveis - usar normalmente
      const sorted = [...eligible].sort((a, b) => b.score.final - a.score.final);
      
      result[tierKey] = {
        tierKey,
        primary: sorted[0],
        alternatives: sorted.slice(1),
        totalOptions: sorted.length,
        isFallback: false,
      };
    } else {
      // Tier vazio - aplicar fallback
      const fallbackResult = applyFallbackForTier(tierKey, scoredFamilies);
      
      result[tierKey] = {
        tierKey,
        primary: fallbackResult.primary,
        alternatives: [],
        totalOptions: fallbackResult.primary ? 1 : 0,
        isFallback: fallbackResult.isFallback,
        fallbackReason: fallbackResult.fallbackReason,
      };
    }
  }
  
  return result;
}

/**
 * Verifica quantos tiers têm fallback
 */
export function countFallbackTiers(
  tiers: Record<TierKey, TierRecommendation>
): number {
  return TIER_ORDER.filter(t => tiers[t].isFallback).length;
}

/**
 * Verifica se todos os 4 tiers têm pelo menos uma opção
 */
export function hasCompleteLadder(
  tiers: Record<TierKey, TierRecommendation>
): boolean {
  return TIER_ORDER.every(t => tiers[t].primary !== null);
}

/**
 * Lista tiers com fallback e seus motivos
 */
export function listFallbacks(
  tiers: Record<TierKey, TierRecommendation>
): Array<{ tierKey: TierKey; reason: string }> {
  return TIER_ORDER
    .filter(t => tiers[t].isFallback)
    .map(t => ({
      tierKey: t,
      reason: tiers[t].fallbackReason || 'Motivo não especificado',
    }));
}

export default {
  organizeTiersWithFallback,
  countFallbackTiers,
  hasCompleteLadder,
  listFallbacks,
  TIER_ORDER,
};
