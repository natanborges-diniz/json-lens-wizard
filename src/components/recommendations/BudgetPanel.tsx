/**
 * BudgetPanel - Painel lateral fixo "Seu Orçamento"
 * 
 * Sempre visível com:
 * - SKU escolhido (nome completo + índice + tratamentos)
 * - Preço do par
 * - Add-ons aplicados (com +R$ incremental)
 * - Módulo "Melhorar sua lente" (upsells baseados em SKUs)
 * - Botão "Finalizar orçamento"
 */

import { useMemo, useState } from 'react';
import { 
  ShoppingCart, 
  Package, 
  X, 
  ArrowRight,
  Plus,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { Price } from '@/types/lens';
import type { SelectedProduct } from '@/lib/productSuggestionEngine';
import { getProductTypeLabel, calculateCartTotal } from '@/lib/productSuggestionEngine';

interface SKUUpgrade {
  id: string;
  label: string;
  description: string;
  priceIncrement: number;
  targetPrice?: Price;
}

interface BudgetPanelProps {
  products: SelectedProduct[];
  allPrices: Price[];
  selectedFamilyId?: string;
  onRemoveProduct: (productId: string) => void;
  onUpgradeProduct: (productId: string, upgrade: SKUUpgrade) => void;
  onFinalize: () => void;
}

const typeColors: Record<string, string> = {
  primary: 'bg-primary/10 text-primary border-primary/30',
  occupational: 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800',
  solar: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
};

// Get index from price
const getIndexFromPrice = (price: Price): string => {
  const avail = (price as any).availability;
  if (avail?.index) return avail.index;
  if ((price as any).index) return (price as any).index;
  return '1.50';
};

// Treatment label mapping
const TREATMENT_LABELS: Record<string, string> = {
  'BLUE': 'Filtro Luz Azul',
  'FOTO': 'Fotossensível',
  'AR': 'Antirreflexo Premium',
  'POLA': 'Polarizado',
  'HMC': 'Tratamento HMC',
  'UC': 'Ultra Clean',
};

const getTreatmentLabel = (id: string): string => {
  for (const [key, label] of Object.entries(TREATMENT_LABELS)) {
    if (id.toUpperCase().includes(key)) return label;
  }
  return id;
};

export const BudgetPanel = ({
  products,
  allPrices,
  selectedFamilyId,
  onRemoveProduct,
  onUpgradeProduct,
  onFinalize,
}: BudgetPanelProps) => {
  const [upgradesOpen, setUpgradesOpen] = useState(true);
  const [selectedUpgrades, setSelectedUpgrades] = useState<Set<string>>(new Set());

  const total = calculateCartTotal(products);
  const hasPrimary = products.some(p => p.type === 'primary');
  const primaryProduct = products.find(p => p.type === 'primary');

  // Calculate available upgrades for primary product
  const availableUpgrades = useMemo((): SKUUpgrade[] => {
    if (!primaryProduct || !selectedFamilyId) return [];
    
    const familyPrices = allPrices.filter(p => p.family_id === selectedFamilyId);
    const currentIndex = primaryProduct.selectedIndex;
    const currentTreatments = new Set(primaryProduct.selectedTreatments);
    
    // Find current price
    const currentPrice = familyPrices.find(p => 
      p.erp_code === primaryProduct.selectedPriceErpCode
    );
    if (!currentPrice) return [];
    
    const upgrades: SKUUpgrade[] = [];
    
    // 1. Index upgrades (higher index = thinner lens)
    const indices = [...new Set(familyPrices.map(p => getIndexFromPrice(p)))].sort();
    const currentIdxPosition = indices.indexOf(currentIndex);
    
    indices.forEach((idx, pos) => {
      if (pos <= currentIdxPosition) return; // Only higher indices
      
      const priceForIndex = familyPrices
        .filter(p => getIndexFromPrice(p) === idx)
        .sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0];
      
      if (priceForIndex) {
        const increment = (priceForIndex.price_sale_half_pair - currentPrice.price_sale_half_pair) * 2;
        if (increment > 0) {
          upgrades.push({
            id: `index-${idx}`,
            label: `Índice ${idx}`,
            description: 'Lente mais fina e leve',
            priceIncrement: increment,
            targetPrice: priceForIndex,
          });
        }
      }
    });
    
    // 2. Treatment upgrades
    const allTreatments = new Set<string>();
    familyPrices.forEach(p => {
      (p.addons_detected || []).forEach(t => allTreatments.add(t));
    });
    
    allTreatments.forEach(treatment => {
      if (currentTreatments.has(treatment)) return; // Already has it
      
      // Find cheapest price with this treatment at current index
      const priceWithTreatment = familyPrices
        .filter(p => 
          getIndexFromPrice(p) === currentIndex &&
          (p.addons_detected || []).includes(treatment)
        )
        .sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0];
      
      if (priceWithTreatment) {
        const increment = (priceWithTreatment.price_sale_half_pair - currentPrice.price_sale_half_pair) * 2;
        if (increment > 0) {
          upgrades.push({
            id: `treatment-${treatment}`,
            label: getTreatmentLabel(treatment),
            description: 'Tratamento adicional',
            priceIncrement: increment,
            targetPrice: priceWithTreatment,
          });
        }
      }
    });
    
    return upgrades.sort((a, b) => a.priceIncrement - b.priceIncrement);
  }, [primaryProduct, selectedFamilyId, allPrices]);

  // Handle upgrade toggle
  const handleUpgradeToggle = (upgrade: SKUUpgrade) => {
    const newSelected = new Set(selectedUpgrades);
    if (newSelected.has(upgrade.id)) {
      newSelected.delete(upgrade.id);
    } else {
      newSelected.add(upgrade.id);
      if (primaryProduct) {
        onUpgradeProduct(primaryProduct.id, upgrade);
      }
    }
    setSelectedUpgrades(newSelected);
  };

  // Calculate total with upgrades
  const upgradesTotal = useMemo(() => {
    let extra = 0;
    selectedUpgrades.forEach(id => {
      const upgrade = availableUpgrades.find(u => u.id === id);
      if (upgrade) extra += upgrade.priceIncrement;
    });
    return extra;
  }, [selectedUpgrades, availableUpgrades]);

  // Get SKU display description
  const getSkuDescription = (product: SelectedProduct): string => {
    const parts = [product.familyName];
    if (product.selectedIndex) parts.push(`Índice ${product.selectedIndex}`);
    if (product.selectedTreatments.length > 0) {
      parts.push(product.selectedTreatments.map(getTreatmentLabel).join(', '));
    }
    return parts.join(' · ');
  };

  if (products.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Seu Orçamento
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Nenhum produto selecionado
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Escolha uma lente acima para começar
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ShoppingCart className="w-4 h-4" />
          Seu Orçamento
          <Badge variant="secondary" className="ml-auto">
            {products.length} {products.length === 1 ? 'item' : 'itens'}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Products list */}
        {products.map((product, index) => (
          <div key={product.id}>
            {index > 0 && <Separator className="my-3" />}
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <Package className={`w-4 h-4 mt-0.5 shrink-0 ${
                    product.type === 'primary' ? 'text-primary' :
                    product.type === 'occupational' ? 'text-cyan-600' : 'text-amber-600'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] px-1.5 py-0 ${typeColors[product.type]}`}
                    >
                      {getProductTypeLabel(product.type)}
                    </Badge>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">
                    R$ {product.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  {product.type !== 'primary' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1 text-[10px] text-muted-foreground hover:text-destructive"
                      onClick={() => onRemoveProduct(product.id)}
                    >
                      <X className="w-3 h-3 mr-0.5" />
                      Remover
                    </Button>
                  )}
                </div>
              </div>
              
              {/* SKU Description - Name + Index + Treatments */}
              <p className="text-sm font-medium pl-6">
                {getSkuDescription(product)}
              </p>
              <p className="text-xs text-muted-foreground pl-6">
                {product.supplier}
              </p>
            </div>
          </div>
        ))}

        {/* Upgrades section */}
        {availableUpgrades.length > 0 && (
          <>
            <Separator />
            <Collapsible open={upgradesOpen} onOpenChange={setUpgradesOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Melhorar sua lente
                  </span>
                  <Plus className={`w-4 h-4 transition-transform ${upgradesOpen ? 'rotate-45' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-2">
                {availableUpgrades.slice(0, 5).map(upgrade => (
                  <div 
                    key={upgrade.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={upgrade.id}
                      checked={selectedUpgrades.has(upgrade.id)}
                      onCheckedChange={() => handleUpgradeToggle(upgrade)}
                    />
                    <Label 
                      htmlFor={upgrade.id}
                      className="flex-1 cursor-pointer"
                    >
                      <span className="text-sm font-medium block">{upgrade.label}</span>
                      <span className="text-xs text-muted-foreground">{upgrade.description}</span>
                    </Label>
                    <Badge variant="outline" className="text-xs shrink-0 text-success border-success/30">
                      +R$ {upgrade.priceIncrement.toLocaleString('pt-BR')}
                    </Badge>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </>
        )}

        <Separator />

        {/* Total */}
        <div className="space-y-2">
          {upgradesTotal > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Melhorias:</span>
              <span className="text-success">
                +R$ {upgradesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total:</span>
            <span className="text-xl font-bold text-primary">
              R$ {(total + upgradesTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Finalize button */}
        <Button
          onClick={onFinalize}
          disabled={!hasPrimary}
          className="w-full gap-2"
          size="lg"
        >
          Finalizar Orçamento
          <ArrowRight className="w-4 h-4" />
        </Button>

        {!hasPrimary && (
          <p className="text-xs text-center text-muted-foreground">
            Selecione uma lente principal para continuar
          </p>
        )}
      </CardContent>
    </Card>
  );
};
