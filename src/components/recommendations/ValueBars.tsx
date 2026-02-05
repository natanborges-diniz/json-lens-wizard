/**
 * ValueBars - Comparativo visual com barras 1-5
 * 
 * Uses REAL data from:
 * 1. family.value_axes (manual overrides)
 * 2. family.attributes_base (catalog data)
 * 3. scoredFamily.technologies (resolved techs)
 * 4. Tier-based inference ONLY as last resort
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
import type { ScoredFamily } from '@/lib/recommendationEngine/types';

interface ValueAxis {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  colorClass: string;
  bgClass: string;
}

const VALUE_AXES: ValueAxis[] = [
  {
    id: 'comfort',
    name: 'Conforto',
    icon: Heart,
    description: 'Conforto visual no dia a dia',
    colorClass: 'text-rose-500',
    bgClass: 'bg-rose-500',
  },
  {
    id: 'technology',
    name: 'Tecnologia',
    icon: Cpu,
    description: 'Nível de tecnologia óptica',
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-500',
  },
  {
    id: 'protection',
    name: 'Proteção',
    icon: Shield,
    description: 'Proteção UV e tratamentos',
    colorClass: 'text-green-500',
    bgClass: 'bg-green-500',
  },
  {
    id: 'personalization',
    name: 'Personalização',
    icon: Target,
    description: 'Precisão e customização',
    colorClass: 'text-purple-500',
    bgClass: 'bg-purple-500',
  },
];

// Tier baseline scores - ONLY used when no real data exists
const TIER_BASELINES: Record<Tier, Record<string, number>> = {
  essential: { comfort: 2, technology: 1, protection: 2, personalization: 1 },
  comfort: { comfort: 3, technology: 3, protection: 3, personalization: 2 },
  advanced: { comfort: 4, technology: 4, protection: 4, personalization: 4 },
  top: { comfort: 5, technology: 5, protection: 5, personalization: 5 },
};

// Attribute mapping: catalog attribute IDs -> value axis
const ATTRIBUTE_TO_AXIS: Record<string, string> = {
  // Comfort
  'PROG_CONFORTO': 'comfort',
  'MONO_CONFORTO': 'comfort',
  'PROG_ADAPTACAO': 'comfort',
  'MONO_ADAPTACAO': 'comfort',
  'COMFORT': 'comfort',
  'ADAPTATION': 'comfort',
  'comfort_score': 'comfort',
  'visual_comfort': 'comfort',
  // Technology
  'PROG_PRECISAO': 'technology',
  'MONO_NITIDEZ': 'technology',
  'TECNOLOGIA': 'technology',
  'tech_level': 'technology',
  'digital_precision': 'technology',
  // Protection
  'AR_QUALIDADE': 'protection',
  'BLUE': 'protection',
  'UV_PROTECTION': 'protection',
  'DURABILIDADE': 'protection',
  'durability': 'protection',
  // Personalization
  'PROG_PERSONALIZACAO': 'personalization',
  'CUSTOMIZATION': 'personalization',
  'personalization_level': 'personalization',
};

/**
 * Calculate real score for an axis using catalog data
 */
function calculateAxisScore(
  axisId: string,
  tier: Tier,
  family?: EnrichedFamily,
  scoredFamily?: ScoredFamily,
): { score: number; source: 'value_axes' | 'attributes' | 'technology' | 'tier_inferred' } {
  // 1. Manual value_axes override (highest priority)
  if (family && (family as any).value_axes) {
    const familyAxes = (family as any).value_axes as Record<string, number>;
    if (familyAxes[axisId] !== undefined) {
      return { score: Math.min(5, Math.max(1, familyAxes[axisId])), source: 'value_axes' };
    }
  }

  // 2. Derive from attributes_base
  if (family?.attributes_base) {
    const relevantAttrs = Object.entries(ATTRIBUTE_TO_AXIS)
      .filter(([_, axis]) => axis === axisId)
      .map(([attrId]) => attrId);
    
    const attrValues: number[] = [];
    for (const attrId of relevantAttrs) {
      const val = family.attributes_base[attrId];
      if (typeof val === 'number') {
        attrValues.push(val);
      }
    }
    
    if (attrValues.length > 0) {
      const avg = attrValues.reduce((s, v) => s + v, 0) / attrValues.length;
      // Scale to 1-5 (assumes attributes are 0-5 or 0-4)
      const scaled = Math.min(5, Math.max(1, Math.round(avg > 4 ? avg : avg + 1)));
      return { score: scaled, source: 'attributes' };
    }
  }

  // 3. Technology-based bonus (for 'technology' axis)
  if (axisId === 'technology' && scoredFamily?.technologies) {
    const techCount = scoredFamily.technologies.length;
    if (techCount > 0) {
      const techScore = Math.min(5, 1 + techCount);
      return { score: techScore, source: 'technology' };
    }
  }

  // 4. Tier-based inference (last resort)
  const baseline = TIER_BASELINES[tier]?.[axisId] ?? 2;
  
  // Add bonus from technology richness even for non-technology axes
  let bonus = 0;
  if (scoredFamily?.technologies && scoredFamily.technologies.length > 2) {
    bonus = 1;
  }
  
  return { 
    score: Math.min(5, baseline + bonus), 
    source: 'tier_inferred' 
  };
}

// Get previous tier
const getPreviousTier = (tier: Tier): Tier | null => {
  const order: Tier[] = ['essential', 'comfort', 'advanced', 'top'];
  const idx = order.indexOf(tier);
  return idx > 0 ? order[idx - 1] : null;
};

interface ValueBarsProps {
  tier: Tier;
  family?: EnrichedFamily;
  showDelta?: boolean;
  compact?: boolean;
  scoredFamily?: ScoredFamily;
}

export const ValueBars = ({
  tier,
  family,
  showDelta = true,
  compact = false,
  scoredFamily,
}: ValueBarsProps) => {
  const previousTier = getPreviousTier(tier);

  const axisData = useMemo(() => {
    return VALUE_AXES.map(axis => {
      const { score, source } = calculateAxisScore(axis.id, tier, family, scoredFamily);
      const prevScore = previousTier 
        ? calculateAxisScore(axis.id, previousTier).score
        : 0;
      const delta = score - prevScore;
      
      return {
        ...axis,
        score,
        delta,
        source,
      };
    });
  }, [tier, family, previousTier, scoredFamily]);

  if (compact) {
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
                      <span className="text-emerald-600 font-medium">+{axis.delta}</span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{axis.name}</p>
                  <p className="text-xs text-muted-foreground">{axis.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Fonte: {axis.source === 'value_axes' ? 'Catálogo (manual)' : 
                            axis.source === 'attributes' ? 'Atributos do catálogo' :
                            axis.source === 'technology' ? 'Tecnologias resolvidas' :
                            'Inferência por tier'}
                  </p>
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
                  <span className="text-[10px] text-emerald-600 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-1 rounded">
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
  scoredFamily?: ScoredFamily;
}

export const ValueBarsDelta = ({ currentTier, family, scoredFamily }: ValueBarsDeltaProps) => {
  const previousTier = getPreviousTier(currentTier);
  if (!previousTier) return null;

  const improvements = VALUE_AXES.map(axis => {
    const { score: current } = calculateAxisScore(axis.id, currentTier, family, scoredFamily);
    const { score: prev } = calculateAxisScore(axis.id, previousTier);
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
            className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded"
          >
            <Icon className="w-3 h-3" />
            +{imp.delta} {imp.axis.name}
          </span>
        );
      })}
    </div>
  );
};
