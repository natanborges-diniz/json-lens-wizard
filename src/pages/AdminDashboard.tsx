import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Upload, 
  FileJson, 
  ListOrdered, 
  Package, 
  Settings2,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  DollarSign,
  Loader2,
  Download,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  FileText,
  AlertCircle,
  Info,
  ShieldCheck,
  XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { useLensStore } from '@/store/lensStore';
import type { ImportMode, LensData } from '@/types/lens';
import { formatImportReceipt, type ImportResult, type ImportSummary } from '@/lib/catalogImporter';
import { CatalogVersionBadge, saveCatalogVersion } from '@/components/audit/CatalogVersionBadge';
import { CatalogVersionHistory } from '@/components/audit/CatalogVersionHistory';
import { CloudSyncIndicator } from '@/components/audit/CloudSyncIndicator';
import { CloudSaveConfirmDialog } from '@/components/audit/CloudSaveConfirmDialog';
import { ImportValidationReport } from '@/components/audit/ImportValidationReport';
import { validateCatalogImport, executePostImportActions, clearRulesCache, type ValidationReport } from '@/lib/catalogValidationEngine';
import { toast } from 'sonner';

// Tier mapping for display (fallback, prefer JSON data)
const macroToTier: Record<string, string> = {
  'PROG_BASICO': 'Essencial',
  'PROG_CONFORTO': 'Conforto',
  'PROG_AVANCADO': 'Avançada',
  'PROG_TOP': 'Top de Mercado',
  'MONO_BASICO': 'Essencial',
  'MONO_ENTRADA': 'Conforto',
  'MONO_INTER': 'Avançada',
  'MONO_TOP': 'Top de Mercado',
  // Ocupacionais
  'OC_BASICO': 'Essencial',
  'OC_CONFORTO': 'Conforto',
  'OC_AVANCADO': 'Avançada',
};

