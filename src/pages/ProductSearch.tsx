import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, Package, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useLensStore } from '@/store/lensStore';
import { useCatalogLoader } from '@/hooks/useCatalogLoader';
import { ProductSearchFilters, defaultFilters, type ProductFilters } from '@/components/search/ProductSearchFilters';
import { ProductDetailDrawer } from '@/components/search/ProductDetailDrawer';
import type { Price, FamilyExtended } from '@/types/lens';

const tierLabels: Record<string, string> = {
  essential: 'Essential',
  comfort: 'Comfort',
  advanced: 'Advanced',
  top: 'Top',
};

const tierDot: Record<string, string> = {
  essential: 'bg-muted-foreground',
  comfort: 'bg-blue-500',
  advanced: 'bg-purple-500',
  top: 'bg-amber-500',
};

function hasRealGrade(sku: Price): boolean {
  const av = (sku as any).availability;
  if (av?.sphere?.min !== undefined && av?.sphere?.max !== undefined) {
    return !(av.sphere.min === 0 && av.sphere.max === 0);
  }
  const sp = sku.specs;
  if (sp?.sphere_min !== undefined && sp?.sphere_max !== undefined) {
    return !(sp.sphere_min === 0 && sp.sphere_max === 0);
  }
  return false;
}

export default function ProductSearch() {
  const navigate = useNavigate();
  const { families, prices } = useLensStore();
  const { isLoading, loadCatalog } = useCatalogLoader();

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ProductFilters>(() => defaultFilters);
  const [selectedSku, setSelectedSku] = useState<Price | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (families.length === 0) loadCatalog();
  }, []);

  // Build family map
  const familyMap = useMemo(() => {
    const m = new Map<string, FamilyExtended>();
    families.forEach(f => m.set(f.id, f));
    return m;
  }, [families]);

  // Derive filter options
  const { suppliers, clinicalTypes, indexes, maxPrice } = useMemo(() => {
    const sups = new Set<string>();
    const cts = new Set<string>();
    const idxs = new Set<string>();
    let max = 1000;
    for (const p of prices) {
      if (p.supplier) sups.add(p.supplier);
      const fam = familyMap.get(p.family_id);
      const ct = fam?.clinical_type || fam?.category;
      if (ct) cts.add(ct);
      if (p.index) idxs.add(p.index);
      if (p.price_sale_half_pair > max) max = p.price_sale_half_pair;
    }
    return {
      suppliers: Array.from(sups).sort(),
      clinicalTypes: Array.from(cts).sort(),
      indexes: Array.from(idxs).sort((a, b) => parseFloat(a) - parseFloat(b)),
      maxPrice: Math.ceil(max / 100) * 100,
    };
  }, [prices, familyMap]);

  // Initialize price range once
  useEffect(() => {
    if (maxPrice > 0 && filters.priceRange[1] !== maxPrice) {
      setFilters(f => ({ ...f, priceRange: [0, maxPrice] }));
    }
  }, [maxPrice]);

  // Filter + search
  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    return prices.filter(p => {
      if (!p.active) return false;
      const fam = familyMap.get(p.family_id);

      // Text search
      if (q) {
        const searchable = [
          p.description,
          p.supplier,
          p.erp_code,
          p.sku_erp,
          p.index,
          fam?.name_original,
          fam?.display_name,
          fam?.family_name_commercial,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }

      // Filters
      if (filters.supplier && p.supplier !== filters.supplier) return false;
      if (filters.clinicalType) {
        const ct = fam?.clinical_type || fam?.category;
        if (ct !== filters.clinicalType) return false;
      }
      if (filters.tier) {
        const tier = fam?.tier_target || 'essential';
        if (tier !== filters.tier) return false;
      }
      if (filters.indexValue && p.index !== filters.indexValue) return false;
      if (p.price_sale_half_pair < filters.priceRange[0] || p.price_sale_half_pair > filters.priceRange[1]) return false;
      if (filters.onlyWithGrade && !hasRealGrade(p)) return false;

      return true;
    });
  }, [prices, query, filters, familyMap]);

  const selectedFamily = selectedSku ? familyMap.get(selectedSku.family_id) || null : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-3">
          <Package className="h-10 w-10 animate-pulse mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Carregando catálogo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center gap-4 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Busca de Produtos</h1>
            <p className="text-xs text-muted-foreground">
              {results.length} de {prices.filter(p => p.active).length} SKUs
            </p>
          </div>
        </div>
      </header>

      <div className="container px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar Filters */}
          <aside className="hidden md:block w-64 shrink-0">
            <div className="sticky top-20 bg-card rounded-xl border p-4">
              <ProductSearchFilters
                filters={filters}
                onFiltersChange={setFilters}
                suppliers={suppliers}
                clinicalTypes={clinicalTypes}
                indexes={indexes}
                maxPrice={maxPrice}
              />
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 space-y-4">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, fornecedor, código ERP, índice..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Results */}
            {results.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhum produto encontrado</p>
                <p className="text-sm">Tente ajustar os filtros ou termos de busca.</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {results.slice(0, 100).map(sku => {
                  const fam = familyMap.get(sku.family_id);
                  const tier = fam?.tier_target || 'essential';
                  const realGrade = hasRealGrade(sku);

                  return (
                    <Card
                      key={sku.erp_code || sku.description}
                      className="p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => {
                        setSelectedSku(sku);
                        setDrawerOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${tierDot[tier]}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {fam?.display_name || fam?.name_original || sku.family_id}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">{sku.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!realGrade && (
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <Badge variant="outline" className="text-xs">{sku.index || '—'}</Badge>
                          <Badge variant="outline" className="text-xs">{sku.supplier}</Badge>
                          <span className="text-sm font-semibold tabular-nums w-24 text-right">
                            R$ {sku.price_sale_half_pair?.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
                {results.length > 100 && (
                  <p className="text-center text-xs text-muted-foreground py-4">
                    Mostrando 100 de {results.length} resultados. Refine sua busca.
                  </p>
                )}
              </div>
            )}
          </main>
        </div>
      </div>

      <ProductDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        sku={selectedSku}
        family={selectedFamily}
      />
    </div>
  );
}
