import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Layers, Droplets, Sparkles, Store, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FamilyComparison from '@/components/comparison/FamilyComparison';
import MaterialComparison from '@/components/comparison/MaterialComparison';
import TreatmentComparison from '@/components/comparison/TreatmentComparison';
import CounterModeView from '@/components/comparison/CounterModeView';

export interface ComparisonGroup {
  canonicalId: string;
  canonicalName: string;
  clinicalType: string;
  commercialTier: string;
  description: string | null;
  valueAxes: Record<string, number>;
  suppliers: Record<string, {
    familyId: string;
    originalName: string;
    displayName: string | null;
    keyDifferentiator: string | null;
    targetAudience: string | null;
    valueAxes: Record<string, number>;
    confidence: string;
    technologyIds: string[];
    benefitIds: string[];
  }>;
}

const ComparisonHub = () => {
  const navigate = useNavigate();
  const [clinicalFilter, setClinicalFilter] = useState<string>('PROGRESSIVA');
  const [viewMode, setViewMode] = useState<'technical' | 'counter'>('counter');

  // Query canonical families with their equivalences
  const { data: comparisonGroups, isLoading } = useQuery({
    queryKey: ['canonical-comparison-groups', clinicalFilter],
    queryFn: async () => {
      // 1. Get canonical families for this clinical type
      const { data: canonicals, error: cErr } = await supabase
        .from('canonical_families')
        .select('*')
        .eq('clinical_type', clinicalFilter)
        .eq('active', true)
        .order('commercial_tier');
      if (cErr) throw cErr;

      if (!canonicals?.length) return [];

      // 2. Get all equivalences for these canonicals
      const canonicalIds = canonicals.map(c => c.id);
      const { data: equivalences, error: eErr } = await supabase
        .from('family_equivalences')
        .select('*')
        .in('canonical_family_id', canonicalIds);
      if (eErr) throw eErr;

      // 3. Get supplier families for these equivalences
      const supplierFamilyIds = (equivalences || []).map(e => e.supplier_family_id).filter(Boolean) as string[];
      const { data: supplierFamilies, error: sfErr } = await supabase
        .from('supplier_families')
        .select('*')
        .in('id', supplierFamilyIds.length ? supplierFamilyIds : ['00000000-0000-0000-0000-000000000000']);
      if (sfErr) throw sfErr;

      // 4. Build comparison groups
      const groups: ComparisonGroup[] = canonicals.map(canonical => {
        const eqs = (equivalences || []).filter(e => e.canonical_family_id === canonical.id);
        const suppliers: ComparisonGroup['suppliers'] = {};

        eqs.forEach(eq => {
          const sf = (supplierFamilies || []).find(f => f.id === eq.supplier_family_id);
          if (sf) {
            suppliers[sf.supplier_code] = {
              familyId: sf.id,
              originalName: sf.original_name,
              displayName: sf.display_name,
              keyDifferentiator: sf.key_differentiator,
              targetAudience: sf.target_audience,
              valueAxes: (sf.value_axes as Record<string, number>) || {},
              confidence: sf.confidence,
              technologyIds: sf.technology_ids || [],
              benefitIds: sf.benefit_ids || [],
            };
          }
        });

        return {
          canonicalId: canonical.id,
          canonicalName: canonical.canonical_name,
          clinicalType: canonical.clinical_type,
          commercialTier: canonical.commercial_tier,
          description: canonical.description,
          valueAxes: (canonical.value_axes as Record<string, number>) || {},
          suppliers,
        };
      });

      return groups;
    },
  });

  // Keep original queries for materials/treatments tabs
  const { data: materials } = useQuery({
    queryKey: ['comparison-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_materials')
        .select('*')
        .eq('active', true)
        .order('refractive_index');
      if (error) throw error;
      return (data || []) as any[];
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
      return (data || []) as any[];
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
              Essilor × Hoya × ZEISS — Comparação canônica lado a lado
            </p>
          </div>
          {/* View mode toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === 'counter' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none gap-1.5"
              onClick={() => setViewMode('counter')}
            >
              <Store className="h-4 w-4" /> Balcão
            </Button>
            <Button
              variant={viewMode === 'technical' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none gap-1.5"
              onClick={() => setViewMode('technical')}
            >
              <BarChart3 className="h-4 w-4" /> Técnico
            </Button>
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
            {viewMode === 'counter' ? (
              <CounterModeView
                comparisonGroups={comparisonGroups || []}
                clinicalType={clinicalFilter}
                isLoading={isLoading}
              />
            ) : (
              <FamilyComparison 
                comparisonGroups={comparisonGroups || []}
                clinicalType={clinicalFilter}
                isLoading={isLoading}
              />
            )}
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
