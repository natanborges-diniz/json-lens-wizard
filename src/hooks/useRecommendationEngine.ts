/**
 * useRecommendationEngine - Hook para integrar o motor de recomendação
 * 
 * Centraliza a lógica de geração de recomendações usando o novo engine.
 * Fornece:
 * - Recomendações por tier com scores
 * - Top recommendation
 * - Estatísticas
 * - Logs de auditoria
 */

import { useMemo, useEffect, useState } from 'react';
import { 
  generateRecommendations, 
  type RecommendationInput,
  type RecommendationResult,
  type ScoredFamily,
  type TierKey,
  type TierRecommendation,
} from '@/lib/recommendationEngine';
import type { 
  Family, 
  Price, 
  Addon, 
  Tier, 
  AnamnesisData, 
  Prescription, 
  ClinicalType,
  Technology,
  FamilyExtended,
  LensData,
} from '@/types/lens';
import { supabase } from '@/integrations/supabase/client';

interface UseRecommendationEngineProps {
  lensData: LensData | null;
  lensCategory: ClinicalType;
  anamnesisData?: AnamnesisData;
  prescriptionData?: Partial<Prescription>;
  filters?: {
    suppliers?: string[];
    excludeFamilyIds?: string[];
    minPrice?: number;
    maxPrice?: number;
  };
}

interface FamilyWithScore {
  family: Family;
  bestPrice: Price | null;
  allPrices: Price[];
  tier: Tier;
  score: number;
  scoredFamily: ScoredFamily;
}

interface UseRecommendationEngineResult {
  recommendations: Record<Tier, FamilyWithScore[]>;
  topRecommendationId: string | null;
  stats: {
    totalFamiliesAnalyzed: number;
    totalEligible: number;
    totalWithFallback: number;
    averageScore: number;
  };
  isReady: boolean;
  engineResult: RecommendationResult | null;
}

export function useRecommendationEngine({
  lensData,
  lensCategory,
  anamnesisData,
  prescriptionData,
  filters,
}: UseRecommendationEngineProps): UseRecommendationEngineResult {
  
  // Load supplier priorities from company settings
  const [supplierPriorities, setSupplierPriorities] = useState<string[]>([]);
  
  useEffect(() => {
    supabase
      .from('company_settings')
      .select('supplier_priorities')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.supplier_priorities && Array.isArray(data.supplier_priorities)) {
          setSupplierPriorities(data.supplier_priorities as string[]);
        }
      });
  }, []);
  
  // Default anamnesis if not provided
  const defaultAnamnesis: AnamnesisData = {
    primaryUse: 'mixed',
    screenHours: '3-5',
    nightDriving: 'sometimes',
    visualComplaints: [],
    outdoorTime: 'no',
    clearLensPreference: 'indifferent',
    aestheticPriority: 'medium',
  };

  const effectiveAnamnesis = anamnesisData || defaultAnamnesis;
  const effectivePrescription = prescriptionData || {};

  // Run the recommendation engine
  const { engineResult, recommendations, topRecommendationId, isReady } = useMemo(() => {
    if (!lensData || !lensData.families.length || !lensData.prices.length) {
      return {
        engineResult: null,
        recommendations: {
          essential: [],
          comfort: [],
          advanced: [],
          top: [],
        } as Record<Tier, FamilyWithScore[]>,
        topRecommendationId: null,
        isReady: false,
      };
    }

    // Prepare input for the engine
    const input: RecommendationInput = {
      clinicalType: lensCategory,
      anamnesis: effectiveAnamnesis,
      prescription: effectivePrescription,
      families: lensData.families as FamilyExtended[],
      prices: lensData.prices,
      technologyLibrary: lensData.technology_library 
        ? Object.fromEntries(Object.entries(lensData.technology_library)) as Record<string, Technology>
        : {},
      filters: filters,
      supplierPriorities,
    };

    // Generate recommendations
    const result = generateRecommendations(input);

    // Convert to legacy format for backward compatibility
    const legacyRecommendations: Record<Tier, FamilyWithScore[]> = {
      essential: [],
      comfort: [],
      advanced: [],
      top: [],
    };

    // Process each tier
    const tierKeys: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];
    
    tierKeys.forEach(tierKey => {
      const tierRec = result.tiers[tierKey];
      if (!tierRec) return;

      const familiesForTier: FamilyWithScore[] = [];

      // Add primary if exists
      if (tierRec.primary) {
        familiesForTier.push(convertScoredFamily(tierRec.primary, tierKey));
      }

      // Add alternatives
      tierRec.alternatives.forEach(sf => {
        familiesForTier.push(convertScoredFamily(sf, tierKey));
      });

      legacyRecommendations[tierKey] = familiesForTier;
    });

    return {
      engineResult: result,
      recommendations: legacyRecommendations,
      topRecommendationId: result.topRecommendation?.family.id || null,
      isReady: true,
    };
  }, [lensData, lensCategory, effectiveAnamnesis, effectivePrescription, filters, supplierPriorities]);

  const stats = engineResult?.stats || {
    totalFamiliesAnalyzed: 0,
    totalEligible: 0,
    totalWithFallback: 0,
    averageScore: 0,
  };

  return {
    recommendations,
    topRecommendationId,
    stats,
    isReady,
    engineResult,
  };
}

// Helper to convert ScoredFamily to legacy format
function convertScoredFamily(sf: ScoredFamily, tier: TierKey): FamilyWithScore {
  return {
    family: sf.family as Family,
    bestPrice: sf.compatiblePrices.length > 0 
      ? sf.compatiblePrices.reduce((min, p) => 
          p.price_sale_half_pair < min.price_sale_half_pair ? p : min
        )
      : null,
    allPrices: sf.compatiblePrices,
    tier: tier as Tier,
    score: sf.score.final,
    scoredFamily: sf,
  };
}

export default useRecommendationEngine;
