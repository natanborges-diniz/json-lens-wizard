/**
 * Commercial Decision Preparation
 * 
 * Prepares the data model for commercial recommendation paths:
 * - Base recommendation (best clinical+commercial match)
 * - Upgrade recommendation (next tier with justification)
 * - Cross-supplier positioning (canonical equivalences)
 * - Gain justification (what the customer gets by upgrading)
 * - Exclusion reasons (why certain families were dropped)
 * 
 * This layer does NOT generate final text — it prepares structured
 * decision data that the narrative engine will consume.
 */

import type { FamilyExtended, Technology, Price } from '@/types/lens';
import type { ScoredFamily, TierKey } from '@/lib/recommendationEngine/types';
import type { FamilyAvailabilitySummary } from './availabilityResolver';
import type { BudgetContext, UsageGoals } from './consultationSchema';

// ============================================
// TYPES
// ============================================

export interface UpgradeGain {
  /** What the customer gains by upgrading */
  axis: string;
  /** Delta value (higher = more gain) */
  delta: number;
  /** Human-readable description of the gain */
  description: string;
  /** Category: clinical, comfort, aesthetic, durability */
  category: 'clinical' | 'comfort' | 'aesthetic' | 'durability';
}

export interface UpgradePath {
  /** From family */
  fromFamilyId: string;
  fromFamilyName: string;
  fromTier: TierKey;
  fromPrice: number | null;
  /** To family */
  toFamilyId: string;
  toFamilyName: string;
  toTier: TierKey;
  toPrice: number | null;
  /** Price difference (pair) */
  priceDelta: number | null;
  /** What the customer gains */
  gains: UpgradeGain[];
  /** Upgrade strength: minor, moderate, significant */
  strength: 'minor' | 'moderate' | 'significant';
  /** Technologies gained */
  technologiesGained: string[];
}

export interface CrossSupplierAlternative {
  /** The reference family */
  referenceFamilyId: string;
  referenceFamilyName: string;
  referenceSupplier: string;
  /** The alternative from another supplier */
  alternativeFamilyId: string;
  alternativeFamilyName: string;
  alternativeSupplier: string;
  /** Price comparison */
  referencePricePair: number | null;
  alternativePricePair: number | null;
  priceDelta: number | null;
  /** Canonical group they share */
  canonicalGroupName?: string;
  /** Confidence level of the equivalence */
  equivalenceConfidence: 'low' | 'medium' | 'high';
}

export interface ExclusionRecord {
  familyId: string;
  familyName: string;
  supplier: string;
  reason: string;
  stage: 'rx_incompatible' | 'fot_incompatible' | 'no_price' | 'constraint_excluded' | 'low_score';
}

export interface CommercialDecisionModel {
  /** Best recommendation per tier */
  tierWinners: Record<TierKey, ScoredFamily | null>;
  /** Upgrade paths from each tier to the next */
  upgradePaths: UpgradePath[];
  /** Cross-supplier alternatives for the top recommendation */
  crossSupplierAlternatives: CrossSupplierAlternative[];
  /** All exclusion reasons */
  exclusions: ExclusionRecord[];
  /** Budget fit analysis */
  budgetAnalysis: {
    /** Families within budget */
    withinBudget: string[];
    /** Families above budget */
    aboveBudget: string[];
    /** Best value family (highest score within budget) */
    bestValueFamilyId: string | null;
    /** Premium option (highest score regardless of budget) */
    premiumFamilyId: string | null;
  };
  /** Index upgrade suggestions */
  indexUpgrades: Array<{
    familyId: string;
    currentIndex: string;
    suggestedIndex: string;
    priceDelta: number;
    aestheticGain: number;
    reason: string;
  }>;
}

// ============================================
// MAIN BUILDER
// ============================================

/**
 * Builds the commercial decision model from scored families and availability data.
 */
