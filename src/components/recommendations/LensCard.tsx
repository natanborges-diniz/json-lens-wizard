import { useState, useMemo } from 'react';
import { 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Star,
  ThumbsUp,
  Crown,
  Shield,
  Zap,
  Info
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useCatalogResolver } from '@/hooks/useCatalogResolver';
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

// Icon mapping for dynamic icon resolution
const ICON_MAP: Record<string, React.ElementType> = {
  Shield,
  Star,
  Zap,
  Crown,
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
  const [showAlternatives, setShowAlternatives] = useState(false);
  
  // Use CatalogResolver for all display data
  const { 
    getTierConfig, 
    getIndexDisplay, 
    resolveAddonName,
    resolveFamilyDisplay,
    scaleToStars,
    getTechnologiesForFamily
  } = useCatalogResolver();
  
  // Get tier configuration from resolver (uses JSON data)
  const config = getTierConfig(family.macro);
  const TierIcon = ICON_MAP[config.icon] || Shield;

  // Get unique indices available for this family
  const availableIndices = useMemo(() => {
    const indices = [...new Set(allPrices.map(p => p.index))];
    return indices.sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [allPrices]);

  // State for configuration
  const [selectedIndex, setSelectedIndex] = useState<string>(bestPrice?.index || availableIndices[0] || '1.50');
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);

  // Get prices for selected index
  const pricesForIndex = useMemo(() => {
    return allPrices.filter(p => p.index === selectedIndex);
  }, [allPrices, selectedIndex]);

  // Find the best price for selected index and treatments
  const currentPrice = useMemo(() => {
    let matchingPrices = pricesForIndex;
    
    if (selectedTreatments.length > 0) {
      matchingPrices = pricesForIndex.filter(p => {
        const detected = p.addons_detected || [];
        return selectedTreatments.every(t => detected.includes(t));
      });
    } else {
      const noAddonPrices = pricesForIndex.filter(p => !p.addons_detected || p.addons_detected.length === 0);
      if (noAddonPrices.length > 0) {
        matchingPrices = noAddonPrices;
      }
    }

    if (matchingPrices.length === 0) {
      matchingPrices = pricesForIndex;
    }

    return matchingPrices.sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0] || null;
  }, [pricesForIndex, selectedTreatments]);

  // Calculate total price (pair)
  const totalPrice = currentPrice ? currentPrice.price_sale_half_pair * 2 : 0;

  // Get available treatments for this family
  const availableTreatments = useMemo(() => {
    const treatmentIds = new Set<string>();
    allPrices.forEach(p => {
      (p.addons_detected || []).forEach(addon => {
        // Check if addon exists in our addons list
        if (addons.some(a => a.id === addon)) {
          treatmentIds.add(addon);
        }
      });
    });
    return Array.from(treatmentIds);
  }, [allPrices, addons]);

  // Handle treatment toggle
  const toggleTreatment = (treatmentId: string) => {
    setSelectedTreatments(prev => 
      prev.includes(treatmentId)
        ? prev.filter(t => t !== treatmentId)
        : [...prev, treatmentId]
    );
  };

  // Get attribute display value
  const getAttributeValue = (attrId: string): number => {
    const base = family.attributes_base?.[attrId];
    return typeof base === 'number' ? base : 0;
  };

  // Filter relevant attributes based on category
  const getRelevantAttributes = () => {
    const prefix = family.category === 'PROGRESSIVA' ? 'PROG_' : 'MONO_';
    return attributeDefs.filter(a => 
      a.id.startsWith(prefix) || ['AR_QUALIDADE', 'BLUE', 'DURABILIDADE'].includes(a.id)
    );
  };

  const relevantAttributes = getRelevantAttributes();

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

  // Get addon display info using resolver
  const getAddonInfo = (addonId: string) => {
    const addon = addons.find(a => a.id === addonId);
    if (!addon) return { name: addonId, description: '' };
    
    return {
      name: resolveAddonName(addon, family.supplier),
      description: addon.description_client,
    };
  };

  return (
    <Card className={`flex flex-col h-full border-2 transition-all duration-300 ${
      isSelected
        ? `ring-4 ${config.selectedBorderClass} ring-offset-2 border-transparent shadow-lg scale-[1.02]`
        : isRecommended 
          ? 'ring-2 ring-primary ring-offset-2 border-primary' 
          : config.borderClass
    }`}>
      {/* Header */}
      <CardHeader className={`${config.bgHeaderClass} rounded-t-lg p-4 space-y-2`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TierIcon className={`w-5 h-5 ${config.colorClass}`} />
            <span className={`font-bold ${config.colorClass}`}>{config.label}</span>
          </div>
          <div className="flex gap-1">
            {isSelected && (
              <Badge className="bg-success text-success-foreground text-xs gap-1">
                <Check className="w-3 h-3" />
                Selecionada
              </Badge>
            )}
            {isRecommended && !isSelected && (
              <Badge className="bg-primary text-primary-foreground text-xs gap-1">
                <ThumbsUp className="w-3 h-3" />
                Recomendada
              </Badge>
            )}
          </div>
        </div>
        
        <div>
          <h3 className="font-bold text-foreground text-lg leading-tight">
            {family.name_original}
          </h3>
          <div className="flex flex-wrap items-center gap-1 mt-1">
            <Badge variant="outline" className="text-xs">
              {family.supplier}
            </Badge>
            {/* Show up to 2 technologies as badges */}
            {getTechnologiesForFamily(family as any).slice(0, 2).map(tech => (
              <Badge key={tech.id} variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                {tech.name_common}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 space-y-4">
        {/* Price */}
        <div className={`text-center py-3 rounded-lg transition-colors ${
          isSelected ? 'bg-success/10' : 'bg-muted/30'
        }`}>
          {currentPrice ? (
            <>
              <div className={`text-3xl font-bold ${isSelected ? 'text-success' : 'text-foreground'}`}>
                R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground">par completo</div>
            </>
          ) : (
            <div className="text-sm text-destructive font-medium">
              Indisponível para esta receita
            </div>
          )}
        </div>

        {/* Attributes - Scale 1-5 using resolver */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1">
            Características
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Escala de 1 a 5 estrelas</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h4>
          <div className="space-y-1.5">
            {relevantAttributes.slice(0, 5).map(attr => {
              const rawValue = getAttributeValue(attr.id);
              const stars = scaleToStars(rawValue);
              return (
                <div key={attr.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {attr.name_common}
                  </span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Star 
                        key={i}
                        className={`w-3 h-3 ${
                          i <= stars 
                            ? `${config.colorClass} fill-current`
                            : 'text-muted'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Index Selection - using resolver */}
        {availableIndices.length > 1 && (
          <div className="space-y-2 border-t pt-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              Índice (Espessura)
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

        {/* Treatment Selection - using resolver for names */}
        {availableTreatments.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              Tratamentos
            </h4>
            <div className="space-y-2">
              {availableTreatments.map(treatmentId => {
                const addonInfo = getAddonInfo(treatmentId);
                
                return (
                  <label 
                    key={treatmentId}
                    className="flex items-start gap-2 cursor-pointer group"
                  >
                    <Checkbox 
                      checked={selectedTreatments.includes(treatmentId)}
                      onCheckedChange={() => toggleTreatment(treatmentId)}
                      className="mt-0.5 data-[state=checked]:bg-primary"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                        {addonInfo.name}
                      </span>
                      <p className="text-[10px] text-muted-foreground">{addonInfo.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Benefits - from JSON attributes_display_base */}
        <div className="space-y-1.5 border-t pt-3">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Inclusos
          </h4>
          {family.attributes_display_base.slice(0, 3).map((attr, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <Check className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{attr}</span>
            </div>
          ))}
          {family.attributes_display_base.length > 3 && (
            <div className="text-xs text-muted-foreground pl-5">
              +{family.attributes_display_base.length - 3} benefícios
            </div>
          )}
        </div>

        {/* Alternatives toggle */}
        {alternativeFamilies.length > 0 && (
          <div className="border-t pt-3">
            <button
              onClick={() => setShowAlternatives(!showAlternatives)}
              className="flex items-center gap-1 text-xs text-primary hover:underline w-full justify-center"
            >
              {showAlternatives ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Ocultar alternativas
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Ver {alternativeFamilies.length} alternativa{alternativeFamilies.length > 1 ? 's' : ''}
                </>
              )}
            </button>
            
            {showAlternatives && (
              <div className="mt-3 space-y-2">
                {alternativeFamilies.map(alt => (
                  <button
                    key={alt.family.id}
                    onClick={() => {
                      if (onSelectAlternative && alt.allPrices) {
                        onSelectAlternative(alt.family, alt.allPrices);
                      }
                    }}
                    className="w-full p-2 bg-muted/30 rounded-lg flex items-center justify-between hover:bg-primary/10 hover:border-primary border border-transparent transition-all group text-left"
                  >
                    <div>
                      <div className="text-sm font-medium group-hover:text-primary transition-colors">
                        {alt.family.name_original}
                      </div>
                      <div className="text-xs text-muted-foreground">{alt.family.supplier}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {alt.bestPrice && (
                        <div className="text-right">
                          <div className="text-sm font-bold">
                            R$ {(alt.bestPrice.price_sale_half_pair * 2).toLocaleString('pt-BR')}
                          </div>
                        </div>
                      )}
                      <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-primary rotate-[-90deg]" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Select button */}
        <div className="mt-auto pt-3">
          <Button 
            onClick={handleSelect}
            disabled={!currentPrice}
            variant={isSelected ? 'outline' : 'default'}
            className={`w-full ${
              isSelected 
                ? 'border-success text-success hover:bg-success/10' 
                : isRecommended 
                  ? 'gradient-primary' 
                  : ''
            }`}
          >
            {isSelected ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Selecionada
              </>
            ) : isRecommended ? (
              'Escolher Recomendada'
            ) : (
              'Selecionar'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
