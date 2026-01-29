/**
 * CatalogUpsellSuggestions - Upsell baseado no catálogo
 * 
 * Mostra "Você pode adicionar..." baseado em:
 * - addons disponíveis no catálogo
 * - technology_refs da família
 * - compatibility rules
 * 
 * O frontend apenas exibe, não decide.
 */

import { useMemo } from 'react';
import { 
  Plus, 
  Shield, 
  Sun, 
  Eye,
  Sparkles,
  Info,
  Check
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Addon, Price, ClinicalType } from '@/types/lens';
import type { EnrichedFamily } from '@/lib/catalogEnricher';

// Category icons for addons
const ADDON_CATEGORY_ICONS: Record<string, React.ElementType> = {
  'protection': Shield,
  'lifestyle': Sun,
  'digital': Eye,
  'coating': Sparkles,
  'default': Plus,
};

// Group addons by type for display
const ADDON_GROUPS: Record<string, {
  label: string;
  icon: React.ElementType;
  description: string;
}> = {
  'BLUE': {
    label: 'Filtro de Luz Azul',
    icon: Eye,
    description: 'Protege contra luz azul de telas',
  },
  'FOTO': {
    label: 'Fotossensível',
    icon: Sun,
    description: 'Escurece automaticamente ao sol',
  },
  'AR': {
    label: 'Antirreflexo Premium',
    icon: Sparkles,
    description: 'Visão mais clara e menos reflexos',
  },
  'POLARIZADO': {
    label: 'Polarizado',
    icon: Shield,
    description: 'Elimina reflexos intensos',
  },
};

interface AvailableUpsell {
  id: string;
  type: 'addon' | 'technology' | 'treatment';
  name: string;
  description: string;
  icon: React.ElementType;
  priceImpact?: number;
  isAvailable: boolean;
  isIncluded: boolean;
}

interface CatalogUpsellSuggestionsProps {
  family: EnrichedFamily;
  allPrices: Price[];
  currentPrice?: Price;
  addons: Addon[];
  lensCategory: ClinicalType;
  selectedTreatments: string[];
  onSelectUpsell?: (upsellId: string) => void;
  compact?: boolean;
}

