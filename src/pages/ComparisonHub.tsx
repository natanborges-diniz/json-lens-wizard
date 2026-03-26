import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Layers, Droplets, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { SupplierFamily, SupplierMaterial, SupplierTreatment } from '@/types/supplier';
import FamilyComparison from '@/components/comparison/FamilyComparison';
import MaterialComparison from '@/components/comparison/MaterialComparison';
import TreatmentComparison from '@/components/comparison/TreatmentComparison';

const ComparisonHub = () => {
  const navigate = useNavigate();
  const [clinicalFilter, setClinicalFilter] = useState<string>('PROGRESSIVA');

  const { data: families } = useQuery({
    queryKey: ['comparison-families'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_families')
        .select('*')
        .eq('active', true)
        .eq('review_status', 'approved')
        .order('tier_position');
      if (error) throw error;
      return (data || []) as SupplierFamily[];
    },
  });

  const { data: materials } = useQuery({
    queryKey: ['comparison-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_materials')
        .select('*')
        .eq('active', true)
        .order('refractive_index');
      if (error) throw error;
      return (data || []) as SupplierMaterial[];
    },
  });

  const { data: treatments } = useQuery({
    queryKey: ['comparison-treatments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_treatments')
        .select('*')
        .eq('active', true)
        .order('treatment_type');
      if (error) throw error;
      return (data || []) as SupplierTreatment[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">Comparativo de Produtos</h1>
            <p className="text-sm text-muted-foreground">
              Essilor × Hoya × ZEISS — Comparação funcional lado a lado
            </p>
          </div>
          <Select value={clinicalFilter} onValueChange={setClinicalFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
             <SelectContent>
              <SelectItem value="PROGRESSIVA">Progressivas</SelectItem>
              <SelectItem value="MONOFOCAL">Monofocais</SelectItem>
              <SelectItem value="OCUPACIONAL">Ocupacionais</SelectItem>
              <SelectItem value="CONTROLE_MIOPIA">Controle de Miopia</SelectItem>
              <SelectItem value="ESPECIALIDADE">Especialidades</SelectItem>
              <SelectItem value="FOTOCROMATICA">Fotocromáticas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </header>

      <main className="p-6 max-w-[1400px] mx-auto">
        <Tabs defaultValue="families" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-lg">
            <TabsTrigger value="families" className="gap-1.5">
              <Layers className="h-4 w-4" /> Famílias
            </TabsTrigger>
            <TabsTrigger value="materials" className="gap-1.5">
              <Droplets className="h-4 w-4" /> Materiais
            </TabsTrigger>
            <TabsTrigger value="treatments" className="gap-1.5">
              <Sparkles className="h-4 w-4" /> Tratamentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="families">
            <FamilyComparison 
              families={(families || []).filter(f => f.clinical_type === clinicalFilter)} 
              clinicalType={clinicalFilter}
            />
          </TabsContent>

          <TabsContent value="materials">
            <MaterialComparison materials={materials || []} />
          </TabsContent>

          <TabsContent value="treatments">
            <TreatmentComparison treatments={treatments || []} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ComparisonHub;
