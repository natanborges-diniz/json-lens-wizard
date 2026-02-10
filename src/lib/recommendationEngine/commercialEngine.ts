/**
 * Commercial Engine - Motor de Score Comercial
 * 
 * Calcula o score comercial (40% do score final) baseado em:
 * 1. Disponibilidade de SKUs (25 pontos)
 * 2. Posicionamento de tier (25 pontos)
 * 3. Riqueza de dados (25 pontos)
 * 4. Tecnologias associadas (25 pontos)
 * 
 * Total: 100 pontos
 */

import type { FamilyExtended, Price, Technology } from '@/types/lens';
import type { CommercialScore, TierKey, TIER_WEIGHTS } from './types';

// ============================================
// CONSTANTS
// ============================================

/** Peso máximo para cada componente */
const WEIGHTS = {
  AVAILABILITY: 20,
  TIER_POSITION: 25,
  DATA_RICHNESS: 20,
  TECHNOLOGY: 20,
  SUPPLIER_PRIORITY: 15,
};

/** Pontuação base por tier (maior = melhor margem comercial) */
const TIER_BASE_SCORES: Record<TierKey, number> = {
  essential: 10,
  comfort: 15,
  advanced: 20,
  top: 25,
};

/** Thresholds para disponibilidade */
const AVAILABILITY_THRESHOLDS = {
  EXCELLENT: 10, // 10+ SKUs = pontuação máxima
  GOOD: 5,       // 5-9 SKUs = boa pontuação
  FAIR: 2,       // 2-4 SKUs = pontuação média
  MINIMAL: 1,    // 1 SKU = pontuação mínima
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calcula score de disponibilidade de SKUs
 */
function calculateAvailabilityScore(
  family: FamilyExtended,
  prices: Price[]
): { score: number; skuCount: number; reasons: string[] } {
  const reasons: string[] = [];
  
  // Contar SKUs ativos e com preço válido
  const activePrices = prices.filter(p => 
    p.family_id === family.id && 
    p.active !== false && 
    !p.blocked &&
    p.price_sale_half_pair > 0
  );
  
  const skuCount = activePrices.length;
  
  if (skuCount === 0) {
    return { score: 0, skuCount: 0, reasons: ['Sem SKUs disponíveis'] };
  }
  
  let score: number;
  
  if (skuCount >= AVAILABILITY_THRESHOLDS.EXCELLENT) {
    score = WEIGHTS.AVAILABILITY;
    reasons.push(`Excelente disponibilidade: ${skuCount} SKUs`);
  } else if (skuCount >= AVAILABILITY_THRESHOLDS.GOOD) {
    score = WEIGHTS.AVAILABILITY * 0.8;
    reasons.push(`Boa disponibilidade: ${skuCount} SKUs`);
  } else if (skuCount >= AVAILABILITY_THRESHOLDS.FAIR) {
    score = WEIGHTS.AVAILABILITY * 0.5;
    reasons.push(`Disponibilidade limitada: ${skuCount} SKUs`);
  } else {
    score = WEIGHTS.AVAILABILITY * 0.25;
    reasons.push(`Disponibilidade mínima: ${skuCount} SKU`);
  }
  
  // Bônus por variedade de índices
  const uniqueIndices = new Set(
    activePrices.map(p => p.index || '1.50')
  );
  
  if (uniqueIndices.size >= 3) {
    score = Math.min(score + 3, WEIGHTS.AVAILABILITY);
    reasons.push(`+3 pts por ${uniqueIndices.size} índices disponíveis`);
  }
  
  return { score, skuCount, reasons };
}

/**
 * Calcula score de posicionamento de tier
 */
function calculateTierScore(
  tierKey: TierKey
): { score: number; reasons: string[] } {
  const score = TIER_BASE_SCORES[tierKey];
  const reasons = [`Tier ${tierKey}: ${score} pts base`];
  
  return { score, reasons };
}

/**
 * Calcula score de riqueza de dados do catálogo
 */
function calculateDataRichnessScore(
  family: FamilyExtended
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  
  // 1. Verificar sales_pills (8 pts máx)
  const salesPills = (family as any).sales_pills || [];
  if (salesPills.length >= 3) {
    score += 8;
    reasons.push('Sales pills completas');
  } else if (salesPills.length > 0) {
    score += salesPills.length * 2;
    reasons.push(`${salesPills.length} sales pills`);
  }
  
  // 2. Verificar knowledge.consumer (8 pts)
  const knowledge = (family as any).knowledge || {};
  if (knowledge.consumer && knowledge.consumer.length > 50) {
    score += 8;
    reasons.push('Knowledge consumer disponível');
  } else if (knowledge.consumer) {
    score += 4;
    reasons.push('Knowledge consumer parcial');
  }
  
  // 3. Verificar knowledge.consultant (5 pts)
  if (knowledge.consultant && knowledge.consultant.length > 50) {
    score += 5;
    reasons.push('Knowledge consultant disponível');
  }
  
  // 4. Verificar comparatives (4 pts)
  const comparatives = (family as any).comparatives;
  if (comparatives && Object.keys(comparatives).length > 0) {
    score += 4;
    reasons.push('Dados comparativos disponíveis');
  }
  
  // Normalizar
  score = Math.min(score, WEIGHTS.DATA_RICHNESS);
  
  if (reasons.length === 0) {
    reasons.push('Dados comerciais básicos');
    score = WEIGHTS.DATA_RICHNESS * 0.2;
  }
  
  return { score, reasons };
}

/**
 * Calcula score de tecnologias associadas
 */
function calculateTechnologyScore(
  family: FamilyExtended,
  technologyLibrary?: Record<string, Technology>
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const techRefs = family.technology_refs || [];
  
  if (techRefs.length === 0) {
    return { 
      score: WEIGHTS.TECHNOLOGY * 0.2, 
      reasons: ['Sem tecnologias documentadas'] 
    };
  }
  
  // Score base pela quantidade
  let score = Math.min(techRefs.length * 5, WEIGHTS.TECHNOLOGY * 0.6);
  reasons.push(`${techRefs.length} tecnologias referenciadas`);
  
  // Bônus se tecnologias estão na library
  if (technologyLibrary) {
    const resolvedCount = techRefs.filter(ref => technologyLibrary[ref]).length;
    if (resolvedCount === techRefs.length) {
      score += WEIGHTS.TECHNOLOGY * 0.4;
      reasons.push('Todas tecnologias documentadas na library');
    } else if (resolvedCount > 0) {
      score += (resolvedCount / techRefs.length) * WEIGHTS.TECHNOLOGY * 0.4;
      reasons.push(`${resolvedCount}/${techRefs.length} tecnologias na library`);
    }
  }
  
  // Normalizar
  score = Math.min(score, WEIGHTS.TECHNOLOGY);
  
  return { score, reasons };
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Calcula score de prioridade do fornecedor
 */
function calculateSupplierPriorityScore(
  family: FamilyExtended,
  supplierPriorities?: string[]
): { score: number; reasons: string[] } {
  if (!supplierPriorities || supplierPriorities.length === 0) {
    return { score: WEIGHTS.SUPPLIER_PRIORITY * 0.5, reasons: ['Sem prioridade de fornecedor configurada'] };
  }

  const index = supplierPriorities.indexOf(family.supplier);
  if (index === -1) {
    return { score: WEIGHTS.SUPPLIER_PRIORITY * 0.3, reasons: [`Fornecedor ${family.supplier} não está na lista de prioridades`] };
  }

  // First position gets full score, linear decay
  const positionRatio = 1 - (index / supplierPriorities.length);
  const score = WEIGHTS.SUPPLIER_PRIORITY * positionRatio;
  const reasons = [`Fornecedor ${family.supplier}: posição #${index + 1} de ${supplierPriorities.length} (+${Math.round(score)} pts)`];

  return { score, reasons };
}

/**
 * Calcula o score comercial para uma família
 */
export function calculateCommercialScore(
  family: FamilyExtended,
  prices: Price[],
  tierKey: TierKey,
  technologyLibrary?: Record<string, Technology>,
  supplierPriorities?: string[]
): CommercialScore {
  const allReasons: string[] = [];
  
  // 1. Score de disponibilidade (20 pts)
  const availabilityResult = calculateAvailabilityScore(family, prices);
  allReasons.push(...availabilityResult.reasons);
  
  // 2. Score de tier (25 pts)
  const tierResult = calculateTierScore(tierKey);
  allReasons.push(...tierResult.reasons);
  
  // 3. Score de riqueza de dados (20 pts)
  const dataResult = calculateDataRichnessScore(family);
  allReasons.push(...dataResult.reasons);
  
  // 4. Score de tecnologias (20 pts)
  const techResult = calculateTechnologyScore(family, technologyLibrary);
  allReasons.push(...techResult.reasons);
  
  // 5. Score de prioridade do fornecedor (15 pts)
  const supplierResult = calculateSupplierPriorityScore(family, supplierPriorities);
  allReasons.push(...supplierResult.reasons);
  
  // Total
  const total = availabilityResult.score + tierResult.score + dataResult.score + techResult.score + supplierResult.score;
  
  return {
    total: Math.round(total * 100) / 100,
    components: {
      availability: Math.round(availabilityResult.score * 100) / 100,
      tierPosition: Math.round(tierResult.score * 100) / 100,
      dataRichness: Math.round(dataResult.score * 100) / 100,
      technologyCount: Math.round(techResult.score * 100) / 100,
      supplierPriority: Math.round(supplierResult.score * 100) / 100,
    },
    reasons: allReasons,
  };
}

/**
 * Verifica se uma família é comercialmente viável
 */
export function isCommerciallyViable(score: CommercialScore): boolean {
  // Inviável se não tem SKUs
  if (score.components.availability === 0) return false;
  
  // Inviável se score muito baixo (menos de 15% do máximo)
  if (score.total < 15) return false;
  
  return true;
}

export default {
  calculateCommercialScore,
  isCommerciallyViable,
};
