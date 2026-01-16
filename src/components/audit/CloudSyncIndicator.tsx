import { Cloud, CloudOff, Loader2, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useLensStore } from '@/store/lensStore';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error';

interface CloudSyncIndicatorProps {
  className?: string;
  onRetry?: () => void;
}

export const CloudSyncIndicator = ({ className, onRetry }: CloudSyncIndicatorProps) => {
  const { 
    syncStatus, 
    lastSyncedAt, 
    lastSyncError,
    isSavingToCloud,
    saveCatalogToCloud 
  } = useLensStore();

  // Determine effective status - isSavingToCloud takes precedence
  const effectiveStatus: SyncStatus = isSavingToCloud ? 'syncing' : syncStatus;

  const handleRetry = async () => {
    if (onRetry) {
      onRetry();
    } else {
      await saveCatalogToCloud();
    }
  };

  const getStatusConfig = () => {
    switch (effectiveStatus) {
      case 'synced':
        return {
          icon: Check,
          label: 'Sincronizado',
          className: 'text-emerald-600 dark:text-emerald-400',
          bgClassName: 'bg-emerald-50 dark:bg-emerald-950/30',
          animate: false,
        };
      case 'syncing':
        return {
          icon: Loader2,
          label: 'Salvando...',
          className: 'text-blue-600 dark:text-blue-400',
          bgClassName: 'bg-blue-50 dark:bg-blue-950/30',
          animate: true,
        };
      case 'pending':
        return {
          icon: Cloud,
          label: 'Pendente',
          className: 'text-amber-600 dark:text-amber-400',
          bgClassName: 'bg-amber-50 dark:bg-amber-950/30',
          animate: false,
        };
      case 'error':
        return {
          icon: AlertCircle,
          label: 'Erro ao salvar',
          className: 'text-destructive',
          bgClassName: 'bg-destructive/10',
          animate: false,
        };
      default:
        return {
          icon: CloudOff,
          label: 'Desconectado',
          className: 'text-muted-foreground',
          bgClassName: 'bg-muted',
          animate: false,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const formatLastSync = () => {
    if (!lastSyncedAt) return 'Nunca sincronizado';
    try {
      return `Última sincronização: ${formatDistanceToNow(new Date(lastSyncedAt), { 
        addSuffix: true, 
        locale: ptBR 
      })}`;
    } catch {
      return 'Última sincronização: --';
    }
  };

  // If error, show clickable button
  if (effectiveStatus === 'error') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              className={cn(
                'gap-2 h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10',
                className
              )}
            >
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Erro - Tentar novamente</span>
              <RefreshCw className="w-3 h-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium text-destructive">Falha ao salvar</p>
            {lastSyncError && (
              <p className="text-xs text-muted-foreground mt-1">{lastSyncError}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {formatLastSync()}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Normal status indicator (non-clickable)
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              config.bgClassName,
              config.className,
              className
            )}
          >
            <Icon className={cn('w-3.5 h-3.5', config.animate && 'animate-spin')} />
            <span>{config.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{formatLastSync()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
