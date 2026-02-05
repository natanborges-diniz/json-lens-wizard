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

/** Estratégias de fallback por tier */
const FALLBACK_STRATEGIES: Record<TierKey, TierKey[]> = {
  essential: ['comfort', 'advanced', 'top'],      // Busca para cima
  comfort: ['essential', 'advanced', 'top'],      // Busca para baixo primeiro
  advanced: ['comfort', 'top', 'essential'],      // Busca adjacentes
  top: ['advanced', 'comfort', 'essential'],      // Busca para baixo
};

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
 * Aplica fallback para um tier vazio
 */
function applyFallbackForTier(
  tierKey: TierKey,
  allFamilies: ScoredFamily[]
): { 
  primary: ScoredFamily | null; 
  isFallback: boolean; 
  fallbackReason?: string 
} {
  const strategies = FALLBACK_STRATEGIES[tierKey];
  
  // Estratégia 1: Buscar em tiers adjacentes
  for (const fallbackTier of strategies) {
    const eligible = getEligibleFamilies(allFamilies, fallbackTier);
    if (eligible.length > 0) {
      const best = findBestFamily(eligible);
      if (best) {
        return {
          primary: best,
          isFallback: true,
          fallbackReason: `Produto do tier "${fallbackTier}" exibido como opção para "${tierKey}"`,
        };
      }
    }
  }
  
  // Estratégia 2: Relaxar critérios no próprio tier
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
  
  // Estratégia 3: Buscar em qualquer tier com critérios relaxados
  for (const fallbackTier of strategies) {
    const relaxed = getRelaxedFamilies(allFamilies, fallbackTier);
    if (relaxed.length > 0) {
      const best = findBestFamily(relaxed);
      if (best) {
        return {
          primary: best,
          isFallback: true,
          fallbackReason: `Produto de "${fallbackTier}" (critérios relaxados) para "${tierKey}"`,
        };
      }
    }
  }
  
  // Nenhum fallback possível
  return {
    primary: null,
    isFallback: true,
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
