/**
 * ConsultationInput Schema
 * 
 * Unified typed input for the recommendation engine that bridges
 * patient/customer data with the multi-supplier DB structure.
 * 
 * This replaces the ad-hoc prop passing in useRecommendationEngine
 * with a single validated object that flows through the entire pipeline.
 */

import type {
  ClinicalType,
  AnamnesisData,
  Prescription,
  FrameMeasurements,
} from '@/types/lens';

// ============================================
// PATIENT / CUSTOMER PROFILE
// ============================================

export interface PatientProfile {
  /** Customer ID from DB (optional for anonymous consultations) */
  customerId?: string;
  name?: string;
  age?: number;
  occupation?: string;
}

// ============================================
// BUDGET / COMMERCIAL CONTEXT
// ============================================

export interface BudgetContext {
  /** Max budget the customer communicated (optional) */
  maxBudget?: number;
  /** Min budget floor (e.g. store minimum) */
  minBudget?: number;
  /** Currency code */
  currency: string;
  /** Payment method preference (affects discount eligibility) */
  paymentPreference?: 'cash' | 'credit' | 'pix' | 'installment';
  /** Number of installments if credit */
  installments?: number;
  /** Second pair interest */
  secondPairInterest: boolean;
}

// ============================================
// CONSTRAINTS
// ============================================

export interface ConsultationConstraints {
  /** Explicit supplier restrictions (only show these) */
  allowedSuppliers?: string[];
  /** Explicit supplier exclusions */
  excludedSuppliers?: string[];
  /** Explicit family exclusions by ID */
  excludedFamilyIds?: string[];
  /** Required treatment types (e.g. customer wants photochromic) */
  requiredTreatmentTypes?: string[];
  /** Required material index (e.g. customer wants 1.74) */
  requiredMaterialIndex?: string;
  /** Lens state preference */
  lensStatePreference?: 'clear' | 'photochromic' | 'polarized' | 'any';
}

// ============================================
// USAGE GOALS (from anamnesis enrichment)
// ============================================

export interface UsageGoals {
  /** Primary clinical need derived from anamnesis + Rx */
  clinicalType: ClinicalType;
  /** Whether the patient needs distance, near, or both */
  visionRange: 'distance' | 'near' | 'intermediate' | 'all';
  /** Digital device intensity (derived from screenHours) */
  digitalIntensity: 'low' | 'moderate' | 'high' | 'extreme';
  /** Outdoor exposure level */
  outdoorExposure: 'minimal' | 'moderate' | 'high';
  /** Aesthetic sensitivity */
  aestheticSensitivity: 'low' | 'medium' | 'high';
  /** Night driving relevance */
  nightDrivingRelevant: boolean;
}

// ============================================
// MAIN CONSULTATION INPUT
// ============================================

export interface ConsultationInput {
  /** Unique consultation/service ID */
  serviceId?: string;
  /** Store context */
  storeId?: string;
  /** Seller ID */
  sellerId?: string;

  // --- Core clinical data ---
  /** Patient profile */
  patient: PatientProfile;
  /** Anamnesis data (from the anamnesis flow) */
  anamnesis: AnamnesisData;
  /** Prescription data */
  prescription: Partial<Prescription>;
  /** Frame measurements (for FOT/diameter/height gates) */
  frame?: FrameMeasurements;

  // --- Derived context ---
  /** Resolved clinical type (from anamnesis or manual selection) */
  clinicalType: ClinicalType;
  /** Derived usage goals */
  usageGoals: UsageGoals;

  // --- Commercial context ---
  /** Budget and payment context */
  budget: BudgetContext;
  /** Constraints and preferences */
  constraints: ConsultationConstraints;

  // --- Engine configuration ---
  /** Clinical eligibility mode */
  clinicalEligibilityMode: 'permissive' | 'strict';
  /** Supplier priorities (store-level overrides global) */
  supplierPriorities: string[];
}

// ============================================
// FACTORY / BUILDERS
// ============================================

/**
 * Derives UsageGoals from raw anamnesis data.
 * Pure function — no DB calls.
 */
export function deriveUsageGoals(
  anamnesis: AnamnesisData,
  clinicalType: ClinicalType
): UsageGoals {
  // Map screenHours to digital intensity
  const digitalMap: Record<string, UsageGoals['digitalIntensity']> = {
    '0-2': 'low',
    '3-5': 'moderate',
    '6-8': 'high',
    '8+': 'extreme',
  };

  // Determine vision range from clinical type
  const visionRangeMap: Record<ClinicalType, UsageGoals['visionRange']> = {
    'MONOFOCAL': anamnesis.primaryUse === 'reading' ? 'near' : 'distance',
    'PROGRESSIVA': 'all',
    'OCUPACIONAL': 'intermediate',
    'BIFOCAL': 'all',
  };

  return {
    clinicalType,
    visionRange: visionRangeMap[clinicalType] || 'all',
    digitalIntensity: digitalMap[anamnesis.screenHours] || 'moderate',
    outdoorExposure: anamnesis.outdoorTime === 'yes' ? 'high' : 'minimal',
    aestheticSensitivity: anamnesis.aestheticPriority || 'medium',
    nightDrivingRelevant: anamnesis.nightDriving === 'frequent',
  };
}

/**
 * Creates a default BudgetContext when no budget info is provided.
 */
export function createDefaultBudgetContext(): BudgetContext {
  return {
    currency: 'BRL',
    secondPairInterest: false,
  };
}

/**
 * Creates a default ConsultationConstraints when no constraints are provided.
 */
export function createDefaultConstraints(): ConsultationConstraints {
  return {
    lensStatePreference: 'any',
  };
}

/**
 * Validates that a ConsultationInput has minimum required data to run the engine.
 */
export function validateConsultationInput(input: Partial<ConsultationInput>): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  if (!input.clinicalType) missing.push('clinicalType');
  if (!input.anamnesis) missing.push('anamnesis');
  if (!input.prescription) {
    missing.push('prescription');
  } else {
    // Check if prescription has meaningful values
    const rx = input.prescription;
    const hasValues = (rx.rightSphere != null && rx.rightSphere !== 0) ||
                      (rx.leftSphere != null && rx.leftSphere !== 0);
    if (!hasValues) warnings.push('Receita sem valores de esférico — usando 0.00');
  }

  if (!input.frame) {
    warnings.push('Sem dados de armação — gates de diâmetro/altura desativados');
  } else {
    if (!input.frame.horizontalSize || !input.frame.bridge) {
      warnings.push('Armação sem tamanho horizontal ou ponte — FOT parcial');
    }
    if (!input.frame.dp && !input.frame.dnpOD) {
      warnings.push('Sem DP/DNP — cálculo de diâmetro usando fallback');
    }
  }

  if (input.clinicalType === 'PROGRESSIVA' || input.clinicalType === 'OCUPACIONAL') {
    const maxAdd = Math.max(
      input.prescription?.rightAddition ?? 0,
      input.prescription?.leftAddition ?? 0
    );
    if (maxAdd <= 0) {
      warnings.push(`Tipo clínico ${input.clinicalType} sem valor de adição na receita`);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}
