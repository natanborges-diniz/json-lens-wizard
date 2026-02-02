/**
 * PROMPT CANÔNICO DE GOVERNANÇA - Motor de Recomendação Ótica
 * V1.0 - Sistema de Catálogo de Lentes
 * 
 * Este arquivo define as regras obrigatórias que regem TODAS as decisões
 * do sistema de recomendação. Deve ser importado e aplicado em:
 * - RecommendationsGrid
 * - ProductSuggestionEngine
 * - SmartSearch Edge Function
 * - CatalogResolver
 * 
 * PRINCÍPIO FUNDAMENTAL: O catálogo JSON é a ÚNICA fonte de verdade.
 * O sistema NÃO cria produtos, NÃO altera dados e NÃO infere valor.
 */

// ============================================
// REGRAS OBRIGATÓRIAS DO MOTOR DE RECOMENDAÇÃO
// ============================================

export const GOVERNANCE_RULES = {
  // Regra 1: Uso exclusivo do catálogo JSON
  CATALOG_ONLY: 'Use exclusivamente o catálogo JSON fornecido.',
  
  // Regra 2: Dados vêm apenas do catálogo
  DATA_FROM_CATALOG: 'Tier, preço, tecnologia e textos vêm apenas do catálogo.',
  
  // Regra 3: Máximo 1 produto por tier
  ONE_PER_TIER: 'Exiba no máximo 1 produto por tier (essential, comfort, advanced, top).',
  
  // Regra 4: Nunca compare produtos do mesmo tier
  NO_SAME_TIER_COMPARE: 'Nunca compare produtos do mesmo tier.',
  
  // Regra 5: Preço do menor SKU compatível
  LOWEST_COMPATIBLE_PRICE: 'O preço exibido deve ser o menor SKU compatível com a receita.',
  
  // Regra 6: Informar indisponibilidade
  SHOW_UNAVAILABLE: 'Se não houver SKU compatível, informe indisponibilidade.',
  
  // Regra 7: Usar knowledge.consumer para explicar valor
  USE_CONSUMER_KNOWLEDGE: 'Explique valor usando knowledge.consumer.',
  
  // Regra 8: Usar knowledge.consultant para upsell
  USE_CONSULTANT_KNOWLEDGE: 'Conduza upsell usando knowledge.consultant.',
  
  // Regra 9: Sem notas genéricas
  NO_GENERIC_RATINGS: 'Nunca gere estrelas ou notas genéricas.',
  
  // Regra 10: Sem invenção
  NO_INVENTION: 'Nunca invente tecnologia ou descrição.',
} as const;

// Regra de fallback
export const GOVERNANCE_FALLBACK = 
  'Se alguma regra não puder ser cumprida, o produto NÃO deve ser exibido.';

// ============================================
// VALIDADORES DE GOVERNANÇA
// ============================================

export interface Price {
  family_id: string;
  price_sale_half_pair: number;
  availability?: {
    sphere?: { min: number; max: number };
    cylinder?: { min: number; max: number };
    addition?: { min: number; max: number };
    index?: string;
  };
  specs?: {
    esf_min?: number;
    esf_max?: number;
    cil_min?: number;
    cil_max?: number;
    add_min?: number;
    add_max?: number;
    index?: string;
  };
  active?: boolean;
}

export interface Prescription {
  rightSphere?: number;
  leftSphere?: number;
  rightCylinder?: number;
  leftCylinder?: number;
  rightAddition?: number;
  leftAddition?: number;
}

/**
 * Verifica se um SKU é compatível com a receita do cliente
 * REGRA 5 & 6: Validação estrita de compatibilidade
 */
