/**
 * Canonical Required Diameter Calculation (MBS)
 * 
 * Calculates minimum blank size per eye using frame + pupillary data.
 * Three fallback levels for DNP resolution.
 */

export interface PupillaryData {
  dnpOD?: number;
  dnpOE?: number;
  dp?: number;
}

export interface DiameterCalcInput {
  horizontalSize: number; // A
  verticalSize: number;   // B
  bridge: number;         // DBL
}

export interface DiameterCalcResult {
  requiredOD: number;
  requiredOE: number;
  maxRequired: number;
  debug: {
    GCD: number;
    decentrationOD: number;
    decentrationOE: number;
    dnpOD: number;
    dnpOE: number;
    methodUsed: 'monocular' | 'binocular_half' | 'fallback_no_pd';
  };
}

/**
 * Calculate required lens diameter per eye using MBS formula.
 * 
 * GCD = A + DBL
 * decentration = abs((GCD/2) - dnp_eye)
 * horizontal_need = A + 2 * decentration
 * required = max(horizontal_need, B) + safetyMarginMm
 */
export function calcRequiredDiameter(
  frame: DiameterCalcInput,
  pd: PupillaryData,
  safetyMarginMm: number = 2
): DiameterCalcResult {
  const A = frame.horizontalSize;
  const B = frame.verticalSize;
  const DBL = frame.bridge;
  const GCD = A + DBL;

  // Resolve DNP with 3 fallback levels
  let dnpOD: number;
  let dnpOE: number;
  let methodUsed: DiameterCalcResult['debug']['methodUsed'];

  if (pd.dnpOD != null && pd.dnpOD > 0 && pd.dnpOE != null && pd.dnpOE > 0) {
    dnpOD = pd.dnpOD;
    dnpOE = pd.dnpOE;
    methodUsed = 'monocular';
  } else if (pd.dp != null && pd.dp > 0) {
    dnpOD = pd.dp / 2;
    dnpOE = pd.dp / 2;
    methodUsed = 'binocular_half';
  } else {
    // Last resort: assume centered (A/2)
    dnpOD = A / 2;
    dnpOE = A / 2;
    methodUsed = 'fallback_no_pd';
  }

  const decentrationOD = Math.abs((GCD / 2) - dnpOD);
  const decentrationOE = Math.abs((GCD / 2) - dnpOE);

  const horizontalNeedOD = A + 2 * decentrationOD;
  const horizontalNeedOE = A + 2 * decentrationOE;

  const requiredOD = Math.ceil(Math.max(horizontalNeedOD, B) + safetyMarginMm);
  const requiredOE = Math.ceil(Math.max(horizontalNeedOE, B) + safetyMarginMm);

  return {
    requiredOD,
    requiredOE,
    maxRequired: Math.max(requiredOD, requiredOE),
    debug: {
      GCD,
      decentrationOD: Math.round(decentrationOD * 100) / 100,
      decentrationOE: Math.round(decentrationOE * 100) / 100,
      dnpOD,
      dnpOE,
      methodUsed,
    },
  };
}
