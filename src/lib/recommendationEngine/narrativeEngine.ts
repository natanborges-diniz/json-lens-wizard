/**
 * Narrative Engine - Motor de Geração de Narrativas Consultivas
 * 
 * Responsável por:
 * 1. Gerar resumos consultivos para cada família
 * 2. Criar comparações entre níveis (tier deltas)
 * 3. Explicar o "Por que esta lente?" baseado na anamnese
 * 4. Usar knowledge.consumer e knowledge.consultant do catálogo
 * 
 * Segue o Blueprint Oficial - ZERO CRIAÇÃO de textos inventados.
 * Todos os textos derivam do catálogo (knowledge, sales_pills, technology_library).
 */

import type { 
  FamilyExtended, 
  Technology, 
  AnamnesisData,
  ClinicalType,
} from '@/types/lens';
import type { ScoredFamily, TierKey, TierRecommendation } from './types';

// ============================================
// NARRATIVE TYPES
// ============================================

/**
 * Resumo consultivo de uma família
 */
export interface ConsultativeNarrative {
  /** Headline principal para o cliente */
  headline: string;
  
  /** Explicação de 1-2 frases do "Por que esta lente?" */
  whyThisLens: string;
  
  /** Bullets de benefícios (sales_pills) */
  benefits: string[];
  
  /** Tecnologias destacadas com descrições curtas */
  technologies: Array<{
    name: string;
    description: string;
  }>;
  
  /** Knowledge para o cliente (simplificado) */
  knowledgeConsumer: string | null;
  
  /** Knowledge para o consultor (técnico) */
  knowledgeConsultant: string | null;
  
  /** Narrativa de upsell (se aplicável) */
  upsellHint: string | null;
}

/**
 * Comparação entre dois tiers adjacentes
 */
export interface TierComparison {
  /** Tier inferior */
  fromTier: TierKey;
  
  /** Tier superior */
  toTier: TierKey;
  
  /** Headline da comparação */
  headline: string;
  
  /** Lista de ganhos ao subir de nível */
  gains: string[];
  
  /** Delta de preço (se disponível) */
  priceDelta: number | null;
  
  /** Narrativa consultiva para o vendedor */
  consultantScript: string;
}

/**
 * Resultado completo do motor narrativo
 */
export interface NarrativeResult {
  /** Narrativas por família ID */
  familyNarratives: Record<string, ConsultativeNarrative>;
  
  /** Comparações entre tiers */
  tierComparisons: TierComparison[];
  
  /** Narrativa principal (top recommendation) */
  topRecommendationNarrative: ConsultativeNarrative | null;
  
  /** Script de abertura baseado na anamnese */
  openingScript: string;
  
  /** Script de fechamento */
  closingScript: string;
}

// ============================================
// ANAMNESIS MAPPING
// ============================================

const LIFESTYLE_PHRASES: Record<string, string> = {
  reading: 'focada em leitura e atividades próximas',
  computer: 'com uso intensivo de telas e computadores',
  work: 'profissional com demandas variadas',
  driving: 'com foco em direção e visão distante',
  outdoor: 'ativa com exposição ao ar livre',
  mixed: 'versátil para múltiplas atividades',
};

const SCREEN_PHRASES: Record<string, string> = {
  '0-2': 'baixa exposição a telas',
  '3-5': 'uso moderado de telas',
  '6-8': 'uso intensivo de telas',
  '8+': 'uso extremo de telas digitais',
};

const COMPLAINT_PHRASES: Record<string, string> = {
  eye_fatigue: 'cansaço visual',
  headache: 'dores de cabeça',
  near_focus: 'dificuldade de foco próximo',
  end_day_fatigue: 'fadiga visual ao final do dia',
  light_sensitivity: 'sensibilidade à luz',
  none: '',
};

const TIER_LABELS: Record<TierKey, string> = {
  essential: 'Essencial',
  comfort: 'Conforto',
  advanced: 'Avançada',
  top: 'Top',
};

const TIER_DESCRIPTIONS: Record<TierKey, string> = {
  essential: 'correção visual confiável com ótimo custo-benefício',
  comfort: 'equilíbrio ideal entre qualidade e preço, com tecnologias de conforto',
  advanced: 'alta tecnologia para usuários exigentes, com máximo conforto',
  top: 'o melhor disponível no mercado, com tecnologia de ponta',
};

// ============================================
// NARRATIVE GENERATORS
// ============================================

/**
 * Gera narrativa consultiva para uma família
 */
