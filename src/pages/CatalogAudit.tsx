import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Search,
  Filter,
  Package,
  DollarSign,
  Loader2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Check,
  X,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Layers,
  Tag,
  Building,
  Boxes
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLensStore } from '@/store/lensStore';
import type { LensData, FamilyExtended, Price, MacroExtended } from '@/types/lens';
import { toast } from 'sonner';

// Tier display mapping
const tierDisplayNames: Record<string, string> = {
  'essential': 'Essencial',
  'comfort': 'Conforto',
  'advanced': 'Avançada',
  'top': 'Top de Mercado',
};

const tierColors: Record<string, string> = {
  'essential': 'bg-muted text-muted-foreground',
  'comfort': 'bg-primary/10 text-primary',
  'advanced': 'bg-info/10 text-info',
  'top': 'bg-secondary/10 text-secondary',
};

interface FamilyWithPrices extends FamilyExtended {
  prices: Price[];
  priceCount: number;
  activePriceCount: number;
  minPrice: number;
  maxPrice: number;
  indices: string[];
}

const CatalogAudit = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSupplier, setFilterSupplier] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterMacro, setFilterMacro] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('families');
  
  // Edit state
  const [editingFamily, setEditingFamily] = useState<string | null>(null);
  const [editMacro, setEditMacro] = useState<string>('');
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Map<string, { macro: string }>>(new Map());

  const { 
    families, 
    prices,
    macros,
    loadLensData,
    loadCatalogFromCloud,
    saveCatalogToCloud,
    isSavingToCloud,
  } = useLensStore();

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
    [...new Set(families.map(f => f.supplier))].sort(), 
    [families]
  );
  
  const uniqueCategories = useMemo(() => 
    [...new Set(families.map(f => f.category))].sort(), 
    [families]
  );

  // Build families with prices data
  const familiesWithPrices: FamilyWithPrices[] = useMemo(() => {
    return families.map(family => {
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
  }, [families, prices]);

  // Filter families
  const filteredFamilies = useMemo(() => {
    return familiesWithPrices.filter(family => {
      const matchesSearch = searchTerm === '' || 
        family.name_original.toLowerCase().includes(searchTerm.toLowerCase()) ||
        family.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        family.supplier.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSupplier = filterSupplier === 'all' || family.supplier === filterSupplier;
      const matchesCategory = filterCategory === 'all' || family.category === filterCategory;
      const matchesMacro = filterMacro === 'all' || family.macro === filterMacro;
      const matchesStatus = filterStatus === 'all' || 
        (filterStatus === 'active' && family.active) ||
        (filterStatus === 'inactive' && !family.active) ||
        (filterStatus === 'no_prices' && family.activePriceCount === 0);
      
      return matchesSearch && matchesSupplier && matchesCategory && matchesMacro && matchesStatus;
    });
  }, [familiesWithPrices, searchTerm, filterSupplier, filterCategory, filterMacro, filterStatus]);

  // Get macro display info
  const getMacroInfo = (macroId: string) => {
    const macro = macros.find(m => m.id === macroId);
    return macro || { id: macroId, name_client: macroId, tier_key: 'essential' as const };
  };

  // Toggle family expansion
  const toggleExpand = (familyId: string) => {
    setExpandedFamilies(prev => {
      const next = new Set(prev);
      if (next.has(familyId)) {
        next.delete(familyId);
      } else {
        next.add(familyId);
      }
      return next;
    });
  };

  // Start editing
  const startEdit = (family: FamilyWithPrices) => {
    setEditingFamily(family.id);
    setEditMacro(family.macro);
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingFamily(null);
    setEditMacro('');
  };

  // Save edit to pending changes
  const saveEdit = (familyId: string) => {
    if (editMacro) {
      setPendingChanges(prev => {
        const next = new Map(prev);
        next.set(familyId, { macro: editMacro });
        return next;
      });
      toast.success('Alteração pendente adicionada');
    }
    setEditingFamily(null);
    setEditMacro('');
  };

  // Apply all pending changes
  const applyAllChanges = async () => {
    if (pendingChanges.size === 0) return;
    
    // Update families in store (would need a new action in lensStore)
    // For now, we'll just show confirmation
    toast.info(`${pendingChanges.size} alterações serão aplicadas ao salvar na nuvem`);
    setShowSaveConfirm(true);
  };

  // Statistics
  const stats = useMemo(() => {
    const total = families.length;
    const active = families.filter(f => f.active).length;
    const withPrices = familiesWithPrices.filter(f => f.activePriceCount > 0).length;
    const totalPrices = prices.length;
    const activePrices = prices.filter(p => p.active && !p.blocked).length;
    
    const byMacro = macros.map(m => ({
      ...m,
      count: families.filter(f => f.macro === m.id).length,
      activeCount: families.filter(f => f.macro === m.id && f.active).length,
    }));
    
    const bySupplier = uniqueSuppliers.map(s => ({
      supplier: s,
      count: families.filter(f => f.supplier === s).length,
      activeCount: families.filter(f => f.supplier === s && f.active).length,
    }));
    
    return { total, active, withPrices, totalPrices, activePrices, byMacro, bySupplier };
  }, [families, prices, macros, uniqueSuppliers, familiesWithPrices]);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

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
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin">
              <Button variant="ghost" size="icon" className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Auditoria do Catálogo</h1>
                <p className="text-xs text-muted-foreground">Classificações, Preços e Integridade</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {pendingChanges.size > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Edit2 className="w-3 h-3" />
                {pendingChanges.size} alterações pendentes
              </Badge>
            )}
            <Button 
              onClick={applyAllChanges}
              disabled={pendingChanges.size === 0 || isSavingToCloud}
              className="gap-2"
            >
              {isSavingToCloud ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Salvar Alterações
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Famílias</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                  <p className="text-xs text-muted-foreground">Ativas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.withPrices}</p>
                  <p className="text-xs text-muted-foreground">Com Preços</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Boxes className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.totalPrices}</p>
                  <p className="text-xs text-muted-foreground">SKUs Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-card/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Tag className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.activePrices}</p>
                  <p className="text-xs text-muted-foreground">SKUs Ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="families" className="gap-2">
              <Package className="w-4 h-4" />
              Famílias & Classificações
            </TabsTrigger>
            <TabsTrigger value="macros" className="gap-2">
              <Layers className="w-4 h-4" />
              Macros / Tiers
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="gap-2">
              <Building className="w-4 h-4" />
              Fornecedores
            </TabsTrigger>
            <TabsTrigger value="integrity" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Integridade
            </TabsTrigger>
          </TabsList>

          {/* Families Tab */}
          <TabsContent value="families" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar família, ID ou fornecedor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <Select value={filterSupplier} onValueChange={setFilterSupplier}>
                    <SelectTrigger className="w-40">
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
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {uniqueCategories.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterMacro} onValueChange={setFilterMacro}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Macro/Tier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {macros.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.name_client}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="active">Ativas</SelectItem>
                      <SelectItem value="inactive">Inativas</SelectItem>
                      <SelectItem value="no_prices">Sem Preços</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Families Table */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {filteredFamilies.length} famílias encontradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8"></TableHead>
                        <TableHead>Família</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Macro/Tier</TableHead>
                        <TableHead className="text-center">SKUs</TableHead>
                        <TableHead className="text-right">Faixa de Preço</TableHead>
                        <TableHead>Índices</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFamilies.map((family) => {
                        const macroInfo = getMacroInfo(family.macro);
                        const isExpanded = expandedFamilies.has(family.id);
                        const isEditing = editingFamily === family.id;
                        const hasPendingChange = pendingChanges.has(family.id);
                        const tierKey = (macroInfo as MacroExtended).tier_key || 'essential';
                        
                        return (
                          <Collapsible key={family.id} open={isExpanded}>
                            <TableRow className={`${hasPendingChange ? 'bg-warning/5' : ''}`}>
                              <TableCell>
                                <CollapsibleTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6"
                                    onClick={() => toggleExpand(family.id)}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-4 h-4" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-foreground">{family.name_original}</p>
                                  <p className="text-xs text-muted-foreground font-mono">{family.id}</p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{family.supplier}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant={family.category === 'PROGRESSIVA' ? 'default' : 'secondary'}>
                                  {family.category}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <Select value={editMacro} onValueChange={setEditMacro}>
                                    <SelectTrigger className="w-40 h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {macros.filter(m => m.category === family.category).map(m => (
                                        <SelectItem key={m.id} value={m.id}>{m.name_client}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <Badge className={tierColors[tierKey]}>
                                      {tierDisplayNames[tierKey] || macroInfo.name_client}
                                    </Badge>
                                    {hasPendingChange && (
                                      <Badge variant="outline" className="text-warning border-warning">
                                        Pendente
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div>
                                  <span className="font-medium">{family.activePriceCount}</span>
                                  <span className="text-muted-foreground">/{family.priceCount}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {family.minPrice > 0 ? (
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">
                                      {formatCurrency(family.minPrice)}
                                    </span>
                                    {family.maxPrice !== family.minPrice && (
                                      <span className="text-muted-foreground"> - {formatCurrency(family.maxPrice)}</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {family.indices.slice(0, 3).map((idx) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {idx}
                                    </Badge>
                                  ))}
                                  {family.indices.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{family.indices.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                {family.active ? (
                                  <Eye className="w-4 h-4 text-success mx-auto" />
                                ) : (
                                  <EyeOff className="w-4 h-4 text-muted-foreground mx-auto" />
                                )}
                              </TableCell>
                              <TableCell>
                                {isEditing ? (
                                  <div className="flex gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 text-success"
                                      onClick={() => saveEdit(family.id)}
                                    >
                                      <Check className="w-4 h-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-7 w-7 text-destructive"
                                      onClick={cancelEdit}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7"
                                    onClick={() => startEdit(family)}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                            <CollapsibleContent asChild>
                              <TableRow className="bg-muted/30">
                                <TableCell colSpan={10} className="p-4">
                                  <div className="space-y-4">
                                    {/* Attributes */}
                                    <div>
                                      <p className="text-sm font-medium mb-2">Atributos Display:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {family.attributes_display_base.map((attr, i) => (
                                          <Badge key={i} variant="outline" className="text-xs">
                                            {attr}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                    
                                    {/* Prices Table */}
                                    {family.prices.length > 0 && (
                                      <div>
                                        <p className="text-sm font-medium mb-2">SKUs ({family.prices.length}):</p>
                                        <div className="border rounded-lg overflow-hidden">
                                          <Table>
                                            <TableHeader>
                                              <TableRow className="bg-muted/50">
                                                <TableHead className="text-xs">ERP Code</TableHead>
                                                <TableHead className="text-xs">Descrição</TableHead>
                                                <TableHead className="text-xs">Índice</TableHead>
                                                <TableHead className="text-xs">Tipo</TableHead>
                                                <TableHead className="text-xs text-right">Custo</TableHead>
                                                <TableHead className="text-xs text-right">Venda</TableHead>
                                                <TableHead className="text-xs text-center">Status</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {family.prices.slice(0, 10).map((price) => (
                                                <TableRow key={price.erp_code} className={!price.active || price.blocked ? 'opacity-50' : ''}>
                                                  <TableCell className="text-xs font-mono">{price.erp_code}</TableCell>
                                                  <TableCell className="text-xs max-w-[200px] truncate">{price.description}</TableCell>
                                                  <TableCell>
                                                    <Badge variant="outline" className="text-xs">{price.index}</Badge>
                                                  </TableCell>
                                                  <TableCell className="text-xs">{price.manufacturing_type}</TableCell>
                                                  <TableCell className="text-xs text-right">{formatCurrency(price.price_purchase_half_pair)}</TableCell>
                                                  <TableCell className="text-xs text-right font-medium">{formatCurrency(price.price_sale_half_pair)}</TableCell>
                                                  <TableCell className="text-center">
                                                    {price.blocked ? (
                                                      <Badge variant="destructive" className="text-xs">Bloqueado</Badge>
                                                    ) : price.active ? (
                                                      <Badge variant="default" className="text-xs bg-success">Ativo</Badge>
                                                    ) : (
                                                      <Badge variant="secondary" className="text-xs">Inativo</Badge>
                                                    )}
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                          {family.prices.length > 10 && (
                                            <div className="p-2 text-center text-xs text-muted-foreground bg-muted/30">
                                              +{family.prices.length - 10} SKUs adicionais
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Macros Tab */}
          <TabsContent value="macros" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {stats.byMacro.map((macro) => {
                const tierKey = (macro as MacroExtended).tier_key || 'essential';
                return (
                  <Card key={macro.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={tierColors[tierKey]}>
                            {tierDisplayNames[tierKey] || macro.name_client}
                          </Badge>
                          <Badge variant="outline">{macro.category}</Badge>
                        </div>
                        <span className="text-2xl font-bold">{macro.count}</span>
                      </div>
                      <CardTitle className="text-base">{macro.name_client}</CardTitle>
                      <CardDescription>{macro.description_client}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ativas: {macro.activeCount}</span>
                        <span className="text-muted-foreground">Inativas: {macro.count - macro.activeCount}</span>
                      </div>
                      <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-success transition-all"
                          style={{ width: `${macro.count > 0 ? (macro.activeCount / macro.count) * 100 : 0}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Suppliers Tab */}
          <TabsContent value="suppliers" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              {stats.bySupplier.map((supplier) => (
                <Card key={supplier.supplier}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{supplier.supplier}</CardTitle>
                      <span className="text-2xl font-bold">{supplier.count}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Ativas: {supplier.activeCount}</span>
                      <span className="text-muted-foreground">Inativas: {supplier.count - supplier.activeCount}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${supplier.count > 0 ? (supplier.activeCount / supplier.count) * 100 : 0}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Integrity Tab */}
          <TabsContent value="integrity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  Verificação de Integridade
                </CardTitle>
                <CardDescription>
                  Análise de consistência entre famílias, preços e classificações
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Families without prices */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Famílias sem preços ativos</h4>
                    <Badge variant={familiesWithPrices.filter(f => f.activePriceCount === 0 && f.active).length > 0 ? 'destructive' : 'default'}>
                      {familiesWithPrices.filter(f => f.activePriceCount === 0 && f.active).length}
                    </Badge>
                  </div>
                  {familiesWithPrices.filter(f => f.activePriceCount === 0 && f.active).length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {familiesWithPrices.filter(f => f.activePriceCount === 0 && f.active).map(f => (
                        <div key={f.id} className="text-sm flex items-center gap-2 text-destructive">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="font-mono">{f.id}</span>
                          <span className="text-muted-foreground">-</span>
                          <span>{f.name_original}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-success flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Todas as famílias ativas têm preços
                    </p>
                  )}
                </div>

                {/* Prices without families */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Preços órfãos (sem família)</h4>
                    <Badge variant={prices.filter(p => !families.find(f => f.id === p.family_id)).length > 0 ? 'destructive' : 'default'}>
                      {prices.filter(p => !families.find(f => f.id === p.family_id)).length}
                    </Badge>
                  </div>
                  {prices.filter(p => !families.find(f => f.id === p.family_id)).length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {prices.filter(p => !families.find(f => f.id === p.family_id)).slice(0, 10).map(p => (
                        <div key={p.erp_code} className="text-sm flex items-center gap-2 text-destructive">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="font-mono">{p.erp_code}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono text-xs">{p.family_id}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-success flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Todos os preços têm família correspondente
                    </p>
                  )}
                </div>

                {/* Families with invalid macro */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Famílias com macro inválido</h4>
                    <Badge variant={families.filter(f => !macros.find(m => m.id === f.macro)).length > 0 ? 'destructive' : 'default'}>
                      {families.filter(f => !macros.find(m => m.id === f.macro)).length}
                    </Badge>
                  </div>
                  {families.filter(f => !macros.find(m => m.id === f.macro)).length > 0 ? (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {families.filter(f => !macros.find(m => m.id === f.macro)).map(f => (
                        <div key={f.id} className="text-sm flex items-center gap-2 text-destructive">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="font-mono">{f.id}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono text-xs">{f.macro}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-success flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Todas as famílias têm macro válido
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Save Confirmation Dialog */}
      <Dialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Alterações</DialogTitle>
            <DialogDescription>
              {pendingChanges.size} alterações serão salvas no catálogo na nuvem.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <ScrollArea className="h-40">
              {Array.from(pendingChanges.entries()).map(([familyId, changes]) => {
                const family = families.find(f => f.id === familyId);
                return (
                  <div key={familyId} className="flex items-center justify-between py-2 border-b">
                    <span className="text-sm">{family?.name_original || familyId}</span>
                    <Badge>{getMacroInfo(changes.macro).name_client}</Badge>
                  </div>
                );
              })}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveConfirm(false)}>
              Cancelar
            </Button>
            <Button onClick={async () => {
              const success = await saveCatalogToCloud();
              if (success) {
                toast.success('Catálogo salvo com sucesso!');
                setPendingChanges(new Map());
              } else {
                toast.error('Erro ao salvar');
              }
              setShowSaveConfirm(false);
            }}>
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CatalogAudit;
