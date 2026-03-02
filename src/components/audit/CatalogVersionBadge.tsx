import { useState, useEffect } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Clock, 
  Database, 
  User, 
  FileText, 
  ChevronDown,
  History,
  Package,
  DollarSign,
  Cpu,
  Settings2
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';

export interface CatalogVersion {
  id: string;
  version_number: string;
  schema_version: string;
  dataset_name: string | null;
  import_mode: 'increment' | 'replace';
  imported_by: string | null;
  imported_at: string;
  families_count: number;
  prices_count: number;
  addons_count: number;
  technologies_count: number;
  changes_summary: Record<string, any> | null;
  notes: string[] | null;
  file_size_bytes: number | null;
}

interface CatalogVersionBadgeProps {
  onViewHistory?: () => void;
  className?: string;
}

export function CatalogVersionBadge({ onViewHistory, className = '' }: CatalogVersionBadgeProps) {
  const [currentVersion, setCurrentVersion] = useState<CatalogVersion | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadCurrentVersion();
  }, []);

  const loadCurrentVersion = async () => {
    try {
      const { data, error } = await supabase
        .from('catalog_versions')
        .select('*')
        .order('imported_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // No versions yet - that's ok
        console.log('No catalog versions found:', error.message);
        setCurrentVersion(null);
      } else {
        setCurrentVersion(data as CatalogVersion);
      }
    } catch (e) {
      console.error('Error loading version:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Badge variant="outline" className={`animate-pulse ${className}`}>
        <Clock className="w-3 h-3 mr-1" />
        Carregando...
      </Badge>
    );
  }

  if (!currentVersion) {
    return (
      <Badge variant="outline" className={`text-muted-foreground ${className}`}>
        <Database className="w-3 h-3 mr-1" />
        Sem versão registrada
      </Badge>
    );
  }

  const importedDate = new Date(currentVersion.imported_at);
  const relativeTime = formatDistanceToNow(importedDate, { 
    addSuffix: true, 
    locale: ptBR 
  });
  const fullDate = format(importedDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={`gap-2 font-medium ${className}`}
        >
          <Database className="w-4 h-4 text-primary" />
          <span>v{currentVersion.version_number}</span>
          <span className="text-muted-foreground text-xs">•</span>
          <span className="text-muted-foreground text-xs">{relativeTime}</span>
          <ChevronDown className="w-3 h-3 ml-1 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-foreground">Versão do Catálogo</h4>
              <p className="text-sm text-muted-foreground">
                {currentVersion.dataset_name || 'Catálogo Principal'}
              </p>
            </div>
            <Badge variant={currentVersion.import_mode === 'replace' ? 'destructive' : 'secondary'}>
              {currentVersion.import_mode === 'replace' ? 'Substituição' : 'Incremento'}
            </Badge>
          </div>

          <Separator />

          {/* Version Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <FileText className="w-4 h-4" />
                Versão
              </span>
              <span className="font-mono font-medium">v{currentVersion.version_number}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Database className="w-4 h-4" />
                Schema
              </span>
              <span className="font-mono">{currentVersion.schema_version}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                Atualizado
              </span>
              <span title={fullDate}>{fullDate}</span>
            </div>
          </div>

          <Separator />

          {/* Counts */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 text-sm">
              <Package className="w-4 h-4 text-primary" />
              <span>{currentVersion.families_count} famílias</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span>{currentVersion.prices_count} SKUs</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Settings2 className="w-4 h-4 text-orange-500" />
              <span>{currentVersion.addons_count} add-ons</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Cpu className="w-4 h-4 text-blue-500" />
              <span>{currentVersion.technologies_count} techs</span>
            </div>
          </div>

          {/* Notes */}
          {currentVersion.notes && currentVersion.notes.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wide">Notas</span>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {currentVersion.notes.slice(0, 3).map((note, i) => (
                    <li key={i} className="truncate">• {note}</li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Actions */}
          {onViewHistory && (
            <>
              <Separator />
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full gap-2"
                onClick={onViewHistory}
              >
                <History className="w-4 h-4" />
                Ver Histórico Completo
              </Button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Hook to save a new catalog version
export async function saveCatalogVersion(params: {
  schemaVersion: string;
  datasetName?: string;
  importMode: string;
  familiesCount: number;
  pricesCount: number;
  addonsCount: number;
  technologiesCount: number;
  changesSummary?: Record<string, any>;
  notes?: string[];
  fileSizeBytes?: number;
}): Promise<CatalogVersion | null> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('User not authenticated');
      return null;
    }

    // Get the last version number to increment
    const { data: lastVersion } = await supabase
      .from('catalog_versions')
      .select('version_number')
      .order('imported_at', { ascending: false })
      .limit(1)
      .single();

    // Generate new version number
    let newVersionNumber = '1.0.0';
    if (lastVersion?.version_number) {
      const parts = lastVersion.version_number.split('.').map(Number);
      if (params.importMode === 'replace') {
        // Major version bump for replace
        newVersionNumber = `${parts[0] + 1}.0.0`;
      } else {
        // Minor version bump for increment
        newVersionNumber = `${parts[0]}.${(parts[1] || 0) + 1}.0`;
      }
    }

    // Insert new version
    const { data, error } = await supabase
      .from('catalog_versions')
      .insert({
        version_number: newVersionNumber,
        schema_version: params.schemaVersion,
        dataset_name: params.datasetName || null,
        import_mode: params.importMode,
        imported_by: user.id,
        families_count: params.familiesCount,
        prices_count: params.pricesCount,
        addons_count: params.addonsCount,
        technologies_count: params.technologiesCount,
        changes_summary: params.changesSummary || null,
        notes: params.notes || null,
        file_size_bytes: params.fileSizeBytes || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving catalog version:', error);
      return null;
    }

    console.log('[CatalogVersion] Saved new version:', newVersionNumber);
    return data as CatalogVersion;
  } catch (e) {
    console.error('Error saving catalog version:', e);
    return null;
  }
}