export function buildCommercialDecisionModel(
  scoredFamilies: ScoredFamily[],
  availabilityReport: FamilyAvailabilitySummary[],
  usageGoals: UsageGoals,
  budgetContext: BudgetContext,
  technologyLibrary: Record<string, Technology>
): CommercialDecisionModel {
  // 1. Determine tier winners
  const tierWinners = determineTierWinners(scoredFamilies);

  // 2. Build upgrade paths between adjacent tiers
  const upgradePaths = buildUpgradePaths(tierWinners, technologyLibrary);

  // 3. Find cross-supplier alternatives for top families
  const crossSupplierAlternatives = findCrossSupplierAlternatives(scoredFamilies);

  // 4. Collect exclusion records
  const exclusions = collectExclusions(scoredFamilies, availabilityReport);

  // 5. Budget analysis
  const budgetAnalysis = analyzeBudget(scoredFamilies, budgetContext);

  // 6. Index upgrades
  const indexUpgrades = suggestIndexUpgrades(scoredFamilies, availabilityReport, usageGoals);

  return {
    tierWinners,
    upgradePaths,
    crossSupplierAlternatives,
    exclusions,
    budgetAnalysis,
    indexUpgrades,
  };
}

// ============================================
// TIER WINNERS
// ============================================

function determineTierWinners(
  scoredFamilies: ScoredFamily[]
): Record<TierKey, ScoredFamily | null> {
  const winners: Record<TierKey, ScoredFamily | null> = {
    essential: null,
    comfort: null,
    advanced: null,
    top: null,
  };

  const eligible = scoredFamilies.filter(sf => sf.score.isEligible);

  for (const tier of ['essential', 'comfort', 'advanced', 'top'] as TierKey[]) {
    const inTier = eligible.filter(sf => sf.score.tierKey === tier);
    if (inTier.length > 0) {
      winners[tier] = inTier.reduce((best, sf) =>
        sf.score.adjustedScore > best.score.adjustedScore ? sf : best
      );
    }
  }

  return winners;
}

// ============================================
// UPGRADE PATHS
// ============================================

function buildUpgradePaths(
  tierWinners: Record<TierKey, ScoredFamily | null>,
  technologyLibrary: Record<string, Technology>
): UpgradePath[] {
  const paths: UpgradePath[] = [];
  const tierOrder: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];

  for (let i = 0; i < tierOrder.length - 1; i++) {
    const from = tierWinners[tierOrder[i]];
    const to = tierWinners[tierOrder[i + 1]];
    if (!from || !to) continue;

    const gains = calculateGains(from, to, technologyLibrary);
    const technologiesGained = findNewTechnologies(from, to);
    const priceDelta = (from.startingPrice != null && to.startingPrice != null)
      ? to.startingPrice - from.startingPrice
      : null;

    const totalGainScore = gains.reduce((sum, g) => sum + g.delta, 0);
    const strength: UpgradePath['strength'] = 
      totalGainScore > 6 ? 'significant' :
      totalGainScore > 3 ? 'moderate' : 'minor';

    paths.push({
      fromFamilyId: from.family.id,
      fromFamilyName: from.family.display_name || from.family.name_original,
      fromTier: tierOrder[i],
      fromPrice: from.startingPrice,
      toFamilyId: to.family.id,
      toFamilyName: to.family.display_name || to.family.name_original,
      toTier: tierOrder[i + 1],
      toPrice: to.startingPrice,
      priceDelta,
      gains,
      strength,
      technologiesGained,
    });
  }

  return paths;
}

