// CatalogResolver - Central resolver for all catalog display data
// The JSON is the single source of truth - no hardcoded display strings

import { useMemo, useCallback } from 'react';
import { useLensStore } from '@/store/lensStore';
import type { 
  Technology, 
  MacroExtended,
  FamilyExtended,
  TechnologyLibrary,
  BenefitRules,
  QuoteExplainer,
  IndexDisplay,
  AnamnesisData,
  ClinicalType 
} from '@/types/lens';
import type { CatalogEvent } from '@/store/lensStore';

// Resolved display data for a family
export interface ResolvedFamilyDisplay {
  family: FamilyExtended;
  macro: MacroExtended;
  technologies: Technology[];
  attributeLabels: Array<{
    id: string;
    name: string;
    value: number;
    label: string;
    stars: number;
  }>;
  tierConfig: {
    label: string;
    icon: string;
    colorClass: string;
    bgHeaderClass: string;
    borderClass: string;
    dotColorClass: string;
    selectedBorderClass: string;
  };
}

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

// Macro ID to tier key mapping (fallback for known macros)
const MACRO_TO_TIER_FALLBACK: Record<string, 'essential' | 'comfort' | 'advanced' | 'top'> = {
  // Progressive
  'PROG_BASICO': 'essential',
  'PROG_ESSENTIAL': 'essential',
  'PROG_CONFORTO': 'comfort',
  'PROG_COMFORT': 'comfort',
  'PROG_AVANCADO': 'advanced',
  'PROG_ADVANCED': 'advanced',
  'PROG_TOP': 'top',
  'PROG_PREMIUM': 'top',
  // Monofocal
  'MONO_BASICO': 'essential',
  'MONO_ESSENTIAL': 'essential',
  'MONO_ENTRADA': 'comfort',
  'MONO_COMFORT': 'comfort',
  'MONO_CONFORTO': 'comfort',
  'MONO_INTER': 'advanced',
  'MONO_ADVANCED': 'advanced',
  'MONO_AVANCADO': 'advanced',
  'MONO_TOP': 'top',
  'MONO_PREMIUM': 'top',
  // Occupational
  'OCUPACIONAL_BASICO': 'essential',
  'OCUPACIONAL_ESSENTIAL': 'essential',
  'OCUPACIONAL_CONFORTO': 'comfort',
  'OCUPACIONAL_COMFORT': 'comfort',
  'OCUPACIONAL_AVANCADO': 'advanced',
  'OCUPACIONAL_ADVANCED': 'advanced',
  'OCUPACIONAL_TOP': 'top',
  'OCUPACIONAL_PREMIUM': 'top',
  // Bifocal
  'BIFOCAL_BASICO': 'essential',
  'BIFOCAL_ESSENTIAL': 'essential',
  'BIFOCAL_CONFORTO': 'comfort',
  'BIFOCAL_COMFORT': 'comfort',
  'BIFOCAL_AVANCADO': 'advanced',
  'BIFOCAL_ADVANCED': 'advanced',
  'BIFOCAL_TOP': 'top',
  'BIFOCAL_PREMIUM': 'top',
};

// Infer tier from macro name when not in fallback table
function inferTierFromMacroName(macroId: string): 'essential' | 'comfort' | 'advanced' | 'top' {
  const upper = macroId.toUpperCase();
  
  // Check for top/premium tier keywords
  if (upper.includes('TOP') || upper.includes('PREMIUM') || upper.includes('ELITE')) {
    return 'top';
  }
  
  // Check for advanced tier keywords  
  if (upper.includes('AVANCADO') || upper.includes('ADVANCED') || upper.includes('PLUS')) {
    return 'advanced';
  }
  
  // Check for comfort tier keywords
  if (upper.includes('CONFORTO') || upper.includes('COMFORT') || upper.includes('INTER') || upper.includes('ENTRADA')) {
    return 'comfort';
  }
  
  // Default to essential
  return 'essential';
}

