/**
 * Consultation Layer — Engine Foundation
 * 
 * Bridges the multi-supplier DB structure with the recommendation engine.
 * 
 * Pipeline:
 * 1. ConsultationInput (validated) →
 * 2. SupplierBridge (DB → engine format) →
 * 3. AvailabilityResolver (FOT/Rx/constraints) →
 * 4. RecommendationEngine (scoring) →
 * 5. CommercialDecisionPrep (upgrade paths, positioning, justification)
 */

// Input Schema
export {
  type ConsultationInput,
  type PatientProfile,
  type BudgetContext,
  type ConsultationConstraints,
  type UsageGoals,
  deriveUsageGoals,
  createDefaultBudgetContext,
  createDefaultConstraints,
  validateConsultationInput,
} from './consultationSchema';

// Supplier Bridge
export {
  loadSupplierDataForEngine,
  type SupplierBridgeOutput,
  type BenefitRecord,
} from './supplierBridge';

// Treatment Resolver
export {
  loadTreatments,
  isTreatmentCompatibleWithMaterial,
  resolveFamilyTreatments,
  filterTreatmentsByConstraints,
  type TreatmentRecord,
  type TreatmentCompatibility,
  type FamilyTreatmentReport,
} from './treatmentResolver';

// Availability Resolver
export {
  checkFot,
  resolveFamilyAvailability,
  resolveFullAvailability,
  type FotCheckResult,
  type MaterialAvailability,
  type FamilyAvailabilitySummary,
  type AvailabilityReport,
} from './availabilityResolver';

// Commercial Decision Preparation
export {
  buildCommercialDecisionModel,
  type UpgradeGain,
  type UpgradePath,
  type CrossSupplierAlternative,
  type ExclusionRecord,
  type CommercialDecisionModel,
} from './commercialDecisionPrep';

// Governance Filter
export {
  applyGovernanceFilter,
  isEligibleForRecommendation,
  type GovernanceRecord,
  type GovernanceFilterResult,
} from './governanceFilter';

// ============================================
// ORCHESTRATOR
// ============================================

import type { ConsultationInput } from './consultationSchema';
import { validateConsultationInput, deriveUsageGoals, createDefaultBudgetContext, createDefaultConstraints } from './consultationSchema';
import { loadSupplierDataForEngine, type BenefitRecord } from './supplierBridge';
import { resolveFullAvailability, type AvailabilityReport } from './availabilityResolver';
import { loadTreatments, filterTreatmentsByConstraints, resolveFamilyTreatments, type TreatmentRecord, type FamilyTreatmentReport } from './treatmentResolver';
import { buildCommercialDecisionModel, type CommercialDecisionModel } from './commercialDecisionPrep';
import { generateRecommendations, type RecommendationResult, type RecommendationInput } from '@/lib/recommendationEngine';

export interface ConsultationPipelineResult {
  validation: { valid: boolean; missing: string[]; warnings: string[] };
  availability: AvailabilityReport | null;
  /** Treatment compatibility reports per family */
  treatmentReports: FamilyTreatmentReport[];
  recommendations: RecommendationResult | null;
  commercialModel: CommercialDecisionModel | null;
  /** Benefits loaded from DB for narrative use */
  benefits: BenefitRecord[];
  meta: {
    pipelineStartMs: number;
    pipelineEndMs: number;
    durationMs: number;
    suppliersLoaded: string[];
    familiesLoaded: number;
    pricesLoaded: number;
    treatmentsLoaded: number;
  };
}

/**
 * Runs the full consultation pipeline:
 * Validate → Load Data → Check Availability → Score → Prepare Decisions
 */
export async function runConsultationPipeline(
  input: ConsultationInput
): Promise<ConsultationPipelineResult> {
  const startMs = Date.now();

  // Step 1: Validate
  const validation = validateConsultationInput(input);
  if (!validation.valid) {
    return {
      validation,
      availability: null,
      treatmentReports: [],
      recommendations: null,
      commercialModel: null,
      benefits: [],
      meta: {
        pipelineStartMs: startMs,
        pipelineEndMs: Date.now(),
        durationMs: Date.now() - startMs,
        suppliersLoaded: [],
        familiesLoaded: 0,
        pricesLoaded: 0,
        treatmentsLoaded: 0,
      },
    };
  }

  // Step 2: Load supplier data from DB
  const supplierCodes = input.constraints.allowedSuppliers?.length
    ? input.constraints.allowedSuppliers
    : undefined;

  const [bridgeData, allTreatments] = await Promise.all([
    loadSupplierDataForEngine(input.clinicalType, supplierCodes),
    loadTreatments(supplierCodes),
  ]);

  // Step 3: Resolve availability (FOT, Rx, constraints)
  const availability = resolveFullAvailability(
    bridgeData.families,
    bridgeData.prices,
    input.prescription,
    input.frame || null,
    input.constraints
  );

  // Step 3b: Resolve treatment compatibility per family
  const treatmentReports: FamilyTreatmentReport[] = [];
  const defaultMaterialIndex = input.constraints.requiredMaterialIndex || '1.50';

  for (const family of bridgeData.families) {
    const familyTreatmentIds = (family as any).treatment_ids || [];
    const report = resolveFamilyTreatments(
      family.id,
      familyTreatmentIds,
      defaultMaterialIndex,
      family.supplier,
      allTreatments
    );
    treatmentReports.push(report);
  }

  // Step 4: Run recommendation engine
  const engineInput: RecommendationInput = {
    clinicalType: input.clinicalType,
    anamnesis: input.anamnesis,
    prescription: input.prescription,
    families: bridgeData.families,
    prices: bridgeData.prices,
    technologyLibrary: bridgeData.technologyLibrary,
    supplierPriorities: input.supplierPriorities,
    clinicalEligibilityMode: input.clinicalEligibilityMode,
    storePriorities: input.supplierPriorities,
    frame: input.frame,
    filters: {
      suppliers: input.constraints.allowedSuppliers,
      excludeFamilyIds: input.constraints.excludedFamilyIds,
      minPrice: input.budget.minBudget,
      maxPrice: input.budget.maxBudget,
    },
  };

  const recommendations = generateRecommendations(engineInput);

  // Step 5: Build commercial decision model with benefits
  const allScored = Object.values(recommendations.tiers).flatMap(tier => {
    const families = [];
    if (tier.primary) families.push(tier.primary);
    families.push(...tier.alternatives);
    return families;
  });

  const commercialModel = buildCommercialDecisionModel(
    allScored,
    availability.families,
    input.usageGoals,
    input.budget,
    bridgeData.technologyLibrary
  );

  const endMs = Date.now();

  console.log(
    `[ConsultationPipeline] Completed in ${endMs - startMs}ms | ` +
    `${bridgeData.meta.familiesLoaded} families, ${bridgeData.meta.pricesLoaded} prices, ` +
    `${allTreatments.length} treatments, ` +
    `${availability.stats.totalAvailable} available, ` +
    `${recommendations.stats.totalEligible} eligible`
  );

  return {
    validation,
    availability,
    treatmentReports,
    recommendations,
    commercialModel,
    benefits: bridgeData.benefits,
    meta: {
      pipelineStartMs: startMs,
      pipelineEndMs: endMs,
      durationMs: endMs - startMs,
      suppliersLoaded: bridgeData.meta.suppliers,
      familiesLoaded: bridgeData.meta.familiesLoaded,
      pricesLoaded: bridgeData.meta.pricesLoaded,
      treatmentsLoaded: allTreatments.length,
    },
  };
}
