import { useState } from 'react';
import { Plus, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MacroExtended, FamilyExtended } from '@/types/lens';
import { toast } from 'sonner';

interface AddFamilyDialogProps {
  macros: MacroExtended[];
  categories: string[];
  suppliers: string[];
  onAddFamily: (family: FamilyExtended) => void;
}

export const AddFamilyDialog = ({
  macros,
  categories,
  suppliers,
  onAddFamily
}: AddFamilyDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [category, setCategory] = useState<'PROGRESSIVA' | 'MONOFOCAL'>('PROGRESSIVA');
  const [macro, setMacro] = useState('');

  const availableMacros = macros.filter(m => m.category === category);

  const generateId = (familyName: string, supplierName: string) => {
    const cleanName = familyName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_');
    const cleanSupplier = supplierName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_');
    return `${cleanSupplier}_${cleanName}`;
  };

  const handleNameChange = (value: string) => {
    setName(value);
    const effectiveSupplier = supplier === '__new__' ? newSupplier : supplier;
    if (effectiveSupplier) {
      setId(generateId(value, effectiveSupplier));
    }
  };

  const handleSupplierChange = (value: string) => {
    setSupplier(value);
    if (value !== '__new__' && name) {
      setId(generateId(name, value));
    }
  };

  const handleNewSupplierChange = (value: string) => {
    setNewSupplier(value);
    if (name) {
      setId(generateId(name, value));
    }
  };

  const handleCategoryChange = (value: 'PROGRESSIVA' | 'MONOFOCAL') => {
    setCategory(value);
    setMacro(''); // Reset macro when category changes
  };

  const handleSubmit = () => {
    const effectiveSupplier = supplier === '__new__' ? newSupplier : supplier;
    
    if (!name.trim()) {
      toast.error('Nome da família é obrigatório');
      return;
    }
    if (!effectiveSupplier.trim()) {
      toast.error('Fornecedor é obrigatório');
      return;
    }
    if (!macro) {
      toast.error('Macro/Tier é obrigatório');
      return;
    }

    const newFamily: FamilyExtended = {
      id: id || generateId(name, effectiveSupplier),
      name_original: name.trim(),
      supplier: effectiveSupplier.trim(),
      category: category,
      macro: macro,
      attributes_base: {},
      attributes_display_base: [],
      active: true,
      technology_refs: []
    };

    onAddFamily(newFamily);
    
    // Reset form
    setName('');
    setId('');
    setSupplier('');
    setNewSupplier('');
    setCategory('PROGRESSIVA');
    setMacro('');
    setOpen(false);
    
    toast.success(`Família "${name}" adicionada com sucesso!`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" />
          Nova Família
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Adicionar Nova Família de Lentes
          </DialogTitle>
          <DialogDescription>
            Preencha os dados da nova família. Os preços podem ser adicionados posteriormente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome da Família *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ex: Varilux Comfort Max"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="supplier">Fornecedor *</Label>
              <Select value={supplier} onValueChange={handleSupplierChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                  <SelectItem value="__new__">+ Novo fornecedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {supplier === '__new__' && (
              <div className="grid gap-2">
                <Label htmlFor="newSupplier">Novo Fornecedor *</Label>
                <Input
                  id="newSupplier"
                  value={newSupplier}
                  onChange={(e) => handleNewSupplierChange(e.target.value)}
                  placeholder="Nome do fornecedor"
                />
              </div>
            )}
            
            {supplier !== '__new__' && (
              <div className="grid gap-2">
                <Label htmlFor="category">Categoria *</Label>
                <Select value={category} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PROGRESSIVA">Progressiva</SelectItem>
                    <SelectItem value="MONOFOCAL">Monofocal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          {supplier === '__new__' && (
            <div className="grid gap-2">
              <Label htmlFor="category">Categoria *</Label>
              <Select value={category} onValueChange={handleCategoryChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROGRESSIVA">Progressiva</SelectItem>
                  <SelectItem value="MONOFOCAL">Monofocal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          
          <div className="grid gap-2">
            <Label htmlFor="macro">Tier/Macro *</Label>
            <Select value={macro} onValueChange={setMacro}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tier" />
              </SelectTrigger>
              <SelectContent>
                {availableMacros.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name_client}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="id">ID (gerado automaticamente)</Label>
            <Input
              id="id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="ID único da família"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              O ID é gerado automaticamente, mas você pode editá-lo se necessário.
            </p>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Família
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
