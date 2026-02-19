import { useState, useCallback, useMemo } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Play,
  Save,
  Eye,
  X,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

interface ErpRow {
  Codigo: string;
  DescricaoCadunif?: string;
  TipoLente?: string;
  ESFERICO_MIN?: number;
  ESFERICO_MAX?: number;
  CILINDRICO_MIN?: number;
  CILINDRICO_MAX?: number;
  ADICAO_MIN?: number;
  ADICAO_MAX?: number;
  DIAMETRO_MIN?: number;
  DIAMETRO_MAX?: number;
  Ativo?: boolean | number;
  Bloqueado?: boolean | number;
  PrecoVendaMeioPar?: number;
}

interface SyncReport {
  mode: string;
  supplier: string;
  dry_run: boolean;
  applied: boolean;
  rows_read: number;
  rows_ignored: number;
  matched: number;
  updated: number;
  created: number;
  not_found_in_catalog: number;
  not_found_codes: string[];
  missing_family_mapping: string[];
  supplier_mismatch_conflicts: any[];
  sample_updates: any[];
  sample_created: any[];
}

const SUPPLIERS = ['ESSILOR', 'ZEISS', 'HOYA', 'RODENSTOCK', 'SHAMIR', 'TOKAI', 'KODAK', 'SEIKO'];

