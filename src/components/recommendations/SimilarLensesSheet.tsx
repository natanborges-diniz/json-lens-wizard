/**
 * SimilarLensesSheet (E5) - Sheet lateral com alternativas do mesmo tier
 * 
 * Mostra famílias elegíveis no mesmo tier, ordenadas por adjustedScore,
 * com round-robin de fornecedores para diversidade.
 */

import { useMemo } from 'react';
import { LayoutGrid, Check, ChevronRight, Sparkles } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScoreIndicator } from './ScoreIndicator';
import type { ScoredFamily, TierKey } from '@/lib/recommendationEngine/types';
import type { Family, FamilyExtended } from '@/types/lens';

interface SimilarLensesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tierKey: TierKey;
  winnerId: string;
  alternatives: ScoredFamily[];
  onSelectAlternative: (sf: ScoredFamily) => void;
}

const TIER_LABELS: Record<TierKey, string> = {
  essential: 'Essential',
  comfort: 'Conforto',
  advanced: 'Avançada',
  top: 'Top',
};

/**
 * Round-robin interleave by supplier for diversity
 */
function interleaveBySupplier(items: ScoredFamily[]): ScoredFamily[] {
  if (items.length <= 1) return items;
  
  // Group by supplier
  const bySupplier = new Map<string, ScoredFamily[]>();
  items.forEach(sf => {
    const supplier = sf.family.supplier;
    if (!bySupplier.has(supplier)) bySupplier.set(supplier, []);
    bySupplier.get(supplier)!.push(sf);
  });

  // Sort each group by adjustedScore desc
  bySupplier.forEach(group => group.sort((a, b) => b.score.adjustedScore - a.score.adjustedScore));

  // Round-robin
  const result: ScoredFamily[] = [];
  const queues = [...bySupplier.values()];
  let idx = 0;
  while (result.length < items.length && queues.some(q => q.length > 0)) {
    const queue = queues[idx % queues.length];
    if (queue.length > 0) {
      result.push(queue.shift()!);
    }
    idx++;
  }
  return result;
}

export const SimilarLensesSheet = ({
  open,
  onOpenChange,
  tierKey,
  winnerId,
  alternatives,
  onSelectAlternative,
}: SimilarLensesSheetProps) => {
  
  // Filter out winner, interleave by supplier, cap at 8
  const similarOptions = useMemo(() => {
    const filtered = alternatives.filter(sf => sf.family.id !== winnerId);
    return interleaveBySupplier(filtered).slice(0, 8);
  }, [alternatives, winnerId]);

  const getDisplayName = (sf: ScoredFamily): string => {
    const f = sf.family as FamilyExtended;
    const name = f.display_name || f.name_display || f.name_original?.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || f.id;
    if (name.toUpperCase().includes(f.supplier.toUpperCase())) return name;
    return `${f.supplier} ${name}`;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5" />
            Similares — {TIER_LABELS[tierKey]}
          </SheetTitle>
          <SheetDescription>
            {similarOptions.length} alternativa(s) elegível(eis) no mesmo nível
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {similarOptions.map(sf => {
            const startPrice = sf.startingPrice;
            const technologies = sf.technologies?.slice(0, 3) || [];
            const salesPills = sf.salesPills?.slice(0, 3) || [];

            return (
              <Card key={sf.family.id} className="border hover:shadow-sm transition-shadow">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm leading-tight line-clamp-2">
                        {getDisplayName(sf)}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {sf.family.supplier}
                      </p>
                    </div>
                    <ScoreIndicator score={sf.score} compact={true} />
                  </div>

                  {/* Sales pills */}
                  {salesPills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {salesPills.map((pill, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{pill}</Badge>
                      ))}
                    </div>
                  )}

                  {/* Technologies */}
                  {technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {technologies.map((tech, i) => (
                        <span key={i} className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5 text-primary" />
                          {tech.name_common}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Price + CTA */}
                  <div className="flex items-center justify-between pt-1">
                    {startPrice ? (
                      <div className="text-sm font-bold">
                        R$ {startPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        <span className="text-[10px] text-muted-foreground font-normal ml-1">par</span>
                      </div>
                    ) : (
                      <span className="text-xs text-destructive">Sem preço</span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => onSelectAlternative(sf)}
                    >
                      Selecionar <ChevronRight className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {similarOptions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Sem alternativas disponíveis neste nível
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
