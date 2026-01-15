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
  ArrowDown
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
import { useLensStore } from '@/store/lensStore';
import type { ImportMode, LensData } from '@/types/lens';
import { toast } from 'sonner';

// Tier mapping for display
const macroToTier: Record<string, string> = {
  'PROG_BASICO': 'Essencial',
  'PROG_CONFORTO': 'Conforto',
  'PROG_AVANCADO': 'Avançada',
  'PROG_TOP': 'Top de Mercado',
  'MONO_BASICO': 'Essencial',
  'MONO_ENTRADA': 'Conforto',
  'MONO_INTER': 'Avançada',
  'MONO_TOP': 'Top de Mercado',
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
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('import');
  const [jsonInput, setJsonInput] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('replace');
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[]; summary: any } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { 
    schemaVersion,
    attributeDefs,
    macros, 
    families, 
    addons,
    prices,
    supplierPriorities,
    toggleFamilyActive,
    toggleAddonActive,
    loadLensData,
    clearAllData,
    updateSupplierPriority,
    isDataLoaded
  } = useLensStore();

  // Load data on mount - always load from JSON if families are empty
  useEffect(() => {
    const loadData = async () => {
      // Check if we actually have data, not just the isDataLoaded flag
      if (families.length === 0) {
        setIsLoading(true);
        try {
          const response = await fetch('/data/lenses.json');
          const data: LensData = await response.json();
          console.log('Loading initial data from lenses.json:', data.families?.length, 'families');
          loadLensData(data);
        } catch (error) {
          console.error('Error loading lens data:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadData();
  }, [families.length, loadLensData]);

  const validateJson = () => {
    try {
      const data: LensData = JSON.parse(jsonInput);
      const errors: string[] = [];
      const summary = {
        schema_version: data.meta?.schema_version || 'N/A',
        macros: data.macros?.length || 0,
        families: data.families?.length || 0,
        addons: data.addons?.length || 0,
        prices: data.prices?.length || 0,
      };

      // Validate structure
      if (!data.meta) errors.push('Campo "meta" ausente');
      if (!data.macros) errors.push('Campo "macros" ausente');
      if (!data.families) errors.push('Campo "families" ausente');
      if (!data.addons) errors.push('Campo "addons" ausente');
      if (!data.prices) errors.push('Campo "prices" ausente');

      if (data.families) {
        data.families.forEach((f, i) => {
          if (!f.id) errors.push(`Família ${i + 1}: ID obrigatório`);
          if (!f.macro) errors.push(`Família ${i + 1}: macro obrigatório`);
          if (!f.supplier) errors.push(`Família ${i + 1}: supplier obrigatório`);
        });
      }

      if (data.prices) {
        data.prices.forEach((p, i) => {
          if (!p.erp_code) errors.push(`Price ${i + 1}: erp_code obrigatório`);
          if (!p.family_id) errors.push(`Price ${i + 1}: family_id obrigatório`);
        });
      }

      setValidationResult({
        valid: errors.length === 0,
        errors,
        summary
      });

    } catch (e) {
      setValidationResult({
        valid: false,
        errors: ['JSON inválido: ' + (e as Error).message],
        summary: null
      });
    }
  };

  const applyImport = () => {
    if (!validationResult?.valid) return;
    
    try {
      const data: LensData = JSON.parse(jsonInput);
      
      // Always clear and reload all data to ensure complete sync
      clearAllData();
      loadLensData(data);
      
      toast.success(`Importação realizada com sucesso! ${data.families.length} famílias, ${data.addons.length} add-ons e ${data.prices.length} SKUs carregados.`);
      setJsonInput('');
      setValidationResult(null);
    } catch (e) {
      toast.error('Erro ao aplicar importação');
    }
  };

  // Export current data as JSON
  const exportJson = () => {
    const exportData: LensData = {
      meta: {
        schema_version: schemaVersion || '1.1',
        dataset_name: 'LensFlow Export',
        generated_at: new Date().toISOString(),
        counts: {
          families: families.length,
          addons: addons.length,
          skus_prices: prices.length
        },
        notes: ['Exported from LensFlow Admin']
      },
      scales: {},
      attribute_defs: attributeDefs,
      macros: macros,
      families: families,
      addons: addons,
      products_avulsos: [],
      prices: prices
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lenses-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('JSON exportado com sucesso!');
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
                  <div className="flex gap-4">
                    <Select value={importMode} onValueChange={(v) => setImportMode(v as ImportMode)}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="increment">Incrementar</SelectItem>
                        <SelectItem value="replace">Substituir</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={validateJson}>
                      Validar JSON
                    </Button>
                  </div>
                  
                  <Textarea
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder={`{
  "meta": { "schema_version": "1.1", ... },
  "macros": [...],
  "families": [...],
  "addons": [...],
  "prices": [...]
}`}
                    className="min-h-[400px] font-mono text-sm"
                  />
                </CardContent>
              </Card>

              {/* Validation Result & Export */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Resultado da Validação</span>
                    <Button variant="outline" size="sm" onClick={exportJson} className="gap-2">
                      <Download className="w-4 h-4" />
                      Exportar JSON
                    </Button>
                  </CardTitle>
                  <CardDescription>
                    Resumo e erros encontrados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!validationResult ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileJson className="w-12 h-12 mb-4 opacity-50" />
                      <p>Cole um JSON e clique em Validar</p>
                      <p className="text-sm mt-2">ou exporte os dados atuais</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Status */}
                      <div className={`p-4 rounded-lg flex items-center gap-3 ${
                        validationResult.valid 
                          ? 'bg-success/10 text-success' 
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {validationResult.valid ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <AlertTriangle className="w-5 h-5" />
                        )}
                        <span className="font-medium">
                          {validationResult.valid ? 'JSON válido!' : 'Erros encontrados'}
                        </span>
                      </div>

                      {/* Summary */}
                      {validationResult.summary && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-foreground">Resumo da Importação</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            {Object.entries(validationResult.summary).map(([key, value]) => (
                              <div key={key} className="flex justify-between p-2 bg-muted/50 rounded">
                                <span className="text-muted-foreground">{key}</span>
                                <span className="font-medium">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Errors */}
                      {validationResult.errors.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-destructive">Erros</h4>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {validationResult.errors.map((error, i) => (
                              <div key={i} className="text-sm text-destructive/80 p-2 bg-destructive/5 rounded">
                                {error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Apply Button */}
                      {validationResult.valid && (
                        <Button onClick={applyImport} className="w-full gradient-primary text-primary-foreground">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Aplicar Importação (Substituir Todos os Dados)
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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
                            <span className="font-medium text-foreground">{family.name_original}</span>
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
                        {family.attributes_display_base.slice(0, 2).map((attr, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {attr.length > 30 ? attr.slice(0, 30) + '...' : attr}
                          </Badge>
                        ))}
                        {family.attributes_display_base.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{family.attributes_display_base.length - 2}
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
                            <span className="font-medium text-foreground">{family.name_original}</span>
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
                        {family.attributes_display_base.slice(0, 2).map((attr, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {attr.length > 30 ? attr.slice(0, 30) + '...' : attr}
                          </Badge>
                        ))}
                        {family.attributes_display_base.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{family.attributes_display_base.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
    </div>
  );
};

export default AdminDashboard;
