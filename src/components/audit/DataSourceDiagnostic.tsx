/**
 * DataSourceDiagnostic - Métricas do catálogo
 * 
 * Mostra apenas métricas do catálogo e status de sincronização.
 * Não há mais distinção local/nuvem - nuvem é a única fonte.
 */

import { useMemo } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  Database,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLensStore } from '@/store/lensStore';
import { CloudSyncIndicator } from '@/components/audit/CloudSyncIndicator';

interface DataSourceDiagnosticProps {
  className?: string;
}

export const DataSourceDiagnostic = ({ className }: DataSourceDiagnosticProps) => {
  const { families, prices } = useLensStore();

  // Métricas do catálogo atual
  const metrics = useMemo(() => {
    const activeFamilies = families.filter(f => f.active);
    const occupationalFamilies = families.filter(f => f.category === 'OCUPACIONAL');
    const occupationalActive = occupationalFamilies.filter(f => f.active);
    
    // SKUs vinculados a famílias ocupacionais
    const occupationalFamilyIds = new Set(occupationalFamilies.map(f => f.id));
    const occupationalSkus = prices.filter(p => occupationalFamilyIds.has(p.family_id));
    const occupationalActiveSkus = occupationalSkus.filter(p => p.active && !p.blocked);

    return {
      totalFamilies: families.length,
      activeFamilies: activeFamilies.length,
      totalPrices: prices.length,
      activePrices: prices.filter(p => p.active && !p.blocked).length,
      occupationalFamilies: occupationalFamilies.length,
      occupationalActive: occupationalActive.length,
      occupationalSkus: occupationalSkus.length,
      occupationalActiveSkus: occupationalActiveSkus.length,
    };
  }, [families, prices]);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <span>Catálogo</span>
          </div>
          <CloudSyncIndicator />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Métricas rápidas */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-muted/50 rounded">
            <div className="text-muted-foreground">Famílias Ativas</div>
            <div className="text-lg font-semibold">{metrics.activeFamilies}</div>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <div className="text-muted-foreground">SKUs Ativos</div>
            <div className="text-lg font-semibold">{metrics.activePrices}</div>
          </div>
        </div>

        {/* Diagnóstico Ocupacional */}
        <div className="p-3 rounded-lg border bg-muted/30">
          <div className="text-xs font-medium mb-2 flex items-center gap-2">
            {metrics.occupationalActiveSkus > 0 ? (
              <CheckCircle className="w-4 h-4 text-success" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-warning" />
            )}
            Lentes Ocupacionais
          </div>
          <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
            <div>Famílias: <span className="font-medium text-foreground">{metrics.occupationalActive}/{metrics.occupationalFamilies}</span></div>
            <div>SKUs: <span className="font-medium text-foreground">{metrics.occupationalActiveSkus}/{metrics.occupationalSkus}</span></div>
          </div>
          {metrics.occupationalActiveSkus === 0 && metrics.occupationalFamilies > 0 && (
            <p className="text-xs text-warning mt-2">
              ⚠️ Famílias ocupacionais sem SKUs vinculados
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
