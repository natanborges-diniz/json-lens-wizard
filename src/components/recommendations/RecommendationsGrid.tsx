import { useState, useMemo, useCallback } from 'react';
import { SlidersHorizontal, X, ArrowLeft, Sparkles, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { LensCard, LensCardConfiguration } from './LensCard';
import { SmartSearch, AIRecommendation, AIResponse } from '@/components/search/SmartSearch';
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
  lensCategory: 'PROGRESSIVA' | 'MONOFOCAL' | 'OCUPACIONAL';
  attributeDefs: AttributeDef[];
  anamnesisData?: AnamnesisData;
  lensData?: LensData | null;
}

const suppliers = ['ZEISS', 'ESSILOR', 'HOYA'];

type ViewMode = 'system' | 'ai' | 'single';

interface AIViewState {
  selectedRecommendation: AIRecommendation;
  allRecommendations: AIRecommendation[];
  aiResponse: AIResponse;
}

interface SingleViewState {
  family: Family;
  allPrices: Price[];
  previousMode: ViewMode;
}

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
  
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('system');
  const [aiViewState, setAiViewState] = useState<AIViewState | null>(null);
  const [singleViewState, setSingleViewState] = useState<SingleViewState | null>(null);

  // Get all families flat
  const allFamilies = useMemo(() => {
    return Object.values(recommendations).flat();
  }, [recommendations]);

  // Get family data by id
  const getFamilyData = useCallback((familyId: string) => {
    return allFamilies.find(f => f.family.id === familyId);
  }, [allFamilies]);

  // Handle selecting an AI recommendation
  const handleSelectAIRecommendation = useCallback((
    recommendation: AIRecommendation,
    allRecommendations: AIRecommendation[],
    aiResponse: AIResponse
  ) => {
    setAiViewState({
      selectedRecommendation: recommendation,
      allRecommendations,
      aiResponse,
    });
    setViewMode('ai');
    setHighlightedFamilies([]);
  }, []);

  // Handle selecting an alternative (from LensCard)
  const handleSelectAlternative = useCallback((family: Family, allPrices: Price[]) => {
    setSingleViewState({
      family,
      allPrices,
      previousMode: viewMode,
    });
    setViewMode('single');
  }, [viewMode]);

  // Return to system view
  const returnToSystemView = useCallback(() => {
    setViewMode('system');
    setAiViewState(null);
    setSingleViewState(null);
    setHighlightedFamilies([]);
  }, []);

  // Return to AI view
  const returnToAIView = useCallback(() => {
    if (singleViewState?.previousMode === 'ai' && aiViewState) {
      setViewMode('ai');
    } else {
      returnToSystemView();
    }
    setSingleViewState(null);
  }, [singleViewState, aiViewState, returnToSystemView]);

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

  // Render AI view
  const renderAIView = () => {
    if (!aiViewState || !lensData) return null;

    const { selectedRecommendation, allRecommendations, aiResponse } = aiViewState;
    const familyData = getFamilyData(selectedRecommendation.familyId);

    if (!familyData) return null;

    // Get other recommendations as alternatives
    const otherRecommendations = allRecommendations
      .filter(r => r.familyId !== selectedRecommendation.familyId)
      .map(r => {
        const data = getFamilyData(r.familyId);
        return data ? {
          family: data.family,
          bestPrice: data.bestPrice,
          allPrices: data.allPrices,
          reason: r.reason,
        } : null;
      })
      .filter(Boolean);

    return (
      <div className="space-y-4">
        {/* Navigation Header */}
        <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={returnToSystemView}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Quadro do Sistema
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="font-medium text-sm">Recomendação IA</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{aiResponse.explanation}</p>
          </div>
        </div>

        {/* Main recommendation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Badge variant="default">1º Recomendada</Badge>
              {selectedRecommendation.reason}
            </h3>
            <LensCard
              family={familyData.family}
              bestPrice={familyData.bestPrice}
              allPrices={familyData.allPrices}
              tier={familyData.tier}
              isRecommended={true}
              isSelected={selectedFamilyId === familyData.family.id}
              addons={addons}
              onSelect={onSelectLens}
              attributeDefs={attributeDefs}
              alternativeFamilies={[]}
            />
          </div>

          {/* Other AI recommendations */}
          {otherRecommendations.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Outras Recomendações IA:</h3>
              <div className="space-y-2">
                {otherRecommendations.map((alt, idx) => alt && (
                  <Card 
                    key={alt.family.id}
                    className="p-4 hover:border-primary cursor-pointer transition-all"
                    onClick={() => handleSelectAlternative(alt.family, alt.allPrices)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{idx + 2}º</Badge>
                          <span className="font-medium">{alt.family.name_original}</span>
                          <Badge variant="secondary" className="text-xs">{alt.family.supplier}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{alt.reason}</p>
                      </div>
                      {alt.bestPrice && (
                        <div className="text-right">
                          <div className="font-bold">
                            R$ {(alt.bestPrice.price_sale_half_pair * 2).toLocaleString('pt-BR')}
                          </div>
                          <div className="text-xs text-muted-foreground">par</div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render single family view
  const renderSingleView = () => {
    if (!singleViewState) return null;

    const { family, allPrices } = singleViewState;

    // Find tier for this family
    const familyData = getFamilyData(family.id);
    const tier = familyData?.tier || 'comfort';

    return (
      <div className="space-y-4">
        {/* Navigation Header */}
        <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg border">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={returnToAIView}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Visualização Individual</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={returnToSystemView}
            className="ml-auto gap-2"
          >
            <LayoutGrid className="w-4 h-4" />
            Quadro do Sistema
          </Button>
        </div>

        {/* Single Card */}
        <div className="max-w-md mx-auto">
          <LensCard
            family={family}
            bestPrice={allPrices.length > 0 ? allPrices.sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0] : null}
            allPrices={allPrices}
            tier={tier}
            isRecommended={false}
            isSelected={selectedFamilyId === family.id}
            addons={addons}
            onSelect={onSelectLens}
            attributeDefs={attributeDefs}
            alternativeFamilies={[]}
          />
        </div>
      </div>
    );
  };

  // Render system view (default)
  const renderSystemView = () => (
    <div className="space-y-6">
      {/* Smart Search */}
      <SmartSearch
        lensData={lensData || null}
        anamnesisData={anamnesisData || defaultAnamnesis}
        lensCategory={lensCategory}
        onHighlightFamilies={handleHighlightFamilies}
        onSuggestAddons={handleSuggestAddons}
        onSelectAIRecommendation={handleSelectAIRecommendation}
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
                onSelectAlternative={handleSelectAlternative}
                alternativeFamilies={alternatives.map(a => ({
                  family: a.family,
                  bestPrice: a.bestPrice,
                  allPrices: a.allPrices,
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

  return (
    <div className="space-y-6">
      {viewMode === 'system' && renderSystemView()}
      {viewMode === 'ai' && renderAIView()}
      {viewMode === 'single' && renderSingleView()}
    </div>
  );
};
