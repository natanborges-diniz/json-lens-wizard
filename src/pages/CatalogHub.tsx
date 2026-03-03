/**
 * CatalogHub - Hub Unificado de Gestão do Catálogo
 * 
 * Substitui AdminDashboard + CatalogAudit + CatalogAuditPage (órfão)
 * 8 seções lógicas via sidebar: Visão Geral, Famílias, Macros, Fornecedores, Tecnologias, Importação, Qualidade, Histórico
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  LayoutGrid,
  Package,
  Layers,
  Building,
  Cpu,
  Upload,
  ShieldCheck,
  History,
  Search,
  DollarSign,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Boxes,
  Save,
  RotateCcw,
  RefreshCw,
  X,
  Tag,
  Activity,
  FileSpreadsheet,
  BarChart3,
  Settings2,
  Wand2,
  FileJson,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLensStore } from '@/store/lensStore';
import { useCatalogLoader } from '@/hooks/useCatalogLoader';
import { FamilyCard } from '@/components/audit/FamilyCard';
import { BatchActionBar } from '@/components/audit/BatchActionBar';
import { TechnologyCard } from '@/components/audit/TechnologyCard';
import { MacroCard } from '@/components/audit/MacroCard';
import { SupplierCard } from '@/components/audit/SupplierCard';
import { ExportDialog } from '@/components/audit/ExportDialog';
import { IntegrityExportButton } from '@/components/audit/IntegrityExportButton';
import { ClassificationReportDialog } from '@/components/audit/ClassificationReportDialog';
import { MatchingRulesEditor } from '@/components/audit/MatchingRulesEditor';
import { CatalogVersionBadge, saveCatalogVersion } from '@/components/audit/CatalogVersionBadge';
import { CatalogVersionHistory } from '@/components/audit/CatalogVersionHistory';
import { CatalogRestoreDialog } from '@/components/audit/CatalogRestoreDialog';
import { CloudSyncIndicator } from '@/components/audit/CloudSyncIndicator';
import { DataSourceDiagnostic } from '@/components/audit/DataSourceDiagnostic';
import { RecommendationLogsTab } from '@/components/audit/RecommendationLogsTab';
import { ErpImportTab } from '@/components/audit/ErpImportTab';
import { CommercialAuditTab } from '@/components/audit/CommercialAuditTab';
import { CatalogStatusBanner } from '@/components/audit/CatalogStatusBanner';
import { ClassificationTab } from '@/components/audit/ClassificationTab';
import { ImportValidationReport } from '@/components/audit/ImportValidationReport';
import { CloudSaveConfirmDialog } from '@/components/audit/CloudSaveConfirmDialog';
import { SupplierPriorityManager } from '@/components/settings/SupplierPriorityManager';
import { useClinicalIntegrityReport } from '@/hooks/useClinicalIntegrityReport';
import { validateCatalogImport, executePostImportActions, clearRulesCache, type ValidationReport } from '@/lib/catalogValidationEngine';
import type { ConsistencyAuditResult, AutoFix } from '@/lib/catalogConsistencyAuditor';
import type { LensData, FamilyExtended, Price, MacroExtended, Technology, ImportMode } from '@/types/lens';
import { formatImportReceipt, type ImportResult } from '@/lib/catalogImporter';
import {
  runClassificationEngine,
  getEngineFromLensData,
  type ClassificationReport,
  type ClassificationEngineResult,
  type FamilyMatchingEngine,
} from '@/lib/skuClassificationEngine';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ───
interface FamilyWithPrices extends FamilyExtended {
  prices: Price[];
  priceCount: number;
  activePriceCount: number;
  minPrice: number;
  maxPrice: number;
  indices: string[];
}

interface PendingChange {
  type: 'macro' | 'category' | 'supplier' | 'active';
  familyId: string;
  oldValue: string | boolean;
  newValue: string | boolean;
}

type SectionId = 'overview' | 'families' | 'macros' | 'suppliers' | 'technologies' | 'import' | 'quality' | 'history';

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Visão Geral', icon: LayoutGrid },
  { id: 'families', label: 'Famílias', icon: Package },
  { id: 'macros', label: 'Macros', icon: Layers },
  { id: 'suppliers', label: 'Fornecedores', icon: Building },
  { id: 'technologies', label: 'Tecnologias', icon: Cpu },
  { id: 'import', label: 'Importação', icon: Upload },
  { id: 'quality', label: 'Qualidade', icon: ShieldCheck },
  { id: 'history', label: 'Histórico', icon: History },
];

// ─── Component ───
const CatalogHub = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = (searchParams.get('section') || 'overview') as SectionId;
  const setActiveSection = useCallback((section: SectionId) => {
    setSearchParams(prev => { const next = new URLSearchParams(prev); next.set('section', section); return next; }, { replace: true });
  }, [setSearchParams]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ─── Families state ───
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriceMin, setFilterPriceMin] = useState('');
  const [filterPriceMax, setFilterPriceMax] = useState('');
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);

  // ─── Technologies state ───
  const [techSearchTerm, setTechSearchTerm] = useState('');
  const [filterTechSupplier, setFilterTechSupplier] = useState<string>('all');

  // ─── Classification state ───
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationReport, setClassificationReport] = useState<ClassificationReport | null>(null);
  const [classificationResult, setClassificationResult] = useState<ClassificationEngineResult | null>(null);
  const [showClassificationDialog, setShowClassificationDialog] = useState(false);
  const [isApplyingClassification, setIsApplyingClassification] = useState(false);

  // ─── Import state (from AdminDashboard) ───
  const [jsonInput, setJsonInput] = useState('');
  const [importMode, setImportMode] = useState<ImportMode>('replace');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [pendingImportData, setPendingImportData] = useState<LensData | null>(null);
  const [showCloudSaveDialog, setShowCloudSaveDialog] = useState(false);
  const [cloudSaveImportSummary, setCloudSaveImportSummary] = useState<{ familiesCount: number; pricesCount: number; mode: string } | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Quality sub-tab
  const [qualitySubTab, setQualitySubTab] = useState<'structural' | 'clinical' | 'classification'>('structural');
  // History sub-tab
  const [historySubTab, setHistorySubTab] = useState<'versions' | 'engine-logs' | 'commercial'>('versions');

  // ─── Store ───
  const {
    families,
    prices,
    macros,
    addons,
    technologyLibrary,
    loadLensData,
    loadCatalogFromCloud,
    saveCatalogToCloud,
    isSavingToCloud,
    toggleFamilyActive,
    togglePriceActive,
    rawLensData,
    catalogStatus,
    lastAuditResult,
    runConsistencyAudit,
    schemaVersion,
    attributeDefs,
    supplierPriorities,
    benefitRules,
    quoteExplainer,
    indexDisplay,
    importCatalog,
    importErpPatch,
    canRollback,
    rollbackLastImport,
    updateSupplierPriority,
    isDataLoaded,
  } = useLensStore();

  // ─── Local state for unsaved edits ───
  const [localFamilies, setLocalFamilies] = useState<FamilyExtended[]>([]);
  const [localTechnologies, setLocalTechnologies] = useState<Record<string, Technology>>({});

  useEffect(() => { setLocalFamilies(families); }, [families]);
  useEffect(() => { if (technologyLibrary?.items) setLocalTechnologies(technologyLibrary.items); }, [technologyLibrary]);

  // ─── Load catalog on mount ───
  const { isLoading: catalogLoading, loadCatalog } = useCatalogLoader();
  useEffect(() => {
    if (families.length === 0) {
      setIsLoading(true);
      loadCatalog().finally(() => setIsLoading(false));
    }
  }, [families.length, loadCatalog]);

  // ─── Run consistency audit ───
  useEffect(() => {
    if (families.length > 0 && prices.length > 0) runConsistencyAudit();
  }, [families.length, prices.length]);

  // ─── Auto-fix handler ───
  const handleApplyAutoFixes = useCallback((fixes: AutoFix[]) => {
    let updatedFamilies = [...localFamilies];
    let changesCount = 0;
    for (const fix of fixes) {
      if (fix.field === 'clinical_type' && fix.suggestedValue !== 'REMOVE') {
        updatedFamilies = updatedFamilies.map(f => f.id === fix.familyId ? { ...f, clinical_type: fix.suggestedValue as any, category: fix.suggestedValue as any } : f);
        changesCount++;
      }
      if (fix.type === 'REMOVE_INCOMPATIBLE_TECH') {
        updatedFamilies = updatedFamilies.map(f => {
          if (f.id === fix.familyId && f.technology_refs) {
            changesCount++;
            return { ...f, technology_refs: f.technology_refs.filter(t => t !== fix.currentValue) };
          }
          return f;
        });
      }
    }
    if (changesCount > 0) {
      setLocalFamilies(updatedFamilies);
      setPendingChanges(prev => [...prev, ...fixes.map(f => ({ type: 'category' as const, familyId: f.familyId, oldValue: f.currentValue || '', newValue: f.suggestedValue }))]);
      toast.success(`${changesCount} correção(ões) automática(s) aplicada(s)`);
    }
  }, [localFamilies]);

  // ─── Derived data ───
  const uniqueSuppliers = useMemo(() => [...new Set(localFamilies.map(f => f.supplier))].sort(), [localFamilies]);
  const uniqueCategories = useMemo(() => [...new Set(localFamilies.map(f => f.category))].sort(), [localFamilies]);
  const tierOptions = [
    { value: 'essential', label: 'Essencial' },
    { value: 'comfort', label: 'Conforto' },
    { value: 'advanced', label: 'Avançado' },
    { value: 'top', label: 'Top' },
  ];

  const getFamilyTier = useCallback((family: FamilyExtended) => {
    const macro = macros.find(m => m.id === family.macro);
    return macro?.tier_key || 'essential';
  }, [macros]);

  const familiesWithPrices: FamilyWithPrices[] = useMemo(() => {
    return localFamilies.map(family => {
      const familyPrices = prices.filter(p => p.family_id === family.id);
      const activePrices = familyPrices.filter(p => p.active && !p.blocked);
      const salePrices = familyPrices.map(p => p.price_sale_half_pair).filter(p => p > 0);
      return {
        ...family,
        prices: familyPrices,
        priceCount: familyPrices.length,
        activePriceCount: activePrices.length,
        minPrice: salePrices.length > 0 ? Math.min(...salePrices) : 0,
        maxPrice: salePrices.length > 0 ? Math.max(...salePrices) : 0,
        indices: [...new Set(familyPrices.map(p => p.index))].sort(),
      };
    });
  }, [localFamilies, prices]);

  const filteredFamilies = useMemo(() => {
    return familiesWithPrices.filter(family => {
      const matchesSearch = searchTerm === '' || family.name_original.toLowerCase().includes(searchTerm.toLowerCase()) || family.id.toLowerCase().includes(searchTerm.toLowerCase()) || family.supplier.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSupplier = filterSupplier === 'all' || family.supplier === filterSupplier;
      const matchesCategory = filterCategory === 'all' || family.category === filterCategory;
      const matchesTier = filterTier === 'all' || getFamilyTier(family) === filterTier;
      const matchesStatus = filterStatus === 'all' || (filterStatus === 'active' && family.active) || (filterStatus === 'inactive' && !family.active) || (filterStatus === 'no_prices' && family.activePriceCount === 0);
      const minP = filterPriceMin ? parseFloat(filterPriceMin) : 0;
      const maxP = filterPriceMax ? parseFloat(filterPriceMax) : Infinity;
      const matchesPrice = family.minPrice >= minP && (family.maxPrice <= maxP || (!filterPriceMax && family.minPrice > 0));
      return matchesSearch && matchesSupplier && matchesCategory && matchesTier && matchesStatus && matchesPrice;
    });
  }, [familiesWithPrices, searchTerm, filterSupplier, filterCategory, filterTier, filterStatus, filterPriceMin, filterPriceMax, getFamilyTier]);

  // ─── Change handlers (all from CatalogAudit) ───
  const handleMacroChange = useCallback((familyId: string, newMacro: string) => {
    const family = localFamilies.find(f => f.id === familyId);
    if (!family || family.macro === newMacro) return;
    setLocalFamilies(prev => prev.map(f => f.id === familyId ? { ...f, macro: newMacro } : f));
    setPendingChanges(prev => { const existing = prev.findIndex(c => c.familyId === familyId && c.type === 'macro'); if (existing >= 0) { const u = [...prev]; u[existing] = { ...u[existing], newValue: newMacro }; return u; } return [...prev, { type: 'macro', familyId, oldValue: family.macro, newValue: newMacro }]; });
    toast.success(`Macro alterado para ${newMacro}`, { duration: 1500 });
  }, [localFamilies]);

  const handleCategoryChange = useCallback((familyId: string, newCategory: string) => {
    const family = localFamilies.find(f => f.id === familyId);
    if (!family || family.category === newCategory) return;
    setLocalFamilies(prev => prev.map(f => f.id === familyId ? { ...f, category: newCategory as any } : f));
    setPendingChanges(prev => { const existing = prev.findIndex(c => c.familyId === familyId && c.type === 'category'); if (existing >= 0) { const u = [...prev]; u[existing] = { ...u[existing], newValue: newCategory }; return u; } return [...prev, { type: 'category', familyId, oldValue: family.category, newValue: newCategory }]; });
  }, [localFamilies]);

  const handleSupplierChange = useCallback((familyId: string, newSupplier: string) => {
    const family = localFamilies.find(f => f.id === familyId);
    if (!family || family.supplier === newSupplier) return;
    setLocalFamilies(prev => prev.map(f => f.id === familyId ? { ...f, supplier: newSupplier } : f));
    setPendingChanges(prev => { const existing = prev.findIndex(c => c.familyId === familyId && c.type === 'supplier'); if (existing >= 0) { const u = [...prev]; u[existing] = { ...u[existing], newValue: newSupplier }; return u; } return [...prev, { type: 'supplier', familyId, oldValue: family.supplier, newValue: newSupplier }]; });
  }, [localFamilies]);

  const handleActiveToggle = useCallback((familyId: string) => {
    const family = localFamilies.find(f => f.id === familyId);
    if (!family) return;
    setLocalFamilies(prev => prev.map(f => f.id === familyId ? { ...f, active: !f.active } : f));
    setPendingChanges(prev => { const existing = prev.findIndex(c => c.familyId === familyId && c.type === 'active'); if (existing >= 0) { const u = [...prev]; u[existing] = { ...u[existing], newValue: !family.active }; return u; } return [...prev, { type: 'active', familyId, oldValue: family.active, newValue: !family.active }]; });
  }, [localFamilies]);

  const handlePriceActiveToggle = useCallback((erpCode: string) => { togglePriceActive(erpCode); }, [togglePriceActive]);

  const handleTechnologyChange = useCallback((familyId: string, techRefs: string[]) => {
    setLocalFamilies(prev => prev.map(f => f.id === familyId ? { ...f, technology_refs: techRefs } : f));
    setPendingChanges(prev => [...prev, { type: 'active', familyId, oldValue: 'tech_change' as any, newValue: `${techRefs.length} tecnologias` as any }]);
  }, []);

  const handleDeleteFamily = useCallback((familyId: string) => {
    setLocalFamilies(prev => prev.filter(f => f.id !== familyId));
    setPendingChanges(prev => [...prev, { type: 'active', familyId, oldValue: true, newValue: 'deleted' as any }]);
    toast.success('Família excluída', { duration: 1500 });
  }, []);

  const handleTechnologyUpdate = useCallback((techId: string, updates: Partial<Technology>) => {
    setLocalTechnologies(prev => ({ ...prev, [techId]: { ...prev[techId], ...updates } }));
    setPendingChanges(prev => [...prev, { type: 'active' as const, familyId: `tech_${techId}`, oldValue: 'original', newValue: 'updated' } as PendingChange]);
    toast.success('Tecnologia atualizada', { duration: 1500 });
  }, []);

  const handleMacroUpdate = useCallback((macroId: string, updates: Partial<MacroExtended>, affectedFamilies: FamilyExtended[]) => {
    setPendingChanges(prev => [...prev, { type: 'macro' as const, familyId: `macro_${macroId}`, oldValue: 'original', newValue: JSON.stringify(updates) } as PendingChange]);
    toast.success(`Macro atualizado - ${affectedFamilies.length} famílias afetadas`, { duration: 2000 });
  }, []);

  const handleSupplierRename = useCallback((oldName: string, newName: string, affectedFamilies: FamilyExtended[], affectedPrices: Price[]) => {
    setLocalFamilies(prev => prev.map(f => f.supplier === oldName ? { ...f, supplier: newName } : f));
    setPendingChanges(prev => [...prev, { type: 'supplier' as const, familyId: `supplier_rename_${oldName}`, oldValue: oldName, newValue: newName } as PendingChange]);
    toast.success(`Fornecedor renomeado: ${affectedFamilies.length} famílias e ${affectedPrices.length} SKUs afetados`);
  }, []);

  // ─── Selection handlers ───
  const handleSelectionChange = useCallback((familyId: string, selected: boolean) => {
    setSelectedIds(prev => { const next = new Set(prev); selected ? next.add(familyId) : next.delete(familyId); return next; });
  }, []);
  const handleSelectAll = useCallback(() => { setSelectedIds(new Set(filteredFamilies.map(f => f.id))); }, [filteredFamilies]);
  const handleClearSelection = useCallback(() => { setSelectedIds(new Set()); }, []);
  const toggleSelectAll = useCallback(() => {
    const allIds = filteredFamilies.map(f => f.id);
    setSelectedIds(allIds.every(id => selectedIds.has(id)) ? new Set() : new Set(allIds));
  }, [filteredFamilies, selectedIds]);

  // ─── Batch handlers ───
  const getMacroForTier = useCallback((category: string, tierKey: string) => {
    return macros.find(m => m.category === category && m.tier_key === tierKey)?.id || null;
  }, [macros]);

  const handleBatchTierChange = useCallback((newTier: string) => {
    let changedCount = 0;
    setLocalFamilies(prev => prev.map(f => { if (!selectedIds.has(f.id)) return f; const nm = getMacroForTier(f.category, newTier); if (nm && nm !== f.macro) { changedCount++; return { ...f, macro: nm }; } return f; }));
    localFamilies.filter(f => selectedIds.has(f.id)).forEach(family => {
      const nm = getMacroForTier(family.category, newTier);
      if (nm && family.macro !== nm) setPendingChanges(prev => { const e = prev.findIndex(c => c.familyId === family.id && c.type === 'macro'); if (e >= 0) { const u = [...prev]; u[e] = { ...u[e], newValue: nm }; return u; } return [...prev, { type: 'macro', familyId: family.id, oldValue: family.macro, newValue: nm }]; });
    });
    toast.success(`Tier alterado em ${changedCount} famílias`);
    setSelectedIds(new Set());
  }, [localFamilies, selectedIds, getMacroForTier]);

  const handleBatchCategoryChange = useCallback((newCategory: string) => {
    setLocalFamilies(prev => prev.map(f => selectedIds.has(f.id) ? { ...f, category: newCategory as any } : f));
    localFamilies.filter(f => selectedIds.has(f.id)).forEach(family => {
      if (family.category !== newCategory) setPendingChanges(prev => { const e = prev.findIndex(c => c.familyId === family.id && c.type === 'category'); if (e >= 0) { const u = [...prev]; u[e] = { ...u[e], newValue: newCategory }; return u; } return [...prev, { type: 'category', familyId: family.id, oldValue: family.category, newValue: newCategory }]; });
    });
    toast.success(`Categoria alterada em ${selectedIds.size} famílias`);
    setSelectedIds(new Set());
  }, [localFamilies, selectedIds]);

  const handleBatchSupplierChange = useCallback((newSupplier: string) => {
    setLocalFamilies(prev => prev.map(f => selectedIds.has(f.id) ? { ...f, supplier: newSupplier } : f));
    localFamilies.filter(f => selectedIds.has(f.id)).forEach(family => {
      if (family.supplier !== newSupplier) setPendingChanges(prev => { const e = prev.findIndex(c => c.familyId === family.id && c.type === 'supplier'); if (e >= 0) { const u = [...prev]; u[e] = { ...u[e], newValue: newSupplier }; return u; } return [...prev, { type: 'supplier', familyId: family.id, oldValue: family.supplier, newValue: newSupplier }]; });
    });
    toast.success(`Fornecedor alterado em ${selectedIds.size} famílias`);
    setSelectedIds(new Set());
  }, [localFamilies, selectedIds]);

  const handleBatchActivate = useCallback(() => {
    const sel = localFamilies.filter(f => selectedIds.has(f.id) && !f.active);
    setLocalFamilies(prev => prev.map(f => selectedIds.has(f.id) ? { ...f, active: true } : f));
    sel.forEach(f => setPendingChanges(prev => [...prev, { type: 'active', familyId: f.id, oldValue: false, newValue: true }]));
    toast.success(`${sel.length} famílias ativadas`);
    setSelectedIds(new Set());
  }, [localFamilies, selectedIds]);

  const handleBatchDeactivate = useCallback(() => {
    const sel = localFamilies.filter(f => selectedIds.has(f.id) && f.active);
    setLocalFamilies(prev => prev.map(f => selectedIds.has(f.id) ? { ...f, active: false } : f));
    sel.forEach(f => setPendingChanges(prev => [...prev, { type: 'active', familyId: f.id, oldValue: true, newValue: false }]));
    toast.success(`${sel.length} famílias desativadas`);
    setSelectedIds(new Set());
  }, [localFamilies, selectedIds]);

  const handleBatchDelete = useCallback(() => {
    const ids = [...selectedIds];
    setLocalFamilies(prev => prev.filter(f => !selectedIds.has(f.id)));
    ids.forEach(id => setPendingChanges(prev => [...prev, { type: 'active', familyId: id, oldValue: true, newValue: 'deleted' as any }]));
    toast.success(`${ids.length} famílias excluídas`);
    setSelectedIds(new Set());
  }, [selectedIds]);

  // ─── Technologies ───
  const technologiesArray = useMemo(() => Object.values(localTechnologies), [localTechnologies]);
  const techSuppliers = useMemo(() => { const s = new Set<string>(); technologiesArray.forEach(t => Object.keys(t.name_commercial || {}).forEach(sup => s.add(sup))); return [...s].sort(); }, [technologiesArray]);
  const getTechUsageCount = useCallback((techId: string) => localFamilies.filter(f => f.technology_refs?.includes(techId)).length, [localFamilies]);
  const filteredTechnologies = useMemo(() => {
    return technologiesArray.filter(tech => {
      const matchesSearch = techSearchTerm === '' || tech.name_common.toLowerCase().includes(techSearchTerm.toLowerCase()) || tech.id.toLowerCase().includes(techSearchTerm.toLowerCase());
      const matchesSupplier = filterTechSupplier === 'all' || Object.keys(tech.name_commercial || {}).includes(filterTechSupplier);
      return matchesSearch && matchesSupplier;
    });
  }, [technologiesArray, techSearchTerm, filterTechSupplier]);

  // ─── Filters state ───
  const allFilteredSelected = useMemo(() => filteredFamilies.length > 0 && filteredFamilies.every(f => selectedIds.has(f.id)), [filteredFamilies, selectedIds]);
  const someFilteredSelected = useMemo(() => filteredFamilies.some(f => selectedIds.has(f.id)) && !allFilteredSelected, [filteredFamilies, selectedIds, allFilteredSelected]);
  const hasActiveFilters = searchTerm || filterSupplier !== 'all' || filterCategory !== 'all' || filterTier !== 'all' || filterStatus !== 'all' || filterPriceMin || filterPriceMax;

  const clearFilters = () => { setSearchTerm(''); setFilterSupplier('all'); setFilterCategory('all'); setFilterTier('all'); setFilterStatus('all'); setFilterPriceMin(''); setFilterPriceMax(''); };

  // ─── Save / Discard ───
  const saveAllChanges = async () => {
    if (pendingChanges.length === 0) return;
    const updatedTechLib = Object.keys(localTechnologies).length > 0 ? { items: localTechnologies } : rawLensData?.technology_library;
    if (rawLensData) {
      const updatedData: LensData = { ...rawLensData, families: localFamilies, technology_library: updatedTechLib };
      loadLensData(updatedData);
    }
    const success = await saveCatalogToCloud();
    if (success) {
      const store = useLensStore.getState();
      await saveCatalogVersion({
        schemaVersion: store.schemaVersion || '1.2',
        datasetName: 'Edição Manual',
        importMode: 'increment',
        familiesCount: store.families.filter(f => f.active).length,
        pricesCount: store.prices.filter(p => p.active && !p.blocked).length,
        addonsCount: store.addons?.length || 0,
        technologiesCount: Object.keys(localTechnologies).length,
        changesSummary: { manual_changes: pendingChanges.length },
        notes: [`${pendingChanges.length} alterações manuais aplicadas`],
      });
      toast.success(`${pendingChanges.length} alterações salvas com sucesso!`);
      setPendingChanges([]);
    } else {
      toast.error('Erro ao salvar alterações');
    }
  };

  const discardChanges = () => {
    setLocalFamilies(families);
    if (technologyLibrary?.items) setLocalTechnologies(technologyLibrary.items);
    setPendingChanges([]);
    toast.info('Alterações descartadas');
  };

  const reloadFromCloud = async () => {
    setIsLoading(true);
    try {
      const cloudLoaded = await loadCatalogFromCloud();
      if (cloudLoaded) {
        const store = useLensStore.getState();
        setLocalFamilies(store.families);
        if (store.technologyLibrary?.items) setLocalTechnologies(store.technologyLibrary.items);
        setPendingChanges([]);
        toast.success('Catálogo recarregado da nuvem');
      } else { toast.error('Catálogo não encontrado na nuvem'); }
    } catch { toast.error('Erro ao recarregar catálogo'); }
    finally { setIsLoading(false); }
  };

  // ─── Classification ───
  const runClassification = useCallback(async () => {
    if (!rawLensData) { toast.error('Nenhum catálogo carregado'); return; }
    setIsClassifying(true);
    try {
      const engine = getEngineFromLensData(rawLensData);
      const result = runClassificationEngine(rawLensData, engine || undefined);
      setClassificationResult(result);
      setClassificationReport(result.report);
      setShowClassificationDialog(true);
      result.success ? toast.success('Classificação concluída') : toast.warning('Classificação com erros');
    } catch { toast.error('Erro ao executar classificação'); }
    finally { setIsClassifying(false); }
  }, [rawLensData]);

  const applyClassificationChanges = useCallback(async () => {
    if (!classificationResult || !rawLensData) return;
    setIsApplyingClassification(true);
    try {
      const updatedData: LensData = { ...rawLensData, prices: classificationResult.updated_prices, families: classificationResult.updated_families };
      loadLensData(updatedData);
      setLocalFamilies(classificationResult.updated_families);
      await saveCatalogToCloud();
      toast.success('Alterações de classificação aplicadas');
      setShowClassificationDialog(false);
      setClassificationResult(null);
      setClassificationReport(null);
    } catch { toast.error('Erro ao aplicar alterações'); }
    finally { setIsApplyingClassification(false); }
  }, [classificationResult, rawLensData, loadLensData, saveCatalogToCloud]);

  const handleSaveMatchingEngine = useCallback(async (engine: FamilyMatchingEngine) => {
    if (!rawLensData) { toast.error('Nenhum catálogo carregado'); return; }
    try {
      const updatedData: LensData = { ...rawLensData, family_matching_engine: engine } as LensData & { family_matching_engine: FamilyMatchingEngine };
      loadLensData(updatedData);
      await saveCatalogToCloud();
      toast.success('Regras de classificação salvas');
    } catch { toast.error('Erro ao salvar regras'); }
  }, [rawLensData, loadLensData, saveCatalogToCloud]);

  // ─── Import helpers (from AdminDashboard) ───
  const sanitizeJsonString = (s: string) => s.replace(/:\s*NaN\b/g, ': null').replace(/:\s*-?Infinity\b/g, ': null').replace(/,\s*NaN\b/g, ', null').replace(/,\s*-?Infinity\b/g, ', null').replace(/\[\s*NaN\b/g, '[null').replace(/\[\s*-?Infinity\b/g, '[null');

  const sanitizeForJson = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'number') return Number.isNaN(obj) || !Number.isFinite(obj) ? null : obj;
    if (typeof obj === 'string' || typeof obj === 'boolean') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeForJson);
    if (typeof obj === 'object') { const r: Record<string, unknown> = {}; for (const [k, v] of Object.entries(obj as Record<string, unknown>)) { r[k] = sanitizeForJson(v); } return r; }
    return obj;
  };

  const validateAndPreviewImport = async () => {
    try {
      const sanitized = sanitizeJsonString(jsonInput);
      const hadInvalid = sanitized !== jsonInput;
      const data = JSON.parse(sanitized) as LensData;
      clearRulesCache();
      const report = await validateCatalogImport(data, importMode as 'increment' | 'replace');
      setValidationReport(report);
      if (hadInvalid) toast.info('Valores NaN/Infinity convertidos para null');
      if (!report.isValid) { setPendingImportData(null); toast.error(`Validação falhou: ${report.summary.totalBlockingErrors} erro(s)`); return; }
      setPendingImportData(data);
      report.warnings.length > 0 ? toast.warning(`${report.warnings.length} alerta(s). Revise antes de prosseguir.`) : toast.success('Validação aprovada!');
    } catch (e) {
      setValidationReport({ isValid: false, blockingErrors: [{ code: 'JSON_PARSE_ERROR', ruleId: 'JSON_PARSE', message: 'JSON inválido: ' + (e as Error).message, section: 'root', severity: 'blocking' }], warnings: [], summary: { totalBlockingErrors: 1, totalWarnings: 0, affectedFamilies: [], affectedSkus: [], byRuleId: { JSON_PARSE: 1 } }, rulesVersion: 'N/A', timestamp: new Date().toISOString() });
      setPendingImportData(null);
      toast.error('JSON inválido');
    }
  };

  const executeValidatedImport = async () => {
    if (!pendingImportData || !validationReport) return;
    let dataToImport = pendingImportData;
    let postImportMessages: string[] = [];
    if (validationReport.warnings.length > 0) {
      try {
        const { modifiedData, results } = await executePostImportActions(pendingImportData, validationReport);
        dataToImport = modifiedData;
        results.forEach(r => postImportMessages.push(`${r.message} (${r.affectedItems.length} itens)`));
      } catch { /* continue with original */ }
    }
    const result = importCatalog(dataToImport, importMode as 'increment' | 'replace');
    setImportResult(result);
    if (result.success) {
      toast.success('Importação realizada com sucesso!');
      postImportMessages.forEach(msg => toast.info(msg, { duration: 5000 }));
      setJsonInput(''); setValidationReport(null); setPendingImportData(null);
      const mergedData = result.mergedData;
      if (mergedData) {
        await saveCatalogVersion({ schemaVersion: mergedData.meta?.schema_version || '1.0', datasetName: mergedData.meta?.dataset_name, importMode: importMode as string, familiesCount: mergedData.families?.length || 0, pricesCount: mergedData.prices?.length || 0, addonsCount: mergedData.addons?.length || 0, technologiesCount: Object.keys(mergedData.technology_library?.items || {}).length, changesSummary: result.summary ? { mode: result.summary.mode, changes: result.summary.changes, totals: result.summary.totals, postImportActions: postImportMessages } : undefined, notes: mergedData.meta?.notes });
        setCloudSaveImportSummary({ familiesCount: mergedData.families?.length || 0, pricesCount: mergedData.prices?.length || 0, mode: importMode === 'replace' ? 'Substituição' : 'Incremento' });
        setShowCloudSaveDialog(true);
      }
    } else {
      toast.error('Falha na importação');
    }
  };

  const exportJson = () => {
    if (!families.length && !prices.length) { toast.error('Nenhum dado para exportar'); return; }
    const exportData: LensData = {
      ...(rawLensData || {}),
      meta: { schema_version: schemaVersion || '1.2', dataset_name: 'LensFlow Export', generated_at: new Date().toISOString(), counts: { families: families.filter(f => f.active).length, addons: addons.filter(a => a.active).length, skus_prices: prices.filter(p => p.active && !p.blocked).length }, notes: ['Exported from LensFlow'] },
      scales: rawLensData?.scales || {},
      attribute_defs: attributeDefs,
      macros, families, addons,
      products_avulsos: rawLensData?.products_avulsos || [],
      prices,
      technology_library: technologyLibrary || undefined,
      benefit_rules: benefitRules || undefined,
      quote_explainer: quoteExplainer || undefined,
      index_display: indexDisplay?.length > 0 ? indexDisplay : undefined,
    };
    const json = JSON.stringify(sanitizeForJson(exportData), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `lenses-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast.success('JSON exportado!');
  };

  // ─── Stats ───
  const stats = useMemo(() => {
    const total = localFamilies.length;
    const active = localFamilies.filter(f => f.active).length;
    const withPrices = familiesWithPrices.filter(f => f.activePriceCount > 0).length;
    const totalPrices = prices.length;
    const activePrices = prices.filter(p => p.active && !p.blocked).length;
    return { total, active, withPrices, totalPrices, activePrices };
  }, [localFamilies, prices, familiesWithPrices]);

  const { report: clinicalReport } = useClinicalIntegrityReport();

  const integrityIssues = useMemo(() => {
    const familiesWithoutPrices = familiesWithPrices.filter(f => f.activePriceCount === 0 && f.active);
    const familyIds = new Set(localFamilies.map(f => f.id));
    const orphanedPrices = prices.filter(p => !familyIds.has(p.family_id));
    const macroIds = new Set(macros.map(m => m.id));
    const invalidMacros = localFamilies.filter(f => !macroIds.has(f.macro));
    const clinicalProblems = clinicalReport?.problem_count || 0;
    return { familiesWithoutPrices, orphanedPrices, invalidMacros, clinicalProblems, total: familiesWithoutPrices.length + orphanedPrices.length + invalidMacros.length + clinicalProblems };
  }, [familiesWithPrices, localFamilies, prices, macros, clinicalReport]);

  const clinicalTypeSummary = useMemo(() => {
    const types = ['MONOFOCAL', 'PROGRESSIVA', 'OCUPACIONAL', 'BIFOCAL'];
    return types.map(type => {
      const tf = localFamilies.filter(f => (f.clinical_type || f.category) === type);
      return { type, total: tf.length, active: tf.filter(f => f.active).length, withPrices: tf.filter(f => prices.some(p => p.family_id === f.id && p.active && !p.blocked)).length };
    });
  }, [localFamilies, prices]);

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando catálogo...</p>
        </div>
      </div>
    );
  }

  // ─── Render ───
  return (
    <div className="min-h-screen bg-background flex">
      {/* ─── Sidebar ─── */}
      <aside className={cn(
        'border-r border-border bg-card/50 flex flex-col shrink-0 sticky top-0 h-screen transition-all duration-200',
        sidebarCollapsed ? 'w-14' : 'w-56'
      )}>
        {/* Header */}
        <div className="p-3 border-b border-border flex items-center gap-2">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold text-foreground truncate">Catálogo</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 space-y-0.5 px-2">
          {SECTIONS.map(s => {
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                title={sidebarCollapsed ? s.label : undefined}
              >
                <s.icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{s.label}</span>}
                {/* Badges */}
                {!sidebarCollapsed && s.id === 'families' && <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1">{stats.active}</Badge>}
                {!sidebarCollapsed && s.id === 'quality' && integrityIssues.total > 0 && <Badge variant="destructive" className="ml-auto text-[10px] h-4 px-1">{integrityIssues.total}</Badge>}
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-border">
          <Button variant="ghost" size="sm" className="w-full justify-center" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </aside>

      {/* ─── Main content ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-40 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-foreground truncate">Gestão do Catálogo</h1>
              <p className="text-[11px] text-muted-foreground">{stats.active} famílias ativas • {stats.activePrices} SKUs</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <CloudSyncIndicator />
            <CatalogVersionBadge onViewHistory={() => setShowVersionHistory(true)} />

            <Button variant="ghost" size="sm" onClick={() => setShowRestoreDialog(true)} className="gap-1.5 text-xs h-8">
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Restaurar</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={reloadFromCloud} disabled={isLoading} className="gap-1.5 text-xs h-8">
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline">Recarregar</span>
            </Button>

            {pendingChanges.length > 0 && (
              <>
                <Badge variant="secondary" className="gap-1 text-xs">{pendingChanges.length} alterações</Badge>
                <Button variant="outline" size="sm" onClick={discardChanges} className="gap-1 text-xs h-8">
                  <RotateCcw className="w-3 h-3" /> Descartar
                </Button>
              </>
            )}
            <Button onClick={saveAllChanges} disabled={pendingChanges.length === 0 || isSavingToCloud} size="sm" className="gap-1.5 text-xs h-8">
              {isSavingToCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar
            </Button>
          </div>
        </header>

        {/* Governance Banner */}
        <div className="px-4 pt-3">
          <CatalogStatusBanner
            auditResult={lastAuditResult}
            catalogStatus={catalogStatus}
            pendingChanges={pendingChanges.length}
            isSaving={isSavingToCloud}
            onPublish={saveAllChanges}
            onApplyAutoFixes={handleApplyAutoFixes}
          />
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto px-4 py-4 space-y-4">

          {/* ═══ OVERVIEW ═══ */}
          {activeSection === 'overview' && (
            <div className="space-y-4 animate-fade-in">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Famílias', value: stats.total, icon: Package, color: 'bg-primary/10 text-primary' },
                  { label: 'Ativas', value: stats.active, icon: CheckCircle, color: 'bg-emerald-500/10 text-emerald-600' },
                  { label: 'Com Preços', value: stats.withPrices, icon: DollarSign, color: 'bg-blue-500/10 text-blue-600' },
                  { label: 'SKUs', value: stats.totalPrices, icon: Boxes, color: 'bg-secondary/10 text-secondary' },
                  { label: 'Problemas', value: integrityIssues.total, icon: integrityIssues.total > 0 ? AlertTriangle : CheckCircle, color: integrityIssues.total > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600' },
                ].map(s => (
                  <Card key={s.label} className="bg-card/50">
                    <CardContent className="p-3 flex items-center gap-2">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', s.color)}>
                        <s.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-lg font-bold">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Clinical Type Distribution */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Distribuição por Tipo Clínico</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {clinicalTypeSummary.map(ct => (
                      <div key={ct.type} className="p-3 rounded-lg border bg-muted/30">
                        <p className="text-xs font-semibold">{ct.type}</p>
                        <p className="text-lg font-bold">{ct.total}</p>
                        <p className="text-[10px] text-muted-foreground">{ct.active} ativas • {ct.withPrices} com preços</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick navigation cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SECTIONS.filter(s => s.id !== 'overview').map(s => (
                  <Card key={s.id} className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setActiveSection(s.id)}>
                    <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                      <s.icon className="w-6 h-6 text-primary" />
                      <span className="text-sm font-medium">{s.label}</span>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Diagnostic */}
              <DataSourceDiagnostic />
            </div>
          )}

          {/* ═══ FAMILIES ═══ */}
          {activeSection === 'families' && (
            <div className="space-y-3 animate-fade-in">
              {/* Filters */}
              <Card className="bg-card/50">
                <CardContent className="p-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex items-center gap-2 pr-3 border-r border-border">
                      <Checkbox checked={allFilteredSelected} ref={(el) => { if (el) (el as any).indeterminate = someFilteredSelected; }} onCheckedChange={toggleSelectAll} />
                      <span className="text-xs text-muted-foreground">{selectedIds.size > 0 ? `${selectedIds.size} sel.` : 'Todos'}</span>
                    </div>
                    <div className="flex-1 min-w-[200px] relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-8 h-8 text-sm" />
                    </div>
                    <Select value={filterSupplier} onValueChange={setFilterSupplier}><SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Fornecedor" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{uniqueSuppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                    <Select value={filterCategory} onValueChange={setFilterCategory}><SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{uniqueCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                    <Select value={filterTier} onValueChange={setFilterTier}><SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Tier" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{tierOptions.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
                    <Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="active">Ativas</SelectItem><SelectItem value="inactive">Inativas</SelectItem><SelectItem value="no_prices">Sem Preços</SelectItem></SelectContent></Select>
                    <div className="flex items-center gap-1 pl-2 border-l border-border">
                      <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                      <Input type="number" placeholder="Mín" value={filterPriceMin} onChange={e => setFilterPriceMin(e.target.value)} className="w-20 h-8 text-xs" />
                      <span className="text-muted-foreground text-xs">-</span>
                      <Input type="number" placeholder="Máx" value={filterPriceMax} onChange={e => setFilterPriceMax(e.target.value)} className="w-20 h-8 text-xs" />
                    </div>
                    {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2"><X className="w-4 h-4" /></Button>}
                    <div className="pl-2 border-l border-border flex gap-2">
                      <ExportDialog families={filteredFamilies} macros={macros} technologies={localTechnologies} />
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                        if (!rawLensData) { toast.error('Catálogo não carregado'); return; }
                        const blob = new Blob([JSON.stringify(rawLensData, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = `catalog-default-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
                        toast.success('Catálogo JSON exportado!');
                      }}>
                        <FileSpreadsheet className="w-4 h-4" /> Baixar JSON
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Family Cards */}
              <ScrollArea className="h-[calc(100vh-280px)]">
                <div className="space-y-2 pr-4 pb-20">
                  {filteredFamilies.map(family => (
                    <FamilyCard
                      key={family.id}
                      family={family}
                      macros={macros}
                      categories={uniqueCategories}
                      suppliers={uniqueSuppliers}
                      technologies={localTechnologies}
                      onMacroChange={handleMacroChange}
                      onCategoryChange={handleCategoryChange}
                      onSupplierChange={handleSupplierChange}
                      onActiveToggle={handleActiveToggle}
                      onPriceActiveToggle={handlePriceActiveToggle}
                      onDeleteFamily={handleDeleteFamily}
                      onTechnologyChange={handleTechnologyChange}
                      isSelected={selectedIds.has(family.id)}
                      onSelectionChange={handleSelectionChange}
                    />
                  ))}
                  {filteredFamilies.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>Nenhuma família encontrada</p>
                      {hasActiveFilters && <Button variant="link" onClick={clearFilters} className="mt-2">Limpar filtros</Button>}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* ═══ MACROS ═══ */}
          {activeSection === 'macros' && (
            <ScrollArea className="h-[calc(100vh-200px)] animate-fade-in">
              <div className="grid gap-3 md:grid-cols-2 pr-4 pb-4">
                {macros.map(macro => <MacroCard key={macro.id} macro={macro} families={localFamilies} onUpdate={handleMacroUpdate} />)}
              </div>
            </ScrollArea>
          )}

          {/* ═══ SUPPLIERS (merged with Priorities) ═══ */}
          {activeSection === 'suppliers' && (
            <div className="space-y-6 animate-fade-in">
              <ScrollArea className="h-[calc(100vh-400px)]">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 pr-4 pb-4">
                  {uniqueSuppliers.map(supplier => (
                    <SupplierCard key={supplier} supplier={supplier} families={localFamilies} prices={prices} onRename={handleSupplierRename} />
                  ))}
                </div>
              </ScrollArea>

              <Separator />

              {/* Supplier Priorities (migrated from AdminDashboard) */}
              <SupplierPriorityManager
                savedPriorities={supplierPriorities.flatMap(p => p.suppliers)}
                onChange={(newOrder) => {
                  // Update all macro priorities with the new global order
                  macros.forEach(macro => {
                    const macroSuppliers = newOrder.filter(s =>
                      localFamilies.some(f => f.macro === macro.id && f.supplier === s && f.active)
                    );
                    if (macroSuppliers.length > 0) updateSupplierPriority(macro.id, macroSuppliers);
                  });
                }}
              />
            </div>
          )}

          {/* ═══ TECHNOLOGIES ═══ */}
          {activeSection === 'technologies' && (
            <div className="space-y-3 animate-fade-in">
              <Card className="bg-card/50">
                <CardContent className="p-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    <div className="flex-1 min-w-[200px] relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input placeholder="Buscar tecnologias..." value={techSearchTerm} onChange={e => setTechSearchTerm(e.target.value)} className="pl-8 h-8 text-sm" />
                    </div>
                    <Select value={filterTechSupplier} onValueChange={setFilterTechSupplier}><SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Fornecedor" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{techSuppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
                    {(techSearchTerm || filterTechSupplier !== 'all') && <Button variant="ghost" size="sm" onClick={() => { setTechSearchTerm(''); setFilterTechSupplier('all'); }} className="h-8 px-2"><X className="w-4 h-4" /></Button>}
                  </div>
                </CardContent>
              </Card>

              {/* Matching Rules Editor */}
              <MatchingRulesEditor engine={rawLensData ? getEngineFromLensData(rawLensData) : null} families={localFamilies} prices={prices} onSaveEngine={handleSaveMatchingEngine} />

              <ScrollArea className="h-[calc(100vh-400px)]">
                <div className="space-y-2 pr-4 pb-4">
                  {filteredTechnologies.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Cpu className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>Nenhuma tecnologia encontrada</p>
                    </div>
                  ) : (
                    filteredTechnologies.map(tech => <TechnologyCard key={tech.id} technology={tech} usageCount={getTechUsageCount(tech.id)} onUpdate={handleTechnologyUpdate} />)
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* ═══ IMPORT (unified) ═══ */}
          {activeSection === 'import' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid lg:grid-cols-2 gap-6">
                {/* JSON Import */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileJson className="w-5 h-5 text-primary" />
                      Importação JSON
                    </CardTitle>
                    <CardDescription>Importação de catálogo completo ou parcial em formato JSON</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4 flex-wrap items-end">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Tipo de importação</label>
                        <Select value={importMode} onValueChange={(v) => { setImportMode(v as ImportMode); setJsonInput(''); setValidationReport(null); setPendingImportData(null); setUploadedFile(null); }}>
                          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="replace">Catálogo Completo (Substituir)</SelectItem>
                            <SelectItem value="increment">Catálogo Parcial (Incrementar)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={validateAndPreviewImport} disabled={!jsonInput.trim()}>
                        <ShieldCheck className="w-4 h-4 mr-2" /> Validar
                      </Button>
                      {canRollback() && (
                        <Button variant="outline" onClick={() => rollbackLastImport()}>
                          <RotateCcw className="w-4 h-4 mr-2" /> Desfazer
                        </Button>
                      )}
                    </div>

                    <Textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)} placeholder='{ "meta": {...}, "families": [...], ... }' className="min-h-[250px] font-mono text-sm" />

                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Upload de arquivo</label>
                      <input
                        type="file"
                        accept=".json"
                        className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                        onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadedFile(file);
                          const text = await file.text();
                          setJsonInput(text);
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Validation Result */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /><span>Validação</span></div>
                      <Button variant="outline" size="sm" onClick={exportJson} className="gap-2"><Download className="w-4 h-4" />Exportar</Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {validationReport ? (
                      <ImportValidationReport report={validationReport} onProceed={validationReport.isValid ? executeValidatedImport : undefined} onCancel={() => { setValidationReport(null); setPendingImportData(null); }} showActions />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <FileJson className="w-12 h-12 mb-4 opacity-50" />
                        <p>Cole um JSON e clique em Validar</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Separator />

              {/* ERP XLSX Import */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                    Importação ERP (XLSX)
                  </CardTitle>
                  <CardDescription>Wizard completo para importação de planilhas do ERP com resolução de fornecedor</CardDescription>
                </CardHeader>
                <CardContent>
                  <ErpImportTab onNavigateTab={(tab) => {
                    // If the ERP tab wants to navigate somewhere, map to our sections
                    if (tab === 'families') setActiveSection('families');
                  }} />
                </CardContent>
              </Card>
            </div>
          )}

          {/* ═══ QUALITY (merged: structural + clinical + classification) ═══ */}
          {activeSection === 'quality' && (
            <div className="space-y-4 animate-fade-in">
              <Tabs value={qualitySubTab} onValueChange={(v) => setQualitySubTab(v as any)}>
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="structural" className="gap-1.5 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5" /> Estrutural
                    {(integrityIssues.total - integrityIssues.clinicalProblems) > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{integrityIssues.total - integrityIssues.clinicalProblems}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="clinical" className="gap-1.5 text-xs">
                    <Activity className="w-3.5 h-3.5" /> Clínica
                    {integrityIssues.clinicalProblems > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{integrityIssues.clinicalProblems}</Badge>}
                  </TabsTrigger>
                  <TabsTrigger value="classification" className="gap-1.5 text-xs">
                    <ShieldCheck className="w-3.5 h-3.5" /> Classificação
                    {lastAuditResult && lastAuditResult.summary.totalCritical > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{lastAuditResult.summary.totalCritical}</Badge>}
                  </TabsTrigger>
                </TabsList>

                {/* Structural */}
                <TabsContent value="structural" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DataSourceDiagnostic />
                    <div className="flex items-start justify-end">
                      <IntegrityExportButton integrityIssues={integrityIssues} />
                    </div>
                  </div>
                  {(integrityIssues.familiesWithoutPrices.length + integrityIssues.orphanedPrices.length + integrityIssues.invalidMacros.length) === 0 ? (
                    <Card className="bg-emerald-500/5 border-emerald-500/30">
                      <CardContent className="p-6 text-center">
                        <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
                        <p className="font-medium text-emerald-600">Estrutura íntegra</p>
                        <p className="text-sm text-muted-foreground mt-1">Sem famílias órfãs, macros inválidos ou preços sem família</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {integrityIssues.familiesWithoutPrices.length > 0 && (
                        <Card className="border-amber-500/30">
                          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2 text-amber-600"><AlertTriangle className="w-4 h-4" />Famílias ativas sem preços ({integrityIssues.familiesWithoutPrices.length})</CardTitle></CardHeader>
                          <CardContent className="p-4 pt-0">
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {integrityIssues.familiesWithoutPrices.map(f => (
                                <div key={f.id} className="flex items-center justify-between py-1 text-sm">
                                  <span>{f.name_original}</span>
                                  <div className="flex items-center gap-2"><Badge variant="outline" className="text-[10px]">{f.clinical_type || f.category}</Badge><code className="text-xs text-muted-foreground">{f.id}</code></div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      {integrityIssues.invalidMacros.length > 0 && (
                        <Card className="border-destructive/30">
                          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2 text-destructive"><AlertTriangle className="w-4 h-4" />Macros inválidos ({integrityIssues.invalidMacros.length})</CardTitle></CardHeader>
                          <CardContent className="p-4 pt-0">
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {integrityIssues.invalidMacros.map(f => <div key={f.id} className="flex items-center justify-between py-1 text-sm"><span>{f.name_original}</span><Badge variant="destructive" className="text-xs">{f.macro}</Badge></div>)}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                      {integrityIssues.orphanedPrices.length > 0 && (
                        <Card className="border-amber-500/30">
                          <CardHeader className="p-4 pb-2"><CardTitle className="text-sm flex items-center gap-2 text-amber-600"><Tag className="w-4 h-4" />Preços órfãos ({integrityIssues.orphanedPrices.length})</CardTitle></CardHeader>
                          <CardContent className="p-4 pt-0"><p className="text-xs text-muted-foreground">SKUs com family_id inexistente no catálogo</p></CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={runClassification} disabled={isClassifying || !rawLensData} className="gap-1.5">
                      {isClassifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      Classificar SKUs
                    </Button>
                  </div>
                </TabsContent>

                {/* Clinical */}
                <TabsContent value="clinical" className="space-y-4">
                  {!clinicalReport ? (
                    <Card><CardContent className="p-6 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" /><p className="text-muted-foreground">Carregando análise clínica...</p></CardContent></Card>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'COMPLETO', val: clinicalReport.classifications.COMPLETO, color: 'bg-emerald-500/5 border-emerald-500/30 text-emerald-600' },
                          { label: 'LEGACY', val: clinicalReport.classifications.LEGACY, color: 'bg-blue-500/5 border-blue-500/30 text-blue-600' },
                          { label: 'PARCIAL', val: clinicalReport.classifications.PARCIAL, color: 'bg-amber-500/5 border-amber-500/30 text-amber-600' },
                          { label: 'DEFAULTED', val: clinicalReport.classifications.DEFAULTED, color: 'bg-destructive/5 border-destructive/30 text-destructive' },
                        ].map(c => (
                          <Card key={c.label} className={c.color}><CardContent className="p-3 text-center"><p className="text-2xl font-bold">{c.val}</p><p className="text-xs text-muted-foreground">{c.label}</p></CardContent></Card>
                        ))}
                      </div>
                      {clinicalReport.problem_count > 0 && (
                        <Card className="border-amber-500/30 bg-amber-500/5">
                          <CardContent className="p-4 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-amber-600">{clinicalReport.problem_count} SKUs com especificações clínicas incompletas</p>
                              <p className="text-xs text-muted-foreground">Safe Defaults estão sendo utilizados</p>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </TabsContent>

                {/* Classification */}
                <TabsContent value="classification">
                  <ClassificationTab families={localFamilies} prices={prices} auditResult={lastAuditResult} />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* ═══ HISTORY (merged: versions + logs + commercial) ═══ */}
          {activeSection === 'history' && (
            <div className="space-y-4 animate-fade-in">
              <Tabs value={historySubTab} onValueChange={(v) => setHistorySubTab(v as any)}>
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="versions" className="gap-1.5 text-xs"><History className="w-3.5 h-3.5" /> Versões</TabsTrigger>
                  <TabsTrigger value="engine-logs" className="gap-1.5 text-xs"><Activity className="w-3.5 h-3.5" /> Logs do Motor</TabsTrigger>
                  <TabsTrigger value="commercial" className="gap-1.5 text-xs"><BarChart3 className="w-3.5 h-3.5" /> Comercial</TabsTrigger>
                </TabsList>

                <TabsContent value="versions">
                  <Card>
                    <CardHeader><CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4 text-primary" />Histórico de Versões</CardTitle></CardHeader>
                    <CardContent>
                      <Button variant="outline" size="sm" onClick={() => setShowVersionHistory(true)} className="gap-2">
                        <History className="w-4 h-4" /> Ver Histórico Completo
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="engine-logs">
                  <RecommendationLogsTab />
                </TabsContent>

                <TabsContent value="commercial">
                  <CommercialAuditTab families={localFamilies} macros={macros} technologyLibrary={localTechnologies} />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </main>

        {/* Batch Action Bar */}
        <BatchActionBar
          selectedCount={selectedIds.size}
          totalFiltered={filteredFamilies.length}
          categories={uniqueCategories}
          suppliers={uniqueSuppliers}
          onApplyTier={handleBatchTierChange}
          onApplyCategory={handleBatchCategoryChange}
          onApplySupplier={handleBatchSupplierChange}
          onActivateAll={handleBatchActivate}
          onDeactivateAll={handleBatchDeactivate}
          onDeleteSelected={handleBatchDelete}
          onClearSelection={handleClearSelection}
          onSelectAll={handleSelectAll}
        />
      </div>

      {/* Dialogs */}
      <ClassificationReportDialog open={showClassificationDialog} onOpenChange={setShowClassificationDialog} report={classificationReport} onApplyChanges={applyClassificationChanges} isApplying={isApplyingClassification} />
      <CatalogVersionHistory open={showVersionHistory} onOpenChange={setShowVersionHistory} />
      <CatalogRestoreDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}
        onRestore={(data) => { loadLensData(data); setLocalFamilies(data.families || []); if (data.technology_library?.items) setLocalTechnologies(data.technology_library.items); saveCatalogToCloud(); }}
        onReset={() => setPendingChanges([])}
      />
      <CloudSaveConfirmDialog open={showCloudSaveDialog} onOpenChange={setShowCloudSaveDialog} importSummary={cloudSaveImportSummary} />
    </div>
  );
};

export default CatalogHub;
