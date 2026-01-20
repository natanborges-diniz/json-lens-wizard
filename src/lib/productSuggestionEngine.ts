import type { AnamnesisData, Family, Prescription } from '@/types/lens';

// Product types that can be added to the cart
export type ProductType = 'primary' | 'occupational' | 'solar';

// Suggestion strength based on anamnesis match
export type SuggestionStrength = 'high' | 'medium' | 'low';

// Product suggestion with reason and strength
export interface ProductSuggestion {
  type: ProductType;
  reason: string;
  strength: SuggestionStrength;
  icon: string;
  families: Family[];
}

// Selected product in the cart
export interface SelectedProduct {
  id: string;
  type: ProductType;
  familyId: string;
  familyName: string;
  supplier: string;
  selectedIndex: string;
  selectedTreatments: string[];
  unitPrice: number;
  label: string;
  // Price details for budget
  selectedPriceErpCode?: string;
}

/**
 * Generate product suggestions based on anamnesis data
 */
export function generateProductSuggestions(
  anamnesis: AnamnesisData,
  prescription: Partial<Prescription>,
  availableFamilies: Family[]
): ProductSuggestion[] {
  const suggestions: ProductSuggestion[] = [];

  // ==========================================
  // OCCUPATIONAL SUGGESTION
  // ==========================================
  const highScreenUsage = anamnesis.screenHours === '6-8' || anamnesis.screenHours === '8+';
  const computerPrimaryUse = anamnesis.primaryUse === 'computer';
  const hasDigitalFatigue = 
    anamnesis.visualComplaints.includes('eye_fatigue') || 
    anamnesis.visualComplaints.includes('end_day_fatigue');
  const workPrimaryUse = anamnesis.primaryUse === 'work';

  // Calculate occupational score
  let occupationalScore = 0;
  if (highScreenUsage) occupationalScore += 3;
  if (computerPrimaryUse) occupationalScore += 2;
  if (hasDigitalFatigue) occupationalScore += 2;
  if (workPrimaryUse) occupationalScore += 1;

  if (occupationalScore >= 2) {
    // Filter occupational families
    const occupationalFamilies = availableFamilies.filter(f => 
      f.category === 'OCUPACIONAL' && f.active
    );

    // Determine reason and strength
    let reason = '';
    let strength: SuggestionStrength = 'low';

    if (occupationalScore >= 5) {
      strength = 'high';
      reason = highScreenUsage 
        ? `Você passa ${anamnesis.screenHours === '8+' ? 'mais de 8' : '6-8'} horas por dia em telas`
        : 'Uso intenso de computador e fadiga visual relatada';
    } else if (occupationalScore >= 3) {
      strength = 'medium';
      reason = computerPrimaryUse 
        ? 'Uso principal é computador/trabalho'
        : hasDigitalFatigue
          ? 'Fadiga visual ao final do dia'
          : 'Perfil indica uso intenso de telas';
    } else {
      strength = 'low';
      reason = 'Pode beneficiar de uma lente para trabalho';
    }

    suggestions.push({
      type: 'occupational',
      reason,
      strength,
      icon: 'Monitor',
      families: occupationalFamilies,
    });
  }

  // ==========================================
  // SOLAR SUGGESTION
  // ==========================================
  const outdoorTime = anamnesis.outdoorTime === 'yes';
  const lightSensitivity = anamnesis.visualComplaints.includes('light_sensitivity');
  const drivingFrequent = anamnesis.nightDriving === 'frequent';
  const drivingPrimary = anamnesis.primaryUse === 'driving';
  const outdoorPrimary = anamnesis.primaryUse === 'outdoor';

  // Calculate solar score
  let solarScore = 0;
  if (outdoorTime) solarScore += 2;
  if (lightSensitivity) solarScore += 3;
  if (drivingPrimary || outdoorPrimary) solarScore += 2;
  if (drivingFrequent) solarScore += 1;

  if (solarScore >= 2) {
    let reason = '';
    let strength: SuggestionStrength = 'low';

    if (solarScore >= 4) {
      strength = 'high';
      reason = lightSensitivity 
        ? 'Sensibilidade à luz relatada - proteção essencial'
        : 'Atividades frequentes ao ar livre e/ou direção';
    } else if (solarScore >= 3) {
      strength = 'medium';
      reason = outdoorTime
        ? 'Atividades frequentes ao ar livre'
        : 'Perfil indica necessidade de proteção solar';
    } else {
      strength = 'low';
      reason = 'Pode beneficiar de lentes solares para ocasiões específicas';
    }

    suggestions.push({
      type: 'solar',
      reason,
      strength,
      icon: 'Sun',
      families: [], // Solar uses same family with coloring
    });
  }

  // Sort by strength (high first)
  const strengthOrder: Record<SuggestionStrength, number> = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => strengthOrder[a.strength] - strengthOrder[b.strength]);

  return suggestions;
}

/**
 * Generate a unique ID for a product in the cart
 */
export function generateProductId(): string {
  return `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate total price for all products in cart
 */
export function calculateCartTotal(products: SelectedProduct[]): number {
  return products.reduce((total, product) => total + product.unitPrice, 0);
}

/**
 * Check if a product type is already in the cart
 */
export function hasProductType(products: SelectedProduct[], type: ProductType): boolean {
  return products.some(p => p.type === type);
}

/**
 * Get product type label for display
 */
export function getProductTypeLabel(type: ProductType): string {
  switch (type) {
    case 'primary':
      return 'Lente Principal';
    case 'occupational':
      return 'Lente de Escritório';
    case 'solar':
      return 'Lente Solar';
    default:
      return 'Produto Adicional';
  }
}