export function ErpImportTab() {
  const [supplier, setSupplier] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ErpRow[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [rawColumns, setRawColumns] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<SyncReport | null>(null);
  const [createMissing, setCreateMissing] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'report'>('upload');

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Selecione um arquivo .xlsx ou .xls');
      return;
    }

    setFile(selectedFile);
    setIsParsing(true);
    setReport(null);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: null });

      // Store raw data and columns
      if (jsonData.length > 0) {
        setRawColumns(Object.keys(jsonData[0]));
      }
      setRawRows(jsonData);

      // Normalize column names (case-insensitive mapping)
      const normalized: ErpRow[] = jsonData
        .map((row) => {
          const keys = Object.keys(row);
          const find = (candidates: string[]) => {
            const key = keys.find((k) =>
              candidates.some((c) => k.toLowerCase().replace(/[_\s]/g, '') === c.toLowerCase().replace(/[_\s]/g, ''))
            );
            return key ? row[key] : undefined;
          };

          return {
            Codigo: String(find(['Codigo', 'codigo', 'CODIGO', 'Cod', 'cod', 'Code', 'code', 'ERP_CODE']) || ''),
            DescricaoCadunif: find(['DescricaoCadunif', 'Descricao', 'descricao', 'DESCRICAO', 'Description', 'description']) || '',
            TipoLente: find(['TipoLente', 'tipolente', 'TIPO_LENTE', 'tipo_lente']) || '',
            ESFERICO_MIN: parseNum(find(['ESFERICO_MIN', 'esferico_min', 'EsfericoMin', 'sph_min'])),
            ESFERICO_MAX: parseNum(find(['ESFERICO_MAX', 'esferico_max', 'EsfericoMax', 'sph_max'])),
            CILINDRICO_MIN: parseNum(find(['CILINDRICO_MIN', 'cilindrico_min', 'CilindricoMin', 'cyl_min'])),
            CILINDRICO_MAX: parseNum(find(['CILINDRICO_MAX', 'cilindrico_max', 'CilindricoMax', 'cyl_max'])),
            ADICAO_MIN: parseNum(find(['ADICAO_MIN', 'adicao_min', 'AdicaoMin', 'add_min'])),
            ADICAO_MAX: parseNum(find(['ADICAO_MAX', 'adicao_max', 'AdicaoMax', 'add_max'])),
            DIAMETRO_MIN: parseNum(find(['DIAMETRO_MIN', 'diametro_min', 'DiametroMin'])),
            DIAMETRO_MAX: parseNum(find(['DIAMETRO_MAX', 'diametro_max', 'DiametroMax'])),
            Ativo: find(['Ativo', 'ativo', 'ATIVO', 'Active', 'active']),
            Bloqueado: find(['Bloqueado', 'bloqueado', 'BLOQUEADO', 'Blocked', 'blocked']),
            PrecoVendaMeioPar: parseNum(find(['PrecoVendaMeioPar', 'precovenda', 'Preco', 'preco', 'price', 'Price'])),
          };
        })
        .filter((row) => row.Codigo && row.Codigo !== 'undefined' && row.Codigo !== 'null');

      setParsedRows(normalized);
      setStep('preview');
      toast.success(`${normalized.length} linhas lidas da planilha`);
    } catch (error) {
      console.error('XLSX parse error:', error);
      toast.error('Erro ao ler planilha. Verifique o formato.');
    } finally {
      setIsParsing(false);
    }
  }, []);

  const runSync = useCallback(async (dryRun: boolean) => {
    if (!supplier) {
      toast.error('Selecione o fornecedor');
      return;
    }
    if (parsedRows.length === 0) {
      toast.error('Nenhuma linha para processar');
      return;
    }

    setIsRunning(true);
    try {
      const params = new URLSearchParams({
        supplier,
        dry_run: String(dryRun),
        apply: String(!dryRun),
        create_missing: String(createMissing),
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-erp-catalog?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rows: parsedRows }),
        }
      );

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errBody}`);
      }

      const data = await response.json();
      setReport(data);
      setStep('report');

      if (dryRun) {
        toast.success('Simulação concluída. Revise os resultados.');
      } else {
        toast.success(`Sincronização aplicada: ${data.updated} atualizados, ${data.created} criados`);
      }
    } catch (error: any) {
      console.error('Sync error:', error);
      toast.error(`Erro na sincronização: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  }, [supplier, parsedRows, createMissing]);

  const resetFlow = useCallback(() => {
    setFile(null);
    setParsedRows([]);
    setRawRows([]);
    setRawColumns([]);
    setReport(null);
    setStep('upload');
  }, []);

  const previewRawRows = useMemo(() => rawRows.slice(0, 50), [rawRows]);

  return (
    <div className="space-y-4">
      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Importação ERP
            </CardTitle>
            <CardDescription>
              Faça upload de uma planilha XLSX com dados ERP para sincronizar disponibilidade, status e preços no catálogo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Supplier Selection */}
            <div className="space-y-2">
              <Label>Fornecedor *</Label>
              <Select value={supplier} onValueChange={setSupplier}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecione o fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPLIERS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Options */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="create-missing"
                  checked={createMissing}
                  onCheckedChange={setCreateMissing}
                />
                <Label htmlFor="create-missing" className="text-sm cursor-pointer">
                  Criar SKUs não encontrados (usando regras de match)
                </Label>
              </div>
            </div>

            {/* File Upload */}
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              {isParsing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Lendo planilha...</p>
                </div>
              ) : (
                <label className="cursor-pointer flex flex-col items-center gap-3">
                  <Upload className="w-10 h-10 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">Clique para selecionar a planilha</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Formatos aceitos: .xlsx, .xls
                    </p>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={!supplier}
                  />
                  {!supplier && (
                    <p className="text-xs text-destructive">Selecione o fornecedor primeiro</p>
                  )}
                </label>
              )}
            </div>

            {/* Expected Columns Info */}
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-xs font-medium mb-2">Colunas esperadas na planilha:</p>
              <div className="flex flex-wrap gap-1.5">
                {['Codigo', 'DescricaoCadunif', 'TipoLente', 'ESFERICO_MIN', 'ESFERICO_MAX',
                  'CILINDRICO_MIN', 'CILINDRICO_MAX', 'ADICAO_MIN', 'ADICAO_MAX',
                  'DIAMETRO_MIN', 'DIAMETRO_MAX', 'Ativo', 'Bloqueado', 'PrecoVendaMeioPar'].map((col) => (
                  <Badge key={col} variant="secondary" className="text-[10px]">{col}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="w-5 h-5 text-primary" />
                    Preview dos Dados
                  </CardTitle>
                  <CardDescription>
                    {rawRows.length} linhas lidas de {file?.name} • Fornecedor: {supplier} • {rawColumns.length} colunas detectadas
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={resetFlow}>
                    <X className="w-4 h-4 mr-1" />
                    Cancelar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {rawColumns.map((col) => (
                        <TableHead key={col} className="text-xs whitespace-nowrap sticky top-0 bg-background z-10">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRawRows.map((row, idx) => (
                      <TableRow key={idx}>
                        {rawColumns.map((col) => (
                          <TableCell key={col} className="text-xs whitespace-nowrap">
                            {row[col] != null ? String(row[col]) : '-'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {rawRows.length > 50 && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Exibindo 50 de {rawRows.length} linhas
                </p>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => runSync(true)}
              disabled={isRunning}
              className="gap-2"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Simular (Dry-Run)
            </Button>
            <Button
              onClick={() => runSync(false)}
              disabled={isRunning}
              className="gap-2"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Aplicar Diretamente
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Report */}
      {step === 'report' && report && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold">{report.rows_read}</p>
                <p className="text-[10px] text-muted-foreground">Linhas Lidas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-primary">{report.matched}</p>
                <p className="text-[10px] text-muted-foreground">Encontrados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-success">{report.updated}</p>
                <p className="text-[10px] text-muted-foreground">Atualizados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-info">{report.created}</p>
                <p className="text-[10px] text-muted-foreground">Criados</p>
              </CardContent>
            </Card>
            <Card className={report.not_found_in_catalog > 0 ? 'border-warning' : ''}>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-warning">{report.not_found_in_catalog}</p>
                <p className="text-[10px] text-muted-foreground">Não Encontrados</p>
              </CardContent>
            </Card>
          </div>

          {/* Status */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {report.applied ? (
                  <CheckCircle className="w-6 h-6 text-success" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-warning" />
                )}
                <div>
                  <p className="font-medium text-sm">
                    {report.applied
                      ? 'Sincronização aplicada com sucesso!'
                      : 'Simulação (Dry-Run) — nenhuma alteração foi salva'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fornecedor: {report.supplier} • {report.rows_ignored} linhas ignoradas
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sample Updates */}
          {report.sample_updates.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Exemplos de Atualização</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Código ERP</TableHead>
                        <TableHead className="text-xs">Descrição</TableHead>
                        <TableHead className="text-xs text-center">Preço</TableHead>
                        <TableHead className="text-xs text-center">Ativo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.sample_updates.map((item: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="text-xs font-mono">{item.erp_code}</TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">{item.description}</TableCell>
                          <TableCell className="text-xs text-center">
                            {item.price ? `R$ ${Number(item.price).toFixed(2)}` : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            {item.active ? '✅' : '❌'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Not Found Codes */}
          {report.not_found_codes && report.not_found_codes.length > 0 && (
            <Card className="border-warning/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Códigos Não Encontrados ({report.not_found_in_catalog})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {report.not_found_codes.map((code: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="text-[10px] font-mono">
                      {code}
                    </Badge>
                  ))}
                  {report.not_found_in_catalog > 20 && (
                    <Badge variant="secondary" className="text-[10px]">
                      +{report.not_found_in_catalog - 20} mais
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Supplier Mismatch */}
          {report.supplier_mismatch_conflicts && report.supplier_mismatch_conflicts.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Conflitos de Fornecedor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {report.supplier_mismatch_conflicts.map((conflict: any, idx: number) => (
                    <p key={idx} className="text-xs">
                      <span className="font-mono">{conflict.erp_code}</span>: catálogo diz{' '}
                      <Badge variant="outline" className="text-[10px]">{conflict.catalog_supplier}</Badge>, ERP diz{' '}
                      <Badge variant="outline" className="text-[10px]">{conflict.requested_supplier}</Badge>
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={resetFlow} className="gap-2">
              <Upload className="w-4 h-4" />
              Nova Importação
            </Button>
            {report.dry_run && (
              <Button
                onClick={() => runSync(false)}
                disabled={isRunning}
                className="gap-2"
              >
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Aplicar Alterações
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function parseNum(val: unknown): number | undefined {
  if (val == null || val === '') return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}

function toBoolDisplay(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  if (typeof val === 'string') return val.toLowerCase() === 'true' || val === '1' || val.toLowerCase() === 'sim';
  return false;
}
