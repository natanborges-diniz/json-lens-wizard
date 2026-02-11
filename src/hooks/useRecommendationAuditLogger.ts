/**
 * useRecommendationAuditLogger - Persists recommendation engine logs to the database
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { RecommendationResult, RecommendationInput, ScoredFamily, TierKey } from '@/lib/recommendationEngine/types';

interface PersistLogParams {
  input: RecommendationInput;
  result: RecommendationResult;
  storeId?: string | null;
  serviceId?: string | null;
  catalogVersion?: string | null;
  executionTimeMs?: number;
}

export function useRecommendationAuditLogger() {
  const { user } = useAuth();

  const persistLog = useCallback(async ({
    input,
    result,
    storeId,
    serviceId,
    catalogVersion,
    executionTimeMs,
  }: PersistLogParams) => {
    if (!user) {
      console.warn('[AuditLogger] No authenticated user, skipping persist');
      return;
    }

    try {
      const tierKeys: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];

      // Build input summary
      const inputSummary = {
        clinicalType: input.clinicalType,
        prescription: {
          maxSphere: Math.max(
            Math.abs(input.prescription.rightSphere || 0),
            Math.abs(input.prescription.leftSphere || 0)
          ),
          maxCylinder: Math.max(
            Math.abs(input.prescription.rightCylinder || 0),
            Math.abs(input.prescription.leftCylinder || 0)
          ),
          maxAddition: Math.max(
            input.prescription.rightAddition || 0,
            input.prescription.leftAddition || 0
          ),
        },
        anamnesis: {
          primaryUse: input.anamnesis.primaryUse,
          screenHours: input.anamnesis.screenHours,
          complaintsCount: input.anamnesis.visualComplaints?.length || 0,
          complaints: input.anamnesis.visualComplaints || [],
        },
        familiesCount: input.families.length,
        pricesCount: input.prices.length,
        supplierPriorities: input.supplierPriorities || [],
      };

      // Build output summary per tier
      const outputSummary: Record<string, any> = {};
      tierKeys.forEach(tier => {
        const tierRec = result.tiers[tier];
        if (!tierRec) return;
        outputSummary[tier] = {
          primary: tierRec.primary ? {
            familyId: tierRec.primary.family.id,
            familyName: tierRec.primary.family.name_original,
            supplier: tierRec.primary.family.supplier,
            score: tierRec.primary.score.final,
            clinicalScore: tierRec.primary.score.clinical.total,
            commercialScore: tierRec.primary.score.commercial.total,
            startingPrice: tierRec.primary.startingPrice,
            clinicalReasons: tierRec.primary.score.clinical.reasons,
            commercialReasons: tierRec.primary.score.commercial.reasons,
            clinicalComponents: tierRec.primary.score.clinical.components,
            commercialComponents: tierRec.primary.score.commercial.components,
          } : null,
          alternativesCount: tierRec.alternatives.length,
          alternatives: tierRec.alternatives.slice(0, 3).map(sf => ({
            familyId: sf.family.id,
            familyName: sf.family.name_original,
            score: sf.score.final,
          })),
          isFallback: tierRec.isFallback,
          fallbackReason: tierRec.fallbackReason,
          totalOptions: tierRec.totalOptions,
        };
      });

      // Build scores summary (top 10 families)
      const allScored: any[] = [];
      tierKeys.forEach(tier => {
        const tierRec = result.tiers[tier];
        if (!tierRec) return;
        if (tierRec.primary) {
          allScored.push({
            familyId: tierRec.primary.family.id,
            familyName: tierRec.primary.family.name_original,
            tier,
            final: tierRec.primary.score.final,
            clinical: tierRec.primary.score.clinical.total,
            commercial: tierRec.primary.score.commercial.total,
            isEligible: tierRec.primary.score.isEligible,
            rank: tierRec.primary.score.rankInTier,
          });
        }
        tierRec.alternatives.forEach(sf => {
          allScored.push({
            familyId: sf.family.id,
            familyName: sf.family.name_original,
            tier,
            final: sf.score.final,
            clinical: sf.score.clinical.total,
            commercial: sf.score.commercial.total,
            isEligible: sf.score.isEligible,
            rank: sf.score.rankInTier,
          });
        });
      });

      // Build fallbacks
      const fallbacks = tierKeys
        .filter(tier => result.tiers[tier]?.isFallback)
        .map(tier => ({
          tier,
          reason: result.tiers[tier].fallbackReason || 'Não especificado',
          hasPrimary: !!result.tiers[tier].primary,
        }));

      const { error } = await supabase
        .from('recommendation_audit_logs')
        .insert({
          seller_id: user.id,
          store_id: storeId || null,
          service_id: serviceId || null,
          clinical_type: input.clinicalType,
          catalog_version: catalogVersion || null,
          input_summary: inputSummary,
          output_summary: outputSummary,
          scores: allScored,
          fallbacks,
          top_recommendation_id: result.topRecommendation?.family.id || null,
          top_recommendation_name: result.topRecommendation?.family.name_original || null,
          families_analyzed: result.stats.totalFamiliesAnalyzed,
          families_eligible: result.stats.totalEligible,
          execution_time_ms: executionTimeMs || null,
        });

      if (error) {
        console.error('[AuditLogger] Failed to persist log:', error);
      } else {
        console.log('[AuditLogger] Log persisted successfully');
      }
    } catch (err) {
      console.error('[AuditLogger] Unexpected error:', err);
    }
  }, [user]);

  return { persistLog };
}
