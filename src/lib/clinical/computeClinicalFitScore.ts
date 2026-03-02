/**
 * ClinicalFitScore (0–100)
 * 
 * Computed ONLY for SKUs that passed all eligibility gates.
 * Penalizes lenses where Rx values are near physical limits.
 * Used as bonus for ranking within eligible set, never to re-admit rejected SKUs.
 */

import type { Price, Prescription, FrameMeasurements } from '@/types/lens';
import { calcRequiredDiameter, type PupillaryData } from './calcRequiredDiameter';
import { resolveProductKind } from './resolveProductKind';

export interface ClinicalFitResult {
  score: number; // 0-100, 100 = perfect fit
  penalties: {
    sphereNearLimit: number;
    cylinderNearLimit: number;
    additionNearLimit: number;
    diameterTight: number;
    heightUnknown: number;
    dnpMissing: number;
  };
  reasons: string[];
}

/**
 * Compute how well a SKU fits the Rx/frame, assuming it already passed gates.
 */
export function computeClinicalFitScore(
  sku: Price,
  rx: Partial<Prescription>,
  frame: FrameMeasurements | null,
  pd: PupillaryData | null
): ClinicalFitResult {
  let score = 100;
  const penalties: ClinicalFitResult['penalties'] = {
    sphereNearLimit: 0,
    cylinderNearLimit: 0,
    additionNearLimit: 0,
    diameterTight: 0,
    heightUnknown: 0,
    dnpMissing: 0,
  };
  const reasons: string[] = [];

  const specs = sku.specs;
  if (!specs) {
    return { score: 50, penalties, reasons: ['Sem specs — fit score neutro'] };
  }

  // --- Sphere margin ---
  const maxRxSphere = Math.max(Math.abs(rx.rightSphere ?? 0), Math.abs(rx.leftSphere ?? 0));
  if (specs.sphere_min != null && specs.sphere_max != null) {
    const range = Math.abs(specs.sphere_max) + Math.abs(specs.sphere_min);
    if (range > 0) {
      const limit = Math.max(Math.abs(specs.sphere_min), Math.abs(specs.sphere_max));
      const margin = limit - maxRxSphere;
      const marginPct = margin / (range / 2);
      const p = computeMarginPenalty(marginPct);
      if (p > 0) {
        penalties.sphereNearLimit = p;
        score -= p;
        reasons.push(`Esfera perto do limite (margem ${(marginPct * 100).toFixed(0)}%): -${p}`);
      }
    }
  }

  // --- Cylinder margin ---
  const maxRxCyl = Math.max(Math.abs(rx.rightCylinder ?? 0), Math.abs(rx.leftCylinder ?? 0));
  if (specs.cyl_min != null) {
    const cylLimit = Math.abs(specs.cyl_min);
    if (cylLimit > 0) {
      const margin = cylLimit - maxRxCyl;
      const marginPct = margin / cylLimit;
      const p = computeMarginPenalty(marginPct);
      if (p > 0) {
        penalties.cylinderNearLimit = p;
        score -= p;
        reasons.push(`Cilindro perto do limite (margem ${(marginPct * 100).toFixed(0)}%): -${p}`);
      }
    }
  }

  // --- Addition margin ---
  const maxRxAdd = Math.max(rx.rightAddition ?? 0, rx.leftAddition ?? 0);
  if (maxRxAdd > 0 && specs.add_min != null && specs.add_max != null) {
    const addRange = specs.add_max - specs.add_min;
    if (addRange > 0) {
      const marginToMax = specs.add_max - maxRxAdd;
      const marginToMin = maxRxAdd - specs.add_min;
      const closestMargin = Math.min(marginToMax, marginToMin);
      const marginPct = closestMargin / (addRange / 2);
      const p = computeMarginPenalty(marginPct);
      if (p > 0) {
        penalties.additionNearLimit = p;
        score -= p;
        reasons.push(`Adição perto do limite (margem ${(marginPct * 100).toFixed(0)}%): -${p}`);
      }
    }
  }

  // --- Diameter margin ---
  if (frame && frame.horizontalSize > 0 && frame.bridge > 0) {
    const effectivePd: PupillaryData = pd || {
      dnpOD: (frame as any).dnpOD,
      dnpOE: (frame as any).dnpOE,
      dp: frame.dp,
    };
    const diamCalc = calcRequiredDiameter(
      { horizontalSize: frame.horizontalSize, verticalSize: frame.verticalSize, bridge: frame.bridge },
      effectivePd
    );
    const skuDiamMax = specs.diameter_max_mm;
    if (skuDiamMax && skuDiamMax > 0) {
      const diamMargin = skuDiamMax - diamCalc.maxRequired;
      if (diamMargin < 2) {
        penalties.diameterTight = 20;
        score -= 20;
        reasons.push(`Diâmetro muito justo (margem ${diamMargin.toFixed(1)}mm): -20`);
      } else if (diamMargin < 5) {
        penalties.diameterTight = 10;
        score -= 10;
        reasons.push(`Diâmetro no limite (margem ${diamMargin.toFixed(1)}mm): -10`);
      } else if (diamMargin < 10) {
        penalties.diameterTight = 5;
        score -= 5;
        reasons.push(`Diâmetro apertado (margem ${diamMargin.toFixed(1)}mm): -5`);
      }
    }

    // DNP missing penalty
    if (diamCalc.debug.methodUsed === 'fallback_no_pd') {
      penalties.dnpMissing = 5;
      score -= 5;
      reasons.push('DNP/DP não informado: -5');
    }
  }

  // --- Height unknown for PR/OC ---
  const pk = resolveProductKind(sku);
  if ((pk.kind === 'PR' || pk.kind === 'OC') && (!frame || !frame.altura || frame.altura <= 0)) {
    penalties.heightUnknown = 10;
    score -= 10;
    reasons.push('Altura de montagem não informada para progressiva/ocupacional: -10');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    penalties,
    reasons,
  };
}

/**
 * Maps margin percentage to penalty points.
 * < 10% → 15, < 25% → 10, < 50% → 5, else → 0
 */
function computeMarginPenalty(marginPct: number): number {
  if (marginPct < 0.10) return 15;
  if (marginPct < 0.25) return 10;
  if (marginPct < 0.50) return 5;
  return 0;
}
