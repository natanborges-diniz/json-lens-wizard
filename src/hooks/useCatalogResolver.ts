// CatalogResolver - Central resolver for all catalog display data
// The JSON is the single source of truth - no hardcoded display strings

import { useMemo, useCallback } from 'react';
import { useLensStore } from '@/store/lensStore';
import type { 
  Technology, 
  MacroDisplay, 
  ResolvedFamilyDisplay,
  BenefitRule,
  IndexDisplay,
  CatalogEvent
} from '@/types/catalog';
import type { Family, Addon, AnamnesisData } from '@/types/lens';

// Default tier configuration (fallback if JSON doesn't have display config)
const DEFAULT_TIER_CONFIG: Record<string, {
  label: string;
  icon: string;
  colorClass: string;
  bgHeaderClass: string;
  borderClass: string;
  dotColorClass: string;
  selectedBorderClass: string;
}> = {
  essential: {
    label: 'Essencial',
    icon: 'Shield',
    colorClass: 'text-muted-foreground',
    bgHeaderClass: 'bg-muted',
    borderClass: 'border-muted-foreground/20',
    dotColorClass: 'bg-muted-foreground',
    selectedBorderClass: 'ring-muted-foreground',
  },
  comfort: {
    label: 'Conforto',
    icon: 'Star',
    colorClass: 'text-primary',
    bgHeaderClass: 'bg-primary/10',
    borderClass: 'border-primary/30',
    dotColorClass: 'bg-primary',
    selectedBorderClass: 'ring-primary',
  },
  advanced: {
    label: 'Avançada',
    icon: 'Zap',
    colorClass: 'text-blue-500',
    bgHeaderClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/30',
    dotColorClass: 'bg-blue-400',
    selectedBorderClass: 'ring-blue-500',
  },
  top: {
    label: 'Top de Mercado',
    icon: 'Crown',
    colorClass: 'text-amber-500',
    bgHeaderClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    dotColorClass: 'bg-amber-400',
    selectedBorderClass: 'ring-amber-500',
  },
};

// Default scale labels (fallback)
const DEFAULT_SCALE_LABELS: Record<string, string> = {
  '0': 'Básico',
  '1': 'Leve',
  '2': 'Intermediário',
  '3': 'Avançado',
};

// Default index display (fallback)
const DEFAULT_INDEX_DISPLAY: IndexDisplay[] = [
  { value: '1.50', name: 'Padrão', description: 'Espessura normal', aesthetic_score: 1 },
  { value: '1.56', name: 'Leve', description: 'Levemente mais fina', aesthetic_score: 2 },
  { value: '1.59', name: 'Policarbonato', description: 'Resistente a impactos', aesthetic_score: 2 },
  { value: '1.60', name: 'Fina', description: 'Boa estética', aesthetic_score: 3 },
  { value: '1.67', name: 'Mais Fina', description: 'Excelente estética', aesthetic_score: 4 },
  { value: '1.74', name: 'Ultra Fina', description: 'Máxima finura', aesthetic_score: 5 },
];

// Macro ID to tier key mapping
const MACRO_TO_TIER: Record<string, 'essential' | 'comfort' | 'advanced' | 'top'> = {
  'PROG_BASICO': 'essential',
  'PROG_CONFORTO': 'comfort',
  'PROG_AVANCADO': 'advanced',
  'PROG_TOP': 'top',
  'MONO_BASICO': 'essential',
  'MONO_ENTRADA': 'comfort',
  'MONO_INTER': 'advanced',
  'MONO_TOP': 'top',
};

interface CatalogResolverResult {
  // Core resolvers
  resolveFamilyDisplay: (family: Family) => ResolvedFamilyDisplay | null;
  resolveAddonName: (addon: Addon, supplier: string) => string;
  resolveTechnology: (techId: string) => Technology | null;
  resolveAttributeLabel: (attributeId: string, value: number) => string;
  
  // Tier helpers
  getTierConfig: (macroId: string) => typeof DEFAULT_TIER_CONFIG.essential;
  getTierKey: (macroId: string) => 'essential' | 'comfort' | 'advanced' | 'top';
  getMacroDisplay: (macroId: string) => MacroDisplay | null;
  
  // Index helpers
  getIndexDisplay: (indexValue: string) => IndexDisplay;
  getAllIndexDisplays: () => IndexDisplay[];
  
  // Quote generation
  generateQuoteExplanation: (family: Family, anamnesis: AnamnesisData) => string[];
  
