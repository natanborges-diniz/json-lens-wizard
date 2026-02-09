/**
 * SkuListPanel - Lists all compatible SKUs for a family
 * Shows index, treatments, price, and ERP code for each SKU.
 * Allows selecting a specific SKU configuration.
 */

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { resolveSkuCode } from '@/lib/skuCodeResolver';
import type { Price } from '@/types/lens';

interface SkuListPanelProps {
  allPrices: Price[];
  selectedPriceId?: string;
  onSelectSku: (price: Price) => void;
  maxVisible?: number;
}

// Helper to get index from price
const getIndex = (price: Price): string => {
  const avail = (price as any).availability;
  if (avail?.index) return String(avail.index);
  if ((price as any).index_value) return String((price as any).index_value);
  return '1.50';
};

// Helper to format addon labels
const formatAddon = (addon: string): string => {
  const ADDON_LABELS: Record<string, string> = {
    'ADDON_BLUE': 'Filtro Azul',
    'ADDON_FOTO': 'Fotossensível',
    'ADDON_FOTOSSENSIVEL': 'Fotossensível',
    'ADDON_TRANSITIONS': 'Transitions',
    'ADDON_SENSITY': 'Sensity',
    'ADDON_PHOTOFUSION': 'PhotoFusion',
    'ADDON_POLARIZADO': 'Polarizado',
    'ADDON_AR': 'Antirreflexo',
    'ADDON_AR_PREMIUM': 'AR Premium',
    'ADDON_UV': 'Proteção UV',
    'ADDON_HMC': 'Multicamadas',
    'BLUE': 'Filtro Azul',
    'FOTO': 'Fotossensível',
    'FOTOSSENSIVEL': 'Fotossensível',
    'TRANSITIONS': 'Transitions',
    'SENSITY': 'Sensity',
    'PHOTOFUSION': 'PhotoFusion',
    'POLARIZADO': 'Polarizado',
    'AR': 'Antirreflexo',
    'AR_PREMIUM': 'AR Premium',
    'UV': 'Proteção UV',
    'HMC': 'Multicamadas',
  };
  return ADDON_LABELS[addon] || addon.replace(/^ADDON_/, '').replace(/_/g, ' ');
};

export const SkuListPanel = ({
  allPrices,
  selectedPriceId,
  onSelectSku,
  maxVisible = 3,
}: SkuListPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Sort by price ascending, group info
  const sortedSkus = useMemo(() => {
    return [...allPrices]
      .filter(p => p.active && !p.blocked)
      .sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)
      .map(price => ({
        price,
        index: getIndex(price),
        addons: (price.addons_detected || []),
        pairPrice: price.price_sale_half_pair * 2,
        erpCode: resolveSkuCode(price),
        description: (price as any).display_description || (price as any).description || '',
      }));
  }, [allPrices]);

  if (sortedSkus.length === 0) {
    return (
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2 text-center">
        Sem SKUs disponíveis para esta receita
      </div>
    );
  }

  const visibleSkus = isExpanded ? sortedSkus : sortedSkus.slice(0, maxVisible);
  const hasMore = sortedSkus.length > maxVisible;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide flex items-center gap-1">
          <Package className="w-3 h-3" />
          Configurações ({sortedSkus.length})
        </span>
      </div>

      <div className="space-y-1">
        {visibleSkus.map((sku, idx) => {
          const isSelected = selectedPriceId === (sku.price as any).id || 
            (selectedPriceId && sku.erpCode && selectedPriceId === sku.erpCode);

          return (
            <button
              key={idx}
              onClick={() => onSelectSku(sku.price)}
              className={`
                w-full text-left px-2.5 py-2 rounded-lg border text-xs transition-all
                ${isSelected
                  ? 'bg-primary/10 border-primary ring-1 ring-primary'
                  : 'bg-background border-border hover:border-primary/50 hover:bg-muted/30'
                }
              `}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {/* Index + Addons line */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono shrink-0">
                      {sku.index}
                    </Badge>
                    {sku.addons.length > 0 ? (
                      sku.addons.map((addon, i) => (
                        <span key={i} className="text-[10px] text-muted-foreground">
                          {i > 0 && '•'} {formatAddon(addon)}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Base (sem tratamento)</span>
                    )}
                  </div>
                  {/* ERP code */}
                  {sku.erpCode && (
                    <span className="text-[9px] text-muted-foreground/60 font-mono block mt-0.5">
                      ERP: {sku.erpCode}
                    </span>
                  )}
                </div>

                {/* Price + Check */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    R$ {sku.pairPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Expand/Collapse */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-center text-[10px] text-primary hover:underline flex items-center justify-center gap-1 py-1"
        >
          {isExpanded ? (
            <>Mostrar menos <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>+{sortedSkus.length - maxVisible} configurações <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}
    </div>
  );
};
