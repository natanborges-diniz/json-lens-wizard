/**
 * Recommendation Scorer - Combina Clinical e Commercial Engines
 * 
 * Fórmula oficial do Blueprint:
 * final_score = (clinical_score * 0.60) + (commercial_score * 0.40)
 */

import type { FamilyExtended, Price, AnamnesisData, Prescription, Technology } from '@/types/lens';
import type { 
  RecommendationScore, 
  ScoredFamily, 
  TierKey, 
  TIER_ORDER 
} from './types';
import { calculateClinicalScore, isClinicallyEligible } from './clinicalEngine';
import { calculateCommercialScore, isCommerciallyViable } from './commercialEngine';

// ============================================
// CONSTANTS
// ============================================

/** Pesos oficiais do Blueprint */
export const SCORE_WEIGHTS = {
  CLINICAL: 0.60,
  COMMERCIAL: 0.40,
};

/** Mapeamento de macro para tier (fallback) */
const MACRO_TO_TIER: Record<string, TierKey> = {
  'PROG_BASICO': 'essential',
  'PROG_ESSENTIAL': 'essential',
  'PROG_CONFORTO': 'comfort',
  'PROG_COMFORT': 'comfort',
  'PROG_AVANCADO': 'advanced',
  'PROG_ADVANCED': 'advanced',
  'PROG_TOP': 'top',
  'PROG_PREMIUM': 'top',
  'MONO_BASICO': 'essential',
  'MONO_ESSENTIAL': 'essential',
  'MONO_ENTRADA': 'comfort',
  'MONO_COMFORT': 'comfort',
  'MONO_CONFORTO': 'comfort',
  'MONO_INTER': 'advanced',
  'MONO_ADVANCED': 'advanced',
  'MONO_AVANCADO': 'advanced',
  'MONO_TOP': 'top',
  'MONO_PREMIUM': 'top',
  'OCUPACIONAL_BASICO': 'essential',
  'OCUPACIONAL_ESSENTIAL': 'essential',
  'OCUPACIONAL_CONFORTO': 'comfort',
  'OCUPACIONAL_COMFORT': 'comfort',
  'OCUPACIONAL_AVANCADO': 'advanced',
  'OCUPACIONAL_ADVANCED': 'advanced',
  'OCUPACIONAL_TOP': 'top',
  'OCUPACIONAL_PREMIUM': 'top',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Determina o tier de uma família usando dados reais do catálogo
 * Prioridade: (1) family.tier_target, (2) macro do catálogo com tier_key, (3) mapa estático, (4) inferência por nome
 */
export function determineTierKey(
  family: FamilyExtended,
  catalogMacros?: Array<{ id: string; tier_key?: string; category?: string }>
): TierKey {
  // 1. Verificar tier_target direto na família
  const tierTarget = family.tier_target;
  if (tierTarget && ['essential', 'comfort', 'advanced', 'top'].includes(tierTarget)) {
    return tierTarget as TierKey;
  }
  
  // 2. Resolver via macros reais do catálogo (tier_key da macro correspondente)
  if (catalogMacros && catalogMacros.length > 0) {
    const matchingMacro = catalogMacros.find(m => m.id === family.macro);
    if (matchingMacro?.tier_key && ['essential', 'comfort', 'advanced', 'top'].includes(matchingMacro.tier_key)) {
      return matchingMacro.tier_key as TierKey;
    }
  }
  
  // 3. Verificar mapeamento estático (fallback)
  if (MACRO_TO_TIER[family.macro]) {
    return MACRO_TO_TIER[family.macro];
  }
  
  // 4. Inferir do nome do macro
  const macroUpper = family.macro.toUpperCase();
  if (macroUpper.includes('TOP') || macroUpper.includes('PREMIUM') || macroUpper.includes('ELITE')) {
    return 'top';
  }
  if (macroUpper.includes('AVANCADO') || macroUpper.includes('ADVANCED') || macroUpper.includes('PLUS')) {
    return 'advanced';
  }
  if (macroUpper.includes('CONFORTO') || macroUpper.includes('COMFORT') || macroUpper.includes('INTER')) {
    return 'comfort';
  }
  
  // 5. Default
  return 'essential';
}

/**
 * Encontra o menor preço compatível
 */
function findStartingPrice(
  family: FamilyExtended,
  prices: Price[],
  prescription: Partial<Prescription>
): { price: number | null; compatiblePrices: Price[] } {
  // Filtrar preços da família
  const familyPrices = prices.filter(p => 
    p.family_id === family.id && 
    p.active !== false && 
    !p.blocked &&
    p.price_sale_half_pair > 0
  );
  
  if (familyPrices.length === 0) {
    return { price: null, compatiblePrices: [] };
  }
  
  // Filtrar compatíveis com receita
  const compatible = familyPrices.filter(p => {
    const specs = p.specs;
    if (!specs) return true;
    
    const sphereMax = specs.sphere_max ?? 20;
    const cylinderMin = specs.cyl_min ?? -6;
    
    const maxSphere = Math.max(
      Math.abs(prescription.rightSphere || 0),
      Math.abs(prescription.leftSphere || 0)
    );
    const maxCylinder = Math.max(
      Math.abs(prescription.rightCylinder || 0),
      Math.abs(prescription.leftCylinder || 0)
    );
    
    if (maxSphere > Math.abs(sphereMax)) return false;
    if (maxCylinder > Math.abs(cylinderMin)) return false;
    
    return true;
  });
  
  if (compatible.length === 0) {
    return { price: null, compatiblePrices: [] };
  }
  
  // Ordenar por preço (menor primeiro)
  compatible.sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair);
  
  // Preço do par (half_pair * 2)
  const startingPrice = compatible[0].price_sale_half_pair * 2;
  
  return { price: startingPrice, compatiblePrices: compatible };
}

