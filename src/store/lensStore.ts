import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { 
  Macro, 
  Family, 
  Module, 
  StandaloneProduct, 
  SupplierPriority, 
  PriceTable,
  CustomerProfile,
  Prescription,
  FrameMeasurements
} from '@/types/lens';

interface LensState {
  // Data
  macros: Macro[];
  families: Family[];
  modules: Module[];
  standaloneProducts: StandaloneProduct[];
  supplierPriorities: SupplierPriority[];
  priceTables: PriceTable[];
  
  // Current sale context
  currentCustomer: CustomerProfile | null;
  currentPrescription: Prescription | null;
  currentFrame: FrameMeasurements | null;
  selectedModules: string[];
  
  // Actions
  setMacros: (macros: Macro[]) => void;
  setFamilies: (families: Family[]) => void;
  setModules: (modules: Module[]) => void;
  setStandaloneProducts: (products: StandaloneProduct[]) => void;
  setSupplierPriorities: (priorities: SupplierPriority[]) => void;
  setPriceTables: (tables: PriceTable[]) => void;
  
  addMacros: (macros: Macro[]) => void;
  addFamilies: (families: Family[]) => void;
  addModules: (modules: Module[]) => void;
  addStandaloneProducts: (products: StandaloneProduct[]) => void;
  
  toggleFamilyActive: (id: string) => void;
  toggleModuleActive: (id: string) => void;
  toggleProductActive: (id: string) => void;
  
  updateSupplierPriority: (macroId: string, suppliers: string[]) => void;
  
  setCurrentCustomer: (customer: CustomerProfile | null) => void;
  setCurrentPrescription: (prescription: Prescription | null) => void;
  setCurrentFrame: (frame: FrameMeasurements | null) => void;
  toggleModule: (moduleId: string) => void;
  clearSelectedModules: () => void;
  
  clearAllData: () => void;
}

// Sample data for demonstration
const sampleMacros: Macro[] = [
  { id: 'prog_top', name: 'Progressivo Premium', description: 'Lentes progressivas de alta tecnologia' },
  { id: 'prog_inter', name: 'Progressivo Intermediário', description: 'Lentes progressivas com bom custo-benefício' },
  { id: 'mono_simples', name: 'Monofocal Simples', description: 'Lentes monofocais para visão única' },
  { id: 'mono_premium', name: 'Monofocal Premium', description: 'Lentes monofocais de alta qualidade' },
];

const sampleFamilies: Family[] = [
  {
    id: 'varilux_xr',
    macroId: 'prog_top',
    name: 'Varilux XR Series',
    supplier: 'Essilor',
    tier: 'top',
    basePrice: 2890,
    benefits: ['Visão nítida em todas as distâncias', 'Adaptação instantânea', 'Tecnologia de realidade estendida'],
    commercialName: 'Varilux XR',
    active: true,
  },
  {
    id: 'zeiss_smartlife',
    macroId: 'prog_top',
    name: 'SmartLife Progressive',
    supplier: 'Zeiss',
    tier: 'top',
    basePrice: 2650,
    benefits: ['Design inteligente para vida digital', 'Campos visuais ampliados', 'Conforto visual prolongado'],
    commercialName: 'SmartLife',
    active: true,
  },
  {
    id: 'hoya_luxe',
    macroId: 'prog_top',
    name: 'Hoyalux ID MySelf',
    supplier: 'Hoya',
    tier: 'top',
    basePrice: 2450,
    benefits: ['Personalização total', 'Tecnologia binocular', 'Design exclusivo'],
    commercialName: 'Hoyalux ID',
    active: true,
  },
  {
    id: 'varilux_comfort',
    macroId: 'prog_inter',
    name: 'Varilux Comfort Max',
    supplier: 'Essilor',
    tier: 'advanced',
    basePrice: 1890,
    benefits: ['Conforto visual duradouro', 'Transições suaves', 'Boa adaptação'],
    commercialName: 'Varilux Comfort',
    active: true,
  },
  {
    id: 'zeiss_precision',
    macroId: 'prog_inter',
    name: 'Precision Pure',
    supplier: 'Zeiss',
    tier: 'comfort',
    basePrice: 1290,
    benefits: ['Precisão visual', 'Design equilibrado', 'Durabilidade'],
    commercialName: 'Precision Pure',
    active: true,
  },
  {
    id: 'essilor_eyezen',
    macroId: 'mono_premium',
    name: 'Eyezen Start',
    supplier: 'Essilor',
    tier: 'comfort',
    basePrice: 590,
    benefits: ['Proteção digital', 'Redução de fadiga', 'Conforto para telas'],
    commercialName: 'Eyezen',
    active: true,
  },
  {
    id: 'basic_mono',
    macroId: 'mono_simples',
    name: 'Lente Monofocal Básica',
    supplier: 'Nacional',
    tier: 'essential',
    basePrice: 190,
    benefits: ['Correção visual básica', 'Custo acessível', 'Entrega rápida'],
    commercialName: 'Monofocal Standard',
    active: true,
  },
];

