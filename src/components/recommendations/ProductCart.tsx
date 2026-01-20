import { ShoppingCart, X, ArrowRight, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { SelectedProduct } from '@/lib/productSuggestionEngine';
import { calculateCartTotal, getProductTypeLabel } from '@/lib/productSuggestionEngine';

interface ProductCartProps {
  products: SelectedProduct[];
  onRemoveProduct: (productId: string) => void;
  onFinalize: () => void;
}

const typeColors: Record<string, string> = {
  primary: 'bg-primary/10 text-primary border-primary/30',
  occupational: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  solar: 'bg-amber-100 text-amber-700 border-amber-300',
};

export const ProductCart = ({
  products,
  onRemoveProduct,
  onFinalize,
}: ProductCartProps) => {
  const total = calculateCartTotal(products);
  const hasPrimary = products.some(p => p.type === 'primary');

  if (products.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="py-8 text-center">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Nenhum produto selecionado
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Selecione uma lente acima para começar
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
          Produtos Selecionados
          <Badge variant="secondary" className="ml-auto">
            {products.length} {products.length === 1 ? 'item' : 'itens'}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {products.map((product, index) => (
          <div key={product.id}>
            {index > 0 && <Separator className="my-2" />}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <Package className={`w-4 h-4 mt-0.5 shrink-0 ${
                  product.type === 'primary' ? 'text-primary' :
                  product.type === 'occupational' ? 'text-cyan-600' : 'text-amber-600'
                }`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge 
                      variant="outline" 
                      className={`text-[10px] px-1.5 py-0 ${typeColors[product.type]}`}
                    >
                      {getProductTypeLabel(product.type)}
                    </Badge>
                  </div>
                  <p className="font-medium text-sm truncate mt-1">
                    {product.familyName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {product.supplier} • Índice {product.selectedIndex}
                  </p>
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
                    className="h-6 px-1.5 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => onRemoveProduct(product.id)}
                  >
                    <X className="w-3 h-3 mr-1" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}

        <Separator />

        <div className="flex justify-between items-center">
          <span className="text-sm text-muted-foreground">Total:</span>
          <span className="text-lg font-bold text-primary">
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>

        <Button
          onClick={onFinalize}
          disabled={!hasPrimary}
          className="w-full gap-2 gradient-primary text-primary-foreground"
        >
          Continuar para Orçamento
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