// Default index display (fallback)
const DEFAULT_INDEX_DISPLAY: IndexDisplay[] = [
  { value: '1.50', name: 'Padrão', description: 'Espessura normal', aesthetic_score: 1 },
  { value: '1.56', name: 'Leve', description: 'Levemente mais fina', aesthetic_score: 2 },
  { value: '1.59', name: 'Policarbonato', description: 'Resistente a impactos', aesthetic_score: 2 },
  { value: '1.60', name: 'Fina', description: 'Boa estética', aesthetic_score: 3 },
  { value: '1.67', name: 'Mais Fina', description: 'Excelente estética', aesthetic_score: 4 },
  { value: '1.74', name: 'Ultra Fina', description: 'Máxima finura', aesthetic_score: 5 },
];

interface CatalogResolverResult {
  // Core resolvers
  resolveFamilyDisplay: (family: FamilyExtended) => ResolvedFamilyDisplay | null;
  resolveAddonName: (addon: { name_common: string; name_commercial?: Record<string, string> }, supplier: string) => string;
  resolveTechnology: (techId: string) => Technology | null;
  resolveAttributeLabel: (attributeId: string, value: number) => string;
  
  // Tier helpers
  getTierConfig: (macroId: string) => typeof DEFAULT_TIER_CONFIG.essential;
  getTierKey: (macroId: string) => 'essential' | 'comfort' | 'advanced' | 'top';
  getMacroDisplay: (macroId: string) => MacroExtended | null;
  
  // Index helpers
  getIndexDisplay: (indexValue: string) => IndexDisplay;
  getAllIndexDisplays: () => IndexDisplay[];
  
  // Quote generation
  generateQuoteExplanation: (family: FamilyExtended, anamnesis: AnamnesisData) => string[];
  
  // Scale helpers
  getScaleLabels: (scaleId: string) => Record<string, string>;
  scaleToStars: (value: number, maxScale?: number) => number;
  
  // Technology helpers
  getAllTechnologies: () => Technology[];
  getTechnologiesForFamily: (family: FamilyExtended) => Technology[];
  
  // Events
  emitCatalogEvent: (event: CatalogEvent) => void;
  
  // Status
  isLoaded: boolean;
  hasExtendedData: boolean;
}

