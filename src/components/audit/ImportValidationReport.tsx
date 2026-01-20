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
  FileText
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

// Agrupar erros por seção
function groupErrorsBySection(errors: ValidationError[]): Record<string, ValidationError[]> {
  return errors.reduce((acc, error) => {
    const section = error.section;
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(error);
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
    warnings: false
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

  const groupedBlockingErrors = groupErrorsBySection(report.blockingErrors);
  const groupedWarnings = groupErrorsBySection(report.warnings);

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
              <CardDescription>
                {new Date(report.timestamp).toLocaleString('pt-BR')}
              </CardDescription>
            </div>
          </div>
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
                  {Object.entries(groupedBlockingErrors).map(([section, errors]) => (
                    <div key={section} className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        {getSectionIcon(section)}
                        <span className="capitalize">{section}</span>
                        <Badge variant="outline" className="text-xs">
                          {errors.length}
                        </Badge>
                      </div>
                      {errors.map((error, i) => (
                        <div 
                          key={`${error.code}-${i}`}
                          className="ml-6 p-2 bg-destructive/5 border border-destructive/20 rounded text-sm"
                        >
                          <div className="flex items-start gap-2">
                            <Badge variant="destructive" className="text-xs shrink-0">
                              {error.code}
                            </Badge>
                            <span className="text-foreground">{error.message}</span>
                          </div>
                          {error.item && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Item: <code className="bg-muted px-1 rounded">{error.item}</code>
                            </div>
                          )}
                        </div>
                      ))}
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
                  {Object.entries(groupedWarnings).map(([section, errors]) => (
                    <div key={section} className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        {getSectionIcon(section)}
                        <span className="capitalize">{section}</span>
                        <Badge variant="outline" className="text-xs">
                          {errors.length}
                        </Badge>
                      </div>
                      {errors.map((error, i) => (
                        <div 
                          key={`${error.code}-${i}`}
                          className="ml-6 p-2 bg-warning/5 border border-warning/20 rounded text-sm"
                        >
                          <div className="flex items-start gap-2">
                            <Badge 
                              variant="outline" 
                              className="text-xs shrink-0 border-warning text-warning"
                            >
                              {error.code}
                            </Badge>
                            <span className="text-foreground">{error.message}</span>
                          </div>
                          {error.item && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Item: <code className="bg-muted px-1 rounded">{error.item}</code>
                            </div>
                          )}
                        </div>
                      ))}
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