const macroToBadgeClass: Record<string, string> = {
  'PROG_BASICO': 'bg-muted text-muted-foreground',
  'PROG_CONFORTO': 'bg-primary/10 text-primary',
  'PROG_AVANCADO': 'bg-info/10 text-info',
  'PROG_TOP': 'bg-secondary/10 text-secondary',
  'MONO_BASICO': 'bg-muted text-muted-foreground',
  'MONO_ENTRADA': 'bg-primary/10 text-primary',
  'MONO_INTER': 'bg-info/10 text-info',
  'MONO_TOP': 'bg-secondary/10 text-secondary',
  // Ocupacionais
  'OC_BASICO': 'bg-cyan-100 text-cyan-700',
  'OC_CONFORTO': 'bg-teal-100 text-teal-700',
  'OC_AVANCADO': 'bg-emerald-100 text-emerald-700',
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('import');
  const [jsonInput, setJsonInput] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('replace');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [pendingImportData, setPendingImportData] = useState<LensData | null>(null);
  const [showCloudSaveDialog, setShowCloudSaveDialog] = useState(false);
  const [cloudSaveImportSummary, setCloudSaveImportSummary] = useState<{ familiesCount: number; pricesCount: number; mode: string } | null>(null);
  
  const { 
    schemaVersion,
    attributeDefs,
    macros, 
    families, 
    addons,
    prices,
    supplierPriorities,
    technologyLibrary,
    benefitRules,
    quoteExplainer,
    indexDisplay,
    rawLensData,
    lastImportSummary,
    toggleFamilyActive,
    toggleAddonActive,
    loadLensData,
    clearAllData,
    importCatalog,
    canRollback,
    rollbackLastImport,
    updateSupplierPriority,
    isDataLoaded,
    // Cloud functions
    loadCatalogFromCloud
  } = useLensStore();

  // Load data on mount - try cloud first, then fallback to lenses.json
  useEffect(() => {
    const loadData = async () => {
      // Check if we actually have data, not just the isDataLoaded flag
      if (families.length === 0) {
        setIsLoading(true);
        try {
          // Try to load from cloud first
          const cloudLoaded = await loadCatalogFromCloud();
          
          if (!cloudLoaded) {
            // Fallback to local lenses.json
            console.log('No cloud catalog found, loading from lenses.json...');
            const response = await fetch('/data/lenses.json');
            const data: LensData = await response.json();
            console.log('Loading initial data from lenses.json:', data.families?.length, 'families');
            loadLensData(data);
          }
        } catch (error) {
          console.error('Error loading lens data:', error);
          // Final fallback
          try {
            const response = await fetch('/data/lenses.json');
            const data: LensData = await response.json();
            loadLensData(data);
          } catch (e) {
            console.error('Failed to load fallback data:', e);
          }
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadData();
  }, [families.length, loadLensData, loadCatalogFromCloud]);


  // Sanitize JSON string BEFORE parsing - replace NaN, Infinity, -Infinity with null
  const sanitizeJsonString = (jsonString: string): string => {
    return jsonString
      .replace(/:\s*NaN\b/g, ': null')
      .replace(/:\s*-?Infinity\b/g, ': null')
      .replace(/,\s*NaN\b/g, ', null')
      .replace(/,\s*-?Infinity\b/g, ', null')
      .replace(/\[\s*NaN\b/g, '[null')
      .replace(/\[\s*-?Infinity\b/g, '[null');
  };

  // Policy-compliant validation and import - now with pre-validation step (async)
  const validateAndPreviewImport = async () => {
    try {
      // Sanitize JSON string before parsing to handle NaN, Infinity
      const sanitizedInput = sanitizeJsonString(jsonInput);
      
      // Check if sanitization was needed (for user feedback)
      const hadInvalidValues = sanitizedInput !== jsonInput;
      
      const data = JSON.parse(sanitizedInput) as LensData;
      
      // STEP 1: Run comprehensive validation BEFORE import (now async)
      // Clear rules cache to ensure fresh rules are loaded
      clearRulesCache();
      console.log('[AdminDashboard] Running pre-import validation...');
      const report = await validateCatalogImport(data, importMode);
      setValidationReport(report);
      
      if (hadInvalidValues) {
        toast.info('Valores NaN/Infinity foram convertidos para null');
      }
      
      // If there are blocking errors, stop here
      if (!report.isValid) {
        setPendingImportData(null);
        toast.error(`Validação falhou: ${report.summary.totalBlockingErrors} erro(s) bloqueante(s)`);
        return;
      }
      
      // Store pending data for later confirmation
      setPendingImportData(data);
      
      // If there are only warnings, show them but allow proceeding
      if (report.warnings.length > 0) {
        toast.warning(`${report.warnings.length} alerta(s) encontrado(s). Revise antes de prosseguir.`);
      } else {
        toast.success('Validação aprovada! Pronto para importar.');
      }
      
    } catch (e) {
      setValidationReport({
        isValid: false,
        blockingErrors: [{
          code: 'JSON_PARSE_ERROR',
          ruleId: 'JSON_PARSE',
          message: 'JSON inválido: ' + (e as Error).message,
          section: 'root',
          severity: 'blocking'
        }],
        warnings: [],
        summary: {
          totalBlockingErrors: 1,
          totalWarnings: 0,
          affectedFamilies: [],
          affectedSkus: [],
          byRuleId: { 'JSON_PARSE': 1 }
        },
        rulesVersion: 'N/A',
        timestamp: new Date().toISOString()
      });
      setPendingImportData(null);
      toast.error('JSON inválido');
    }
  };

  // Execute import after validation approval (with post-import actions)
  const executeValidatedImport = async () => {
    if (!pendingImportData || !validationReport) {
      toast.error('Nenhum dado pendente para importar');
      return;
    }
    
    // Execute post-import actions (e.g., AUTO_DISABLE_FAMILIES_WITHOUT_SKU)
    let dataToImport = pendingImportData;
    let postImportMessages: string[] = [];
    
    if (validationReport.warnings.length > 0) {
      try {
        const { modifiedData, results } = await executePostImportActions(pendingImportData, validationReport);
        dataToImport = modifiedData;
        
        // Collect messages from post-import actions
        results.forEach(result => {
          postImportMessages.push(`${result.message} (${result.affectedItems.length} itens)`);
        });
      } catch (error) {
        console.error('Post-import actions error:', error);
        // Continue with original data if post-import actions fail
      }
    }
    
    // Use new policy-compliant import system
    const result = importCatalog(dataToImport, importMode);
    setImportResult(result);
    
    if (result.success) {
      setShowReceipt(true);
      toast.success(`Importação ${importMode === 'replace' ? 'substituição' : 'incremento'} realizada com sucesso!`);
      
      // Show post-import action messages
      postImportMessages.forEach(msg => {
        toast.info(msg, { duration: 5000 });
      });
      
      setJsonInput('');
      setValidationReport(null);
      setPendingImportData(null);
      
      // Save version record to database
      const mergedData = result.mergedData;
      if (mergedData) {
        const version = await saveCatalogVersion({
          schemaVersion: mergedData.meta?.schema_version || '1.0',
          datasetName: mergedData.meta?.dataset_name,
          importMode: importMode,
          familiesCount: mergedData.families?.length || 0,
          pricesCount: mergedData.prices?.length || 0,
          addonsCount: mergedData.addons?.length || 0,
          technologiesCount: Object.keys(mergedData.technology_library?.items || {}).length,
          changesSummary: result.summary ? {
            mode: result.summary.mode,
            changes: result.summary.changes,
            totals: result.summary.totals,
            postImportActions: postImportMessages,
          } : undefined,
          notes: mergedData.meta?.notes,
        });
        
        if (version) {
          toast.success(`Versão v${version.version_number} registrada`);
        }
        
        // Open cloud save confirmation dialog
        setCloudSaveImportSummary({
          familiesCount: mergedData.families?.length || 0,
          pricesCount: mergedData.prices?.length || 0,
          mode: importMode === 'replace' ? 'Substituição' : 'Incremento'
        });
        setShowCloudSaveDialog(true);
      }
    } else {
      const allErrors = [...result.validation.errors, ...result.validation.integrityErrors];
      toast.error(`Falha na importação: ${allErrors.length} erro(s) encontrado(s)`);
    }
  };

  const cancelValidation = () => {
    setValidationReport(null);
    setPendingImportData(null);
  };

  const handleRollback = () => {
    const success = rollbackLastImport();
    if (success) {
      toast.success('Rollback executado com sucesso! Dados restaurados.');
      setShowRollbackConfirm(false);
      setImportResult(null);
    } else {
      toast.error('Não foi possível executar o rollback.');
    }
  };

  // Sanitize data to replace NaN, Infinity, undefined with null for valid JSON
  const sanitizeForJson = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'number') {
      if (Number.isNaN(obj) || !Number.isFinite(obj)) return null;
      return obj;
    }
    if (typeof obj === 'string' || typeof obj === 'boolean') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeForJson);
    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        result[key] = sanitizeForJson(value);
      }
      return result;
    }
    return obj;
  };

  // Export current data as JSON - preserves ALL root keys and reflects current state
  const exportJson = () => {
    // Validate that we have data to export
    if (!families.length && !prices.length) {
      toast.error('Nenhum dado para exportar');
      return;
    }

    // Count only active items for meta
    const activeFamiliesCount = families.filter(f => f.active).length;
    const activeAddonsCount = addons.filter(a => a.active).length;
    const activePricesCount = prices.filter(p => p.active && !p.blocked).length;

    // Log export state for debugging
    console.log('[Export] Estado atual:', {
      famílias: { total: families.length, ativas: activeFamiliesCount },
      addons: { total: addons.length, ativos: activeAddonsCount },
      preços: { total: prices.length, ativos: activePricesCount }
    });

    // If we have raw data, use it as base to preserve unknown keys
    const baseData = rawLensData || {};
    
    const exportData: LensData = {
      ...baseData,
      meta: {
        schema_version: schemaVersion || '1.2',
        dataset_name: 'LensFlow Export',
        generated_at: new Date().toISOString(),
        counts: {
          families: activeFamiliesCount,
          addons: activeAddonsCount,
          skus_prices: activePricesCount
        },
        notes: ['Exported from LensFlow Admin - Estado atual do sistema']
      },
      scales: rawLensData?.scales || {},
      attribute_defs: attributeDefs,
      macros: macros,
      families: families,        // Current state with toggles applied
      addons: addons,            // Current state with toggles applied
      products_avulsos: rawLensData?.products_avulsos || [],
      prices: prices,            // Current state with toggles applied
      // Include extended fields from store
      technology_library: technologyLibrary || undefined,
      benefit_rules: benefitRules || undefined,
      quote_explainer: quoteExplainer || undefined,
      index_display: indexDisplay?.length > 0 ? indexDisplay : undefined,
    };

    // Sanitize data to ensure valid JSON (no NaN, Infinity, undefined)
    const sanitizedData = sanitizeForJson(exportData) as LensData;

    const jsonStr = JSON.stringify(sanitizedData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lenses-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success(`JSON exportado! ${activeFamiliesCount} famílias, ${activePricesCount} SKUs ativos`);
  };

  // Move supplier priority up or down
  const moveSupplierPriority = (macroId: string, supplierIndex: number, direction: 'up' | 'down') => {
    const priority = supplierPriorities.find(p => p.macroId === macroId);
    if (!priority) return;
    
    const suppliers = [...priority.suppliers];
    const newIndex = direction === 'up' ? supplierIndex - 1 : supplierIndex + 1;
    
    if (newIndex < 0 || newIndex >= suppliers.length) return;
    
    // Swap positions
    [suppliers[supplierIndex], suppliers[newIndex]] = [suppliers[newIndex], suppliers[supplierIndex]];
    
    updateSupplierPriority(macroId, suppliers);
    toast.success(`Prioridade de ${suppliers[newIndex]} atualizada!`);
  };

  // Group families by category
  const progressiveFamilies = families.filter(f => f.category === 'PROGRESSIVA');
  const monofocalFamilies = families.filter(f => f.category === 'MONOFOCAL');
  const occupationalFamilies = families.filter(f => f.category === 'OCUPACIONAL');

  // Get price count for a family
  const getPriceCount = (familyId: string) => {
    return prices.filter(p => p.family_id === familyId && p.active && !p.blocked).length;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-premium flex items-center justify-center">
                <Settings2 className="w-5 h-5 text-secondary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Administrador</h1>
                <p className="text-xs text-muted-foreground">Curadoria e Estratégia</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Version Badge */}
            <CatalogVersionBadge onViewHistory={() => setShowVersionHistory(true)} />
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span>{families.length} famílias</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                <span>{prices.length} SKUs</span>
              </div>
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                <span>{addons.length} add-ons</span>
              </div>
            </div>
            
            <Link to="/audit">
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="w-4 h-4" />
                Edição Manual
              </Button>
            </Link>
            
            <Link to="/catalog-audit">
              <Button variant="outline" size="sm" className="gap-2">
                <AlertCircle className="w-4 h-4" />
                Auditoria
              </Button>
            </Link>
            
            <CloudSyncIndicator />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="import" className="gap-2">
              <Upload className="w-4 h-4" />
              Importação JSON
            </TabsTrigger>
            <TabsTrigger value="priorities" className="gap-2">
              <ListOrdered className="w-4 h-4" />
              Prioridades
            </TabsTrigger>
            <TabsTrigger value="families" className="gap-2">
              <Package className="w-4 h-4" />
              Famílias
            </TabsTrigger>
            <TabsTrigger value="addons" className="gap-2">
              <Settings2 className="w-4 h-4" />
              Add-ons
            </TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-6 animate-fade-in">
            <div className="grid lg:grid-cols-2 gap-6">
              {/* JSON Input */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileJson className="w-5 h-5 text-primary" />
                    Entrada JSON
                  </CardTitle>
                  <CardDescription>
                    Cole o JSON unificado com famílias, addons e preços
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4 flex-wrap">
                    <Select value={importMode} onValueChange={(v) => setImportMode(v as ImportMode)}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="increment">Incrementar</SelectItem>
                        <SelectItem value="replace">Substituir</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={validateAndPreviewImport} disabled={!jsonInput.trim()}>
                      <ShieldCheck className="w-4 h-4 mr-2" />
                      Validar
                    </Button>
                    {canRollback() && (
                      <Button variant="outline" onClick={() => setShowRollbackConfirm(true)}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Desfazer
                      </Button>
                    )}
                  </div>
                  
                  <Textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder={`{
  "meta": { "schema_version": "1.2", ... },
  "macros": [...],
  "families": [...],
  "addons": [...],
  "prices": [...]
}`}
                    className="min-h-[350px] font-mono text-sm"
                  />
                </CardContent>
              </Card>

              {/* Import Result & Validation Report */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-primary" />
                      <span>Validação e Resultado</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportJson} className="gap-2">
                      <Download className="w-4 h-4" />
                      Exportar
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Validation Report */}
                  {validationReport ? (
                    <ImportValidationReport 
                      report={validationReport}
                      onProceed={validationReport.isValid ? executeValidatedImport : undefined}
                      onCancel={cancelValidation}
                      showActions={true}
                    />
                  ) : !importResult ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileJson className="w-12 h-12 mb-4 opacity-50" />
                      <p>Cole um JSON e clique em Validar</p>
                      <p className="text-xs mt-2">O motor de validação verificará erros bloqueantes e alertas</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-lg flex items-center gap-3 ${
                        importResult.success 
                          ? 'bg-success/10 text-success' 
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {importResult.success ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5" />
                        )}
                        <span className="font-medium">
                          {importResult.success ? 'Importação realizada!' : 'Erros encontrados'}
                        </span>
                      </div>

                      {/* Show detailed errors when import fails */}
                      {!importResult.success && importResult.validation && (
                        <div className="space-y-3">
                          {importResult.validation.errors.length > 0 && (
                            <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                              <h4 className="font-medium text-destructive text-sm mb-2 flex items-center gap-2">
                                <XCircle className="w-4 h-4" />
                                Erros de Validação ({importResult.validation.errors.length})
                              </h4>
                              <ul className="space-y-1 text-sm text-destructive/80">
                                {importResult.validation.errors.map((error, idx) => (
                                  <li key={idx} className="pl-4 relative before:content-['•'] before:absolute before:left-1">
                                    {error}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {importResult.validation.integrityErrors.length > 0 && (
                            <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                              <h4 className="font-medium text-amber-600 text-sm mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Erros de Integridade ({importResult.validation.integrityErrors.length})
                              </h4>
                              <ul className="space-y-1 text-sm text-amber-600/80">
                                {importResult.validation.integrityErrors.map((error, idx) => (
                                  <li key={idx} className="pl-4 relative before:content-['•'] before:absolute before:left-1">
                                    {error}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {importResult.validation.warnings.length > 0 && (
                            <div className="p-3 bg-muted/50 border rounded-lg">
                              <h4 className="font-medium text-muted-foreground text-sm mb-2 flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                Avisos ({importResult.validation.warnings.length})
                              </h4>
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                {importResult.validation.warnings.map((warning, idx) => (
                                  <li key={idx} className="pl-4 relative before:content-['•'] before:absolute before:left-1">
                                    {warning}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {importResult.success && importResult.summary && (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="p-2 bg-muted/50 rounded flex justify-between">
                            <span className="text-muted-foreground">Famílias</span>
                            <span className="font-medium">{importResult.summary.totals.families}</span>
                          </div>
                          <div className="p-2 bg-muted/50 rounded flex justify-between">
                            <span className="text-muted-foreground">SKUs</span>
                            <span className="font-medium">{importResult.summary.totals.prices}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Rollback Confirmation Dialog */}
            <Dialog open={showRollbackConfirm} onOpenChange={setShowRollbackConfirm}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar Rollback</DialogTitle>
                  <DialogDescription>
                    Isso irá restaurar os dados anteriores à última importação. Esta ação não pode ser desfeita.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowRollbackConfirm(false)}>Cancelar</Button>
                  <Button variant="destructive" onClick={handleRollback}>Confirmar Rollback</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Priorities Tab */}
          <TabsContent value="priorities" className="space-y-6 animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListOrdered className="w-5 h-5 text-primary" />
                  Prioridade de Fornecedores por Macro
                </CardTitle>
                <CardDescription>
                  Use as setas para reordenar a preferência comercial para cada categoria
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {macros.map((macro) => {
                    const priority = supplierPriorities.find(p => p.macroId === macro.id);
                    const suppliers = priority?.suppliers || [];
                    
                    return (
                      <Collapsible key={macro.id} defaultOpen>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-foreground">{macro.name_client}</h4>
                                <Badge variant="outline" className="text-xs">{macro.category}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{macro.description_client}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{suppliers.length} fornecedores</Badge>
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="p-4 border border-t-0 rounded-b-lg space-y-2">
                            {suppliers.length > 0 ? (
                              suppliers.map((supplier, idx) => (
                                <div key={supplier} className="flex items-center gap-3 p-3 bg-card rounded border group">
                                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                                  <Badge className={idx === 0 ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}>
                                    {idx + 1}º
                                  </Badge>
                                  <span className="font-medium flex-1">{supplier}</span>
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      disabled={idx === 0}
                                      onClick={() => moveSupplierPriority(macro.id, idx, 'up')}
                                    >
                                      <ArrowUp className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      disabled={idx === suppliers.length - 1}
                                      onClick={() => moveSupplierPriority(macro.id, idx, 'down')}
                                    >
                                      <ArrowDown className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-muted-foreground py-2">
                                Nenhuma prioridade definida. Adicione famílias para este macro.
                              </p>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Families Tab */}
          <TabsContent value="families" className="space-y-6 animate-fade-in">
            {/* Progressive Families */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Lentes Progressivas
                </CardTitle>
                <CardDescription>
                  {progressiveFamilies.length} famílias disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {progressiveFamilies.map((family) => (
                    <div 
                      key={family.id} 
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                        family.active ? 'bg-card' : 'bg-muted/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleFamilyActive(family.id)}
                          className={family.active ? 'text-success' : 'text-muted-foreground'}
                        >
                          {family.active ? (
                            <ToggleRight className="w-6 h-6" />
                          ) : (
                            <ToggleLeft className="w-6 h-6" />
                          )}
                        </Button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{(family as any).display_name || (family as any).name_display || family.name_original}</span>
                            <Badge className={macroToBadgeClass[family.macro] || 'bg-muted'}>
                              {macroToTier[family.macro] || family.macro}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span>{family.supplier}</span>
                            <span>•</span>
                            <span>{getPriceCount(family.id)} SKUs ativos</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {(family.attributes_display_base ?? []).slice(0, 2).map((attr, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {attr.length > 30 ? attr.slice(0, 30) + '...' : attr}
                          </Badge>
                        ))}
                        {(family.attributes_display_base?.length ?? 0) > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{(family.attributes_display_base?.length ?? 0) - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Monofocal Families */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-info" />
                  Lentes Monofocais
                </CardTitle>
                <CardDescription>
                  {monofocalFamilies.length} famílias disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {monofocalFamilies.map((family) => (
                    <div 
                      key={family.id} 
                      className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                        family.active ? 'bg-card' : 'bg-muted/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleFamilyActive(family.id)}
                          className={family.active ? 'text-success' : 'text-muted-foreground'}
                        >
                          {family.active ? (
                            <ToggleRight className="w-6 h-6" />
                          ) : (
                            <ToggleLeft className="w-6 h-6" />
                          )}
                        </Button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{(family as any).display_name || (family as any).name_display || family.name_original}</span>
                            <Badge className={macroToBadgeClass[family.macro] || 'bg-muted'}>
                              {macroToTier[family.macro] || family.macro}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span>{family.supplier}</span>
                            <span>•</span>
                            <span>{getPriceCount(family.id)} SKUs ativos</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {(family.attributes_display_base ?? []).slice(0, 2).map((attr, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {attr.length > 30 ? attr.slice(0, 30) + '...' : attr}
                          </Badge>
                        ))}
                        {(family.attributes_display_base?.length ?? 0) > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{(family.attributes_display_base?.length ?? 0) - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Occupational Families */}
            {occupationalFamilies.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-cyan-600" />
                    Lentes Ocupacionais
                  </CardTitle>
                  <CardDescription>
                    {occupationalFamilies.length} famílias disponíveis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {occupationalFamilies.map((family) => (
                      <div 
                        key={family.id} 
                        className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                          family.active ? 'bg-card' : 'bg-muted/30 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleFamilyActive(family.id)}
                            className={family.active ? 'text-success' : 'text-muted-foreground'}
                          >
                            {family.active ? (
                              <ToggleRight className="w-6 h-6" />
                            ) : (
                              <ToggleLeft className="w-6 h-6" />
                            )}
                          </Button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{(family as any).display_name || (family as any).name_display || family.name_original}</span>
                              <Badge className={macroToBadgeClass[family.macro] || 'bg-cyan-100 text-cyan-700'}>
                                {macroToTier[family.macro] || family.macro}
                              </Badge>
                              <Badge variant="outline" className="text-xs bg-cyan-50">
                                Ocupacional
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                              <span>{family.supplier}</span>
                              <span>•</span>
                              <span>{getPriceCount(family.id)} SKUs ativos</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {(family.attributes_display_base ?? []).slice(0, 2).map((attr, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {attr.length > 30 ? attr.slice(0, 30) + '...' : attr}
                            </Badge>
                          ))}
                          {(family.attributes_display_base?.length ?? 0) > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{(family.attributes_display_base?.length ?? 0) - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Addons Tab */}
          <TabsContent value="addons" className="space-y-6 animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" />
                  Add-ons Disponíveis
                </CardTitle>
                <CardDescription>
                  Tratamentos e complementos para as lentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {addons.map((addon) => (
                    <div 
                      key={addon.id}
                      className={`p-4 rounded-lg border transition-all ${
                        addon.active ? 'bg-card' : 'bg-muted/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-foreground">{addon.name_common}</h4>
                          <div className="flex gap-1 mt-1">
                            {addon.rules.categories.map(cat => (
                              <Badge key={cat} variant="outline" className="text-xs">
                                {cat}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleAddonActive(addon.id)}
                          className={addon.active ? 'text-success' : 'text-muted-foreground'}
                        >
                          {addon.active ? (
                            <ToggleRight className="w-5 h-5" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{addon.description_client}</p>
                      
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Nomes comerciais:</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(addon.name_commercial).map(([supplier, name]) => (
                            <Badge key={supplier} variant="secondary" className="text-xs">
                              {supplier}: {name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      {addon.impact && Object.keys(addon.impact).length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Impacto nos atributos:</p>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(addon.impact).map(([attr, value]) => (
                              <Badge key={attr} className="text-xs bg-primary/10 text-primary">
                                {attr}: +{value}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Version History Dialog */}
      <CatalogVersionHistory 
        open={showVersionHistory} 
        onOpenChange={setShowVersionHistory} 
      />
      
      {/* Cloud Save Confirmation Dialog */}
      <CloudSaveConfirmDialog
        open={showCloudSaveDialog}
        onOpenChange={setShowCloudSaveDialog}
        importSummary={cloudSaveImportSummary || undefined}
        onSaveComplete={() => {
          setCloudSaveImportSummary(null);
        }}
      />
    </div>
  );
};

export default AdminDashboard;
