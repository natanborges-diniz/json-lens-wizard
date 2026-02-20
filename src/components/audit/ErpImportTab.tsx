import { useState, useCallback, useMemo, useEffect } from 'react';
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
  PlusCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  Search,
  ListTodo,
  CheckSquare,
  Ban,
  FlaskConical,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useLensStore } from '@/store/lensStore';
import { useAuth } from '@/hooks/useAuth';

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
  gate_blocked?: boolean;
  gate_reason?: string;
  rows_read: number;
  rows_ignored: number;
  matched: number;
  matched_raw?: number;
  matched_trimmed?: number;
  updated: number;
  created: number;
  not_found_in_catalog: number;
  not_found_codes: string[];
  not_found_examples?: { erp_code: string; description: string }[];
  missing_family_mapping: number | string[];
  missing_family_mapping_examples?: { erp_code: string; description: string }[];
  supplier_mismatch_conflicts: any[];
  supplier_mismatch_examples?: any[];
  sample_updates: any[];
  sample_created: any[];
  sync_run_id?: string;
}

interface PendingSku {
  id: string;
  erp_code: string;
  description: string | null;
  status: string;
  supplier_code: string;
  resolved_family_id: string | null;
  created_at: string;
  sync_run_id: string;
}

const SUPPLIERS = ['ESSILOR', 'ZEISS', 'HOYA', 'RODENSTOCK', 'SHAMIR', 'TOKAI', 'KODAK', 'SEIKO'];

// ─── Deterministic Classification Types ──────────────────────────────────────
interface ClassificationGroup {
  group_key: string;
  suggested_family_id: string | null;
  confidence: 'high' | 'medium' | 'none';
  blue_filter: boolean;
  photo: boolean;
  detected_indexes: string[];
  erp_codes: string[];
  match_reason: string | null;
  patterns_suggested: string[];
  skus: { erp_code: string; original_description: string; index: string | null }[];
}

interface SupplierProfile {
  family_dictionary: Array<{ contains?: string[]; keywords?: string[]; family_id: string; priority?: number }>;
  noise_tokens: string[] | null;
  abbreviation_map: Record<string, string> | null;
  keywords_photo: string[] | null;
}

