import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Layers, Loader2, Star } from 'lucide-react';
import type { SupplierFamily, ValueAxes } from '@/types/supplier';
import { VALUE_AXES_LABELS } from '@/types/supplier';

interface Props {
  supplierCode: string;
}

const tierColors: Record<string, string> = {
  essential: 'bg-slate-100 text-slate-700',
  comfort: 'bg-blue-100 text-blue-700',
  advanced: 'bg-purple-100 text-purple-700',
  top: 'bg-amber-100 text-amber-700',
};

const reviewColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  reviewed: 'bg-blue-50 text-blue-600',
  approved: 'bg-emerald-50 text-emerald-600',
  rejected: 'bg-red-50 text-red-600',
};

const ValueBar = ({ value, label }: { value: number; label: string }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-20 text-muted-foreground truncate">{label}</span>
    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
      <div 
        className="h-full bg-primary rounded-full transition-all"
        style={{ width: `${(value / 5) * 100}%` }}
      />
    </div>
    <span className="w-4 text-right font-medium">{value}</span>
  </div>
);

const SupplierFamiliesTab = ({ supplierCode }: Props) => {
  const { data: families, isLoading } = useQuery({
    queryKey: ['supplier-families', supplierCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_families')
        .select('*')
        .eq('supplier_code', supplierCode)
        .order('tier_position', { ascending: true });
      if (error) throw error;
      return (data || []) as SupplierFamily[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!families?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma família cadastrada.</p>
          <p className="text-sm mt-1">
            Envie documentos fonte e processe, ou cadastre manualmente.
          </p>
          <Button className="mt-4" size="sm">
            <Plus className="h-4 w-4 mr-1" /> Adicionar Família
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{families.length} famílias</p>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4 mr-1" /> Nova Família
        </Button>
      </div>

      <div className="grid gap-4">
        {families.map((family) => {
          const axes = (family.value_axes || {}) as Partial<ValueAxes>;
          const hasAxes = Object.values(axes).some((v) => v && v > 0);

          return (
            <Card key={family.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">
                        {family.display_name || family.original_name}
                      </h3>
                      {family.display_name && family.display_name !== family.original_name && (
                        <span className="text-xs text-muted-foreground">
                          ({family.original_name})
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap mb-2">
                      <Badge variant="outline" className="text-xs">
                        {family.clinical_type}
                      </Badge>
                      {family.tier_position && (
                        <Badge className={`text-xs capitalize ${tierColors[family.tier_position] || ''}`} variant="secondary">
                          {family.tier_position}
                        </Badge>
                      )}
                      <Badge className={`text-xs ${reviewColors[family.review_status] || ''}`} variant="secondary">
                        {family.review_status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {family.confidence}
                      </Badge>
                    </div>
                    {family.key_differentiator && (
                      <p className="text-sm text-muted-foreground italic">
                        "{family.key_differentiator}"
                      </p>
                    )}
                  </div>

                  {/* Value axes */}
                  {hasAxes && (
                    <div className="w-full md:w-56 space-y-1">
                      {(Object.entries(VALUE_AXES_LABELS) as [keyof ValueAxes, string][]).map(([key, label]) => {
                        const val = axes[key];
                        if (!val) return null;
                        return <ValueBar key={key} value={val} label={label} />;
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SupplierFamiliesTab;