function calculateGains(
  from: ScoredFamily,
  to: ScoredFamily,
  technologyLibrary: Record<string, Technology>
): UpgradeGain[] {
  const gains: UpgradeGain[] = [];

  // Clinical score gain
  const clinicalDelta = to.score.clinical.total - from.score.clinical.total;
  if (clinicalDelta > 5) {
    gains.push({
      axis: 'clinical_fit',
      delta: Math.round(clinicalDelta),
      description: 'Melhor adequação clínica à receita',
      category: 'clinical',
    });
  }

  // Compare value axes if both families have them
  const fromAxes = (from.family as any).value_axes || from.family.attributes_base || {};
  const toAxes = (to.family as any).value_axes || to.family.attributes_base || {};

  const axisLabels: Record<string, { description: string; category: UpgradeGain['category'] }> = {
    'campo_visual': { description: 'Campo visual mais amplo', category: 'comfort' },
    'adaptacao': { description: 'Adaptação mais rápida', category: 'comfort' },
    'nitidez': { description: 'Maior nitidez', category: 'clinical' },
    'conforto_digital': { description: 'Melhor conforto em telas', category: 'comfort' },
    'estetica': { description: 'Melhor estética (lente mais fina)', category: 'aesthetic' },
    'durabilidade': { description: 'Maior durabilidade', category: 'durability' },
    'personalizacao': { description: 'Maior personalização', category: 'clinical' },
  };

  for (const [axis, config] of Object.entries(axisLabels)) {
    const fromVal = (fromAxes[axis] as number) || 0;
    const toVal = (toAxes[axis] as number) || 0;
    if (toVal > fromVal) {
      gains.push({
        axis,
        delta: toVal - fromVal,
        description: config.description,
        category: config.category,
      });
    }
  }

  // Technology gains
  const newTechs = findNewTechnologies(from, to);
  for (const techId of newTechs.slice(0, 3)) {
    const tech = technologyLibrary[techId];
    if (tech) {
      gains.push({
        axis: `tech_${techId}`,
        delta: 1,
        description: `Tecnologia: ${tech.name_common}`,
        category: 'clinical',
      });
    }
  }

  return gains;
}

function findNewTechnologies(from: ScoredFamily, to: ScoredFamily): string[] {
  const fromTechs = new Set(from.family.technology_refs || []);
  const toTechs = to.family.technology_refs || [];
  return toTechs.filter(t => !fromTechs.has(t));
}

// ============================================
// CROSS-SUPPLIER ALTERNATIVES
// ============================================

function findCrossSupplierAlternatives(
  scoredFamilies: ScoredFamily[]
): CrossSupplierAlternative[] {
  const alternatives: CrossSupplierAlternative[] = [];
  const eligible = scoredFamilies.filter(sf => sf.score.isEligible);

  // Group by tier
  const byTier = new Map<TierKey, ScoredFamily[]>();
  for (const sf of eligible) {
    if (!byTier.has(sf.score.tierKey)) byTier.set(sf.score.tierKey, []);
    byTier.get(sf.score.tierKey)!.push(sf);
  }

  // For each tier, find cross-supplier pairs
  byTier.forEach(families => {
    if (families.length < 2) return;

    // Use the best family as reference
    const sorted = [...families].sort((a, b) => b.score.adjustedScore - a.score.adjustedScore);
    const reference = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      const alt = sorted[i];
      if (alt.family.supplier === reference.family.supplier) continue;

      alternatives.push({
        referenceFamilyId: reference.family.id,
        referenceFamilyName: reference.family.display_name || reference.family.name_original,
        referenceSupplier: reference.family.supplier,
        alternativeFamilyId: alt.family.id,
        alternativeFamilyName: alt.family.display_name || alt.family.name_original,
        alternativeSupplier: alt.family.supplier,
        referencePricePair: reference.startingPrice,
        alternativePricePair: alt.startingPrice,
        priceDelta: (reference.startingPrice != null && alt.startingPrice != null)
          ? alt.startingPrice - reference.startingPrice
          : null,
        equivalenceConfidence: 'medium',
      });
    }
  });

  return alternatives;
}

// ============================================
// EXCLUSIONS
// ============================================

function collectExclusions(
  scoredFamilies: ScoredFamily[],
  availabilityReport: FamilyAvailabilitySummary[]
): ExclusionRecord[] {
  const exclusions: ExclusionRecord[] = [];

  // From scored families: those with low score or ineligible
  for (const sf of scoredFamilies) {
    if (!sf.score.isEligible) {
      exclusions.push({
        familyId: sf.family.id,
        familyName: sf.family.display_name || sf.family.name_original,
        supplier: sf.family.supplier,
        reason: sf.score.ineligibilityReason || 'Score insuficiente',
        stage: sf.score.clinical.flags.prescriptionIncompatible ? 'rx_incompatible' : 'low_score',
      });
    }
  }

  // From availability report: those not available
  for (const summary of availabilityReport) {
    if (!summary.isAvailable) {
      const existsInScored = scoredFamilies.some(sf => sf.family.id === summary.familyId);
      if (!existsInScored) {
        exclusions.push({
          familyId: summary.familyId,
          familyName: summary.familyName,
          supplier: summary.supplier,
          reason: summary.unavailableReason || 'Indisponível',
          stage: summary.totalPrices === 0 ? 'no_price' :
                 summary.rxCompatiblePrices === 0 ? 'rx_incompatible' :
                 'fot_incompatible',
        });
      }
    }
  }

  return exclusions;
}