// ─── Pure classification function ────────────────────────────────────────────
function classifyPendingSkus(
  skus: PendingSku[],
  profile: SupplierProfile
): ClassificationGroup[] {
  const noiseSet = new Set(
    (profile.noise_tokens ?? ['BLUE','UV','CZ','CVP','AR','INC','CLE','FOTO','TRIO','EASY','ROCK','SAPPHIRE','OPTIFOG','PREV','TRANS','EXT','EAYS','PHOTO'])
      .map(t => t.toUpperCase())
  );
  const abbrMap: Record<string, string> = profile.abbreviation_map ?? {};
  const photoKeywords = new Set((profile.keywords_photo ?? []).map(k => k.toUpperCase()));
  const familyDict = profile.family_dictionary ?? [];

  const INDEX_REGEX = /\b1\.\d{2}\b/g;

  function processDescription(description: string): {
    baseClean: string;
    baseExpanded: string;
    indexes: string[];
    blueFilter: boolean;
    photo: boolean;
  } {
    const upper = description.toUpperCase();
    const tokens = upper.split(/\s+/);

    const blueFilter = tokens.includes('BLUE') || tokens.includes('BLUE') || upper.includes('BLUE');
    const photo = tokens.some(t => t === 'FOTO' || t === 'PHOTO' || photoKeywords.has(t));

    // Extract indexes
    const indexMatches = description.match(INDEX_REGEX) ?? [];
    const indexes = [...new Set(indexMatches)];

    // Remove noise tokens and indexes from base
    const cleanTokens = tokens.filter(t => {
      if (noiseSet.has(t)) return false;
      if (INDEX_REGEX.test(t)) return false;
      INDEX_REGEX.lastIndex = 0;
      return true;
    });

    const baseClean = cleanTokens.join(' ').trim();

    // Apply abbreviation map to get expanded form
    const expandedTokens = cleanTokens.map(t => {
      const abbr = abbrMap[t] ?? abbrMap[t.toLowerCase()];
      return abbr ? abbr.toUpperCase() : t;
    });
    const baseExpanded = expandedTokens.join(' ').trim();

    return { baseClean, baseExpanded, indexes, blueFilter, photo };
  }

  function matchFamily(baseClean: string, baseExpanded: string): {
    family_id: string | null;
    confidence: 'high' | 'medium' | 'none';
    reason: string | null;
    patterns: string[];
  } {
    const lowerClean = baseClean.toLowerCase();
    const lowerExpanded = baseExpanded.toLowerCase();

    // Sort by priority descending
    const sorted = [...familyDict].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    // Level 1: high — direct keyword match in the clean base
    for (const rule of sorted) {
      for (const kw of (rule.contains ?? rule.keywords ?? [])) {
        if (lowerClean.includes(kw.toLowerCase())) {
          return {
            family_id: rule.family_id,
            confidence: 'high',
            reason: `contains "${kw}" (direto)`,
            patterns: [kw],
          };
        }
      }
    }

    // Level 2: medium — keyword match after abbreviation expansion
    for (const rule of sorted) {
      for (const kw of (rule.contains ?? rule.keywords ?? [])) {
        if (lowerExpanded.includes(kw.toLowerCase())) {
          return {
            family_id: rule.family_id,
            confidence: 'medium',
            reason: `contains "${kw}" (via abreviação)`,
            patterns: [kw],
          };
        }
      }
    }

    return { family_id: null, confidence: 'none', reason: null, patterns: [] };
  }

  // Group by normalized base (expanded)
  const groupMap = new Map<string, ClassificationGroup>();

  for (const sku of skus) {
    const desc = sku.description ?? '';
    const { baseClean, baseExpanded, indexes, blueFilter, photo } = processDescription(desc);

    // Normalize key: use expanded lowercased trimmed
    const groupKey = baseExpanded.trim() || baseClean.trim() || '(sem descrição)';
    const normalizedKey = groupKey.toLowerCase();

    if (!groupMap.has(normalizedKey)) {
      const match = matchFamily(baseClean, baseExpanded);
      groupMap.set(normalizedKey, {
        group_key: groupKey,
        suggested_family_id: match.family_id,
        confidence: match.confidence,
        blue_filter: blueFilter,
        photo,
        detected_indexes: [...indexes],
        erp_codes: [],
        match_reason: match.reason,
        patterns_suggested: match.patterns,
        skus: [],
      });
    }

    const grp = groupMap.get(normalizedKey)!;
    grp.erp_codes.push(sku.erp_code);
    grp.skus.push({ erp_code: sku.erp_code, original_description: desc, index: indexes[0] ?? null });

    // Merge indexes
    for (const idx of indexes) {
      if (!grp.detected_indexes.includes(idx)) grp.detected_indexes.push(idx);
    }

    // If any SKU has blue, mark group
    if (blueFilter) grp.blue_filter = true;
    if (photo) grp.photo = true;
  }

  // Sort: high → medium → none, then alphabetically
  const order = { high: 0, medium: 1, none: 2 };
  return [...groupMap.values()].sort((a, b) => {
    const co = order[a.confidence] - order[b.confidence];
    if (co !== 0) return co;
    return a.group_key.localeCompare(b.group_key);
  });
}

