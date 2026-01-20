import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  FileText, 
  Download, 
  Copy, 
  CheckCircle2, 
  ExternalLink,
  BookOpen,
  Code,
  Wand2,
  AlertTriangle,
  Info,
  FileJson,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { useLensStore } from '@/store/lensStore';
import { useNavigate } from 'react-router-dom';

const CatalogDocumentation = () => {
  const navigate = useNavigate();
  const [guideContent, setGuideContent] = useState<string>('');
  const [promptContent, setPromptContent] = useState<string>('');
  const [schemaContent, setSchemaContent] = useState<string>('');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  const { 
    families, 
    macros, 
    prices, 
    addons,
    schemaVersion,
    technologyLibrary
  } = useLensStore();

  // Load documentation files
  useEffect(() => {
    const loadDocs = async () => {
      try {
        const [guideRes, promptRes, schemaRes] = await Promise.all([
          fetch('/docs/catalog-generation-guide.md'),
          fetch('/docs/prompt-for-ai.md'),
          fetch('/docs/catalog-schema.json')
        ]);
        
        if (guideRes.ok) setGuideContent(await guideRes.text());
        if (promptRes.ok) setPromptContent(await promptRes.text());
        if (schemaRes.ok) setSchemaContent(await schemaRes.text());
      } catch (error) {
        console.error('Error loading documentation:', error);
      }
    };
    loadDocs();
  }, []);

  // Generate current catalog stats
  const catalogStats = {
    schemaVersion: schemaVersion || '1.2',
    familiesCount: families.length,
    activeFamilies: families.filter(f => f.active).length,
    macrosCount: macros.length,
    pricesCount: prices.length,
    activePrices: prices.filter(p => p.active && !p.blocked).length,
    addonsCount: addons.length,
    technologiesCount: technologyLibrary?.items ? Object.keys(technologyLibrary.items).length : 0,
    suppliers: [...new Set(families.map(f => f.supplier))],
    categories: [...new Set(families.map(f => f.category))],
    indices: [...new Set(prices.map(p => p.index))].sort()
  };

  const copyToClipboard = async (text: string, section: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSection(section);
      toast.success('Copiado para a área de transferência');
      setTimeout(() => setCopiedSection(null), 2000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${filename} baixado`);
  };

  const generateCurrentCatalogSnapshot = () => {
    const snapshot = {
      meta: {
        schema_version: schemaVersion || '1.2',
        dataset_name: 'Snapshot do Catálogo Atual',
        generated_at: new Date().toISOString().split('T')[0],
        counts: {
          families: families.length,
          addons: addons.length,
          skus_prices: prices.length,
          technologies: catalogStats.technologiesCount
        },
        notes: ['Exportado como referência para geração externa']
      },
      macros_ids: macros.map(m => m.id),
      families_summary: families.map(f => ({
        id: f.id,
        supplier: f.supplier,
        category: f.category,
        macro: f.macro,
        active: f.active,
        skus_count: prices.filter(p => p.family_id === f.id).length
      })),
      indices_in_use: catalogStats.indices,
      suppliers: catalogStats.suppliers
    };
    return JSON.stringify(snapshot, null, 2);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Documentação do Catálogo</h1>
              <p className="text-muted-foreground">
                Referência técnica para geração de catálogos por IA externa
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-sm">
            Schema v{catalogStats.schemaVersion}
          </Badge>
        </div>

        {/* Current Catalog Stats */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              Estado Atual do Catálogo
            </CardTitle>
            <CardDescription>
              Estatísticas do catálogo carregado no sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{catalogStats.familiesCount}</div>
                <div className="text-xs text-muted-foreground">Famílias</div>
                <div className="text-xs text-green-600">{catalogStats.activeFamilies} ativas</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{catalogStats.pricesCount}</div>
                <div className="text-xs text-muted-foreground">SKUs</div>
                <div className="text-xs text-green-600">{catalogStats.activePrices} ativos</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{catalogStats.macrosCount}</div>
                <div className="text-xs text-muted-foreground">Macros</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{catalogStats.technologiesCount}</div>
                <div className="text-xs text-muted-foreground">Tecnologias</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{catalogStats.addonsCount}</div>
                <div className="text-xs text-muted-foreground">Addons</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-primary">{catalogStats.indices.length}</div>
                <div className="text-xs text-muted-foreground">Índices</div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Fornecedores:</span>
              {catalogStats.suppliers.map(s => (
                <Badge key={s} variant="secondary">{s}</Badge>
              ))}
              <span className="text-sm text-muted-foreground ml-4">Categorias:</span>
              {catalogStats.categories.map(c => (
                <Badge key={c} variant="outline">{c}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="guide" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="guide" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Guia Completo</span>
              <span className="sm:hidden">Guia</span>
            </TabsTrigger>
            <TabsTrigger value="prompt" className="flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              <span className="hidden sm:inline">Prompt para IA</span>
              <span className="sm:hidden">Prompt</span>
            </TabsTrigger>
            <TabsTrigger value="schema" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              <span className="hidden sm:inline">JSON Schema</span>
              <span className="sm:hidden">Schema</span>
            </TabsTrigger>
            <TabsTrigger value="export" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar</span>
              <span className="sm:hidden">Export</span>
            </TabsTrigger>
          </TabsList>

          {/* Guide Tab */}
          <TabsContent value="guide">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Guia de Geração de Catálogo
                    </CardTitle>
                    <CardDescription>
                      Documentação completa do schema e regras de validação
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(guideContent, 'guide')}
                    >
                      {copiedSection === 'guide' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span className="ml-2">Copiar</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => downloadFile(guideContent, 'catalog-generation-guide.md', 'text/markdown')}
                    >
                      <Download className="h-4 w-4" />
                      <span className="ml-2">.md</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] w-full rounded-md border p-4">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {guideContent || 'Carregando...'}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Prompt Tab */}
          <TabsContent value="prompt">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wand2 className="h-5 w-5" />
                      Prompt para IA Externa
                    </CardTitle>
                    <CardDescription>
                      Copie este prompt para usar com ChatGPT, Claude ou outra IA
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(promptContent, 'prompt')}
                    >
                      {copiedSection === 'prompt' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span className="ml-2">Copiar Tudo</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => downloadFile(promptContent, 'prompt-for-ai.md', 'text/markdown')}
                    >
                      <Download className="h-4 w-4" />
                      <span className="ml-2">.md</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200">Como usar este prompt</p>
                      <ol className="text-sm text-amber-700 dark:text-amber-300 mt-2 space-y-1 list-decimal list-inside">
                        <li>Copie o prompt completo abaixo</li>
                        <li>Cole em uma IA (ChatGPT, Claude, etc.)</li>
                        <li>Forneça seus dados (ERP, catálogos, fichas técnicas)</li>
                        <li>A IA gerará um JSON compatível com o sistema</li>
                      </ol>
                    </div>
                  </div>
                </div>
                <ScrollArea className="h-[500px] w-full rounded-md border p-4">
                  <pre className="text-sm whitespace-pre-wrap font-mono">
                    {promptContent || 'Carregando...'}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Schema Tab */}
          <TabsContent value="schema">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileJson className="h-5 w-5" />
                      JSON Schema Formal
                    </CardTitle>
                    <CardDescription>
                      Schema para validação automática de JSONs importados
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => copyToClipboard(schemaContent, 'schema')}
                    >
                      {copiedSection === 'schema' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                      <span className="ml-2">Copiar</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => downloadFile(schemaContent, 'catalog-schema.json', 'application/json')}
                    >
                      <Download className="h-4 w-4" />
                      <span className="ml-2">.json</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] w-full rounded-md border p-4">
                  <pre className="text-sm whitespace-pre-wrap font-mono text-muted-foreground">
                    {schemaContent || 'Carregando...'}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Exportar Documentação
                  </CardTitle>
                  <CardDescription>
                    Baixe todos os arquivos de documentação
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => downloadFile(guideContent, 'catalog-generation-guide.md', 'text/markdown')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    catalog-generation-guide.md
                    <Badge variant="secondary" className="ml-auto">Guia</Badge>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => downloadFile(promptContent, 'prompt-for-ai.md', 'text/markdown')}
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    prompt-for-ai.md
                    <Badge variant="secondary" className="ml-auto">Prompt</Badge>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => downloadFile(schemaContent, 'catalog-schema.json', 'application/json')}
                  >
                    <Code className="h-4 w-4 mr-2" />
                    catalog-schema.json
                    <Badge variant="secondary" className="ml-auto">Schema</Badge>
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ExternalLink className="h-5 w-5" />
                    Exportar Catálogo Atual
                  </CardTitle>
                  <CardDescription>
                    Use o catálogo atual como referência
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      const snapshot = generateCurrentCatalogSnapshot();
                      downloadFile(snapshot, 'catalog-snapshot.json', 'application/json');
                    }}
                  >
                    <FileJson className="h-4 w-4 mr-2" />
                    catalog-snapshot.json
                    <Badge variant="outline" className="ml-auto">Resumo</Badge>
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => {
                      const snapshot = generateCurrentCatalogSnapshot();
                      copyToClipboard(snapshot, 'snapshot');
                    }}
                  >
                    {copiedSection === 'snapshot' ? (
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    Copiar Snapshot
                    <Badge variant="outline" className="ml-auto">Clipboard</Badge>
                  </Button>
                  
                  <Separator className="my-4" />
                  
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      O snapshot contém IDs de famílias, macros e resumo das 
                      estruturas atuais para usar como referência na geração externa.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CatalogDocumentation;
