/**
 * AlternativesList - Clear display of alternative families in the same tier
 * Explains WHY alternatives exist (different suppliers, features, price points)
 */

import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  ArrowRight, 
  Building2, 
  DollarSign,
  Star,
  Check
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { Family, Price, Tier } from '@/types/lens';

interface AlternativeFamily {
  family: Family;
  bestPrice: Price | null;
  allPrices?: Price[];
}

interface AlternativesListProps {
  alternatives: AlternativeFamily[];
  currentSupplier: string;
  tier: Tier;
  onSelectAlternative?: (family: Family, allPrices: Price[]) => void;
}

// Why alternatives exist - explanation by tier
const TIER_ALTERNATIVES_REASON: Record<Tier, string> = {
  essential: 'Outras opções de entrada com preços similares',
  comfort: 'Fabricantes diferentes com tecnologias equivalentes',
  advanced: 'Alternativas premium de outros laboratórios',
  top: 'Outras referências de mercado no mesmo nível',
};

export const AlternativesList = ({
  alternatives,
  currentSupplier,
  tier,
  onSelectAlternative,
}: AlternativesListProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (alternatives.length === 0) {
    return null;
  }

  // Group alternatives by reason
  const groupedAlternatives = {
    differentSupplier: alternatives.filter(a => a.family.supplier !== currentSupplier),
    sameSupplier: alternatives.filter(a => a.family.supplier === currentSupplier),
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-between p-2 h-auto text-sm hover:bg-muted/50"
        >
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {alternatives.length} alternativa{alternatives.length > 1 ? 's' : ''} 
              <span className="hidden sm:inline"> nesta faixa</span>
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-3 pt-2 pb-1">
          {/* Explanation */}
          <p className="text-xs text-muted-foreground px-1 italic">
            {TIER_ALTERNATIVES_REASON[tier]}
          </p>

          {/* Different suppliers section */}
          {groupedAlternatives.differentSupplier.length > 0 && (
            <div className="space-y-2">
              {groupedAlternatives.differentSupplier.length > 1 && (
                <div className="flex items-center gap-1.5 px-1">
                  <Building2 className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Outros fabricantes
                  </span>
                </div>
              )}
              
              <div className="space-y-1.5">
                {groupedAlternatives.differentSupplier.map(alt => (
                  <AlternativeItem
                    key={alt.family.id}
                    alternative={alt}
                    reason="supplier"
                    onSelect={onSelectAlternative}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Same supplier section */}
          {groupedAlternatives.sameSupplier.length > 0 && (
            <div className="space-y-2">
              {groupedAlternatives.sameSupplier.length > 0 && groupedAlternatives.differentSupplier.length > 0 && (
                <div className="flex items-center gap-1.5 px-1">
                  <Star className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Mesmo fabricante ({currentSupplier})
                  </span>
                </div>
              )}
              
              <div className="space-y-1.5">
                {groupedAlternatives.sameSupplier.map(alt => (
                  <AlternativeItem
                    key={alt.family.id}
                    alternative={alt}
                    reason="variant"
                    onSelect={onSelectAlternative}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

// Individual alternative item
interface AlternativeItemProps {
  alternative: AlternativeFamily;
  reason: 'supplier' | 'variant' | 'price';
  onSelect?: (family: Family, allPrices: Price[]) => void;
}

const AlternativeItem = ({ alternative, reason, onSelect }: AlternativeItemProps) => {
  const { family, bestPrice, allPrices = [] } = alternative;
  const pairPrice = bestPrice ? bestPrice.price_sale_half_pair * 2 : null;

  const handleClick = () => {
    if (onSelect && allPrices.length > 0) {
      onSelect(family, allPrices);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!onSelect || allPrices.length === 0}
      className="w-full p-2.5 bg-muted/30 rounded-lg flex items-center justify-between hover:bg-primary/5 hover:border-primary border border-transparent transition-all group text-left disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium group-hover:text-primary transition-colors truncate">
            {family.name_original}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
            {family.supplier}
          </Badge>
          {reason === 'supplier' && (
            <span className="text-[10px] text-muted-foreground">
              Alternativa de fabricante
            </span>
          )}
          {reason === 'variant' && (
            <span className="text-[10px] text-muted-foreground">
              Outra linha do mesmo fabricante
            </span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        {pairPrice !== null ? (
          <div className="text-right">
            <div className="text-sm font-bold text-foreground group-hover:text-primary">
              R$ {pairPrice.toLocaleString('pt-BR')}
            </div>
            <div className="text-[10px] text-muted-foreground">par</div>
          </div>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            Consultar
          </Badge>
        )}
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
    </button>
  );
};

// Quick comparison strip (for header)
export const AlternativesQuickInfo = ({ 
  count, 
  lowestPrice, 
  highestPrice 
}: { 
  count: number; 
  lowestPrice?: number; 
  highestPrice?: number;
}) => {
  if (count === 0) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>
        +{count} alternativa{count > 1 ? 's' : ''}
      </span>
      {lowestPrice !== undefined && highestPrice !== undefined && lowestPrice !== highestPrice && (
        <>
          <span className="text-muted">•</span>
          <span>
            R$ {lowestPrice.toLocaleString('pt-BR')} - R$ {highestPrice.toLocaleString('pt-BR')}
          </span>
        </>
      )}
    </div>
  );
};
