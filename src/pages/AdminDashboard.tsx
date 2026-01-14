import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Eye, 
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
  Trash2,
  Plus
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
import type { ImportMode, ImportData } from '@/types/lens';
import { toast } from 'sonner';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('import');
  const [jsonInput, setJsonInput] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('increment');
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[]; summary: any } | null>(null);
  
  const { 
    macros, 
    families, 
    modules, 
    supplierPriorities,
    toggleFamilyActive,
    toggleModuleActive,
    addMacros,
    addFamilies,
    addModules,
    setMacros,
    setFamilies,
    setModules,
    updateSupplierPriority,
    clearAllData
  } = useLensStore();

  const validateJson = () => {
    try {
      const data: ImportData = JSON.parse(jsonInput);
      const errors: string[] = [];
      const summary = {
        macros: data.macros?.length || 0,
        families: data.families?.length || 0,
        modules: data.modules?.length || 0,
        prices: data.prices?.length || 0,
        standaloneProducts: data.standaloneProducts?.length || 0,
        supplierPriorities: data.supplierPriorities?.length || 0,
      };

      // Validate structure
      if (data.families) {
        data.families.forEach((f, i) => {
          if (!f.id) errors.push(`Família ${i + 1}: ID obrigatório`);
          if (!f.macroId) errors.push(`Família ${i + 1}: macroId obrigatório`);
          if (!f.tier) errors.push(`Família ${i + 1}: tier obrigatório`);
        });
      }

      if (data.modules) {
        data.modules.forEach((m, i) => {
          if (!m.id) errors.push(`Módulo ${i + 1}: ID obrigatório`);
          if (!m.compatibleMacros?.length) errors.push(`Módulo ${i + 1}: compatibleMacros obrigatório`);
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
      const data: ImportData = JSON.parse(jsonInput);
      
      if (importMode === 'replace') {
        clearAllData();
        if (data.macros) setMacros(data.macros);
        if (data.families) setFamilies(data.families);
        if (data.modules) setModules(data.modules);
      } else {
        if (data.macros) addMacros(data.macros);
        if (data.families) addFamilies(data.families);
        if (data.modules) addModules(data.modules);
      }
      
      toast.success('Importação realizada com sucesso!');
      setJsonInput('');
      setValidationResult(null);
    } catch (e) {
      toast.error('Erro ao aplicar importação');
    }
  };

  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'essential': return 'bg-muted text-muted-foreground';
      case 'comfort': return 'bg-primary/10 text-primary';
      case 'advanced': return 'bg-info/10 text-info';
      case 'top': return 'bg-secondary/10 text-secondary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'essential': return 'Essencial';
      case 'comfort': return 'Conforto';
      case 'advanced': return 'Avançada';
      case 'top': return 'Top de Mercado';
      default: return tier;
    }
  };

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
              <ListOrdered className="w-4 h-4" />
              <span>{modules.length} módulos</span>
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
            <TabsTrigger value="modules" className="gap-2">
              <Settings2 className="w-4 h-4" />
              Módulos
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
                    Cole o JSON com os dados a serem importados
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
  "macros": [...],
  "families": [...],
  "modules": [...],
  "prices": [...],
  "supplierPriorities": [...]
}`}
                    className="min-h-[400px] font-mono text-sm"
                  />
                </CardContent>
              </Card>

              {/* Validation Result */}
              <Card>
                <CardHeader>
                  <CardTitle>Resultado da Validação</CardTitle>
                  <CardDescription>
                    Resumo e erros encontrados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!validationResult ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <FileJson className="w-12 h-12 mb-4 opacity-50" />
                      <p>Cole um JSON e clique em Validar</p>
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
                              (value as number) > 0 && (
                                <div key={key} className="flex justify-between p-2 bg-muted/50 rounded">
                                  <span className="text-muted-foreground">{key}</span>
                                  <span className="font-medium">{value as number}</span>
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Errors */}
                      {validationResult.errors.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-destructive">Erros</h4>
                          <div className="space-y-1">
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
                          Aplicar Importação ({importMode === 'increment' ? 'Incrementar' : 'Substituir'})
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
                  Defina a ordem de preferência comercial para cada categoria
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {macros.map((macro) => {
                    const priority = supplierPriorities.find(p => p.macroId === macro.id);
                    const suppliers = priority?.suppliers || [];
                    const allSuppliers = [...new Set(families.filter(f => f.macroId === macro.id).map(f => f.supplier))];
                    
                    return (
                      <Collapsible key={macro.id}>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
                            <div>
                              <h4 className="font-medium text-foreground">{macro.name}</h4>
                              <p className="text-sm text-muted-foreground">{macro.description}</p>
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
                                <div key={supplier} className="flex items-center gap-3 p-3 bg-card rounded border">
                                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                                  <Badge className={idx === 0 ? 'bg-secondary text-secondary-foreground' : 'bg-muted text-muted-foreground'}>
                                    {idx + 1}º
                                  </Badge>
                                  <span className="font-medium">{supplier}</span>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  Famílias de Produtos
                </CardTitle>
                <CardDescription>
                  Gerencie as famílias de lentes disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {families.map((family) => (
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
                            <span className="font-medium text-foreground">{family.name}</span>
                            <Badge className={getTierBadgeClass(family.tier)}>
                              {getTierLabel(family.tier)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <span>{family.supplier}</span>
                            <span>•</span>
                            <span>{family.commercialName}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground">
                          R$ {family.basePrice.toLocaleString('pt-BR')}
                        </div>
                        <div className="text-xs text-muted-foreground">preço base</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Modules Tab */}
          <TabsContent value="modules" className="space-y-6 animate-fade-in">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" />
                  Módulos Adicionais
                </CardTitle>
                <CardDescription>
                  Tratamentos e complementos para as lentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {modules.map((module) => (
                    <div 
                      key={module.id}
                      className={`p-4 rounded-lg border transition-all ${
                        module.active ? 'bg-card' : 'bg-muted/30 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-foreground">{module.name}</h4>
                          <p className="text-sm text-muted-foreground">{module.commercialName}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleModuleActive(module.id)}
                          className={module.active ? 'text-success' : 'text-muted-foreground'}
                        >
                          {module.active ? (
                            <ToggleRight className="w-5 h-5" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{module.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {module.compatibleMacros.slice(0, 2).map((m) => (
                            <Badge key={m} variant="outline" className="text-xs">
                              {macros.find(macro => macro.id === m)?.name || m}
                            </Badge>
                          ))}
                          {module.compatibleMacros.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{module.compatibleMacros.length - 2}
                            </Badge>
                          )}
                        </div>
                        <span className="font-bold text-primary">
                          +R$ {module.price}
                        </span>
                      </div>
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
