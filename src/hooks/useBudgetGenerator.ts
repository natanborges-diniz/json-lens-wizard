/**
 * useBudgetGenerator - Hook para geração de orçamento consultivo
 * 
 * Integra:
 * - Motor Narrativo (Sprint 3)
 * - Knowledge do catálogo
 * - Edge function para texto IA
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  generateConsultativeBudget, 
  prepareBudgetAIPayload,
  type BudgetContext,
  type ConsultativeBudgetText,
} from '@/lib/budgetGenerator';
import { useCatalogResolver } from '@/hooks/useCatalogResolver';
import { useNarrativeEngine } from '@/hooks/useNarrativeEngine';
import type { 
  FamilyExtended, 
  Technology, 
  AnamnesisData, 
  Prescription, 
  ClinicalType,
  LensData,
} from '@/types/lens';
import type { EnrichedFamily } from '@/lib/catalogEnricher';
import type { RecommendationResult } from '@/lib/recommendationEngine/types';

interface UseBudgetGeneratorProps {
  lensData: LensData | null;
  recommendationResult?: RecommendationResult | null;
  anamnesis: AnamnesisData;
  clinicalType: ClinicalType;
  companyInfo?: {
    name: string;
    slogan?: string;
    phone?: string;
    whatsapp?: string;
  };
}

interface GenerateBudgetParams {
  customerName: string;
  family: FamilyExtended;
  enrichedFamily?: EnrichedFamily;
  prescription?: Partial<Prescription>;
  selectedIndex: string;
  selectedTreatments: string[];
  finalPrice: number;
  paymentMethod?: string;
  discount?: number;
  useAI?: boolean;
}

interface UseBudgetGeneratorResult {
  /** Gera texto consultivo local (sem IA) */
  generateLocalText: (params: GenerateBudgetParams) => ConsultativeBudgetText;
  
  /** Gera texto com IA (edge function) */
  generateAIText: (params: GenerateBudgetParams) => Promise<string | null>;
  
  /** Gera ambos e retorna o melhor */
  generateBudgetText: (params: GenerateBudgetParams) => Promise<{
    localText: ConsultativeBudgetText;
    aiText: string | null;
  }>;
  
  /** Estado de loading */
  isGenerating: boolean;
  
  /** Erro */
  error: string | null;
}

export function useBudgetGenerator({
  lensData,
  recommendationResult,
  anamnesis,
  clinicalType,
  companyInfo,
}: UseBudgetGeneratorProps): UseBudgetGeneratorResult {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getTechnologiesForFamily, resolveFamilyDisplay } = useCatalogResolver();
  
  const { getNarrativeForFamily } = useNarrativeEngine({
    recommendationResult: recommendationResult || null,
    anamnesis,
    clinicalType,
    technologyLibrary: lensData?.technology_library?.items || {},
  });

  /**
   * Build context for budget generation
   */
  const buildContext = useCallback((params: GenerateBudgetParams): BudgetContext => {
    const {
      customerName,
      family,
      enrichedFamily,
      prescription,
      selectedIndex,
      selectedTreatments,
      finalPrice,
      paymentMethod,
      discount,
    } = params;

    // Get technologies for family
    const technologies = getTechnologiesForFamily(family);

    // Get narrative from Sprint 3 engine
    const narrative = getNarrativeForFamily(family.id);

    // Get enriched family from params or resolve display
    let resolvedEnrichedFamily = enrichedFamily;
    if (!resolvedEnrichedFamily) {
      // Try to build minimal enriched data from resolveFamilyDisplay
      const displayData = resolveFamilyDisplay(family);
      if (displayData) {
        resolvedEnrichedFamily = {
          ...family,
          display_name: family.name_original,
          display_subtitle: `${family.supplier} · ${displayData.tierConfig.label}`,
          knowledge: undefined,
          sales_pills: family.attributes_display_base || [],
        } as EnrichedFamily;
      }
    }

    return {
      customerName,
      anamnesis,
      prescription,
      clinicalType,
      family,
      enrichedFamily: resolvedEnrichedFamily,
      narrative: narrative || undefined,
      technologies,
      finalPrice,
      selectedIndex,
      selectedTreatments,
      paymentMethod,
      discount,
      companyInfo,
    };
  }, [anamnesis, clinicalType, companyInfo, getTechnologiesForFamily, getNarrativeForFamily, resolveFamilyDisplay]);

  /**
   * Generate local text (no AI)
   */
  const generateLocalText = useCallback((params: GenerateBudgetParams): ConsultativeBudgetText => {
    const context = buildContext(params);
    return generateConsultativeBudget(context);
  }, [buildContext]);

  /**
   * Generate AI text (edge function)
   */
  const generateAIText = useCallback(async (params: GenerateBudgetParams): Promise<string | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      const context = buildContext(params);
      const payload = prepareBudgetAIPayload(context);

      const { data, error: invokeError } = await supabase.functions.invoke('generate-budget-text', {
        body: payload,
      });

      if (invokeError) {
        console.error('AI generation error:', invokeError);
        setError('Erro ao gerar texto com IA');
        return null;
      }

      if (!data?.success) {
        console.error('AI generation failed:', data?.error);
        setError(data?.error || 'Erro desconhecido');
        return null;
      }

      return data.text || null;
    } catch (err) {
      console.error('Error calling AI:', err);
      setError('Erro de conexão');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [buildContext]);

  /**
   * Generate both local and AI text
   */
  const generateBudgetText = useCallback(async (params: GenerateBudgetParams): Promise<{
    localText: ConsultativeBudgetText;
    aiText: string | null;
  }> => {
    // Always generate local text first (fast)
    const localText = generateLocalText(params);

    // Only call AI if requested
    let aiText: string | null = null;
    if (params.useAI !== false) {
      aiText = await generateAIText(params);
    }

    return { localText, aiText };
  }, [generateLocalText, generateAIText]);

  return {
    generateLocalText,
    generateAIText,
    generateBudgetText,
    isGenerating,
    error,
  };
}

export default useBudgetGenerator;
