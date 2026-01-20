import { useState, useEffect, useMemo } from 'react';
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
  Loader2,
  Filter,
  Power,
  PowerOff
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useLensStore } from '@/store/lensStore';
import { 
  auditCatalog, 
  exportAuditToCSV, 
  exportAuditToJSON,
  type CatalogAuditResult 
} from '@/lib/catalogValidationEngine';
import type { FamilyExtended, Price } from '@/types/lens';

// Computed family data with SKU counts per spec
interface FamilyAuditRow {
  id: string;
  name_original: string;
  supplier: string;
  category: string;
  macro: string;
  active: boolean;
  availability_status?: string;
  total_skus: number;
  skus_ativos_com_preco: number;
  hasAlert: boolean;
}

export default function CatalogAuditPage() {
  const [audit, setAudit] = useState<CatalogAuditResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [onlyAlerts, setOnlyAlerts] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [showBulkDisableDialog, setShowBulkDisableDialog] = useState(false);
  const [isBulkDisabling, setIsBulkDisabling] = useState(false);
  
  const { 
    rawLensData, 
    families, 
    prices, 
    loadCatalogFromCloud, 
    loadLensData,
    toggleFamilyActive,
    saveCatalogToCloud 
  } = useLensStore();

  // Compute family audit rows with SKU counts
  const familyAuditRows = useMemo((): FamilyAuditRow[] => {
    return families.map((family) => {
      const familyPrices = prices.filter(p => p.family_id === family.id);
      const total_skus = familyPrices.length;
      const skus_ativos_com_preco = familyPrices.filter(p => 
        p.active === true && 
        p.price_sale_half_pair != null && 
        p.price_sale_half_pair > 0
      ).length;
      
      // Alert: active family without any active SKU with price
      const hasAlert = family.active === true && skus_ativos_com_preco === 0;
      
      return {
        id: family.id,
        name_original: family.name_original,
        supplier: family.supplier,
        category: family.category,
        macro: family.macro,
        active: family.active,
        availability_status: family.availability_status,
        total_skus,
        skus_ativos_com_preco,
        hasAlert
      };
    });
  }, [families, prices]);

  // Get unique suppliers and categories for filters
  const uniqueSuppliers = useMemo(() => 
    [...new Set(families.map(f => f.supplier))].sort(), 
    [families]
  );
  
  const uniqueCategories = useMemo(() => 
    [...new Set(families.map(f => f.category))].sort(), 
    [families]
  );

  // Apply filters
  const filteredRows = useMemo(() => {
    return familyAuditRows.filter(row => {
      if (supplierFilter !== 'all' && row.supplier !== supplierFilter) return false;
      if (categoryFilter !== 'all' && row.category !== categoryFilter) return false;
      if (onlyAlerts && !row.hasAlert) return false;
      return true;
    });
  }, [familyAuditRows, supplierFilter, categoryFilter, onlyAlerts]);

  // Stats
  const alertCount = familyAuditRows.filter(r => r.hasAlert).length;
  const totalFamilies = families.length;
  const activeFamilies = families.filter(f => f.active).length;

  const runAudit = async () => {
    setIsLoading(true);
    try {
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
    // Export current filtered view as CSV
    const headers = ['ID', 'Nome', 'Fornecedor', 'Categoria', 'Macro', 'Total SKUs', 'SKUs Ativos c/ Preço', 'Alerta', 'Status'];
    const rows = filteredRows.map(row => [
      row.id,
      row.name_original,
      row.supplier,
      row.category,
      row.macro,
      row.total_skus,
      row.skus_ativos_com_preco,
      row.hasAlert ? 'SIM' : 'NÃO',
      row.active ? 'Ativo' : (row.availability_status || 'Inativo')
    ]);
    
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-familias-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  };

  const handleExportJSON = () => {
    const exportData = {
      meta: {
        exported_at: new Date().toISOString(),
        filters: { supplier: supplierFilter, category: categoryFilter, onlyAlerts },
        stats: {
          total_families: totalFamilies,
          active_families: activeFamilies,
          families_with_alerts: alertCount,
          filtered_count: filteredRows.length
        }
      },
      families: filteredRows
    };
    
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-familias-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('JSON exportado');
  };

  const handleRowSelect = (id: string, checked: boolean) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const alertIds = filteredRows.filter(r => r.hasAlert).map(r => r.id);
      setSelectedRows(new Set(alertIds));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleBulkDisable = async () => {
    setIsBulkDisabling(true);
    try {
      // Get rows to disable (selected OR all with alerts if none selected)
      const rowsToDisable = selectedRows.size > 0 
        ? filteredRows.filter(r => selectedRows.has(r.id) && r.hasAlert)
        : filteredRows.filter(r => r.hasAlert);
      
      for (const row of rowsToDisable) {
        // Find the family and update it
        const family = families.find(f => f.id === row.id);
        if (family) {
          // Toggle to inactive and set availability_status
          await toggleFamilyActive(family.id);
        }
      }
      
      // Save to cloud
      await saveCatalogToCloud();
      
      toast.success(`${rowsToDisable.length} famílias desativadas`);
      setSelectedRows(new Set());
      setShowBulkDisableDialog(false);
      
      // Refresh audit
      await runAudit();
    } catch (error) {
      console.error('Bulk disable error:', error);
      toast.error('Erro ao desativar famílias');
    } finally {
      setIsBulkDisabling(false);
    }
  };

  const rowsWithAlerts = filteredRows.filter(r => r.hasAlert);
  const selectedAlertRows = filteredRows.filter(r => selectedRows.has(r.id) && r.hasAlert);

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
              <h1 className="text-lg font-bold">Auditoria: Famílias Vendáveis</h1>
              <p className="text-xs text-muted-foreground">
                Ativas x SKUs com Preço • {audit && new Date(audit.timestamp).toLocaleString('pt-BR')}
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
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Package className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalFamilies}</p>
                  <p className="text-sm text-muted-foreground">Total Famílias</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-success" />
                <div>
                  <p className="text-2xl font-bold">{activeFamilies}</p>
                  <p className="text-sm text-muted-foreground">Famílias Ativas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={alertCount > 0 ? 'border-warning' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-8 h-8 ${alertCount > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                <div>
                  <p className="text-2xl font-bold">{alertCount}</p>
                  <p className="text-sm text-muted-foreground">Famílias com Alerta</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{prices.length}</p>
                  <p className="text-sm text-muted-foreground">Total SKUs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters Bar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtros:</span>
              </div>
              
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Fornecedores</SelectItem>
                  {uniqueSuppliers.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias</SelectItem>
                  {uniqueCategories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex items-center gap-2">
                <Switch 
                  id="only-alerts" 
                  checked={onlyAlerts} 
                  onCheckedChange={setOnlyAlerts}
                />
                <Label htmlFor="only-alerts" className="text-sm cursor-pointer">
                  Somente Alertas
                </Label>
              </div>
              
              <div className="flex-1" />
              
              {rowsWithAlerts.length > 0 && (
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => setShowBulkDisableDialog(true)}
                >
                  <PowerOff className="w-4 h-4 mr-2" />
                  Desativar {selectedRows.size > 0 ? selectedAlertRows.length : rowsWithAlerts.length} Famílias sem SKU
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Main Data Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Famílias ({filteredRows.length})
            </CardTitle>
            <CardDescription>
              Clique nas linhas para selecionar famílias para ação em massa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox 
                        checked={selectedRows.size > 0 && selectedRows.size === rowsWithAlerts.length}
                        onCheckedChange={handleSelectAll}
                        aria-label="Selecionar todos com alerta"
                      />
                    </TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Macro</TableHead>
                    <TableHead className="text-center">Total SKUs</TableHead>
                    <TableHead className="text-center">SKUs Ativos c/ Preço</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Nenhuma família encontrada com os filtros atuais
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((row) => (
                      <TableRow 
                        key={row.id}
                        className={row.hasAlert ? 'bg-warning/5' : ''}
                      >
                        <TableCell>
                          {row.hasAlert && (
                            <Checkbox 
                              checked={selectedRows.has(row.id)}
                              onCheckedChange={(checked) => handleRowSelect(row.id, checked as boolean)}
                              aria-label={`Selecionar ${row.name_original}`}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{row.id}</code>
                        </TableCell>
                        <TableCell className="font-medium">{row.name_original}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{row.supplier}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{row.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{row.macro}</code>
                        </TableCell>
                        <TableCell className="text-center">{row.total_skus}</TableCell>
                        <TableCell className="text-center">
                          <span className={row.skus_ativos_com_preco === 0 ? 'text-destructive font-bold' : ''}>
                            {row.skus_ativos_com_preco}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {row.hasAlert ? (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Sem SKU
                            </Badge>
                          ) : row.active ? (
                            <Badge variant="default" className="gap-1 bg-success text-success-foreground">
                              <CheckCircle2 className="w-3 h-3" />
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <XCircle className="w-3 h-3" />
                              {row.availability_status || 'Inativo'}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Legacy Audit Tables (orphan SKUs, etc) */}
        {audit && (audit.orphanSkus.length > 0 || audit.disabledFamilies.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SKUs Órfãos */}
            {audit.orphanSkus.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    SKUs sem Família ({audit.orphanSkus.length})
                  </CardTitle>
                  <CardDescription>SKUs com family_id inexistente</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ERP Code</TableHead>
                          <TableHead>Family ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {audit.orphanSkus.map((sku, i) => (
                          <TableRow key={i}>
                            <TableCell><code>{sku.erp_code}</code></TableCell>
                            <TableCell><Badge variant="destructive">{sku.family_id}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Famílias Desativadas */}
            {audit.disabledFamilies.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PowerOff className="w-5 h-5 text-muted-foreground" />
                    Famílias Desativadas ({audit.disabledFamilies.length})
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
                        {audit.disabledFamilies.map((f, i) => (
                          <TableRow key={i}>
                            <TableCell><code>{f.id}</code></TableCell>
                            <TableCell>{f.name}</TableCell>
                            <TableCell><Badge variant="secondary">{f.reason}</Badge></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Bulk Disable Confirmation Dialog */}
      <AlertDialog open={showBulkDisableDialog} onOpenChange={setShowBulkDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Famílias sem SKU</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá desativar{' '}
              <strong>{selectedRows.size > 0 ? selectedAlertRows.length : rowsWithAlerts.length}</strong>{' '}
              famílias que estão ativas mas não possuem nenhum SKU com preço.
              <br /><br />
              As famílias terão:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><code>active = false</code></li>
                <li><code>availability_status = "SEM_SKU_NO_ERP"</code></li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDisabling}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleBulkDisable}
              disabled={isBulkDisabling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDisabling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Desativando...
                </>
              ) : (
                <>
                  <PowerOff className="w-4 h-4 mr-2" />
                  Confirmar Desativação
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
