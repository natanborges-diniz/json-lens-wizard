/**
 * TierComparisonCard - Exibe comparação entre dois tiers adjacentes
 * 
 * Mostra o "delta de valor" ao subir de nível na escada comercial.
 * Usado pelo vendedor para conduzir o upsell com argumentos do catálogo.
 */

import { ArrowUp, Sparkles, TrendingUp, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type { TierComparison } from '@/lib/recommendationEngine/narrativeEngine';
import { useState } from 'react';

interface TierComparisonCardProps {
  comparison: TierComparison;
  onSelectUpper?: () => void;
}

const TIER_LABELS: Record<string, string> = {
  essential: 'Essencial',
  comfort: 'Conforto',
  advanced: 'Avançada',
  top: 'Top',
};

const TIER_COLORS: Record<string, string> = {
  essential: 'bg-slate-100 text-slate-700 border-slate-200',
  comfort: 'bg-blue-100 text-blue-700 border-blue-200',
  advanced: 'bg-purple-100 text-purple-700 border-purple-200',
  top: 'bg-amber-100 text-amber-700 border-amber-200',
};

export const TierComparisonCard = ({ 
  comparison, 
  onSelectUpper 
}: TierComparisonCardProps) => {
  const [showScript, setShowScript] = useState(false);

  const formatPrice = (value: number) => {
    return value.toLocaleString('pt-BR', { 
      style: 'currency', 
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  return (
    <Card className="border-dashed border-2 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge className={TIER_COLORS[comparison.fromTier]}>
              {TIER_LABELS[comparison.fromTier]}
            </Badge>
            <ArrowUp className="w-4 h-4 text-primary rotate-90" />
            <Badge className={TIER_COLORS[comparison.toTier]}>
              {TIER_LABELS[comparison.toTier]}
            </Badge>
          </div>
          
          {comparison.priceDelta !== null && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-primary">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +{formatPrice(comparison.priceDelta)}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Diferença de investimento</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Gains List */}
        <div className="space-y-2 mb-4">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            O que você ganha:
          </h4>
          <ul className="space-y-1.5">
            {comparison.gains.map((gain, index) => (
              <li 
                key={index}
                className="flex items-start gap-2 text-sm"
              >
                <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>{gain}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Consultant Script (Collapsible) */}
        <Collapsible open={showScript} onOpenChange={setShowScript}>
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full justify-start text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              {showScript ? 'Ocultar script' : 'Ver script de venda'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground italic">
              "{comparison.consultantScript}"
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Action Button */}
        {onSelectUpper && (
          <Button 
            onClick={onSelectUpper}
            className="w-full mt-3"
            variant="outline"
          >
            <ArrowUp className="w-4 h-4 mr-2" />
            Subir para {TIER_LABELS[comparison.toTier]}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default TierComparisonCard;
