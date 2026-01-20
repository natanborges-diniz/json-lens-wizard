import { useState, useMemo } from 'react';
import { Monitor, Sun, X, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Family, Price, Tier, Addon, AttributeDef } from '@/types/lens';
import type { ProductType, SelectedProduct } from '@/lib/productSuggestionEngine';
import { generateProductId, getProductTypeLabel } from '@/lib/productSuggestionEngine';
import { LensCard, LensCardConfiguration } from './LensCard';

interface FamilyWithPrice {
  family: Family;
  bestPrice: Price | null;
  allPrices: Price[];
  tier: Tier;
}

interface AdditionalProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productType: ProductType;
  families: FamilyWithPrice[];
  addons: Addon[];
  attributeDefs: AttributeDef[];
  onAddProduct: (product: SelectedProduct) => void;
  // For solar: the primary product to copy
  primaryProduct?: SelectedProduct;
}

export const AdditionalProductModal = ({
  open,
  onOpenChange,
  productType,
  families,
  addons,
  attributeDefs,
  onAddProduct,
  primaryProduct,
}: AdditionalProductModalProps) => {
  const [selectedConfig, setSelectedConfig] = useState<LensCardConfiguration | null>(null);

  const title = productType === 'occupational' 
    ? 'Escolher Lente de Escritório' 
    : 'Escolher Lente Solar';

  const Icon = productType === 'occupational' ? Monitor : Sun;
  const iconColor = productType === 'occupational' ? 'text-cyan-600' : 'text-amber-600';
  const bgColor = productType === 'occupational' ? 'bg-cyan-100' : 'bg-amber-100';

  // Group families by tier for occupational
  const groupedFamilies = useMemo(() => {
    const tiers: Tier[] = ['essential', 'comfort', 'advanced', 'top'];
    const grouped: Record<Tier, FamilyWithPrice[]> = {
      essential: [],
      comfort: [],
      advanced: [],
      top: [],
    };

    families.forEach(f => {
      if (grouped[f.tier]) {
        grouped[f.tier].push(f);
      }
    });

    return grouped;
  }, [families]);

  const handleSelectLens = (config: LensCardConfiguration) => {
    setSelectedConfig(config);
  };

  const handleConfirmSelection = () => {
    if (!selectedConfig) return;

    const selectedFamily = families.find(f => f.family.id === selectedConfig.familyId);
    if (!selectedFamily) return;

    const product: SelectedProduct = {
      id: generateProductId(),
      type: productType,
      familyId: selectedConfig.familyId,
      familyName: selectedFamily.family.name_original,
      supplier: selectedFamily.family.supplier,
      selectedIndex: selectedConfig.selectedIndex,
      selectedTreatments: selectedConfig.selectedTreatments,
      unitPrice: selectedConfig.totalPrice,
      label: getProductTypeLabel(productType),
      selectedPriceErpCode: selectedConfig.selectedPrice?.erp_code,
    };

    onAddProduct(product);
    onOpenChange(false);
    setSelectedConfig(null);
  };

  const handleAddSolarCopy = () => {
    if (!primaryProduct) return;

    const product: SelectedProduct = {
      id: generateProductId(),
      type: 'solar',
      familyId: primaryProduct.familyId,
      familyName: primaryProduct.familyName,
      supplier: primaryProduct.supplier,
      selectedIndex: primaryProduct.selectedIndex,
      selectedTreatments: [...primaryProduct.selectedTreatments, 'COLORACAO_SOLAR'],
      unitPrice: primaryProduct.unitPrice * 0.8, // 20% off for second pair
      label: 'Lente Solar',
      selectedPriceErpCode: primaryProduct.selectedPriceErpCode,
    };

    onAddProduct(product);
    onOpenChange(false);
  };

  // Render solar options (copy of primary with coloring)
  const renderSolarOptions = () => {
    if (!primaryProduct) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Sun className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Selecione uma lente principal primeiro</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Adicione uma versão solar da mesma lente com 20% de desconto
        </p>

        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Sun className="w-5 h-5 text-amber-700" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium">{primaryProduct.familyName}</h4>
                <p className="text-sm text-muted-foreground">
                  {primaryProduct.supplier} • Índice {primaryProduct.selectedIndex}
                </p>
                <Badge variant="secondary" className="mt-2">
                  + Coloração Solar
                </Badge>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground line-through">
                  R$ {primaryProduct.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-lg font-bold text-amber-700">
                  R$ {(primaryProduct.unitPrice * 0.8).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <Badge className="bg-amber-500 text-white text-[10px]">20% OFF</Badge>
              </div>
            </div>

            <Button
              onClick={handleAddSolarCopy}
              className="w-full mt-4 gap-2 bg-amber-600 hover:bg-amber-700"
            >
              <Check className="w-4 h-4" />
              Adicionar Lente Solar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Render occupational options (grid of families)
  const renderOccupationalOptions = () => {
    const availableFamilies = families.filter(f => f.bestPrice !== null);
    
    console.log('[AdditionalProductModal] Occupational families received:', families.length);
    console.log('[AdditionalProductModal] With prices:', availableFamilies.length);
    if (families.length > 0) {
      console.log('[AdditionalProductModal] Sample family:', families[0]);
    }

    if (availableFamilies.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Monitor className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Nenhuma lente ocupacional disponível no catálogo</p>
          <p className="text-xs mt-1">
            {families.length > 0 
              ? `${families.length} família(s) encontrada(s), mas sem preços vinculados`
              : 'Verifique se as famílias ocupacionais têm preços cadastrados'}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Escolha uma lente ocupacional para uso em escritório e computador
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableFamilies.slice(0, 4).map(f => (
            <LensCard
              key={f.family.id}
              family={f.family}
              bestPrice={f.bestPrice}
              allPrices={f.allPrices}
              tier={f.tier}
              isRecommended={false}
              isSelected={selectedConfig?.familyId === f.family.id}
              addons={addons}
              onSelect={handleSelectLens}
              attributeDefs={attributeDefs}
              alternativeFamilies={[]}
            />
          ))}
        </div>

        {selectedConfig && (
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleConfirmSelection}
              className="gap-2 bg-cyan-600 hover:bg-cyan-700"
            >
              <Check className="w-4 h-4" />
              Adicionar ao Carrinho
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${bgColor}`}>
              <Icon className={`w-5 h-5 ${iconColor}`} />
            </div>
            {title}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[65vh] pr-4">
          {productType === 'solar' ? renderSolarOptions() : renderOccupationalOptions()}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