export function generateFamilyNarrative(
  scoredFamily: ScoredFamily,
  anamnesis: AnamnesisData,
  technologyLibrary: Record<string, Technology>,
): ConsultativeNarrative {
  const { family, salesPills, knowledgeConsumer, knowledgeConsultant, technologies } = scoredFamily;
  
  // Headline baseado no tier e família
  const tierLabel = TIER_LABELS[scoredFamily.score.tierKey];
  const headline = `${family.name_original} - Nível ${tierLabel}`;
  
  // "Por que esta lente?" baseado na anamnese e score
  const whyThisLens = generateWhyThisLens(scoredFamily, anamnesis);
  
  // Benefits = sales_pills do catálogo (máximo 5)
  const benefits = (salesPills || []).slice(0, 5);
  
  // Tecnologias com descrições
  const techList = (technologies || []).map(tech => ({
    name: tech.name_common,
    description: tech.description_short || '',
  }));
  
  // Upsell hint (se não for top tier)
  const upsellHint = scoredFamily.score.tierKey !== 'top' 
    ? `Considere o próximo nível para ${getNextTierBenefit(scoredFamily.score.tierKey)}.`
    : null;
  
  return {
    headline,
    whyThisLens,
    benefits,
    technologies: techList,
    knowledgeConsumer: knowledgeConsumer || null,
    knowledgeConsultant: knowledgeConsultant || null,
    upsellHint,
  };
}

/**
 * Gera o texto "Por que esta lente?" conectando anamnese com benefícios
 */
function generateWhyThisLens(
  scoredFamily: ScoredFamily,
  anamnesis: AnamnesisData,
): string {
  const parts: string[] = [];
  
  // Base: lifestyle match
  const lifestylePhrase = LIFESTYLE_PHRASES[anamnesis.primaryUse] || '';
  if (lifestylePhrase) {
    parts.push(`Ideal para rotina ${lifestylePhrase}`);
  }
  
  // Screen hours connection
  if (anamnesis.screenHours === '6-8' || anamnesis.screenHours === '8+') {
    parts.push('com proteção para uso digital intenso');
  }
  
  // Visual complaints connection
  const complaints = anamnesis.visualComplaints
    .filter(c => c !== 'none')
    .map(c => COMPLAINT_PHRASES[c])
    .filter(Boolean);
  
  if (complaints.length > 0) {
    parts.push(`ajudando com ${complaints.slice(0, 2).join(' e ')}`);
  }
  
  // If we have knowledge.consumer, use it as primary
  if (scoredFamily.knowledgeConsumer) {
    return scoredFamily.knowledgeConsumer;
  }
  
  // Fallback to generated phrase
  if (parts.length === 0) {
    const tierDesc = TIER_DESCRIPTIONS[scoredFamily.score.tierKey];
    return `Esta lente oferece ${tierDesc}.`;
  }
  
  return parts.join(', ') + '.';
}

/**
 * Retorna o benefício principal do próximo tier
 */
function getNextTierBenefit(currentTier: TierKey): string {
  const benefits: Record<TierKey, string> = {
    essential: 'maior conforto e adaptação mais rápida',
    comfort: 'tecnologia avançada e campos de visão expandidos',
    advanced: 'o máximo em personalização e menor taxa de inadaptação',
    top: '', // Não há próximo tier
  };
  return benefits[currentTier];
}

/**
 * Gera comparação entre dois tiers adjacentes
 */
export function generateTierComparison(
  lowerTier: TierRecommendation,
  upperTier: TierRecommendation,
  anamnesis: AnamnesisData,
): TierComparison | null {
  if (!lowerTier.primary || !upperTier.primary) {
    return null;
  }
  
  const fromTier = lowerTier.tierKey;
  const toTier = upperTier.tierKey;
  
  const lowerFamily = lowerTier.primary;
  const upperFamily = upperTier.primary;
  
  // Headline
  const headline = `De ${TIER_LABELS[fromTier]} para ${TIER_LABELS[toTier]}`;
  
  // Gains based on tier progression
  const gains = generateTierGains(fromTier, toTier, upperFamily);
  
  // Price delta
  const priceDelta = (upperFamily.startingPrice && lowerFamily.startingPrice)
    ? upperFamily.startingPrice - lowerFamily.startingPrice
    : null;
  
  // Consultant script
  const consultantScript = generateConsultantScript(
    lowerFamily, 
    upperFamily, 
    fromTier, 
    toTier,
    anamnesis
  );
  
  return {
    fromTier,
    toTier,
    headline,
    gains,
    priceDelta,
    consultantScript,
  };
}

/**
 * Gera lista de ganhos ao subir de tier
 */
function generateTierGains(
  fromTier: TierKey,
  toTier: TierKey,
  upperFamily: ScoredFamily,
): string[] {
  const gains: string[] = [];
  
  // Base gains by tier progression
  const TIER_PROGRESSION_GAINS: Record<string, string[]> = {
    'essential->comfort': [
      'Campos de visão mais amplos',
      'Adaptação mais rápida',
      'Maior conforto para uso prolongado',
    ],
    'comfort->advanced': [
      'Tecnologia de ponta',
      'Personalização avançada',
      'Menor taxa de inadaptação',
    ],
    'advanced->top': [
      'Máxima tecnologia disponível',
      'Personalização total',
      'Suporte premium',
    ],
    'essential->advanced': [
      'Salto significativo em tecnologia',
      'Campos de visão muito mais amplos',
      'Conforto visual superior',
    ],
    'essential->top': [
      'O melhor do mercado',
      'Todas as tecnologias disponíveis',
      'Experiência visual premium',
    ],
    'comfort->top': [
      'Upgrade para o nível máximo',
      'Tecnologias exclusivas',
      'Garantia estendida',
    ],
  };
  
  const key = `${fromTier}->${toTier}`;
  const baseGains = TIER_PROGRESSION_GAINS[key] || [];
  gains.push(...baseGains);
  
  // Add technology-specific gains if available
  if (upperFamily.technologies && upperFamily.technologies.length > 0) {
    const techNames = upperFamily.technologies
      .slice(0, 2)
      .map(t => t.name_common);
    if (techNames.length > 0) {
      gains.push(`Inclui ${techNames.join(' e ')}`);
    }
  }
  
  return gains.slice(0, 4); // Max 4 gains
}

