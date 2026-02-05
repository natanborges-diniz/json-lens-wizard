/**
 * TierEmptyState - Estado vazio para tier sem produtos
 * 
 * Mostra placeholder quando um tier não tem famílias disponíveis,
 * mantendo a estrutura visual da escada de 4 níveis.
 */

import { 
  PackageX, 
  AlertCircle,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Tier } from '@/types/lens';

interface TierEmptyStateProps {
  tier: Tier;
  reason?: string;
  isFallback?: boolean;
  onUpgrade?: () => void;
  onDowngrade?: () => void;
  canUpgrade?: boolean;
  canDowngrade?: boolean;
}

const TIER_LABELS: Record<Tier, string> = {
  essential: 'Essential',
  comfort: 'Conforto',
  advanced: 'Avançada',
  top: 'Premium',
};

const TIER_COLORS: Record<Tier, { bg: string; border: string; text: string }> = {
  essential: {
    bg: 'bg-slate-50 dark:bg-slate-900/30',
    border: 'border-slate-200 dark:border-slate-700',
    text: 'text-slate-500',
  },
  comfort: {
    bg: 'bg-blue-50/50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-500',
  },
  advanced: {
    bg: 'bg-purple-50/50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    text: 'text-purple-500',
  },
  top: {
    bg: 'bg-amber-50/50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-500',
  },
};

export const TierEmptyState = ({
  tier,
  reason,
  isFallback = false,
  onUpgrade,
  onDowngrade,
  canUpgrade = false,
  canDowngrade = false,
}: TierEmptyStateProps) => {
  const colors = TIER_COLORS[tier];
  const label = TIER_LABELS[tier];

  return (
    <Card className={`flex flex-col h-full border-2 border-dashed ${colors.border} ${colors.bg}`}>
      <CardContent className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {/* Icon */}
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${colors.bg}`}>
          {isFallback ? (
            <AlertCircle className={`w-6 h-6 ${colors.text}`} />
          ) : (
            <PackageX className={`w-6 h-6 ${colors.text}`} />
          )}
        </div>

        {/* Tier label */}
        <Badge variant="outline" className={`mb-2 ${colors.text} border-current`}>
          {label}
        </Badge>

        {/* Message */}
        <p className="text-sm text-muted-foreground mb-1">
          {isFallback 
            ? 'Preenchido por fallback'
            : 'Sem opções disponíveis'
          }
        </p>

        {/* Reason */}
        {reason && (
          <p className="text-xs text-muted-foreground/70">
            {reason}
          </p>
        )}

        {/* Actions */}
        {(canUpgrade || canDowngrade) && (
          <div className="flex gap-2 mt-4">
            {canDowngrade && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onDowngrade}
                className="gap-1 text-xs"
              >
                <ChevronDown className="w-3 h-3" />
                Ver nível inferior
              </Button>
            )}
            {canUpgrade && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onUpgrade}
                className="gap-1 text-xs"
              >
                <ChevronUp className="w-3 h-3" />
                Ver nível superior
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TierEmptyState;
