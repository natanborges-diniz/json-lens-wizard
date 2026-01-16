import { useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { InlineSelect } from './InlineSelect';
import { InlineToggle } from './InlineToggle';
import { cn } from '@/lib/utils';
import type { FamilyExtended, Price, MacroExtended } from '@/types/lens';

// Tier display mapping
const tierDisplayNames: Record<string, string> = {
  'essential': 'Essencial',
  'comfort': 'Conforto',
  'advanced': 'Avançada',
  'top': 'Top de Mercado',
};

const tierColors: Record<string, { bg: string; text: string; dot: string }> = {
  'essential': { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  'comfort': { bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary' },
  'advanced': { bg: 'bg-info/10', text: 'text-info', dot: 'bg-info' },
  'top': { bg: 'bg-secondary/10', text: 'text-secondary', dot: 'bg-secondary' },
};

const categoryColors: Record<string, string> = {
  'PROGRESSIVA': 'bg-primary/10 text-primary border-primary/30',
  'MONOFOCAL': 'bg-secondary/10 text-secondary border-secondary/30',
};

interface FamilyWithPrices extends FamilyExtended {
  prices: Price[];
  priceCount: number;
  activePriceCount: number;
  minPrice: number;
  maxPrice: number;
  indices: string[];
}

interface FamilyCardProps {
  family: FamilyWithPrices;
  macros: MacroExtended[];
  categories: string[];
  suppliers: string[];
  onMacroChange: (familyId: string, macro: string) => void;
  onCategoryChange: (familyId: string, category: string) => void;
  onSupplierChange: (familyId: string, supplier: string) => void;
  onActiveToggle: (familyId: string) => void;
  onPriceActiveToggle: (erpCode: string) => void;
  isDragging?: boolean;
}

export const FamilyCard = ({
  family,
  macros,
  categories,
  suppliers,
  onMacroChange,
  onCategoryChange,
  onSupplierChange,
  onActiveToggle,
  onPriceActiveToggle,
  isDragging
}: FamilyCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const macroInfo = macros.find(m => m.id === family.macro);
  const tierKey = macroInfo?.tier_key || 'essential';
  const tierColor = tierColors[tierKey];
  
  const macroOptions = macros
    .filter(m => m.category === family.category)
    .map(m => ({
      value: m.id,
      label: m.name_client,
      color: tierColors[m.tier_key || 'essential'].dot
    }));
  
  const categoryOptions = categories.map(c => ({
    value: c,
    label: c
  }));
  
  const supplierOptions = suppliers.map(s => ({
    value: s,
    label: s
  }));
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };
  
  return (
    <div 
      className={cn(
        "border rounded-lg bg-card transition-all duration-200",
        isDragging && "shadow-lg ring-2 ring-primary/30 opacity-90",
        !family.active && "opacity-60"
      )}
    >
      {/* Main Row */}
      <div className="flex items-center gap-3 p-3">
        {/* Drag Handle */}
        <div className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground">
          <GripVertical className="w-4 h-4" />
        </div>
        
        {/* Expand Toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
        
        {/* Family Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{family.name_original}</p>
          <p className="text-xs text-muted-foreground font-mono">{family.id}</p>
        </div>
        
        {/* Editable Fields */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Supplier */}
          <InlineSelect
            value={family.supplier}
            options={supplierOptions}
            onChange={(val) => onSupplierChange(family.id, val)}
            className="text-xs"
          />
          
          {/* Category */}
          <InlineSelect
            value={family.category}
            options={categoryOptions}
            onChange={(val) => onCategoryChange(family.id, val)}
            colorClass={categoryColors[family.category]}
            className="text-xs"
          />
          
          {/* Macro/Tier */}
          <InlineSelect
            value={family.macro}
            options={macroOptions}
            onChange={(val) => onMacroChange(family.id, val)}
            displayLabel={tierDisplayNames[tierKey] || macroInfo?.name_client}
            colorClass={cn(tierColor.bg, tierColor.text)}
          />
        </div>
        
        {/* Price Info */}
        <div className="flex items-center gap-2 text-sm min-w-[120px] justify-end">
          {family.minPrice > 0 ? (
            <div className="flex items-center gap-1 text-muted-foreground">
              <DollarSign className="w-3 h-3" />
              <span className="text-xs">
                {formatCurrency(family.minPrice)}
                {family.maxPrice !== family.minPrice && ` - ${formatCurrency(family.maxPrice)}`}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">Sem preço</span>
          )}
        </div>
        
        {/* SKU Count */}
        <div className="text-center min-w-[60px]">
          <span className="text-sm font-medium">{family.activePriceCount}</span>
          <span className="text-xs text-muted-foreground">/{family.priceCount}</span>
        </div>
        
        {/* Indices */}
        <div className="flex gap-1 min-w-[80px]">
          {family.indices.slice(0, 2).map((idx) => (
            <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0">
              {idx}
            </Badge>
          ))}
          {family.indices.length > 2 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              +{family.indices.length - 2}
            </Badge>
          )}
        </div>
        
        {/* Active Toggle */}
        <InlineToggle 
          active={family.active} 
          onToggle={() => onActiveToggle(family.id)} 
        />
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t bg-muted/30 p-4 space-y-4">
          {/* Attributes */}
          {family.attributes_display_base.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Atributos:</p>
              <div className="flex flex-wrap gap-1">
                {family.attributes_display_base.map((attr, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {attr}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Prices/SKUs */}
          {family.prices.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                SKUs ({family.prices.length}):
              </p>
              <div className="grid gap-1 max-h-[300px] overflow-y-auto">
                {family.prices.map((price) => (
                  <div 
                    key={price.erp_code}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded bg-background border text-sm",
                      (!price.active || price.blocked) && "opacity-50"
                    )}
                  >
                    <code className="text-xs text-muted-foreground font-mono min-w-[100px]">
                      {price.erp_code}
                    </code>
                    <span className="flex-1 truncate text-xs">{price.description}</span>
                    <Badge variant="outline" className="text-[10px]">{price.index}</Badge>
                    <span className="text-xs text-muted-foreground min-w-[80px] text-right">
                      {formatCurrency(price.price_sale_half_pair)}
                    </span>
                    <InlineToggle 
                      active={price.active && !price.blocked}
                      onToggle={() => onPriceActiveToggle(price.erp_code)}
                      size="sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
