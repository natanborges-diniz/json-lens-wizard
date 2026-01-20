import { useState } from 'react';
import { 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  ChevronDown,
  ChevronRight,
  Package,
  DollarSign,
  Copy,
  FileText,
  Download,
  FileJson
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import type { ValidationReport, ValidationError } from '@/lib/catalogValidationEngine';
import { formatValidationReport } from '@/lib/catalogValidationEngine';

interface ImportValidationReportProps {
  report: ValidationReport;
  onProceed?: () => void;
  onCancel?: () => void;
  showActions?: boolean;
}

// Agrupar erros por ruleId
function groupErrorsByRule(errors: ValidationError[]): Record<string, ValidationError[]> {
  return errors.reduce((acc, error) => {
    const ruleId = error.ruleId;
    if (!acc[ruleId]) {
      acc[ruleId] = [];
    }
    acc[ruleId].push(error);
    return acc;
  }, {} as Record<string, ValidationError[]>);
}

// Ícone por seção
function getSectionIcon(section: string) {
  switch (section) {
    case 'families':
      return <Package className="w-4 h-4" />;
    case 'prices':
      return <DollarSign className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
}

export function ImportValidationReport({
  report,
  onProceed,
  onCancel,
  showActions = true
}: ImportValidationReportProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    blocking: true,
    warnings: false,
    byRule: false
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const copyReport = () => {
    const text = formatValidationReport(report);
    navigator.clipboard.writeText(text);
    toast.success('Relatório copiado para a área de transferência');
  };

  const exportReportJSON = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado em JSON');
  };

  const exportReportCSV = () => {
    const lines = ['Tipo,RuleID,Código,Seção,Item,Mensagem'];
    
    report.blockingErrors.forEach(e => {
      lines.push(`Erro,${e.ruleId},${e.code},${e.section},${e.item || ''},${e.message.replace(/,/g, ';')}`);
    });
    
    report.warnings.forEach(e => {
      lines.push(`Alerta,${e.ruleId},${e.code},${e.section},${e.item || ''},${e.message.replace(/,/g, ';')}`);
    });
    
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `validation-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado em CSV');
  };

  const groupedBlockingErrors = groupErrorsByRule(report.blockingErrors);
  const groupedWarnings = groupErrorsByRule(report.warnings);

  return (
    <Card className="border-2 border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {report.isValid ? (
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-destructive" />
              </div>
            )}
            <div>
              <CardTitle className="text-lg">
                {report.isValid ? 'Validação Aprovada' : 'Validação com Erros'}
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <span>{new Date(report.timestamp).toLocaleString('pt-BR')}</span>
                {report.rulesVersion && (
                  <Badge variant="outline" className="text-xs">
                    Regras v{report.rulesVersion}
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={copyReport}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copiar relatório</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={exportReportJSON}>
                    <FileJson className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Exportar JSON</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={exportReportCSV}>
                    <Download className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Exportar CSV</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-destructive/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-destructive">
              {report.summary.totalBlockingErrors}
            </div>
            <div className="text-xs text-muted-foreground">Erros Bloqueantes</div>
          </div>
          <div className="bg-warning/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-warning">
              {report.summary.totalWarnings}
            </div>
            <div className="text-xs text-muted-foreground">Alertas</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-foreground">
              {report.summary.affectedFamilies.length}
            </div>
            <div className="text-xs text-muted-foreground">Famílias Afetadas</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-foreground">
              {report.summary.affectedSkus.length}
            </div>
            <div className="text-xs text-muted-foreground">SKUs Afetados</div>
          </div>
        </div>

        {/* Contagem por regra */}
        {Object.keys(report.summary.byRuleId).length > 0 && (
          <Collapsible 
            open={expandedSections.byRule} 
            onOpenChange={() => toggleSection('byRule')}
          >
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between px-3 py-2 h-auto hover:bg-muted"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-foreground">
                    Contagem por Regra ({Object.keys(report.summary.byRuleId).length})
                  </span>
                </div>
                {expandedSections.byRule ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {Object.entries(report.summary.byRuleId).map(([ruleId, count]) => (
                  <div 
                    key={ruleId} 
                    className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm"
                  >
                    <code className="text-xs">{ruleId}</code>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Erros Bloqueantes */}
        {report.blockingErrors.length > 0 && (
          <Collapsible 
            open={expandedSections.blocking} 
            onOpenChange={() => toggleSection('blocking')}
          >
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between px-3 py-2 h-auto hover:bg-destructive/10"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="font-semibold text-destructive">
                    Erros Bloqueantes ({report.blockingErrors.length})
                  </span>
                </div>
                {expandedSections.blocking ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="h-[200px] mt-2">
                <div className="space-y-3 pr-4">
                  {Object.entries(groupedBlockingErrors).map(([ruleId, errors]) => (
                    <div key={ruleId} className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <AlertCircle className="w-3 h-3 text-destructive" />
                        <code className="text-xs bg-destructive/10 px-1 rounded">{ruleId}</code>
                        <Badge variant="outline" className="text-xs">
                          {errors.length}
                        </Badge>
                      </div>
                      {errors.slice(0, 10).map((error, i) => (
                        <div 
                          key={`${error.code}-${i}`}
                          className="ml-6 p-2 bg-destructive/5 border border-destructive/20 rounded text-sm"
                        >
                          <div className="flex items-start gap-2">
                            {getSectionIcon(error.section)}
                            <span className="text-foreground">{error.message}</span>
                          </div>
                          {error.item && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Item: <code className="bg-muted px-1 rounded">{error.item}</code>
                            </div>
                          )}
                        </div>
                      ))}
                      {errors.length > 10 && (
                        <div className="ml-6 text-xs text-muted-foreground">
                          ... e mais {errors.length - 10} erros
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Alertas */}
        {report.warnings.length > 0 && (
          <Collapsible 
            open={expandedSections.warnings} 
            onOpenChange={() => toggleSection('warnings')}
          >
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                className="w-full justify-between px-3 py-2 h-auto hover:bg-warning/10"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  <span className="font-semibold text-warning">
                    Alertas ({report.warnings.length})
                  </span>
                </div>
                {expandedSections.warnings ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <ScrollArea className="h-[200px] mt-2">
                <div className="space-y-3 pr-4">
                  {Object.entries(groupedWarnings).map(([ruleId, errors]) => (
                    <div key={ruleId} className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <AlertTriangle className="w-3 h-3 text-warning" />
                        <code className="text-xs bg-warning/10 px-1 rounded">{ruleId}</code>
                        <Badge variant="outline" className="text-xs">
                          {errors.length}
                        </Badge>
                      </div>
                      {errors.slice(0, 10).map((error, i) => (
                        <div 
                          key={`${error.code}-${i}`}
                          className="ml-6 p-2 bg-warning/5 border border-warning/20 rounded text-sm"
                        >
                          <div className="flex items-start gap-2">
                            {getSectionIcon(error.section)}
                            <span className="text-foreground">{error.message}</span>
                          </div>
                          {error.item && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Item: <code className="bg-muted px-1 rounded">{error.item}</code>
                            </div>
                          )}
                        </div>
                      ))}
                      {errors.length > 10 && (
                        <div className="ml-6 text-xs text-muted-foreground">
                          ... e mais {errors.length - 10} alertas
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Lista de itens afetados */}
        {(report.summary.affectedFamilies.length > 0 || report.summary.affectedSkus.length > 0) && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Itens afetados:</p>
            <div className="flex flex-wrap gap-1">
              {report.summary.affectedFamilies.slice(0, 10).map(id => (
                <Badge key={id} variant="secondary" className="text-xs">
                  <Package className="w-3 h-3 mr-1" />
                  {id}
                </Badge>
              ))}
              {report.summary.affectedFamilies.length > 10 && (
                <Badge variant="outline" className="text-xs">
                  +{report.summary.affectedFamilies.length - 10} famílias
                </Badge>
              )}
              {report.summary.affectedSkus.slice(0, 10).map(id => (
                <Badge key={id} variant="outline" className="text-xs">
                  <DollarSign className="w-3 h-3 mr-1" />
                  {id}
                </Badge>
              ))}
              {report.summary.affectedSkus.length > 10 && (
                <Badge variant="outline" className="text-xs">
                  +{report.summary.affectedSkus.length - 10} SKUs
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Ações */}
        {showActions && (
          <div className="flex gap-3 pt-4 border-t">
            {onCancel && (
              <Button variant="outline" onClick={onCancel} className="flex-1">
                Cancelar
              </Button>
            )}
            {onProceed && (
              <Button 
                onClick={onProceed} 
                disabled={!report.isValid}
                className="flex-1"
                variant={report.isValid ? 'default' : 'secondary'}
              >
                {report.isValid ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Prosseguir com Importação
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Corrija os Erros
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
