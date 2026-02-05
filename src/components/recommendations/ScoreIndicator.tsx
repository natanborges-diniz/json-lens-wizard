/**
 * ScoreIndicator - Indicador visual de score de recomendação
 * 
 * Exibe:
 * - Score final (0-100)
 * - Breakdown clínico/comercial em tooltip
 * - Motivos da recomendação
 */

import { 
  TrendingUp,
  Stethoscope,
  Store,
  Info,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import type { RecommendationScore } from '@/lib/recommendationEngine/types';

interface ScoreIndicatorProps {
  score: RecommendationScore;
  compact?: boolean;
  showReasons?: boolean;
}

// Color based on score
const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-primary';
  if (score >= 40) return 'text-warning';
  return 'text-muted-foreground';
};

const getScoreBg = (score: number): string => {
  if (score >= 80) return 'bg-success/10';
  if (score >= 60) return 'bg-primary/10';
  if (score >= 40) return 'bg-warning/10';
  return 'bg-muted';
};

export const ScoreIndicator = ({
  score,
  compact = true,
  showReasons = false,
}: ScoreIndicatorProps) => {
  const colorClass = getScoreColor(score.final);
  const bgClass = getScoreBg(score.final);

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={`gap-1 ${colorClass} ${bgClass} border-0`}>
              <TrendingUp className="w-3 h-3" />
              {Math.round(score.final)}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="w-64">
            <ScoreBreakdown score={score} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors hover:opacity-80 ${bgClass} ${colorClass}`}>
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Score: {Math.round(score.final)}</span>
          <Info className="w-3 h-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <ScoreBreakdown score={score} showReasons={showReasons} />
      </PopoverContent>
    </Popover>
  );
};

// Internal component for score breakdown
const ScoreBreakdown = ({ 
  score, 
  showReasons = true 
}: { 
  score: RecommendationScore; 
  showReasons?: boolean;
}) => {
  return (
    <div className="space-y-3">
      {/* Final Score */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Score Final</span>
        <span className={`text-lg font-bold ${getScoreColor(score.final)}`}>
          {Math.round(score.final)}
        </span>
      </div>

      {/* Clinical Score (60%) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Stethoscope className="w-3 h-3" />
            <span>Clínico (60%)</span>
          </div>
          <span className="font-medium">{Math.round(score.clinical.total)}</span>
        </div>
        <Progress value={score.clinical.total} className="h-1.5" />
        
        {/* Clinical breakdown */}
        <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
          <div className="text-center">
            <div className="font-medium">{score.clinical.components.prescriptionMatch}</div>
            <div>Receita</div>
          </div>
          <div className="text-center">
            <div className="font-medium">{score.clinical.components.complaintsMatch}</div>
            <div>Queixas</div>
          </div>
          <div className="text-center">
            <div className="font-medium">{score.clinical.components.lifestyleMatch}</div>
            <div>Estilo</div>
          </div>
        </div>
      </div>

      {/* Commercial Score (40%) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Store className="w-3 h-3" />
            <span>Comercial (40%)</span>
          </div>
          <span className="font-medium">{Math.round(score.commercial.total)}</span>
        </div>
        <Progress value={score.commercial.total} className="h-1.5" />
        
        {/* Commercial breakdown */}
        <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground">
          <div className="text-center">
            <div className="font-medium">{score.commercial.components.availability}</div>
            <div>Estoque</div>
          </div>
          <div className="text-center">
            <div className="font-medium">{score.commercial.components.tierPosition}</div>
            <div>Tier</div>
          </div>
          <div className="text-center">
            <div className="font-medium">{score.commercial.components.dataRichness}</div>
            <div>Dados</div>
          </div>
          <div className="text-center">
            <div className="font-medium">{score.commercial.components.technologyCount}</div>
            <div>Techs</div>
          </div>
        </div>
      </div>

      {/* Reasons */}
      {showReasons && score.clinical.reasons.length > 0 && (
        <div className="pt-2 border-t space-y-1">
          <p className="text-xs font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary" />
            Motivos
          </p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {score.clinical.reasons.slice(0, 3).map((reason, i) => (
              <li key={i} className="line-clamp-1">• {reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Eligibility warning */}
      {!score.isEligible && score.ineligibilityReason && (
        <div className="pt-2 border-t">
          <p className="text-xs text-destructive flex items-center gap-1">
            <Info className="w-3 h-3" />
            {score.ineligibilityReason}
          </p>
        </div>
      )}
    </div>
  );
};

// Compact version for card headers
export const ScoreBadge = ({ score }: { score: number }) => {
  return (
    <Badge 
      variant="secondary" 
      className={`gap-0.5 text-[10px] ${getScoreColor(score)} ${getScoreBg(score)} border-0`}
    >
      <TrendingUp className="w-2.5 h-2.5" />
      {Math.round(score)}
    </Badge>
  );
};

export default ScoreIndicator;
