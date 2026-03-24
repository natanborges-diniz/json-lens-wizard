import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

export interface ProductFilters {
  supplier: string | null;
  clinicalType: string | null;
  tier: string | null;
  indexValue: string | null;
  priceRange: [number, number];
  onlyWithGrade: boolean;
}

interface ProductSearchFiltersProps {
  filters: ProductFilters;
  onFiltersChange: (filters: ProductFilters) => void;
  suppliers: string[];
  clinicalTypes: string[];
  indexes: string[];
  maxPrice: number;
}

export const defaultFilters: ProductFilters = {
  supplier: null,
  clinicalType: null,
  tier: null,
  indexValue: null,
  priceRange: [0, 5000],
  onlyWithGrade: false,
};

export function ProductSearchFilters({
  filters,
  onFiltersChange,
  suppliers,
  clinicalTypes,
  indexes,
  maxPrice,
}: ProductSearchFiltersProps) {
  const activeCount = [
    filters.supplier,
    filters.clinicalType,
    filters.tier,
    filters.indexValue,
    filters.onlyWithGrade ? 'grade' : null,
    filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice ? 'price' : null,
  ].filter(Boolean).length;

  const update = (partial: Partial<ProductFilters>) =>
    onFiltersChange({ ...filters, ...partial });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-xs">{activeCount}</Badge>
          )}
        </div>
        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onFiltersChange({ ...defaultFilters, priceRange: [0, maxPrice] })}
          >
            <X className="h-3 w-3 mr-1" /> Limpar
          </Button>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Fornecedor</Label>
        <Select
          value={filters.supplier || '_all'}
          onValueChange={v => update({ supplier: v === '_all' ? null : v })}
        >
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            {suppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Tipo Clínico</Label>
        <Select
          value={filters.clinicalType || '_all'}
          onValueChange={v => update({ clinicalType: v === '_all' ? null : v })}
        >
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            {clinicalTypes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Tier</Label>
        <Select
          value={filters.tier || '_all'}
          onValueChange={v => update({ tier: v === '_all' ? null : v })}
        >
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            <SelectItem value="essential">Essential</SelectItem>
            <SelectItem value="comfort">Comfort</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
            <SelectItem value="top">Top</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Índice</Label>
        <Select
          value={filters.indexValue || '_all'}
          onValueChange={v => update({ indexValue: v === '_all' ? null : v })}
        >
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Todos</SelectItem>
            {indexes.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label className="text-xs text-muted-foreground uppercase tracking-wide">
          Faixa de Preço (R$ {filters.priceRange[0]} — R$ {filters.priceRange[1]})
        </Label>
        <Slider
          min={0}
          max={maxPrice}
          step={10}
          value={filters.priceRange}
          onValueChange={v => update({ priceRange: v as [number, number] })}
          className="mt-2"
        />
      </div>

      <Separator />

      <div className="flex items-center gap-2">
        <Checkbox
          id="onlyWithGrade"
          checked={filters.onlyWithGrade}
          onCheckedChange={v => update({ onlyWithGrade: !!v })}
        />
        <Label htmlFor="onlyWithGrade" className="text-sm cursor-pointer">
          Apenas com grade técnica
        </Label>
      </div>
    </div>
  );
}
