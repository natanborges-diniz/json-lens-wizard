import { useState, useMemo, useCallback } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LensCard, LensCardConfiguration } from './LensCard';
import { SmartSearch } from '@/components/search/SmartSearch';
import type { Family, Price, Addon, Tier, AttributeDef, AnamnesisData, LensData } from '@/types/lens';

interface FamilyWithPrice {
  family: Family;
  bestPrice: Price | null;
  allPrices: Price[];
  tier: Tier;
  score: number;
}

interface RecommendationsGridProps {
  recommendations: Record<Tier, FamilyWithPrice[]>;
  addons: Addon[];
  onSelectLens: (configuration: LensCardConfiguration) => void;
  selectedFamilyId?: string;
  mostRecommendedId?: string;
  lensCategory: 'PROGRESSIVA' | 'MONOFOCAL';
  attributeDefs: AttributeDef[];
  anamnesisData?: AnamnesisData;
  lensData?: LensData | null;
}

const suppliers = ['ZEISS', 'ESSILOR', 'HOYA'];

export const RecommendationsGrid = ({
  recommendations,
  addons,
  onSelectLens,
  selectedFamilyId,
  mostRecommendedId,
  lensCategory,
  attributeDefs,
  anamnesisData,
  lensData,
}: RecommendationsGridProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);
  const [highlightedFamilies, setHighlightedFamilies] = useState<string[]>([]);
  const [suggestedAddons, setSuggestedAddons] = useState<string[]>([]);

  // Get one option per tier (the best one) + alternatives
  const tierOptions = useMemo(() => {
    const tiers: Tier[] = ['essential', 'comfort', 'advanced', 'top'];
    
    return tiers.map(tier => {
      let tierFamilies = recommendations[tier];
      
      // Apply supplier filter
      if (supplierFilter) {
        tierFamilies = tierFamilies.filter(f => f.family.supplier === supplierFilter);
      }
      
      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        tierFamilies = tierFamilies.filter(f => 
          f.family.name_original.toLowerCase().includes(query) ||
          f.family.supplier.toLowerCase().includes(query)
        );
      }

      // Apply highlight filter from AI search
      if (highlightedFamilies.length > 0) {
        tierFamilies = tierFamilies.filter(f => highlightedFamilies.includes(f.family.id));
      }

      if (tierFamilies.length === 0) return null;

      // Primary option (first one, highest score, or first highlighted)
      const primary = highlightedFamilies.length > 0
        ? tierFamilies.sort((a, b) => {
            const aIdx = highlightedFamilies.indexOf(a.family.id);
            const bIdx = highlightedFamilies.indexOf(b.family.id);
            return aIdx - bIdx;
          })[0]
        : tierFamilies[0];
      
      // Alternative options
      const alternatives = tierFamilies.filter(f => f.family.id !== primary.family.id);

      return {
        tier,
        primary,
        alternatives,
      };
    }).filter(Boolean);
  }, [recommendations, supplierFilter, searchQuery, highlightedFamilies]);

  // Get all unique suppliers from available families
  const availableSuppliers = useMemo(() => {
    const allFamilies = Object.values(recommendations).flat();
    return [...new Set(allFamilies.map(f => f.family.supplier))];
  }, [recommendations]);

  const clearFilters = () => {
    setSearchQuery('');
    setSupplierFilter(null);
    setHighlightedFamilies([]);
    setSuggestedAddons([]);
  };

  const handleHighlightFamilies = useCallback((familyIds: string[]) => {
    setHighlightedFamilies(familyIds);
  }, []);

  const handleSuggestAddons = useCallback((addonIds: string[]) => {
    setSuggestedAddons(addonIds);
  }, []);

  const hasFilters = searchQuery || supplierFilter || highlightedFamilies.length > 0;

  // Default anamnesis data if not provided
  const defaultAnamnesis: AnamnesisData = {
    primaryUse: 'mixed',
    screenHours: '3-5',
    nightDriving: 'sometimes',
    visualComplaints: [],
    outdoorTime: 'no',
    clearLensPreference: 'indifferent',
    aestheticPriority: 'medium',
  };

  return (
    <div className="space-y-6">
      {/* Smart Search */}
      <SmartSearch
        lensData={lensData || null}
        anamnesisData={anamnesisData || defaultAnamnesis}
        lensCategory={lensCategory}
        onHighlightFamilies={handleHighlightFamilies}
        onSuggestAddons={handleSuggestAddons}
      />

      {/* Supplier Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {availableSuppliers.map(supplier => (
          <Button
            key={supplier}
            variant={supplierFilter === supplier ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSupplierFilter(supplierFilter === supplier ? null : supplier)}
            className="gap-1.5"
          >
            {supplier}
          </Button>
        ))}
        
        {hasFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="gap-1 text-muted-foreground"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Category and Status badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-sm">
          {lensCategory === 'PROGRESSIVA' ? 'Lentes Progressivas' : 'Lentes Monofocais'}
        </Badge>
        
        {highlightedFamilies.length > 0 && (
          <Badge variant="default" className="text-sm gap-1">
            ✨ {highlightedFamilies.length} recomendação(ões) IA
          </Badge>
        )}
        {selectedFamilyId && (
          <Badge className="text-sm bg-success text-success-foreground gap-1">
            ✓ Lente selecionada
          </Badge>
        )}
      </div>

      {/* Grid of cards */}
      {tierOptions.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tierOptions.map(option => {
            if (!option) return null;
            
            const { tier, primary, alternatives } = option;
            const isRecommended = primary.family.id === mostRecommendedId;
            const isSelected = primary.family.id === selectedFamilyId;
            
            return (
              <LensCard
                key={tier}
                family={primary.family}
                bestPrice={primary.bestPrice}
                allPrices={primary.allPrices}
                tier={tier}
                isRecommended={isRecommended}
                isSelected={isSelected}
                addons={addons}
                onSelect={onSelectLens}
                alternativeFamilies={alternatives.map(a => ({
                  family: a.family,
                  bestPrice: a.bestPrice,
                }))}
                attributeDefs={attributeDefs}
              />
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <SlidersHorizontal className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Nenhuma lente encontrada</p>
          <p className="text-sm">Tente ajustar os filtros ou a busca</p>
          {hasFilters && (
            <Button variant="link" onClick={clearFilters} className="mt-2">
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="p-4 bg-muted/30 rounded-lg">
        <h4 className="text-sm font-medium mb-2">O que significam os níveis?</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Essencial:</span> Solução básica com boa correção visual
          </div>
          <div>
            <span className="font-medium text-foreground">Conforto:</span> Equilíbrio entre qualidade e custo
          </div>
          <div>
            <span className="font-medium text-foreground">Avançada:</span> Tecnologia de ponta para alta performance
          </div>
          <div>
            <span className="font-medium text-foreground">Top:</span> O melhor disponível em tecnologia
          </div>
        </div>
      </div>
    </div>
  );
};
