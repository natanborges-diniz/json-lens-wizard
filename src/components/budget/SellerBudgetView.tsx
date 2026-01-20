import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Barcode, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useState } from 'react';
import type { BudgetDocumentData } from './BudgetDocument';

interface SellerBudgetViewProps {
  data: BudgetDocumentData;
  erpCode?: string;
}

/**
 * Component that displays ERP-specific information for the seller
 * This information should NOT be shown to the client
 */
export function SellerBudgetView({ data, erpCode }: SellerBudgetViewProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyErpCode = () => {
    if (!erpCode) return;
    navigator.clipboard.writeText(erpCode);
    setCopied(true);
    toast.success('Código ERP copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!erpCode) return null;

  return (
    <Card className="border-dashed border-warning/50 bg-warning/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-warning">
          <Barcode className="w-4 h-4" />
          Dados para ERP (Uso Interno)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between bg-background/50 rounded-lg p-3 border">
          <div>
            <p className="text-xs text-muted-foreground">Código ERP</p>
            <p className="font-mono font-semibold text-lg">{erpCode}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyErpCode}
            className="gap-1.5"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-success" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copiar
              </>
            )}
          </Button>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Família:</span>
            <p className="font-medium">{data.familyName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Fornecedor:</span>
            <p className="font-medium">{data.supplier}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Índice:</span>
            <p className="font-medium">{data.selectedIndex}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Categoria:</span>
            <Badge variant="secondary" className="text-[10px]">
              {data.lensCategory === 'PROGRESSIVA' ? 'Progressiva' : 'Monofocal'}
            </Badge>
          </div>
        </div>

        <div className="text-[10px] text-muted-foreground italic pt-2 border-t">
          ⚠️ Estas informações são apenas para uso interno e não aparecem no orçamento do cliente.
        </div>
      </CardContent>
    </Card>
  );
}
