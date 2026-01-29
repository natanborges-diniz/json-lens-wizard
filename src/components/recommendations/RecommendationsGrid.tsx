import { useState, useMemo, useCallback } from 'react';
import { SlidersHorizontal, X, ArrowLeft, Sparkles, LayoutGrid, Info, Shield, ThumbsUp, Zap, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { LensCard, LensCardConfiguration } from './LensCard';
import { SmartSearch, AIRecommendation, AIResponse } from '@/components/search/SmartSearch';
import { ProductSuggestionCards } from './ProductSuggestionCards';
import { ProductCart } from './ProductCart';
import { AdditionalProductModal } from './AdditionalProductModal';
import type { Family, Price, Addon, Tier, AttributeDef, AnamnesisData, LensData, Prescription, ClinicalType } from '@/types/lens';
import type { SelectedProduct, ProductSuggestion } from '@/lib/productSuggestionEngine';
import { 
  generateProductSuggestions, 
  generateProductId, 
  hasProductType,
  getProductTypeLabel 
} from '@/lib/productSuggestionEngine';

interface FamilyWithPrice {
  family: Family;
  bestPrice: Price | null;
  allPrices: Price[];
  tier: Tier;
  score: number;
}

interface RecommendationsGridProps {
  recommendations: Record<Tier, FamilyWithPrice[]>;
  occupationalRecommendations?: Record<Tier, FamilyWithPrice[]>;
  addons: Addon[];
  onSelectLens: (configuration: LensCardConfiguration) => void;
  onSelectProducts?: (products: SelectedProduct[]) => void;
  selectedFamilyId?: string;
  mostRecommendedId?: string;
  lensCategory: ClinicalType;
  attributeDefs: AttributeDef[];
  anamnesisData?: AnamnesisData;
  prescriptionData?: Partial<Prescription>;
  lensData?: LensData | null;
}

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
  occupationalRecommendations,
  addons,
  onSelectLens,
  onSelectProducts,
  selectedFamilyId,
  mostRecommendedId,
  lensCategory,
  attributeDefs,
  anamnesisData,
  prescriptionData,
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

  // Product cart state
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [showOccupationalModal, setShowOccupationalModal] = useState(false);
  const [showSolarModal, setShowSolarModal] = useState(false);

  // Get all families flat
  const allFamilies = useMemo(() => {
    return Object.values(recommendations).flat();
  }, [recommendations]);

  // Generate product suggestions based on anamnesis
  const productSuggestions = useMemo((): ProductSuggestion[] => {
    if (!anamnesisData || !lensData) return [];
    
    const ocFamilies = lensData.families.filter(f => 
      f.category === 'OCUPACIONAL' && f.active
    );
    
    return generateProductSuggestions(anamnesisData, prescriptionData || {}, ocFamilies);
  }, [anamnesisData, prescriptionData, lensData]);

  // Get occupational families for modal
  const occupationalFamiliesForModal = useMemo((): FamilyWithPrice[] => {
    if (occupationalRecommendations) {
      return Object.values(occupationalRecommendations).flat().filter(f => f.bestPrice !== null);
    }
    return [];
  }, [occupationalRecommendations]);

  // Get primary product from cart
  const primaryProduct = useMemo(() => {
    return selectedProducts.find(p => p.type === 'primary');
  }, [selectedProducts]);

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

  // Handle lens selection - add to cart as primary
  const handleLensSelect = useCallback((config: LensCardConfiguration) => {
    const family = allFamilies.find(f => f.family.id === config.familyId);
    if (!family) return;

    const primaryProduct: SelectedProduct = {
      id: generateProductId(),
      type: 'primary',
      familyId: config.familyId,
      familyName: family.family.name_original,
      supplier: family.family.supplier,
      selectedIndex: config.selectedIndex,
      selectedTreatments: config.selectedTreatments,
      unitPrice: config.totalPrice,
      label: getProductTypeLabel('primary'),
      selectedPriceErpCode: config.selectedPrice?.erp_code,
    };

    // Replace any existing primary product
    setSelectedProducts(prev => {
      const filtered = prev.filter(p => p.type !== 'primary');
      return [primaryProduct, ...filtered];
    });

    // Also call the original handler for backward compatibility
    onSelectLens(config);
  }, [allFamilies, onSelectLens]);

  // Add additional product to cart
  const handleAddProduct = useCallback((product: SelectedProduct) => {
    setSelectedProducts(prev => [...prev, product]);
  }, []);

  // Remove product from cart
  const handleRemoveProduct = useCallback((productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId));
  }, []);

  // Handle finalize - send all products
  const handleFinalize = useCallback(() => {
    if (onSelectProducts) {
      onSelectProducts(selectedProducts);
    }
  }, [selectedProducts, onSelectProducts]);

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
          {lensCategory === 'PROGRESSIVA' 
            ? 'Lentes Progressivas' 
            : lensCategory === 'OCUPACIONAL'
              ? 'Lentes Ocupacionais'
              : 'Lentes Monofocais'}
        </Badge>
        
        {highlightedFamilies.length > 0 && (
          <Badge variant="default" className="text-sm gap-1">
            ✨ {highlightedFamilies.length} recomendação(ões) IA
          </Badge>
        )}
        {selectedProducts.length > 0 && (
          <Badge className="text-sm bg-success text-success-foreground gap-1">
            ✓ {selectedProducts.length} produto(s) selecionado(s)
          </Badge>
        )}
      </div>

      {/* Main content - responsive layout */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left: Lens cards - auto-expands */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Grid of cards - auto-adjustable columns */}
          {tierOptions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 auto-rows-fr">
              {tierOptions.map(option => {
                if (!option) return null;
                
                const { tier, primary, alternatives } = option;
                const isRecommended = primary.family.id === mostRecommendedId;
                const isSelected = selectedProducts.some(p => p.familyId === primary.family.id && p.type === 'primary');
                
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
                    onSelect={handleLensSelect}
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

          {/* Product Suggestions - only show after primary is selected */}
          {selectedProducts.length > 0 && productSuggestions.length > 0 && (
            <ProductSuggestionCards
              suggestions={productSuggestions}
              onSelectOccupational={() => setShowOccupationalModal(true)}
              onSelectSolar={() => setShowSolarModal(true)}
              hasOccupational={hasProductType(selectedProducts, 'occupational')}
              hasSolar={hasProductType(selectedProducts, 'solar')}
            />
          )}

          {/* How recommendations work */}
          <div className="p-4 bg-muted/30 rounded-lg space-y-4">
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                Como funciona a recomendação?
              </h4>
              <p className="text-xs text-muted-foreground">
                Analisamos sua prescrição, perfil de uso e preferências para sugerir as lentes mais adequadas em cada faixa de preço. 
                A opção <strong>"Melhor opção"</strong> é calculada com base nas suas respostas da anamnese.
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-2 bg-slate-50 rounded border border-slate-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="w-3.5 h-3.5 text-slate-600" />
                  <span className="font-medium text-slate-700 text-xs">Essencial</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Entrada de linha. Boa correção para uso básico.
                </p>
              </div>
              <div className="p-2 bg-blue-50 rounded border border-blue-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <ThumbsUp className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-medium text-blue-700 text-xs">Conforto</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Equilíbrio ideal. Tecnologia + custo-benefício.
                </p>
              </div>
              <div className="p-2 bg-purple-50 rounded border border-purple-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 text-purple-600" />
                  <span className="font-medium text-purple-700 text-xs">Avançada</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Alta tecnologia. Para exigentes ou prescrições complexas.
                </p>
              </div>
              <div className="p-2 bg-amber-50 rounded border border-amber-200">
                <div className="flex items-center gap-1.5 mb-1">
                  <Crown className="w-3.5 h-3.5 text-amber-600" />
                  <span className="font-medium text-amber-700 text-xs">Top</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Referência de mercado. O melhor disponível.
                </p>
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground border-t pt-2">
              <strong>Dica:</strong> Cada faixa pode ter alternativas de outros fabricantes. Clique em "alternativas" dentro do card para comparar.
            </div>
          </div>
        </div>

        {/* Right: Product Cart - fixed width on xl+ */}
        <div className="xl:w-80 xl:flex-shrink-0">
          <div className="sticky top-24">
            <ProductCart
              products={selectedProducts}
              onRemoveProduct={handleRemoveProduct}
              onFinalize={handleFinalize}
            />
          </div>
        </div>
      </div>

      {/* Modals for additional products */}
      <AdditionalProductModal
        open={showOccupationalModal}
        onOpenChange={setShowOccupationalModal}
        productType="occupational"
        families={occupationalFamiliesForModal}
        addons={addons}
        attributeDefs={attributeDefs}
        onAddProduct={handleAddProduct}
      />

      <AdditionalProductModal
        open={showSolarModal}
        onOpenChange={setShowSolarModal}
        productType="solar"
        families={[]}
        addons={addons}
        attributeDefs={attributeDefs}
        onAddProduct={handleAddProduct}
        primaryProduct={primaryProduct}
      />
    </div>
  );

  // Main render - proper view mode switching
  if (viewMode === 'ai') {
    return renderAIView();
  }
  
  if (viewMode === 'single') {
    return renderSingleView();
  }
  
  return renderSystemView();
};