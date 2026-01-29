/**
 * ValueAxesComparison - Comparativo por eixos de valor
 * 
 * Exibe comparação entre produtos por 5 eixos:
 * - Conforto
 * - Tecnologia
 * - Proteção
 * - Adaptação
 * - Uso prolongado
 * 
 * Isso transforma estrelas genéricas em diferenças perceptíveis.
 */

import { 
  Heart, 
  Cpu, 
  Shield, 
  Gauge, 
  Clock,
  Info 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Tier } from '@/types/lens';
import type { EnrichedFamily } from '@/lib/catalogEnricher';

// Value axes configuration
interface ValueAxis {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  tierScores: Record<Tier, number>; // Base score by tier (0-100)
  colorClass: string;
}

const VALUE_AXES: ValueAxis[] = [
  {
    id: 'comfort',
    name: 'Conforto',
    icon: Heart,
    description: 'Conforto visual no dia a dia, menos fadiga ocular',
    tierScores: { essential: 40, comfort: 65, advanced: 85, top: 100 },
    colorClass: 'text-rose-500',
  },
  {
    id: 'technology',
    name: 'Tecnologia',
    icon: Cpu,
    description: 'Nível de tecnologia óptica e personalização',
    tierScores: { essential: 30, comfort: 55, advanced: 80, top: 100 },
    colorClass: 'text-blue-500',
  },
  {
    id: 'protection',
    name: 'Proteção',
    icon: Shield,
    description: 'Proteção UV, luz azul e tratamentos inclusos',
    tierScores: { essential: 35, comfort: 60, advanced: 80, top: 95 },
    colorClass: 'text-green-500',
  },
  {
    id: 'adaptation',
    name: 'Adaptação',
    icon: Gauge,
    description: 'Facilidade e rapidez de adaptação às lentes',
    tierScores: { essential: 45, comfort: 70, advanced: 90, top: 100 },
    colorClass: 'text-purple-500',
  },
  {
    id: 'extended_use',
    name: 'Uso Prolongado',
    icon: Clock,
    description: 'Conforto em jornadas longas de trabalho',
    tierScores: { essential: 40, comfort: 65, advanced: 85, top: 100 },
    colorClass: 'text-amber-500',
  },
];

// Calculate axis score based on tier + technology_refs
function calculateAxisScore(
  axis: ValueAxis,
  tier: Tier,
  family?: EnrichedFamily
): number {
  let baseScore = axis.tierScores[tier];
  
  // Bonus for technology refs
  if (family?.technology_refs && family.technology_refs.length > 0) {
    baseScore = Math.min(100, baseScore + family.technology_refs.length * 3);
  }
  
  // Bonus for specific attributes
  if (family?.attributes_base) {
    const attrs = family.attributes_base;
    
    if (axis.id === 'comfort' && attrs['visual_comfort']) {
      baseScore = Math.min(100, baseScore + (attrs['visual_comfort'] as number) * 5);
    }
    if (axis.id === 'adaptation' && attrs['adaptation_speed']) {
      baseScore = Math.min(100, baseScore + (attrs['adaptation_speed'] as number) * 5);
    }
  }
  
  return baseScore;
}

interface ValueAxesComparisonProps {
  tier: Tier;
  family?: EnrichedFamily;
  compact?: boolean;
  showLabels?: boolean;
}

export const ValueAxesComparison = ({
  tier,
  family,
  compact = false,
  showLabels = true,
}: ValueAxesComparisonProps) => {
  const scores = VALUE_AXES.map(axis => ({
    ...axis,
    score: calculateAxisScore(axis, tier, family),
  }));

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {scores.map(axis => {
          const Icon = axis.icon;
          const level = axis.score >= 80 ? 'Alto' : axis.score >= 60 ? 'Médio' : 'Básico';
          
          return (
            <TooltipProvider key={axis.id}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] gap-1 cursor-help ${axis.colorClass}`}
                  >
                    <Icon className="w-3 h-3" />
                    {level}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{axis.name}</p>
                  <p className="text-xs text-muted-foreground">{axis.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={axis.score} className="h-1.5 w-20" />
                    <span className="text-xs">{axis.score}%</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showLabels && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="w-3 h-3" />
          <span>Comparativo por eixos de valor</span>
        </div>
      )}
      
      <div className="space-y-2">
        {scores.map(axis => {
          const Icon = axis.icon;
          
          return (
            <div key={axis.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Icon className={`w-3.5 h-3.5 ${axis.colorClass}`} />
                  <span className="font-medium">{axis.name}</span>
                </div>
                <span className="text-muted-foreground">{axis.score}%</span>
              </div>
              <Progress 
                value={axis.score} 
                className="h-1.5"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Comparison between two tiers
interface TierAxesComparisonProps {
  currentTier: Tier;
  nextTier?: Tier;
  currentFamily?: EnrichedFamily;
}

export const TierAxesComparison = ({
  currentTier,
  nextTier,
  currentFamily,
}: TierAxesComparisonProps) => {
  if (!nextTier) return null;
  
  const currentScores = VALUE_AXES.map(axis => ({
    ...axis,
    score: calculateAxisScore(axis, currentTier, currentFamily),
  }));
  
  const nextScores = VALUE_AXES.map(axis => ({
    ...axis,
    score: calculateAxisScore(axis, nextTier),
  }));

  // Find improvements
  const improvements = VALUE_AXES.map((axis, idx) => ({
    axis,
    current: currentScores[idx].score,
    next: nextScores[idx].score,
    delta: nextScores[idx].score - currentScores[idx].score,
  })).filter(imp => imp.delta > 0).sort((a, b) => b.delta - a.delta);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        O que você ganha subindo de nível:
      </p>
      <div className="space-y-1.5">
        {improvements.slice(0, 3).map(imp => {
          const Icon = imp.axis.icon;
          
          return (
            <div 
              key={imp.axis.id}
              className="flex items-center gap-2 text-xs bg-success/10 text-success p-1.5 rounded"
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="flex-1">{imp.axis.name}</span>
              <span className="font-bold">+{imp.delta}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
