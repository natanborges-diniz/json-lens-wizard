/**
 * TierStaircase - Jornada em escada de tiers
 * 
 * Mostra a progressão entre tiers de forma visual,
 * respondendo: "O que eu ganho se subir um nível?"
 * 
 * Usa: sales_pills, upgrade_paths, knowledge.consumer
 */

import { 
  ArrowUp, 
  Check, 
  ChevronRight,
  Shield,
  ThumbsUp,
  Zap,
  Crown,
  Sparkles
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Tier } from '@/types/lens';
import type { EnrichedFamily } from '@/lib/catalogEnricher';

// Tier configuration
interface TierInfo {
  id: Tier;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  // What you gain at this tier (compared to previous)
  gains: string[];
}

const TIER_INFO: Record<Tier, TierInfo> = {
  essential: {
    id: 'essential',
    label: 'Essencial',
    shortLabel: 'Essencial',
    icon: Shield,
    colorClass: 'text-slate-600',
    bgClass: 'bg-slate-50',
    borderClass: 'border-slate-200',
    gains: [
      'Visão funcional básica',
      'Correção óptica confiável',
      'Custo acessível',
    ],
  },
  comfort: {
    id: 'comfort',
    label: 'Conforto',
    shortLabel: 'Conforto',
    icon: ThumbsUp,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    gains: [
      'Mais conforto no dia a dia',
      'Campos de visão ampliados',
      'Adaptação facilitada',
    ],
  },
  advanced: {
    id: 'advanced',
    label: 'Avançada',
    shortLabel: 'Avançada',
    icon: Zap,
    colorClass: 'text-purple-600',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
    gains: [
      'Adaptação ainda mais rápida',
      'Tecnologia de personalização',
      'Performance em múltiplas atividades',
    ],
  },
  top: {
    id: 'top',
    label: 'Top',
    shortLabel: 'Top',
    icon: Crown,
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
    gains: [
      'Máxima personalização',
      'Campos de visão expandidos',
      'Menor taxa de inadaptação',
    ],
  },
};

const TIER_ORDER: Tier[] = ['essential', 'comfort', 'advanced', 'top'];

interface TierStaircaseProps {
  currentTier: Tier;
  families?: Record<Tier, EnrichedFamily | null>;
  prices?: Record<Tier, number | null>;
  onSelectTier?: (tier: Tier) => void;
  compact?: boolean;
}

