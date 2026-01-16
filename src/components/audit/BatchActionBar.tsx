import { useState } from 'react';
import { X, Check, Layers, Tag, Building, Power, PowerOff } from 'lucide-react';
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
import type { MacroExtended } from '@/types/lens';
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

interface BatchActionBarProps {
  selectedCount: number;
  totalFiltered: number;
  macros: MacroExtended[];
  categories: string[];
  suppliers: string[];
  onApplyMacro: (macro: string) => void;
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
  macros,
  categories,
  suppliers,
  onApplyMacro,
  onApplyCategory,
  onApplySupplier,
  onActivateAll,
  onDeactivateAll,
  onClearSelection,
  onSelectAll,
}: BatchActionBarProps) => {
  const [confirmAction, setConfirmAction] = useState<{
    type: 'macro' | 'category' | 'supplier' | 'activate' | 'deactivate';
    value?: string;
    label?: string;
  } | null>(null);

  const handleMacroChange = (value: string) => {
    const macro = macros.find(m => m.id === value);
    if (selectedCount > 10) {
      setConfirmAction({ type: 'macro', value, label: macro?.name_client || value });
    } else {
      onApplyMacro(value);
    }
  };

  const handleCategoryChange = (value: string) => {
    if (selectedCount > 10) {
      setConfirmAction({ type: 'category', value, label: value });
    } else {
      onApplyCategory(value);
    }
  };

  const handleSupplierChange = (value: string) => {
    if (selectedCount > 10) {
      setConfirmAction({ type: 'supplier', value, label: value });
    } else {
      onApplySupplier(value);
    }
  };

  const handleActivate = () => {
    if (selectedCount > 10) {
      setConfirmAction({ type: 'activate' });
    } else {
      onActivateAll();
    }
  };

  const handleDeactivate = () => {
    if (selectedCount > 10) {
      setConfirmAction({ type: 'deactivate' });
    } else {
      onDeactivateAll();
    }
  };

  const confirmActionHandler = () => {
    if (!confirmAction) return;
    
    switch (confirmAction.type) {
      case 'macro':
        onApplyMacro(confirmAction.value!);
        break;
      case 'category':
        onApplyCategory(confirmAction.value!);
        break;
      case 'supplier':
        onApplySupplier(confirmAction.value!);
        break;
      case 'activate':
        onActivateAll();
        break;
      case 'deactivate':
        onDeactivateAll();
        break;
    }
    setConfirmAction(null);
  };

  const getConfirmMessage = () => {
    if (!confirmAction) return '';
    
    switch (confirmAction.type) {
      case 'macro':
        return `Alterar macro de ${selectedCount} famílias para "${confirmAction.label}"?`;
      case 'category':
        return `Alterar categoria de ${selectedCount} famílias para "${confirmAction.label}"?`;
      case 'supplier':
        return `Alterar fornecedor de ${selectedCount} famílias para "${confirmAction.label}"?`;
      case 'activate':
        return `Ativar ${selectedCount} famílias?`;
      case 'deactivate':
        return `Desativar ${selectedCount} famílias?`;
      default:
        return '';
    }
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

        {/* Macro Action */}
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-muted-foreground" />
          <Select onValueChange={handleMacroChange}>
            <SelectTrigger className="h-8 w-[140px] text-xs bg-background">
              <SelectValue placeholder="Macro" />
            </SelectTrigger>
            <SelectContent>
              {macros.map((macro) => (
                <SelectItem key={macro.id} value={macro.id} className="text-xs">
                  {macro.name_client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category Action */}
        <div className="flex items-center gap-1.5">
          <Tag className="w-4 h-4 text-muted-foreground" />
          <Select onValueChange={handleCategoryChange}>
            <SelectTrigger className="h-8 w-[130px] text-xs bg-background">
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
          <Select onValueChange={handleSupplierChange}>
            <SelectTrigger className="h-8 w-[120px] text-xs bg-background">
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
            variant="ghost" 
            size="sm" 
            className="h-8 gap-1.5 text-xs text-success hover:text-success hover:bg-success/10"
            onClick={handleActivate}
          >
            <Power className="w-3.5 h-3.5" />
            Ativar
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDeactivate}
          >
            <PowerOff className="w-3.5 h-3.5" />
            Desativar
          </Button>
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
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar ação em lote</AlertDialogTitle>
            <AlertDialogDescription>
              {getConfirmMessage()}
              <br />
              <span className="text-muted-foreground text-sm">
                Esta ação será aplicada a todos os itens selecionados.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmActionHandler}>
              <Check className="w-4 h-4 mr-2" />
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};