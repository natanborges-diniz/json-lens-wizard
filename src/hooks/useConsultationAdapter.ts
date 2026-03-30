/**
 * useConsultationAdapter
 * 
 * Wraps useConsultationPipeline and returns the same shape as useRecommendationEngine,
 * so SellerFlow + RecommendationsGrid can consume DB-backed data without UI changes.
 */

import { useMemo } from 'react';
import { useConsultationPipeline, type UseConsultationPipelineProps } from './useConsultationPipeline';
import type { Family, Price, Tier, AnamnesisData, Prescription, ClinicalType, LensData, Technology, FrameMeasurements } from '@/types/lens';
import type { ScoredFamily, TierKey, RecommendationResult } from '@/lib/recommendationEngine/types';

// Same shape RecommendationsGrid expects
interface FamilyWithScore {
  family: Family;
  bestPrice: Price | null;
  allPrices: Price[];
  tier: Tier;
  score: number;
  scoredFamily?: ScoredFamily;
}

interface PipelineDebugInfo {
  catalogLoaded: boolean;
  totalFamilies: number;
  activeFamilies: number;
  familiesWithActivePrices: number;
  eligibleByClinicalType: number;
  countsByTier: Record<string, number>;
  resolvedClinicalType: string;
  reasons: string[];
  eligibilityFunnel?: any;
}

export interface UseConsultationAdapterProps {
  clinicalType: ClinicalType;
  anamnesisData?: AnamnesisData;
  prescriptionData?: Partial<Prescription>;
  frameData?: Partial<FrameMeasurements>;
  storeId?: string | null;
  serviceId?: string;
  customerId?: string;
  filters?: {
    suppliers?: string[];
    excludeFamilyIds?: string[];
    minPrice?: number;
    maxPrice?: number;
  };
}

export interface UseConsultationAdapterResult {
  recommendations: Record<Tier, FamilyWithScore[]>;
  occupationalRecommendations: Record<Tier, FamilyWithScore[]>;
  topRecommendationId: string | null;
  stats: {
    totalFamiliesAnalyzed: number;
    totalEligible: number;
    totalWithFallback: number;
    averageScore: number;
  };
  isReady: boolean;
  isLoading: boolean;
  error: string | null;
  engineResult: RecommendationResult | null;
  supplierPriorities: string[];
  pipelineDebug: PipelineDebugInfo | null;
  /** Synthetic LensData for components that still need it (budget, narrative) */
  lensData: LensData | null;
  /** Active addons — empty for DB pipeline (addons not yet migrated) */
  activeAddons: any[];
  refresh: () => void;
  meta: {
    source: 'db-pipeline';
    suppliersLoaded: string[];
    familiesLoaded: number;
    pricesLoaded: number;
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

export function useConsultationAdapter({
  clinicalType,
  anamnesisData,
  prescriptionData,
  frameData,
  storeId,
  serviceId,
  customerId,
  filters,
}: UseConsultationAdapterProps): UseConsultationAdapterResult {
  // Primary pipeline call
  const { result, isLoading, error, refresh, meta } = useConsultationPipeline({
    clinicalType,
    anamnesis: anamnesisData,
    prescription: prescriptionData,
    frame: frameData as FrameMeasurements | undefined,
    storeId,
    serviceId,
    customerId,
    filters,
  });

  // Convert pipeline result to legacy format
  const adapted = useMemo(() => {
    const emptyRecs: Record<Tier, FamilyWithScore[]> = {
      essential: [], comfort: [], advanced: [], top: [],
    };

    if (!result?.recommendations) {
      return {
        recommendations: emptyRecs,
        topRecommendationId: null,
        engineResult: null,
        isReady: false,
        pipelineDebug: null,
        lensData: null,
      };
    }

    const rec = result.recommendations;
    const legacyRecs: Record<Tier, FamilyWithScore[]> = {
      essential: [], comfort: [], advanced: [], top: [],
    };
    const countsByTier: Record<string, number> = {};

    const tierKeys: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];
    tierKeys.forEach(tierKey => {
      const tierRec = rec.tiers[tierKey];
      if (!tierRec) { countsByTier[tierKey] = 0; return; }

      const items: FamilyWithScore[] = [];
      if (tierRec.primary) items.push(convertScoredFamily(tierRec.primary, tierKey));
      tierRec.alternatives.forEach(sf => items.push(convertScoredFamily(sf, tierKey)));

      legacyRecs[tierKey] = items;
      countsByTier[tierKey] = items.length;
    });

    const debug: PipelineDebugInfo = {
      catalogLoaded: true,
      totalFamilies: meta.familiesLoaded,
      activeFamilies: meta.familiesLoaded,
      familiesWithActivePrices: meta.pricesLoaded > 0 ? meta.familiesLoaded : 0,
      eligibleByClinicalType: rec.stats.totalEligible,
      countsByTier,
      resolvedClinicalType: clinicalType,
      reasons: [],
      eligibilityFunnel: rec.eligibilityFunnel,
    };

    // Build synthetic LensData for downstream components
    const allFamilies: Family[] = [];
    const allPrices: Price[] = [];
    Object.values(legacyRecs).forEach(tier => {
      tier.forEach(fws => {
        if (!allFamilies.some(f => f.id === fws.family.id)) {
          allFamilies.push(fws.family);
        }
        fws.allPrices.forEach(p => {
          if (!allPrices.some(ep => ep.erp_code === p.erp_code)) {
            allPrices.push(p);
          }
        });
      });
    });

    const syntheticLensData: LensData = {
      meta: { schema_version: 'db-pipeline', dataset_name: 'supplier_final_prices', generated_at: new Date().toISOString(), counts: { families: allFamilies.length, addons: 0, skus_prices: allPrices.length }, notes: [] },
      scales: {},
      attribute_defs: [],
      macros: [],
      families: allFamilies,
      addons: [],
      products_avulsos: [],
      prices: allPrices,
      technology_library: result.recommendations ? 
        Object.fromEntries(
          Object.entries(result.commercialModel || {})
            .filter(([_, v]) => v && typeof v === 'object')
        ) as Record<string, Technology> : {},
    };

    return {
      recommendations: legacyRecs,
      topRecommendationId: rec.topRecommendation?.family.id || null,
      engineResult: rec,
      isReady: true,
      pipelineDebug: debug,
      lensData: syntheticLensData,
    };
  }, [result, clinicalType, meta]);

  return {
    recommendations: adapted.recommendations,
    occupationalRecommendations: { essential: [], comfort: [], advanced: [], top: [] },
    topRecommendationId: adapted.topRecommendationId,
    stats: adapted.engineResult?.stats || {
      totalFamiliesAnalyzed: 0,
      totalEligible: 0,
      totalWithFallback: 0,
      averageScore: 0,
    },
    isReady: adapted.isReady,
    isLoading,
    error,
    engineResult: adapted.engineResult,
    supplierPriorities: [],
    pipelineDebug: adapted.pipelineDebug,
    lensData: adapted.lensData,
    activeAddons: [],
    refresh,
    meta,
  };
}

export default useConsultationAdapter;
