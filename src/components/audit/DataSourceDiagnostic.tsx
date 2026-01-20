/**
 * DataSourceDiagnostic - Diagnóstico de fonte de dados do catálogo
 * 
 * Mostra claramente de onde os dados vieram (nuvem ou local) e permite
 * identificar inconsistências entre as duas fontes.
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Cloud, 
  HardDrive, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Database,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLensStore } from '@/store/lensStore';
import { useCatalogLoader, LoadSource } from '@/hooks/useCatalogLoader';
import { toast } from 'sonner';

interface DataSourceDiagnosticProps {
  className?: string;
}

export const DataSourceDiagnostic = ({ className }: DataSourceDiagnosticProps) => {
  const { families, prices, syncStatus, lastSyncedAt } = useLensStore();
  const { loadSource, loadCatalog, reloadFromLocal, syncLocalToCloud, isLoading } = useCatalogLoader();
  const [isReloading, setIsReloading] = useState(false);

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

  // Handler para forçar reload da nuvem
  const handleForceCloudReload = async () => {
    setIsReloading(true);
    try {
      const success = await loadCatalog(false); // false = tentar nuvem primeiro
      if (success) {
        toast.success('Catálogo recarregado da nuvem');
      } else {
        toast.error('Falha ao recarregar da nuvem');
      }
    } catch (error) {
      toast.error('Erro ao recarregar catálogo');
    } finally {
      setIsReloading(false);
    }
  };

  // Handler para forçar reload do arquivo local
  const handleForceLocalReload = async () => {
    setIsReloading(true);
    try {
      const success = await reloadFromLocal();
      if (success) {
        toast.success('Catálogo recarregado do arquivo local e sincronizado');
      } else {
        toast.error('Falha ao recarregar do local');
      }
    } catch (error) {
      toast.error('Erro ao recarregar catálogo');
    } finally {
      setIsReloading(false);
    }
  };

  const getSourceIcon = () => {
    if (isLoading || isReloading) {
      return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;
    }
    if (loadSource === 'cloud') {
      return <Cloud className="w-5 h-5 text-primary" />;
    }
    if (loadSource === 'local') {
      return <HardDrive className="w-5 h-5 text-warning" />;
    }
    return <Database className="w-5 h-5 text-muted-foreground" />;
  };

  const getSourceLabel = () => {
    if (loadSource === 'cloud') return 'Nuvem (Supabase Storage)';
    if (loadSource === 'local') return 'Arquivo Local (lenses.json)';
    return 'Não carregado';
  };

  const getSourceBadgeVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    if (loadSource === 'cloud') return 'default';
    if (loadSource === 'local') return 'secondary';
    return 'outline';
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getSourceIcon()}
            <span>Fonte de Dados</span>
          </div>
          <Badge variant={getSourceBadgeVariant()} className="font-normal">
            {getSourceLabel()}
          </Badge>
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

        {/* Status de sincronização */}
        {lastSyncedAt && (
          <div className="text-xs text-muted-foreground">
            Última sincronização: {new Date(lastSyncedAt).toLocaleString('pt-BR')}
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs gap-1"
            onClick={handleForceCloudReload}
            disabled={isReloading || isLoading}
          >
            <Cloud className="w-3.5 h-3.5" />
            Recarregar Nuvem
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs gap-1"
            onClick={handleForceLocalReload}
            disabled={isReloading || isLoading}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <ArrowRight className="w-3 h-3" />
            <Cloud className="w-3.5 h-3.5" />
          </Button>
        </div>

        {loadSource === 'local' && (
          <p className="text-xs text-warning bg-warning/10 p-2 rounded">
            ⚠️ Dados carregados do arquivo local. Alterações podem não estar sincronizadas com a nuvem.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
