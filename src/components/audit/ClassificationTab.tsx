import { useState, useMemo, useCallback, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Search, Link2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ConsistencyAuditResult, ConsistencyConflict } from '@/lib/catalogConsistencyAuditor';
import type { FamilyExtended, Price } from '@/types/lens';

interface SupplierFamilyMap {
  id: string;
  supplier: string;
  erp_family_name: string;
  catalog_family_id: string;
  rule_type: string;
  confidence: string;
  active: boolean;
}

interface ClassificationTabProps {
  families: FamilyExtended[];
  prices: Price[];
  auditResult: ConsistencyAuditResult | null;
}

export function ClassificationTab({ families, prices, auditResult }: ClassificationTabProps) {
  const [mappings, setMappings] = useState<SupplierFamilyMap[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [mappingFamily, setMappingFamily] = useState<{ supplier: string; erpName: string } | null>(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState('');

  // Load mappings from DB
  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('supplier_family_map')
        .select('*')
        .eq('active', true)
        .order('supplier');
      
      if (!error && data) {
        setMappings(data as SupplierFamilyMap[]);
      }
    } catch (err) {
      console.error('Error loading mappings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Derive ERP family groups from prices
  const erpFamilyGroups = useMemo(() => {
    const groups = new Map<string, { supplier: string; erpName: string; skuCount: number; familyIds: Set<string> }>();
    
    for (const price of prices) {
      const supplier = price.supplier || 'UNKNOWN';
      // Use lens_category_raw or description prefix as ERP family name
      const erpName = price.lens_category_raw || price.description?.split(' ').slice(0, 2).join(' ') || 'N/A';
      const key = `${supplier}::${erpName}`;
      
      const existing = groups.get(key);
      if (existing) {
        existing.skuCount++;
        existing.familyIds.add(price.family_id);
      } else {
        groups.set(key, {
          supplier,
          erpName,
          skuCount: 1,
          familyIds: new Set([price.family_id]),
        });
      }
    }
    
    return [...groups.values()].sort((a, b) => a.supplier.localeCompare(b.supplier) || a.erpName.localeCompare(b.erpName));
  }, [prices]);

  // Enrich with mapping status
  const enrichedGroups = useMemo(() => {
    return erpFamilyGroups.map(group => {
      const mapping = mappings.find(m => m.supplier === group.supplier && m.erp_family_name === group.erpName);
      const mappedFamily = mapping ? families.find(f => f.id === mapping.catalog_family_id) : null;
      
      let status: string = 'unmapped';
      if (mapping && mappedFamily) {
        status = 'ok';
      } else if (group.familyIds.size === 1) {
        status = 'ok';
      }
      
      return {
        ...group,
        mapping,
        mappedFamily,
        status,
        catalogFamilyId: mapping?.catalog_family_id || (group.familyIds.size === 1 ? [...group.familyIds][0] : undefined),
      };
    });
  }, [erpFamilyGroups, mappings, families]);

  // Filter
  const filteredGroups = useMemo(() => {
    return enrichedGroups.filter(g => {
      const matchesSearch = searchTerm === '' ||
        g.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.erpName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || g.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [enrichedGroups, searchTerm, filterStatus]);

  // Stats
  const stats = useMemo(() => ({
    total: enrichedGroups.length,
    ok: enrichedGroups.filter(g => g.status === 'ok').length,
    unmapped: enrichedGroups.filter(g => g.status === 'unmapped').length,
    conflict: enrichedGroups.filter(g => g.status === 'conflict').length,
  }), [enrichedGroups]);

  // Save mapping
  const saveMapping = useCallback(async (supplier: string, erpName: string, familyId: string) => {
    try {
      const { error } = await supabase
        .from('supplier_family_map')
        .upsert({
          supplier,
          erp_family_name: erpName,
          catalog_family_id: familyId,
          rule_type: 'manual',
          confidence: 'manual',
          active: true,
        }, { onConflict: 'supplier,erp_family_name' });

      if (error) throw error;
      toast.success('Mapeamento salvo');
      setMappingFamily(null);
      setSelectedFamilyId('');
      await loadMappings();
    } catch (err) {
      toast.error('Erro ao salvar mapeamento');
    }
  }, []);

  const getFamilyLabel = (id: string) => {
    const fam = families.find(f => f.id === id);
    return fam ? `${fam.name_original} (${fam.supplier})` : id;
  };

  return (
    <div className="space-y-4">
      {/* Conflict Summary */}
      {auditResult && auditResult.critical.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" />
              Conflitos Críticos ({auditResult.critical.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-1.5">
            {auditResult.critical.slice(0, 10).map((conflict, i) => (
              <ConflictRow key={i} conflict={conflict} families={families} />
            ))}
            {auditResult.critical.length > 10 && (
              <p className="text-xs text-muted-foreground">
                ...e mais {auditResult.critical.length - 10} conflito(s)
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mapping Table */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Mapeamento ERP → Família
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{stats.ok} OK</Badge>
              {stats.unmapped > 0 && (
                <Badge variant="secondary" className="text-xs">{stats.unmapped} Sem Mapping</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar supplier ou família ERP..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="unmapped">Sem Mapping</SelectItem>
                <SelectItem value="conflict">Conflito</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="rounded-md border max-h-[500px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Supplier</TableHead>
                    <TableHead className="text-xs">ERP Family</TableHead>
                    <TableHead className="text-xs text-center">SKUs</TableHead>
                    <TableHead className="text-xs">Família Mapeada</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                    <TableHead className="text-xs text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGroups.slice(0, 100).map((group, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">{group.supplier}</TableCell>
                      <TableCell className="text-xs">{group.erpName}</TableCell>
                      <TableCell className="text-xs text-center">{group.skuCount}</TableCell>
                      <TableCell className="text-xs">
                        {mappingFamily?.supplier === group.supplier && mappingFamily?.erpName === group.erpName ? (
                          <div className="flex items-center gap-1">
                            <Select value={selectedFamilyId} onValueChange={setSelectedFamilyId}>
                              <SelectTrigger className="h-7 text-xs w-48">
                                <SelectValue placeholder="Selecionar família..." />
                              </SelectTrigger>
                              <SelectContent>
                                {families.filter(f => f.active).map(f => (
                                  <SelectItem key={f.id} value={f.id} className="text-xs">
                                    {f.name_original} ({f.supplier})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              disabled={!selectedFamilyId}
                              onClick={() => saveMapping(group.supplier, group.erpName, selectedFamilyId)}
                            >
                              OK
                            </Button>
                          </div>
                        ) : (
                          group.catalogFamilyId ? getFamilyLabel(group.catalogFamilyId) : '—'
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {group.status === 'ok' ? (
                          <Badge variant="outline" className="text-xs bg-accent/50 text-accent-foreground border-accent">OK</Badge>
                        ) : group.status === 'conflict' ? (
                          <Badge variant="destructive" className="text-xs">Conflito</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Sem Mapping</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {group.status !== 'ok' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setMappingFamily({ supplier: group.supplier, erpName: group.erpName })}
                          >
                            Mapear
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConflictRow({ conflict, families }: { conflict: ConsistencyConflict; families: FamilyExtended[] }) {
  const familyName = conflict.familyId
    ? families.find(f => f.id === conflict.familyId)?.name_original || conflict.familyId
    : null;

  const typeLabels: Record<string, string> = {
    SKU_WITHOUT_FAMILY: 'SKU Órfão',
    MIXED_PRODUCT_KIND: 'ProductKind Misto',
    CLINICAL_TYPE_MISMATCH: 'Clinical Type Divergente',
    FAMILY_WITHOUT_ACTIVE_SKU: 'Família sem SKU Ativo',
    INCOMPATIBLE_TECHNOLOGY: 'Tecnologia Incompatível',
    MIXED_SUPPLIER_FAMILY: 'Fornecedores Mistos',
    FAMILY_WITHOUT_SUPPLIER: 'Sem Fornecedor',
    SKU_NULL_CLINICAL_TYPE: 'SKU sem Tipo Clínico',
    SKU_MISSING_ESSENTIAL_RANGE: 'Range Essencial Ausente',
  };

  return (
    <div className="flex items-start gap-2 text-xs p-2 rounded bg-destructive/5">
      <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
      <div>
        <span className="font-medium">{typeLabels[conflict.type] || conflict.type}</span>
        {familyName && <span className="text-muted-foreground"> — {familyName}</span>}
        <p className="text-muted-foreground mt-0.5">{conflict.details}</p>
        {conflict.affectedSkus && conflict.affectedSkus.length > 0 && (
          <p className="text-muted-foreground/70 mt-0.5">
            SKUs: {conflict.affectedSkus.slice(0, 5).join(', ')}
            {conflict.affectedSkus.length > 5 && ` (+${conflict.affectedSkus.length - 5})`}
          </p>
        )}
      </div>
    </div>
  );
}