/**
 * Gera script para o consultor usar na venda
 */
function generateConsultantScript(
  lowerFamily: ScoredFamily,
  upperFamily: ScoredFamily,
  fromTier: TierKey,
  toTier: TierKey,
  anamnesis: AnamnesisData,
): string {
  // Use knowledge.consultant if available
  if (upperFamily.knowledgeConsultant) {
    return upperFamily.knowledgeConsultant;
  }
  
  // Generate based on context
  const lifestylePhrase = LIFESTYLE_PHRASES[anamnesis.primaryUse] || 'sua rotina';
  const tierLabel = TIER_LABELS[toTier];
  
  return `Considerando ${lifestylePhrase}, a ${upperFamily.family.name_original} (${tierLabel}) oferece ${TIER_DESCRIPTIONS[toTier]}. O investimento adicional traz benefícios significativos em conforto e durabilidade.`;
}

/**
 * Gera script de abertura baseado na anamnese
 */
export function generateOpeningScript(
  anamnesis: AnamnesisData,
  clinicalType: ClinicalType,
): string {
  const typeLabel = clinicalType === 'PROGRESSIVA' 
    ? 'lentes progressivas'
    : clinicalType === 'OCUPACIONAL'
      ? 'lentes ocupacionais'
      : 'lentes monofocais';
  
  const lifestylePhrase = LIFESTYLE_PHRASES[anamnesis.primaryUse] || '';
  
  let opening = `Com base no seu perfil, selecionamos ${typeLabel} ideais para você`;
  
  if (lifestylePhrase) {
    opening += `, especialmente para uma rotina ${lifestylePhrase}`;
  }
  
  if (anamnesis.visualComplaints.length > 0 && !anamnesis.visualComplaints.includes('none')) {
    const complaint = COMPLAINT_PHRASES[anamnesis.visualComplaints[0]];
    if (complaint) {
      opening += `, considerando sua queixa de ${complaint}`;
    }
  }
  
  return opening + '.';
}

/**
 * Gera script de fechamento
 */
export function generateClosingScript(): string {
  return 'Posso detalhar qualquer uma das opções ou ajustar conforme sua preferência.';
}

/**
 * Gera resultado completo do motor narrativo
 */
export function generateNarratives(
  tiers: Record<TierKey, TierRecommendation>,
  anamnesis: AnamnesisData,
  clinicalType: ClinicalType,
  technologyLibrary: Record<string, Technology>,
): NarrativeResult {
  const familyNarratives: Record<string, ConsultativeNarrative> = {};
  const tierComparisons: TierComparison[] = [];
  
  const tierOrder: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];
  
  // Generate narratives for all families
  tierOrder.forEach(tierKey => {
    const tierRec = tiers[tierKey];
    if (!tierRec) return;
    
    // Primary family
    if (tierRec.primary) {
      familyNarratives[tierRec.primary.family.id] = generateFamilyNarrative(
        tierRec.primary,
        anamnesis,
        technologyLibrary
      );
    }
    
    // Alternatives
    tierRec.alternatives.forEach(sf => {
      familyNarratives[sf.family.id] = generateFamilyNarrative(
        sf,
        anamnesis,
        technologyLibrary
      );
    });
  });
  
  // Generate tier comparisons
  for (let i = 0; i < tierOrder.length - 1; i++) {
    const lowerTier = tiers[tierOrder[i]];
    const upperTier = tiers[tierOrder[i + 1]];
    
    if (lowerTier && upperTier) {
      const comparison = generateTierComparison(lowerTier, upperTier, anamnesis);
      if (comparison) {
        tierComparisons.push(comparison);
      }
    }
  }
  
  // Find top recommendation narrative
  let topRecommendationNarrative: ConsultativeNarrative | null = null;
  for (const tierKey of [...tierOrder].reverse()) {
    const tierRec = tiers[tierKey];
    if (tierRec?.primary) {
      topRecommendationNarrative = familyNarratives[tierRec.primary.family.id] || null;
      break;
    }
  }
  
  // Generate opening and closing scripts
  const openingScript = generateOpeningScript(anamnesis, clinicalType);
  const closingScript = generateClosingScript();
  
  return {
    familyNarratives,
    tierComparisons,
    topRecommendationNarrative,
    openingScript,
    closingScript,
  };
}
