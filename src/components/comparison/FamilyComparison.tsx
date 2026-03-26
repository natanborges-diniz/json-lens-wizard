import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { SupplierFamily, ValueAxes } from '@/types/supplier';
import { SUPPORTED_SUPPLIERS, VALUE_AXES_LABELS } from '@/types/supplier';

interface Props {
  families: SupplierFamily[];
  clinicalType: string;
}

const tierOrder = ['essential', 'comfort', 'advanced', 'top'];
const tierLabels: Record<string, string> = {
  essential: 'Essencial',
  comfort: 'Conforto',
  advanced: 'Avançado',
  top: 'Topo',
};
const tierColors: Record<string, string> = {
  essential: 'border-l-slate-400',
  comfort: 'border-l-blue-400',
  advanced: 'border-l-purple-400',
  top: 'border-l-amber-400',
};
const tierBg: Record<string, string> = {
  essential: 'bg-slate-50',
  comfort: 'bg-blue-50',
  advanced: 'bg-purple-50',
  top: 'bg-amber-50',
};

const ValueBar = ({ value, max = 5, colorClass = 'bg-primary' }: { value: number; max?: number; colorClass?: string }) => (
  <div className="flex items-center gap-1.5">
    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${(value / max) * 100}%` }} />
    </div>
    <span className="text-[10px] font-mono w-3 text-right">{value}</span>
  </div>
);

const FamilyComparison = ({ families, clinicalType }: Props) => {
  // Group by tier
  const byTier = tierOrder.map(tier => ({
    tier,
    families: families.filter(f => f.tier_position === tier),
  })).filter(g => g.families.length > 0);

  if (families.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma família encontrada para {clinicalType}.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {byTier.map(({ tier, families: tierFamilies }) => (
        <div key={tier}>
          {/* Tier header */}
          <div className={`flex items-center gap-3 mb-4 px-4 py-2 rounded-lg ${tierBg[tier]}`}>
            <h2 className="text-lg font-bold">{tierLabels[tier]}</h2>
            <Badge variant="secondary" className="text-xs">{tierFamilies.length} famílias</Badge>
            {tier !== 'essential' && (
              <span className="text-xs text-muted-foreground ml-auto">
                ↑ O que melhora vs tier anterior?
              </span>
            )}
          </div>

          {/* Supplier columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {SUPPORTED_SUPPLIERS.map(supplier => {
              const family = tierFamilies.find(f => f.supplier_code === supplier.code);
              if (!family) {
                return (
                  <Card key={supplier.code} className="border-dashed opacity-50">
                    <CardContent className="py-8 text-center text-sm text-muted-foreground">
                      {supplier.name} — sem produto neste tier
                    </CardContent>
                  </Card>
                );
              }

              const axes = (family.value_axes || {}) as Partial<ValueAxes>;
              // Find previous tier family for delta
              const prevTierIdx = tierOrder.indexOf(tier) - 1;
              const prevTier = prevTierIdx >= 0 ? tierOrder[prevTierIdx] : null;
              const prevFamily = prevTier 
                ? families.find(f => f.supplier_code === supplier.code && f.tier_position === prevTier) 
                : null;
              const prevAxes = prevFamily ? (prevFamily.value_axes || {}) as Partial<ValueAxes> : null;

              return (
                <Card key={supplier.code} className={`border-l-4 ${tierColors[tier]}`}>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: supplier.color }}>
                        {supplier.name}
                      </span>
                      <Badge variant="outline" className="text-[10px]">{family.confidence}</Badge>
                    </div>
                    <h3 className="font-bold text-base leading-tight">
                      {family.display_name || family.original_name}
                    </h3>
                    {family.display_name !== family.original_name && (
                      <p className="text-[10px] text-muted-foreground">{family.original_name}</p>
                    )}
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {/* Key differentiator */}
                    {family.key_differentiator && (
                      <p className="text-xs text-muted-foreground italic bg-muted/50 rounded px-2 py-1.5">
                        💡 {family.key_differentiator}
                      </p>
                    )}

                    <Separator />

                    {/* Value axes */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Eixos de Valor
                      </p>
                      {(Object.entries(VALUE_AXES_LABELS) as [keyof ValueAxes, string][]).map(([key, label]) => {
                        const val = axes[key] || 0;
                        const prevVal = prevAxes?.[key] || 0;
                        const delta = prevVal > 0 ? val - prevVal : 0;
                        return (
                          <div key={key} className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground w-20 truncate">{label}</span>
                            <div className="flex-1">
                              <ValueBar value={val} />
                            </div>
                            {delta > 0 && (
                              <span className="text-[10px] font-bold text-emerald-600">+{delta}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Target audience */}
                    {family.target_audience && (
                      <>
                        <Separator />
                        <p className="text-[10px] text-muted-foreground">
                          👤 <span className="font-medium">Para:</span> {family.target_audience}
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FamilyComparison;
