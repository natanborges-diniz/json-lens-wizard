import { useMemo } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Upload, Loader2, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ConsistencyAuditResult, AutoFix } from '@/lib/catalogConsistencyAuditor';

export type CatalogStatus = 'draft' | 'ready_for_publish' | 'published';

interface CatalogStatusBannerProps {
  auditResult: ConsistencyAuditResult | null;
  catalogStatus: CatalogStatus;
  pendingChanges: number;
  isSaving: boolean;
  onPublish: () => void;
  onApplyAutoFixes?: (fixes: AutoFix[]) => void;
}

export function CatalogStatusBanner({
  auditResult,
  catalogStatus,
  pendingChanges,
  isSaving,
  onPublish,
  onApplyAutoFixes,
}: CatalogStatusBannerProps) {
  const criticalCount = auditResult?.summary.totalCritical ?? 0;
  const warningCount = auditResult?.summary.totalWarnings ?? 0;
  const autoFixCount = auditResult?.summary.totalAutoFixes ?? 0;
  const canPublish = auditResult?.summary.canPublish ?? false;

  const effectiveStatus: CatalogStatus = useMemo(() => {
    if (catalogStatus === 'published' && pendingChanges === 0 && canPublish) return 'published';
    if (canPublish && pendingChanges === 0) return 'ready_for_publish';
    return 'draft';
  }, [catalogStatus, pendingChanges, canPublish]);

  const statusConfig = {
    draft: {
      icon: ShieldAlert,
      label: 'RASCUNHO',
      bgClass: 'bg-destructive/10 border-destructive/30',
      textClass: 'text-destructive',
      badgeVariant: 'destructive' as const,
    },
    ready_for_publish: {
      icon: ShieldCheck,
      label: 'PRONTO PARA PUBLICAR',
      bgClass: 'bg-emerald-500/10 border-emerald-500/30',
      textClass: 'text-emerald-600',
      badgeVariant: 'default' as const,
    },
    published: {
      icon: Shield,
      label: 'PUBLICADO',
      bgClass: 'bg-primary/10 border-primary/30',
      textClass: 'text-primary',
      badgeVariant: 'default' as const,
    },
  };

  const config = statusConfig[effectiveStatus];
  const Icon = config.icon;

  // Build tooltip reasons for blocked publish
  const blockReasons = useMemo(() => {
    if (!auditResult || canPublish) return [];
    const reasons: string[] = [];
    const typeCount = new Map<string, number>();
    auditResult.critical.forEach(c => {
      typeCount.set(c.type, (typeCount.get(c.type) || 0) + 1);
    });
    typeCount.forEach((count, type) => {
      const labels: Record<string, string> = {
        SKU_WITHOUT_FAMILY: 'SKU(s) sem família',
        MIXED_PRODUCT_KIND: 'Família(s) com ProductKind misto',
        CLINICAL_TYPE_MISMATCH: 'Família(s) com clinical_type inconsistente',
        FAMILY_WITHOUT_ACTIVE_SKU: 'Família(s) ativa(s) sem SKU ativo',
        INCOMPATIBLE_TECHNOLOGY: 'Tecnologia(s) incompatível(eis)',
        MIXED_SUPPLIER_FAMILY: 'Família(s) com fornecedores mistos',
        FAMILY_WITHOUT_SUPPLIER: 'Família(s) sem fornecedor',
        SKU_NULL_CLINICAL_TYPE: 'SKU(s) sem clinical_type',
        SKU_MISSING_ESSENTIAL_RANGE: 'SKU(s) sem range essencial',
      };
      reasons.push(`${count} ${labels[type] || type}`);
    });
    return reasons;
  }, [auditResult, canPublish]);

  return (
    <div className={`rounded-lg border p-3 ${config.bgClass}`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Icon className={`w-5 h-5 ${config.textClass}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${config.textClass}`}>
                Status: {config.label}
              </span>
              {criticalCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {criticalCount} crítico(s)
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {warningCount} aviso(s)
                </Badge>
              )}
              {pendingChanges > 0 && (
                <Badge variant="outline" className="text-xs">
                  {pendingChanges} alteração(ões) pendente(s)
                </Badge>
              )}
            </div>
            {blockReasons.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Bloqueio: {blockReasons.slice(0, 3).join(' · ')}
                {blockReasons.length > 3 && ` (+${blockReasons.length - 3})`}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {autoFixCount > 0 && onApplyAutoFixes && auditResult && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => onApplyAutoFixes(auditResult.autoFixes)}
            >
              <Wrench className="w-3.5 h-3.5" />
              Corrigir ({autoFixCount})
            </Button>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs"
                    disabled={!canPublish || pendingChanges > 0 || isSaving}
                    onClick={onPublish}
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    Publicar
                  </Button>
                </span>
              </TooltipTrigger>
              {(!canPublish || pendingChanges > 0) && (
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs font-medium mb-1">Publicação bloqueada:</p>
                  <ul className="text-xs space-y-0.5">
                    {pendingChanges > 0 && (
                      <li>• {pendingChanges} alteração(ões) não salva(s)</li>
                    )}
                    {blockReasons.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
