/**
 * LensCard - Redesigned for clarity and intuitive navigation
 * 
 * Key improvements:
 * - Clear tier explanation with TierExplainer
 * - Upgrade selector with pricing impact visible
 * - Alternatives with clear reasoning
 * - Simplified attribute display
 */

import { useState, useMemo } from 'react';
import { 
  Check, 
  Star,
  ThumbsUp,
  Info,
  Sparkles,
  MessageSquare,
  Shield,
  Zap,
  Crown
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TierExplainer, TierComparisonStrip } from './TierExplainer';
import { UpgradeSelector } from './UpgradeSelector';
import { AlternativesList, AlternativesQuickInfo } from './AlternativesList';
import { useCatalogResolver } from '@/hooks/useCatalogResolver';
import { useCatalogEnricher } from '@/hooks/useCatalogEnricher';
import type { Family, Price, Addon, Tier } from '@/types/lens';

interface LensCardProps {
  family: Family;
  bestPrice: Price | null;
  allPrices: Price[];
  tier: Tier;
  isRecommended?: boolean;
  isSelected?: boolean;
  addons: Addon[];
  onSelect: (configuration: LensCardConfiguration) => void;
  onSelectAlternative?: (family: Family, allPrices: Price[]) => void;
  alternativeFamilies?: { family: Family; bestPrice: Price | null; allPrices?: Price[] }[];
  attributeDefs?: { id: string; name_common: string }[];
}

export interface LensCardConfiguration {
  familyId: string;
  selectedPrice: Price;
  selectedIndex: string;
  selectedTreatments: string[];
  totalPrice: number;
}

// Icon mapping for tiers
const TIER_ICONS: Record<Tier, React.ElementType> = {
  essential: Shield,
  comfort: ThumbsUp,
  advanced: Zap,
  top: Crown,
};

// Tier color configuration
const TIER_COLORS: Record<Tier, {
  colorClass: string;
  bgClass: string;
  borderClass: string;
  selectedBorderClass: string;
}> = {
  essential: {
    colorClass: 'text-slate-600',
    bgClass: 'bg-slate-50',
    borderClass: 'border-slate-200',
    selectedBorderClass: 'ring-slate-400',
  },
  comfort: {
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    selectedBorderClass: 'ring-blue-400',
  },
  advanced: {
    colorClass: 'text-purple-600',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
    selectedBorderClass: 'ring-purple-400',
  },
  top: {
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    selectedBorderClass: 'ring-amber-400',
  },
};

// Tier labels
const TIER_LABELS: Record<Tier, string> = {
  essential: 'Essencial',
  comfort: 'Conforto',
  advanced: 'Avançada',
  top: 'Top',
};

