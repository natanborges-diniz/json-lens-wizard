import type { Price, FamilyExtended } from '@/types/lens';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { AlertTriangle, CheckCircle2, Package, DollarSign, Ruler, Layers } from 'lucide-react';

interface ProductDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sku: Price | null;
  family: FamilyExtended | null;
}

function hasRealGrade(sku: Price): boolean {
  const av = (sku as any).availability;
  if (av?.sphere?.min !== undefined && av?.sphere?.max !== undefined) {
    return !(av.sphere.min === 0 && av.sphere.max === 0);
  }
  const sp = sku.specs;
  if (sp?.sphere_min !== undefined && sp?.sphere_max !== undefined) {
    return !(sp.sphere_min === 0 && sp.sphere_max === 0);
  }
  return false;
}

function getAvailability(sku: Price) {
  const av = (sku as any).availability;
  if (av?.sphere?.min !== undefined) {
    return {
      sphere: `${av.sphere.min} a ${av.sphere.max}`,
      cylinder: av.cylinder ? `${av.cylinder.min} a ${av.cylinder.max}` : '—',
      addition: av.addition ? `${av.addition.min} a ${av.addition.max}` : '—',
      diameters: av.diameters_mm?.join(', ') || '—',
      index: av.index || sku.index || '—',
    };
  }
  const sp = sku.specs;
  if (sp) {
    return {
      sphere: `${sp.sphere_min} a ${sp.sphere_max}`,
      cylinder: `${sp.cyl_min} a ${sp.cyl_max}`,
      addition: sp.add_min !== undefined ? `${sp.add_min} a ${sp.add_max}` : '—',
      diameters: sp.diameter_max_mm ? `até ${sp.diameter_max_mm}mm` : '—',
      index: sku.index || '—',
    };
  }
  return null;
}

const tierLabels: Record<string, string> = {
  essential: 'Essential',
  comfort: 'Comfort',
  advanced: 'Advanced',
  top: 'Top',
};

const tierColors: Record<string, string> = {
  essential: 'bg-muted text-muted-foreground',
  comfort: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  advanced: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  top: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

export function ProductDetailDrawer({ open, onOpenChange, sku, family }: ProductDetailDrawerProps) {
  if (!sku) return null;

  const realGrade = hasRealGrade(sku);
  const availability = getAvailability(sku);
  const tier = family?.tier_target || 'essential';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">{family?.display_name || family?.name_original || sku.family_id}</SheetTitle>
          <SheetDescription className="text-left">{sku.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className={tierColors[tier]}>{tierLabels[tier]}</Badge>
            <Badge variant="outline">{sku.supplier}</Badge>
            <Badge variant="outline">{family?.clinical_type || family?.category || '—'}</Badge>
            {realGrade ? (
              <Badge variant="outline" className="text-green-700 border-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Grade OK
              </Badge>
            ) : (
              <Badge variant="destructive" className="bg-amber-100 text-amber-800 border-amber-300">
                <AlertTriangle className="h-3 w-3 mr-1" /> Sem grade
              </Badge>
            )}
            {!sku.active && <Badge variant="destructive">Inativo</Badge>}
          </div>

          <Separator />

          {/* Pricing */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4 text-muted-foreground" /> Preços
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs">Compra (meio par)</p>
                <p className="font-semibold">R$ {sku.price_purchase_half_pair?.toFixed(2) || '—'}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-muted-foreground text-xs">Venda (meio par)</p>
                <p className="font-semibold">R$ {sku.price_sale_half_pair?.toFixed(2) || '—'}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Codes */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4 text-muted-foreground" /> Códigos
            </div>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ERP</span>
                <span className="font-mono">{sku.erp_code || sku.sku_erp || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Família</span>
                <span className="font-mono text-xs">{sku.family_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Índice</span>
                <span>{sku.index || '—'}</span>
              </div>
            </div>
          </div>

          {/* Availability */}
          {availability && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Ruler className="h-4 w-4 text-muted-foreground" /> Disponibilidade Técnica
                </div>
                {!realGrade && (
                  <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950 p-2 rounded">
                    Dados zerados do ERP — valores abaixo não representam limites reais.
                  </p>
                )}
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Esférico</span><span>{availability.sphere}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Cilíndrico</span><span>{availability.cylinder}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Adição</span><span>{availability.addition}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Diâmetros</span><span>{availability.diameters}</span></div>
                </div>
              </div>
            </>
          )}

          {/* Treatments */}
          {sku.addons_detected && sku.addons_detected.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Layers className="h-4 w-4 text-muted-foreground" /> Tratamentos
                </div>
                <div className="flex flex-wrap gap-1">
                  {sku.addons_detected.map(a => (
                    <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
