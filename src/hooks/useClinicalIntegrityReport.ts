/**
 * useClinicalIntegrityReport - Memoized hook for clinical integrity analysis
 */

import { useMemo } from 'react';
import { useLensStore } from '@/store/lensStore';
import { calculateClinicalIntegrityReport, type ClinicalIntegrityReport } from '@/lib/catalogIntegrityAnalyzer';

export const useClinicalIntegrityReport = (): {
  report: ClinicalIntegrityReport | null;
  isReady: boolean;
} => {
  const { families, prices, isDataLoaded } = useLensStore();

  const report = useMemo(() => {
    if (!isDataLoaded || prices.length === 0) return null;
    return calculateClinicalIntegrityReport(prices, families);
  }, [prices, families, isDataLoaded]);

  return {
    report,
    isReady: isDataLoaded && report !== null,
  };
};
