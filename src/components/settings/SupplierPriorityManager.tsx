import { useState, useEffect, useMemo } from 'react';
import { GripVertical, ArrowUp, ArrowDown, Package, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLensStore } from '@/store/lensStore';

interface SupplierPriorityManagerProps {
  savedPriorities: string[];
  onChange: (priorities: string[]) => void;
}

export const SupplierPriorityManager = ({ savedPriorities, onChange }: SupplierPriorityManagerProps) => {
  const { families, prices } = useLensStore();

  // Extract unique suppliers from catalog with stats
  const supplierStats = useMemo(() => {
    const stats: Record<string, { familyCount: number; skuCount: number; activeSkuCount: number }> = {};
    
    families.forEach(f => {
      if (!f.supplier) return;
      if (!stats[f.supplier]) {
        stats[f.supplier] = { familyCount: 0, skuCount: 0, activeSkuCount: 0 };
      }
      if (f.active !== false) stats[f.supplier].familyCount++;
    });

    prices.forEach(p => {
      if (!p.supplier) return;
      if (!stats[p.supplier]) {
        stats[p.supplier] = { familyCount: 0, skuCount: 0, activeSkuCount: 0 };
      }
      stats[p.supplier].skuCount++;
      if (p.active && !p.blocked) stats[p.supplier].activeSkuCount++;
    });

    return stats;
  }, [families, prices]);

  const catalogSuppliers = useMemo(() => Object.keys(supplierStats).sort(), [supplierStats]);

  // Merge saved priorities with catalog suppliers
  const [orderedSuppliers, setOrderedSuppliers] = useState<string[]>([]);

  useEffect(() => {
    // Start with saved order, then add any new suppliers from catalog
    const merged: string[] = [];
    
    // Add saved priorities that still exist in catalog
    savedPriorities.forEach(s => {
      if (catalogSuppliers.includes(s) && !merged.includes(s)) {
        merged.push(s);
      }
    });
    
    // Add any new suppliers not in saved list
    catalogSuppliers.forEach(s => {
      if (!merged.includes(s)) {
        merged.push(s);
      }
    });

    setOrderedSuppliers(merged);
  }, [savedPriorities, catalogSuppliers]);

  const moveSupplier = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...orderedSuppliers];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newOrder.length) return;
    
    [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
    setOrderedSuppliers(newOrder);
    onChange(newOrder);
  };

  if (catalogSuppliers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Prioridade de Fornecedores
          </CardTitle>
          <CardDescription>Defina a ordem de preferência dos fornecedores nas recomendações</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground text-sm p-4 bg-muted/30 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            Nenhum fornecedor encontrado no catálogo. Importe um catálogo primeiro.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Prioridade de Fornecedores
        </CardTitle>
        <CardDescription>
          Ordene os fornecedores por preferência. O primeiro da lista recebe prioridade nas recomendações (+10% no score comercial).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {orderedSuppliers.map((supplier, index) => {
            const stats = supplierStats[supplier];
            return (
              <div
                key={supplier}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors group"
              >
                <div className="flex items-center gap-1 text-muted-foreground">
                  <GripVertical className="w-4 h-4" />
                  <span className="text-xs font-mono w-5 text-center">{index + 1}</span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{supplier}</span>
                    {index === 0 && (
                      <Badge variant="default" className="text-[10px] px-1.5 py-0">
                        Preferido
                      </Badge>
                    )}
                  </div>
                  {stats && (
                    <div className="flex gap-3 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        {stats.familyCount} famílias
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {stats.activeSkuCount}/{stats.skuCount} SKUs ativos
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === 0}
                    onClick={() => moveSupplier(index, 'up')}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === orderedSuppliers.length - 1}
                    onClick={() => moveSupplier(index, 'down')}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        
        <p className="text-[11px] text-muted-foreground mt-3">
          Fornecedores com posição mais alta recebem um bônus no score de recomendação. 
          A lista é atualizada automaticamente quando o catálogo muda.
        </p>
      </CardContent>
    </Card>
  );
};