const sampleModules: Module[] = [
  {
    id: 'crizal_sapphire',
    name: 'Tratamento Premium Anti-Reflexo',
    description: 'Máxima transparência e proteção',
    price: 390,
    benefits: ['99% menos reflexos', 'Proteção UV total', 'Fácil limpeza'],
    commercialName: 'Crizal Sapphire',
    compatibleMacros: ['prog_top', 'prog_inter', 'mono_premium', 'mono_simples'],
    active: true,
  },
  {
    id: 'transitions_gen8',
    name: 'Lentes Fotossensíveis',
    description: 'Escurecem automaticamente na luz',
    price: 490,
    benefits: ['Adaptação automática à luz', 'Proteção 100% UV', 'Conforto em ambientes variados'],
    commercialName: 'Transitions Gen 8',
    compatibleMacros: ['prog_top', 'prog_inter', 'mono_premium', 'mono_simples'],
    active: true,
  },
  {
    id: 'blue_protect',
    name: 'Proteção Luz Azul',
    description: 'Filtra luz azul nociva de telas',
    price: 190,
    benefits: ['Reduz fadiga digital', 'Melhora o sono', 'Proteção para uso de telas'],
    commercialName: 'Blue UV Filter',
    compatibleMacros: ['prog_top', 'prog_inter', 'mono_premium', 'mono_simples'],
    active: true,
  },
  {
    id: 'thin_lens',
    name: 'Lentes Ultra-Finas',
    description: 'Índice 1.74 para alta espessura',
    price: 350,
    benefits: ['Até 40% mais finas', 'Estética superior', 'Leveza extra'],
    commercialName: 'Hi-Index 1.74',
    compatibleMacros: ['prog_top', 'prog_inter', 'mono_premium'],
    active: true,
  },
];

const samplePriorities: SupplierPriority[] = [
  { macroId: 'prog_top', suppliers: ['Essilor', 'Zeiss', 'Hoya'] },
  { macroId: 'prog_inter', suppliers: ['Zeiss', 'Essilor', 'Hoya'] },
  { macroId: 'mono_premium', suppliers: ['Essilor', 'Zeiss'] },
  { macroId: 'mono_simples', suppliers: ['Nacional', 'Essilor'] },
];

export const useLensStore = create<LensState>()(
  persist(
    (set) => ({
      // Initial data
      macros: sampleMacros,
      families: sampleFamilies,
      modules: sampleModules,
      standaloneProducts: [],
      supplierPriorities: samplePriorities,
      priceTables: [],
      
      currentCustomer: null,
      currentPrescription: null,
      currentFrame: null,
      selectedModules: [],
      
      // Setters (replace)
      setMacros: (macros) => set({ macros }),
      setFamilies: (families) => set({ families }),
      setModules: (modules) => set({ modules }),
      setStandaloneProducts: (products) => set({ standaloneProducts: products }),
      setSupplierPriorities: (priorities) => set({ supplierPriorities: priorities }),
      setPriceTables: (tables) => set({ priceTables: tables }),
      
      // Adders (increment)
      addMacros: (newMacros) => set((state) => {
        const updated = [...state.macros];
        newMacros.forEach((macro) => {
          const idx = updated.findIndex((m) => m.id === macro.id);
          if (idx >= 0) updated[idx] = macro;
          else updated.push(macro);
        });
        return { macros: updated };
      }),
      
      addFamilies: (newFamilies) => set((state) => {
        const updated = [...state.families];
        newFamilies.forEach((family) => {
          const idx = updated.findIndex((f) => f.id === family.id);
          if (idx >= 0) updated[idx] = family;
          else updated.push(family);
        });
        return { families: updated };
      }),
      
      addModules: (newModules) => set((state) => {
        const updated = [...state.modules];
        newModules.forEach((module) => {
          const idx = updated.findIndex((m) => m.id === module.id);
          if (idx >= 0) updated[idx] = module;
          else updated.push(module);
        });
        return { modules: updated };
      }),
      
      addStandaloneProducts: (newProducts) => set((state) => {
        const updated = [...state.standaloneProducts];
        newProducts.forEach((product) => {
          const idx = updated.findIndex((p) => p.id === product.id);
          if (idx >= 0) updated[idx] = product;
          else updated.push(product);
        });
        return { standaloneProducts: updated };
      }),
      
      // Toggles
      toggleFamilyActive: (id) => set((state) => ({
        families: state.families.map((f) => 
          f.id === id ? { ...f, active: !f.active } : f
        ),
      })),
      
      toggleModuleActive: (id) => set((state) => ({
        modules: state.modules.map((m) => 
          m.id === id ? { ...m, active: !m.active } : m
        ),
      })),
      
      toggleProductActive: (id) => set((state) => ({
        standaloneProducts: state.standaloneProducts.map((p) => 
          p.id === id ? { ...p, active: !p.active } : p
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
      
      toggleModule: (moduleId) => set((state) => ({
        selectedModules: state.selectedModules.includes(moduleId)
          ? state.selectedModules.filter((id) => id !== moduleId)
          : [...state.selectedModules, moduleId],
      })),
      
      clearSelectedModules: () => set({ selectedModules: [] }),
      
      clearAllData: () => set({
        macros: [],
        families: [],
        modules: [],
        standaloneProducts: [],
        supplierPriorities: [],
        priceTables: [],
      }),
    }),
    {
      name: 'lens-store',
    }
  )
);
