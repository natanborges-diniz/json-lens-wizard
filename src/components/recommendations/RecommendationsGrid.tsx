/**
 * RecommendationsGrid - Refatorado para modelo varejo ótico
 * 
 * Layout:
 * - ConsultativeNarrativePanel (abertura + resumo)
 * - 4 cards (escada) Essential / Comfort / Advanced / Top
 * - TierComparisonCards (deltas entre tiers)
 * - Budget Panel
 */

import { useState, useMemo, useCallback } from 'react';
import { 
  SlidersHorizontal, 
  X, 
  ArrowLeft, 
  Sparkles, 
  LayoutGrid,
  ArrowUp,
  Shield,
  ThumbsUp,
  Zap,
  Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SimplifiedLensCard, LensCardSelection } from './SimplifiedLensCard';
import { TierEmptyState } from './TierEmptyState';
import { BudgetPanel } from './BudgetPanel';
import { ConsultativeNarrativePanel } from './ConsultativeNarrativePanel';
import { TierComparisonCard } from './TierComparisonCard';
import { SmartSearch, AIRecommendation, AIResponse } from '@/components/search/SmartSearch';
import { ProductSuggestionCards } from './ProductSuggestionCards';
import { AdditionalProductModal } from './AdditionalProductModal';
import { useNarrativeEngine } from '@/hooks/useNarrativeEngine';
import type { Family, Price, Addon, Tier, AttributeDef, AnamnesisData, LensData, Prescription, ClinicalType } from '@/types/lens';
import type { SelectedProduct, ProductSuggestion } from '@/lib/productSuggestionEngine';
import type { ScoredFamily } from '@/lib/recommendationEngine/types';
import type { RecommendationResult } from '@/lib/recommendationEngine/types';
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
  /** Optional: full scored family data from recommendation engine */
  scoredFamily?: ScoredFamily;
}

interface RecommendationsGridProps {
  recommendations: Record<Tier, FamilyWithPrice[]>;
  occupationalRecommendations?: Record<Tier, FamilyWithPrice[]>;
  addons: Addon[];
  onSelectLens: (configuration: LensCardSelection) => void;
  onSelectProducts?: (products: SelectedProduct[]) => void;
  selectedFamilyId?: string;
  mostRecommendedId?: string;
  lensCategory: ClinicalType;
  attributeDefs: AttributeDef[];
  anamnesisData?: AnamnesisData;
  prescriptionData?: Partial<Prescription>;
  lensData?: LensData | null;
  /** Force 4 tiers display with empty states */
  forceAllTiers?: boolean;
  /** Engine result for narrative generation */
  engineResult?: RecommendationResult | null;
}

type ViewMode = 'system' | 'ai' | 'single';

// Tier configuration
const TIER_CONFIG: Record<Tier, {
  label: string;
  description: string;
  icon: React.ElementType;
  colorClass: string;
}> = {
  essential: {
    label: 'Essential',
    description: 'Visão funcional com boa qualidade',
    icon: Shield,
    colorClass: 'text-slate-600',
  },
  comfort: {
    label: 'Conforto',
    description: 'Mais conforto no dia a dia',
    icon: ThumbsUp,
    colorClass: 'text-blue-600',
  },
  advanced: {
    label: 'Avançada',
    description: 'Adaptação mais rápida',
    icon: Zap,
    colorClass: 'text-purple-600',
  },
  top: {
    label: 'Premium',
    description: 'Máxima personalização',
    icon: Crown,
    colorClass: 'text-amber-600',
  },
};

