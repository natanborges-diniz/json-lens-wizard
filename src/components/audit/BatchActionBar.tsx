import { useState } from 'react';
import { X, Check, Layers, Tag, Building, Power, PowerOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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

// Tier options (instead of individual macros)
const tierOptions = [
  { value: 'essential', label: 'Essencial' },
  { value: 'comfort', label: 'Conforto' },
  { value: 'advanced', label: 'Avançado' },
  { value: 'top', label: 'Premium' },
];

interface PendingBatchChanges {
  tier?: string;
  category?: string;
  supplier?: string;
  active?: boolean;
}

interface BatchActionBarProps {
  selectedCount: number;
  totalFiltered: number;
  categories: string[];
  suppliers: string[];
  onApplyTier: (tier: string) => void;
  onApplyCategory: (category: string) => void;
  onApplySupplier: (supplier: string) => void;
  onActivateAll: () => void;
  onDeactivateAll: () => void;
  onClearSelection: () => void;
  onSelectAll: () => void;
}

export const BatchActionBar = ({
  selectedCount,
  totalFiltered,
  categories,
  suppliers,
  onApplyTier,
  onApplyCategory,
  onApplySupplier,
  onActivateAll,
  onDeactivateAll,
  onClearSelection,
  onSelectAll,
}: BatchActionBarProps) => {
  const [pendingChanges, setPendingChanges] = useState<PendingBatchChanges>({});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const hasChanges = Object.keys(pendingChanges).length > 0;

  const handleTierChange = (value: string) => {
    setPendingChanges(prev => ({ ...prev, tier: value }));
  };

  const handleCategoryChange = (value: string) => {
    setPendingChanges(prev => ({ ...prev, category: value }));
  };

  const handleSupplierChange = (value: string) => {
    setPendingChanges(prev => ({ ...prev, supplier: value }));
  };

  const handleActivate = () => {
    setPendingChanges(prev => ({ ...prev, active: true }));
  };

  const handleDeactivate = () => {
    setPendingChanges(prev => ({ ...prev, active: false }));
  };

  const clearPendingChanges = () => {
    setPendingChanges({});
  };

  const applyAllChanges = () => {
    if (pendingChanges.tier) {
      onApplyTier(pendingChanges.tier);
    }
    if (pendingChanges.category) {
      onApplyCategory(pendingChanges.category);
    }
    if (pendingChanges.supplier) {
      onApplySupplier(pendingChanges.supplier);
    }
    if (pendingChanges.active === true) {
      onActivateAll();
    } else if (pendingChanges.active === false) {
      onDeactivateAll();
    }
    setPendingChanges({});
    setShowConfirmDialog(false);
  };

  const handleApplyClick = () => {
    if (selectedCount > 10 || Object.keys(pendingChanges).length > 1) {
      setShowConfirmDialog(true);
    } else {
      applyAllChanges();
    }
  };

  const getChangeSummary = () => {
    const changes: string[] = [];
    if (pendingChanges.tier) {
      const tierLabel = tierOptions.find(t => t.value === pendingChanges.tier)?.label;
      changes.push(`Tier: ${tierLabel}`);
    }
    if (pendingChanges.category) {
      changes.push(`Categoria: ${pendingChanges.category}`);
    }
    if (pendingChanges.supplier) {
      changes.push(`Fornecedor: ${pendingChanges.supplier}`);
    }
    if (pendingChanges.active === true) {
      changes.push('Ativar');
    } else if (pendingChanges.active === false) {
      changes.push('Desativar');
    }
    return changes;
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className={cn(
        "fixed bottom-4 left-1/2 -translate-x-1/2 z-50",
        "bg-card border border-border shadow-xl rounded-xl px-4 py-3",
        "flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-200"
      )}>
        {/* Selection Count */}
        <div className="flex items-center gap-2 pr-3 border-r border-border">
          <Badge variant="default" className="text-sm font-medium">
            {selectedCount}
          </Badge>
          <span className="text-sm text-muted-foreground">selecionadas</span>
          {selectedCount < totalFiltered && (
            <Button 
              variant="link" 
              size="sm" 
              className="text-xs h-auto p-0"
              onClick={onSelectAll}
            >
              Selecionar todas ({totalFiltered})
            </Button>
          )}
        </div>

        {/* Tier Action */}
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <Select 
            value={pendingChanges.tier || ''} 
            onValueChange={handleTierChange}
          >
            <SelectTrigger className={cn(
              "h-8 w-[120px] text-xs bg-background",
              pendingChanges.tier && "ring-2 ring-primary border-primary"
            )}>
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              {tierOptions.map((tier) => (
                <SelectItem key={tier.value} value={tier.value} className="text-xs">
                  {tier.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category Action */}
        <div className="flex items-center gap-1.5">
          <Tag className="w-4 h-4 text-muted-foreground" />
          <Select 
            value={pendingChanges.category || ''} 
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger className={cn(
              "h-8 w-[130px] text-xs bg-background",
              pendingChanges.category && "ring-2 ring-primary border-primary"
            )}>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat} className="text-xs">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Supplier Action */}
        <div className="flex items-center gap-1.5">
          <Building className="w-4 h-4 text-muted-foreground" />
          <Select 
            value={pendingChanges.supplier || ''} 
            onValueChange={handleSupplierChange}
          >
            <SelectTrigger className={cn(
              "h-8 w-[120px] text-xs bg-background",
              pendingChanges.supplier && "ring-2 ring-primary border-primary"
            )}>
              <SelectValue placeholder="Fornecedor" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((sup) => (
                <SelectItem key={sup} value={sup} className="text-xs">
                  {sup}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Actions */}
        <div className="flex items-center gap-1 pl-2 border-l border-border">
          <Button 
            variant={pendingChanges.active === true ? "default" : "ghost"}
            size="sm" 
            className={cn(
              "h-8 gap-1.5 text-xs",
              pendingChanges.active === true 
                ? "bg-success text-success-foreground hover:bg-success/90" 
                : "text-success hover:text-success hover:bg-success/10"
            )}
            onClick={handleActivate}
          >
            <Power className="w-3.5 h-3.5" />
            Ativar
          </Button>
          <Button 
            variant={pendingChanges.active === false ? "default" : "ghost"}
            size="sm" 
            className={cn(
              "h-8 gap-1.5 text-xs",
              pendingChanges.active === false 
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                : "text-destructive hover:text-destructive hover:bg-destructive/10"
            )}
            onClick={handleDeactivate}
          >
            <PowerOff className="w-3.5 h-3.5" />
            Desativar
          </Button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 pl-2 border-l border-border">
          {hasChanges && (
            <>
              <Button 
                variant="ghost" 
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={clearPendingChanges}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpar
              </Button>
              <Button 
                variant="default" 
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleApplyClick}
              >
                <Check className="w-3.5 h-3.5" />
                Aplicar ({getChangeSummary().length})
              </Button>
            </>
          )}
        </div>

        {/* Clear Selection */}
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 shrink-0"
          onClick={onClearSelection}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alterações em lote</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-3">
                  Aplicar as seguintes alterações a <strong>{selectedCount} famílias</strong>?
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {getChangeSummary().map((change, i) => (
                    <li key={i}>{change}</li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={applyAllChanges}>
              <Check className="w-4 h-4 mr-2" />
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};