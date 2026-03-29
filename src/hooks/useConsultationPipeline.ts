/**
 * useConsultationPipeline
 * 
 * Bridge hook that connects SellerFlow UI to the DB-backed consultation pipeline.
 * Loads data from supplier_final_prices + supplier_families and feeds the
 * recommendation engine, producing the same output shape that useRecommendationEngine
 * returns — so SellerFlow can switch sources with minimal UI changes.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { runConsultationPipeline, type ConsultationPipelineResult } from '@/lib/consultation';
import type {
  ConsultationInput,
  BudgetContext,
  ConsultationConstraints,
  UsageGoals,
} from '@/lib/consultation/consultationSchema';
import {
  deriveUsageGoals,
  createDefaultBudgetContext,
  createDefaultConstraints,
} from '@/lib/consultation/consultationSchema';
import type {
  ClinicalType,
  AnamnesisData,
  Prescription,
  FrameMeasurements,
} from '@/types/lens';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// TYPES
// ============================================

export interface UseConsultationPipelineProps {
  clinicalType: ClinicalType;
  anamnesis?: AnamnesisData;
  prescription?: Partial<Prescription>;
  frame?: FrameMeasurements;
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

export interface UseConsultationPipelineResult {
  /** Full pipeline result (availability, recommendations, commercial model, etc.) */
  result: ConsultationPipelineResult | null;
  /** Is the pipeline currently running? */
  isLoading: boolean;
  /** Error message if pipeline failed */
  error: string | null;
  /** Re-run the pipeline with current inputs */
  refresh: () => void;
  /** Pipeline metadata */
  meta: {
    lastRunMs: number | null;
    source: 'db-pipeline';
    suppliersLoaded: string[];
    familiesLoaded: number;
    pricesLoaded: number;
  };
}

// ============================================
// HOOK
// ============================================

export function useConsultationPipeline({
  clinicalType,
  anamnesis,
  prescription,
  frame,
  storeId,
  serviceId,
  customerId,
  filters,
}: UseConsultationPipelineProps): UseConsultationPipelineResult {
  const [result, setResult] = useState<ConsultationPipelineResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supplierPriorities, setSupplierPriorities] = useState<string[]>([]);
  const [clinicalEligibilityMode, setClinicalEligibilityMode] = useState<'permissive' | 'strict'>('permissive');
  const runIdRef = useRef(0);

  // Load company settings once
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
          setClinicalEligibilityMode((data as any).clinical_eligibility_mode);
        }
      });
  }, []);

  // Load store-level overrides
  useEffect(() => {
    if (!storeId) return;
    supabase
      .from('stores')
      .select('supplier_priorities')
      .eq('id', storeId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.supplier_priorities && Array.isArray(data.supplier_priorities) && (data.supplier_priorities as any[]).length > 0) {
          setSupplierPriorities(data.supplier_priorities as string[]);
        }
      });
  }, [storeId]);

  const defaultAnamnesis: AnamnesisData = {
    primaryUse: 'mixed',
    screenHours: '3-5',
    nightDriving: 'sometimes',
    visualComplaints: [],
    outdoorTime: 'no',
    clearLensPreference: 'indifferent',
    aestheticPriority: 'medium',
  };

  const runPipeline = useCallback(async () => {
    const currentRun = ++runIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const effectiveAnamnesis = anamnesis || defaultAnamnesis;
      const effectivePrescription = prescription || {};

      const input: ConsultationInput = {
        serviceId,
        storeId: storeId || undefined,
        patient: {
          customerId,
        },
        anamnesis: effectiveAnamnesis,
        prescription: effectivePrescription,
        frame,
        clinicalType,
        usageGoals: deriveUsageGoals(effectiveAnamnesis, clinicalType),
        budget: createDefaultBudgetContext(),
        constraints: {
          ...createDefaultConstraints(),
          allowedSuppliers: filters?.suppliers,
          excludedFamilyIds: filters?.excludeFamilyIds,
        },
        clinicalEligibilityMode,
        supplierPriorities,
      };

      // Apply budget filters
      if (filters?.minPrice !== undefined) {
        input.budget.minBudget = filters.minPrice;
      }
      if (filters?.maxPrice !== undefined) {
        input.budget.maxBudget = filters.maxPrice;
      }

      const pipelineResult = await runConsultationPipeline(input);

      // Only set if this is still the latest run
      if (currentRun === runIdRef.current) {
        setResult(pipelineResult);
        console.log(
          `[useConsultationPipeline] Done in ${pipelineResult.meta.durationMs}ms | ` +
          `${pipelineResult.meta.familiesLoaded} families, ${pipelineResult.meta.pricesLoaded} prices`
        );
      }
    } catch (err: any) {
      if (currentRun === runIdRef.current) {
        const msg = err?.message || 'Pipeline execution failed';
        setError(msg);
        console.error('[useConsultationPipeline] Error:', err);
      }
    } finally {
      if (currentRun === runIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [clinicalType, anamnesis, prescription, frame, storeId, serviceId, customerId, filters, supplierPriorities, clinicalEligibilityMode]);

  // Auto-run when inputs change
  useEffect(() => {
    if (clinicalType) {
      runPipeline();
    }
  }, [runPipeline]);

  return {
    result,
    isLoading,
    error,
    refresh: runPipeline,
    meta: {
      lastRunMs: result?.meta.durationMs ?? null,
      source: 'db-pipeline',
      suppliersLoaded: result?.meta.suppliersLoaded || [],
      familiesLoaded: result?.meta.familiesLoaded || 0,
      pricesLoaded: result?.meta.pricesLoaded || 0,
    },
  };
}

export default useConsultationPipeline;