/**
 * Extrai dados enriquecidos da família
 */
function extractFamilyData(
  family: FamilyExtended,
  technologyLibrary?: Record<string, Technology>
): {
  technologies: Technology[];
  salesPills: string[];
  knowledgeConsumer: string | null;
  knowledgeConsultant: string | null;
} {
  const techRefs = family.technology_refs || [];
  const technologies: Technology[] = [];
  
  if (technologyLibrary) {
    techRefs.forEach(ref => {
      if (technologyLibrary[ref]) {
        technologies.push(technologyLibrary[ref]);
      }
    });
  }
  
  const knowledge = (family as any).knowledge || {};
  const salesPills = (family as any).sales_pills || [];
  
  return {
    technologies,
    salesPills,
    knowledgeConsumer: knowledge.consumer || null,
    knowledgeConsultant: knowledge.consultant || null,
  };
}

// ============================================
// MAIN FUNCTIONS
// ============================================

/**
 * Calcula o score completo para uma família
 */
export function calculateRecommendationScore(
  family: FamilyExtended,
  prices: Price[],
  anamnesis: AnamnesisData,
  prescription: Partial<Prescription>,
  technologyLibrary?: Record<string, Technology>,
  supplierPriorities?: string[],
  catalogMacros?: Array<{ id: string; tier_key?: string; category?: string }>
): RecommendationScore {
  // Determinar tier
  const tierKey = determineTierKey(family, catalogMacros);
  
  // Calcular scores
  const clinicalScore = calculateClinicalScore(family, prices, anamnesis, prescription, tierKey);
  const commercialScore = calculateCommercialScore(family, prices, tierKey, technologyLibrary, supplierPriorities);
  
  // Aplicar fórmula oficial
  const finalScore = (clinicalScore.total * SCORE_WEIGHTS.CLINICAL) + 
                     (commercialScore.total * SCORE_WEIGHTS.COMMERCIAL);
  
  // Verificar elegibilidade
  const clinicallyEligible = isClinicallyEligible(clinicalScore);
  const commerciallyViable = isCommerciallyViable(commercialScore);
  const isEligible = clinicallyEligible && commerciallyViable;
  
  let ineligibilityReason: string | undefined;
  if (!clinicallyEligible) {
    ineligibilityReason = clinicalScore.flags.prescriptionIncompatible 
      ? 'Incompatível com a receita' 
      : 'Score clínico insuficiente';
  } else if (!commerciallyViable) {
    ineligibilityReason = 'Sem disponibilidade comercial';
  }
  
  return {
    final: Math.round(finalScore * 100) / 100,
    clinical: clinicalScore,
    commercial: commercialScore,
    tierKey,
    rankInTier: 0,
    isEligible,
    ineligibilityReason,
  };
}

/**
 * Processa uma família completa com score e dados enriquecidos
 */
export function scoreFamilyComplete(
  family: FamilyExtended,
  prices: Price[],
  anamnesis: AnamnesisData,
  prescription: Partial<Prescription>,
  technologyLibrary?: Record<string, Technology>,
  supplierPriorities?: string[],
  catalogMacros?: Array<{ id: string; tier_key?: string; category?: string }>
): ScoredFamily {
  const score = calculateRecommendationScore(family, prices, anamnesis, prescription, technologyLibrary, supplierPriorities, catalogMacros);
  const { price, compatiblePrices } = findStartingPrice(family, prices, prescription);
  const enrichedData = extractFamilyData(family, technologyLibrary);
  
  return {
    family,
    score,
    startingPrice: price,
    compatiblePrices,
    ...enrichedData,
  };
}

/**
 * Processa e rankeia múltiplas famílias
 */
export function scoreAndRankFamilies(
  families: FamilyExtended[],
  prices: Price[],
  anamnesis: AnamnesisData,
  prescription: Partial<Prescription>,
  technologyLibrary?: Record<string, Technology>,
  supplierPriorities?: string[],
  catalogMacros?: Array<{ id: string; tier_key?: string; category?: string }>
): ScoredFamily[] {
  // Processar todas as famílias
  const scoredFamilies = families
    .filter(f => f.active !== false)
    .map(family => scoreFamilyComplete(family, prices, anamnesis, prescription, technologyLibrary, supplierPriorities, catalogMacros));
  
  // Agrupar por tier
  const byTier: Record<TierKey, ScoredFamily[]> = {
    essential: [],
    comfort: [],
    advanced: [],
    top: [],
  };
  
  scoredFamilies.forEach(sf => {
    byTier[sf.score.tierKey].push(sf);
  });
  
  // Ordenar cada tier por score final (descendente)
  Object.keys(byTier).forEach(tier => {
    byTier[tier as TierKey].sort((a, b) => b.score.final - a.score.final);
    
    // Atribuir rank
    byTier[tier as TierKey].forEach((sf, idx) => {
      sf.score.rankInTier = idx + 1;
    });
  });
  
  // Flatten mantendo a ordem
  const result: ScoredFamily[] = [];
  const tierOrder: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];
  tierOrder.forEach(tier => {
    result.push(...byTier[tier]);
  });
  
  return result;
}

export default {
  calculateRecommendationScore,
  scoreFamilyComplete,
  scoreAndRankFamilies,
  determineTierKey,
  SCORE_WEIGHTS,
};
