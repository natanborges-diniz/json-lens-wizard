import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SUPPORTED_SUPPLIERS, VALUE_AXES_LABELS } from '@/types/supplier';
import type { ValueAxes } from '@/types/supplier';
import type { ComparisonGroup } from '@/pages/ComparisonHub';
import { Cpu, Zap } from 'lucide-react';

interface Props {
  comparisonGroups: ComparisonGroup[];
  clinicalType: string;
  isLoading?: boolean;
}

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
  essential: 'bg-slate-50 dark:bg-slate-900/30',
  comfort: 'bg-blue-50 dark:bg-blue-900/30',
  advanced: 'bg-purple-50 dark:bg-purple-900/30',
  top: 'bg-amber-50 dark:bg-amber-900/30',
};
const tierOrder = ['essential', 'comfort', 'advanced', 'top'];

const ValueBar = ({ value, max = 5 }: { value: number; max?: number }) => (
  <div className="flex items-center gap-1.5">
    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
      <div className="h-full rounded-full bg-primary" style={{ width: `${(value / max) * 100}%` }} />
    </div>
    <span className="text-[10px] font-mono w-3 text-right">{value}</span>
  </div>
);

const FamilyComparison = ({ comparisonGroups, clinicalType, isLoading }: Props) => {
  const { data: technologies } = useQuery({
    queryKey: ['comparison-technologies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_technologies')
        .select('id, supplier_code, original_name, display_name, tech_group')
        .eq('active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: benefits } = useQuery({
    queryKey: ['comparison-benefits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_benefits')
        .select('id, supplier_code, original_text, benefit_category, short_argument')
        .eq('active', true);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (comparisonGroups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum grupo de comparação encontrado para {clinicalType}.
        </CardContent>
      </Card>
    );
  }

  // Sort groups by tier order
  const sortedGroups = [...comparisonGroups].sort(
    (a, b) => tierOrder.indexOf(a.commercialTier) - tierOrder.indexOf(b.commercialTier)
  );

  // Find previous group for delta comparison
  const getPrevGroup = (idx: number) => idx > 0 ? sortedGroups[idx - 1] : null;

  return (
    <div className="space-y-8">
      {sortedGroups.map((group, groupIdx) => {
        const prevGroup = getPrevGroup(groupIdx);
        const tier = group.commercialTier;

        return (
          <div key={group.canonicalId}>
            {/* Canonical tier header */}
            <div className={`flex items-center gap-3 mb-4 px-4 py-2.5 rounded-lg ${tierBg[tier] || ''}`}>
              <h2 className="text-lg font-bold">{group.canonicalName}</h2>
              <Badge variant="secondary" className="text-xs">{tierLabels[tier] || tier}</Badge>
              <span className="text-xs text-muted-foreground ml-auto">
                {Object.keys(group.suppliers).length} fornecedores
              </span>
            </div>

            {group.description && (
              <p className="text-sm text-muted-foreground mb-4 px-4">{group.description}</p>
            )}

            {/* Supplier columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SUPPORTED_SUPPLIERS.map(supplier => {
                const supplierData = group.suppliers[supplier.code];

                if (!supplierData) {
                  return (
                    <Card key={supplier.code} className="border-dashed opacity-50">
                      <CardContent className="py-8 text-center text-sm text-muted-foreground">
                        {supplier.name} — sem equivalente
                      </CardContent>
                    </Card>
                  );
                }

                const axes = supplierData.valueAxes || {};
                const prevSupplierData = prevGroup?.suppliers[supplier.code];
                const prevAxes = prevSupplierData?.valueAxes || {};

                // Resolve linked technologies
                const familyTechs = supplierData.technologyIds
                  .map(id => technologies?.find(t => t.id === id))
                  .filter(Boolean);

                // Resolve linked benefits
                const familyBenefits = supplierData.benefitIds
                  .map(id => benefits?.find(b => b.id === id))
                  .filter(Boolean);

                return (
                  <Card key={supplier.code} className={`border-l-4 ${tierColors[tier] || ''}`}>
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: supplier.color }}>
                          {supplier.name}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{supplierData.confidence}</Badge>
                      </div>
                      <h3 className="font-bold text-base leading-tight">
                        {supplierData.displayName || supplierData.originalName}
                      </h3>
                      {supplierData.displayName && supplierData.displayName !== supplierData.originalName && (
                        <p className="text-[10px] text-muted-foreground">{supplierData.originalName}</p>
                      )}
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      {supplierData.keyDifferentiator && (
                        <p className="text-xs text-muted-foreground italic bg-muted/50 rounded px-2 py-1.5">
                          💡 {supplierData.keyDifferentiator}
                        </p>
                      )}

                      <Separator />

                      {/* Value axes */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Eixos de Valor
                        </p>
                        {(Object.entries(VALUE_AXES_LABELS) as [keyof ValueAxes, string][]).map(([key, label]) => {
                          const val = (axes as any)[key] || 0;
                          const prevVal = (prevAxes as any)?.[key] || 0;
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

                      {/* Technologies */}
                      {familyTechs.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <Cpu className="h-3 w-3" /> Tecnologias
                            </p>
                            <div className="flex flex-wrap gap-1">
                              <TooltipProvider>
                                {familyTechs.map((tech: any) => (
                                  <Tooltip key={tech.id}>
                                    <TooltipTrigger>
                                      <Badge variant="secondary" className="text-[10px] cursor-help">
                                        {tech.display_name || tech.original_name}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="text-xs">{tech.tech_group || 'Tecnologia'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ))}
                              </TooltipProvider>
                            </div>
                          </div>
                        </>
                      )}

                      {/* Benefits */}
                      {familyBenefits.length > 0 && (
                        <>
                          <Separator />
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <Zap className="h-3 w-3" /> Benefícios
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {familyBenefits.map((ben: any) => (
                                <Badge key={ben.id} variant="outline" className="text-[10px]">
                                  {ben.short_argument || ben.original_text}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {/* Target audience */}
                      {supplierData.targetAudience && (
                        <>
                          <Separator />
                          <p className="text-[10px] text-muted-foreground">
                            👤 <span className="font-medium">Para:</span> {supplierData.targetAudience}
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FamilyComparison;
