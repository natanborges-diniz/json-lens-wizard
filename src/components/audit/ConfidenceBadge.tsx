/**
 * ConfidenceBadge — Governance visual for data provenance and review status.
 * Shows how the data was obtained (explicit, inferred, manual, ai_extracted)
 * and its review state (draft, reviewed, approved, rejected).
 */

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ShieldCheck, ShieldAlert, ShieldQuestion, Bot, Pencil, Eye } from 'lucide-react';

type DataConfidence = 'explicit' | 'inferred' | 'manual' | 'ai_extracted';
type ReviewStatus = 'draft' | 'reviewed' | 'approved' | 'rejected';

interface ConfidenceBadgeProps {
  confidence: DataConfidence;
  reviewStatus?: ReviewStatus;
  compact?: boolean;
  showReview?: boolean;
}

const CONFIDENCE_CONFIG: Record<DataConfidence, {
  label: string;
  icon: typeof ShieldCheck;
  className: string;
  description: string;
}> = {
  explicit: {
    label: 'Explícito',
    icon: ShieldCheck,
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    description: 'Dado extraído diretamente de ficha técnica ou tabela oficial',
  },
  inferred: {
    label: 'Inferido',
    icon: ShieldQuestion,
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    description: 'Dado derivado por lógica a partir de informações parciais',
  },
  manual: {
    label: 'Manual',
    icon: Pencil,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    description: 'Dado inserido manualmente por um operador',
  },
  ai_extracted: {
    label: 'IA',
    icon: Bot,
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    description: 'Dado extraído automaticamente por modelo de IA',
  },
};

const REVIEW_CONFIG: Record<ReviewStatus, {
  label: string;
  icon: typeof Eye;
  className: string;
  description: string;
}> = {
  draft: {
    label: 'Rascunho',
    icon: ShieldAlert,
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    description: 'Dado ainda não revisado — pode conter imprecisões',
  },
  reviewed: {
    label: 'Revisado',
    icon: Eye,
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    description: 'Dado revisado por operador mas ainda não aprovado',
  },
  approved: {
    label: 'Aprovado',
    icon: ShieldCheck,
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    description: 'Dado aprovado e confiável para uso em recomendações',
  },
  rejected: {
    label: 'Rejeitado',
    icon: ShieldAlert,
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800',
    description: 'Dado rejeitado na revisão — não deve ser usado',
  },
};

export const ConfidenceBadge = ({
  confidence,
  reviewStatus,
  compact = false,
  showReview = true,
}: ConfidenceBadgeProps) => {
  const conf = CONFIDENCE_CONFIG[confidence] || CONFIDENCE_CONFIG.manual;
  const Icon = conf.icon;

  const review = reviewStatus ? REVIEW_CONFIG[reviewStatus] : null;
  const ReviewIcon = review?.icon;

  return (
    <TooltipProvider>
      <div className="inline-flex items-center gap-1">
        {/* Confidence badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`text-[9px] px-1.5 py-0 gap-0.5 border ${conf.className} cursor-help`}
            >
              <Icon className="w-2.5 h-2.5" />
              {!compact && conf.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p className="text-xs font-medium">{conf.label}</p>
            <p className="text-[10px] text-muted-foreground">{conf.description}</p>
          </TooltipContent>
        </Tooltip>

        {/* Review status badge */}
        {showReview && review && ReviewIcon && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={`text-[9px] px-1.5 py-0 gap-0.5 border ${review.className} cursor-help`}
              >
                <ReviewIcon className="w-2.5 h-2.5" />
                {!compact && review.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="text-xs font-medium">{review.label}</p>
              <p className="text-[10px] text-muted-foreground">{review.description}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};

/**
 * Utility: check if data is safe for recommendation engine.
 * Only 'approved' or 'reviewed' data with 'explicit' or 'manual' confidence
 * should feed reliable recommendations.
 */
export function isDataReliableForEngine(
  confidence: DataConfidence,
  reviewStatus: ReviewStatus
): boolean {
  if (reviewStatus === 'rejected') return false;
  if (reviewStatus === 'draft') return false;
  // reviewed or approved are OK
  return true;
}

/**
 * Returns a governance grade: 'reliable', 'caution', 'blocked'
 */
export function getGovernanceGrade(
  confidence: DataConfidence,
  reviewStatus: ReviewStatus
): 'reliable' | 'caution' | 'blocked' {
  if (reviewStatus === 'rejected') return 'blocked';
  if (reviewStatus === 'draft') {
    if (confidence === 'inferred' || confidence === 'ai_extracted') return 'blocked';
    return 'caution';
  }
  if (reviewStatus === 'reviewed') {
    if (confidence === 'inferred') return 'caution';
    return 'reliable';
  }
  // approved
  return 'reliable';
}

export default ConfidenceBadge;
