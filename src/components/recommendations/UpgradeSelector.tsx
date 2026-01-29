/**
 * UpgradeSelector - Clear treatment/upgrade selection with pricing impact
 * Makes it obvious what treatments are available and their cost
 */

import { useState, useMemo } from 'react';
import { 
  Check, 
  Plus,
  Minus,
  Eye,
  Sun,
  Shield,
  Sparkles,
  Layers,
  Contrast,
  Clock,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Price } from '@/types/lens';

interface TreatmentInfo {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  category: 'protection' | 'comfort' | 'lifestyle' | 'durability';
  priceImpact: number | null; // null = included, number = additional cost
}

interface UpgradeSelectorProps {
  availableTreatments: string[];
  selectedTreatments: string[];
  onToggleTreatment: (treatmentId: string) => void;
  allPrices: Price[];
  currentIndex: string;
  basePrice: number;
  compact?: boolean;
}

// Icon mapping for treatments
const TREATMENT_ICONS: Record<string, React.ElementType> = {
  'BLUE': Eye,
  'FOTOSSENSIVEL': Sun,
  'FOTO': Sun,
  'TRANSITIONS': Sun,
  'SENSITY': Sun,
  'PHOTOFUSION': Sun,
  'POLARIZADO': Contrast,
  'AR': Sparkles,
  'AR_PREMIUM': Sparkles,
  'UV': Shield,
  'HMC': Layers,
  'LONG': Clock,
  'NORISK': Shield,
};

// Treatment info database
const TREATMENT_DATABASE: Record<string, Omit<TreatmentInfo, 'id' | 'priceImpact'>> = {
  'BLUE': {
    label: 'Filtro de Luz Azul',
    description: 'Proteção contra luz de telas e dispositivos digitais. Reduz fadiga ocular.',
    icon: Eye,
    category: 'protection',
  },
  'FOTOSSENSIVEL': {
    label: 'Fotossensível',
    description: 'Lente que escurece automaticamente quando exposta ao sol. Dispensa óculos solar.',
    icon: Sun,
    category: 'lifestyle',
  },
  'TRANSITIONS': {
    label: 'Transitions',
    description: 'Lente fotossensível premium. Escurece ao sol e clareia em ambientes internos.',
    icon: Sun,
    category: 'lifestyle',
  },
  'SENSITY': {
    label: 'Sensity (Fotossensível)',
    description: 'Tecnologia fotossensível HOYA. Adaptação rápida às mudanças de luminosidade.',
    icon: Sun,
    category: 'lifestyle',
  },
  'PHOTOFUSION': {
    label: 'PhotoFusion',
    description: 'Tecnologia fotossensível ZEISS. Escurece e clareia com rapidez.',
    icon: Sun,
    category: 'lifestyle',
  },
  'POLARIZADO': {
    label: 'Polarizado',
    description: 'Elimina reflexos de superfícies como água e asfalto. Ideal para dirigir.',
    icon: Contrast,
    category: 'lifestyle',
  },
  'AR': {
    label: 'Antirreflexo',
    description: 'Reduz reflexos na lente, melhorando nitidez e estética.',
    icon: Sparkles,
    category: 'comfort',
  },
  'AR_PREMIUM': {
    label: 'Antirreflexo Premium',
    description: 'Antirreflexo de alta durabilidade com camadas extras de proteção.',
    icon: Sparkles,
    category: 'comfort',
  },
  'UV': {
    label: 'Proteção UV',
    description: 'Bloqueio total de raios ultravioleta. Proteção invisível para seus olhos.',
    icon: Shield,
    category: 'protection',
  },
  'HMC': {
    label: 'Multicamadas (HMC)',
    description: 'Tratamento com múltiplas camadas: anti-risco, anti-reflexo e hidrofóbico.',
    icon: Layers,
    category: 'durability',
  },
  'LONG': {
    label: 'Long Life',
    description: 'Camada extra de resistência para maior durabilidade da lente.',
    icon: Clock,
    category: 'durability',
  },
  'NORISK': {
    label: 'Garantia Estendida',
    description: 'Proteção adicional contra quebra e riscos acidentais.',
    icon: Shield,
    category: 'durability',
  },
};

// Category labels and order
const CATEGORY_CONFIG: Record<string, { label: string; order: number }> = {
  'protection': { label: 'Proteção', order: 1 },
  'comfort': { label: 'Conforto', order: 2 },
  'lifestyle': { label: 'Estilo de Vida', order: 3 },
  'durability': { label: 'Durabilidade', order: 4 },
};

// Helper to get index from price
const getIndexFromPrice = (price: Price): string => {
  const avail = (price as any).availability;
  if (avail?.index) return avail.index;
  if ((price as any).index) return (price as any).index;
  return '1.50';
};

