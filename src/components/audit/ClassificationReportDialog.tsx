import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Package, 
  Tag, 
  FileText,
  Download,
  Loader2
} from 'lucide-react';
import type { ClassificationReport, SkuClassificationResult } from '@/lib/skuClassificationEngine';

interface ClassificationReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ClassificationReport | null;
  onApplyChanges: () => void;
  isApplying: boolean;
}

export function ClassificationReportDialog({
  open,
  onOpenChange,
  report,
  onApplyChanges,
  isApplying
}: ClassificationReportDialogProps) {
  const [activeTab, setActiveTab] = useState('summary');

  if (!report) return null;

  const hasErrors = report.errors.length > 0;
  const hasWarnings = report.warnings.length > 0;
  const successRate = report.total_skus > 0 
    ? Math.round(((report.total_skus - report.unclassified_skus) / report.total_skus) * 100)
    : 0;

  const handleExportReport = () => {
    const content = generateReportText(report);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `classificacao-skus-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Relatório de Classificação de SKUs
          </DialogTitle>
          <DialogDescription>
            Resultado da análise e classificação automática baseada nas regras
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="summary" className="gap-1.5">
              <Package className="w-3.5 h-3.5" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="orphans" className="gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Órfãos ({report.orphaned_skus.length})
            </TabsTrigger>
            <TabsTrigger value="families" className="gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Famílias
            </TabsTrigger>
            <TabsTrigger value="issues" className="gap-1.5">
              {hasErrors ? <XCircle className="w-3.5 h-3.5 text-destructive" /> : <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
              Problemas
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 mt-4">
            <TabsContent value="summary" className="h-full m-0">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4 pr-4">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold">{report.total_skus}</p>
                        <p className="text-xs text-muted-foreground">Total SKUs</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-green-600">{report.classified_skus}</p>
                        <p className="text-xs text-muted-foreground">Classificados</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-amber-600">{report.fallback_count}</p>
                        <p className="text-xs text-muted-foreground">Fallback</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 text-center">
                        <p className="text-2xl font-bold text-destructive">{report.unclassified_skus}</p>
                        <p className="text-xs text-muted-foreground">Sem Classificar</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Success Rate */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Taxa de Sucesso</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              successRate >= 90 ? 'bg-green-500' :
                              successRate >= 70 ? 'bg-amber-500' : 'bg-destructive'
                            }`}
                            style={{ width: `${successRate}%` }}
                          />
                        </div>
                        <span className="font-bold text-lg">{successRate}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Families without prices */}
                  {report.families_without_prices.length > 0 && (
                    <Card className="border-amber-500/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          Famílias sem Preços Ativos
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1.5">
                          {report.families_without_prices.slice(0, 15).map(familyId => (
                            <Badge key={familyId} variant="outline" className="text-xs">
                              {familyId}
                            </Badge>
                          ))}
                          {report.families_without_prices.length > 15 && (
                            <Badge variant="secondary" className="text-xs">
                              +{report.families_without_prices.length - 15} mais
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Deactivated families */}
                  {report.deactivated_families.length > 0 && (
                    <Card className="border-destructive/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-destructive" />
                          Famílias Desativadas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-1.5">
                          {report.deactivated_families.map(familyId => (
                            <Badge key={familyId} variant="destructive" className="text-xs">
                              {familyId}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="orphans" className="h-full m-0">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-4">
                  {report.orphaned_skus.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                      <p>Nenhum SKU órfão encontrado!</p>
                    </div>
                  ) : (
                    report.orphaned_skus.map((sku) => (
                      <OrphanSkuCard key={sku.erp_code} sku={sku} />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="families" className="h-full m-0">
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-4">
                  {report.classification_summary
                    .filter(s => s.sku_count > 0)
                    .map((summary) => (
                      <Card key={summary.family_id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{summary.family_name}</p>
                            <p className="text-xs text-muted-foreground">{summary.family_id}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {summary.by_rule.length > 0 && (
                              <div className="flex gap-1">
                                {summary.by_rule.slice(0, 2).map(rule => (
                                  <Badge key={rule} variant="outline" className="text-[10px]">
                                    {rule}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <Badge className="bg-primary/10 text-primary">
                              {summary.sku_count} SKUs
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="issues" className="h-full m-0">
              <ScrollArea className="h-[400px]">
                <div className="space-y-4 pr-4">
                  {/* Errors */}
                  {report.errors.length > 0 && (
                    <Card className="border-destructive">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                          <XCircle className="w-4 h-4" />
                          Erros ({report.errors.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1">
                          {report.errors.map((error, i) => (
                            <li key={i} className="text-sm text-destructive">• {error}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Warnings */}
                  {report.warnings.length > 0 && (
                    <Card className="border-amber-500/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                          <AlertTriangle className="w-4 h-4" />
                          Avisos ({report.warnings.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1">
                          {report.warnings.map((warning, i) => (
                            <li key={i} className="text-sm text-amber-600">• {warning}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {/* Success */}
                  {!hasErrors && !hasWarnings && (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                      <p className="text-muted-foreground">Nenhum problema encontrado!</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleExportReport} className="gap-2">
            <Download className="w-4 h-4" />
            Exportar Relatório
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={onApplyChanges} 
              disabled={isApplying || hasErrors}
              className="gap-2"
            >
              {isApplying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Aplicar Alterações
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrphanSkuCard({ sku }: { sku: SkuClassificationResult }) {
  const matchTypeColors = {
    rule: 'bg-green-500/10 text-green-600 border-green-500/30',
    fallback: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    unchanged: 'bg-muted text-muted-foreground'
  };

  const confidenceColors = {
    high: 'text-green-600',
    medium: 'text-amber-600',
    low: 'text-destructive'
  };

  return (
    <Card className="p-3">
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs font-medium">{sku.erp_code}</p>
            <p className="text-xs text-muted-foreground truncate" title={sku.original_description}>
              {sku.original_description}
            </p>
          </div>
          <Badge className={matchTypeColors[sku.match_type]}>
            {sku.match_type === 'rule' ? 'Regra' : 
             sku.match_type === 'fallback' ? 'Fallback' : 'Inalterado'}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            {sku.original_family_id} → 
          </span>
          <span className="font-medium">{sku.new_family_id}</span>
          {sku.matched_rule_id && (
            <Badge variant="outline" className="text-[10px]">
              {sku.matched_rule_id}
            </Badge>
          )}
          <span className={`ml-auto ${confidenceColors[sku.confidence]}`}>
            {sku.confidence === 'high' ? 'Alta' : 
             sku.confidence === 'medium' ? 'Média' : 'Baixa'} confiança
          </span>
        </div>
      </div>
    </Card>
  );
}

function generateReportText(report: ClassificationReport): string {
  const lines: string[] = [];
  
  lines.push('═'.repeat(60));
  lines.push('RELATÓRIO DE CLASSIFICAÇÃO DE SKUs');
  lines.push('═'.repeat(60));
  lines.push(`Data: ${new Date(report.timestamp).toLocaleString('pt-BR')}`);
  lines.push('');
  
  lines.push('📊 RESUMO GERAL');
  lines.push('-'.repeat(40));
  lines.push(`Total de SKUs: ${report.total_skus}`);
  lines.push(`SKUs classificados por regra: ${report.classified_skus}`);
  lines.push(`SKUs usando fallback: ${report.fallback_count}`);
  lines.push(`SKUs sem classificação: ${report.unclassified_skus}`);
  lines.push('');
  
  if (report.families_without_prices.length > 0) {
    lines.push('⚠️ FAMÍLIAS SEM PREÇOS ATIVOS');
    lines.push('-'.repeat(40));
    for (const familyId of report.families_without_prices) {
      lines.push(`  • ${familyId}`);
    }
    lines.push('');
  }
  
  if (report.orphaned_skus.length > 0) {
    lines.push('🔍 SKUs ÓRFÃOS');
    lines.push('-'.repeat(40));
    for (const sku of report.orphaned_skus) {
      lines.push(`  • ${sku.erp_code}`);
      lines.push(`    Original: ${sku.original_family_id} → Novo: ${sku.new_family_id}`);
      lines.push(`    Descrição: ${sku.original_description}`);
      lines.push('');
    }
  }
  
  if (report.errors.length > 0) {
    lines.push('❌ ERROS');
    lines.push('-'.repeat(40));
    for (const error of report.errors) {
      lines.push(`  • ${error}`);
    }
    lines.push('');
  }
  
  if (report.warnings.length > 0) {
    lines.push('⚠️ AVISOS');
    lines.push('-'.repeat(40));
    for (const warning of report.warnings) {
      lines.push(`  • ${warning}`);
    }
    lines.push('');
  }
  
  lines.push('═'.repeat(60));
  
  return lines.join('\n');
}
