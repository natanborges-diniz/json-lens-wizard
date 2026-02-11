/**
 * RecommendationLogsTab - UI for viewing persisted recommendation engine logs
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Search, Eye, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';

interface AuditLog {
  id: string;
  created_at: string;
  seller_id: string;
  store_id: string | null;
  service_id: string | null;
  clinical_type: string;
  catalog_version: string | null;
  input_summary: any;
  output_summary: any;
  scores: any;
  fallbacks: any;
  top_recommendation_id: string | null;
  top_recommendation_name: string | null;
  families_analyzed: number;
  families_eligible: number;
  execution_time_ms: number | null;
}

interface Store {
  id: string;
  name: string;
}

interface Profile {
  user_id: string;
  full_name: string;
}

const CLINICAL_TYPES = ['MONOFOCAL', 'PROGRESSIVA', 'OCUPACIONAL', 'BIFOCAL'];

export function RecommendationLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterStore, setFilterStore] = useState<string>('all');
  const [filterSeller, setFilterSeller] = useState<string>('all');
  const [filterClinicalType, setFilterClinicalType] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [logsRes, storesRes, profilesRes] = await Promise.all([
        supabase
          .from('recommendation_audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('stores').select('id, name'),
        supabase.from('profiles').select('user_id, full_name'),
      ]);

      if (logsRes.data) setLogs(logsRes.data as AuditLog[]);
      if (storesRes.data) setStores(storesRes.data);
      if (profilesRes.data) setProfiles(profilesRes.data);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getSellerName = (sellerId: string) => {
    return profiles.find(p => p.user_id === sellerId)?.full_name || sellerId.slice(0, 8);
  };

  const getStoreName = (storeId: string | null) => {
    if (!storeId) return '—';
    return stores.find(s => s.id === storeId)?.name || storeId.slice(0, 8);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filterStore !== 'all' && log.store_id !== filterStore) return false;
      if (filterSeller !== 'all' && log.seller_id !== filterSeller) return false;
      if (filterClinicalType !== 'all' && log.clinical_type !== filterClinicalType) return false;
      if (dateFrom && new Date(log.created_at) < new Date(dateFrom)) return false;
      if (dateTo && new Date(log.created_at) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [logs, filterStore, filterSeller, filterClinicalType, dateFrom, dateTo]);

  const uniqueSellers = useMemo(() => {
    return [...new Set(logs.map(l => l.seller_id))];
  }, [logs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="bg-card/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">De</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="w-[140px] h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Até</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="w-[140px] h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Loja</Label>
              <Select value={filterStore} onValueChange={setFilterStore}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {stores.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vendedor</Label>
              <Select value={filterSeller} onValueChange={setFilterSeller}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {uniqueSellers.map(id => (
                    <SelectItem key={id} value={id}>{getSellerName(id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo Clínico</Label>
              <Select value={filterClinicalType} onValueChange={setFilterClinicalType}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {CLINICAL_TYPES.map(ct => (
                    <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} className="h-8">
              <Search className="w-3.5 h-3.5 mr-1" /> Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{filteredLogs.length} execuções encontradas</span>
        {filteredLogs.length > 0 && (
          <span>
            Média: {Math.round(filteredLogs.reduce((s, l) => s + l.families_eligible, 0) / filteredLogs.length)} famílias elegíveis
          </span>
        )}
      </div>

      {/* Table */}
      <Card>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Vendedor</TableHead>
                <TableHead className="text-xs">Loja</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs text-center">Analisadas</TableHead>
                <TableHead className="text-xs text-center">Elegíveis</TableHead>
                <TableHead className="text-xs">Top Recomendação</TableHead>
                <TableHead className="text-xs text-center">ms</TableHead>
                <TableHead className="text-xs w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhum log encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map(log => (
                  <TableRow key={log.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                    <TableCell className="text-xs">
                      {new Date(log.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell className="text-xs">{getSellerName(log.seller_id)}</TableCell>
                    <TableCell className="text-xs">{getStoreName(log.store_id)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{log.clinical_type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-center">{log.families_analyzed}</TableCell>
                    <TableCell className="text-xs text-center">{log.families_eligible}</TableCell>
                    <TableCell className="text-xs font-medium">{log.top_recommendation_name || '—'}</TableCell>
                    <TableCell className="text-xs text-center text-muted-foreground">{log.execution_time_ms || '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Detail Dialog */}
      {selectedLog && (
        <LogDetailDialog log={selectedLog} onClose={() => setSelectedLog(null)} getSellerName={getSellerName} getStoreName={getStoreName} />
      )}
    </div>
  );
}

// ============================================
// LOG DETAIL DIALOG
// ============================================

function LogDetailDialog({ 
  log, 
  onClose, 
  getSellerName, 
  getStoreName 
}: { 
  log: AuditLog; 
  onClose: () => void; 
  getSellerName: (id: string) => string; 
  getStoreName: (id: string | null) => string;
}) {
  const input = log.input_summary || {};
  const output = log.output_summary || {};
  const scores = Array.isArray(log.scores) ? log.scores : [];
  const fallbacks = Array.isArray(log.fallbacks) ? log.fallbacks : [];
  const tierKeys = ['essential', 'comfort', 'advanced', 'top'];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Detalhes da Recomendação
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoBox label="Data" value={new Date(log.created_at).toLocaleString('pt-BR')} />
            <InfoBox label="Vendedor" value={getSellerName(log.seller_id)} />
            <InfoBox label="Loja" value={getStoreName(log.store_id)} />
            <InfoBox label="Tipo Clínico" value={log.clinical_type} />
          </div>

          {/* Input Summary */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Inputs</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <InfoBox label="Uso Principal" value={input.anamnesis?.primaryUse || '—'} />
                <InfoBox label="Tela" value={input.anamnesis?.screenHours || '—'} />
                <InfoBox label="Queixas" value={`${input.anamnesis?.complaintsCount || 0} queixas`} />
                <InfoBox label="Famílias" value={`${input.familiesCount || 0} disponíveis`} />
              </div>
              {input.prescription && (
                <div className="grid grid-cols-3 gap-3 text-xs mt-2">
                  <InfoBox label="Esfera máx" value={`±${input.prescription.maxSphere?.toFixed(2) || '0'}`} />
                  <InfoBox label="Cilindro máx" value={`-${input.prescription.maxCylinder?.toFixed(2) || '0'}`} />
                  <InfoBox label="Adição máx" value={`+${input.prescription.maxAddition?.toFixed(2) || '0'}`} />
                </div>
              )}
              {input.anamnesis?.complaints?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {input.anamnesis.complaints.map((c: string) => (
                    <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tiers Output */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Resultado por Tier</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {tierKeys.map(tier => {
                const tierData = output[tier];
                if (!tierData) return null;
                const primary = tierData.primary;
                
                return (
                  <div key={tier} className={`p-3 rounded-lg border ${tierData.isFallback ? 'border-warning/50 bg-warning/5' : 'border-border'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={tierData.isFallback ? 'outline' : 'default'} className="text-[10px] uppercase">
                          {tier}
                        </Badge>
                        {tierData.isFallback && (
                          <Badge variant="outline" className="text-[10px] text-warning border-warning">
                            Fallback
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {tierData.totalOptions || 0} opções
                      </span>
                    </div>
                    
                    {primary ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-semibold">{primary.familyName}</p>
                            <p className="text-xs text-muted-foreground">{primary.supplier}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-primary">{primary.score?.toFixed(1)}</p>
                            <p className="text-[10px] text-muted-foreground">Score final</p>
                          </div>
                        </div>
                        
                        {/* Score Breakdown */}
                        <div className="grid grid-cols-2 gap-2">
                          <ScoreBar label="Clínico (60%)" value={primary.clinicalScore} max={100} color="text-blue-500" />
                          <ScoreBar label="Comercial (40%)" value={primary.commercialScore} max={100} color="text-green-500" />
                        </div>

                        {/* Clinical Components */}
                        {primary.clinicalComponents && (
                          <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
                            <span>Receita: {primary.clinicalComponents.prescriptionMatch}/40</span>
                            <span>Queixas: {primary.clinicalComponents.complaintsMatch}/30</span>
                            <span>Estilo: {primary.clinicalComponents.lifestyleMatch}/30</span>
                          </div>
                        )}

                        {/* Commercial Components */}
                        {primary.commercialComponents && (
                          <div className="grid grid-cols-4 gap-1 text-[10px] text-muted-foreground">
                            <span>SKUs: {primary.commercialComponents.availability}/20</span>
                            <span>Tier: {primary.commercialComponents.tierPosition}/25</span>
                            <span>Dados: {primary.commercialComponents.dataRichness}/20</span>
                            <span>Techs: {primary.commercialComponents.technologyCount}/20</span>
                          </div>
                        )}

                        {/* Top reasons */}
                        {(primary.clinicalReasons?.length > 0 || primary.commercialReasons?.length > 0) && (
                          <div className="space-y-1 mt-1">
                            <p className="text-[10px] font-medium text-muted-foreground">Razões principais:</p>
                            <div className="flex flex-wrap gap-1">
                              {[...(primary.clinicalReasons || []).slice(0, 2), ...(primary.commercialReasons || []).slice(0, 2)].map((reason: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-[9px] py-0">{reason}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {primary.startingPrice && (
                          <p className="text-xs text-muted-foreground">
                            A partir de R$ {(primary.startingPrice * 2).toFixed(2)} (par)
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Nenhuma família disponível neste tier</p>
                    )}

                    {tierData.fallbackReason && (
                      <p className="text-[10px] text-warning mt-1">⚠️ {tierData.fallbackReason}</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* All Scored Families */}
          {scores.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Ranking Completo ({scores.length} famílias)</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <ScrollArea className="h-[200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">#</TableHead>
                        <TableHead className="text-[10px]">Família</TableHead>
                        <TableHead className="text-[10px]">Tier</TableHead>
                        <TableHead className="text-[10px] text-right">Final</TableHead>
                        <TableHead className="text-[10px] text-right">Clínico</TableHead>
                        <TableHead className="text-[10px] text-right">Comercial</TableHead>
                        <TableHead className="text-[10px] text-center">Elegível</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scores
                        .sort((a: any, b: any) => b.final - a.final)
                        .map((s: any, i: number) => (
                          <TableRow key={`${s.familyId}-${i}`}>
                            <TableCell className="text-[10px]">{i + 1}</TableCell>
                            <TableCell className="text-[10px] font-medium">{s.familyName}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[9px] uppercase">{s.tier}</Badge>
                            </TableCell>
                            <TableCell className="text-[10px] text-right font-bold">{s.final?.toFixed(1)}</TableCell>
                            <TableCell className="text-[10px] text-right">{s.clinical?.toFixed(1)}</TableCell>
                            <TableCell className="text-[10px] text-right">{s.commercial?.toFixed(1)}</TableCell>
                            <TableCell className="text-center">
                              {s.isEligible ? (
                                <Badge variant="default" className="text-[9px] py-0">✓</Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[9px] py-0">✗</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Fallbacks */}
          {fallbacks.length > 0 && (
            <Card className="border-warning/50">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm text-warning">Fallbacks Aplicados</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {fallbacks.map((fb: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <Badge variant="outline" className="text-[10px] uppercase">{fb.tier}</Badge>
                    <span>{fb.reason}</span>
                    {fb.hasPrimary ? (
                      <Badge variant="secondary" className="text-[9px]">Com substituto</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[9px]">Vazio</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Metadata */}
          <div className="flex gap-4 text-[10px] text-muted-foreground pt-2 border-t">
            <span>Catálogo: {log.catalog_version || '—'}</span>
            <span>Tempo: {log.execution_time_ms ? `${log.execution_time_ms}ms` : '—'}</span>
            <span>ID: {log.id.slice(0, 8)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-medium">{value}</p>
    </div>
  );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const percent = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${color}`}>{value?.toFixed(1)}</span>
      </div>
      <Progress value={percent} className="h-1.5" />
    </div>
  );
}