export const CatalogUpsellSuggestions = ({
  family,
  allPrices,
  currentPrice,
  addons,
  lensCategory,
  selectedTreatments,
  onSelectUpsell,
  compact = false,
}: CatalogUpsellSuggestionsProps) => {
  // Find available upsells from catalog data
  const availableUpsells = useMemo((): AvailableUpsell[] => {
    const upsells: AvailableUpsell[] = [];
    
    // 1. From addons in catalog (filtered by category compatibility)
    const compatibleAddons = addons.filter(addon => {
      if (!addon.active) return false;
      if (!addon.rules.categories.includes(lensCategory)) return false;
      // Check if family supports this addon
      if (addon.rules.only_if) {
        // Check if family has required technology
        const hasTech = family.technology_refs?.includes(addon.rules.only_if);
        if (!hasTech) return false;
      }
      return true;
    });
    
    compatibleAddons.forEach(addon => {
      upsells.push({
        id: addon.id,
        type: 'addon',
        name: addon.name_common,
        description: addon.description_client,
        icon: ADDON_CATEGORY_ICONS[addon.id.toUpperCase()] || ADDON_CATEGORY_ICONS.default,
        isAvailable: true,
        isIncluded: selectedTreatments.includes(addon.id),
      });
    });
    
    // 2. From detected treatments in SKUs (that are not yet selected)
    const allTreatments = new Set<string>();
    allPrices.forEach(p => {
      (p.addons_detected || []).forEach(t => allTreatments.add(t));
    });
    
    allTreatments.forEach(treatmentId => {
      // Skip if already added from addons
      if (upsells.some(u => u.id === treatmentId)) return;
      
      // Check if group exists
      const group = Object.entries(ADDON_GROUPS).find(([key]) => 
        treatmentId.toUpperCase().includes(key)
      );
      
      if (group) {
        const [key, config] = group;
        
        // Calculate price impact
        let priceImpact: number | undefined;
        if (currentPrice) {
          const withTreatment = allPrices.filter(p => 
            (p.addons_detected || []).includes(treatmentId)
          );
          if (withTreatment.length > 0) {
            const minWithTreatment = Math.min(...withTreatment.map(p => p.price_sale_half_pair));
            priceImpact = (minWithTreatment - currentPrice.price_sale_half_pair) * 2;
          }
        }
        
        upsells.push({
          id: treatmentId,
          type: 'treatment',
          name: config.label,
          description: config.description,
          icon: config.icon,
          priceImpact: priceImpact && priceImpact > 0 ? priceImpact : undefined,
          isAvailable: true,
          isIncluded: selectedTreatments.includes(treatmentId),
        });
      }
    });
    
    // 3. From family's technology_refs (technologies that could enhance the lens)
    if (family.technology_refs) {
      family.technology_refs.forEach(techRef => {
        // Skip if already in upsells
        if (upsells.some(u => u.id === techRef)) return;
        
        // Only add if it's a treatment/enhancement technology
        if (techRef.includes('BLUE') || techRef.includes('PHOTO') || techRef.includes('AR')) {
          upsells.push({
            id: techRef,
            type: 'technology',
            name: techRef.replace(/_/g, ' '),
            description: 'Tecnologia disponível para esta família',
            icon: Sparkles,
            isAvailable: true,
            isIncluded: false,
          });
        }
      });
    }
    
    // Filter out already included and sort by available first
    return upsells
      .filter(u => !u.isIncluded)
      .sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
        if (a.priceImpact && b.priceImpact) return a.priceImpact - b.priceImpact;
        return 0;
      });
  }, [family, allPrices, currentPrice, addons, lensCategory, selectedTreatments]);

  if (availableUpsells.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Plus className="w-3 h-3" />
          Você pode adicionar:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {availableUpsells.slice(0, 4).map(upsell => {
            const Icon = upsell.icon;
            
            return (
              <TooltipProvider key={upsell.id}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-[10px] gap-1 cursor-pointer hover:bg-primary/10"
                      onClick={() => onSelectUpsell?.(upsell.id)}
                    >
                      <Icon className="w-3 h-3" />
                      {upsell.name}
                      {upsell.priceImpact && (
                        <span className="text-success">
                          +R$ {upsell.priceImpact.toLocaleString('pt-BR')}
                        </span>
                      )}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{upsell.description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
          {availableUpsells.length > 4 && (
            <Badge variant="secondary" className="text-[10px]">
              +{availableUpsells.length - 4}
            </Badge>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="border-dashed border-primary/30 bg-primary/5">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Plus className="w-4 h-4 text-primary" />
          <span>Você pode adicionar</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3.5 h-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-[200px]">
                  Opções compatíveis com sua lente, baseadas no catálogo do fabricante.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="py-2 px-4">
        <div className="space-y-2">
          {availableUpsells.slice(0, 5).map(upsell => {
            const Icon = upsell.icon;
            
            return (
              <button
                key={upsell.id}
                onClick={() => onSelectUpsell?.(upsell.id)}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-background/80 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{upsell.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{upsell.description}</p>
                </div>
                {upsell.priceImpact ? (
                  <Badge variant="outline" className="text-xs shrink-0 text-success border-success/30">
                    +R$ {upsell.priceImpact.toLocaleString('pt-BR')}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    Disponível
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// Simple badge list of what's already included
export const IncludedFeaturesBadges = ({
  family,
  selectedTreatments,
}: {
  family: EnrichedFamily;
  selectedTreatments: string[];
}) => {
  const includedFeatures = useMemo(() => {
    const features: string[] = [];
    
    // From sales_pills
    if (family.sales_pills) {
      features.push(...family.sales_pills.slice(0, 2));
    }
    
    // From selected treatments
    selectedTreatments.forEach(t => {
      const group = Object.entries(ADDON_GROUPS).find(([key]) => 
        t.toUpperCase().includes(key)
      );
      if (group) {
        features.push(group[1].label);
      }
    });
    
    return [...new Set(features)].slice(0, 4);
  }, [family, selectedTreatments]);

  if (includedFeatures.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {includedFeatures.map((feature, idx) => (
        <Badge key={idx} variant="secondary" className="text-[10px] gap-1">
          <Check className="w-2.5 h-2.5" />
          {feature}
        </Badge>
      ))}
    </div>
  );
};
