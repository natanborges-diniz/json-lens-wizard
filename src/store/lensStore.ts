import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  LensData,
  MacroExtended, 
  FamilyExtended, 
  Addon, 
  Price,
  SupplierPriority,
  CustomerProfile,
  Prescription,
  FrameMeasurements,
  AttributeDef,
  Scale,
  TechnologyLibrary,
  BenefitRules,
  QuoteExplainer,
  IndexDisplay
} from '@/types/lens';
import { 
  validateImport, 
  executeImport, 
  type ImportResult, 
  type ImportSummary 
} from '@/lib/catalogImporter';
import { supabase } from '@/integrations/supabase/client';

// Debounce helper for auto-save
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

// Catalog event types
export type CatalogEventType = 'data_loaded' | 'schema_updated' | 'catalog_updated' | 'rollback_executed';

export interface CatalogEvent {
  type: CatalogEventType;
  timestamp: number;
  payload?: any;
}

interface LensState {
  // Data from JSON
  schemaVersion: string;
  scales: Record<string, Scale>;
  attributeDefs: AttributeDef[];
  macros: MacroExtended[];
  families: FamilyExtended[];
  addons: Addon[];
  prices: Price[];
  
  // Extended catalog data (from JSON when available)
  technologyLibrary: TechnologyLibrary | null;
  benefitRules: BenefitRules | null;
  quoteExplainer: QuoteExplainer | null;
  indexDisplay: IndexDisplay[];
  benefitPriorityOrder: string[];
  
  // Raw data backup for export (preserves all root keys)
  rawLensData: LensData | null;
  
  // Rollback support (Seção 9 da política)
  previousLensData: LensData | null;
  lastImportSummary: ImportSummary | null;
  
  // Custom settings (not from JSON)
  supplierPriorities: SupplierPriority[];
  
  // Current sale context
  currentCustomer: CustomerProfile | null;
  currentPrescription: Prescription | null;
  currentFrame: FrameMeasurements | null;
  selectedAddons: string[];
  
  // Loading state
  isDataLoaded: boolean;
  
  // Cloud save state
  isSavingToCloud: boolean;
  isLoadingFromCloud: boolean;
  
  // Actions
  loadLensData: (data: LensData) => void;
  clearAllData: () => void;
  validateImportedData: (data: LensData) => { valid: boolean; errors: string[]; warnings: string[] };
  
  // New import actions (policy-compliant)
  importCatalog: (data: unknown, mode: 'increment' | 'replace') => ImportResult;
  rollbackLastImport: () => boolean;
  canRollback: () => boolean;
  
  toggleFamilyActive: (id: string) => void;
  toggleAddonActive: (id: string) => void;
  togglePriceActive: (erpCode: string) => void;
  
  updateSupplierPriority: (macroId: string, suppliers: string[]) => void;
  
  setCurrentCustomer: (customer: CustomerProfile | null) => void;
  setCurrentPrescription: (prescription: Prescription | null) => void;
  setCurrentFrame: (frame: FrameMeasurements | null) => void;
  toggleAddon: (addonId: string) => void;
  clearSelectedAddons: () => void;
  
  // Helpers
  getFamiliesByMacro: (macroId: string) => FamilyExtended[];
  getCompatiblePrices: (familyId: string, prescription: Prescription | null, frame: FrameMeasurements | null) => Price[];
  getBestPriceForFamily: (familyId: string, prescription: Prescription | null, frame: FrameMeasurements | null) => Price | null;
  
  // Catalog events
  emitCatalogEvent: (eventType: CatalogEvent['type']) => void;
  
  // Cloud persistence
  saveCatalogToCloud: () => Promise<boolean>;
  loadCatalogFromCloud: () => Promise<boolean>;
}