export const UpgradeSelector = ({
  availableTreatments,
  selectedTreatments,
  onToggleTreatment,
  allPrices,
  currentIndex,
  basePrice,
  compact = false,
}: UpgradeSelectorProps) => {
  const [isExpanded, setIsExpanded] = useState(!compact);

  // Calculate price impacts for each treatment
  const treatmentsWithPricing = useMemo(() => {
    const pricesForIndex = allPrices.filter(p => getIndexFromPrice(p) === currentIndex);
    
    // Find base price (no addons or minimum addons)
    const basePrices = pricesForIndex.filter(p => 
      !p.addons_detected || p.addons_detected.length === 0
    );
    const baseUnitPrice = basePrices.length > 0
      ? Math.min(...basePrices.map(p => p.price_sale_half_pair))
      : basePrice / 2;

    return availableTreatments.map(treatmentId => {
      const info = TREATMENT_DATABASE[treatmentId] || {
        label: treatmentId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: 'Tratamento adicional disponível para esta lente.',
        icon: Plus,
        category: 'comfort' as const,
      };

      // Find price with this treatment
      const withTreatment = pricesForIndex.filter(p => 
        p.addons_detected?.includes(treatmentId)
      );
      
      let priceImpact: number | null = null;
      if (withTreatment.length > 0) {
        const minWithTreatment = Math.min(...withTreatment.map(p => p.price_sale_half_pair));
        const diff = (minWithTreatment - baseUnitPrice) * 2; // pair price
        priceImpact = diff > 10 ? diff : null; // Only show if significant
      }

      return {
        id: treatmentId,
        ...info,
        priceImpact,
      } as TreatmentInfo;
    });
  }, [availableTreatments, allPrices, currentIndex, basePrice]);

  // Group by category
  const groupedTreatments = useMemo(() => {
    const groups: Record<string, TreatmentInfo[]> = {};
    
    treatmentsWithPricing.forEach(treatment => {
      if (!groups[treatment.category]) {
        groups[treatment.category] = [];
      }
      groups[treatment.category].push(treatment);
    });

    // Sort by category order
    return Object.entries(groups)
      .sort(([a], [b]) => 
        (CATEGORY_CONFIG[a]?.order || 99) - (CATEGORY_CONFIG[b]?.order || 99)
      );
  }, [treatmentsWithPricing]);

  const selectedCount = selectedTreatments.length;
  const additionalCost = useMemo(() => {
    return treatmentsWithPricing
      .filter(t => selectedTreatments.includes(t.id) && t.priceImpact)
      .reduce((sum, t) => sum + (t.priceImpact || 0), 0);
  }, [treatmentsWithPricing, selectedTreatments]);

  if (availableTreatments.length === 0) {
    return (
      <div className="p-3 bg-muted/30 rounded-lg text-center">
        <p className="text-xs text-muted-foreground">
          Esta lente já inclui todos os tratamentos padrão.
        </p>
      </div>
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-between p-3 h-auto hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Upgrades Disponíveis</span>
            {selectedCount > 0 && (
              <Badge variant="default" className="text-xs">
                {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {additionalCost > 0 && (
              <span className="text-xs text-primary font-medium">
                +R$ {additionalCost.toLocaleString('pt-BR')}
              </span>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="px-3 pb-3">
        <div className="space-y-4 pt-2">
          {groupedTreatments.map(([category, treatments]) => (
            <div key={category} className="space-y-2">
              <h5 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                {CATEGORY_CONFIG[category]?.label || category}
              </h5>
              <div className="space-y-1.5">
                {treatments.map(treatment => {
                  const Icon = treatment.icon;
                  const isSelected = selectedTreatments.includes(treatment.id);

                  return (
                    <TooltipProvider key={treatment.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <label 
                            className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                              isSelected
                                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                : 'border-border hover:border-primary/50 hover:bg-muted/30'
                            }`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => onToggleTreatment(treatment.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 shrink-0 ${
                                  isSelected ? 'text-primary' : 'text-muted-foreground'
                                }`} />
                                <span className={`text-sm font-medium ${
                                  isSelected ? 'text-primary' : 'text-foreground'
                                }`}>
                                  {treatment.label}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                {treatment.description}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              {treatment.priceImpact !== null ? (
                                <span className={`text-xs font-semibold ${
                                  isSelected ? 'text-primary' : 'text-muted-foreground'
                                }`}>
                                  +R$ {treatment.priceImpact.toLocaleString('pt-BR')}
                                </span>
                              ) : (
                                <Badge variant="outline" className="text-[10px] py-0">
                                  Incluso
                                </Badge>
                              )}
                            </div>
                          </label>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[280px]">
                          <div className="space-y-1">
                            <p className="font-medium">{treatment.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {treatment.description}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        {selectedCount > 0 && (
          <div className="mt-4 pt-3 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {selectedCount} upgrade{selectedCount > 1 ? 's' : ''} selecionado{selectedCount > 1 ? 's' : ''}
              </span>
              {additionalCost > 0 && (
                <span className="font-semibold text-primary">
                  +R$ {additionalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
