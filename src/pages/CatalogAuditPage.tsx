import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertCircle, 
  AlertTriangle, 
  Package, 
  DollarSign,
  Download,
  FileJson,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useLensStore } from '@/store/lensStore';
import { 
  auditCatalog, 
  exportAuditToCSV, 
  exportAuditToJSON,
  type CatalogAuditResult 
} from '@/lib/catalogValidationEngine';

export default function CatalogAuditPage() {
  const [audit, setAudit] = useState<CatalogAuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const { rawLensData, families, prices, loadCatalogFromCloud, loadLensData } = useLensStore();

  const runAudit = async () => {
    setIsLoading(true);
    try {
      // Ensure we have data
      if (!rawLensData && families.length === 0) {
        const cloudLoaded = await loadCatalogFromCloud();
        if (!cloudLoaded) {
          const response = await fetch('/data/lenses.json');
          const data = await response.json();
          loadLensData(data);
        }
      }
      
      const dataToAudit = rawLensData || { families, prices };
      const result = await auditCatalog(dataToAudit as any);
      setAudit(result);
    } catch (error) {
      console.error('Audit error:', error);
      toast.error('Erro ao executar auditoria');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  const handleExportCSV = () => {
    if (!audit) return;
    const csv = exportAuditToCSV(audit);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  const handleExportJSON = () => {
    if (!audit) return;
    const json = exportAuditToJSON(audit);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('JSON exportado');
  };

  const hasBlockingErrors = audit && Object.keys(audit.blockingSummary).length > 0;
  const hasWarnings = audit && Object.keys(audit.warningSummary).length > 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-bold">Auditoria do Catálogo</h1>
              <p className="text-xs text-muted-foreground">
                {audit && new Date(audit.timestamp).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={runAudit}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJSON}>
              <FileJson className="w-4 h-4 mr-2" />
              JSON
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className={hasBlockingErrors ? 'border-destructive' : 'border-success'}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                {hasBlockingErrors ? (
                  <XCircle className="w-8 h-8 text-destructive" />
                ) : (
                  <CheckCircle2 className="w-8 h-8 text-success" />
                )}
                <div>
                  <p className="text-2xl font-bold">
                    {Object.values(audit?.blockingSummary || {}).reduce((a, b) => a + b, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Erros Bloqueantes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={hasWarnings ? 'border-warning' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-8 h-8 ${hasWarnings ? 'text-warning' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-2xl font-bold">
                    {Object.values(audit?.warningSummary || {}).reduce((a, b) => a + b, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Alertas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{audit?.familiesWithoutSku.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Famílias sem SKU</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{audit?.orphanSkus.length || 0}</p>
                  <p className="text-sm text-muted-foreground">SKUs Órfãos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SKUs Órfãos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                SKUs sem Família
              </CardTitle>
              <CardDescription>SKUs com family_id inexistente</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ERP Code</TableHead>
                      <TableHead>Family ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit?.orphanSkus.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          Nenhum SKU órfão
                        </TableCell>
                      </TableRow>
                    ) : (
                      audit?.orphanSkus.map((sku, i) => (
                        <TableRow key={i}>
                          <TableCell><code>{sku.erp_code}</code></TableCell>
                          <TableCell><Badge variant="destructive">{sku.family_id}</Badge></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Famílias sem SKU */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-warning" />
                Famílias sem SKU
              </CardTitle>
              <CardDescription>Famílias ativas sem preços</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nome</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit?.familiesWithoutSku.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-muted-foreground">
                          Todas as famílias têm SKUs
                        </TableCell>
                      </TableRow>
                    ) : (
                      audit?.familiesWithoutSku.map((f, i) => (
                        <TableRow key={i}>
                          <TableCell><code>{f.id}</code></TableCell>
                          <TableCell>{f.name}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Famílias Desativadas */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-muted-foreground" />
                Famílias Desativadas Automaticamente
              </CardTitle>
              <CardDescription>Desativadas por ação pós-import</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Razão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audit?.disabledFamilies.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Nenhuma família desativada automaticamente
                        </TableCell>
                      </TableRow>
                    ) : (
                      audit?.disabledFamilies.map((f, i) => (
                        <TableRow key={i}>
                          <TableCell><code>{f.id}</code></TableCell>
                          <TableCell>{f.name}</TableCell>
                          <TableCell><Badge variant="secondary">{f.reason}</Badge></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
