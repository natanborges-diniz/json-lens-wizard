/**
 * useNarrativeEngine - Hook para integrar o motor narrativo
 * 
 * Gera narrativas consultivas e comparações entre níveis
 * baseado no resultado do Recommendation Engine.
 */

import { useMemo } from 'react';
import { 
  generateNarratives, 
  type NarrativeResult,
  type ConsultativeNarrative,
  type TierComparison,
} from '@/lib/recommendationEngine/narrativeEngine';
import type { RecommendationResult, TierKey } from '@/lib/recommendationEngine/types';
import type { AnamnesisData, ClinicalType, Technology } from '@/types/lens';

interface UseNarrativeEngineProps {
  recommendationResult: RecommendationResult | null;
  anamnesis: AnamnesisData;
  clinicalType: ClinicalType;
  technologyLibrary?: Record<string, Technology>;
}

interface UseNarrativeEngineResult {
  /** Resultado completo do motor narrativo */
  narrativeResult: NarrativeResult | null;
  
  /** Narrativa para uma família específica */
  getNarrativeForFamily: (familyId: string) => ConsultativeNarrative | null;
  
  /** Comparações entre tiers */
  tierComparisons: TierComparison[];
  
  /** Script de abertura */
  openingScript: string;
  
  /** Script de fechamento */
  closingScript: string;
  
  /** Top recommendation narrative */
  topNarrative: ConsultativeNarrative | null;
  
  /** Indica se está pronto */
  isReady: boolean;
}

export function useNarrativeEngine({
  recommendationResult,
  anamnesis,
  clinicalType,
  technologyLibrary = {},
}: UseNarrativeEngineProps): UseNarrativeEngineResult {
  
  const narrativeResult = useMemo(() => {
    if (!recommendationResult) {
      return null;
    }

    return generateNarratives(
      recommendationResult.tiers,
      anamnesis,
      clinicalType,
      technologyLibrary
    );
  }, [recommendationResult, anamnesis, clinicalType, technologyLibrary]);

  const getNarrativeForFamily = (familyId: string): ConsultativeNarrative | null => {
    if (!narrativeResult) return null;
    return narrativeResult.familyNarratives[familyId] || null;
  };

  return {
    narrativeResult,
    getNarrativeForFamily,
    tierComparisons: narrativeResult?.tierComparisons || [],
    openingScript: narrativeResult?.openingScript || '',
    closingScript: narrativeResult?.closingScript || '',
    topNarrative: narrativeResult?.topRecommendationNarrative || null,
    isReady: narrativeResult !== null,
  };
}

export default useNarrativeEngine;
