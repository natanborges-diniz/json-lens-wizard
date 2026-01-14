import { useState, useMemo } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LensCard } from './LensCard';
import type { Family, Price, Addon, Tier, AttributeDef } from '@/types/lens';

interface FamilyWithPrice {
  family: Family;
  bestPrice: Price | null;
  tier: Tier;
  score: number;
}

interface RecommendationsGridProps {
  recommendations: Record<Tier, FamilyWithPrice[]>;
  addons: Addon[];
  selectedAddons: string[];
  onToggleAddon: (addonId: string) => void;
  onSelectLens: (family: Family, price: Price | null) => void;
  mostRecommendedId?: string;
  lensCategory: 'PROGRESSIVA' | 'MONOFOCAL';
  attributeDefs: AttributeDef[];
}

const suppliers = ['ZEISS', 'ESSILOR', 'HOYA'];

export const RecommendationsGrid = ({
  recommendations,
  addons,
  selectedAddons,
  onToggleAddon,
  onSelectLens,
  mostRecommendedId,
  lensCategory,
  attributeDefs,
}: RecommendationsGridProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);

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

      if (tierFamilies.length === 0) return null;

      // Primary option (first one, highest score)
      const primary = tierFamilies[0];
      // Alternative options
      const alternatives = tierFamilies.slice(1);

      return {
        tier,
        primary,
        alternatives,
      };
    }).filter(Boolean);
  }, [recommendations, supplierFilter, searchQuery]);

  // Get all unique suppliers from available families
  const availableSuppliers = useMemo(() => {
    const allFamilies = Object.values(recommendations).flat();
    return [...new Set(allFamilies.map(f => f.family.supplier))];
  }, [recommendations]);

  const clearFilters = () => {
    setSearchQuery('');
    setSupplierFilter(null);
  };

  const hasFilters = searchQuery || supplierFilter;

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou fabricante..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex gap-2 flex-wrap">
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
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Category badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-sm">
          {lensCategory === 'PROGRESSIVA' ? 'Lentes Progressivas' : 'Lentes Monofocais'}
        </Badge>
        {selectedAddons.length > 0 && (
          <Badge variant="outline" className="text-sm">
            +{selectedAddons.length} complemento{selectedAddons.length > 1 ? 's' : ''}
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
            
            return (
              <LensCard
                key={tier}
                family={primary.family}
                bestPrice={primary.bestPrice}
                tier={tier}
                isRecommended={isRecommended}
                addons={addons}
                selectedAddons={selectedAddons}
                onToggleAddon={onToggleAddon}
                onSelect={() => onSelectLens(primary.family, primary.bestPrice)}
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
