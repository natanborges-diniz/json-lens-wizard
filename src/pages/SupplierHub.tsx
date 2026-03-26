import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, Upload, FileText, Layers, Droplets, 
  Sparkles, Shield, ArrowLeft, Plus 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SUPPORTED_SUPPLIERS } from '@/types/supplier';
import type { SupplierFamily, SupplierSourceDocument } from '@/types/supplier';
import SupplierDocumentsTab from '@/components/suppliers/SupplierDocumentsTab';
import SupplierFamiliesTab from '@/components/suppliers/SupplierFamiliesTab';
import SupplierOverviewTab from '@/components/suppliers/SupplierOverviewTab';

const SupplierHub = () => {
  const navigate = useNavigate();
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  // Fetch counts for overview
  const { data: familyCounts } = useQuery({
    queryKey: ['supplier-family-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_families')
        .select('supplier_code, id')
        .eq('active', true);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((f: { supplier_code: string }) => {
        counts[f.supplier_code] = (counts[f.supplier_code] || 0) + 1;
      });
      return counts;
    },
  });

  const { data: docCounts } = useQuery({
    queryKey: ['supplier-doc-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_source_documents')
        .select('supplier_code, id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((d: { supplier_code: string }) => {
        counts[d.supplier_code] = (counts[d.supplier_code] || 0) + 1;
      });
      return counts;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Hub de Fornecedores</h1>
            <p className="text-sm text-muted-foreground">
              Estrutura de dados por fornecedor — Essilor, Hoya, ZEISS
            </p>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {!selectedSupplier ? (
          // Grid de fornecedores
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SUPPORTED_SUPPLIERS.map((supplier) => (
              <Card 
                key={supplier.code}
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/30"
                onClick={() => setSelectedSupplier(supplier.code)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl" style={{ color: supplier.color }}>
                      {supplier.name}
                    </CardTitle>
                    <Building2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Famílias</span>
                      <Badge variant="secondary">
                        {familyCounts?.[supplier.code] || 0}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Documentos</span>
                      <Badge variant="outline">
                        {docCounts?.[supplier.code] || 0}
                      </Badge>
                    </div>
                    <Button className="w-full mt-2" variant="outline">
                      Gerenciar →
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          // Detalhe do fornecedor
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Button variant="ghost" size="sm" onClick={() => setSelectedSupplier(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <h2 className="text-xl font-bold" style={{ 
                color: SUPPORTED_SUPPLIERS.find(s => s.code === selectedSupplier)?.color 
              }}>
                {SUPPORTED_SUPPLIERS.find(s => s.code === selectedSupplier)?.name}
              </h2>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid grid-cols-3 w-full max-w-md">
                <TabsTrigger value="overview" className="gap-1">
                  <Layers className="h-4 w-4" /> Visão Geral
                </TabsTrigger>
                <TabsTrigger value="documents" className="gap-1">
                  <FileText className="h-4 w-4" /> Documentos
                </TabsTrigger>
                <TabsTrigger value="families" className="gap-1">
                  <Building2 className="h-4 w-4" /> Famílias
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <SupplierOverviewTab supplierCode={selectedSupplier} />
              </TabsContent>

              <TabsContent value="documents">
                <SupplierDocumentsTab supplierCode={selectedSupplier} />
              </TabsContent>

              <TabsContent value="families">
                <SupplierFamiliesTab supplierCode={selectedSupplier} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
};

export default SupplierHub;