  // Scale helpers
  getScaleLabels: (scaleId: string) => Record<string, string>;
  scaleToStars: (value: number, maxScale?: number) => number;
  
  // Events
  emitCatalogEvent: (event: CatalogEvent) => void;
  
  // Status
  isLoaded: boolean;
}

export const useCatalogResolver = (): CatalogResolverResult => {
  const { 
    macros, 
    families, 
    addons, 
    attributeDefs, 
    isDataLoaded 
  } = useLensStore();
  
  // Get extended data from store (if available)
  // For now, we work with current schema and gracefully fallback
  
  // Build macro lookup map
  const macroMap = useMemo(() => {
    const map = new Map<string, MacroDisplay>();
    macros.forEach(macro => {
      const tierKey = MACRO_TO_TIER[macro.id] || 'essential';
      const defaultConfig = DEFAULT_TIER_CONFIG[tierKey];
      
      map.set(macro.id, {
        id: macro.id,
        category: macro.category,
        name_client: macro.name_client,
        description_client: macro.description_client,
        tier_key: tierKey,
        display: {
          icon: defaultConfig.icon,
          color_class: defaultConfig.colorClass,
          bg_header_class: defaultConfig.bgHeaderClass,
          border_class: defaultConfig.borderClass,
          dot_color_class: defaultConfig.dotColorClass,
        },
      });
    });
    return map;
  }, [macros]);
  
  // Get tier key from macro ID
  const getTierKey = useCallback((macroId: string): 'essential' | 'comfort' | 'advanced' | 'top' => {
    return MACRO_TO_TIER[macroId] || 'essential';
  }, []);
  
  // Get tier configuration
  const getTierConfig = useCallback((macroId: string) => {
    const tierKey = getTierKey(macroId);
    const macro = macroMap.get(macroId);
    
    if (macro?.display) {
      return {
        label: macro.name_client,
        icon: macro.display.icon,
        colorClass: macro.display.color_class,
        bgHeaderClass: macro.display.bg_header_class,
        borderClass: macro.display.border_class,
        dotColorClass: macro.display.dot_color_class,
        selectedBorderClass: DEFAULT_TIER_CONFIG[tierKey].selectedBorderClass,
      };
    }
    
    return DEFAULT_TIER_CONFIG[tierKey];
  }, [macroMap, getTierKey]);
  
  // Get macro display data
  const getMacroDisplay = useCallback((macroId: string): MacroDisplay | null => {
    return macroMap.get(macroId) || null;
  }, [macroMap]);
  
  // Get scale labels from JSON or fallback
  const getScaleLabels = useCallback((scaleId: string): Record<string, string> => {
    // TODO: Read from lensData.scales when extended schema is loaded
    return DEFAULT_SCALE_LABELS;
  }, []);
  
  // Convert 0-3 scale to 1-5 stars
  const scaleToStars = useCallback((value: number, maxScale: number = 3): number => {
    // 0 -> 1, 1 -> 2, 2 -> 4, 3 -> 5
    const mapping = [1, 2, 4, 5];
    return mapping[Math.min(value, maxScale)] || 1;
  }, []);
  
  // Resolve attribute value to human label
  const resolveAttributeLabel = useCallback((attributeId: string, value: number): string => {
    const labels = getScaleLabels('range_0_3');
    return labels[String(value)] || labels['0'];
  }, [getScaleLabels]);
  
  // Resolve addon name for specific supplier
  const resolveAddonName = useCallback((addon: Addon, supplier: string): string => {
    return addon.name_commercial?.[supplier] || addon.name_common;
  }, []);
  
  // Resolve technology by ID
  const resolveTechnology = useCallback((techId: string): Technology | null => {
    // TODO: Implement when technology_library is added to JSON
    return null;
  }, []);
  
  // Get index display configuration
  const getIndexDisplay = useCallback((indexValue: string): IndexDisplay => {
    // TODO: Read from lensData.index_display when extended schema is loaded
    const found = DEFAULT_INDEX_DISPLAY.find(i => i.value === indexValue);
    return found || { value: indexValue, name: indexValue, description: '', aesthetic_score: 1 };
  }, []);
  
  // Get all index displays
  const getAllIndexDisplays = useCallback((): IndexDisplay[] => {
    return DEFAULT_INDEX_DISPLAY;
  }, []);
  
  // Resolve complete family display data
  const resolveFamilyDisplay = useCallback((family: Family): ResolvedFamilyDisplay | null => {
    const macro = macroMap.get(family.macro);
    if (!macro) return null;
    
    const tierKey = getTierKey(family.macro);
    const tierConfig = getTierConfig(family.macro);
    
    // Resolve technologies
    const technologies: Technology[] = [];
    // TODO: Resolve from technology_refs when available
    
    // Resolve attribute labels
    const prefix = family.category === 'PROGRESSIVA' ? 'PROG_' : 'MONO_';
    const relevantAttrs = attributeDefs.filter(a => 
      a.id.startsWith(prefix) || ['AR_QUALIDADE', 'BLUE', 'DURABILIDADE'].includes(a.id)
    );
    
    const attributeLabels = relevantAttrs.map(attr => {
      const value = typeof family.attributes_base?.[attr.id] === 'number' 
        ? family.attributes_base[attr.id] as number 
        : 0;
      
      return {
        id: attr.id,
        name: attr.name_common,
        value,
        label: resolveAttributeLabel(attr.id, value),
        stars: scaleToStars(value),
      };
    });
    
    return {
      family: family as any,
      macro,
      technologies,
      attributeLabels,
      tierConfig,
    };
  }, [macroMap, attributeDefs, getTierKey, getTierConfig, resolveAttributeLabel, scaleToStars]);
  
  // Generate quote explanation based on anamnesis
  const generateQuoteExplanation = useCallback((
    family: Family, 
    anamnesis: AnamnesisData
  ): string[] => {
    const paragraphs: string[] = [];
    const macro = macroMap.get(family.macro);
    
    // Intro based on category
    if (family.category === 'PROGRESSIVA') {
      paragraphs.push(
        `A lente ${family.name_original} é uma progressiva da categoria ${macro?.name_client || 'padrão'}, ` +
        `que permite enxergar bem de longe e de perto com a mesma lente.`
      );
    } else {
      paragraphs.push(
        `A lente ${family.name_original} é uma visão simples da categoria ${macro?.name_client || 'padrão'}, ` +
        `ideal para quem precisa de correção em uma única distância.`
      );
    }
    
    // Screen usage
    if (anamnesis.screenHours === '6-8' || anamnesis.screenHours === '8+') {
      const digitalValue = family.attributes_base?.['PROG_DIGITAL'] || family.attributes_base?.['MONO_DIGITAL'] || 0;
      if (typeof digitalValue === 'number' && digitalValue >= 2) {
        paragraphs.push(
          `Como você passa muitas horas em frente às telas, esta lente foi desenvolvida com tecnologia ` +
          `específica para reduzir o cansaço visual digital e melhorar o conforto durante o uso prolongado.`
        );
      }
    }
    
    // Night driving
    if (anamnesis.nightDriving === 'frequent') {
      const arValue = family.attributes_base?.['AR_QUALIDADE'] || 0;
      if (typeof arValue === 'number' && arValue >= 2) {
        paragraphs.push(
          `Para quem dirige à noite com frequência, o antirreflexo premium desta lente ajuda a ` +
          `reduzir o ofuscamento dos faróis e melhora a visão em condições de baixa luminosidade.`
        );
      }
    }
    
    // Outdoor preference
    if (anamnesis.outdoorTime === 'yes') {
      if (family.attributes_base?.['UV'] === true) {
        paragraphs.push(
          `Esta lente inclui proteção UV completa, essencial para quem passa tempo ao ar livre, ` +
          `protegendo seus olhos dos raios nocivos do sol.`
        );
      }
    }
    
    // Aesthetic priority
    if (anamnesis.aestheticPriority === 'high') {
      paragraphs.push(
        `Para quem valoriza a estética, recomendamos escolher um índice de refração mais alto ` +
        `(como 1.67 ou 1.74), que resulta em lentes mais finas e leves.`
      );
    }
    
    return paragraphs;
  }, [macroMap]);
  
  // Emit catalog event (for cache invalidation)
  const emitCatalogEvent = useCallback((event: CatalogEvent) => {
    // Dispatch custom event for listeners
    window.dispatchEvent(new CustomEvent('catalog-event', { detail: event }));
    console.log('[CatalogResolver] Event emitted:', event.type);
  }, []);
  
  return {
    resolveFamilyDisplay,
    resolveAddonName,
    resolveTechnology,
    resolveAttributeLabel,
    getTierConfig,
    getTierKey,
    getMacroDisplay,
    getIndexDisplay,
    getAllIndexDisplays,
    generateQuoteExplanation,
    getScaleLabels,
    scaleToStars,
    emitCatalogEvent,
    isLoaded: isDataLoaded,
  };
};
