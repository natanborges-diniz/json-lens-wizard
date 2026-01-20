import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  RotateCcw, 
  Trash2,
  History,
  Loader2,
  AlertTriangle,
  Package,
  DollarSign,
  FileText,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CatalogVersion } from './CatalogVersionBadge';
import type { LensData } from '@/types/lens';

interface CatalogRestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (data: LensData) => void;
  onReset: () => void;
}

export function CatalogRestoreDialog({ 
  open, 
  onOpenChange,
  onRestore,
  onReset
}: CatalogRestoreDialogProps) {
  const [versions, setVersions] = useState<CatalogVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

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

  const handleRestoreVersion = async () => {
    if (!selectedVersion) return;

    setIsRestoring(true);
    try {
      // Find the selected version
      const version = versions.find(v => v.id === selectedVersion);
      if (!version) {
        toast.error('Versão não encontrada');
        return;
      }

      // Try to load the catalog snapshot from storage if available
      // Otherwise, load the original catalog file and apply minimal restore
      const { data: catalogData, error: downloadError } = await supabase.storage
        .from('catalogs')
        .download(`catalog-v${version.version_number}.json`);

      let restoredData: LensData;

      if (catalogData) {
        // Load from version snapshot
        const arrayBuffer = await catalogData.arrayBuffer();
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(arrayBuffer);
        restoredData = JSON.parse(text);
      } else {
        // Fallback: Load original catalog and reset inactive states
        const { data: currentCatalog, error: currentError } = await supabase.storage
          .from('catalogs')
          .download('catalog-default.json');

        if (currentError || !currentCatalog) {
          // Final fallback: Load from local file
          const response = await fetch('/data/lenses.json');
          const arrayBuffer = await response.arrayBuffer();
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(arrayBuffer);
          restoredData = JSON.parse(text);
        } else {
          const arrayBuffer = await currentCatalog.arrayBuffer();
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(arrayBuffer);
          restoredData = JSON.parse(text);
        }
      }

      onRestore(restoredData);
      toast.success(`Catálogo restaurado para v${version.version_number}`);
      onOpenChange(false);
    } catch (error) {
      console.error('Error restoring version:', error);
      toast.error('Erro ao restaurar versão');
    } finally {
      setIsRestoring(false);
      setShowRestoreConfirm(false);
    }
  };

  const handleResetToZero = async () => {
    setIsRestoring(true);
    try {
      // Load original catalog from local file (the source of truth)
      const response = await fetch('/data/lenses.json');
      const arrayBuffer = await response.arrayBuffer();
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(arrayBuffer);
      const originalData: LensData = JSON.parse(text);

      // Reset all active states to true (original state)
      const resetData: LensData = {
        ...originalData,
        families: originalData.families.map(f => ({ ...f, active: true })),
        addons: originalData.addons.map(a => ({ ...a, active: true })),
        prices: originalData.prices.map(p => ({ ...p, active: true, blocked: false })),
      };

      onReset();
      onRestore(resetData);
      toast.success('Catálogo resetado para estado inicial');
      onOpenChange(false);
    } catch (error) {
      console.error('Error resetting catalog:', error);
      toast.error('Erro ao resetar catálogo');
    } finally {
      setIsRestoring(false);
      setShowResetConfirm(false);
    }
  };

  const selectedVersionData = selectedVersion 
    ? versions.find(v => v.id === selectedVersion) 
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-primary" />
              Restaurar Catálogo
            </DialogTitle>
            <DialogDescription>
              Restaure o catálogo para uma versão anterior ou resete para o estado inicial
            </DialogDescription>
          </DialogHeader>

          {/* Reset to Zero Option */}
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">Resetar para Zero</h4>
                  <p className="text-sm text-muted-foreground">
                    Restaura o catálogo original com todas as famílias, SKUs e add-ons ativos
                  </p>
                </div>
              </div>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                disabled={isRestoring}
              >
                {isRestoring ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-1" />
                    Resetar
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Version History */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <History className="w-4 h-4" />
              Restaurar Versão Anterior
            </h4>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : versions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p>Nenhuma versão anterior disponível</p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <RadioGroup 
                  value={selectedVersion || ''} 
                  onValueChange={setSelectedVersion}
                  className="space-y-2"
                >
                  {versions.map((version, index) => (
                    <div 
                      key={version.id}
                      className={`relative flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        selectedVersion === version.id 
                          ? 'bg-primary/5 border-primary' 
                          : 'bg-muted/30 border-transparent hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedVersion(version.id)}
                    >
                      <RadioGroupItem value={version.id} id={version.id} className="mt-1" />
                      <Label htmlFor={version.id} className="flex-1 cursor-pointer">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold">
                              v{version.version_number}
                            </span>
                            <Badge 
                              variant={version.import_mode === 'replace' ? 'destructive' : 'secondary'}
                              className="text-[10px]"
                            >
                              {version.import_mode === 'replace' ? 'Substituição' : 'Incremento'}
                            </Badge>
                            {index === 0 && (
                              <Badge variant="default" className="text-[10px]">
                                Atual
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(version.imported_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {version.families_count} famílias
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {version.prices_count} SKUs
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            {version.addons_count} add-ons
                          </span>
                        </div>
                        {version.dataset_name && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {version.dataset_name}
                          </p>
                        )}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </ScrollArea>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => setShowRestoreConfirm(true)}
              disabled={!selectedVersion || isRestoring}
            >
              {isRestoring ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RotateCcw className="w-4 h-4 mr-2" />
              )}
              Restaurar Versão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Reset Completo
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Esta ação irá:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Restaurar o catálogo original do arquivo fonte</li>
                <li>Ativar todas as famílias, SKUs e add-ons</li>
                <li>Remover todas as customizações de status inativo</li>
                <li>Sobrescrever o catálogo atual na nuvem</li>
              </ul>
              <p className="font-medium text-foreground pt-2">
                Esta ação não pode ser desfeita. Deseja continuar?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResetToZero}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRestoring ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Sim, Resetar Tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation */}
      <AlertDialog open={showRestoreConfirm} onOpenChange={setShowRestoreConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-primary" />
              Confirmar Restauração
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {selectedVersionData && (
                <>
                  <p>Você está prestes a restaurar o catálogo para:</p>
                  <div className="bg-muted/50 rounded-lg p-3 mt-2">
                    <div className="flex items-center gap-2 font-semibold">
                      <span className="font-mono">v{selectedVersionData.version_number}</span>
                      <Badge variant="secondary" className="text-xs">
                        {format(new Date(selectedVersionData.imported_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedVersionData.families_count} famílias • {selectedVersionData.prices_count} SKUs
                    </p>
                  </div>
                  <p className="text-sm pt-2">
                    Esta ação substituirá o catálogo atual. Deseja continuar?
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreVersion}>
              {isRestoring ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Confirmar Restauração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
