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
  Info,
  Sparkles,
  ArrowUpCircle,
  Eye
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

// Tier descriptions for clear differentiation
const TIER_DESCRIPTIONS: Record<Tier, string> = {
  essential: 'Correção visual básica com boa qualidade',
  comfort: 'Equilíbrio ideal entre conforto e custo-benefício',
  advanced: 'Tecnologia de ponta para alta performance visual',
  top: 'O melhor disponível em tecnologia e conforto',
};

// Map popular treatment names to friendly labels
const TREATMENT_LABELS: Record<string, { label: string; description: string; icon: string }> = {
  'BLUE': { label: 'Filtro de Luz Azul', description: 'Proteção para uso de telas', icon: 'Eye' },
  'FOTOSSENSIVEL': { label: 'Fotossensível', description: 'Escurece ao sol automaticamente', icon: 'Sun' },
  'POLARIZADA': { label: 'Polarizada', description: 'Reduz ofuscamento e reflexos', icon: 'Contrast' },
  'AR': { label: 'Antirreflexo Premium', description: 'Reduz reflexos e melhora nitidez', icon: 'Sparkles' },
  'AR_PREMIUM': { label: 'Antirreflexo Premium', description: 'Antirreflexo de alta durabilidade', icon: 'Sparkles' },
  'UV': { label: 'Proteção UV', description: 'Bloqueio total de raios UV', icon: 'Shield' },
  'HMC': { label: 'Tratamento HMC', description: 'Multicamadas anti-risco e reflexo', icon: 'Layers' },
  'LONG': { label: 'Long Life', description: 'Maior durabilidade e resistência', icon: 'Clock' },
  'NORISK': { label: 'No Risk', description: 'Garantia estendida', icon: 'Shield' },
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

  // Helper to get index from price (supports both old and new schema)
  const getIndexFromPrice = (price: Price): string => {
    // New schema: availability.index
    const avail = (price as any).availability;
    if (avail?.index) return avail.index;
    // Old schema: direct index field
    if ((price as any).index) return (price as any).index;
    return '1.50'; // fallback
  };

  // Get unique indices available for this family
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

  // Get available treatments from SKUs (upgrades) - infer from addons_detected
  const availableTreatments = useMemo(() => {
    const treatmentMap = new Map<string, { id: string; count: number }>();
    
    allPrices.forEach(p => {
      (p.addons_detected || []).forEach(addon => {
        const existing = treatmentMap.get(addon);
        if (existing) {
          existing.count++;
        } else {
          treatmentMap.set(addon, { id: addon, count: 1 });
        }
      });
    });
    
    // Return treatments sorted by popularity
    return Array.from(treatmentMap.values())
      .sort((a, b) => b.count - a.count)
      .map(t => t.id);
  }, [allPrices]);

  // Handle treatment toggle
  const toggleTreatment = (treatmentId: string) => {
    setSelectedTreatments(prev => 
      prev.includes(treatmentId)
        ? prev.filter(t => t !== treatmentId)
        : [...prev, treatmentId]
    );
  };

  // Get attribute value from family.attributes_base (may be empty)
  const getAttributeValue = (attrId: string): number => {
    const base = family.attributes_base?.[attrId];
    return typeof base === 'number' ? base : 0;
  };

  // Infer key features from SKUs when attributes_base is empty
  const inferredFeatures = useMemo(() => {
    const features: Array<{ id: string; name: string; value: number; description: string }> = [];
    
    // Check if family has real attribute data
    const hasRealAttributes = Object.keys(family.attributes_base || {}).some(
      k => typeof family.attributes_base[k] === 'number' && family.attributes_base[k] > 0
    );
    
    if (!hasRealAttributes) {
      // Infer from tier
      const tierScores: Record<Tier, number> = {
        essential: 1,
        comfort: 2,
        advanced: 3,
        top: 4,
      };
      const baseScore = tierScores[tier] || 2;
      
      features.push({
        id: 'confort',
        name: 'Conforto Visual',
        value: baseScore,
        description: tier === 'top' ? 'Máximo conforto' : tier === 'advanced' ? 'Alto conforto' : tier === 'comfort' ? 'Bom conforto' : 'Conforto básico',
      });
      
      features.push({
        id: 'adaptation',
        name: 'Facilidade de Adaptação',
        value: Math.max(1, baseScore - 1) + 1,
        description: tier === 'top' || tier === 'advanced' ? 'Adaptação rápida' : 'Adaptação normal',
      });
      
      // Infer from available treatments
      if (availableTreatments.includes('BLUE')) {
        features.push({
          id: 'digital',
          name: 'Proteção Digital',
          value: 3,
          description: 'Filtro de luz azul disponível',
        });
      }
      
      if (availableTreatments.includes('FOTOSSENSIVEL')) {
        features.push({
          id: 'versatility',
          name: 'Versatilidade',
          value: 4,
          description: 'Adapta-se à luminosidade',
        });
      }
    }
    
    return features;
  }, [family.attributes_base, tier, availableTreatments]);

  // Get relevant attributes (from attributeDefs) + inferred
  const relevantAttributes = useMemo(() => {
    // First try to get from attributeDefs
    if (attributeDefs.length > 0) {
      const prefix = family.category === 'PROGRESSIVA' ? 'PROG_' : 'MONO_';
      const fromDefs = attributeDefs.filter(a => 
        a.id.startsWith(prefix) || ['AR_QUALIDADE', 'BLUE', 'DURABILIDADE'].includes(a.id)
      );
      
      // Check if family has these attributes populated
      const populated = fromDefs.filter(a => {
        const val = getAttributeValue(a.id);
        return val > 0;
      });
      
      if (populated.length >= 2) {
        return populated.slice(0, 4);
      }
    }
    
    // Use inferred features as fallback
    return [];
  }, [attributeDefs, family.category, family.attributes_base]);

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

        {/* Technologies Section - from family.technology_refs */}
        {(() => {
          const techs = getTechnologiesForFamily(family as any);
          if (techs.length === 0) return null;
          return (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Tecnologias
              </h4>
              <div className="space-y-1.5">
                {techs.slice(0, 3).map(tech => (
                  <TooltipProvider key={tech.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-start gap-2 text-xs bg-primary/5 rounded p-1.5 cursor-help">
                          <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                          <span className="font-medium text-foreground truncate">
                            {tech.name_common}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px]">
                        <p className="text-xs">{tech.description_short || tech.description_long || 'Tecnologia exclusiva'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
                {techs.length > 3 && (
                  <div className="text-[10px] text-muted-foreground text-center">
                    +{techs.length - 3} tecnologia(s)
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Tier Description */}
        <div className="bg-muted/30 rounded-lg p-2.5">
          <p className="text-xs text-muted-foreground italic">
            {TIER_DESCRIPTIONS[tier]}
          </p>
        </div>

        {/* Attributes - from attributeDefs or inferred */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1">
            Características
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Avaliação de 1 a 5 estrelas</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h4>
          <div className="space-y-1.5">
            {/* Show real attributes if available */}
            {relevantAttributes.length > 0 ? (
              relevantAttributes.slice(0, 4).map(attr => {
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
              })
            ) : (
              /* Show inferred features when no real attributes */
              inferredFeatures.slice(0, 4).map(feature => (
                <TooltipProvider key={feature.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between gap-2 cursor-help">
                        <span className="text-xs text-muted-foreground truncate flex-1">
                          {feature.name}
                        </span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(i => (
                            <Star 
                              key={i}
                              className={`w-3 h-3 ${
                                i <= feature.value 
                                  ? `${config.colorClass} fill-current`
                                  : 'text-muted'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{feature.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))
            )}
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

        {/* Treatment Selection (Upgrades) - inferred from SKUs */}
        {availableTreatments.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1">
              <ArrowUpCircle className="w-3 h-3" />
              Upgrades Disponíveis
            </h4>
            <div className="space-y-2">
              {availableTreatments.slice(0, 5).map(treatmentId => {
                // Use friendly labels or fall back to addon resolver
                const friendlyInfo = TREATMENT_LABELS[treatmentId];
                const addonInfo = getAddonInfo(treatmentId);
                const displayName = friendlyInfo?.label || addonInfo.name || treatmentId;
                const displayDesc = friendlyInfo?.description || addonInfo.description;
                const isActive = selectedTreatments.includes(treatmentId);
                
                return (
                  <label 
                    key={treatmentId}
                    className={`flex items-start gap-2 cursor-pointer group p-2 rounded-lg border transition-all ${
                      isActive 
                        ? 'border-primary bg-primary/10' 
                        : 'border-transparent hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox 
                      checked={isActive}
                      onCheckedChange={() => toggleTreatment(treatmentId)}
                      className="mt-0.5 data-[state=checked]:bg-primary"
                    />
                    <div className="flex-1">
                      <span className={`text-xs font-medium transition-colors ${
                        isActive ? 'text-primary' : 'text-foreground group-hover:text-primary'
                      }`}>
                        {displayName}
                      </span>
                      {displayDesc && (
                        <p className="text-[10px] text-muted-foreground">{displayDesc}</p>
                      )}
                    </div>
                  </label>
                );
              })}
              {availableTreatments.length > 5 && (
                <div className="text-[10px] text-muted-foreground text-center">
                  +{availableTreatments.length - 5} upgrade(s) disponível(is)
                </div>
              )}
            </div>
          </div>
        )}

        {/* Benefits - from JSON attributes_display_base */}
        <div className="space-y-1.5 border-t pt-3">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Inclusos
          </h4>
          {(family.attributes_display_base ?? []).slice(0, 3).map((attr, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <Check className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{attr}</span>
            </div>
          ))}
          {(family.attributes_display_base?.length ?? 0) > 3 && (
            <div className="text-xs text-muted-foreground pl-5">
              +{(family.attributes_display_base?.length ?? 0) - 3} benefícios
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
