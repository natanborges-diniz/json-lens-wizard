/**
 * ValueBars - Comparativo visual com barras 1-5
 * 
 * 4 eixos fixos:
 * - Conforto
 * - Tecnologia
 * - Proteção
 * - Personalização
 * 
 * Mostra delta vs tier anterior quando aplicável.
 */

import { useMemo } from 'react';
import { Heart, Cpu, Shield, Target } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Tier } from '@/types/lens';
import type { EnrichedFamily } from '@/lib/catalogEnricher';

interface ValueAxis {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  // Score 1-5 by tier
  tierScores: Record<Tier, number>;
  colorClass: string;
  bgClass: string;
}

const VALUE_AXES: ValueAxis[] = [
  {
    id: 'comfort',
    name: 'Conforto',
    icon: Heart,
    description: 'Conforto visual no dia a dia',
    tierScores: { essential: 2, comfort: 3, advanced: 4, top: 5 },
    colorClass: 'text-rose-500',
    bgClass: 'bg-rose-500',
  },
  {
    id: 'technology',
    name: 'Tecnologia',
    icon: Cpu,
    description: 'Nível de tecnologia óptica',
    tierScores: { essential: 1, comfort: 3, advanced: 4, top: 5 },
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-500',
  },
  {
    id: 'protection',
    name: 'Proteção',
    icon: Shield,
    description: 'Proteção UV e tratamentos',
    tierScores: { essential: 2, comfort: 3, advanced: 4, top: 5 },
    colorClass: 'text-green-500',
    bgClass: 'bg-green-500',
  },
  {
    id: 'personalization',
    name: 'Personalização',
    icon: Target,
    description: 'Precisão e customização',
    tierScores: { essential: 1, comfort: 2, advanced: 4, top: 5 },
    colorClass: 'text-purple-500',
    bgClass: 'bg-purple-500',
  },
];

// Get previous tier
const getPreviousTier = (tier: Tier): Tier | null => {
  const order: Tier[] = ['essential', 'comfort', 'advanced', 'top'];
  const idx = order.indexOf(tier);
  return idx > 0 ? order[idx - 1] : null;
};

// Calculate axis score with family bonuses
function calculateScore(
  axis: ValueAxis,
  tier: Tier,
  family?: EnrichedFamily
): number {
  let score = axis.tierScores[tier];
  
  // Bonus from technology refs
  if (family?.technology_refs && family.technology_refs.length > 2) {
    score = Math.min(5, score + 1);
  }
  
  // Bonus from value_axes if defined
  if (family && (family as any).value_axes) {
    const familyAxes = (family as any).value_axes as Record<string, number>;
    if (familyAxes[axis.id] !== undefined) {
      score = familyAxes[axis.id];
    }
  }
  
  return score;
}

interface ValueBarsProps {
  tier: Tier;
  family?: EnrichedFamily;
  showDelta?: boolean;
  compact?: boolean;
}

export const ValueBars = ({
  tier,
  family,
  showDelta = true,
  compact = false,
}: ValueBarsProps) => {
  const previousTier = getPreviousTier(tier);

  const axisData = useMemo(() => {
    return VALUE_AXES.map(axis => {
      const score = calculateScore(axis, tier, family);
      const prevScore = previousTier 
        ? calculateScore(axis, previousTier) 
        : 0;
      const delta = score - prevScore;
      
      return {
        ...axis,
        score,
        delta,
      };
    });
  }, [tier, family, previousTier]);

  if (compact) {
    // Compact: inline badges
    return (
      <div className="flex flex-wrap gap-1">
        {axisData.map(axis => {
          const Icon = axis.icon;
          return (
            <TooltipProvider key={axis.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${axis.colorClass} bg-muted/50`}>
                    <Icon className="w-3 h-3" />
                    <span>{axis.score}/5</span>
                    {showDelta && axis.delta > 0 && (
                      <span className="text-success font-medium">+{axis.delta}</span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{axis.name}</p>
                  <p className="text-xs text-muted-foreground">{axis.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    );
  }

  // Full: visual bars
  return (
    <div className="space-y-2">
      {axisData.map(axis => {
        const Icon = axis.icon;
        
        return (
          <div key={axis.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Icon className={`w-3 h-3 ${axis.colorClass}`} />
                <span className="font-medium text-muted-foreground">{axis.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs">{axis.score}/5</span>
                {showDelta && axis.delta > 0 && (
                  <span className="text-[10px] text-success font-medium bg-success/10 px-1 rounded">
                    +{axis.delta}
                  </span>
                )}
              </div>
            </div>
            
            {/* Bar visualization */}
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${
                    i <= axis.score ? axis.bgClass : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Delta summary for tier comparison
interface ValueBarsDeltaProps {
  currentTier: Tier;
  family?: EnrichedFamily;
}

export const ValueBarsDelta = ({ currentTier, family }: ValueBarsDeltaProps) => {
  const previousTier = getPreviousTier(currentTier);
  if (!previousTier) return null;

  const improvements = VALUE_AXES.map(axis => {
    const current = calculateScore(axis, currentTier, family);
    const prev = calculateScore(axis, previousTier);
    return {
      axis,
      delta: current - prev,
    };
  }).filter(imp => imp.delta > 0);

  if (improvements.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 text-[10px]">
      {improvements.map(imp => {
        const Icon = imp.axis.icon;
        return (
          <span 
            key={imp.axis.id}
            className="inline-flex items-center gap-1 text-success bg-success/10 px-1.5 py-0.5 rounded"
          >
            <Icon className="w-3 h-3" />
            +{imp.delta} {imp.axis.name}
          </span>
        );
      })}
    </div>
  );
};