// ─── PendingClassificationPreview ────────────────────────────────────────────
function PendingClassificationPreview({ supplierCode }: { supplierCode: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [groups, setGroups] = useState<ClassificationGroup[] | null>(null);
  const [totalPending, setTotalPending] = useState(0);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setGroups(null);
    try {
      // Load pending SKUs and supplier profile in parallel
      const [skusRes, profileRes] = await Promise.all([
        supabase
          .from('catalog_pending_skus')
          .select('*')
          .eq('supplier_code', supplierCode)
          .eq('status', 'pending')
          .order('erp_code', { ascending: true })
          .limit(500),
        supabase
          .from('supplier_profiles')
          .select('family_dictionary, noise_tokens, abbreviation_map, keywords_photo')
          .eq('supplier_code', supplierCode)
          .limit(1)
          .maybeSingle(),
      ]);

      if (skusRes.error) throw skusRes.error;
      if (profileRes.error) throw profileRes.error;
      if (!profileRes.data) throw new Error(`Perfil do fornecedor "${supplierCode}" não encontrado`);

      const skus = (skusRes.data ?? []) as PendingSku[];
      const profile = profileRes.data as unknown as SupplierProfile;

      setTotalPending(skus.length);

      if (skus.length === 0) {
        setGroups([]);
        return;
      }

      const result = classifyPendingSkus(skus, profile);
      setGroups(result);
    } catch (err: any) {
      setError(err.message ?? 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }, [supplierCode]);

  const exportActionPlan = useCallback(() => {
    if (!groups) return;
    const plan = {
      generated_at: new Date().toISOString(),
      supplier: supplierCode,
      total_pending: totalPending,
      groups: groups.map(g => ({
        group_key: g.group_key,
        suggested_family_id: g.suggested_family_id,
        confidence: g.confidence,
        erp_codes: g.erp_codes,
        blue_filter: g.blue_filter,
        photo: g.photo,
        detected_indexes: g.detected_indexes,
        patterns_suggested: g.patterns_suggested,
      })),
    };
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `action-plan-${supplierCode}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [groups, supplierCode, totalPending]);

  const confidenceBadge = (c: 'high' | 'medium' | 'none') => {
    if (c === 'high') return <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30 hover:bg-primary/15">high</Badge>;
    if (c === 'medium') return <Badge className="text-[10px] bg-secondary text-secondary-foreground border-border hover:bg-secondary/80">medium</Badge>;
    return <Badge variant="outline" className="text-[10px] text-muted-foreground">none</Badge>;
  };

  if (!groups && !isLoading && !error) {
    return (
      <div className="mt-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 w-full border-primary/30 text-primary hover:bg-primary/5"
          onClick={runAnalysis}
        >
          <FlaskConical className="w-4 h-4" />
          Analisar Pendências (Análise Determinística por Tokens)
        </Button>
      </div>
    );
  }

  return (
    <Card className="mt-3 border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" />
            Análise Determinística (tokens) — {supplierCode}
            {groups !== null && (
              <span className="font-normal text-muted-foreground">
                — {totalPending} pendências — {groups.length} grupos
              </span>
            )}
          </CardTitle>
          <div className="flex gap-2">
            {groups !== null && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={exportActionPlan}
              >
                <Download className="w-3 h-3" />
                Exportar ActionPlan JSON
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={runAnalysis}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Reanalisar'}
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          Classificação por remoção de tokens de ruído e expansão de abreviações do perfil do fornecedor.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-6 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Classificando pendências...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm py-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {groups !== null && groups.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma pendência com status "pending" para {supplierCode}.
          </p>
        )}

        {groups !== null && groups.length > 0 && (
          <>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Grupo Base</TableHead>
                    <TableHead className="text-xs">Family Sugerida</TableHead>
                    <TableHead className="text-xs text-center w-12">Qtd</TableHead>
                    <TableHead className="text-xs">Índices</TableHead>
                    <TableHead className="text-xs text-center w-12">Blue</TableHead>
                    <TableHead className="text-xs text-center w-12">Foto</TableHead>
                    <TableHead className="text-xs text-center w-20">Confiança</TableHead>
                    <TableHead className="text-xs">Motivo</TableHead>
                    <TableHead className="text-xs w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((grp) => {
                    const key = grp.group_key;
                    const isOpen = expandedGroup === key;
                    return (
                      <>
                        <TableRow
                          key={key}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setExpandedGroup(isOpen ? null : key)}
                        >
                          <TableCell className="text-xs font-mono max-w-[180px] truncate" title={grp.group_key}>
                            {grp.group_key}
                          </TableCell>
                          <TableCell className="text-xs">
                            {grp.suggested_family_id
                              ? <span className="font-mono text-primary text-[10px]">{grp.suggested_family_id}</span>
                              : <span className="text-muted-foreground">—</span>
                            }
                          </TableCell>
                          <TableCell className="text-xs text-center font-medium">{grp.erp_codes.length}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">
                            {grp.detected_indexes.length > 0 ? grp.detected_indexes.join(', ') : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            {grp.blue_filter ? '🔵' : '—'}
                          </TableCell>
                          <TableCell className="text-xs text-center">
                            {grp.photo ? '📸' : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {confidenceBadge(grp.confidence)}
                          </TableCell>
                          <TableCell className="text-[10px] text-muted-foreground max-w-[120px] truncate">
                            {grp.match_reason ?? '—'}
                          </TableCell>
                          <TableCell>
                            {isOpen
                              ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
                              : <ChevronDown className="w-3 h-3 text-muted-foreground" />
                            }
                          </TableCell>
                        </TableRow>

                        {isOpen && (
                          <TableRow key={`${key}-expanded`} className="bg-muted/20">
                            <TableCell colSpan={9} className="py-2 px-4">
                              <div className="space-y-1">
                                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">
                                  SKUs deste grupo ({grp.skus.length}):
                                </p>
                                <div className="grid grid-cols-1 gap-1">
                                  {grp.skus.map(s => (
                                    <div key={s.erp_code} className="flex items-center gap-3 text-[11px] bg-background rounded px-2 py-1">
                                      <span className="font-mono text-primary shrink-0">{s.erp_code}</span>
                                      {s.index && <Badge variant="outline" className="text-[9px] px-1 py-0">{s.index}</Badge>}
                                      <span className="text-muted-foreground truncate">{s.original_description}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary inline-block" /> {groups.filter(g => g.confidence === 'high').length} high
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-secondary-foreground/40 inline-block" /> {groups.filter(g => g.confidence === 'medium').length} medium
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 inline-block" /> {groups.filter(g => g.confidence === 'none').length} sem match
              </span>
            </div>

            <Separator />
            <p className="text-[10px] text-muted-foreground text-center">
              Análise determinística (tokens) — somente leitura, nenhuma alteração foi aplicada
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface ErpImportTabProps {
  onNavigateTab?: (tab: string) => void;
}

// ─── Resolve SKU Dialog ──────────────────────────────────────────────────────
function ResolveSKUDialog({
  item,
  supplierCode,
  syncRunId,
  onClose,
  onResolved,
}: {
  item: { erp_code: string; description: string } | null;
  supplierCode: string;
  syncRunId?: string;
  onClose: () => void;
  onResolved: () => void;
}) {
  const { families } = useLensStore();
  const { user } = useAuth();
  const [familySearch, setFamilySearch] = useState('');
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredFamilies = useMemo(() => {
    const q = familySearch.toLowerCase();
    return families
      .filter(f => f.supplier === supplierCode || q.length > 0)
      .filter(f =>
        q === '' ||
        f.name_original.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [families, familySearch, supplierCode]);

  const handleSave = async (action: 'resolve' | 'ignore') => {
    if (!item) return;
    if (action === 'resolve' && !selectedFamilyId) {
      toast.error('Selecione uma família antes de resolver');
      return;
    }
    setIsSaving(true);
    try {
      // Upsert into catalog_pending_skus
      const runId = syncRunId || '00000000-0000-0000-0000-000000000000';
      const { error } = await supabase.from('catalog_pending_skus').upsert({
        sync_run_id: runId,
        supplier_code: supplierCode,
        erp_code: item.erp_code.trim(),
        description: item.description,
        status: action === 'resolve' ? 'resolved' : 'ignored',
        resolved_family_id: action === 'resolve' ? selectedFamilyId : null,
        resolved_by: user?.id ?? null,
        resolved_at: new Date().toISOString(),
      }, { onConflict: 'erp_code,sync_run_id' });

      if (error) throw error;
      toast.success(action === 'resolve' ? `Código vinculado à família` : 'Item ignorado');
      onResolved();
      onClose();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerir Produto Não Encontrado</DialogTitle>
          <DialogDescription>
            Vincule este código ERP a uma família existente no catálogo, ou ignore-o.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item info */}
          <div className="bg-muted/50 rounded-md p-3 space-y-1">
            <p className="text-xs text-muted-foreground">Código ERP</p>
            <p className="font-mono text-sm font-medium">{item.erp_code}</p>
            <p className="text-xs text-muted-foreground mt-1">Descrição</p>
            <p className="text-sm">{item.description || '—'}</p>
          </div>

          <Separator />

          {/* Family search */}
          <div className="space-y-2">
            <Label className="text-sm">Vincular à família</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar família por nome ou ID..."
                value={familySearch}
                onChange={e => setFamilySearch(e.target.value)}
                className="pl-7 h-8 text-sm"
              />
            </div>
            <ScrollArea className="h-48 border rounded-md">
              <div className="p-1 space-y-0.5">
                {filteredFamilies.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma família encontrada</p>
                )}
                {filteredFamilies.map(f => (
                  <button
                    key={f.id}
                    className={`w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors ${selectedFamilyId === f.id ? 'bg-primary/10 text-primary font-medium' : ''}`}
                    onClick={() => setSelectedFamilyId(f.id)}
                  >
                    <span className="font-medium">{f.name_original}</span>
                    <span className="text-muted-foreground ml-2 font-mono">{f.id}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
            {selectedFamilyId && (
              <p className="text-xs text-primary">✓ Selecionado: {selectedFamilyId}</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSave('ignore')}
            disabled={isSaving}
            className="gap-1"
          >
            <Ban className="w-3.5 h-3.5" />
            Ignorar
          </Button>
          <Button
            size="sm"
            onClick={() => handleSave('resolve')}
            disabled={isSaving || !selectedFamilyId}
            className="gap-1"
          >
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
            Vincular Família
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pending SKUs Section ────────────────────────────────────────────────────
function PendingSkusSection({ supplierCode }: { supplierCode: string }) {
  const [pendingSkus, setPendingSkus] = useState<PendingSku[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [resolvingItem, setResolvingItem] = useState<{ erp_code: string; description: string } | null>(null);

  const load = useCallback(async () => {
    if (!supplierCode) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('catalog_pending_skus')
        .select('*')
        .eq('supplier_code', supplierCode)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setPendingSkus((data || []) as PendingSku[]);
    } catch (err: any) {
      toast.error(`Erro ao carregar pendências: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [supplierCode]);

  useEffect(() => { load(); }, [load]);

  const statusBadge = (status: string) => {
    if (status === 'pending') return <Badge variant="destructive" className="text-[10px]">Pendente</Badge>;
    if (status === 'resolved') return <Badge variant="secondary" className="text-[10px]">Resolvido</Badge>;
    return <Badge variant="outline" className="text-[10px]">Ignorado</Badge>;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-primary" />
            Pendências do Banco — {supplierCode}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={load} disabled={isLoading} className="h-7 text-xs gap-1">
            {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Atualizar'}
          </Button>
        </div>
        <CardDescription className="text-xs">
          SKUs ERP que foram enviados para fila de resolução manual em sincronizações anteriores.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isLoading && pendingSkus.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma pendência registrada para {supplierCode}.
          </p>
        )}
        {!isLoading && pendingSkus.length > 0 && (
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Código ERP</TableHead>
                  <TableHead className="text-xs">Descrição</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                  <TableHead className="text-xs">Família Vinculada</TableHead>
                  <TableHead className="text-xs"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingSkus.map(sku => (
                  <TableRow key={sku.id}>
                    <TableCell className="text-xs font-mono">{sku.erp_code}</TableCell>
                    <TableCell className="text-xs max-w-[180px] truncate">{sku.description || '—'}</TableCell>
                    <TableCell className="text-xs text-center">{statusBadge(sku.status)}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{sku.resolved_family_id || '—'}</TableCell>
                    <TableCell className="text-xs">
                      {sku.status !== 'ignored' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] gap-1"
                          onClick={() => setResolvingItem({ erp_code: sku.erp_code, description: sku.description || '' })}
                        >
                          <Settings className="w-3 h-3" />
                          Gerir
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>

      {resolvingItem && (
        <ResolveSKUDialog
          item={resolvingItem}
          supplierCode={supplierCode}
          onClose={() => setResolvingItem(null)}
          onResolved={load}
        />
      )}
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function ErpImportTab({ onNavigateTab }: ErpImportTabProps) {
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
  const [showAllNotFound, setShowAllNotFound] = useState(false);
  const [showPendingSection, setShowPendingSection] = useState(false);

  // Dialog state for "Gerir" individual item
  const [resolvingItem, setResolvingItem] = useState<{ erp_code: string; description: string } | null>(null);

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

      if (jsonData.length > 0) {
        setRawColumns(Object.keys(jsonData[0]));
      }
      setRawRows(jsonData);

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
    if (!supplier) { toast.error('Selecione o fornecedor'); return; }
    if (parsedRows.length === 0) { toast.error('Nenhuma linha para processar'); return; }

    setIsRunning(true);
    try {
      const params = new URLSearchParams({
        mode: 'erp-sync',
        supplier,
        dry_run: String(dryRun),
        apply: String(!dryRun),
        create_missing: String(createMissing),
      });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/catalog-grade-matrix?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rows: parsedRows }),
        }
      );

      const data = await response.json();

      // 409 gate_blocked é um estado válido — mostra o relatório com aviso
      if (response.status === 409 && data.gate_blocked) {
        setReport(data);
        setStep('report');
        toast.warning(`Aplicação bloqueada: ${data.gate_reason}. Resolva as pendências antes de aplicar.`);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
      }

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
    setShowPendingSection(false);
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

            <div className="flex items-center gap-2">
              <Switch id="create-missing" checked={createMissing} onCheckedChange={setCreateMissing} />
              <Label htmlFor="create-missing" className="text-sm cursor-pointer">
                Criar SKUs não encontrados (usando regras de match)
              </Label>
            </div>

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
                    <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: .xlsx, .xls</p>
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

            {/* Ver Pendências do Banco */}
            {supplier && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 w-full"
                onClick={() => setShowPendingSection(v => !v)}
              >
                <ListTodo className="w-4 h-4" />
                {showPendingSection ? 'Ocultar' : 'Ver'} Pendências do Banco — {supplier}
              </Button>
            )}
            {showPendingSection && supplier && (
              <>
                <PendingSkusSection supplierCode={supplier} />
                <PendingClassificationPreview supplierCode={supplier} />
              </>
            )}

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
                <Button variant="ghost" size="sm" onClick={resetFlow}>
                  <X className="w-4 h-4 mr-1" />
                  Cancelar
                </Button>
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

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => runSync(true)} disabled={isRunning} className="gap-2">
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Simular (Dry-Run)
            </Button>
            <Button onClick={() => runSync(false)} disabled={isRunning} className="gap-2">
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
            <Card><CardContent className="p-3 text-center">
              <p className="text-xl font-bold">{report.rows_read}</p>
              <p className="text-[10px] text-muted-foreground">Linhas Lidas</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-primary">{report.matched}</p>
              <p className="text-[10px] text-muted-foreground">Encontrados</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-success">{report.updated}</p>
              <p className="text-[10px] text-muted-foreground">Atualizados</p>
            </CardContent></Card>
            <Card><CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-primary">{report.created}</p>
              <p className="text-[10px] text-muted-foreground">Criados</p>
            </CardContent></Card>
            <Card className={report.not_found_in_catalog > 0 ? 'border-destructive/30' : ''}>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-destructive">{report.not_found_in_catalog}</p>
                <p className="text-[10px] text-muted-foreground">Não Encontrados</p>
              </CardContent>
            </Card>
          </div>

          {/* Status */}
          {report.gate_blocked && (
            <Card className="border-destructive">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
                  <div className="space-y-2 flex-1">
                    <p className="font-semibold text-sm text-destructive">Aplicação Bloqueada pelo Gate de Governança</p>
                    <p className="text-xs text-muted-foreground">{report.gate_reason}</p>
                    <p className="text-xs text-muted-foreground">
                      Para aplicar as <strong>{report.updated}</strong> atualizações encontradas, resolva ou ignore todos os SKUs pendentes abaixo. Depois clique em <strong>Aplicar sem Pendentes</strong>.
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-7 text-xs"
                        onClick={() => setShowPendingSection(true)}
                      >
                        <ListTodo className="w-3.5 h-3.5" />
                        Ver Pendências
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1 h-7 text-xs"
                        disabled={isRunning}
                        onClick={async () => {
                          // Força apply sem create_missing para desbloquear o gate
                          setIsRunning(true);
                          try {
                            const params = new URLSearchParams({
                              mode: 'erp-sync',
                              supplier: report.supplier,
                              dry_run: 'false',
                              apply: 'true',
                              create_missing: 'false',
                            });
                            const response = await fetch(
                              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/catalog-grade-matrix?${params.toString()}`,
                              {
                                method: 'POST',
                                headers: {
                                  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ rows: parsedRows }),
                              }
                            );
                            const data = await response.json();
                            setReport(data);
                            if (data.applied) {
                              toast.success(`Sincronização aplicada: ${data.updated} atualizados`);
                            } else if (data.gate_blocked) {
                              toast.warning(`Ainda bloqueado: ${data.gate_reason}`);
                            }
                          } catch (err: any) {
                            toast.error(`Erro: ${err.message}`);
                          } finally {
                            setIsRunning(false);
                          }
                        }}
                      >
                        {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Aplicar só os {report.updated} encontrados
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {report.applied ? (
                  <CheckCircle className="w-6 h-6 text-primary" />
                ) : report.gate_blocked ? (
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-sm">
                    {report.applied
                      ? 'Sincronização aplicada com sucesso!'
                      : report.gate_blocked
                      ? 'Bloqueado — resolva pendências para aplicar'
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

          {/* Missing Family Mapping — aparece quando create_missing=true mas família não foi resolvida */}
          {report.missing_family_mapping_examples && report.missing_family_mapping_examples.length > 0 && (
            <Card className="border-destructive/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  Sem Família no Catálogo ({report.missing_family_mapping_examples.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Estes códigos ERP não foram encontrados no catálogo e não foi possível resolver automaticamente a família. Use <strong>Gerir</strong> para vinculá-los manualmente, ou <strong>Ignorar</strong> para desbloqueiar o gate.
                </p>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {report.missing_family_mapping_examples.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 py-1.5 px-3 rounded-md bg-muted/50 text-xs">
                    <span className="font-mono text-destructive shrink-0">{item.erp_code}</span>
                    <span className="text-muted-foreground truncate flex-1">{item.description}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px] shrink-0 gap-1"
                      onClick={() => setResolvingItem(item)}
                    >
                      <Settings className="w-3 h-3" />
                      Gerir
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Not Found Codes — com botão Gerir por item */}
          {report.not_found_in_catalog > 0 && (
            <Card className="border-destructive/30">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                    Não Encontrados no Catálogo ({report.not_found_in_catalog})
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setCreateMissing(true);
                      setStep('preview');
                      toast.info('Ative "Criar SKUs não encontrados" e rode Simular novamente');
                    }}
                  >
                    <PlusCircle className="w-3 h-3" />
                    Criar via Matching
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.not_found_examples && report.not_found_examples.length > 0 && (
                  <div className="space-y-1.5">
                    {(showAllNotFound ? report.not_found_examples : report.not_found_examples.slice(0, 8)).map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 py-1.5 px-3 rounded-md bg-muted/50 text-xs">
                        <span className="font-mono text-destructive shrink-0">{item.erp_code}</span>
                        <span className="text-muted-foreground truncate flex-1">{item.description}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] shrink-0 gap-1"
                          onClick={() => setResolvingItem(item)}
                        >
                          <Settings className="w-3 h-3" />
                          Gerir
                        </Button>
                      </div>
                    ))}
                    {report.not_found_examples.length > 8 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs h-7 gap-1"
                        onClick={() => setShowAllNotFound(v => !v)}
                      >
                        {showAllNotFound ? (
                          <><ChevronUp className="w-3 h-3" /> Mostrar menos</>
                        ) : (
                          <><ChevronDown className="w-3 h-3" /> Ver mais {report.not_found_examples.length - 8} produtos</>
                        )}
                      </Button>
                    )}
                  </div>
                )}
                {(!report.not_found_examples || report.not_found_examples.length === 0) && report.not_found_codes && (
                  <div className="flex flex-wrap gap-1.5">
                    {report.not_found_codes.map((code: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-[10px] font-mono">{code}</Badge>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">
                  Clique em <strong>Gerir</strong> para vincular um código a uma família existente ou ignorá-lo.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Ver Pendências do Banco */}
          <div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 w-full"
              onClick={() => setShowPendingSection(v => !v)}
            >
              <ListTodo className="w-4 h-4" />
              {showPendingSection ? 'Ocultar' : 'Ver'} Pendências Salvas no Banco — {report.supplier}
            </Button>
            {showPendingSection && (
              <div className="mt-3 space-y-3">
                <PendingSkusSection supplierCode={report.supplier} />
                <PendingClassificationPreview supplierCode={report.supplier} />
              </div>
            )}
          </div>

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
              <Button onClick={() => runSync(false)} disabled={isRunning} className="gap-2">
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Aplicar Alterações
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Resolve Dialog — opened via "Gerir" */}
      <ResolveSKUDialog
        item={resolvingItem}
        supplierCode={supplier || report?.supplier || ''}
        syncRunId={report?.sync_run_id}
        onClose={() => setResolvingItem(null)}
        onResolved={() => {
          toast.success('Resolução salva no banco');
          setResolvingItem(null);
        }}
      />
    </div>
  );
}

function parseNum(val: unknown): number | undefined {
  if (val == null || val === '') return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}