const TIER_ORDER: Tier[] = ['essential', 'comfort', 'advanced', 'top'];

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
  forceAllTiers = true,
  engineResult,
}: RecommendationsGridProps) => {
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);
  const [highlightedFamilies, setHighlightedFamilies] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('system');
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [showOccupationalModal, setShowOccupationalModal] = useState(false);
  const [showSolarModal, setShowSolarModal] = useState(false);

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

  const effectiveAnamnesis = anamnesisData || defaultAnamnesis;

  // Narrative Engine integration
  const { 
    narrativeResult, 
    tierComparisons, 
    openingScript,
  } = useNarrativeEngine({
    recommendationResult: engineResult || null,
    anamnesis: effectiveAnamnesis,
    clinicalType: lensCategory,
    technologyLibrary: lensData?.technology_library?.items || {},
  });

  // Get all families flat
  const allFamilies = useMemo(() => {
    return Object.values(recommendations).flat();
  }, [recommendations]);

  // Get ALL prices from all families
  const allPricesMap = useMemo(() => {
    const map = new Map<string, Price[]>();
    allFamilies.forEach(f => {
      map.set(f.family.id, f.allPrices);
    });
    return map;
  }, [allFamilies]);

  // Get all prices for selected family
  const allPricesForFamily = useMemo(() => {
    const primaryProduct = selectedProducts.find(p => p.type === 'primary');
    if (!primaryProduct) return [];
    return allPricesMap.get(primaryProduct.familyId) || [];
  }, [selectedProducts, allPricesMap]);

  // Generate product suggestions
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

  // Handle lens selection
  const handleLensSelect = useCallback((config: LensCardSelection) => {
    const family = allFamilies.find(f => f.family.id === config.familyId);
    if (!family) return;

    const newPrimary: SelectedProduct = {
      id: generateProductId(),
      type: 'primary',
      familyId: config.familyId,
      familyName: (family.family as any).display_name || (family.family as any).name_display || family.family.name_original,
      supplier: family.family.supplier,
      selectedIndex: config.selectedIndex,
      selectedTreatments: config.selectedTreatments,
      unitPrice: config.totalPrice,
      label: getProductTypeLabel('primary'),
      selectedPriceErpCode: config.selectedPrice?.erp_code,
    };

    setSelectedProducts(prev => {
      const filtered = prev.filter(p => p.type !== 'primary');
      return [newPrimary, ...filtered];
    });

    onSelectLens(config);
  }, [allFamilies, onSelectLens]);

  // Handle upgrade selection
  const handleUpgradeProduct = useCallback((productId: string, upgrade: any) => {
    setSelectedProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      return {
        ...p,
        unitPrice: p.unitPrice + upgrade.priceIncrement,
        selectedTreatments: upgrade.id.startsWith('treatment-')
          ? [...p.selectedTreatments, upgrade.id.replace('treatment-', '')]
          : p.selectedTreatments,
        selectedIndex: upgrade.id.startsWith('index-')
          ? upgrade.id.replace('index-', '')
          : p.selectedIndex,
      };
    }));
  }, []);

  const handleAddProduct = useCallback((product: SelectedProduct) => {
    setSelectedProducts(prev => [...prev, product]);
  }, []);

  const handleRemoveProduct = useCallback((productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.id !== productId));
  }, []);

  const handleFinalize = useCallback(() => {
    if (onSelectProducts) {
      onSelectProducts(selectedProducts);
    }
  }, [selectedProducts, onSelectProducts]);

  // Get one option per tier
  type TierOption = {
    tier: Tier;
    primary: FamilyWithPrice | null;
    alternativeCount: number;
    config: typeof TIER_CONFIG[Tier];
    startingPrice: number;
    isEmpty: boolean;
    isFallback?: boolean;
  };

  const tierOptions = useMemo(() => {
    const getMinPrice = (f: FamilyWithPrice): number => {
      if (f.bestPrice?.price_sale_half_pair) return f.bestPrice.price_sale_half_pair;
      const valid = f.allPrices.filter(p => p.price_sale_half_pair > 0);
      return valid.length > 0 ? Math.min(...valid.map(p => p.price_sale_half_pair)) : Infinity;
    };

    const options: TierOption[] = TIER_ORDER.map(tier => {
      let tierFamilies = recommendations[tier] || [];
      
      tierFamilies = tierFamilies.filter(f => {
        if (f.allPrices.length === 0) return false;
        return f.allPrices.some(p => p.price_sale_half_pair > 0);
      });
      
      if (supplierFilter) {
        tierFamilies = tierFamilies.filter(f => f.family.supplier === supplierFilter);
      }

      if (highlightedFamilies.length > 0) {
        tierFamilies = tierFamilies.filter(f => highlightedFamilies.includes(f.family.id));
      }

      if (tierFamilies.length === 0) {
        return {
          tier,
          primary: null,
          alternativeCount: 0,
          config: TIER_CONFIG[tier],
          startingPrice: 0,
          isEmpty: true,
        };
      }

      tierFamilies.sort((a, b) => {
        const scoreA = a.score || 0;
        const scoreB = b.score || 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return getMinPrice(a) - getMinPrice(b);
      });

      const primary = highlightedFamilies.length > 0
        ? tierFamilies.sort((a, b) => {
            const aIdx = highlightedFamilies.indexOf(a.family.id);
            const bIdx = highlightedFamilies.indexOf(b.family.id);
            return aIdx - bIdx;
          })[0]
        : tierFamilies[0];
      
      const alternativeCount = tierFamilies.length - 1;
      const startingPrice = getMinPrice(primary);

      return {
        tier,
        primary,
        alternativeCount,
        config: TIER_CONFIG[tier],
        startingPrice: startingPrice === Infinity ? 0 : startingPrice,
        isEmpty: false,
      };
    });

    // POST-PROCESS: Fix price inversions between adjacent tiers
    // If a higher tier shows a lower starting price than a lower tier,
    // swap the primaries to enforce ascending price order
    for (let i = 0; i < options.length - 1; i++) {
      const lower = options[i];
      const upper = options[i + 1];
      if (lower.isEmpty || upper.isEmpty) continue;
      if (lower.startingPrice > 0 && upper.startingPrice > 0 && upper.startingPrice < lower.startingPrice) {
        // Try to find an alternative in the upper tier that costs more
        const upperFamilies = (recommendations[upper.tier] || [])
          .filter(f => f.allPrices.some(p => p.price_sale_half_pair > 0));
        const costlierAlternative = upperFamilies.find(f => getMinPrice(f) >= lower.startingPrice);
        if (costlierAlternative) {
          upper.primary = costlierAlternative;
          upper.startingPrice = getMinPrice(costlierAlternative);
        }
        // If no costlier alternative exists, accept the inversion (data issue)
      }
    }

    return forceAllTiers ? options : options.filter(o => !o.isEmpty);
  }, [recommendations, supplierFilter, highlightedFamilies, forceAllTiers]);

  // Get all unique suppliers
  const availableSuppliers = useMemo(() => {
    return [...new Set(allFamilies.map(f => f.family.supplier))];
  }, [allFamilies]);

  const clearFilters = () => {
    setSupplierFilter(null);
    setHighlightedFamilies([]);
  };

  const handleHighlightFamilies = useCallback((familyIds: string[]) => {
    setHighlightedFamilies(familyIds);
  }, []);

  const hasFilters = supplierFilter || highlightedFamilies.length > 0;

  // Current selected tier
  const currentTierIndex = useMemo(() => {
    if (!primaryProduct) return -1;
    const tierOption = tierOptions.find(t => t.primary?.family.id === primaryProduct.familyId);
    return tierOption ? TIER_ORDER.indexOf(tierOption.tier) : -1;
  }, [primaryProduct, tierOptions]);

  // Selected family id for narrative
  const selectedFamilyForNarrative = primaryProduct?.familyId || mostRecommendedId;

  return (
    <div className="space-y-6">
      {/* Smart Search */}
      <SmartSearch
        lensData={lensData || null}
        anamnesisData={effectiveAnamnesis}
        lensCategory={lensCategory}
        onHighlightFamilies={handleHighlightFamilies}
        onSuggestAddons={() => {}}
        onSelectAIRecommendation={() => {}}
      />

      {/* 1. Consultative Narrative Panel - Opening Script + Summary */}
      {narrativeResult && (
        <ConsultativeNarrativePanel
          narrativeResult={narrativeResult}
          selectedFamilyId={selectedFamilyForNarrative}
        />
      )}

      {/* Supplier Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        {availableSuppliers.map(supplier => (
          <Button
            key={supplier}
            variant={supplierFilter === supplier ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSupplierFilter(supplierFilter === supplier ? null : supplier)}
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

      {/* Category badge */}
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
            <Sparkles className="w-3 h-3" />
            {highlightedFamilies.length} recomendação(ões) IA
          </Badge>
        )}
      </div>

      {/* Tier Progress Bar */}
      <Card className="p-4 bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <ArrowUp className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Jornada de Valor</span>
          <span className="text-xs text-muted-foreground ml-auto">
            O que você ganha em cada nível
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {TIER_ORDER.map((tier, idx) => {
            const config = TIER_CONFIG[tier];
            const Icon = config.icon;
            const isActive = idx <= currentTierIndex;
            const isCurrent = idx === currentTierIndex;
            
            return (
              <div key={tier} className="flex-1 relative group">
                <div className={`
                  h-2 rounded-full transition-all
                  ${isActive ? 'bg-primary' : 'bg-muted'}
                  ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}
                `} />
                
                <div className={`
                  mt-2 text-center text-xs transition-colors
                  ${isCurrent ? 'font-bold text-primary' : isActive ? 'text-foreground' : 'text-muted-foreground'}
                `}>
                  <Icon className={`w-4 h-4 mx-auto mb-0.5 ${config.colorClass}`} />
                  {config.label}
                </div>
                
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border rounded shadow-md text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {config.description}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Main content */}
      <div className="space-y-8">
        {/* 2. Lens cards grid - 4 columns value ladder */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {tierOptions.map(option => {
            const { tier, primary, alternativeCount, isEmpty, isFallback } = option;
            
            if (isEmpty || !primary) {
              return (
                <TierEmptyState
                  key={tier}
                  tier={tier}
                  isFallback={isFallback}
                  reason={supplierFilter 
                    ? `Nenhuma opção do fornecedor ${supplierFilter}` 
                    : 'Sem lentes disponíveis para esta receita'
                  }
                />
              );
            }
            
            const isRecommended = primary.family.id === mostRecommendedId;
            const isSelected = selectedProducts.some(
              p => p.familyId === primary.family.id && p.type === 'primary'
            );
            
            return (
              <SimplifiedLensCard
                key={tier}
                family={primary.family}
                bestPrice={primary.bestPrice}
                allPrices={primary.allPrices}
                tier={tier}
                isRecommended={isRecommended}
                isSelected={isSelected}
                addons={addons}
                onSelect={handleLensSelect}
                alternativeCount={alternativeCount}
                scoredFamily={primary.scoredFamily}
                showScore={true}
              />
            );
          })}
        </div>

        {/* 3. Tier Comparison Cards - Deltas between tiers */}
        {tierComparisons.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              O que você ganha ao subir de nível
            </h3>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-3">
              {tierComparisons.map((comparison, idx) => (
                <TierComparisonCard
                  key={`${comparison.fromTier}-${comparison.toTier}`}
                  comparison={comparison}
                  onSelectUpper={() => {
                    // Find the primary of the upper tier and select it
                    const upperOption = tierOptions.find(t => t.tier === comparison.toTier);
                    if (upperOption?.primary) {
                      const bestPrice = upperOption.primary.bestPrice || upperOption.primary.allPrices[0];
                      if (bestPrice) {
                        handleLensSelect({
                          familyId: upperOption.primary.family.id,
                          selectedPrice: bestPrice,
                          selectedIndex: (bestPrice as any).availability?.index || (bestPrice as any).index || '1.50',
                          selectedTreatments: bestPrice.addons_detected || [],
                          totalPrice: bestPrice.price_sale_half_pair * 2,
                        });
                      }
                    }
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* No options message */}
        {tierOptions.every(o => o.isEmpty) && (
          <div className="text-center py-12 text-muted-foreground col-span-4">
            <SlidersHorizontal className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhuma lente encontrada</p>
            <p className="text-sm">Tente ajustar os filtros ou verifique a receita</p>
            {hasFilters && (
              <Button variant="link" onClick={clearFilters} className="mt-2">
                Limpar filtros
              </Button>
            )}
          </div>
        )}

        {/* Product Suggestions */}
        {selectedProducts.length > 0 && productSuggestions.length > 0 && (
          <ProductSuggestionCards
            suggestions={productSuggestions}
            onSelectOccupational={() => setShowOccupationalModal(true)}
            onSelectSolar={() => setShowSolarModal(true)}
            hasOccupational={hasProductType(selectedProducts, 'occupational')}
            hasSolar={hasProductType(selectedProducts, 'solar')}
          />
        )}

        {/* Budget Panel */}
        <div className="w-full">
          <BudgetPanel
            products={selectedProducts}
            allPrices={allPricesForFamily}
            selectedFamilyId={primaryProduct?.familyId}
            onRemoveProduct={handleRemoveProduct}
            onUpgradeProduct={handleUpgradeProduct}
            onFinalize={handleFinalize}
          />
        </div>
      </div>

      {/* Modals */}
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
};
