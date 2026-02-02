/**
 * SimplifiedLensCard - Card otimizado para varejo (5 linhas, sem rolagem)
 * 
 * Layout fixo:
 * 1. Título (FAMÍLIA – nome comercial)
 * 2. Subtítulo (tipo + tier + fornecedor)
 * 3. 3 benefícios-chave (pílulas)
 * 4. Preço "a partir de" (SKU mínimo compatível)
 * 5. CTA ("Escolher" / "Melhor opção")
 * 
 * Tudo o resto fica em drawer/modal.
 */

import { useState, useMemo } from 'react';
import { 
  Check, 
  ChevronRight,
  Crown,
  Shield,
  ThumbsUp,
  Zap,
  Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ValueBars } from './ValueBars';
import { LensDetailsDrawer } from './LensDetailsDrawer';
import { useCatalogEnricher } from '@/hooks/useCatalogEnricher';
import type { Family, Price, Addon, Tier, ClinicalType } from '@/types/lens';

interface SimplifiedLensCardProps {
  family: Family;
  bestPrice: Price | null;
  allPrices: Price[];
  tier: Tier;
  isRecommended?: boolean;
  isSelected?: boolean;
  addons: Addon[];
  onSelect: (config: LensCardSelection) => void;
  alternativeCount?: number;
  onViewAlternatives?: () => void;
}

export interface LensCardSelection {
  familyId: string;
  selectedPrice: Price;
  selectedIndex: string;
  selectedTreatments: string[];
  totalPrice: number;
}

// Tier icons
const TIER_ICONS: Record<Tier, React.ElementType> = {
  essential: Shield,
  comfort: ThumbsUp,
  advanced: Zap,
  top: Crown,
};

// Tier labels (PT-BR)
const TIER_LABELS: Record<Tier, string> = {
  essential: 'Essential',
  comfort: 'Conforto',
  advanced: 'Avançada',
  top: 'Premium',
};

// Tier colors
const TIER_STYLES: Record<Tier, {
  bg: string;
  border: string;
  accent: string;
  selectedRing: string;
}> = {
  essential: {
    bg: 'bg-slate-50 dark:bg-slate-900/50',
    border: 'border-slate-200 dark:border-slate-700',
    accent: 'text-slate-600 dark:text-slate-400',
    selectedRing: 'ring-slate-400',
  },
  comfort: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    accent: 'text-blue-600 dark:text-blue-400',
    selectedRing: 'ring-blue-400',
  },
  advanced: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    accent: 'text-purple-600 dark:text-purple-400',
    selectedRing: 'ring-purple-400',
  },
  top: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    accent: 'text-amber-600 dark:text-amber-400',
    selectedRing: 'ring-amber-400',
  },
};

// Get index from price (V3.6.x compatible)
const getIndexFromPrice = (price: Price): string => {
  const avail = (price as any).availability;
  if (avail?.index) return avail.index;
  if ((price as any).index) return (price as any).index;
  return '1.50';
};

