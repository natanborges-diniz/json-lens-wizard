/**
 * LensDetailsDrawer - Drawer com detalhes completos da lente
 * 
 * REFATORADO para:
 * 1. Inicializar com o menor preço (consistente com o card)
 * 2. Exibir TODAS as combinações de SKUs claramente
 * 3. Permitir toggle de tratamentos com atualização de preço em tempo real
 */

import { useMemo, useState, useEffect } from 'react';
import { 
  Sparkles, 
  Zap, 
  Info, 
  MessageSquare,
  Check,
  Layers,
  Package
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
import { Checkbox } from '@/components/ui/checkbox';
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

// v3.6.2.3: Get index from price.index_value (NO inference from description)
const getIndexFromPrice = (price: Price): string => {
  if ((price as any).index_value != null) return String((price as any).index_value);
  const avail = (price as any).availability;
  if (avail?.index) return avail.index;
  if ((price as any).index) return (price as any).index;
  return '1.50';
};

// v3.6.2.3: Treatment labels from ADDON_SHORT_LABELS (no string inference)
const TREATMENT_LABELS: Record<string, string> = {
  'ADDON_BLUE': 'Filtro Luz Azul',
  'ADDON_BLUE_UV': 'Filtro Azul UV',
  'ADDON_AR': 'Antirreflexo',
  'ADDON_AR_PREMIUM': 'AR Premium',
  'ADDON_PHOTO': 'Fotossensível',
  'ADDON_PHOTO_GRAY': 'Foto Cinza',
  'ADDON_PHOTO_BROWN': 'Foto Marrom',
  'ADDON_TRANSITIONS': 'Transitions',
  'ADDON_POLAR': 'Polarizada',
  'ADDON_MIRROR': 'Espelhada',
  'ADDON_DLC': 'DLC',
  'ADDON_HIDRO': 'Hidrofóbico',
};

const getTreatmentLabel = (id: string): string => {
  if (TREATMENT_LABELS[id]) return TREATMENT_LABELS[id];
  // Fallback: humanize the ID (no inference from description)
  return id.replace(/^ADDON_/, '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Index labels
const INDEX_LABELS: Record<string, { name: string; description: string }> = {
  '1.50': { name: 'Padrão', description: 'Espessura normal' },
  '1.56': { name: 'Fino', description: 'Lente mais fina' },
  '1.59': { name: 'Extra fino', description: 'Lente muito fina' },
  '1.60': { name: 'Extra fino', description: 'Ideal para graus médios' },
  '1.67': { name: 'Ultra fino', description: 'Para graus altos' },
  '1.74': { name: 'Super fino', description: 'Máxima finura' },
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
  const { getTechnologiesForFamily } = useCatalogResolver();
  const lensCategory = (family.clinical_type || family.category) as ClinicalType;

  // Find the cheapest price (same as card shows)
  const cheapestPrice = useMemo(() => {
    if (!allPrices.length) return null;
    return [...allPrices].sort((a, b) => 
      a.price_sale_half_pair - b.price_sale_half_pair
    )[0];
  }, [allPrices]);

  // Initialize with cheapest price to match card display
  const [selectedIndex, setSelectedIndex] = useState<string>('1.50');
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);

  // Reset state when drawer opens with correct initial values
  useEffect(() => {
    if (open && cheapestPrice) {
      setSelectedIndex(getIndexFromPrice(cheapestPrice));
      setSelectedTreatments(cheapestPrice.addons_detected || []);
    }
  }, [open, cheapestPrice]);

  // Get unique indices with prices
  const indexOptions = useMemo(() => {
    const indexMap = new Map<string, { prices: Price[]; minPrice: number }>();
    
    allPrices.forEach(price => {
      const idx = getIndexFromPrice(price);
      const existing = indexMap.get(idx);
      if (!existing) {
        indexMap.set(idx, { 
          prices: [price], 
          minPrice: price.price_sale_half_pair 
        });
      } else {
        existing.prices.push(price);
        if (price.price_sale_half_pair < existing.minPrice) {
          existing.minPrice = price.price_sale_half_pair;
        }
      }
    });

    return Array.from(indexMap.entries())
      .map(([idx, data]) => ({
        index: idx,
        label: INDEX_LABELS[idx] || { name: idx, description: '' },
        minPrice: data.minPrice * 2,
        priceCount: data.prices.length,
      }))
      .sort((a, b) => parseFloat(a.index) - parseFloat(b.index));
  }, [allPrices]);

  // Get available treatments for current index
  const treatmentOptions = useMemo(() => {
    const pricesForIndex = allPrices.filter(p => getIndexFromPrice(p) === selectedIndex);
    const treatmentMap = new Map<string, { 
      minPrice: number; 
      priceWithout: number;
      priceImpact: number;
    }>();

    // Find base price (no treatments) for this index
    const basePrices = pricesForIndex.filter(p => 
      !p.addons_detected || p.addons_detected.length === 0
    );
    const basePrice = basePrices.length > 0 
      ? Math.min(...basePrices.map(p => p.price_sale_half_pair))
      : Math.min(...pricesForIndex.map(p => p.price_sale_half_pair));

    // Collect all treatments
    pricesForIndex.forEach(price => {
      (price.addons_detected || []).forEach(treatment => {
        const existing = treatmentMap.get(treatment);
        if (!existing || price.price_sale_half_pair < existing.minPrice) {
          treatmentMap.set(treatment, {
            minPrice: price.price_sale_half_pair,
            priceWithout: basePrice,
            priceImpact: (price.price_sale_half_pair - basePrice) * 2,
          });
        }
      });
    });

    return Array.from(treatmentMap.entries()).map(([id, data]) => ({
      id,
      label: getTreatmentLabel(id),
      priceImpact: data.priceImpact,
    }));
  }, [allPrices, selectedIndex]);

  // Calculate current price based on selections
  const currentPrice = useMemo(() => {
    const pricesForIndex = allPrices.filter(p => getIndexFromPrice(p) === selectedIndex);
    
    if (selectedTreatments.length === 0) {
      // Find cheapest for this index (preferably without treatments)
      const noTreatmentPrices = pricesForIndex.filter(p => 
        !p.addons_detected || p.addons_detected.length === 0
      );
      const candidates = noTreatmentPrices.length > 0 ? noTreatmentPrices : pricesForIndex;
      return candidates.sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0] || null;
    }

    // Find price that includes all selected treatments
    const matchingPrices = pricesForIndex.filter(p => {
      const detected = p.addons_detected || [];
      return selectedTreatments.every(t => detected.includes(t));
    });

    if (matchingPrices.length > 0) {
      return matchingPrices.sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0];
    }

    // Fallback: return cheapest for index
    return pricesForIndex.sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0] || null;
  }, [allPrices, selectedIndex, selectedTreatments]);

  const totalPrice = currentPrice ? currentPrice.price_sale_half_pair * 2 : 0;

  // Technologies from family.technology_refs
  const technologies = getTechnologiesForFamily(family as any);

  // Toggle treatment
  const toggleTreatment = (treatmentId: string) => {
    setSelectedTreatments(prev => {
      if (prev.includes(treatmentId)) {
        return prev.filter(t => t !== treatmentId);
      } else {
        return [...prev, treatmentId];
      }
    });
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
    onOpenChange(false);
  };

  // Display name
  const displayName = enrichedFamily?.display_name || family.name_original;
  const subtitle = `${lensCategory === 'PROGRESSIVA' ? 'Progressiva' : lensCategory === 'OCUPACIONAL' ? 'Ocupacional' : 'Monofocal'} · ${tier.charAt(0).toUpperCase() + tier.slice(1)} · ${family.supplier}`;

  // Total SKU count
  const totalSkuCount = allPrices.length;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-xl">{displayName}</DrawerTitle>
          <DrawerDescription className="flex items-center gap-2">
            {subtitle}
            <Badge variant="secondary" className="text-xs">
              <Package className="w-3 h-3 mr-1" />
              {totalSkuCount} opções
            </Badge>
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-6 overflow-y-auto">
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

          {/* Index Selection - ALWAYS visible with prices */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              Índice (Espessura)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Índices maiores = lentes mais finas e leves</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </h4>
            <RadioGroup 
              value={selectedIndex} 
              onValueChange={(value) => {
                setSelectedIndex(value);
                // Reset treatments when changing index (they may not be available)
                setSelectedTreatments([]);
              }}
              className="grid grid-cols-2 gap-2"
            >
              {indexOptions.map(option => {
                const isSelected = selectedIndex === option.index;
                
                return (
                  <div 
                    key={option.index} 
                    className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5' 
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                    onClick={() => {
                      setSelectedIndex(option.index);
                      setSelectedTreatments([]);
                    }}
                  >
                    <RadioGroupItem value={option.index} id={`detail-index-${option.index}`} />
                    <Label 
                      htmlFor={`detail-index-${option.index}`}
                      className="flex-1 cursor-pointer"
                    >
                      <span className="font-medium block">{option.index}</span>
                      <span className="text-xs text-muted-foreground">{option.label.name}</span>
                      <span className="text-xs text-primary block mt-1 font-medium">
                        A partir de R$ {option.minPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          {/* Treatment Selection with Checkboxes (toggleable) */}
          {treatmentOptions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                Tratamentos
                <Badge variant="secondary" className="text-xs">
                  {treatmentOptions.length} disponíveis
                </Badge>
              </h4>
              <p className="text-xs text-muted-foreground">
                Selecione os tratamentos desejados. O preço será atualizado automaticamente.
              </p>
              <div className="space-y-2">
                {treatmentOptions.map(treatment => {
                  const isSelected = selectedTreatments.includes(treatment.id);
                  
                  return (
                    <div
                      key={treatment.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        isSelected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-muted hover:border-muted-foreground/30'
                      }`}
                      onClick={() => toggleTreatment(treatment.id)}
                    >
                      <Checkbox
                        id={`treatment-${treatment.id}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleTreatment(treatment.id)}
                      />
                      <Label 
                        htmlFor={`treatment-${treatment.id}`}
                        className="flex-1 cursor-pointer"
                      >
                        <span className="font-medium">{treatment.label}</span>
                      </Label>
                      {treatment.priceImpact > 0 && (
                        <Badge 
                          variant={isSelected ? 'default' : 'outline'} 
                          className="text-xs shrink-0"
                        >
                          {isSelected ? '' : '+'} R$ {treatment.priceImpact.toLocaleString('pt-BR')}
                        </Badge>
                      )}
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Value Bars - Full view */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Comparativo de Valor
            </h4>
            <ValueBars tier={tier} family={enrichedFamily} showDelta={true} />
          </div>
        </div>

        <DrawerFooter className="border-t bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-sm text-muted-foreground">Total:</span>
              {selectedTreatments.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedTreatments.map(t => getTreatmentLabel(t)).join(', ')}
                </p>
              )}
            </div>
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