export function isSKUCompatibleWithPrescription(
  price: Price, 
  prescription: Prescription
): boolean {
  // Extrair limites (suporta V3.6.x availability e legado specs)
  const limits = price.availability || price.specs;
  if (!limits) return true; // Se não há limites, assume compatível
  
  // Normalizar campos para V3.6.x
  const sphereMin = 'sphere' in limits ? limits.sphere?.min : (limits as any).esf_min;
  const sphereMax = 'sphere' in limits ? limits.sphere?.max : (limits as any).esf_max;
  const cylinderMin = 'cylinder' in limits ? limits.cylinder?.min : (limits as any).cil_min;
  const cylinderMax = 'cylinder' in limits ? limits.cylinder?.max : (limits as any).cil_max;
  const additionMin = 'addition' in limits ? limits.addition?.min : (limits as any).add_min;
  const additionMax = 'addition' in limits ? limits.addition?.max : (limits as any).add_max;
  
  // Validar esfera (maior absoluto entre OD e OE)
  const maxSphere = Math.max(
    Math.abs(prescription.rightSphere || 0),
    Math.abs(prescription.leftSphere || 0)
  );
  
  if (sphereMin !== undefined && sphereMax !== undefined) {
    if (maxSphere < Math.abs(sphereMin) || maxSphere > Math.abs(sphereMax)) {
      return false;
    }
  }
  
  // Validar cilindro (maior absoluto entre OD e OE)
  const maxCylinder = Math.max(
    Math.abs(prescription.rightCylinder || 0),
    Math.abs(prescription.leftCylinder || 0)
  );
  
  if (cylinderMin !== undefined && cylinderMax !== undefined) {
    if (maxCylinder < Math.abs(cylinderMin) || maxCylinder > Math.abs(cylinderMax)) {
      return false;
    }
  }
  
  // Validar adição (para progressivas)
  const maxAddition = Math.max(
    prescription.rightAddition || 0,
    prescription.leftAddition || 0
  );
  
  if (maxAddition > 0 && additionMin !== undefined && additionMax !== undefined) {
    if (maxAddition < additionMin || maxAddition > additionMax) {
      return false;
    }
  }
  
  return true;
}

/**
 * Encontra o menor preço compatível para uma família
 * REGRA 5: O preço exibido deve ser o menor SKU compatível com a receita
 */
export function findLowestCompatiblePrice(
  prices: Price[],
  familyId: string,
  prescription: Prescription
): Price | null {
  // Filtrar preços da família
  const familyPrices = prices.filter(p => 
    p.family_id === familyId && 
    p.active !== false &&
    p.price_sale_half_pair > 0
  );
  
  if (familyPrices.length === 0) return null;
  
  // Filtrar por compatibilidade com receita
  const compatiblePrices = familyPrices.filter(p => 
    isSKUCompatibleWithPrescription(p, prescription)
  );
  
  if (compatiblePrices.length === 0) return null;
  
  // Retornar o menor preço
  return compatiblePrices.reduce((min, p) => 
    p.price_sale_half_pair < min.price_sale_half_pair ? p : min
  );
}

/**
 * Valida se uma família pode ser exibida conforme governança
 * REGRA 6: Se não houver SKU compatível, não exibir
 */
export function canDisplayFamily(
  familyId: string,
  prices: Price[],
  prescription: Prescription
): boolean {
  const lowestPrice = findLowestCompatiblePrice(prices, familyId, prescription);
  return lowestPrice !== null;
}

// ============================================
// VALIDAÇÃO DE DADOS DO CATÁLOGO
// ============================================

export interface CatalogValidation {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
}

/**
 * Valida se o catálogo contém todos os campos obrigatórios
 */
export function validateCatalogStructure(catalog: any): CatalogValidation {
  const requiredFields = [
    'families',
    'prices', 
    'addons',
    'technology_library',
    'macros',
    'attribute_defs'
  ];
  
  const recommendedFields = [
    'benefit_rules',
    'quote_explainer',
    'index_display'
  ];
  
  const missingFields: string[] = [];
  const warnings: string[] = [];
  
  // Verificar campos obrigatórios
  for (const field of requiredFields) {
    if (!catalog[field]) {
      missingFields.push(field);
    }
  }
  
  // Verificar campos recomendados
  for (const field of recommendedFields) {
    if (!catalog[field]) {
      warnings.push(`Campo recomendado ausente: ${field}`);
    }
  }
  
  // Verificar knowledge em famílias (recomendado)
  if (catalog.families) {
    const familiesWithoutKnowledge = catalog.families.filter(
      (f: any) => !f.knowledge?.consumer && !f.knowledge?.consultant
    );
    
    if (familiesWithoutKnowledge.length > 0) {
      warnings.push(
        `${familiesWithoutKnowledge.length} famílias sem knowledge.consumer/consultant`
      );
    }
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings
  };
}

