/**
 * Clinical Engine - Motor de Score Clínico
 * 
 * Calcula o score clínico (60% do score final) baseado em:
 * 1. Compatibilidade com receita (40 pontos)
 * 2. Match com queixas visuais (30 pontos)
 * 3. Adequação ao estilo de vida (30 pontos)
 * 
 * Total: 100 pontos
 */

import type { FamilyExtended, Price, AnamnesisData, Prescription } from '@/types/lens';
import type { ClinicalScore, TierKey } from './types';
import type { ClinicalType } from '@/types/lens';

// ============================================
// REALISTIC CLINICAL DEFAULTS (from catalogEnricher)
// Used when SKU has no specs/availability data
// ============================================
const CLINICAL_DEFAULTS: Record<string, {
  sphere: { min: number; max: number };
  cylinder: { min: number; max: number };
  addition?: { min: number; max: number };
}> = {
  'MONOFOCAL': { sphere: { min: -10, max: 10 }, cylinder: { min: -6, max: 0 } },
  'PROGRESSIVA': { sphere: { min: -8, max: 8 }, cylinder: { min: -4, max: 0 }, addition: { min: 0.75, max: 3.50 } },
  'OCUPACIONAL': { sphere: { min: -8, max: 8 }, cylinder: { min: -4, max: 0 }, addition: { min: 0.75, max: 2.50 } },
  'BIFOCAL': { sphere: { min: -8, max: 8 }, cylinder: { min: -3, max: 0 }, addition: { min: 0.75, max: 3.50 } },
};

// ============================================
// CONSTANTS
// ============================================

/** Peso máximo para cada componente */
const WEIGHTS = {
  PRESCRIPTION: 40,
  COMPLAINTS: 30,
  LIFESTYLE: 30,
};

/** Mapeamento de queixas visuais para atributos da família */
const COMPLAINT_TO_ATTRIBUTE: Record<string, string[]> = {
  'eye_fatigue': ['PROG_CONFORTO', 'MONO_CONFORTO', 'digital_comfort'],
  'end_day_fatigue': ['PROG_CONFORTO', 'MONO_CONFORTO', 'digital_comfort'],
  'headache': ['PROG_ADAPTACAO', 'MONO_ADAPTACAO', 'precision'],
  'blurred_vision': ['PROG_NITIDEZ', 'MONO_NITIDEZ', 'clarity'],
  'light_sensitivity': ['photochromic', 'blue_filter', 'UV_protection'],
  'night_vision': ['PROG_NITIDEZ', 'night_vision', 'contrast'],
  'reading_difficulty': ['PROG_LEITURA', 'reading_comfort'],
  'computer_strain': ['digital_comfort', 'blue_filter', 'occupational'],
};

/** Mapeamento de uso primário para características desejadas */
const PRIMARY_USE_PREFERENCES: Record<string, { preferred: string[]; weight: number }> = {
  'computer': { preferred: ['digital_comfort', 'blue_filter', 'OCUPACIONAL'], weight: 1.2 },
  'reading': { preferred: ['reading_comfort', 'PROG_LEITURA'], weight: 1.1 },
  'driving': { preferred: ['night_vision', 'photochromic', 'contrast'], weight: 1.15 },
  'outdoor': { preferred: ['photochromic', 'UV_protection', 'durability'], weight: 1.1 },
  'mixed': { preferred: [], weight: 1.0 },
  'work': { preferred: ['digital_comfort', 'durability'], weight: 1.05 },
};

