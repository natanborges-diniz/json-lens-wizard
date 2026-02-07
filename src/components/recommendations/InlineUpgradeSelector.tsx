/**
 * InlineUpgradeSelector - Renders upgrade toggles from OptionMatrix
 * 
 * RULES:
 * - No inference here. Reads pre-built OptionMatrix.
 * - Toggle only appears if backed by real SKU (skuCount >= 1)
 * - Price = actual SKU price from catalog
 * - Audit: shows selected SKU erp_code on hover
 */

import { useMemo } from 'react';
import { Check, Eye, Sun, Sparkles, Shield, Plus } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { OptionMatrix, IndexOption, TreatmentOption } from '@/lib/optionMatrix';

interface InlineUpgradeSelectorProps {
  matrix: OptionMatrix;
  selectedIndex: string;
  selectedTreatments: string[];
  onIndexChange: (index: string) => void;
  onTreatmentToggle: (treatmentId: string) => void;
}

// Icon mapping from string keys to components
const ICON_MAP: Record<string, React.ElementType> = {
  eye: Eye,
  sun: Sun,
  sparkles: Sparkles,
  shield: Shield,
  plus: Plus,
};

export const InlineUpgradeSelector = ({
  matrix,
  selectedIndex,
  selectedTreatments,
  onIndexChange,
  onTreatmentToggle,
}: InlineUpgradeSelectorProps) => {
  const hasMultipleIndices = matrix.indexOptions.length > 1;
  const hasTreatments = matrix.treatmentOptions.length > 0;

  // Resolve current SKU for audit display
  const resolved = useMemo(
    () => matrix.resolve(selectedIndex, selectedTreatments),
    [matrix, selectedIndex, selectedTreatments]
  );

  if (!hasMultipleIndices && !hasTreatments) {
    return (
      <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2 text-center">
        <span className="font-medium">Configuração única</span> — índice {selectedIndex}
        <span className="block text-[10px] text-muted-foreground/70 mt-0.5">
          Sem upgrades disponíveis para esta receita
        </span>
        {resolved && (
          <span className="block text-[9px] opacity-60 mt-0.5">
            SKU: {resolved.erpCode}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Index selector */}
      {hasMultipleIndices && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">
            Índice
          </span>
          <div className="flex flex-wrap gap-1">
            {matrix.indexOptions.map(opt => (
              <IndexChip
                key={opt.index}
                option={opt}
                isActive={opt.index === selectedIndex}
                onClick={() => onIndexChange(opt.index)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Treatment toggles */}
      {hasTreatments && (
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">
            Upgrades
          </span>
          <div className="flex flex-wrap gap-1">
            {matrix.treatmentOptions.map(t => (
              <TreatmentChip
                key={t.id}
                option={t}
                isActive={selectedTreatments.includes(t.id)}
                onClick={() => onTreatmentToggle(t.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Audit: resolved SKU */}
      {resolved && (
        <div className="text-[9px] text-muted-foreground/50 text-right">
          SKU: {resolved.erpCode} · R$ {resolved.pairPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function IndexChip({ option, isActive, onClick }: { 
  option: IndexOption; isActive: boolean; onClick: () => void 
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={`
              px-2 py-1 rounded-md text-xs font-medium border transition-all
              ${isActive 
                ? 'bg-primary text-primary-foreground border-primary' 
                : 'bg-background border-border hover:border-primary/50 text-foreground'
              }
            `}
          >
            {option.index}
            {isActive && <Check className="w-3 h-3 inline ml-1" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{option.label}</p>
          <p className="text-xs">
            R$ {option.minPairPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {option.deltaFromBase > 0 && (
            <p className="text-xs text-primary">
              +R$ {option.deltaFromBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            {option.skuCount} SKU(s) disponíveis
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TreatmentChip({ option, isActive, onClick }: { 
  option: TreatmentOption; isActive: boolean; onClick: () => void 
}) {
  const Icon = ICON_MAP[option.icon] || Plus;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={`
              flex items-center gap-1 px-2 py-1 rounded-md text-xs border transition-all
              ${isActive 
                ? 'bg-primary/10 text-primary border-primary font-medium' 
                : 'bg-background border-border hover:border-primary/50 text-muted-foreground'
              }
            `}
          >
            <Icon className="w-3 h-3" />
            {option.shortLabel}
            {isActive && <Check className="w-3 h-3" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{option.label}</p>
          {option.deltaFromBase > 10 ? (
            <p className="text-xs text-primary">
              +R$ {option.deltaFromBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Incluso nesta configuração</p>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            {option.skuCount} SKU(s) · {option.sourceErpCodes[0]}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
