/**
 * LensDetailsDrawer - Drawer com detalhes completos da lente
 * 
 * Contém tudo que foi removido do card simplificado:
 * - Seleção de índice
 * - Tecnologias incluídas
 * - Knowledge/explicação
 * - Alternativas
 * - Configuração de upgrades
 */

import { useMemo, useState } from 'react';
import { 
  Sparkles, 
  Zap, 
  Info, 
  MessageSquare,
  ChevronRight,
  Check,
  Layers
} from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ValueBars } from './ValueBars';
import { useCatalogResolver } from '@/hooks/useCatalogResolver';
import type { Family, Price, Addon, Tier, ClinicalType } from '@/types/lens';
import type { EnrichedFamily } from '@/lib/catalogEnricher';
import type { LensCardSelection } from './SimplifiedLensCard';

interface LensDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  family: Family;
  enrichedFamily?: EnrichedFamily;
  allPrices: Price[];
  bestPrice: Price | null;
  tier: Tier;
  addons: Addon[];
  onSelect: (config: LensCardSelection) => void;
  alternativeCount?: number;
  onViewAlternatives?: () => void;
}

// Get index from price
const getIndexFromPrice = (price: Price): string => {
  const avail = (price as any).availability;
  if (avail?.index) return avail.index;
  if ((price as any).index) return (price as any).index;
  return '1.50';
};

export const LensDetailsDrawer = ({
  open,
  onOpenChange,
  family,
  enrichedFamily,
  allPrices,
  bestPrice,
  tier,
  addons,
  onSelect,
  alternativeCount = 0,
  onViewAlternatives,
}: LensDetailsDrawerProps) => {
  const { getIndexDisplay, getTechnologiesForFamily } = useCatalogResolver();
  const lensCategory = (family.clinical_type || family.category) as ClinicalType;

  // State for configuration
  const [selectedIndex, setSelectedIndex] = useState<string>(
    bestPrice ? getIndexFromPrice(bestPrice) : '1.50'
  );
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);

  // Get unique indices
  const availableIndices = useMemo(() => {
    const indices = [...new Set(allPrices.map(p => getIndexFromPrice(p)))];
    return indices.sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [allPrices]);

  // Get prices for selected index
  const pricesForIndex = useMemo(() => {
    return allPrices.filter(p => getIndexFromPrice(p) === selectedIndex);
  }, [allPrices, selectedIndex]);

  // Find best price for current configuration
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

    if (matchingPrices.length === 0) matchingPrices = pricesForIndex;

    return matchingPrices.sort((a, b) => 
      a.price_sale_half_pair - b.price_sale_half_pair
    )[0] || null;
  }, [pricesForIndex, selectedTreatments]);

  const totalPrice = currentPrice ? currentPrice.price_sale_half_pair * 2 : 0;

  // Technologies
  const technologies = getTechnologiesForFamily(family as any);

  // Available upgrades from SKUs
  const availableUpgrades = useMemo(() => {
    const allTreatments = new Set<string>();
    allPrices.forEach(p => {
      (p.addons_detected || []).forEach(t => allTreatments.add(t));
    });
    return Array.from(allTreatments);
  }, [allPrices]);

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
    onOpenChange(false);
  };

  // Toggle treatment
  const toggleTreatment = (treatment: string) => {
    setSelectedTreatments(prev => 
      prev.includes(treatment)
        ? prev.filter(t => t !== treatment)
        : [...prev, treatment]
    );
  };

  // Display name
  const displayName = enrichedFamily?.display_name || family.name_original;
  const subtitle = enrichedFamily?.display_subtitle || `${lensCategory} · ${family.supplier}`;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-xl">{displayName}</DrawerTitle>
          <DrawerDescription>{subtitle}</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-6 overflow-y-auto">
          {/* Value Bars - Full view */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Comparativo de Valor
            </h4>
            <ValueBars tier={tier} family={enrichedFamily} showDelta={true} />
          </div>

          {/* Knowledge */}
          {enrichedFamily?.knowledge?.consumer && (
            <div className="bg-primary/5 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground mb-1">Por que esta lente?</p>
                  <p className="text-sm text-muted-foreground">
                    {enrichedFamily.knowledge.consumer}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Technologies */}
          {technologies.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Tecnologias Incluídas
              </h4>
              <div className="grid gap-2">
                {technologies.map(tech => (
                  <div key={tech.id} className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg">
                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{tech.name_common}</p>
                      {tech.description_short && (
                        <p className="text-xs text-muted-foreground">{tech.description_short}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Index Selection */}
          {availableIndices.length > 1 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                Índice (Espessura)
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
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
                  const priceForIndex = allPrices.find(p => getIndexFromPrice(p) === index);
                  const price = priceForIndex ? priceForIndex.price_sale_half_pair * 2 : null;
                  
                  return (
                    <div 
                      key={index} 
                      className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                        selectedIndex === index 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted hover:border-muted-foreground/30'
                      }`}
                    >
                      <RadioGroupItem value={index} id={`detail-index-${index}`} />
                      <Label 
                        htmlFor={`detail-index-${index}`}
                        className="flex-1 cursor-pointer"
                      >
                        <span className="font-medium block">{index}</span>
                        <span className="text-xs text-muted-foreground">{indexDisplay.name}</span>
                        {price && (
                          <span className="text-xs text-primary block mt-1">
                            R$ {price.toLocaleString('pt-BR')}
                          </span>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          )}

          {/* Available Upgrades */}
          {availableUpgrades.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Melhorias Disponíveis</h4>
              <div className="flex flex-wrap gap-2">
                {availableUpgrades.map(upgrade => {
                  const isSelected = selectedTreatments.includes(upgrade);
                  // Find price impact
                  const withUpgrade = allPrices.find(p => 
                    getIndexFromPrice(p) === selectedIndex &&
                    (p.addons_detected || []).includes(upgrade)
                  );
                  const basePrice = allPrices.find(p => 
                    getIndexFromPrice(p) === selectedIndex &&
                    (!p.addons_detected || p.addons_detected.length === 0)
                  );
                  const priceImpact = withUpgrade && basePrice
                    ? (withUpgrade.price_sale_half_pair - basePrice.price_sale_half_pair) * 2
                    : null;
                  
                  return (
                    <Button
                      key={upgrade}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleTreatment(upgrade)}
                      className="gap-1"
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                      {upgrade}
                      {priceImpact && priceImpact > 0 && (
                        <Badge variant="secondary" className="text-[10px] ml-1">
                          +R$ {priceImpact.toLocaleString('pt-BR')}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alternatives link */}
          {alternativeCount > 0 && onViewAlternatives && (
            <Button
              variant="ghost"
              className="w-full justify-between"
              onClick={() => {
                onOpenChange(false);
                onViewAlternatives();
              }}
            >
              Ver outras opções desta família ({alternativeCount})
              <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        <DrawerFooter className="border-t bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Total:</span>
            <span className="text-2xl font-bold text-primary">
              R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex gap-2">
            <DrawerClose asChild>
              <Button variant="outline" className="flex-1">Cancelar</Button>
            </DrawerClose>
            <Button 
              onClick={handleSelect}
              disabled={!currentPrice}
              className="flex-1"
            >
              Adicionar ao Orçamento
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