export const LensCard = ({
  family,
  bestPrice,
  allPrices,
  tier,
  isRecommended,
  isSelected,
  addons,
  onSelect,
  onSelectAlternative,
  alternativeFamilies = [],
  attributeDefs = [],
}: LensCardProps) => {
  const { getIndexDisplay, getTechnologiesForFamily } = useCatalogResolver();
  const { getEnrichedFamily } = useCatalogEnricher();
  const enrichedFamily = getEnrichedFamily(family.id);
  
  const colors = TIER_COLORS[tier];
  const TierIcon = TIER_ICONS[tier];

  // Helper to get index from price
  const getIndexFromPrice = (price: Price): string => {
    const avail = (price as any).availability;
    if (avail?.index) return avail.index;
    if ((price as any).index) return (price as any).index;
    return '1.50';
  };

  // Get unique indices
  const availableIndices = useMemo(() => {
    const indices = [...new Set(allPrices.map(p => getIndexFromPrice(p)))];
    return indices.sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [allPrices]);

  // State for configuration
  const [selectedIndex, setSelectedIndex] = useState<string>(
    bestPrice ? getIndexFromPrice(bestPrice) : availableIndices[0] || '1.50'
  );
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);

  // Get prices for selected index
  const pricesForIndex = useMemo(() => {
    return allPrices.filter(p => getIndexFromPrice(p) === selectedIndex);
  }, [allPrices, selectedIndex]);

  // Find the best price for selected configuration
  const currentPrice = useMemo(() => {
    let matchingPrices = pricesForIndex;
    
    if (selectedTreatments.length > 0) {
      matchingPrices = pricesForIndex.filter(p => {
        const detected = p.addons_detected || [];
        return selectedTreatments.every(t => detected.includes(t));
      });
    } else {
      const noAddonPrices = pricesForIndex.filter(p => 
        !p.addons_detected || p.addons_detected.length === 0
      );
      if (noAddonPrices.length > 0) {
        matchingPrices = noAddonPrices;
      }
    }

    if (matchingPrices.length === 0) {
      matchingPrices = pricesForIndex;
    }

    return matchingPrices.sort((a, b) => 
      a.price_sale_half_pair - b.price_sale_half_pair
    )[0] || null;
  }, [pricesForIndex, selectedTreatments]);

  // Calculate total price (pair)
  const totalPrice = currentPrice ? currentPrice.price_sale_half_pair * 2 : 0;
  const basePrice = bestPrice ? bestPrice.price_sale_half_pair * 2 : 0;

  // Get available treatments from SKUs
  const availableTreatments = useMemo(() => {
    const treatmentMap = new Map<string, number>();
    
    allPrices.forEach(p => {
      (p.addons_detected || []).forEach(addon => {
        treatmentMap.set(addon, (treatmentMap.get(addon) || 0) + 1);
      });
    });
    
    return Array.from(treatmentMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
  }, [allPrices]);

  // Toggle treatment
  const toggleTreatment = (treatmentId: string) => {
    setSelectedTreatments(prev => 
      prev.includes(treatmentId)
        ? prev.filter(t => t !== treatmentId)
        : [...prev, treatmentId]
    );
  };

  // Handle selection
  const handleSelect = () => {
    if (!currentPrice) return;
    
    onSelect({
      familyId: family.id,
      selectedPrice: currentPrice,
      selectedIndex,
      selectedTreatments,
      totalPrice,
    });
  };

  // Alternatives price range
  const alternativesPriceRange = useMemo(() => {
    if (alternativeFamilies.length === 0) return null;
    
    const prices = alternativeFamilies
      .filter(a => a.bestPrice)
      .map(a => a.bestPrice!.price_sale_half_pair * 2);
    
    if (prices.length === 0) return null;
    
    return {
      lowest: Math.min(...prices),
      highest: Math.max(...prices),
    };
  }, [alternativeFamilies]);

  // Technologies
  const technologies = getTechnologiesForFamily(family as any);

  return (
    <Card className={`flex flex-col h-full border-2 transition-all duration-300 ${
      isSelected
        ? `ring-4 ${colors.selectedBorderClass} ring-offset-2 border-transparent shadow-lg scale-[1.02]`
        : isRecommended 
          ? 'ring-2 ring-primary ring-offset-2 border-primary' 
          : colors.borderClass
    }`}>
      {/* Header - Tier + Product Name */}
      <CardHeader className={`${colors.bgClass} rounded-t-lg p-4 space-y-3`}>
        {/* Tier Badge and Status */}
        <div className="flex items-center justify-between gap-2">
          <TierExplainer tier={tier} isRecommended={isRecommended} />
          
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
        
        {/* Product Name */}
        <div>
          <h3 className="font-bold text-foreground text-lg leading-tight">
            {enrichedFamily?.display_name || family.name_original}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {enrichedFamily?.display_subtitle || `${family.category} · ${family.supplier}`}
          </p>
        </div>

        {/* Alternatives Quick Info */}
        {alternativeFamilies.length > 0 && alternativesPriceRange && (
          <AlternativesQuickInfo
            count={alternativeFamilies.length}
            lowestPrice={alternativesPriceRange.lowest}
            highestPrice={alternativesPriceRange.highest}
          />
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 space-y-4">
        {/* Sales Pills */}
        {enrichedFamily?.sales_pills && enrichedFamily.sales_pills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {enrichedFamily.sales_pills.slice(0, 3).map((pill, idx) => (
              <Badge key={idx} variant="secondary" className="text-[10px] py-0.5">
                {pill}
              </Badge>
            ))}
          </div>
        )}

        {/* Price Display */}
        <div className={`text-center py-4 rounded-lg transition-colors ${
          isSelected ? 'bg-success/10' : 'bg-muted/30'
        }`}>
          {currentPrice ? (
            <>
              <div className={`text-3xl font-bold ${isSelected ? 'text-success' : 'text-foreground'}`}>
                R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground mt-1">par completo</div>
              {totalPrice !== basePrice && (
                <div className="text-xs text-muted-foreground mt-1">
                  Base: R$ {basePrice.toLocaleString('pt-BR')} 
                  <span className="text-primary ml-1">
                    (+R$ {(totalPrice - basePrice).toLocaleString('pt-BR')})
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-destructive font-medium">
              Indisponível para esta receita
            </div>
          )}
        </div>

        {/* Technologies */}
        {technologies.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Tecnologias Incluídas
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {technologies.slice(0, 4).map(tech => (
                <TooltipProvider key={tech.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs cursor-help gap-1">
                        <Sparkles className="w-3 h-3" />
                        {tech.name_common}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[250px]">
                      <p className="text-xs">
                        {tech.description_short || tech.description_long || 'Tecnologia exclusiva'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
              {technologies.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{technologies.length - 4}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Knowledge / Why this lens */}
        {enrichedFamily?.knowledge?.consumer && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-muted/30 rounded-lg p-3 cursor-help">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-medium text-foreground mb-1">Por que esta lente?</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {enrichedFamily.knowledge.consumer}
                      </p>
                    </div>
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-[320px]">
                <p className="text-xs">{enrichedFamily.knowledge.consumer}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* Index Selection */}
        {availableIndices.length > 1 && (
          <div className="space-y-2 border-t pt-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1">
              Índice (Espessura)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3 h-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Índices maiores = lentes mais finas</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </h4>
            <RadioGroup 
              value={selectedIndex} 
              onValueChange={setSelectedIndex}
              className="grid grid-cols-2 gap-2"
            >
              {availableIndices.map(index => {
                const indexDisplay = getIndexDisplay(index);
                return (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={index} id={`${family.id}-index-${index}`} />
                    <Label 
                      htmlFor={`${family.id}-index-${index}`}
                      className="text-xs cursor-pointer flex flex-col"
                    >
                      <span className="font-medium">{index}</span>
                      <span className="text-muted-foreground text-[10px]">{indexDisplay.name}</span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>
        )}

        {/* Upgrade Selector */}
        {availableTreatments.length > 0 && (
          <div className="border-t pt-3">
            <UpgradeSelector
              availableTreatments={availableTreatments}
              selectedTreatments={selectedTreatments}
              onToggleTreatment={toggleTreatment}
              allPrices={allPrices}
              currentIndex={selectedIndex}
              basePrice={basePrice}
              compact={true}
            />
          </div>
        )}

        {/* Alternatives */}
        {alternativeFamilies.length > 0 && (
          <div className="border-t pt-3">
            <AlternativesList
              alternatives={alternativeFamilies}
              currentSupplier={family.supplier}
              tier={tier}
              onSelectAlternative={onSelectAlternative}
            />
          </div>
        )}

        {/* Select Button */}
        <div className="mt-auto pt-3">
          <Button 
            onClick={handleSelect}
            disabled={!currentPrice}
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
              'Selecionar'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
