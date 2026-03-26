import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Layers, Droplets, Sparkles, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  supplierCode: string;
}

const SupplierOverviewTab = ({ supplierCode }: Props) => {
  const { data: families } = useQuery({
    queryKey: ['supplier-families', supplierCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_families')
        .select('*')
        .eq('supplier_code', supplierCode)
        .eq('active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: documents } = useQuery({
    queryKey: ['supplier-docs', supplierCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_source_documents')
        .select('*')
        .eq('supplier_code', supplierCode);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: treatments } = useQuery({
    queryKey: ['supplier-treatments', supplierCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_treatments')
        .select('id, review_status')
        .eq('supplier_code', supplierCode)
        .eq('active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: technologies } = useQuery({
    queryKey: ['supplier-technologies', supplierCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_technologies')
        .select('id, review_status')
        .eq('supplier_code', supplierCode)
        .eq('active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: materials } = useQuery({
    queryKey: ['supplier-materials', supplierCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_materials')
        .select('id, review_status')
        .eq('supplier_code', supplierCode)
        .eq('active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const stats = [
    { label: 'Documentos', count: documents?.length || 0, icon: FileText, color: 'text-blue-500' },
    { label: 'Famílias', count: families?.length || 0, icon: Layers, color: 'text-primary' },
    { label: 'Tratamentos', count: treatments?.length || 0, icon: Sparkles, color: 'text-purple-500' },
    { label: 'Tecnologias', count: technologies?.length || 0, icon: Shield, color: 'text-amber-500' },
    { label: 'Materiais', count: materials?.length || 0, icon: Droplets, color: 'text-emerald-500' },
  ];

  const allEntities = [
    ...(families || []),
    ...(treatments || []),
    ...(technologies || []),
    ...(materials || []),
  ];
  const approvedCount = allEntities.filter((e: any) => e.review_status === 'approved').length;
  const draftCount = allEntities.filter((e: any) => e.review_status === 'draft').length;

  // Tier distribution
  const tierCounts = (families || []).reduce((acc: Record<string, number>, f: any) => {
    const tier = f.tier_position || 'sem_tier';
    acc[tier] = (acc[tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <span className="text-2xl font-bold">{stat.count}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Review status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status de Revisão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm">{approvedCount} aprovados</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-sm">{draftCount} em rascunho</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier distribution */}
      {Object.keys(tierCounts).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Distribuição por Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              {['essential', 'comfort', 'advanced', 'top'].map((tier) => (
                tierCounts[tier] ? (
                  <Badge key={tier} variant="secondary" className="capitalize">
                    {tier}: {tierCounts[tier]}
                  </Badge>
                ) : null
              ))}
              {tierCounts['sem_tier'] && (
                <Badge variant="outline" className="text-muted-foreground">
                  Sem tier: {tierCounts['sem_tier']}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SupplierOverviewTab;
