import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  LensData,
  Macro, 
  Family, 
  Addon, 
  Price,
  SupplierPriority,
  CustomerProfile,
  Prescription,
  FrameMeasurements,
  AttributeDef
} from '@/types/lens';

interface LensState {
  // Data from JSON
  schemaVersion: string;
  attributeDefs: AttributeDef[];
  macros: Macro[];
  families: Family[];
  addons: Addon[];
  prices: Price[];
  
  // Custom settings (not from JSON)
  supplierPriorities: SupplierPriority[];
  
  // Current sale context
  currentCustomer: CustomerProfile | null;
  currentPrescription: Prescription | null;
  currentFrame: FrameMeasurements | null;
  selectedAddons: string[];
  
  // Loading state
  isDataLoaded: boolean;
  
  // Actions
  loadLensData: (data: LensData) => void;
  clearAllData: () => void;
  
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
  getFamiliesByMacro: (macroId: string) => Family[];
  getCompatiblePrices: (familyId: string, prescription: Prescription | null, frame: FrameMeasurements | null) => Price[];
  getBestPriceForFamily: (familyId: string, prescription: Prescription | null, frame: FrameMeasurements | null) => Price | null;
}

export const useLensStore = create<LensState>()(
  persist(
    (set, get) => ({
      // Initial state
      schemaVersion: '',
      attributeDefs: [],
      macros: [],
      families: [],
      addons: [],
      prices: [],
      supplierPriorities: [],
      
      currentCustomer: null,
      currentPrescription: null,
      currentFrame: null,
      selectedAddons: [],
      isDataLoaded: false,
      
      // Load complete lens data from JSON - ALWAYS replaces all data
      loadLensData: (data: LensData) => {
        console.log('Loading lens data:', {
          families: data.families?.length || 0,
          addons: data.addons?.length || 0,
          prices: data.prices?.length || 0,
          macros: data.macros?.length || 0
        });
        
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
          attributeDefs: data.attribute_defs || [],
          macros: data.macros || [],
          families: data.families || [],
          addons: data.addons || [],
          prices: data.prices || [],
          supplierPriorities: newPriorities,
          isDataLoaded: true,
        });
      },
      
      clearAllData: () => set({
        schemaVersion: '',
        attributeDefs: [],
        macros: [],
        families: [],
        addons: [],
        prices: [],
        supplierPriorities: [],
        isDataLoaded: false,
      }),
      
      // Toggles
      toggleFamilyActive: (id) => set((state) => ({
        families: state.families.map((f) => 
          f.id === id ? { ...f, active: !f.active } : f
        ),
      })),
      
      toggleAddonActive: (id) => set((state) => ({
        addons: state.addons.map((a) => 
          a.id === id ? { ...a, active: !a.active } : a
        ),
      })),
      
      togglePriceActive: (erpCode) => set((state) => ({
        prices: state.prices.map((p) => 
          p.erp_code === erpCode ? { ...p, active: !p.active } : p
        ),
      })),
      
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
    }),
    {
      name: 'lens-store-v3', // Changed name to reset persisted state
      version: 3,
      // Only persist custom settings, NOT the main data (which comes from JSON import)
      partialize: (state) => ({
        supplierPriorities: state.supplierPriorities,
        currentCustomer: state.currentCustomer,
        currentPrescription: state.currentPrescription,
        currentFrame: state.currentFrame,
        selectedAddons: state.selectedAddons,
      }),
    }
  )
);