export const useCatalogResolver = (): CatalogResolverResult => {
  const { 
    macros, 
    families, 
    addons,
    scales,
    attributeDefs, 
    technologyLibrary,
    benefitRules,
    quoteExplainer,
    indexDisplay,
    isDataLoaded 
  } = useLensStore();
  
  // Check if extended data is available
  const hasExtendedData = useMemo(() => {
    return !!(technologyLibrary || benefitRules || quoteExplainer || (indexDisplay && indexDisplay.length > 0));
  }, [technologyLibrary, benefitRules, quoteExplainer, indexDisplay]);
  
  // Build macro lookup map
  const macroMap = useMemo(() => {
    const map = new Map<string, MacroExtended>();
    macros.forEach(macro => {
      map.set(macro.id, macro);
    });
    return map;
  }, [macros]);
  
  // Get tier key from macro ID - reads from JSON first, fallback to hardcoded, then infer
  const getTierKey = useCallback((macroId: string): 'essential' | 'comfort' | 'advanced' | 'top' => {
    const macro = macroMap.get(macroId);
    
    // 1. First check if macro has tier_key in JSON
    if (macro?.tier_key) {
      return macro.tier_key;
    }
    
    // 2. Check hardcoded fallback table
    if (MACRO_TO_TIER_FALLBACK[macroId]) {
      return MACRO_TO_TIER_FALLBACK[macroId];
    }
    
    // 3. Infer from macro name
    const inferred = inferTierFromMacroName(macroId);
    console.log(`[CatalogResolver] Inferred tier '${inferred}' for macro: ${macroId}`);
    return inferred;
  }, [macroMap]);
  
  // Get tier configuration - reads from JSON macro.display first
  const getTierConfig = useCallback((macroId: string) => {
    const macro = macroMap.get(macroId);
    const tierKey = getTierKey(macroId);
    const defaultConfig = DEFAULT_TIER_CONFIG[tierKey];
    
    // If macro has display config from JSON, use it
    if (macro?.display) {
      return {
        label: macro.name_client,
        icon: macro.display.icon,
        colorClass: macro.display.color_class,
        bgHeaderClass: macro.display.bg_header_class,
        borderClass: macro.display.border_class,
        dotColorClass: macro.display.dot_color_class,
        selectedBorderClass: defaultConfig.selectedBorderClass,
      };
    }
    
    // Fallback to default with macro name if available
    return {
      ...defaultConfig,
      label: macro?.name_client || defaultConfig.label,
    };
  }, [macroMap, getTierKey]);
  
  // Get macro display data
  const getMacroDisplay = useCallback((macroId: string): MacroExtended | null => {
    return macroMap.get(macroId) || null;
  }, [macroMap]);
  
  // Get scale labels from JSON scales or benefit_rules, fallback to default
  const getScaleLabels = useCallback((scaleId: string): Record<string, string> => {
    // First try to get from scales in JSON
    if (scales && scales[scaleId]) {
      return scales[scaleId] as Record<string, string>;
    }
    
    // Then try benefit_rules
    if (benefitRules?.rules) {
      const rule = benefitRules.rules.find(r => r.attribute_id === scaleId);
      if (rule?.scale_labels) {
        return rule.scale_labels;
      }
    }
    
    return DEFAULT_SCALE_LABELS;
  }, [scales, benefitRules]);
  
  // Convert 0-3 scale to 1-5 stars
  const scaleToStars = useCallback((value: number, maxScale: number = 3): number => {
    // 0 -> 1, 1 -> 2, 2 -> 4, 3 -> 5
    const mapping = [1, 2, 4, 5];
    return mapping[Math.min(value, maxScale)] || 1;
  }, []);
  
  // Resolve attribute value to human label - reads from benefit_rules
  const resolveAttributeLabel = useCallback((attributeId: string, value: number): string => {
    // Try to find in benefit_rules first
    if (benefitRules?.rules) {
      const rule = benefitRules.rules.find(r => r.attribute_id === attributeId);
      if (rule?.scale_labels) {
        return rule.scale_labels[String(value)] || DEFAULT_SCALE_LABELS[String(value)] || DEFAULT_SCALE_LABELS['0'];
      }
    }
    
    // Fallback to general scale labels
    const labels = getScaleLabels('range_0_3');
    return labels[String(value)] || labels['0'];
  }, [benefitRules, getScaleLabels]);
  
  // Resolve addon name for specific supplier
  const resolveAddonName = useCallback((addon: { name_common: string; name_commercial?: Record<string, string> }, supplier: string): string => {
    return addon.name_commercial?.[supplier] || addon.name_common;
  }, []);
  
  // Resolve technology by ID - reads from technology_library
  const resolveTechnology = useCallback((techId: string): Technology | null => {
    if (!technologyLibrary?.items) return null;
    return technologyLibrary.items[techId] || null;
  }, [technologyLibrary]);
  
  // Get all technologies
  const getAllTechnologies = useCallback((): Technology[] => {
    if (!technologyLibrary?.items) return [];
    return Object.values(technologyLibrary.items);
  }, [technologyLibrary]);
  
  // Get technologies for a family with anti-duplication logic
  // Prevents duplicate "Base" technologies when family already has one
  const getTechnologiesForFamily = useCallback((family: FamilyExtended, options?: { 
    includeAutoBase?: boolean; 
    clinicalType?: ClinicalType 
  }): Technology[] => {
    const techRefs = family.technology_refs || [];
    const techLib = technologyLibrary?.items || {};
    
    // Resolve technologies from family.technology_refs
    const resolvedTechs = techRefs
      .map(ref => techLib[ref])
      .filter(Boolean) as Technology[];
    
    // Check if auto-base should be added
    if (!options?.includeAutoBase) {
      return resolvedTechs;
    }
    
    // Anti-duplication: Check if any "Base" technology already exists
    const hasBaseTech = resolvedTechs.some(tech => 
      tech.group === 'Base' || 
      tech.name_common.toLowerCase().startsWith('base ')
    );
    
    // If base already exists, don't add auto-base
    if (hasBaseTech) {
      return resolvedTechs;
    }
    
    // Generate auto-base tech ID based on clinical type
    const clinicalType = options.clinicalType || family.category;
    const autoBaseTechId = `BASE_${clinicalType}`;
    const autoBaseTech = techLib[autoBaseTechId];
    
    // If auto-base tech exists in library and not already in list, prepend it
    if (autoBaseTech && !techRefs.includes(autoBaseTechId)) {
      return [autoBaseTech, ...resolvedTechs];
    }
    
    return resolvedTechs;
  }, [technologyLibrary]);
  
  // Get index display configuration - reads from JSON first
  const getIndexDisplay = useCallback((indexValue: string): IndexDisplay => {
    // Use JSON index_display if available
    const displays = indexDisplay && indexDisplay.length > 0 ? indexDisplay : DEFAULT_INDEX_DISPLAY;
    const found = displays.find(i => i.value === indexValue);
    return found || { value: indexValue, name: indexValue, description: '', aesthetic_score: 1 };
  }, [indexDisplay]);
  
  // Get all index displays
  const getAllIndexDisplays = useCallback((): IndexDisplay[] => {
    return indexDisplay && indexDisplay.length > 0 ? indexDisplay : DEFAULT_INDEX_DISPLAY;
  }, [indexDisplay]);
  
  // Resolve complete family display data
  const resolveFamilyDisplay = useCallback((family: FamilyExtended): ResolvedFamilyDisplay | null => {
    const macro = macroMap.get(family.macro);
    if (!macro) return null;
    
    const tierConfig = getTierConfig(family.macro);
    
    // Resolve technologies from family.technology_refs
    const technologies = getTechnologiesForFamily(family);
    
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
      family,
      macro,
      technologies,
      attributeLabels,
      tierConfig,
    };
  }, [macroMap, attributeDefs, getTierConfig, getTechnologiesForFamily, resolveAttributeLabel, scaleToStars]);
  
  // Generate quote explanation based on anamnesis - uses quote_explainer from JSON
  const generateQuoteExplanation = useCallback((
    family: FamilyExtended, 
    anamnesis: AnamnesisData
  ): string[] => {
    const paragraphs: string[] = [];
    const macro = macroMap.get(family.macro);
    
    // Try to use quote_explainer rules from JSON
    if (quoteExplainer?.rules && quoteExplainer.rules.length > 0) {
      // Add intro template
      if (quoteExplainer.intro_templates?.length > 0) {
        const introTemplate = quoteExplainer.intro_templates[0];
        paragraphs.push(
          introTemplate
            .replace('{product_name}', family.name_original)
            .replace('{category}', macro?.name_client || 'padrão')
        );
      }
      
      // Evaluate each rule
      const sortedRules = [...quoteExplainer.rules].sort((a, b) => a.priority - b.priority);
      
      for (const rule of sortedRules) {
        const conditionsMet = rule.conditions.every(condition => {
          const fieldValue = (anamnesis as any)[condition.field];
          
          switch (condition.operator) {
            case 'equals':
              return fieldValue === condition.value;
            case 'in':
              return Array.isArray(condition.value) && condition.value.includes(fieldValue);
            case 'greater_than':
              // Handle screen hours specially
              if (condition.field === 'screenHours') {
                const hoursMap: Record<string, number> = { '0-2': 1, '3-5': 4, '6-8': 7, '8+': 9 };
                return (hoursMap[fieldValue] || 0) > (condition.value as number);
              }
              return typeof fieldValue === 'number' && fieldValue > (condition.value as number);
            case 'less_than':
              return typeof fieldValue === 'number' && fieldValue < (condition.value as number);
            default:
              return false;
          }
        });
        
        if (conditionsMet) {
          paragraphs.push(
            rule.template
              .replace('{product_name}', family.name_original)
              .replace('{screenHours}', anamnesis.screenHours || '')
              .replace('{category}', macro?.name_client || 'padrão')
          );
        }
      }
      
      // Add closing template
      if (quoteExplainer.closing_templates?.length > 0 && paragraphs.length > 1) {
        paragraphs.push(quoteExplainer.closing_templates[0]);
      }
      
      if (paragraphs.length > 0) {
        return paragraphs;
      }
    }
    
    // Fallback to hardcoded logic if no quote_explainer
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
  }, [macroMap, quoteExplainer]);
  
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
    getAllTechnologies,
    getTechnologiesForFamily,
    emitCatalogEvent,
    isLoaded: isDataLoaded,
    hasExtendedData,
  };
};