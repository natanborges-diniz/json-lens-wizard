import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Upload, FileText, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { SupplierSourceDocument } from '@/types/supplier';

interface Props {
  supplierCode: string;
}

const parseStatusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: 'Pendente', color: 'bg-amber-100 text-amber-700', icon: Clock },
  parsing: { label: 'Processando', color: 'bg-blue-100 text-blue-700', icon: Loader2 },
  parsed: { label: 'Processado', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  error: { label: 'Erro', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

const docTypeLabels: Record<string, string> = {
  price_table: 'Tabela de Preços',
  technical_sheet: 'Ficha Técnica',
  catalog: 'Catálogo',
  brochure: 'Folder/Brochura',
};

const SupplierDocumentsTab = ({ supplierCode }: Props) => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['supplier-docs', supplierCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_source_documents')
        .select('*')
        .eq('supplier_code', supplierCode)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as SupplierSourceDocument[];
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Upload to storage
      const filePath = `${supplierCode}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('supplier-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { error: insertError } = await supabase
        .from('supplier_source_documents')
        .insert({
          supplier_code: supplierCode,
          document_type: docType,
          file_name: file.name,
          file_url: filePath,
          parse_status: 'pending',
        });

      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ['supplier-docs', supplierCode] });
      toast.success(`Documento "${file.name}" enviado com sucesso`);
    } catch (err: any) {
      toast.error(`Erro ao enviar: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5" /> Enviar Documento
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(docTypeLabels).map(([type, label]) => (
              <div key={type} className="relative">
                <Input
                  type="file"
                  accept=".pdf,.xlsx,.xls,.csv"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => handleFileUpload(e, type)}
                  disabled={uploading}
                />
                <Button
                  variant="outline"
                  className="w-full h-20 flex-col gap-1 text-xs"
                  disabled={uploading}
                >
                  <FileText className="h-5 w-5" />
                  {label}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Documents list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : documents?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Nenhum documento enviado para este fornecedor.</p>
            <p className="text-sm mt-1">Envie fichas técnicas, catálogos ou tabelas de preço acima.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents?.map((doc) => {
            const statusConf = parseStatusConfig[doc.parse_status] || parseStatusConfig.pending;
            const StatusIcon = statusConf.icon;
            return (
              <Card key={doc.id}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {docTypeLabels[doc.document_type] || doc.document_type}
                        {doc.version_label && ` • ${doc.version_label}`}
                        {' • '}
                        {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <Badge className={statusConf.color} variant="secondary">
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {statusConf.label}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SupplierDocumentsTab;
