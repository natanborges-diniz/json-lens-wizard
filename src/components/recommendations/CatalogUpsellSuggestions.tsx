/**
 * CatalogUpsellSuggestions - Upsell baseado no catálogo
 * 
 * v3.6.2.3: Shows upsells ONLY from family.options.addons_available
 * Uses catalog.addons[] for labels/icons
 * Uses price.addons_detected for availability check and delta calculation
 * NO inference from description/regex
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
import type { Addon, Price, ClinicalType, FamilyExtended } from '@/types/lens';
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
    const familyExt = family as unknown as FamilyExtended;
    const allowedAddons = familyExt.options?.addons_available;
    
    // v3.6.2.3: ONLY show addons from family.options.addons_available
    if (!allowedAddons || allowedAddons.length === 0) return [];
    
    // For each allowed addon, check if real SKUs exist with that addon
    allowedAddons.forEach(addonId => {
      // Check if any SKU in this family has this addon detected
      const skusWithAddon = allPrices.filter(p => 
        (p.addons_detected || []).includes(addonId)
      );
      if (skusWithAddon.length === 0) return; // No real SKU backs it
      
      // Calculate price impact from current price
      let priceImpact: number | undefined;
      if (currentPrice) {
        const minWithAddon = Math.min(...skusWithAddon.map(p => p.price_sale_half_pair));
        const delta = (minWithAddon - currentPrice.price_sale_half_pair) * 2;
        if (delta > 0) priceImpact = delta;
      }
      
      // Get label from ADDON_SHORT_LABELS or humanize
      const ADDON_LABELS: Record<string, { label: string; icon: React.ElementType; desc: string }> = {
        'ADDON_BLUE': { label: 'Filtro de Luz Azul', icon: Eye, desc: 'Protege contra luz azul de telas' },
        'ADDON_BLUE_UV': { label: 'Filtro Azul UV', icon: Eye, desc: 'Proteção azul + UV completa' },
        'ADDON_AR': { label: 'Antirreflexo', icon: Sparkles, desc: 'Visão mais clara e menos reflexos' },
        'ADDON_AR_PREMIUM': { label: 'AR Premium', icon: Sparkles, desc: 'Antirreflexo de alta performance' },
        'ADDON_PHOTO': { label: 'Fotossensível', icon: Sun, desc: 'Escurece automaticamente ao sol' },
        'ADDON_PHOTO_GRAY': { label: 'Foto Cinza', icon: Sun, desc: 'Fotossensível tom cinza' },
        'ADDON_PHOTO_BROWN': { label: 'Foto Marrom', icon: Sun, desc: 'Fotossensível tom marrom' },
        'ADDON_TRANSITIONS': { label: 'Transitions', icon: Sun, desc: 'Tecnologia Transitions adaptável' },
        'ADDON_POLAR': { label: 'Polarizada', icon: Shield, desc: 'Elimina reflexos intensos' },
        'ADDON_MIRROR': { label: 'Espelhada', icon: Shield, desc: 'Lente com acabamento espelhado' },
        'ADDON_DLC': { label: 'DLC', icon: Sparkles, desc: 'Tratamento Diamond-Like Carbon' },
        'ADDON_HIDRO': { label: 'Hidrofóbico', icon: Sparkles, desc: 'Repele água e oleosidade' },
      };
      
      const info = ADDON_LABELS[addonId];
      
      upsells.push({
        id: addonId,
        type: 'treatment',
        name: info?.label || addonId.replace(/^ADDON_/, '').replace(/_/g, ' '),
        description: info?.desc || 'Upgrade disponível para esta família',
        icon: info?.icon || Plus,
        priceImpact,
        isAvailable: true,
        isIncluded: selectedTreatments.includes(addonId),
      });
    });
    
    // Filter out already included and sort
    return upsells
      .filter(u => !u.isIncluded)
      .sort((a, b) => {
        if (a.priceImpact && b.priceImpact) return a.priceImpact - b.priceImpact;
        return 0;
      });
  }, [family, allPrices, currentPrice, selectedTreatments]);

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
