import { useState } from 'react';
import { Cloud, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLensStore } from '@/store/lensStore';
import { toast } from 'sonner';

interface CloudSaveConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveComplete?: () => void;
  importSummary?: {
    familiesCount: number;
    pricesCount: number;
    mode: string;
  };
}

export function CloudSaveConfirmDialog({
  open,
  onOpenChange,
  onSaveComplete,
  importSummary,
}: CloudSaveConfirmDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'success' | 'error' | null>(null);
  
  const { saveCatalogToCloud } = useLensStore();

  const handleSaveToCloud = async () => {
    setIsSaving(true);
    setSaveResult(null);
    
    try {
      const success = await saveCatalogToCloud();
      
      if (success) {
        setSaveResult('success');
        toast.success('Catálogo salvo na nuvem com sucesso!');
        
        // Close after short delay to show success state
        setTimeout(() => {
          onOpenChange(false);
          onSaveComplete?.();
          setSaveResult(null);
        }, 1500);
      } else {
        setSaveResult('error');
        toast.error('Erro ao salvar na nuvem. Tente novamente.');
      }
    } catch (error) {
      console.error('Cloud save error:', error);
      setSaveResult('error');
      toast.error('Erro ao salvar na nuvem');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    toast.warning('Catálogo importado localmente, mas NÃO foi salvo na nuvem. As alterações podem ser perdidas.');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary" />
            Salvar na Nuvem
          </DialogTitle>
          <DialogDescription>
            O catálogo foi importado com sucesso. Deseja salvar na nuvem para que fique disponível em todos os dispositivos?
          </DialogDescription>
        </DialogHeader>

        {importSummary && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Resumo da Importação:</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Famílias:</span>
                <span className="font-medium">{importSummary.familiesCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SKUs:</span>
                <span className="font-medium">{importSummary.pricesCount}</span>
              </div>
              <div className="flex justify-between col-span-2">
                <span className="text-muted-foreground">Modo:</span>
                <span className="font-medium capitalize">{importSummary.mode}</span>
              </div>
            </div>
          </div>
        )}

        {saveResult === 'success' && (
          <div className="flex items-center gap-2 p-3 bg-success/10 text-success rounded-lg">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">Salvo com sucesso!</span>
          </div>
        )}

        {saveResult === 'error' && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Erro ao salvar. Tente novamente.</span>
          </div>
        )}

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isSaving}
            className="flex-1"
          >
            Não Salvar
          </Button>
          <Button
            onClick={handleSaveToCloud}
            disabled={isSaving || saveResult === 'success'}
            className="flex-1"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : saveResult === 'success' ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Salvo!
              </>
            ) : (
              <>
                <Cloud className="w-4 h-4 mr-2" />
                Salvar na Nuvem
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
