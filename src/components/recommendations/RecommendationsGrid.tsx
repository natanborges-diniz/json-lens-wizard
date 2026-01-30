/**
 * RecommendationsGrid - Refatorado para modelo varejo ótico
 * 
 * Layout:
 * - 4 cards (escada) Essential / Comfort / Advanced / Top
 * - Painel lateral fixo "Seu Orçamento" sempre visível
 * - Cards simplificados (5 linhas, sem rolagem)
 * - Comparativo visual com barras 1-5
 * - Upsell baseado em SKUs reais
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
import { BudgetPanel } from './BudgetPanel';
import { SmartSearch, AIRecommendation, AIResponse } from '@/components/search/SmartSearch';
import { ProductSuggestionCards } from './ProductSuggestionCards';
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
  onSelectLens: (configuration: LensCardSelection) => void;
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
}: RecommendationsGridProps) => {
  const [supplierFilter, setSupplierFilter] = useState<string | null>(null);
  const [highlightedFamilies, setHighlightedFamilies] = useState<string[]>([]);
  
  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>('system');

  // Product cart state
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
  const [showOccupationalModal, setShowOccupationalModal] = useState(false);
  const [showSolarModal, setShowSolarModal] = useState(false);

  // Get all families flat
  const allFamilies = useMemo(() => {
    return Object.values(recommendations).flat();
  }, [recommendations]);

  // Get ALL prices from all families (for upgrade finding in any family)
  const allPricesMap = useMemo(() => {
    const map = new Map<string, Price[]>();
    allFamilies.forEach(f => {
      map.set(f.family.id, f.allPrices);
    });
    return map;
  }, [allFamilies]);

  // Get all prices for selected family (for upgrades panel)
  const allPricesForFamily = useMemo(() => {
    const primaryProduct = selectedProducts.find(p => p.type === 'primary');
    if (!primaryProduct) return [];
    
    return allPricesMap.get(primaryProduct.familyId) || [];
  }, [selectedProducts, allPricesMap]);

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

  // Handle lens selection - add to cart as primary
  const handleLensSelect = useCallback((config: LensCardSelection) => {
    const family = allFamilies.find(f => f.family.id === config.familyId);
    if (!family) return;

    const newPrimary: SelectedProduct = {
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
      return [newPrimary, ...filtered];
    });

    // Also call the original handler for backward compatibility
    onSelectLens(config);
  }, [allFamilies, onSelectLens]);

  // Handle upgrade selection
  const handleUpgradeProduct = useCallback((productId: string, upgrade: any) => {
    setSelectedProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      
      // Update product with upgrade
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

  // Get one option per tier (the best one) + alternatives count
  // IMPORTANT: Filter out families with no prices (allPrices.length === 0)
  const tierOptions = useMemo(() => {
    return TIER_ORDER.map(tier => {
      let tierFamilies = recommendations[tier] || [];
      
      // Filter out families without any prices (indisponível)
      tierFamilies = tierFamilies.filter(f => f.allPrices.length > 0);
      
      // Apply supplier filter
      if (supplierFilter) {
        tierFamilies = tierFamilies.filter(f => f.family.supplier === supplierFilter);
      }

      // Apply highlight filter from AI search
      if (highlightedFamilies.length > 0) {
        tierFamilies = tierFamilies.filter(f => highlightedFamilies.includes(f.family.id));
      }

      if (tierFamilies.length === 0) return null;

      // Primary option (first one or first highlighted)
      const primary = highlightedFamilies.length > 0
        ? tierFamilies.sort((a, b) => {
            const aIdx = highlightedFamilies.indexOf(a.family.id);
            const bIdx = highlightedFamilies.indexOf(b.family.id);
            return aIdx - bIdx;
          })[0]
        : tierFamilies[0];
      
      // Alternative count
      const alternativeCount = tierFamilies.length - 1;

      return {
        tier,
        primary,
        alternativeCount,
        config: TIER_CONFIG[tier],
      };
    }).filter(Boolean) as Array<{
      tier: Tier;
      primary: FamilyWithPrice;
      alternativeCount: number;
      config: typeof TIER_CONFIG[Tier];
    }>;
  }, [recommendations, supplierFilter, highlightedFamilies]);

  // Get all unique suppliers from available families
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

  // Current selected tier (based on primary product)
  const currentTierIndex = useMemo(() => {
    if (!primaryProduct) return -1;
    const tierOption = tierOptions.find(t => t.primary.family.id === primaryProduct.familyId);
    return tierOption ? TIER_ORDER.indexOf(tierOption.tier) : -1;
  }, [primaryProduct, tierOptions]);

  return (
    <div className="space-y-6">
      {/* Smart Search */}
      <SmartSearch
        lensData={lensData || null}
        anamnesisData={anamnesisData || defaultAnamnesis}
        lensCategory={lensCategory}
        onHighlightFamilies={handleHighlightFamilies}
        onSuggestAddons={() => {}}
        onSelectAIRecommendation={() => {}}
      />

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

      {/* Tier Progress Bar - Visual staircase */}
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
                
                {/* Label below */}
                <div className={`
                  mt-2 text-center text-xs transition-colors
                  ${isCurrent ? 'font-bold text-primary' : isActive ? 'text-foreground' : 'text-muted-foreground'}
                `}>
                  <Icon className={`w-4 h-4 mx-auto mb-0.5 ${config.colorClass}`} />
                  {config.label}
                </div>
                
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border rounded shadow-md text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                  {config.description}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Main content - responsive layout */}
      <div className="flex flex-col xl:flex-row gap-6">
        {/* Left: Lens cards grid */}
        <div className="flex-1 min-w-0 space-y-6">
          {tierOptions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 auto-rows-fr">
              {tierOptions.map(option => {
                const { tier, primary, alternativeCount } = option;
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
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <SlidersHorizontal className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Nenhuma lente encontrada</p>
              <p className="text-sm">Tente ajustar os filtros</p>
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
        </div>

        {/* Right: Budget Panel - fixed width on xl+ */}
        <div className="xl:w-80 xl:flex-shrink-0">
          <div className="sticky top-24">
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
};
