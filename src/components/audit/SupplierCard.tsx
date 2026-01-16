import { useState, useMemo } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Edit2,
  Building,
  AlertTriangle,
  Package,
  DollarSign
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';
import type { FamilyExtended, Price } from '@/types/lens';

interface SupplierCardProps {
  supplier: string;
  families: FamilyExtended[];
  prices: Price[];
  onRename?: (oldName: string, newName: string, affectedFamilies: FamilyExtended[], affectedPrices: Price[]) => void;
}

export const SupplierCard = ({ 
  supplier, 
  families,
  prices,
  onRename 
}: SupplierCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [newName, setNewName] = useState(supplier);

  // Get families and prices for this supplier
  const supplierFamilies = useMemo(() => 
    families.filter(f => f.supplier === supplier),
    [families, supplier]
  );
  
  const supplierPrices = useMemo(() => 
    prices.filter(p => p.supplier === supplier),
    [prices, supplier]
  );

  const activeFamilies = supplierFamilies.filter(f => f.active);
  const activePrices = supplierPrices.filter(p => p.active && !p.blocked);
  const categories = [...new Set(supplierFamilies.map(f => f.category))];

  // Calculate price range
  const priceStats = useMemo(() => {
    const salePrices = supplierPrices
      .filter(p => p.price_sale_half_pair > 0)
      .map(p => p.price_sale_half_pair);
    
    if (salePrices.length === 0) return { min: 0, max: 0 };
    
    return {
      min: Math.min(...salePrices),
      max: Math.max(...salePrices),
    };
  }, [supplierPrices]);

  const formatCurrency = (value: number) => {
    if (value === 0) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleSaveClick = () => {
    if (newName.trim() === '' || newName === supplier) {
      setIsEditing(false);
      setNewName(supplier);
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleConfirmRename = () => {
    if (onRename) {
      onRename(supplier, newName.trim(), supplierFamilies, supplierPrices);
    }
    setShowConfirmDialog(false);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setNewName(supplier);
    setIsEditing(false);
  };

  return (
    <>
      <Card className={cn(
        "border transition-all duration-200",
        isExpanded && "ring-1 ring-primary/20"
      )}>
        <div 
          className="flex items-center gap-3 p-4 cursor-pointer"
          onClick={() => !isEditing && setIsExpanded(!isExpanded)}
        >
          {/* Icon */}
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Building className="w-5 h-5 text-primary" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">
              {supplier}
            </p>
            <div className="flex gap-1 mt-1">
              {categories.map(c => (
                <Badge key={c} variant="secondary" className="text-[10px]">
                  {c}
                </Badge>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] gap-1">
                <Package className="w-3 h-3" />
                {activeFamilies.length}/{supplierFamilies.length}
              </Badge>
              <Badge variant="outline" className="text-[10px] gap-1">
                <DollarSign className="w-3 h-3" />
                {activePrices.length}/{supplierPrices.length}
              </Badge>
            </div>
            {priceStats.min > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {formatCurrency(priceStats.min)} - {formatCurrency(priceStats.max)}
              </span>
            )}
          </div>

          {/* Expand Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <CardContent className="pt-0 pb-4 px-4 border-t bg-muted/20">
            <div className="space-y-4 pt-4">
              {isEditing ? (
                // Edit Mode
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Nome do Fornecedor
                    </label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value.toUpperCase())}
                      className="h-8 text-sm uppercase"
                      placeholder="Nome do fornecedor"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={handleSaveClick} className="text-xs">
                      Salvar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleCancelEdit}
                      className="text-xs"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                // View Mode
                <>
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">Famílias</p>
                      <p className="font-medium">{activeFamilies.length} ativas</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">SKUs</p>
                      <p className="font-medium">{activePrices.length} ativos</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">Preço Mín</p>
                      <p className="font-medium">{formatCurrency(priceStats.min)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">Preço Máx</p>
                      <p className="font-medium">{formatCurrency(priceStats.max)}</p>
                    </div>
                  </div>

                  {/* Families list */}
                  {supplierFamilies.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Famílias ({supplierFamilies.length}):
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {supplierFamilies.map((family) => (
                          <Badge 
                            key={family.id} 
                            variant={family.active ? "secondary" : "outline"}
                            className={cn("text-xs", !family.active && "opacity-50")}
                          >
                            {family.name_original}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Edit Button */}
                  {onRename && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setIsEditing(true)}
                      className="text-xs gap-1.5"
                    >
                      <Edit2 className="w-3 h-3" />
                      Renomear
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Confirmar Renomeação
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Você está prestes a renomear o fornecedor:
                </p>
                
                <div className="bg-muted rounded-lg p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">{supplier}</span>
                    {' → '}
                    <span className="text-primary font-medium">{newName}</span>
                  </p>
                </div>

                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-warning">
                    Esta alteração afetará:
                  </p>
                  <ul className="text-sm space-y-1">
                    <li className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      <span>{supplierFamilies.length} família(s)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      <span>{supplierPrices.length} SKU(s)/preço(s)</span>
                    </li>
                  </ul>
                  
                  {supplierFamilies.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 max-h-20 overflow-y-auto">
                      {supplierFamilies.slice(0, 8).map(f => (
                        <Badge key={f.id} variant="outline" className="text-xs">
                          {f.name_original}
                        </Badge>
                      ))}
                      {supplierFamilies.length > 8 && (
                        <Badge variant="outline" className="text-xs">
                          +{supplierFamilies.length - 8} mais
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setNewName(supplier)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRename}>
              Confirmar Renomeação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
