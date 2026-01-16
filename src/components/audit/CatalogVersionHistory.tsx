import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  History, 
  ArrowUpCircle,
  ArrowDownCircle,
  Package,
  DollarSign,
  Loader2,
  FileText,
  User,
  Clock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import type { CatalogVersion } from './CatalogVersionBadge';

interface CatalogVersionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CatalogVersionHistory({ open, onOpenChange }: CatalogVersionHistoryProps) {
  const [versions, setVersions] = useState<CatalogVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open) {
      loadVersionHistory();
    }
  }, [open]);

  const loadVersionHistory = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('catalog_versions')
        .select('*')
        .order('imported_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading version history:', error);
        setVersions([]);
      } else {
        setVersions(data as CatalogVersion[]);
      }
    } catch (e) {
      console.error('Error:', e);
      setVersions([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Histórico de Versões do Catálogo
          </DialogTitle>
          <DialogDescription>
            Registro de todas as importações e atualizações do catálogo
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma versão registrada ainda</p>
            <p className="text-sm">As próximas importações serão registradas aqui</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {versions.map((version, index) => (
                <div 
                  key={version.id}
                  className={`relative pl-6 pb-4 ${index !== versions.length - 1 ? 'border-l-2 border-border ml-2' : 'ml-2'}`}
                >
                  {/* Timeline dot */}
                  <div className={`absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full border-2 ${
                    index === 0 
                      ? 'bg-primary border-primary' 
                      : 'bg-background border-muted-foreground'
                  }`} />

                  <div className="bg-muted/30 rounded-lg p-4 ml-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-foreground">
                            v{version.version_number}
                          </span>
                          <Badge 
                            variant={version.import_mode === 'replace' ? 'destructive' : 'secondary'}
                            className="text-xs"
                          >
                            {version.import_mode === 'replace' ? (
                              <>
                                <ArrowUpCircle className="w-3 h-3 mr-1" />
                                Substituição
                              </>
                            ) : (
                              <>
                                <ArrowDownCircle className="w-3 h-3 mr-1" />
                                Incremento
                              </>
                            )}
                          </Badge>
                          {index === 0 && (
                            <Badge variant="default" className="text-xs">
                              Atual
                            </Badge>
                          )}
                        </div>
                        {version.dataset_name && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {version.dataset_name}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(version.imported_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-3 text-sm">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-blue-500" />
                        <span>{version.families_count} fam.</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        <span>{version.prices_count} SKUs</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-orange-500" />
                        <span>{version.addons_count} add-ons</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">Schema: {version.schema_version}</span>
                      </div>
                    </div>

                    {/* Notes */}
                    {version.notes && version.notes.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <ul className="text-sm text-muted-foreground space-y-1">
                          {version.notes.map((note, i) => (
                            <li key={i}>• {note}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* File size */}
                    {version.file_size_bytes && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Tamanho: {(version.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
