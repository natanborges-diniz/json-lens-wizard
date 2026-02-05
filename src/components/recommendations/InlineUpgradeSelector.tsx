/**
 * InlineUpgradeSelector - Compact upgrade controls embedded directly in the lens card
 * 
 * Shows available index options and key treatments with real-time price updates.
 * No need to open the drawer for basic upgrades.
 */

import { useMemo } from 'react';
import { Check, Plus, Eye, Sun, Sparkles, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Price } from '@/types/lens';

interface InlineUpgradeSelectorProps {
  allPrices: Price[];
  selectedIndex: string;
  selectedTreatments: string[];
  onIndexChange: (index: string) => void;
  onTreatmentToggle: (treatmentId: string) => void;
}

// Get index from price (V3.6.x compatible)
const getIndexFromPrice = (price: Price): string => {
  const avail = (price as any).availability;
  if (avail?.index) return avail.index;
  if ((price as any).index) return (price as any).index;
  return '1.50';
};

const INDEX_SHORT_LABELS: Record<string, string> = {
  '1.50': 'Padrão',
  '1.56': 'Fino',
  '1.59': 'Extra fino',
  '1.60': 'Extra fino',
  '1.67': 'Ultra fino',
  '1.74': 'Super fino',
};

const TREATMENT_CONFIG: Record<string, { label: string; shortLabel: string; icon: React.ElementType }> = {
  'BLUE': { label: 'Filtro Luz Azul', shortLabel: 'Blue', icon: Eye },
  'FOTOSSENSIVEL': { label: 'Fotossensível', shortLabel: 'Foto', icon: Sun },
  'FOTO': { label: 'Fotossensível', shortLabel: 'Foto', icon: Sun },
  'TRANSITIONS': { label: 'Transitions', shortLabel: 'Trans.', icon: Sun },
  'SENSITY': { label: 'Sensity', shortLabel: 'Sensity', icon: Sun },
  'PHOTOFUSION': { label: 'PhotoFusion', shortLabel: 'Photo', icon: Sun },
  'AR': { label: 'Antirreflexo Premium', shortLabel: 'AR', icon: Sparkles },
  'AR_PREMIUM': { label: 'AR Premium', shortLabel: 'AR+', icon: Sparkles },
  'POLARIZADO': { label: 'Polarizado', shortLabel: 'Polar.', icon: Shield },
};

const getTreatmentConfig = (id: string) => {
  for (const [key, config] of Object.entries(TREATMENT_CONFIG)) {
    if (id.toUpperCase().includes(key)) return config;
  }
  return { 
    label: id.replace(/_/g, ' '), 
    shortLabel: id.substring(0, 5), 
    icon: Plus 
  };
};

export const InlineUpgradeSelector = ({
  allPrices,
  selectedIndex,
  selectedTreatments,
  onIndexChange,
  onTreatmentToggle,
}: InlineUpgradeSelectorProps) => {
  // Available indices with min prices
  const indexOptions = useMemo(() => {
    const indexMap = new Map<string, number>();
    allPrices.forEach(price => {
      const idx = getIndexFromPrice(price);
      const existing = indexMap.get(idx);
      if (!existing || price.price_sale_half_pair < existing) {
        indexMap.set(idx, price.price_sale_half_pair);
      }
    });
    return Array.from(indexMap.entries())
      .map(([idx, minHalf]) => ({ index: idx, pairPrice: minHalf * 2 }))
      .sort((a, b) => parseFloat(a.index) - parseFloat(b.index));
  }, [allPrices]);

  // Available treatments for current index with price impact
  const treatmentOptions = useMemo(() => {
    const pricesForIndex = allPrices.filter(p => getIndexFromPrice(p) === selectedIndex);
    if (pricesForIndex.length === 0) return [];

    // Base price (no treatments)
    const basePrices = pricesForIndex.filter(p => !p.addons_detected?.length);
    const baseHalf = basePrices.length > 0
      ? Math.min(...basePrices.map(p => p.price_sale_half_pair))
      : Math.min(...pricesForIndex.map(p => p.price_sale_half_pair));

    // Collect unique treatments
    const treatmentMap = new Map<string, number>();
    pricesForIndex.forEach(price => {
      (price.addons_detected || []).forEach(t => {
        if (!treatmentMap.has(t)) {
          const withT = pricesForIndex.filter(p => p.addons_detected?.includes(t));
          const minWith = Math.min(...withT.map(p => p.price_sale_half_pair));
          treatmentMap.set(t, (minWith - baseHalf) * 2);
        }
      });
    });

    return Array.from(treatmentMap.entries()).map(([id, impact]) => ({
      id,
      ...getTreatmentConfig(id),
      priceImpact: impact,
    }));
  }, [allPrices, selectedIndex]);

  if (indexOptions.length <= 1 && treatmentOptions.length === 0) return null;

  return (
    <div className="space-y-2">
      {/* Index selector - compact chips */}
      {indexOptions.length > 1 && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">
            Índice
          </span>
          <div className="flex flex-wrap gap-1">
            {indexOptions.map(opt => {
              const isActive = opt.index === selectedIndex;
              const basePrice = indexOptions[0]?.pairPrice || 0;
              const diff = opt.pairPrice - basePrice;
              return (
                <TooltipProvider key={opt.index}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onIndexChange(opt.index)}
                        className={`
                          px-2 py-1 rounded-md text-xs font-medium border transition-all
                          ${isActive 
                            ? 'bg-primary text-primary-foreground border-primary' 
                            : 'bg-background border-border hover:border-primary/50 text-foreground'
                          }
                        `}
                      >
                        {opt.index}
                        {isActive && <Check className="w-3 h-3 inline ml-1" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{INDEX_SHORT_LABELS[opt.index] || opt.index}</p>
                      <p className="text-xs">R$ {opt.pairPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      {diff > 0 && <p className="text-xs text-primary">+R$ {diff.toLocaleString('pt-BR')}</p>}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      )}

      {/* Treatment toggles - compact */}
      {treatmentOptions.length > 0 && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">
            Upgrades
          </span>
          <div className="flex flex-wrap gap-1">
            {treatmentOptions.map(t => {
              const Icon = t.icon;
              const isActive = selectedTreatments.includes(t.id);
              return (
                <TooltipProvider key={t.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => onTreatmentToggle(t.id)}
                        className={`
                          flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-all
                          ${isActive 
                            ? 'bg-primary/10 text-primary border-primary font-medium' 
                            : 'bg-background border-border hover:border-primary/50 text-muted-foreground'
                          }
                        `}
                      >
                        <Icon className="w-3 h-3" />
                        {t.shortLabel}
                        {isActive && <Check className="w-3 h-3" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-medium">{t.label}</p>
                      {t.priceImpact > 10 && (
                        <p className="text-xs text-primary">+R$ {t.priceImpact.toLocaleString('pt-BR')}</p>
                      )}
                      {t.priceImpact <= 10 && (
                        <p className="text-xs text-muted-foreground">Incluso nesta configuração</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