export const SimplifiedLensCard = ({
  family,
  bestPrice,
  allPrices,
  tier,
  isRecommended,
  isSelected,
  addons,
  onSelect,
  alternativeCount = 0,
  onViewAlternatives,
}: SimplifiedLensCardProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const { getEnrichedFamily } = useCatalogEnricher();
  const enrichedFamily = getEnrichedFamily(family.id);
  
  const styles = TIER_STYLES[tier];
  const TierIcon = TIER_ICONS[tier];
  const lensCategory = (family.clinical_type || family.category) as ClinicalType;

  // Get display name - always show "Supplier FamilyName" (e.g., "Zeiss Choice")
  const displayName = useMemo(() => {
    // Get the family name part
    let familyName = '';
    if (enrichedFamily?.display_name) {
      familyName = enrichedFamily.display_name;
    } else if (family.name_original) {
      familyName = family.name_original;
    } else {
      // Humanize ID as fallback
      familyName = family.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // If family name already contains supplier, return as is
    if (familyName.toLowerCase().includes(family.supplier.toLowerCase())) {
      return familyName;
    }
    
    // Otherwise, prepend supplier: "Zeiss Choice"
    return `${family.supplier} ${familyName}`;
  }, [enrichedFamily, family]);

  // Get subtitle
  const subtitle = useMemo(() => {
    const category = lensCategory === 'PROGRESSIVA' 
      ? 'Progressiva' 
      : lensCategory === 'OCUPACIONAL' 
        ? 'Ocupacional' 
        : 'Monofocal';
    return `${category} • ${TIER_LABELS[tier]} • ${family.supplier}`;
  }, [lensCategory, tier, family.supplier]);

  // Get 3 sales pills
  const salesPills = useMemo(() => {
    const pills: string[] = [];
    
    // From sales_pills
    if (enrichedFamily?.sales_pills) {
      pills.push(...enrichedFamily.sales_pills.slice(0, 3));
    }
    
    // Fallback defaults if not enough
    const defaults = ['Nitidez', 'Proteção UV', 'Durabilidade'];
    while (pills.length < 3 && defaults.length > 0) {
      const next = defaults.shift()!;
      if (!pills.includes(next)) pills.push(next);
    }
    
    return pills.slice(0, 3);
  }, [enrichedFamily]);

  // Calculate "a partir de" price - use allPrices for display
  const startingPrice = useMemo(() => {
    if (!allPrices.length) return null;
    const sorted = [...allPrices].sort((a, b) => 
      a.price_sale_half_pair - b.price_sale_half_pair
    );
    return sorted[0];
  }, [allPrices]);

  const priceDisplay = startingPrice 
    ? startingPrice.price_sale_half_pair * 2 
    : null;

  // Effective best price: use bestPrice if available, otherwise cheapest from allPrices
  const effectiveBestPrice = bestPrice || startingPrice;

  // Check if we have any options available
  // A family has options if it has prices AND at least one has a valid price
  const hasOptions = allPrices.length > 0 && priceDisplay !== null && priceDisplay > 0;

  // Handle selection - auto-select best SKU or cheapest available
  const handleSelect = () => {
    if (!effectiveBestPrice) return;
    
    onSelect({
      familyId: family.id,
      selectedPrice: effectiveBestPrice,
      selectedIndex: getIndexFromPrice(effectiveBestPrice),
      selectedTreatments: effectiveBestPrice.addons_detected || [],
      totalPrice: effectiveBestPrice.price_sale_half_pair * 2,
    });
  };

  return (
    <>
      <Card className={`
        flex flex-col h-full border-2 transition-all duration-200
        ${isSelected 
          ? `ring-4 ${styles.selectedRing} ring-offset-2 border-transparent shadow-lg scale-[1.02]`
          : isRecommended 
            ? 'ring-2 ring-primary ring-offset-2 border-primary shadow-md' 
            : styles.border
        }
        hover:shadow-md hover:-translate-y-0.5
      `}>
        {/* Header - Tier badge + Recommended badge */}
        <CardHeader className={`${styles.bg} rounded-t-lg p-4 space-y-2`}>
          <div className="flex items-center justify-between gap-2">
            {/* Tier badge */}
            <Badge 
              variant="outline" 
              className={`gap-1 ${styles.accent} border-current`}
            >
              <TierIcon className="w-3.5 h-3.5" />
              {TIER_LABELS[tier]}
            </Badge>
            
            {/* Status badges */}
            <div className="flex gap-1">
              {isSelected && (
                <Badge className="bg-success text-success-foreground text-xs gap-1">
                  <Check className="w-3 h-3" />
                  Selecionada
                </Badge>
              )}
              {isRecommended && !isSelected && (
                <Badge className="bg-primary text-primary-foreground text-xs">
                  Melhor opção
                </Badge>
              )}
            </div>
          </div>
          
          {/* Title and Subtitle */}
          <div>
            <h3 className="font-bold text-foreground text-lg leading-tight line-clamp-1">
              {displayName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4 space-y-4">
          {/* 3 Sales Pills */}
          <div className="flex flex-wrap gap-1.5">
            {salesPills.map((pill, idx) => (
              <Badge 
                key={idx} 
                variant="secondary" 
                className="text-xs font-normal"
              >
                {pill}
              </Badge>
            ))}
          </div>

          {/* Value Bars - Visual comparison (4 axes) */}
          <ValueBars tier={tier} family={enrichedFamily || undefined} />

          {/* Price Display */}
          <div className={`text-center py-3 rounded-lg transition-colors ${
            isSelected ? 'bg-success/10' : 'bg-muted/30'
          }`}>
            {hasOptions && priceDisplay ? (
              <>
                <div className="text-xs text-muted-foreground mb-1">A partir de</div>
                <div className={`text-2xl font-bold ${isSelected ? 'text-success' : 'text-foreground'}`}>
                  R$ {priceDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground mt-1">par completo</div>
              </>
            ) : (
              <div className="text-sm text-destructive font-medium py-2">
                Sem opções para esta receita
              </div>
            )}
          </div>

          {/* View Details Link */}
          <button
            onClick={() => setShowDetails(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1 justify-center"
          >
            <Eye className="w-3 h-3" />
            Ver detalhes
            {alternativeCount > 0 && ` (+${alternativeCount} opções)`}
          </button>

          {/* CTA Button */}
          <div className="mt-auto pt-2">
            <Button 
              onClick={handleSelect}
              disabled={!hasOptions}
              variant={isSelected ? 'outline' : 'default'}
              className={`w-full ${
                isSelected 
                  ? 'border-success text-success hover:bg-success/10' 
                  : isRecommended 
                    ? 'bg-primary hover:bg-primary/90' 
                    : ''
              }`}
            >
              {isSelected ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Selecionada
                </>
              ) : isRecommended ? (
                'Escolher Esta Lente'
              ) : (
                <>
                  Selecionar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Details Drawer */}
      <LensDetailsDrawer
        open={showDetails}
        onOpenChange={setShowDetails}
        family={family}
        enrichedFamily={enrichedFamily || undefined}
        allPrices={allPrices}
        bestPrice={effectiveBestPrice}
        tier={tier}
        addons={addons}
        onSelect={onSelect}
        alternativeCount={alternativeCount}
        onViewAlternatives={onViewAlternatives}
      />
    </>
  );
};