export const TierStaircase = ({
  currentTier,
  families,
  prices,
  onSelectTier,
  compact = false,
}: TierStaircaseProps) => {
  const currentIndex = TIER_ORDER.indexOf(currentTier);
  const nextTier = TIER_ORDER[currentIndex + 1] as Tier | undefined;
  const nextInfo = nextTier ? TIER_INFO[nextTier] : null;
  const currentInfo = TIER_INFO[currentTier];

  // Get gains from family's sales_pills or fallback to static gains
  const getGainsForTier = (tier: Tier): string[] => {
    const family = families?.[tier];
    if (family?.sales_pills && family.sales_pills.length > 0) {
      return family.sales_pills.slice(0, 3);
    }
    return TIER_INFO[tier].gains;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {TIER_ORDER.map((tier, idx) => {
          const info = TIER_INFO[tier];
          const Icon = info.icon;
          const isCurrent = tier === currentTier;
          const isPast = idx < currentIndex;
          const isFuture = idx > currentIndex;
          
          return (
            <TooltipProvider key={tier}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onSelectTier?.(tier)}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                      isCurrent
                        ? `${info.bgClass} ${info.colorClass} font-semibold ring-2 ring-offset-1 ${info.borderClass.replace('border-', 'ring-')}`
                        : isPast
                          ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                          : 'text-muted-foreground opacity-60 hover:opacity-80'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {!compact && <span>{info.shortLabel}</span>}
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <p className="font-medium mb-1">{info.label}</p>
                  <ul className="text-xs space-y-0.5">
                    {getGainsForTier(tier).map((gain, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <Check className="w-3 h-3 text-success shrink-0 mt-0.5" />
                        {gain}
                      </li>
                    ))}
                  </ul>
                  {prices?.[tier] && (
                    <p className="text-xs font-medium mt-2 pt-1 border-t">
                      A partir de R$ {prices[tier]?.toLocaleString('pt-BR')}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
              {idx < TIER_ORDER.length - 1 && (
                <ChevronRight className={`w-3 h-3 ${
                  idx < currentIndex ? 'text-muted-foreground' : 'text-muted'
                }`} />
              )}
            </TooltipProvider>
          );
        })}
      </div>
    );
  }

  // Full version - shows upgrade path
  return (
    <div className="space-y-4">
      {/* Current tier */}
      <Card className={`${currentInfo.bgClass} ${currentInfo.borderClass} border-2`}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-2">
            <currentInfo.icon className={`w-5 h-5 ${currentInfo.colorClass}`} />
            <span className={`font-bold ${currentInfo.colorClass}`}>
              {currentInfo.label}
            </span>
            <Badge className="ml-auto bg-success text-success-foreground text-xs">
              Atual
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {getGainsForTier(currentTier).map((gain, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">
                <Check className="w-2.5 h-2.5 mr-0.5" />
                {gain}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upgrade arrow + next tier */}
      {nextInfo && (
        <>
          <div className="flex items-center justify-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowUp className="w-4 h-4 text-success" />
              <span>Subindo você ganha</span>
            </div>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Card 
            className={`${nextInfo.bgClass} ${nextInfo.borderClass} border-2 cursor-pointer hover:ring-2 ring-offset-2 transition-all`}
            onClick={() => onSelectTier?.(nextTier)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <nextInfo.icon className={`w-5 h-5 ${nextInfo.colorClass}`} />
                <span className={`font-bold ${nextInfo.colorClass}`}>
                  {nextInfo.label}
                </span>
                {prices?.[nextTier] && prices?.[currentTier] && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    +R$ {((prices[nextTier] ?? 0) - (prices[currentTier] ?? 0)).toLocaleString('pt-BR')}
                  </Badge>
                )}
              </div>
              
              {/* What you gain */}
              <div className="space-y-1.5">
                {getGainsForTier(nextTier).map((gain, i) => (
                  <div 
                    key={i}
                    className="flex items-center gap-2 text-xs bg-success/10 text-success p-1.5 rounded"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{gain}</span>
                  </div>
                ))}
              </div>

              {/* Knowledge consumer text */}
              {families?.[nextTier]?.knowledge?.consumer && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {families[nextTier]?.knowledge?.consumer}
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

// Horizontal staircase for header
export const TierStaircaseHorizontal = ({
  currentTier,
  onSelectTier,
}: {
  currentTier: Tier;
  onSelectTier?: (tier: Tier) => void;
}) => {
  const currentIndex = TIER_ORDER.indexOf(currentTier);

  return (
    <div className="flex items-center gap-1 p-2 bg-muted/30 rounded-lg overflow-x-auto">
      {TIER_ORDER.map((tier, index) => {
        const info = TIER_INFO[tier];
        const Icon = info.icon;
        const isCurrent = tier === currentTier;
        const isPast = index < currentIndex;

        return (
          <div key={tier} className="flex items-center">
            <button
              onClick={() => onSelectTier?.(tier)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
                isCurrent 
                  ? `${info.bgClass} ${info.colorClass} font-semibold ring-2 ring-offset-1 ${info.borderClass.replace('border-', 'ring-')}`
                  : isPast
                    ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                    : 'text-muted-foreground opacity-60 hover:opacity-80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">{info.shortLabel}</span>
            </button>
            {index < TIER_ORDER.length - 1 && (
              <ArrowUp className={`w-3 h-3 mx-1 rotate-90 ${
                index < currentIndex ? 'text-muted-foreground' : 'text-muted'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
};