// ============================================
// TIER MANAGEMENT
// ============================================

export type TierKey = 'essential' | 'comfort' | 'advanced' | 'top';

export const TIER_ORDER: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];

/**
 * Agrupa famílias por tier, garantindo máximo 1 por tier
 * REGRA 3: Exiba no máximo 1 produto por tier
 */
export function groupFamiliesByTier<T extends { tierKey: TierKey }>(
  families: T[]
): Map<TierKey, T> {
  const tierMap = new Map<TierKey, T>();
  
  for (const tier of TIER_ORDER) {
    const familyForTier = families.find(f => f.tierKey === tier);
    if (familyForTier) {
      tierMap.set(tier, familyForTier);
    }
  }
  
  return tierMap;
}

/**
 * Filtra famílias para exibir apenas 1 por tier com preço válido
 * REGRA 3 + REGRA 5 + REGRA 6 combinadas
 */
export function selectBestFamilyPerTier<T extends { 
  tierKey: TierKey; 
  familyId: string;
  startingPrice: number | null;
}>(
  families: T[],
  prices: Price[],
  prescription: Prescription
): T[] {
  const result: T[] = [];
  
  for (const tier of TIER_ORDER) {
    // Filtrar famílias deste tier
    const tierFamilies = families.filter(f => f.tierKey === tier);
    
    // Encontrar a família com menor preço compatível
    let bestFamily: T | null = null;
    let lowestPrice = Infinity;
    
    for (const family of tierFamilies) {
      const compatiblePrice = findLowestCompatiblePrice(
        prices, 
        family.familyId, 
        prescription
      );
      
      if (compatiblePrice && compatiblePrice.price_sale_half_pair < lowestPrice) {
        lowestPrice = compatiblePrice.price_sale_half_pair;
        bestFamily = family;
      }
    }
    
    if (bestFamily) {
      result.push(bestFamily);
    }
  }
  
  return result;
}

// ============================================
// PROMPT PARA EDGE FUNCTIONS (Smart Search)
// ============================================

export const AI_SYSTEM_PROMPT = `Você é um motor de recomendação ótica.

Você NÃO cria produtos, NÃO altera dados e NÃO infere valor.

Regras obrigatórias:

1. Use exclusivamente o catálogo JSON fornecido.
2. Tier, preço, tecnologia e textos vêm apenas do catálogo.
3. Exiba no máximo 1 produto por tier (essential, comfort, advanced, top).
4. Nunca compare produtos do mesmo tier.
5. O preço exibido deve ser o menor SKU compatível com a receita.
6. Se não houver SKU compatível, informe indisponibilidade.
7. Explique valor usando knowledge.consumer.
8. Conduza upsell usando knowledge.consultant.
9. Nunca gere estrelas ou notas genéricas.
10. Nunca invente tecnologia ou descrição.

Se alguma regra não puder ser cumprida, o produto NÃO deve ser exibido.

CAMPOS OBRIGATÓRIOS DO CATÁLOGO:
- families (com technology_refs, knowledge.consumer, knowledge.consultant)
- prices (com availability e price_sale_half_pair)
- addons
- technology_library
- macros (com tier_key)
- attribute_defs`;

// ============================================
// EXPORTS
// ============================================

export default {
  GOVERNANCE_RULES,
  GOVERNANCE_FALLBACK,
  AI_SYSTEM_PROMPT,
  TIER_ORDER,
  isSKUCompatibleWithPrescription,
  findLowestCompatiblePrice,
  canDisplayFamily,
  validateCatalogStructure,
  groupFamiliesByTier,
  selectBestFamilyPerTier,
};