export const useLensStore = create<LensState>()(
  persist(
    (set, get) => ({
      // Initial state
      schemaVersion: '',
      scales: {},
      attributeDefs: [],
      macros: [],
      families: [],
      addons: [],
      prices: [],
      supplierPriorities: [],
      
      // Extended catalog data
      technologyLibrary: null,
      benefitRules: null,
      quoteExplainer: null,
      indexDisplay: [],
      benefitPriorityOrder: [],
      
      // Raw data backup for export
      rawLensData: null,
      
      // Rollback support (Seção 9 da política)
      previousLensData: null,
      lastImportSummary: null,
      
      currentCustomer: null,
      currentPrescription: null,
      currentFrame: null,
      selectedAddons: [],
      isDataLoaded: false,
      
      // Cloud save state
      isSavingToCloud: false,
      isLoadingFromCloud: false,
      
      // Validate imported data - checks for required fields (legacy method, kept for compatibility)
      validateImportedData: (data: LensData) => {
        const result = validateImport(data, 'replace');
        return { 
          valid: result.valid, 
          errors: [...result.errors, ...result.integrityErrors], 
          warnings: result.warnings 
        };
      },
      
      // NEW: Policy-compliant import with validation, merge, and rollback support
      importCatalog: (data: unknown, mode: 'increment' | 'replace'): ImportResult => {
        const state = get();
        const currentData = state.rawLensData;
        
        console.log(`[LensStore] Executing ${mode.toUpperCase()} import...`);
        
        const result = executeImport(data, currentData, mode);
        
        if (result.success && result.mergedData) {
          // Store previous data for rollback (Seção 9)
          const previousData = currentData ? JSON.parse(JSON.stringify(currentData)) : null;
          
          // Generate supplier priorities from the new data
          const newPriorities = (result.mergedData.macros || []).map(macro => ({
            macroId: macro.id,
            suppliers: [...new Set(
              (result.mergedData!.families || [])
                .filter(f => f.macro === macro.id && f.active)
                .map(f => f.supplier)
            )]
          }));
          
          set({
            schemaVersion: result.mergedData.meta?.schema_version || '1.0',
            scales: result.mergedData.scales || {},
            attributeDefs: result.mergedData.attribute_defs || [],
            macros: result.mergedData.macros || [],
            families: result.mergedData.families || [],
            addons: result.mergedData.addons || [],
            prices: result.mergedData.prices || [],
            supplierPriorities: newPriorities,
            technologyLibrary: result.mergedData.technology_library || null,
            benefitRules: result.mergedData.benefit_rules || null,
            quoteExplainer: result.mergedData.quote_explainer || null,
            indexDisplay: result.mergedData.index_display || [],
            benefitPriorityOrder: result.mergedData.benefit_priority_order || result.mergedData.benefit_rules?.priority_order || [],
            rawLensData: result.mergedData,
            previousLensData: previousData,
            lastImportSummary: result.summary,
            isDataLoaded: true,
          });
          
          // Emit catalog update event for cache invalidation (Seção 6)
          state.emitCatalogEvent('catalog_updated');
          
          console.log('[LensStore] Import successful. Catalog event emitted.');
        } else {
          console.error('[LensStore] Import failed:', result.validation);
        }
        
        return result;
      },
      
      // Rollback support (Seção 9)
      canRollback: (): boolean => {
        return get().previousLensData !== null;
      },
      
      rollbackLastImport: (): boolean => {
        const state = get();
        const previousData = state.previousLensData;
        
        if (!previousData) {
          console.warn('[LensStore] No previous data available for rollback');
          return false;
        }
        
        console.log('[LensStore] Executing rollback...');
        
        // Generate supplier priorities from the previous data
        const newPriorities = (previousData.macros || []).map(macro => ({
          macroId: macro.id,
          suppliers: [...new Set(
            (previousData.families || [])
              .filter(f => f.macro === macro.id && f.active)
              .map(f => f.supplier)
          )]
        }));
        
        set({
          schemaVersion: previousData.meta?.schema_version || '1.0',
          scales: previousData.scales || {},
          attributeDefs: previousData.attribute_defs || [],
          macros: previousData.macros || [],
          families: previousData.families || [],
          addons: previousData.addons || [],
          prices: previousData.prices || [],
          supplierPriorities: newPriorities,
          technologyLibrary: previousData.technology_library || null,
          benefitRules: previousData.benefit_rules || null,
          quoteExplainer: previousData.quote_explainer || null,
          indexDisplay: previousData.index_display || [],
          benefitPriorityOrder: previousData.benefit_priority_order || previousData.benefit_rules?.priority_order || [],
          rawLensData: previousData,
          previousLensData: null, // Clear rollback data after use
          lastImportSummary: null,
          isDataLoaded: true,
        });
        
        // Emit rollback event
        state.emitCatalogEvent('rollback_executed');
        
        console.log('[LensStore] Rollback successful');
        return true;
      },
      
      // Load complete lens data from JSON - PRESERVES ALL ROOT KEYS (legacy method)
      loadLensData: (data: LensData) => {
        console.log('[LensStore] Loading lens data (legacy method):', {
          families: data.families?.length || 0,
          addons: data.addons?.length || 0,
          prices: data.prices?.length || 0,
          macros: data.macros?.length || 0,
          hasExtendedFields: {
            technology_library: !!data.technology_library,
            benefit_rules: !!data.benefit_rules,
            quote_explainer: !!data.quote_explainer,
            index_display: !!data.index_display,
          }
        });
        
        const state = get();
        const previousData = state.rawLensData ? JSON.parse(JSON.stringify(state.rawLensData)) : null;
        
        // Generate supplier priorities from the new data
        const newPriorities = (data.macros || []).map(macro => ({
          macroId: macro.id,
          suppliers: [...new Set(
            (data.families || [])
              .filter(f => f.macro === macro.id && f.active)
              .map(f => f.supplier)
          )]
        }));
        
        set({
          schemaVersion: data.meta?.schema_version || '1.0',
          scales: data.scales || {},
          attributeDefs: data.attribute_defs || [],
          macros: data.macros || [],
          families: data.families || [],
          addons: data.addons || [],
          prices: data.prices || [],
          supplierPriorities: newPriorities,
          // Extended catalog data (all root keys preserved)
          technologyLibrary: data.technology_library || null,
          benefitRules: data.benefit_rules || null,
          quoteExplainer: data.quote_explainer || null,
          indexDisplay: data.index_display || [],
          benefitPriorityOrder: data.benefit_priority_order || data.benefit_rules?.priority_order || [],
          // Store raw data for full export capability
          rawLensData: data,
          previousLensData: previousData,
          isDataLoaded: true,
        });
        
        // Emit catalog update event for cache invalidation
        get().emitCatalogEvent('catalog_updated');
        
        console.log('[LensStore] Data loaded successfully. Catalog event emitted.');
      },
      
      clearAllData: () => set({
        schemaVersion: '',
        scales: {},
        attributeDefs: [],
        macros: [],
        families: [],
        addons: [],
        prices: [],
        supplierPriorities: [],
        technologyLibrary: null,
        benefitRules: null,
        quoteExplainer: null,
        indexDisplay: [],
        benefitPriorityOrder: [],
        rawLensData: null,
        previousLensData: null,
        lastImportSummary: null,
        isDataLoaded: false,
      }),
      
      // Emit catalog events for cache invalidation
      emitCatalogEvent: (eventType: CatalogEvent['type']) => {
        const event: CatalogEvent = {
          type: eventType,
          timestamp: Date.now(),
        };
        window.dispatchEvent(new CustomEvent('catalog-event', { detail: event }));
        console.log('[LensStore] Catalog event emitted:', eventType);
      },
      
      // Toggles - also sync with rawLensData for export consistency + debounced cloud save
      toggleFamilyActive: (id) => {
        set((state) => {
          const newFamilies = state.families.map((f) => 
            f.id === id ? { ...f, active: !f.active } : f
          );
          const newRawData = state.rawLensData ? {
            ...state.rawLensData,
            families: newFamilies
          } : null;
          return { families: newFamilies, rawLensData: newRawData };
        });
        // Debounced auto-save to cloud
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          get().saveCatalogToCloud().catch(console.error);
        }, 2000);
      },
      
      toggleAddonActive: (id) => {
        set((state) => {
          const newAddons = state.addons.map((a) => 
            a.id === id ? { ...a, active: !a.active } : a
          );
          const newRawData = state.rawLensData ? {
            ...state.rawLensData,
            addons: newAddons
          } : null;
          return { addons: newAddons, rawLensData: newRawData };
        });
        // Debounced auto-save to cloud
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          get().saveCatalogToCloud().catch(console.error);
        }, 2000);
      },
      
      togglePriceActive: (erpCode) => {
        set((state) => {
          const newPrices = state.prices.map((p) => 
            p.erp_code === erpCode ? { ...p, active: !p.active } : p
          );
          const newRawData = state.rawLensData ? {
            ...state.rawLensData,
            prices: newPrices
          } : null;
          return { prices: newPrices, rawLensData: newRawData };
        });
        // Debounced auto-save to cloud
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          get().saveCatalogToCloud().catch(console.error);
        }, 2000);
      },
      
      updateSupplierPriority: (macroId, suppliers) => set((state) => {
        const updated = state.supplierPriorities.filter((p) => p.macroId !== macroId);
        updated.push({ macroId, suppliers });
        return { supplierPriorities: updated };
      }),
      
      // Sale context
      setCurrentCustomer: (customer) => set({ currentCustomer: customer }),
      setCurrentPrescription: (prescription) => set({ currentPrescription: prescription }),
      setCurrentFrame: (frame) => set({ currentFrame: frame }),
      
      toggleAddon: (addonId) => set((state) => ({
        selectedAddons: state.selectedAddons.includes(addonId)
          ? state.selectedAddons.filter((id) => id !== addonId)
          : [...state.selectedAddons, addonId],
      })),
      
      clearSelectedAddons: () => set({ selectedAddons: [] }),
      
      // Helper functions
      getFamiliesByMacro: (macroId) => {
        const state = get();
        return state.families.filter(f => f.macro === macroId && f.active);
      },
      
      getCompatiblePrices: (familyId, prescription, frame) => {
        const state = get();
        const familyPrices = state.prices.filter(p => 
          p.family_id === familyId && 
          p.active && 
          !p.blocked
        );
        
        // If no prescription data at all, return all prices - don't filter
        if (!prescription) return familyPrices;
        
        // Check if prescription has meaningful values for filtering
        const hasSphereOrCyl = 
          prescription.rightSphere !== 0 || 
          prescription.leftSphere !== 0 ||
          prescription.rightCylinder !== 0 ||
          prescription.leftCylinder !== 0;
        
        // If no meaningful prescription values, return all prices
        if (!hasSphereOrCyl) return familyPrices;
        
        // Filter by prescription specs when we have real data
        const filtered = familyPrices.filter(p => {
          const { specs } = p;
          if (!specs) return true; // No specs = no filtering
          
          // Check sphere range
          const sphereOk = 
            prescription.rightSphere >= specs.sphere_min && 
            prescription.rightSphere <= specs.sphere_max &&
            prescription.leftSphere >= specs.sphere_min && 
            prescription.leftSphere <= specs.sphere_max;
          
          // Check cylinder range (cylinder is typically negative, so cyl_min is more negative)
          const cylOk = 
            prescription.rightCylinder >= specs.cyl_min && 
            prescription.rightCylinder <= specs.cyl_max &&
            prescription.leftCylinder >= specs.cyl_min && 
            prescription.leftCylinder <= specs.cyl_max;
          
          // Check addition for progressive lenses
          // Only filter by addition if both prescription and specs have addition values
          let addOk = true;
          const rightAdd = prescription.rightAddition || 0;
          const leftAdd = prescription.leftAddition || 0;
          const hasAdditionInRx = rightAdd > 0 || leftAdd > 0;
          const hasAdditionInSpecs = specs.add_min !== undefined && specs.add_max !== undefined;
          
          if (hasAdditionInRx && hasAdditionInSpecs) {
            // Only check if we have addition in prescription
            addOk = rightAdd >= specs.add_min! && rightAdd <= specs.add_max! &&
                    leftAdd >= specs.add_min! && leftAdd <= specs.add_max!;
          }
          // If no addition in prescription but specs require it, still allow the product
          // This way products show up even if addition wasn't entered yet
          
          // Check frame dimensions if available
          let frameOk = true;
          if (frame && frame.altura && specs.altura_min_mm && specs.altura_max_mm) {
            frameOk = frame.altura >= specs.altura_min_mm && 
                     frame.altura <= specs.altura_max_mm;
          }
          
          return sphereOk && cylOk && addOk && frameOk;
        });
        
        // If filtering removed all options, return unfiltered to show something
        return filtered.length > 0 ? filtered : familyPrices;
      },
      
      getBestPriceForFamily: (familyId, prescription, frame) => {
        const compatiblePrices = get().getCompatiblePrices(familyId, prescription, frame);
        if (compatiblePrices.length === 0) return null;
        
        // Sort by price (cheapest first) and return the first one
        const sorted = [...compatiblePrices].sort(
          (a, b) => a.price_sale_half_pair - b.price_sale_half_pair
        );
        return sorted[0];
      },
      
      // Cloud persistence functions
      saveCatalogToCloud: async () => {
        const state = get();
        set({ isSavingToCloud: true });
        
        try {
          // Build catalog data from current state
          const catalogData: LensData = {
            meta: {
              schema_version: state.schemaVersion || '1.2',
              dataset_name: 'LensFlow Catalog',
              generated_at: new Date().toISOString(),
              counts: {
                families: state.families.filter(f => f.active).length,
                addons: state.addons.filter(a => a.active).length,
                skus_prices: state.prices.filter(p => p.active && !p.blocked).length
              },
              notes: ['Saved from LensFlow Admin']
            },
            scales: state.rawLensData?.scales || {},
            attribute_defs: state.attributeDefs,
            macros: state.macros,
            families: state.families,
            addons: state.addons,
            prices: state.prices,
            products_avulsos: state.rawLensData?.products_avulsos || [],
            technology_library: state.technologyLibrary || undefined,
            benefit_rules: state.benefitRules || undefined,
            quote_explainer: state.quoteExplainer || undefined,
            index_display: state.indexDisplay?.length > 0 ? state.indexDisplay : undefined,
          };
          
          // Sanitize to avoid NaN/Infinity in JSON
          const sanitizedData = JSON.parse(
            JSON.stringify(catalogData, (key, value) => {
              if (typeof value === 'number' && (!Number.isFinite(value) || Number.isNaN(value))) {
                return null;
              }
              return value;
            })
          );
          
          // Ensure UTF-8 encoding for special characters (ç, ã, é, etc.)
          const jsonBlob = new Blob([JSON.stringify(sanitizedData)], { type: 'application/json; charset=utf-8' });
          
          const { error } = await supabase.storage
            .from('catalogs')
            .upload('catalog-default.json', jsonBlob, { upsert: true });
          
          if (error) {
            console.error('[LensStore] Cloud save failed:', error);
            throw error;
          }
          
          console.log('[LensStore] Catalog saved to cloud successfully');
          return true;
        } catch (e) {
          console.error('[LensStore] Error saving to cloud:', e);
          return false;
        } finally {
          set({ isSavingToCloud: false });
        }
      },
      
      loadCatalogFromCloud: async () => {
        set({ isLoadingFromCloud: true });
        
        try {
          const { data, error } = await supabase.storage
            .from('catalogs')
            .download('catalog-default.json');
          
          if (error || !data) {
            console.log('[LensStore] No cloud catalog found:', error?.message);
            return false;
          }
          
          // Decode as UTF-8 explicitly to fix encoding issues (ç, ã, é, etc.)
          const arrayBuffer = await data.arrayBuffer();
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(arrayBuffer);
          const catalogData = JSON.parse(text) as LensData;
          
          console.log('[LensStore] Loaded catalog from cloud:', {
            families: catalogData.families?.length || 0,
            addons: catalogData.addons?.length || 0,
            prices: catalogData.prices?.length || 0
          });
          
          get().loadLensData(catalogData);
          return true;
        } catch (e) {
          console.error('[LensStore] Error loading from cloud:', e);
          return false;
        } finally {
          set({ isLoadingFromCloud: false });
        }
      },
    }),
    {
      name: 'lens-store-v5', // Changed to v5 - removed large data from persistence
      version: 5,
      // Persist ONLY lightweight settings - catalog data is reloaded from JSON
      partialize: (state) => ({
        // Custom settings only (small data)
        supplierPriorities: state.supplierPriorities,
        currentCustomer: state.currentCustomer,
        currentPrescription: state.currentPrescription,
        currentFrame: state.currentFrame,
        selectedAddons: state.selectedAddons,
        // NOTE: families, addons, prices, rawLensData are NOT persisted 
        // to avoid localStorage quota errors with large catalogs
      }),
      // Handle storage errors gracefully
      storage: {
        getItem: (name) => {
          try {
            const str = localStorage.getItem(name);
            return str ? JSON.parse(str) : null;
          } catch (e) {
            console.warn('Failed to read from localStorage:', e);
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (e) {
            console.warn('Failed to write to localStorage (quota exceeded?):', e);
            // Silently fail - data won't persist but app will work
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch (e) {
            console.warn('Failed to remove from localStorage:', e);
          }
        },
      },
    }
  )
);
