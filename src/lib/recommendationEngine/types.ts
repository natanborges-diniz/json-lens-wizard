/**
 * Recommendation Engine Types
 * 
 * Tipos centrais para o motor de recomendação seguindo o Blueprint Oficial.
 * Separação clara entre Clinical Engine (60%) e Commercial Engine (40%).
 */

import type { 
  FamilyExtended, 
  Price, 
  AnamnesisData, 
  Prescription,
  ClinicalType,
  Technology 
} from '@/types/lens';

// ============================================
// TIER TYPES
// ============================================

export type TierKey = 'essential' | 'comfort' | 'advanced' | 'top';

export const TIER_ORDER: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];

export const TIER_WEIGHTS: Record<TierKey, number> = {
  essential: 1,
  comfort: 2,
  advanced: 3,
  top: 4,
};

// ============================================
// SCORE TYPES
// ============================================

/**
 * Clinical Score - Baseado em compatibilidade médica/funcional
 * Peso: 60% do score final
 */
export interface ClinicalScore {
  /** Score total clínico (0-100) */
  total: number;
  
  /** Componentes do score */
  components: {
    /** Compatibilidade com receita (0-40) */
    prescriptionMatch: number;
    
    /** Match com queixas visuais (0-30) */
    complaintsMatch: number;
    
    /** Adequação ao estilo de vida (0-30) */
    lifestyleMatch: number;
  };
  
  /** Motivos da pontuação */
  reasons: string[];
  
  /** Flags de incompatibilidade */
  flags: {
    prescriptionIncompatible: boolean;
    categoryMismatch: boolean;
  };
}

/**
 * Commercial Score - Baseado em valor comercial
 * Peso: 40% do score final
 */
export interface CommercialScore {
  /** Score total comercial (0-100) */
  total: number;
  
  /** Componentes do score */
  components: {
    /** Disponibilidade de SKUs (0-20) */
    availability: number;
    
    /** Posicionamento de tier (0-25) */
    tierPosition: number;
    
    /** Riqueza de dados (sales_pills, knowledge) (0-20) */
    dataRichness: number;
    
    /** Tecnologias associadas (0-20) */
    technologyCount: number;
    
    /** Prioridade do fornecedor (0-15) */
    supplierPriority?: number;
  };
  
  /** Motivos da pontuação */
  reasons: string[];
}

/**
 * Score Final Combinado
 * Fórmula: final = (clinical * 0.60) + (commercial * 0.40)
 */
export interface RecommendationScore {
  /** Score final combinado (0-100) */
  final: number;
  
  /** Score clínico (peso 60%) */
  clinical: ClinicalScore;
  
  /** Score comercial (peso 40%) */
  commercial: CommercialScore;
  
  /** Tier atribuído */
  tierKey: TierKey;
  
  /** Rank dentro do tier */
  rankInTier: number;
  
  /** Elegível para exibição */
  isEligible: boolean;
  
  /** Motivo de inelegibilidade (se aplicável) */
  ineligibilityReason?: string;
}

// ============================================
// RECOMMENDATION TYPES
// ============================================

/**
 * Família com score calculado
 */
export interface ScoredFamily {
  family: FamilyExtended;
  score: RecommendationScore;
  
  /** Menor preço compatível com a receita */
  startingPrice: number | null;
  
  /** Todos os preços compatíveis */
  compatiblePrices: Price[];
  
  /** Tecnologias resolvidas */
  technologies: Technology[];
  
  /** Pílulas de venda do catálogo */
  salesPills: string[];
  
  /** Knowledge para cliente */
  knowledgeConsumer: string | null;
  
  /** Knowledge para consultor */
  knowledgeConsultant: string | null;
}

/**
 * Resultado da recomendação por tier
 * Sempre 4 níveis (com fallback se necessário)
 */
export interface TierRecommendation {
  tierKey: TierKey;
  
  /** Família principal recomendada */
  primary: ScoredFamily | null;
  
  /** Alternativas no mesmo tier */
  alternatives: ScoredFamily[];
  
  /** Contagem total de opções */
  totalOptions: number;
  
  /** Fallback aplicado? */
  isFallback: boolean;
  
  /** Motivo do fallback */
  fallbackReason?: string;
}

/**
 * Resultado completo da engine de recomendação
 */
export interface RecommendationResult {
  /** Tipo clínico da lente */
  clinicalType: ClinicalType;
  
  /** Recomendações por tier (sempre 4) */
  tiers: Record<TierKey, TierRecommendation>;
  
  /** Família mais recomendada (maior score final) */
  topRecommendation: ScoredFamily | null;
  
  /** Estatísticas */
  stats: {
    totalFamiliesAnalyzed: number;
    totalEligible: number;
    totalWithFallback: number;
    averageScore: number;
  };
  
  /** Timestamp da recomendação */
  timestamp: number;
  
  /** ID único para auditoria */
  auditId: string;
}

// ============================================
// INPUT TYPES
// ============================================

/**
 * Input para o motor de recomendação
 */
export interface RecommendationInput {
  /** Tipo clínico desejado */
  clinicalType: ClinicalType;
  
  /** Dados da anamnese */
  anamnesis: AnamnesisData;
  
  /** Receita do cliente */
  prescription: Partial<Prescription>;
  
  /** Famílias disponíveis no catálogo */
  families: FamilyExtended[];
  
  /** Preços disponíveis */
  prices: Price[];
  
  /** Biblioteca de tecnologias */
  technologyLibrary?: Record<string, Technology>;
  
  /** Prioridade de fornecedores (da config da empresa) */
  supplierPriorities?: string[];
  
  /** Macros do catálogo (para resolução dinâmica de tier) */
  macros?: Array<{ id: string; tier_key?: string; category?: string }>;
  
  /** Filtros opcionais */
  filters?: {
    suppliers?: string[];
    excludeFamilyIds?: string[];
    minPrice?: number;
    maxPrice?: number;
  };
}

// ============================================
// AUDIT TYPES
// ============================================

/**
 * Log de auditoria para uma recomendação
 */
export interface RecommendationAuditLog {
  /** ID único */
  auditId: string;
  
  /** Timestamp */
  timestamp: number;
  
  /** Input resumido */
  input: {
    clinicalType: ClinicalType;
    prescriptionSummary: string;
    anamnesisSummary: string;
    familyCount: number;
  };
  
  /** Decisões tomadas */
  decisions: Array<{
    familyId: string;
    familyName: string;
    tierKey: TierKey;
    finalScore: number;
    clinicalScore: number;
    commercialScore: number;
    isEligible: boolean;
    reasons: string[];
  }>;
  
  /** Fallbacks aplicados */
  fallbacks: Array<{
    tierKey: TierKey;
    reason: string;
    action: string;
  }>;
  
  /** Resultado final */
  result: {
    topRecommendationId: string | null;
    tiersWithData: TierKey[];
    tiersWithFallback: TierKey[];
  };
}

// ============================================
// EXPORTS
// ============================================

export default {
  TIER_ORDER,
  TIER_WEIGHTS,
};
