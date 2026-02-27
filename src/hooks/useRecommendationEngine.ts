/**
 * useRecommendationEngine - Hook para integrar o motor de recomendação (Phase 4: SKU-first)
 */

import { useMemo, useEffect, useState } from 'react';
import { 
  generateRecommendations, 
  type RecommendationInput,
  type RecommendationResult,
  type ScoredFamily,
  type TierKey,
  type TierRecommendation,
  type EligibilityFunnel,
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
import { deriveClinicalTypeFromRx } from '@/lib/deriveClinicalType';

interface UseRecommendationEngineProps {
  lensData: LensData | null;
  lensCategory: ClinicalType;
  anamnesisData?: AnamnesisData;
  prescriptionData?: Partial<Prescription>;
  selectedStoreId?: string | null;
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

interface PipelineDebugInfo {
  catalogLoaded: boolean;
  totalFamilies: number;
  activeFamilies: number;
  familiesWithActivePrices: number;
  eligibleByClinicalType: number;
  countsByTier: Record<string, number>;
  resolvedClinicalType: ClinicalType;
  reasons: string[];
  eligibilityFunnel?: EligibilityFunnel;
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
  supplierPriorities: string[];
  pipelineDebug: PipelineDebugInfo | null;
}

export function useRecommendationEngine({
  lensData,
  lensCategory,
  anamnesisData,
  prescriptionData,
  selectedStoreId,
  filters,
}: UseRecommendationEngineProps): UseRecommendationEngineResult {
  
  // Load global supplier priorities and clinical eligibility mode
  const [supplierPriorities, setSupplierPriorities] = useState<string[]>([]);
  const [clinicalEligibilityMode, setClinicalEligibilityMode] = useState<'permissive' | 'strict'>('permissive');
  const [storePriorities, setStorePriorities] = useState<string[] | null>(null);
  
  // Load company settings
  useEffect(() => {
    supabase
      .from('company_settings')
      .select('supplier_priorities, clinical_eligibility_mode')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.supplier_priorities && Array.isArray(data.supplier_priorities)) {
          setSupplierPriorities(data.supplier_priorities as string[]);
        }
        if ((data as any)?.clinical_eligibility_mode) {
          setClinicalEligibilityMode((data as any).clinical_eligibility_mode as 'permissive' | 'strict');
        }
      });
  }, []);

  // Load store-level priorities (E3)
  useEffect(() => {
    if (!selectedStoreId) {
      setStorePriorities(null);
      return;
    }
    supabase
      .from('stores')
      .select('supplier_priorities')
      .eq('id', selectedStoreId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.supplier_priorities && Array.isArray(data.supplier_priorities) && (data.supplier_priorities as any[]).length > 0) {
          setStorePriorities(data.supplier_priorities as string[]);
        } else {
          setStorePriorities(null);
        }
      });
  }, [selectedStoreId]);
  
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
  const effectiveClinicalType: ClinicalType = lensCategory || deriveClinicalTypeFromRx(effectivePrescription);

  const { engineResult, recommendations, topRecommendationId, isReady, pipelineDebug } = useMemo(() => {
    if (!lensData || !lensData.families.length || !lensData.prices.length) {
      const reasons: string[] = [];
      if (!lensData) reasons.push('Catálogo não carregado');
      else {
        if (!lensData.families.length) reasons.push('Nenhuma família no catálogo');
        if (!lensData.prices.length) reasons.push('Nenhum preço no catálogo');
      }
      return {
        engineResult: null,
        recommendations: { essential: [], comfort: [], advanced: [], top: [] } as Record<Tier, FamilyWithScore[]>,
        topRecommendationId: null,
        isReady: false,
        pipelineDebug: {
          catalogLoaded: !!lensData,
          totalFamilies: lensData?.families.length || 0,
          activeFamilies: 0,
          familiesWithActivePrices: 0,
          eligibleByClinicalType: 0,
          countsByTier: {},
          resolvedClinicalType: effectiveClinicalType,
          reasons,
        } as PipelineDebugInfo,
      };
    }

    const allFams = lensData.families as FamilyExtended[];
    const activeFams = allFams.filter(f => f.active);
    const activePricesFamilyIds = new Set(
      lensData.prices.filter(p => p.active && !p.blocked).map(p => p.family_id)
    );
    const famsWithPrices = activeFams.filter(f => activePricesFamilyIds.has(f.id));
    const eligibleByCT = famsWithPrices.filter(f => {
      const ct = f.clinical_type || f.category;
      return ct === effectiveClinicalType;
    });

    const debugReasons: string[] = [];
    const inactiveFams = allFams.length - activeFams.length;
    if (inactiveFams > 0) debugReasons.push(`${inactiveFams} famílias inativas`);
    const noPriceFams = activeFams.length - famsWithPrices.length;
    if (noPriceFams > 0) debugReasons.push(`${noPriceFams} famílias sem preço ativo`);
    const wrongCT = famsWithPrices.length - eligibleByCT.length;
    if (wrongCT > 0) debugReasons.push(`${wrongCT} famílias com tipo clínico diferente de ${effectiveClinicalType}`);

    const input: RecommendationInput = {
      clinicalType: effectiveClinicalType,
      anamnesis: effectiveAnamnesis,
      prescription: effectivePrescription,
      families: allFams,
      prices: lensData.prices,
      technologyLibrary: lensData.technology_library 
        ? Object.fromEntries(Object.entries(lensData.technology_library)) as Record<string, Technology>
        : {},
      filters,
      supplierPriorities,
      macros: lensData.macros?.map(m => ({ id: m.id, tier_key: m.tier_key, category: m.category })),
      clinicalEligibilityMode,
      storePriorities: storePriorities || undefined,
    };

    const result = generateRecommendations(input);

    // Convert to legacy format
    const legacyRecommendations: Record<Tier, FamilyWithScore[]> = {
      essential: [], comfort: [], advanced: [], top: [],
    };

    const tierKeys: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];
    const countsByTier: Record<string, number> = {};
    
    tierKeys.forEach(tierKey => {
      const tierRec = result.tiers[tierKey];
      if (!tierRec) { countsByTier[tierKey] = 0; return; }

      const familiesForTier: FamilyWithScore[] = [];
      if (tierRec.primary) familiesForTier.push(convertScoredFamily(tierRec.primary, tierKey));
      tierRec.alternatives.forEach(sf => familiesForTier.push(convertScoredFamily(sf, tierKey)));

      legacyRecommendations[tierKey] = familiesForTier;
      countsByTier[tierKey] = familiesForTier.length;
    });

    const totalResults = Object.values(countsByTier).reduce((a, b) => a + b, 0);
    if (totalResults === 0 && eligibleByCT.length > 0) {
      debugReasons.push('Famílias elegíveis existem mas foram filtradas pelo motor (receita fora dos specs?)');
    }

    const debug: PipelineDebugInfo = {
      catalogLoaded: true,
      totalFamilies: allFams.length,
      activeFamilies: activeFams.length,
      familiesWithActivePrices: famsWithPrices.length,
      eligibleByClinicalType: eligibleByCT.length,
      countsByTier,
      resolvedClinicalType: effectiveClinicalType,
      reasons: debugReasons,
      eligibilityFunnel: result.eligibilityFunnel,
    };

    console.log('[RecommendationEngine] Pipeline debug:', debug);

    return {
      engineResult: result,
      recommendations: legacyRecommendations,
      topRecommendationId: result.topRecommendation?.family.id || null,
      isReady: true,
      pipelineDebug: debug,
    };
  }, [lensData, effectiveClinicalType, effectiveAnamnesis, effectivePrescription, filters, supplierPriorities, clinicalEligibilityMode, storePriorities]);

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
    supplierPriorities,
    pipelineDebug,
  };
}

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
    score: sf.score.adjustedScore,
    scoredFamily: sf,
  };
}

export default useRecommendationEngine;
