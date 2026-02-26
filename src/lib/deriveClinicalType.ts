import type { ClinicalType, Prescription } from '@/types/lens';

/**
 * Derives clinical type from prescription data.
 * - If addition exists (OD or OE > 0) → PROGRESSIVA
 * - Otherwise → MONOFOCAL
 */
export function deriveClinicalTypeFromRx(rx: Partial<Prescription>): ClinicalType {
  const hasAddition =
    (rx.rightAddition != null && rx.rightAddition > 0) ||
    (rx.leftAddition != null && rx.leftAddition > 0);
  return hasAddition ? 'PROGRESSIVA' : 'MONOFOCAL';
}