// ============================================
// BUDGET ANALYSIS
// ============================================

function analyzeBudget(
  scoredFamilies: ScoredFamily[],
  budgetContext: BudgetContext
): CommercialDecisionModel['budgetAnalysis'] {
  const eligible = scoredFamilies.filter(sf => sf.score.isEligible && sf.startingPrice != null);

  const withinBudget: string[] = [];
  const aboveBudget: string[] = [];

  for (const sf of eligible) {
    if (budgetContext.maxBudget && sf.startingPrice! > budgetContext.maxBudget) {
      aboveBudget.push(sf.family.id);
    } else {
      withinBudget.push(sf.family.id);
    }
  }

  // Best value: highest score within budget
  const budgetEligible = eligible.filter(sf =>
    !budgetContext.maxBudget || sf.startingPrice! <= budgetContext.maxBudget
  );
  const bestValue = budgetEligible.length > 0
    ? budgetEligible.reduce((best, sf) =>
        sf.score.adjustedScore > best.score.adjustedScore ? sf : best
      )
    : null;

  // Premium: highest score regardless
  const premium = eligible.length > 0
    ? eligible.reduce((best, sf) =>
        sf.score.adjustedScore > best.score.adjustedScore ? sf : best
      )
    : null;

  return {
    withinBudget,
    aboveBudget,
    bestValueFamilyId: bestValue?.family.id || null,
    premiumFamilyId: premium?.family.id || null,
  };
}

// ============================================
// INDEX UPGRADES
// ============================================

function suggestIndexUpgrades(
  scoredFamilies: ScoredFamily[],
  availabilityReport: FamilyAvailabilitySummary[],
  usageGoals: UsageGoals
): CommercialDecisionModel['indexUpgrades'] {
  const suggestions: CommercialDecisionModel['indexUpgrades'] = [];
  const indexOrder = ['1.50', '1.53', '1.56', '1.59', '1.60', '1.67', '1.74'];

  for (const sf of scoredFamilies) {
    if (!sf.score.isEligible) continue;

    const availability = availabilityReport.find(a => a.familyId === sf.family.id);
    if (!availability) continue;

    // Find cheapest index that's available
    const cheapestPrice = sf.compatiblePrices
      .sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0];
    if (!cheapestPrice) continue;

    const currentIndex = cheapestPrice.index || '1.50';
    const currentPos = indexOrder.indexOf(currentIndex);
    if (currentPos === -1 || currentPos >= indexOrder.length - 1) continue;

    // Check if next index is available
    for (let i = currentPos + 1; i < indexOrder.length; i++) {
      const nextIndex = indexOrder[i];
      const nextMaterial = availability.materials.find(m => m.index === nextIndex && m.available);
      if (!nextMaterial || nextMaterial.minPrice === null) continue;

      const priceDelta = (nextMaterial.minPrice * 2) - (cheapestPrice.price_sale_half_pair * 2);

      // Only suggest if aesthetic sensitivity warrants it
      if (usageGoals.aestheticSensitivity === 'low' && priceDelta > 200) break;

      const aestheticGain = i - currentPos;

      suggestions.push({
        familyId: sf.family.id,
        currentIndex,
        suggestedIndex: nextIndex,
        priceDelta,
        aestheticGain,
        reason: aestheticGain >= 2
          ? 'Redução significativa de espessura'
          : 'Lente mais fina e leve',
      });

      break; // Only suggest the next step up
    }
  }

  return suggestions;
}
