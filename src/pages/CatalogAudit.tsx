import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search,
  Package,
  DollarSign,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Layers,
  Tag,
  Building,
  Boxes,
  Save,
  RotateCcw,
  RefreshCw,
  X,
  CheckSquare,
  Square,
  Cpu,
  Wand2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLensStore } from '@/store/lensStore';
import { FamilyCard } from '@/components/audit/FamilyCard';
import { BatchActionBar } from '@/components/audit/BatchActionBar';
import { TechnologyCard } from '@/components/audit/TechnologyCard';
import { AddFamilyDialog } from '@/components/audit/AddFamilyDialog';
import { ExportDialog } from '@/components/audit/ExportDialog';
import { ClassificationReportDialog } from '@/components/audit/ClassificationReportDialog';
import { CatalogVersionBadge } from '@/components/audit/CatalogVersionBadge';
import { CatalogVersionHistory } from '@/components/audit/CatalogVersionHistory';
import type { LensData, FamilyExtended, Price, MacroExtended, Technology } from '@/types/lens';
import { 
  runClassificationEngine, 
  getEngineFromLensData,
  type ClassificationReport,
  type ClassificationEngineResult
} from '@/lib/skuClassificationEngine';
import { toast } from 'sonner';

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

const CatalogAudit = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriceMin, setFilterPriceMin] = useState<string>('');
  const [filterPriceMax, setFilterPriceMax] = useState<string>('');
  const [activeTab, setActiveTab] = useState('families');
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  
  // Classification Engine state
  const [isClassifying, setIsClassifying] = useState(false);
  const [classificationReport, setClassificationReport] = useState<ClassificationReport | null>(null);
  const [classificationResult, setClassificationResult] = useState<ClassificationEngineResult | null>(null);
  const [showClassificationDialog, setShowClassificationDialog] = useState(false);
  const [isApplyingClassification, setIsApplyingClassification] = useState(false);

  const { 
    families, 
    prices,
    macros,
    technologyLibrary,
    loadLensData,
    loadCatalogFromCloud,
    saveCatalogToCloud,
    isSavingToCloud,
    toggleFamilyActive,
    togglePriceActive,
    rawLensData,
  } = useLensStore();

  // Local state for unsaved changes
  const [localFamilies, setLocalFamilies] = useState<FamilyExtended[]>([]);
  const [localTechnologies, setLocalTechnologies] = useState<Record<string, Technology>>({});
  const [techSearchTerm, setTechSearchTerm] = useState('');
  const [filterTechSupplier, setFilterTechSupplier] = useState<string>('all');
  
  useEffect(() => {
    setLocalFamilies(families);
  }, [families]);

  useEffect(() => {
    if (technologyLibrary?.items) {
      setLocalTechnologies(technologyLibrary.items);
    }
  }, [technologyLibrary]);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      if (families.length === 0) {
        setIsLoading(true);
        try {
          const cloudLoaded = await loadCatalogFromCloud();
          
          if (!cloudLoaded) {
            const response = await fetch('/data/lenses.json');
            const data: LensData = await response.json();
            loadLensData(data);
          }
        } catch (error) {
          console.error('Error loading data:', error);
          try {
            const response = await fetch('/data/lenses.json');
            const data: LensData = await response.json();
            loadLensData(data);
          } catch (e) {
            console.error('Failed to load fallback data:', e);
            toast.error('Erro ao carregar dados');
          }
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadData();
  }, [families.length, loadLensData, loadCatalogFromCloud]);

  // Get unique values for filters
  const uniqueSuppliers = useMemo(() => 
    [...new Set(localFamilies.map(f => f.supplier))].sort(), 
    [localFamilies]
  );
  
  const uniqueCategories = useMemo(() => 
    [...new Set(localFamilies.map(f => f.category))].sort(), 
    [localFamilies]
  );

  // Build families with prices data
  const familiesWithPrices: FamilyWithPrices[] = useMemo(() => {
    return localFamilies.map(family => {
      const familyPrices = prices.filter(p => p.family_id === family.id);
      const activePrices = familyPrices.filter(p => p.active && !p.blocked);
      const salePrices = familyPrices.map(p => p.price_sale_half_pair).filter(p => p > 0);
      const indices = [...new Set(familyPrices.map(p => p.index))].sort();
      
      return {
        ...family,
        prices: familyPrices,
        priceCount: familyPrices.length,
        activePriceCount: activePrices.length,
        minPrice: salePrices.length > 0 ? Math.min(...salePrices) : 0,
        maxPrice: salePrices.length > 0 ? Math.max(...salePrices) : 0,
        indices,
      };
    });
  }, [localFamilies, prices]);

  // Tier options for filter
  const tierOptions = [
    { value: 'essential', label: 'Essencial' },
    { value: 'comfort', label: 'Conforto' },
    { value: 'advanced', label: 'Avançado' },
    { value: 'top', label: 'Premium' },
  ];

  // Get tier_key for a family based on its macro
  const getFamilyTier = useCallback((family: FamilyExtended) => {
    const macro = macros.find(m => m.id === family.macro);
    return macro?.tier_key || 'essential';
  }, [macros]);

  // Filter families
  const filteredFamilies = useMemo(() => {
    return familiesWithPrices.filter(family => {
      const matchesSearch = searchTerm === '' || 
        family.name_original.toLowerCase().includes(searchTerm.toLowerCase()) ||
        family.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        family.supplier.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSupplier = filterSupplier === 'all' || family.supplier === filterSupplier;
      const matchesCategory = filterCategory === 'all' || family.category === filterCategory;
      const familyTier = getFamilyTier(family);
      const matchesTier = filterTier === 'all' || familyTier === filterTier;
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'active' && family.active) ||
        (filterStatus === 'inactive' && !family.active) ||
        (filterStatus === 'no_prices' && family.activePriceCount === 0);
      
      // Price filters
      const minPrice = filterPriceMin ? parseFloat(filterPriceMin) : 0;
      const maxPrice = filterPriceMax ? parseFloat(filterPriceMax) : Infinity;
      const matchesPrice = family.minPrice >= minPrice && 
        (family.maxPrice <= maxPrice || (!filterPriceMax && family.minPrice > 0));
      
      return matchesSearch && matchesSupplier && matchesCategory && matchesTier && matchesStatus && matchesPrice;
    });
  }, [familiesWithPrices, searchTerm, filterSupplier, filterCategory, filterTier, filterStatus, filterPriceMin, filterPriceMax, getFamilyTier]);

  // Handle changes
  const handleMacroChange = useCallback((familyId: string, newMacro: string) => {
    const family = localFamilies.find(f => f.id === familyId);
    if (!family || family.macro === newMacro) return;
    
    setLocalFamilies(prev => prev.map(f => 
      f.id === familyId ? { ...f, macro: newMacro } : f
    ));
    
    setPendingChanges(prev => {
      const existing = prev.findIndex(c => c.familyId === familyId && c.type === 'macro');
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], newValue: newMacro };
        return updated;
      }
      return [...prev, { type: 'macro', familyId, oldValue: family.macro, newValue: newMacro }];
    });
    
    toast.success(`Macro alterado para ${newMacro}`, { duration: 1500 });
  }, [localFamilies]);

  const handleCategoryChange = useCallback((familyId: string, newCategory: string) => {
    const family = localFamilies.find(f => f.id === familyId);
    if (!family || family.category === newCategory) return;
    
    setLocalFamilies(prev => prev.map(f => 
      f.id === familyId ? { ...f, category: newCategory as any } : f
    ));
    
    setPendingChanges(prev => {
      const existing = prev.findIndex(c => c.familyId === familyId && c.type === 'category');
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], newValue: newCategory };
        return updated;
      }
      return [...prev, { type: 'category', familyId, oldValue: family.category, newValue: newCategory }];
    });
    
    toast.success(`Categoria alterada para ${newCategory}`, { duration: 1500 });
  }, [localFamilies]);

  const handleSupplierChange = useCallback((familyId: string, newSupplier: string) => {
    const family = localFamilies.find(f => f.id === familyId);
    if (!family || family.supplier === newSupplier) return;
    
    setLocalFamilies(prev => prev.map(f => 
      f.id === familyId ? { ...f, supplier: newSupplier } : f
    ));
    
    setPendingChanges(prev => {
      const existing = prev.findIndex(c => c.familyId === familyId && c.type === 'supplier');
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], newValue: newSupplier };
        return updated;
      }
      return [...prev, { type: 'supplier', familyId, oldValue: family.supplier, newValue: newSupplier }];
    });
    
    toast.success(`Fornecedor alterado para ${newSupplier}`, { duration: 1500 });
  }, [localFamilies]);

  const handleActiveToggle = useCallback((familyId: string) => {
    const family = localFamilies.find(f => f.id === familyId);
    if (!family) return;
    
    setLocalFamilies(prev => prev.map(f => 
      f.id === familyId ? { ...f, active: !f.active } : f
    ));
    
    setPendingChanges(prev => {
      const existing = prev.findIndex(c => c.familyId === familyId && c.type === 'active');
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], newValue: !family.active };
        return updated;
      }
      return [...prev, { type: 'active', familyId, oldValue: family.active, newValue: !family.active }];
    });
  }, [localFamilies]);

  const handlePriceActiveToggle = useCallback((erpCode: string) => {
    togglePriceActive(erpCode);
  }, [togglePriceActive]);

  const handleTechnologyChange = useCallback((familyId: string, techRefs: string[]) => {
    const family = localFamilies.find(f => f.id === familyId);
    if (!family) return;
    
    setLocalFamilies(prev => prev.map(f => 
      f.id === familyId ? { ...f, technology_refs: techRefs } : f
    ));
    
    // Track as a generic change
    setPendingChanges(prev => {
      const existing = prev.findIndex(c => c.familyId === familyId && c.type === 'active' && c.oldValue === 'tech_change');
      if (existing >= 0) {
        return prev;
      }
      return [...prev, { 
        type: 'active', 
        familyId, 
        oldValue: 'tech_change' as any, 
        newValue: `${techRefs.length} tecnologias` as any 
      }];
    });
  }, [localFamilies]);

  // Selection handlers
  const handleSelectionChange = useCallback((familyId: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(familyId);
      } else {
        next.delete(familyId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allFilteredIds = filteredFamilies.map(f => f.id);
    setSelectedIds(new Set(allFilteredIds));
  }, [filteredFamilies]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelectAll = useCallback(() => {
    const allFilteredIds = filteredFamilies.map(f => f.id);
    const allSelected = allFilteredIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  }, [filteredFamilies, selectedIds]);

  // Batch action handlers
  // Map tier to macro based on family's category
  const getMacroForTier = useCallback((category: string, tierKey: string) => {
    // Find macro that matches both category and tier
    const matchingMacro = macros.find(m => 
      m.category === category && m.tier_key === tierKey
    );
    return matchingMacro?.id || null;
  }, [macros]);

  const handleBatchTierChange = useCallback((newTier: string) => {
    const selectedFamilies = localFamilies.filter(f => selectedIds.has(f.id));
    let changedCount = 0;
    
    setLocalFamilies(prev => prev.map(f => {
      if (!selectedIds.has(f.id)) return f;
      const newMacro = getMacroForTier(f.category, newTier);
      if (newMacro && newMacro !== f.macro) {
        changedCount++;
        return { ...f, macro: newMacro };
      }
      return f;
    }));
    
    selectedFamilies.forEach(family => {
      const newMacro = getMacroForTier(family.category, newTier);
      if (newMacro && family.macro !== newMacro) {
        setPendingChanges(prev => {
          const existing = prev.findIndex(c => c.familyId === family.id && c.type === 'macro');
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { ...updated[existing], newValue: newMacro };
            return updated;
          }
          return [...prev, { type: 'macro', familyId: family.id, oldValue: family.macro, newValue: newMacro }];
        });
      }
    });
    
    const tierLabel = tierOptions.find(t => t.value === newTier)?.label || newTier;
    toast.success(`Tier alterado para "${tierLabel}" em ${changedCount} famílias`, { duration: 2000 });
    setSelectedIds(new Set());
  }, [localFamilies, selectedIds, getMacroForTier, tierOptions]);

  const handleBatchCategoryChange = useCallback((newCategory: string) => {
    const selectedFamilies = localFamilies.filter(f => selectedIds.has(f.id));
    
    setLocalFamilies(prev => prev.map(f => 
      selectedIds.has(f.id) ? { ...f, category: newCategory as any } : f
    ));
    
    selectedFamilies.forEach(family => {
      if (family.category !== newCategory) {
        setPendingChanges(prev => {
          const existing = prev.findIndex(c => c.familyId === family.id && c.type === 'category');
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { ...updated[existing], newValue: newCategory };
            return updated;
          }
          return [...prev, { type: 'category', familyId: family.id, oldValue: family.category, newValue: newCategory }];
        });
      }
    });
    
    toast.success(`Categoria alterada em ${selectedFamilies.length} famílias`, { duration: 2000 });
    setSelectedIds(new Set());
  }, [localFamilies, selectedIds]);

  const handleBatchSupplierChange = useCallback((newSupplier: string) => {
    const selectedFamilies = localFamilies.filter(f => selectedIds.has(f.id));
    
    setLocalFamilies(prev => prev.map(f => 
      selectedIds.has(f.id) ? { ...f, supplier: newSupplier } : f
    ));
    
    selectedFamilies.forEach(family => {
      if (family.supplier !== newSupplier) {
        setPendingChanges(prev => {
          const existing = prev.findIndex(c => c.familyId === family.id && c.type === 'supplier');
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { ...updated[existing], newValue: newSupplier };
            return updated;
          }
          return [...prev, { type: 'supplier', familyId: family.id, oldValue: family.supplier, newValue: newSupplier }];
        });
      }
    });
    
    toast.success(`Fornecedor alterado em ${selectedFamilies.length} famílias`, { duration: 2000 });
    setSelectedIds(new Set());
  }, [localFamilies, selectedIds]);

  const handleBatchActivate = useCallback(() => {
    const selectedFamilies = localFamilies.filter(f => selectedIds.has(f.id) && !f.active);
    
    setLocalFamilies(prev => prev.map(f => 
      selectedIds.has(f.id) ? { ...f, active: true } : f
    ));
    
    selectedFamilies.forEach(family => {
      setPendingChanges(prev => {
        const existing = prev.findIndex(c => c.familyId === family.id && c.type === 'active');
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...updated[existing], newValue: true };
          return updated;
        }
        return [...prev, { type: 'active', familyId: family.id, oldValue: false, newValue: true }];
      });
    });
    
    toast.success(`${selectedFamilies.length} famílias ativadas`, { duration: 2000 });
    setSelectedIds(new Set());
  }, [localFamilies, selectedIds]);

  const handleBatchDeactivate = useCallback(() => {
    const selectedFamilies = localFamilies.filter(f => selectedIds.has(f.id) && f.active);
    
    setLocalFamilies(prev => prev.map(f => 
      selectedIds.has(f.id) ? { ...f, active: false } : f
    ));
    
    selectedFamilies.forEach(family => {
      setPendingChanges(prev => {
        const existing = prev.findIndex(c => c.familyId === family.id && c.type === 'active');
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...updated[existing], newValue: false };
          return updated;
        }
        return [...prev, { type: 'active', familyId: family.id, oldValue: true, newValue: false }];
      });
    });
    
    toast.success(`${selectedFamilies.length} famílias desativadas`, { duration: 2000 });
    setSelectedIds(new Set());
  }, [localFamilies, selectedIds]);

  // Batch delete handler
  const handleBatchDelete = useCallback(() => {
    const selectedFamilyIds = [...selectedIds];
    
    setLocalFamilies(prev => prev.filter(f => !selectedIds.has(f.id)));
    
    // Add pending changes for deletion tracking
    selectedFamilyIds.forEach(familyId => {
      setPendingChanges(prev => [...prev, { 
        type: 'active', 
        familyId, 
        oldValue: true, 
        newValue: 'deleted' as any 
      }]);
    });
    
    toast.success(`${selectedFamilyIds.length} famílias excluídas`, { duration: 2000 });
    setSelectedIds(new Set());
  }, [selectedIds]);

  // Individual delete handler
  const handleDeleteFamily = useCallback((familyId: string) => {
    setLocalFamilies(prev => prev.filter(f => f.id !== familyId));
    
    setPendingChanges(prev => [...prev, { 
      type: 'active', 
      familyId, 
      oldValue: true, 
      newValue: 'deleted' as any 
    }]);
    
    toast.success('Família excluída', { duration: 1500 });
  }, []);

  // Technology update handler
  const handleTechnologyUpdate = useCallback((techId: string, updates: Partial<Technology>) => {
    setLocalTechnologies(prev => ({
      ...prev,
      [techId]: { ...prev[techId], ...updates }
    }));
    
    setPendingChanges(prev => [...prev, { 
      type: 'active' as const, // Using 'active' type for simplicity 
      familyId: `tech_${techId}`, 
      oldValue: 'original', 
      newValue: 'updated' 
    } as PendingChange]);
    
    toast.success('Tecnologia atualizada', { duration: 1500 });
  }, []);

  // Technologies data
  const technologiesArray = useMemo(() => {
    return Object.values(localTechnologies);
  }, [localTechnologies]);

  const techSuppliers = useMemo(() => {
    const suppliers = new Set<string>();
    technologiesArray.forEach(tech => {
      Object.keys(tech.name_commercial || {}).forEach(s => suppliers.add(s));
    });
    return [...suppliers].sort();
  }, [technologiesArray]);

  const getTechUsageCount = useCallback((techId: string) => {
    return localFamilies.filter(f => 
      f.technology_refs?.includes(techId)
    ).length;
  }, [localFamilies]);

  const filteredTechnologies = useMemo(() => {
    return technologiesArray.filter(tech => {
      const matchesSearch = techSearchTerm === '' ||
        tech.name_common.toLowerCase().includes(techSearchTerm.toLowerCase()) ||
        tech.id.toLowerCase().includes(techSearchTerm.toLowerCase()) ||
        tech.description_short.toLowerCase().includes(techSearchTerm.toLowerCase());
      
      const matchesSupplier = filterTechSupplier === 'all' ||
        Object.keys(tech.name_commercial || {}).includes(filterTechSupplier);
      
      return matchesSearch && matchesSupplier;
    });
  }, [technologiesArray, techSearchTerm, filterTechSupplier]);

  // Check if all filtered are selected
  const allFilteredSelected = useMemo(() => {
    if (filteredFamilies.length === 0) return false;
    return filteredFamilies.every(f => selectedIds.has(f.id));
  }, [filteredFamilies, selectedIds]);

  const someFilteredSelected = useMemo(() => {
    return filteredFamilies.some(f => selectedIds.has(f.id)) && !allFilteredSelected;
  }, [filteredFamilies, selectedIds, allFilteredSelected]);

  // Save all changes
  const saveAllChanges = async () => {
    if (pendingChanges.length === 0) return;
    
    // Update the store with local changes
    if (rawLensData) {
      const updatedData: LensData = {
        ...rawLensData,
        families: localFamilies,
        technology_library: Object.keys(localTechnologies).length > 0 
          ? { items: localTechnologies } 
          : rawLensData.technology_library,
      };
      loadLensData(updatedData);
    }
    
    // Save to cloud
    const success = await saveCatalogToCloud();
    if (success) {
      toast.success(`${pendingChanges.length} alterações salvas com sucesso!`);
      setPendingChanges([]);
    } else {
      toast.error('Erro ao salvar alterações');
    }
  };

  // Discard changes
  const discardChanges = () => {
    setLocalFamilies(families);
    if (technologyLibrary?.items) {
      setLocalTechnologies(technologyLibrary.items);
    }
    setPendingChanges([]);
    toast.info('Alterações descartadas');
  };

  // Reload original catalog from JSON (fixes encoding issues)
  const reloadOriginalCatalog = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/data/lenses.json');
      const arrayBuffer = await response.arrayBuffer();
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(arrayBuffer);
      const data: LensData = JSON.parse(text);
      
      loadLensData(data);
      setLocalFamilies(data.families || []);
      if (data.technology_library?.items) {
        setLocalTechnologies(data.technology_library.items);
      }
      setPendingChanges([]);
      
      // Force save to cloud with correct encoding
      const success = await saveCatalogToCloud();
      if (success) {
        toast.success('Catálogo original recarregado e salvo com encoding correto!');
      } else {
        toast.success('Catálogo recarregado (erro ao salvar na nuvem)');
      }
    } catch (error) {
      console.error('Error reloading catalog:', error);
      toast.error('Erro ao recarregar catálogo');
    } finally {
      setIsLoading(false);
    }
  };

  // Add new family handler
  const handleAddFamily = useCallback((newFamily: FamilyExtended) => {
    setLocalFamilies(prev => [newFamily, ...prev]);
    
    setPendingChanges(prev => [...prev, { 
      type: 'active', 
      familyId: newFamily.id, 
      oldValue: 'new' as any, 
      newValue: 'added' as any 
    }]);
  }, []);

  // Classification Engine handler
  const runClassification = useCallback(async () => {
    if (!rawLensData) {
      toast.error('Nenhum catálogo carregado');
      return;
    }
    
    setIsClassifying(true);
    try {
      const engine = getEngineFromLensData(rawLensData);
      const result = runClassificationEngine(rawLensData, engine || undefined);
      
      setClassificationResult(result);
      setClassificationReport(result.report);
      setShowClassificationDialog(true);
      
      if (result.success) {
        toast.success('Classificação concluída');
      } else {
        toast.warning('Classificação com erros - verifique o relatório');
      }
    } catch (error) {
      console.error('Classification error:', error);
      toast.error('Erro ao executar classificação');
    } finally {
      setIsClassifying(false);
    }
  }, [rawLensData]);

  const applyClassificationChanges = useCallback(async () => {
    if (!classificationResult || !rawLensData) return;
    
    setIsApplyingClassification(true);
    try {
      const updatedData: LensData = {
        ...rawLensData,
        prices: classificationResult.updated_prices,
        families: classificationResult.updated_families
      };
      
      loadLensData(updatedData);
      setLocalFamilies(classificationResult.updated_families);
      
      // Save to cloud
      await saveCatalogToCloud();
      
      toast.success('Alterações de classificação aplicadas');
      setShowClassificationDialog(false);
      setClassificationResult(null);
      setClassificationReport(null);
    } catch (error) {
      toast.error('Erro ao aplicar alterações');
    } finally {
      setIsApplyingClassification(false);
    }
  }, [classificationResult, rawLensData, loadLensData, saveCatalogToCloud]);

  // Clear filters
  const clearFilters = () => {
    setSearchTerm('');
    setFilterSupplier('all');
    setFilterCategory('all');
    setFilterTier('all');
    setFilterStatus('all');
    setFilterPriceMin('');
    setFilterPriceMax('');
  };

  const hasActiveFilters = searchTerm || filterSupplier !== 'all' || 
    filterCategory !== 'all' || filterTier !== 'all' || filterStatus !== 'all' ||
    filterPriceMin || filterPriceMax;

  // Statistics
  const stats = useMemo(() => {
    const total = localFamilies.length;
    const active = localFamilies.filter(f => f.active).length;
    const withPrices = familiesWithPrices.filter(f => f.activePriceCount > 0).length;
    const totalPrices = prices.length;
    const activePrices = prices.filter(p => p.active && !p.blocked).length;
    
    return { total, active, withPrices, totalPrices, activePrices };
  }, [localFamilies, prices, familiesWithPrices]);

  // Integrity issues
  const integrityIssues = useMemo(() => {
    const familiesWithoutPrices = familiesWithPrices.filter(f => f.activePriceCount === 0 && f.active);
    const familyIds = new Set(localFamilies.map(f => f.id));
    const orphanedPrices = prices.filter(p => !familyIds.has(p.family_id));
    const macroIds = new Set(macros.map(m => m.id));
    const invalidMacros = localFamilies.filter(f => !macroIds.has(f.macro));
    
    return {
      familiesWithoutPrices,
      orphanedPrices,
      invalidMacros,
      total: familiesWithoutPrices.length + orphanedPrices.length + invalidMacros.length
    };
  }, [familiesWithPrices, localFamilies, prices, macros]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-base font-bold text-foreground">Edição Manual do Catálogo</h1>
                <p className="text-xs text-muted-foreground">Modo de edição ativo</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Version Badge */}
            <CatalogVersionBadge onViewHistory={() => setShowVersionHistory(true)} />
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={reloadOriginalCatalog}
              disabled={isLoading}
              className="gap-1.5 text-xs"
              title="Recarregar catálogo original (corrige encoding)"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Recarregar
            </Button>
            {pendingChanges.length > 0 && (
              <>
                <Badge variant="secondary" className="gap-1 text-xs">
                  {pendingChanges.length} alterações
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={discardChanges}
                  className="gap-1.5 text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Descartar
                </Button>
              </>
            )}
            <Button 
              variant="outline"
              size="sm"
              onClick={runClassification}
              disabled={isClassifying || !rawLensData}
              className="gap-1.5 text-xs"
            >
              {isClassifying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              Classificar SKUs
            </Button>
            <Button 
              onClick={saveAllChanges}
              disabled={pendingChanges.length === 0 || isSavingToCloud}
              size="sm"
              className="gap-1.5 text-xs"
            >
              {isSavingToCloud ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              Salvar
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-5 gap-3">
          <Card className="bg-card/50">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Package className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.total}</p>
                <p className="text-[10px] text-muted-foreground">Famílias</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.active}</p>
                <p className="text-[10px] text-muted-foreground">Ativas</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-info" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.withPrices}</p>
                <p className="text-[10px] text-muted-foreground">Com Preços</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50">
            <CardContent className="p-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Boxes className="w-4 h-4 text-secondary" />
              </div>
              <div>
                <p className="text-lg font-bold">{stats.totalPrices}</p>
                <p className="text-[10px] text-muted-foreground">SKUs</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className={`bg-card/50 ${integrityIssues.total > 0 ? 'border-warning' : ''}`}>
            <CardContent className="p-3 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                integrityIssues.total > 0 ? 'bg-warning/10' : 'bg-success/10'
              }`}>
                {integrityIssues.total > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-warning" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-success" />
                )}
              </div>
              <div>
                <p className="text-lg font-bold">{integrityIssues.total}</p>
                <p className="text-[10px] text-muted-foreground">Problemas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/50 p-1 h-auto">
            <TabsTrigger value="families" className="gap-1.5 text-xs py-1.5">
              <Package className="w-3.5 h-3.5" />
              Famílias ({filteredFamilies.length})
            </TabsTrigger>
            <TabsTrigger value="macros" className="gap-1.5 text-xs py-1.5">
              <Layers className="w-3.5 h-3.5" />
              Macros
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-1.5 text-xs py-1.5">
              <Building className="w-3.5 h-3.5" />
              Fornecedores
            </TabsTrigger>
            <TabsTrigger value="technologies" className="gap-1.5 text-xs py-1.5">
              <Cpu className="w-3.5 h-3.5" />
              Tecnologias ({technologiesArray.length})
            </TabsTrigger>
            <TabsTrigger value="integrity" className="gap-1.5 text-xs py-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Integridade
              {integrityIssues.total > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                  {integrityIssues.total}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Families Tab */}
          <TabsContent value="families" className="space-y-3 mt-0">
            {/* Filters */}
            <Card className="bg-card/50">
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-2 items-center">
                  {/* Select All Checkbox */}
                  <div className="flex items-center gap-2 pr-3 border-r border-border">
                    <Checkbox
                      checked={allFilteredSelected}
                      ref={(el) => {
                        if (el) {
                          (el as any).indeterminate = someFilteredSelected;
                        }
                      }}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-xs text-muted-foreground">
                      {selectedIds.size > 0 ? `${selectedIds.size} sel.` : 'Todos'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  
                  <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {uniqueSuppliers.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {uniqueCategories.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterTier} onValueChange={setFilterTier}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {tierOptions.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativas</SelectItem>
                      <SelectItem value="inactive">Inativas</SelectItem>
                      <SelectItem value="no_prices">Sem Preços</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Price Filters */}
                  <div className="flex items-center gap-1 pl-2 border-l border-border">
                    <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      placeholder="Mín"
                      value={filterPriceMin}
                      onChange={(e) => setFilterPriceMin(e.target.value)}
                      className="w-20 h-8 text-xs"
                    />
                    <span className="text-muted-foreground text-xs">-</span>
                    <Input
                      type="number"
                      placeholder="Máx"
                      value={filterPriceMax}
                      onChange={(e) => setFilterPriceMax(e.target.value)}
                      className="w-20 h-8 text-xs"
                    />
                  </div>
                  
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  
                  {/* Add Family Button */}
                  <div className="pl-2 border-l border-border flex gap-2">
                    <AddFamilyDialog
                      macros={macros}
                      categories={uniqueCategories}
                      suppliers={uniqueSuppliers}
                      onAddFamily={handleAddFamily}
                    />
                    <ExportDialog
                      families={filteredFamilies}
                      macros={macros}
                      technologies={localTechnologies}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Family Cards */}
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2 pr-4 pb-20">
                {filteredFamilies.map((family) => (
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
                    {hasActiveFilters && (
                      <Button variant="link" onClick={clearFilters} className="mt-2">
                        Limpar filtros
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Macros Tab */}
          <TabsContent value="macros" className="mt-0">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {macros.map((macro) => {
                const familyCount = localFamilies.filter(f => f.macro === macro.id).length;
                const activeCount = localFamilies.filter(f => f.macro === macro.id && f.active).length;
                const tierColors: Record<string, string> = {
                  'essential': 'border-muted-foreground/30',
                  'comfort': 'border-primary/30',
                  'advanced': 'border-info/30',
                  'top': 'border-secondary/30',
                };
                
                return (
                  <Card key={macro.id} className={`border-2 ${tierColors[macro.tier_key || 'essential']}`}>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>{macro.name_client}</span>
                        <Badge variant="outline" className="text-xs">{macro.category}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-xs text-muted-foreground mb-3">{macro.description_client}</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Famílias:</span>
                        <span className="font-medium">{activeCount}/{familyCount}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Suppliers Tab */}
          <TabsContent value="suppliers" className="mt-0">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {uniqueSuppliers.map((supplier) => {
                const supplierFamilies = localFamilies.filter(f => f.supplier === supplier);
                const activeCount = supplierFamilies.filter(f => f.active).length;
                const categories = [...new Set(supplierFamilies.map(f => f.category))];
                
                return (
                  <Card key={supplier}>
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Building className="w-4 h-4 text-muted-foreground" />
                        {supplier}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-2">
                      <div className="flex gap-1">
                        {categories.map(c => (
                          <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                        ))}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Famílias ativas:</span>
                        <span className="font-medium">{activeCount}/{supplierFamilies.length}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Technologies Tab */}
          <TabsContent value="technologies" className="space-y-3 mt-0">
            {/* Filters */}
            <Card className="bg-card/50">
              <CardContent className="p-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar tecnologias..."
                      value={techSearchTerm}
                      onChange={(e) => setTechSearchTerm(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                  
                  <Select value={filterTechSupplier} onValueChange={setFilterTechSupplier}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {techSuppliers.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {(techSearchTerm || filterTechSupplier !== 'all') && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setTechSearchTerm('');
                        setFilterTechSupplier('all');
                      }} 
                      className="h-8 px-2"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Technology Cards */}
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2 pr-4 pb-4">
                {filteredTechnologies.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Cpu className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>Nenhuma tecnologia encontrada</p>
                    {technologiesArray.length === 0 && (
                      <p className="text-xs mt-2">
                        O catálogo não possui biblioteca de tecnologias configurada
                      </p>
                    )}
                  </div>
                ) : (
                  filteredTechnologies.map((tech) => (
                    <TechnologyCard
                      key={tech.id}
                      technology={tech}
                      usageCount={getTechUsageCount(tech.id)}
                      onUpdate={handleTechnologyUpdate}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Integrity Tab */}
          <TabsContent value="integrity" className="mt-0 space-y-4">
            {integrityIssues.total === 0 ? (
              <Card className="bg-success/5 border-success/30">
                <CardContent className="p-6 text-center">
                  <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
                  <p className="font-medium text-success">Catálogo íntegro</p>
                  <p className="text-sm text-muted-foreground mt-1">Nenhum problema encontrado</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {integrityIssues.familiesWithoutPrices.length > 0 && (
                  <Card className="border-warning/30">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-warning">
                        <AlertTriangle className="w-4 h-4" />
                        Famílias ativas sem preços ({integrityIssues.familiesWithoutPrices.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {integrityIssues.familiesWithoutPrices.map(f => (
                          <div key={f.id} className="flex items-center justify-between py-1 text-sm">
                            <span>{f.name_original}</span>
                            <code className="text-xs text-muted-foreground">{f.id}</code>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {integrityIssues.invalidMacros.length > 0 && (
                  <Card className="border-destructive/30">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-4 h-4" />
                        Macros inválidos ({integrityIssues.invalidMacros.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {integrityIssues.invalidMacros.map(f => (
                          <div key={f.id} className="flex items-center justify-between py-1 text-sm">
                            <span>{f.name_original}</span>
                            <Badge variant="destructive" className="text-xs">{f.macro}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                {integrityIssues.orphanedPrices.length > 0 && (
                  <Card className="border-warning/30">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm flex items-center gap-2 text-warning">
                        <Tag className="w-4 h-4" />
                        Preços órfãos ({integrityIssues.orphanedPrices.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      <p className="text-xs text-muted-foreground">
                        SKUs com family_id que não existe no catálogo
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

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
      </main>
      
      {/* Classification Report Dialog */}
      <ClassificationReportDialog
        open={showClassificationDialog}
        onOpenChange={setShowClassificationDialog}
        report={classificationReport}
        onApplyChanges={applyClassificationChanges}
        isApplying={isApplyingClassification}
      />
      
      {/* Version History Dialog */}
      <CatalogVersionHistory 
        open={showVersionHistory} 
        onOpenChange={setShowVersionHistory} 
      />
    </div>
  );
};

export default CatalogAudit;