/** Mapeamento de horas de tela para bônus */
const SCREEN_HOURS_BONUS: Record<string, number> = {
  '0-2': 0,
  '3-5': 5,
  '6-8': 10,
  '8+': 15,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Verifica se um preço é compatível com a receita
 */
function isPriceCompatible(price: Price, prescription: Partial<Prescription>, clinicalType?: string): boolean {
  // Try availability (V3.6.x format) first, then specs, then clinical defaults
  const existingAvailability = (price as any).availability;
  const specs = price.specs;
  
  // Resolve effective limits from best available source
  let sphereMin: number, sphereMax: number, cylinderMin: number, cylinderMax: number;
  let additionMin: number | undefined, additionMax: number | undefined;
  
  if (existingAvailability?.sphere?.min != null && existingAvailability?.sphere?.max != null) {
    // V3.6.x availability with real data
    sphereMin = existingAvailability.sphere.min;
    sphereMax = existingAvailability.sphere.max;
    cylinderMin = existingAvailability.cylinder?.min ?? -4;
    cylinderMax = existingAvailability.cylinder?.max ?? 0;
    additionMin = existingAvailability.addition?.min;
    additionMax = existingAvailability.addition?.max;
  } else if (specs && specs.sphere_min !== undefined && specs.sphere_max !== undefined) {
    // Legacy specs with real data
    sphereMin = specs.sphere_min;
    sphereMax = specs.sphere_max;
    cylinderMin = specs.cyl_min ?? -4;
    cylinderMax = specs.cyl_max ?? 0;
    additionMin = specs.add_min;
    additionMax = specs.add_max;
  } else {
    // No real data — use realistic clinical defaults (NOT ultra-wide safe defaults)
    const defaults = CLINICAL_DEFAULTS[clinicalType || 'MONOFOCAL'] || CLINICAL_DEFAULTS['MONOFOCAL'];
    sphereMin = defaults.sphere.min;
    sphereMax = defaults.sphere.max;
    cylinderMin = defaults.cylinder.min;
    cylinderMax = defaults.cylinder.max;
    additionMin = defaults.addition?.min;
    additionMax = defaults.addition?.max;
  }
  
  // Fallback: if addition limits are missing but clinical type requires addition, use clinical defaults
  if (additionMin == null || additionMax == null) {
    const resolvedType = clinicalType || 'MONOFOCAL';
    const defaults = CLINICAL_DEFAULTS[resolvedType];
    if (defaults?.addition) {
      additionMin = additionMin ?? defaults.addition.min;
      additionMax = additionMax ?? defaults.addition.max;
    }
  }
  
  // Validate sphere (highest absolute between OD and OE)
  const maxSphere = Math.max(
    Math.abs(prescription.rightSphere || 0),
    Math.abs(prescription.leftSphere || 0)
  );
  
  if (maxSphere > Math.max(Math.abs(sphereMin), Math.abs(sphereMax))) {
    return false;
  }
  
  // Validate cylinder
  const maxCylinder = Math.max(
    Math.abs(prescription.rightCylinder || 0),
    Math.abs(prescription.leftCylinder || 0)
  );
  
  if (maxCylinder > Math.abs(cylinderMin)) {
    return false;
  }
  
  // Validate addition (for progressives)
  const maxAddition = Math.max(
    prescription.rightAddition || 0,
    prescription.leftAddition || 0
  );
  
  if (maxAddition > 0 && additionMin != null && additionMax != null) {
    if (maxAddition < additionMin || maxAddition > additionMax) {
      return false;
    }
  }
  
  return true;
}

/**
 * Calcula score de compatibilidade com receita
 */
function calculatePrescriptionScore(
  family: FamilyExtended,
  prices: Price[],
  prescription: Partial<Prescription>
): { score: number; compatible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const clinicalType = (family as any).clinical_type || family.category;
  
  // Filtrar preços da família
  const familyPrices = prices.filter(p => 
    p.family_id === family.id && 
    p.active !== false && 
    !p.blocked &&
    p.price_sale_half_pair > 0
  );
  
  if (familyPrices.length === 0) {
    return { 
      score: 0, 
      compatible: false, 
      reasons: ['Sem preços ativos para esta família'] 
    };
  }
  
  // Verificar compatibilidade
  const compatiblePrices = familyPrices.filter(p => isPriceCompatible(p, prescription, clinicalType));
  
  if (compatiblePrices.length === 0) {
    return { 
      score: 0, 
      compatible: false, 
      reasons: ['Nenhum SKU compatível com a receita'] 
    };
  }
  
  // Score baseado na proporção de SKUs compatíveis
  const compatibilityRatio = compatiblePrices.length / familyPrices.length;
  let score = WEIGHTS.PRESCRIPTION * compatibilityRatio;
  
  // Bônus se todos os SKUs são compatíveis
  if (compatibilityRatio === 1) {
    score = WEIGHTS.PRESCRIPTION;
    reasons.push('Todos os SKUs compatíveis com a receita');
  } else {
    reasons.push(`${compatiblePrices.length}/${familyPrices.length} SKUs compatíveis`);
  }
  
  return { score, compatible: true, reasons };
}

/**
 * Calcula score de match com queixas visuais
 */
function calculateComplaintsScore(
  family: FamilyExtended,
  anamnesis: AnamnesisData
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const complaints = anamnesis.visualComplaints || [];
  
  if (complaints.length === 0) {
    // Sem queixas = score neutro (metade do máximo)
    return { 
      score: WEIGHTS.COMPLAINTS * 0.5, 
      reasons: ['Sem queixas visuais específicas'] 
    };
  }
  
  let matchCount = 0;
  let totalRelevant = 0;
  
  // Para cada queixa, verificar se a família tem atributos relevantes
  for (const complaint of complaints) {
    const relevantAttrs = COMPLAINT_TO_ATTRIBUTE[complaint] || [];
    if (relevantAttrs.length === 0) continue;
    
    totalRelevant++;
    
    // Verificar atributos da família
    const familyAttrs = family.attributes_base || {};
    const techRefs = family.technology_refs || [];
    
    const hasMatch = relevantAttrs.some(attr => {
      // Verificar em attributes_base
      if (familyAttrs[attr] && (familyAttrs[attr] as number) >= 2) return true;
      // Verificar em technology_refs
      if (techRefs.some(t => t.toLowerCase().includes(attr.toLowerCase()))) return true;
      return false;
    });
    
    if (hasMatch) {
      matchCount++;
      reasons.push(`Atende: ${complaint.replace('_', ' ')}`);
    }
  }
  
  if (totalRelevant === 0) {
    return { score: WEIGHTS.COMPLAINTS * 0.5, reasons: ['Queixas não mapeadas'] };
  }
  
  const matchRatio = matchCount / totalRelevant;
  const score = WEIGHTS.COMPLAINTS * matchRatio;
  
  return { score, reasons };
}

/**
 * Calcula score de adequação ao estilo de vida
 */
function calculateLifestyleScore(
  family: FamilyExtended,
  anamnesis: AnamnesisData,
  tierKey: TierKey
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = WEIGHTS.LIFESTYLE * 0.5; // Base score
  
  const primaryUse = anamnesis.primaryUse || 'mixed';
  const screenHours = anamnesis.screenHours || '3-5';
  const outdoorTime = anamnesis.outdoorTime || 'no';
  const aestheticPriority = anamnesis.aestheticPriority || 'medium';
  
  // 1. Match com uso primário
  const usePrefs = PRIMARY_USE_PREFERENCES[primaryUse];
  if (usePrefs) {
    const techRefs = family.technology_refs || [];
    const category = family.category || family.clinical_type;
    
    const hasPreferred = usePrefs.preferred.some(pref => 
      techRefs.some(t => t.toLowerCase().includes(pref.toLowerCase())) ||
      (category && category.toLowerCase().includes(pref.toLowerCase()))
    );
    
    if (hasPreferred) {
      score += 10;
      reasons.push(`Ideal para ${primaryUse}`);
    }
  }
  
  // 2. Bônus por horas de tela (para famílias com digital_comfort)
  const screenBonus = SCREEN_HOURS_BONUS[screenHours] || 0;
  const techRefs = family.technology_refs || [];
  const hasDigitalTech = techRefs.some(t => 
    t.toLowerCase().includes('blue') || 
    t.toLowerCase().includes('digital') ||
    t.toLowerCase().includes('screen')
  );
  
  if (hasDigitalTech && screenBonus > 0) {
    score += screenBonus;
    reasons.push(`+${screenBonus} pts por ${screenHours}h em telas`);
  }
  
  // 3. Match de prioridade estética com tier
  const aestheticTierMatch: Record<string, TierKey[]> = {
    'low': ['essential', 'comfort'],
    'medium': ['comfort', 'advanced'],
    'high': ['advanced', 'top'],
  };
  
  if (aestheticTierMatch[aestheticPriority]?.includes(tierKey)) {
    score += 5;
    reasons.push('Tier alinhado com prioridade estética');
  }
  
  // 4. Outdoor + fotossensível
  if (outdoorTime === 'yes') {
    const hasPhotochromic = techRefs.some(t => 
      t.toLowerCase().includes('photo') || 
      t.toLowerCase().includes('transitions')
    );
    if (hasPhotochromic) {
      score += 5;
      reasons.push('Fotossensível para atividades ao ar livre');
    }
  }
  
  // Normalizar para não exceder o máximo
  score = Math.min(score, WEIGHTS.LIFESTYLE);
  
  return { score, reasons };
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Calcula o score clínico para uma família
 */
export function calculateClinicalScore(
  family: FamilyExtended,
  prices: Price[],
  anamnesis: AnamnesisData,
  prescription: Partial<Prescription>,
  tierKey: TierKey
): ClinicalScore {
  const allReasons: string[] = [];
  
  // 1. Score de prescrição (40 pts)
  const prescriptionResult = calculatePrescriptionScore(family, prices, prescription);
  allReasons.push(...prescriptionResult.reasons);
  
  // Se incompatível com receita, retornar score zero
  if (!prescriptionResult.compatible) {
    return {
      total: 0,
      components: {
        prescriptionMatch: 0,
        complaintsMatch: 0,
        lifestyleMatch: 0,
      },
      reasons: prescriptionResult.reasons,
      flags: {
        prescriptionIncompatible: true,
        categoryMismatch: false,
      },
    };
  }
  
  // 2. Score de queixas (30 pts)
  const complaintsResult = calculateComplaintsScore(family, anamnesis);
  allReasons.push(...complaintsResult.reasons);
  
  // 3. Score de estilo de vida (30 pts)
  const lifestyleResult = calculateLifestyleScore(family, anamnesis, tierKey);
  allReasons.push(...lifestyleResult.reasons);
  
  // Total
  const total = prescriptionResult.score + complaintsResult.score + lifestyleResult.score;
  
  return {
    total: Math.round(total * 100) / 100,
    components: {
      prescriptionMatch: Math.round(prescriptionResult.score * 100) / 100,
      complaintsMatch: Math.round(complaintsResult.score * 100) / 100,
      lifestyleMatch: Math.round(lifestyleResult.score * 100) / 100,
    },
    reasons: allReasons,
    flags: {
      prescriptionIncompatible: false,
      categoryMismatch: false,
    },
  };
}

/**
 * Verifica se uma família é elegível clinicamente
 */
export function isClinicallyEligible(score: ClinicalScore): boolean {
  // Inelegível se incompatível com receita
  if (score.flags.prescriptionIncompatible) return false;
  
  // Inelegível se score muito baixo (menos de 20% do máximo)
  if (score.total < 20) return false;
  
  return true;
}

export default {
  calculateClinicalScore,
  isClinicallyEligible,
};
