/**
 * useCatalogEnricher - Hook that provides enriched catalog data
 * 
 * Integrates CatalogEnricher with the store and resolver,
 * providing enriched families and prices for UI consumption.
 */

import { useMemo } from 'react';
import { useLensStore } from '@/store/lensStore';
import { useCatalogResolver } from '@/hooks/useCatalogResolver';
import {
  enrichFamily,
  enrichPrice,
  enrichFamilies,
  enrichPrices,
  createPresentationOverlay,
  type EnrichedFamily,
  type EnrichedPrice,
} from '@/lib/catalogEnricher';
import type { FamilyExtended, Price, ClinicalType } from '@/types/lens';

interface CatalogEnricherResult {
  // Enriched data accessors
  getEnrichedFamily: (familyId: string) => EnrichedFamily | null;
  getEnrichedPrice: (erpCode: string) => EnrichedPrice | null;
  getEnrichedPricesForFamily: (familyId: string) => EnrichedPrice[];
  
  // Batch accessors
  getAllEnrichedFamilies: () => EnrichedFamily[];
  getAllEnrichedPrices: () => EnrichedPrice[];
  
  // Filtered accessors
  getEnrichedFamiliesByCategory: (clinicalType: ClinicalType) => EnrichedFamily[];
  getEnrichedFamiliesByTier: (tier: 'essential' | 'comfort' | 'advanced' | 'top') => EnrichedFamily[];
  
  // Compatibility check (uses enriched availability)
  isPriceCompatibleWithPrescription: (
    erpCode: string,
    prescription: { sphere: number; cylinder: number; addition?: number }
  ) => boolean;
  
  // Export overlay
  exportPresentationOverlay: () => ReturnType<typeof createPresentationOverlay>;
  
  // Status
  isReady: boolean;
  enrichmentStats: {
    familiesEnriched: number;
    pricesEnriched: number;
    pricesWithDefaults: number;
    pricesWithMigration: number;
  };
}

export const useCatalogEnricher = (): CatalogEnricherResult => {
  const { families, prices, technologyLibrary, isDataLoaded } = useLensStore();
  const { getTierKey } = useCatalogResolver();
  
  // Build family map for quick lookups
  const familiesMap = useMemo(() => {
    const map = new Map<string, FamilyExtended>();
    families.forEach(f => map.set(f.id, f));
    return map;
  }, [families]);
  
  // Enrich all families
  const enrichedFamilies = useMemo<EnrichedFamily[]>(() => {
    if (!isDataLoaded || families.length === 0) return [];
    return enrichFamilies(families, getTierKey, technologyLibrary);
  }, [families, getTierKey, technologyLibrary, isDataLoaded]);
  
  // Enrich all prices
  const enrichedPrices = useMemo<EnrichedPrice[]>(() => {
    if (!isDataLoaded || prices.length === 0) return [];
    return enrichPrices(prices, familiesMap);
  }, [prices, familiesMap, isDataLoaded]);
  
  // Build lookup maps
  const enrichedFamiliesMap = useMemo(() => {
    const map = new Map<string, EnrichedFamily>();
    enrichedFamilies.forEach(f => map.set(f.id, f));
    return map;
  }, [enrichedFamilies]);
  
  const enrichedPricesMap = useMemo(() => {
    const map = new Map<string, EnrichedPrice>();
    enrichedPrices.forEach(p => map.set(p.erp_code, p));
    return map;
  }, [enrichedPrices]);
  
  const pricesByFamilyMap = useMemo(() => {
    const map = new Map<string, EnrichedPrice[]>();
    enrichedPrices.forEach(p => {
      const existing = map.get(p.family_id) || [];
      existing.push(p);
      map.set(p.family_id, existing);
    });
    return map;
  }, [enrichedPrices]);
  
  // Calculate stats
  const enrichmentStats = useMemo(() => {
    const pricesWithDefaults = enrichedPrices.filter(p => p.flags?.availability_defaulted).length;
    const pricesWithMigration = enrichedPrices.filter(p => p.flags?.availability_migrated).length;
    
    return {
      familiesEnriched: enrichedFamilies.length,
      pricesEnriched: enrichedPrices.length,
      pricesWithDefaults,
      pricesWithMigration,
    };
  }, [enrichedFamilies, enrichedPrices]);
  
  // Accessors
  const getEnrichedFamily = (familyId: string): EnrichedFamily | null => {
    return enrichedFamiliesMap.get(familyId) || null;
  };
  
  const getEnrichedPrice = (erpCode: string): EnrichedPrice | null => {
    return enrichedPricesMap.get(erpCode) || null;
  };
  
  const getEnrichedPricesForFamily = (familyId: string): EnrichedPrice[] => {
    return pricesByFamilyMap.get(familyId) || [];
  };
  
  const getAllEnrichedFamilies = (): EnrichedFamily[] => {
    return enrichedFamilies;
  };
  
  const getAllEnrichedPrices = (): EnrichedPrice[] => {
    return enrichedPrices;
  };
  
  // Filtered accessors
  const getEnrichedFamiliesByCategory = (clinicalType: ClinicalType): EnrichedFamily[] => {
    return enrichedFamilies.filter(f => 
      (f.clinical_type || f.category) === clinicalType && f.active
    );
  };
  
  const getEnrichedFamiliesByTier = (tier: 'essential' | 'comfort' | 'advanced' | 'top'): EnrichedFamily[] => {
    return enrichedFamilies.filter(f => {
      const familyTier = f.tier_target || getTierKey(f.macro);
      return familyTier === tier && f.active;
    });
  };
  
  // Compatibility check using enriched availability
  const isPriceCompatibleWithPrescription = (
    erpCode: string,
    prescription: { sphere: number; cylinder: number; addition?: number }
  ): boolean => {
    const price = enrichedPricesMap.get(erpCode);
    if (!price) return false;
    
    const avail = price.availability_enriched;
    
    // Check sphere
    if (prescription.sphere < avail.sphere.min || prescription.sphere > avail.sphere.max) {
      return false;
    }
    
    // Check cylinder
    if (prescription.cylinder < avail.cylinder.min || prescription.cylinder > avail.cylinder.max) {
      return false;
    }
    
    // Check addition if applicable
    if (prescription.addition && avail.addition) {
      if (prescription.addition < avail.addition.min || prescription.addition > avail.addition.max) {
        return false;
      }
    }
    
    return true;
  };
  
  // Export overlay
  const exportPresentationOverlay = () => {
    return createPresentationOverlay(enrichedFamilies, enrichedPrices);
  };
  
  return {
    getEnrichedFamily,
    getEnrichedPrice,
    getEnrichedPricesForFamily,
    getAllEnrichedFamilies,
    getAllEnrichedPrices,
    getEnrichedFamiliesByCategory,
    getEnrichedFamiliesByTier,
    isPriceCompatibleWithPrescription,
    exportPresentationOverlay,
    isReady: isDataLoaded && enrichedFamilies.length > 0,
    enrichmentStats,
  };
};
