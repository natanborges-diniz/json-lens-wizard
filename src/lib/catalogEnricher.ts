/**
 * CatalogEnricher - Runtime enrichment layer for catalog data
 * 
 * v3.6.2.2: NO INFERENCE FROM TEXT/DESCRIPTION.
 * All addons_detected and index_value come from the catalog JSON directly.
 * 
 * Implements enrichment WITHOUT modifying the original JSON:
 * - LAYER A: View Fields (display_name, display_subtitle, display_description, treatment_labels)
 * - LAYER B: Availability Migration (specs -> availability, safe defaults)
 * - LAYER C: Knowledge Generation (consumer/consultant text, sales_pills)
 * 
 * REMOVED: Layer D (regex-based addon inference) - PROHIBITED per v3.6.2.2
 * 
 * ZERO CREATION POLICY: No new SKUs, families, or products are created.
 */

import type { 
  FamilyExtended, 
  Price, 
  ClinicalType,
  TechnologyLibrary,
  Technology
} from '@/types/lens';

// ============================================================================
// TYPES
// ============================================================================

export interface EnrichedFamily extends FamilyExtended {
  display_name: string;
  display_subtitle: string;
  knowledge: {
    consumer: string;
    consultant: string[];
  };
  sales_pills: string[];
}

export interface EnrichedPrice extends Price {
  display_description: string;
  treatment_labels: Record<string, string>;
  availability_enriched: {
    sphere: { min: number; max: number };
    cylinder: { min: number; max: number };
    addition?: { min: number; max: number };
    diameters_mm?: number[];
  };
  flags: Record<string, boolean>;
}

// ============================================================================
// LAYER A: VIEW FIELDS
// ============================================================================

// Clinical type friendly names
const CLINICAL_TYPE_LABELS: Record<string, string> = {
  'MONOFOCAL': 'Monofocal',
  'PROGRESSIVA': 'Progressiva',
  'OCUPACIONAL': 'Ocupacional',
  'BIFOCAL': 'Bifocal',
};

// Tier friendly names
const TIER_LABELS: Record<string, string> = {
  'essential': 'Essential',
  'comfort': 'Conforto',
  'advanced': 'Avançada',
  'top': 'Top de Mercado',
};

/**
 * LAYER A.1: Get display_name for family
 * v3.6.2.5: Use display_name_short → display_name → name_original. 
 * NO inference, NO title-case, NO abbreviation expansion.
 */
export function generateFamilyDisplayName(family: FamilyExtended): string {
  if (family.display_name_short) return family.display_name_short;
  if (family.display_name) return family.display_name;
  if (family.family_name_commercial) return family.family_name_commercial;
  if (family.name_original) return family.name_original;
  return family.id;
}

/**
 * LAYER A.2: Generate display_subtitle for family
 * v3.6.2.5: Use catalog's display_subtitle directly. NO formatting.
 */
export function generateFamilyDisplaySubtitle(
  family: FamilyExtended, 
  tierKey: 'essential' | 'comfort' | 'advanced' | 'top'
): string {
  if (family.display_subtitle) return family.display_subtitle;
  
  const clinicalType = family.clinical_type || family.category;
  const clinicalLabel = CLINICAL_TYPE_LABELS[clinicalType] || clinicalType;
  const tierLabel = TIER_LABELS[tierKey] || tierKey;
  return `${clinicalLabel} · ${tierLabel} · ${family.supplier}`;
}

/**
 * LAYER A.3: Generate display_description for SKU/Price
 * v3.6.2.2: Uses index_value and addons_detected directly. No inference from description.
 */
export function generatePriceDisplayDescription(
  price: Price,
  family: FamilyExtended | undefined
): string {
  const clinicalType = price.clinical_type || family?.clinical_type || family?.category || 'MONOFOCAL';
  const clinicalLabel = CLINICAL_TYPE_LABELS[clinicalType] || clinicalType;
  
  // v3.6.2.2: Use index_value
  const index = (price as any).index_value != null 
    ? String((price as any).index_value) 
    : ((price as any).availability?.index || price.index || '1.50');
  
  // v3.6.2.2: Use addons_detected directly (no inference)
  const addons = (price.addons_detected || [])
    .map(id => id.replace(/^ADDON_/, '').replace(/_/g, ' '))
    .slice(0, 3);
  
  let description = `${clinicalLabel} ${index}`;
  if (addons.length > 0) {
    description += ` com ${addons.join(' + ')}`;
  }
  return description;
}

/**
 * LAYER A.4: Generate treatment_labels map for SKU
 */
export function generateTreatmentLabels(price: Price): Record<string, string> {
  const labels: Record<string, string> = {};
  
  // v3.6.2.2: Only from addons_detected (no inference)
  if (price.addons_detected) {
    price.addons_detected.forEach(addon => {
      labels[addon] = addon.replace(/^ADDON_/, '').replace(/_/g, ' ');
    });
  }
  
  return labels;
}

// ============================================================================
// LAYER B: AVAILABILITY MIGRATION
// ============================================================================

const AVAILABILITY_DEFAULTS: Record<ClinicalType, {
  sphere: { min: number; max: number };
  cylinder: { min: number; max: number };
  addition?: { min: number; max: number };
}> = {
  'MONOFOCAL': { sphere: { min: -10, max: 10 }, cylinder: { min: -6, max: 0 } },
  'PROGRESSIVA': { sphere: { min: -8, max: 8 }, cylinder: { min: -4, max: 0 }, addition: { min: 0.75, max: 3.50 } },
  'OCUPACIONAL': { sphere: { min: -8, max: 8 }, cylinder: { min: -4, max: 0 }, addition: { min: 0.75, max: 2.50 } },
  'BIFOCAL': { sphere: { min: -8, max: 8 }, cylinder: { min: -3, max: 0 }, addition: { min: 0.75, max: 3.50 } },
};

export function enrichAvailability(
  price: Price,
  clinicalType: ClinicalType
): {
  availability: EnrichedPrice['availability_enriched'];
  flags: Record<string, boolean>;
} {
  const flags: Record<string, boolean> = { ...(price.flags || {}) };
  
  const existingAvailability = (price as any).availability;
  if (existingAvailability?.sphere) {
    // v3.6.2.2: null min/max means unrestricted - use safe defaults
    const sphereMin = existingAvailability.sphere.min;
    const sphereMax = existingAvailability.sphere.max;
    const defaults = AVAILABILITY_DEFAULTS[clinicalType] || AVAILABILITY_DEFAULTS['MONOFOCAL'];
    
    return {
      availability: {
        sphere: { 
          min: sphereMin != null ? sphereMin : defaults.sphere.min, 
          max: sphereMax != null ? sphereMax : defaults.sphere.max 
        },
        cylinder: { 
          min: existingAvailability.cylinder?.min != null ? existingAvailability.cylinder.min : defaults.cylinder.min, 
          max: existingAvailability.cylinder?.max != null ? existingAvailability.cylinder.max : defaults.cylinder.max 
        },
        addition: existingAvailability.addition?.min != null 
          ? existingAvailability.addition 
          : defaults.addition,
        diameters_mm: existingAvailability.diameters_mm,
      },
      flags: sphereMin == null ? { ...flags, availability_defaulted: true } : flags,
    };
  }
  
  // Legacy specs
  const specs = price.specs;
  if (specs && specs.sphere_min !== undefined) {
    const diameters: number[] = [];
    if (specs.diameter_min_mm && specs.diameter_max_mm) {
      for (let d = specs.diameter_min_mm; d <= specs.diameter_max_mm; d += 5) diameters.push(d);
    }
    return {
      availability: {
        sphere: { min: specs.sphere_min, max: specs.sphere_max },
        cylinder: { min: specs.cyl_min, max: specs.cyl_max },
        addition: specs.add_min !== undefined ? { min: specs.add_min, max: specs.add_max! } : undefined,
        diameters_mm: diameters.length > 0 ? diameters : undefined,
      },
      flags: { ...flags, availability_migrated: true },
    };
  }
  
  // Safe defaults
  const defaults = AVAILABILITY_DEFAULTS[clinicalType] || AVAILABILITY_DEFAULTS['MONOFOCAL'];
  return {
    availability: { sphere: defaults.sphere, cylinder: defaults.cylinder, addition: defaults.addition },
    flags: { ...flags, availability_defaulted: true },
  };
}

// ============================================================================
// LAYER C: KNOWLEDGE GENERATION
// ============================================================================

const TIER_KNOWLEDGE_TEMPLATES: Record<string, {
  consumer: string;
  consultant: string[];
  pills: string[];
}> = {
  essential: {
    consumer: 'Uma lente de entrada com boa qualidade óptica para uso diário. Oferece correção visual confiável com custo acessível.',
    consultant: ['Posicionamento: entrada de linha, foco em custo-benefício', 'Indicação: usuários com prescrições simples a moderadas'],
    pills: ['Custo-benefício', 'Qualidade óptica básica', 'Uso diário'],
  },
  comfort: {
    consumer: 'Uma lente intermediária que combina conforto visual com tecnologia aprimorada.',
    consultant: ['Posicionamento: intermediário, equilíbrio qualidade/preço', 'Indicação: usuários que valorizam conforto'],
    pills: ['Conforto visual', 'Adaptação facilitada', 'Tecnologia intermediária'],
  },
  advanced: {
    consumer: 'Uma lente de alta tecnologia com campos de visão ampliados e melhor adaptação.',
    consultant: ['Posicionamento: premium, alta performance', 'Indicação: usuários exigentes'],
    pills: ['Alta tecnologia', 'Campos ampliados', 'Adaptação rápida'],
  },
  top: {
    consumer: 'A lente mais avançada disponível, com a melhor tecnologia do mercado.',
    consultant: ['Posicionamento: topo de linha', 'Indicação: usuários que exigem o melhor'],
    pills: ['Máxima tecnologia', 'Campos expandidos', 'Personalização total'],
  },
};

const CLINICAL_INTRO: Record<ClinicalType, string> = {
  'MONOFOCAL': 'Esta é uma lente de visão simples',
  'PROGRESSIVA': 'Esta é uma lente progressiva multifocal',
  'OCUPACIONAL': 'Esta é uma lente ocupacional para perto e intermediário',
  'BIFOCAL': 'Esta é uma lente bifocal com dois campos de visão',
};

export function generateKnowledge(
  family: FamilyExtended,
  tierKey: 'essential' | 'comfort' | 'advanced' | 'top',
  technologyLibrary: TechnologyLibrary | null
): {
  consumer: string;
  consultant: string[];
  sales_pills: string[];
} {
  const technologies = resolveTechnologies(family.technology_refs || [], technologyLibrary);
  const clinicalType = family.clinical_type || family.category;
  const tierTemplate = TIER_KNOWLEDGE_TEMPLATES[tierKey] || TIER_KNOWLEDGE_TEMPLATES.essential;
  
  if (technologies.length === 0) {
    const clinicalIntro = CLINICAL_INTRO[clinicalType] || CLINICAL_INTRO['MONOFOCAL'];
    return {
      consumer: `${clinicalIntro} da categoria ${TIER_LABELS[tierKey]}. ${tierTemplate.consumer}`,
      consultant: tierTemplate.consultant,
      sales_pills: tierTemplate.pills,
    };
  }
  
  const consumerParts: string[] = [];
  const consultantParts: string[] = [];
  const pills: string[] = [];
  
  const clinicalIntro = CLINICAL_INTRO[clinicalType] || CLINICAL_INTRO['MONOFOCAL'];
  consumerParts.push(`${clinicalIntro} ${generateFamilyDisplayName(family)} da ${family.supplier}.`);
  
  technologies.forEach(tech => {
    if (tech.description_short) consumerParts.push(tech.description_short);
    if (tech.benefits && tech.benefits.length > 0) {
      pills.push(...tech.benefits.slice(0, 2));
      consultantParts.push(`${tech.name_common}: ${tech.benefits.join(', ')}`);
    }
  });
  
  consultantParts.push(`Categoria: ${TIER_LABELS[tierKey]} - ${tierTemplate.consultant[0]}`);
  
  const uniquePills = [...new Set(pills)].slice(0, 5);
  if (uniquePills.length < 3) {
    tierTemplate.pills.forEach(pill => {
      if (uniquePills.length < 5 && !uniquePills.includes(pill)) uniquePills.push(pill);
    });
  }
  
  return { consumer: consumerParts.join(' '), consultant: consultantParts, sales_pills: uniquePills };
}

function resolveTechnologies(refs: string[], library: TechnologyLibrary | null): Technology[] {
  if (!library?.items || refs.length === 0) return [];
  return refs.map(ref => library.items[ref]).filter((tech): tech is Technology => tech !== undefined);
}

// ============================================================================
// MAIN ENRICHMENT FUNCTIONS
// ============================================================================

export function enrichFamily(
  family: FamilyExtended,
  tierKey: 'essential' | 'comfort' | 'advanced' | 'top',
  technologyLibrary: TechnologyLibrary | null
): EnrichedFamily {
  const knowledge = generateKnowledge(family, tierKey, technologyLibrary);
  
  return {
    ...family,
    display_name: generateFamilyDisplayName(family),
    display_subtitle: generateFamilyDisplaySubtitle(family, tierKey),
    knowledge: { consumer: knowledge.consumer, consultant: knowledge.consultant },
    sales_pills: knowledge.sales_pills,
  };
}

export function enrichPrice(
  price: Price,
  family: FamilyExtended | undefined
): EnrichedPrice {
  const clinicalType: ClinicalType = price.clinical_type || family?.clinical_type || family?.category || 'MONOFOCAL';
  const { availability, flags } = enrichAvailability(price, clinicalType);
  
  return {
    ...price,
    display_description: generatePriceDisplayDescription(price, family),
    treatment_labels: generateTreatmentLabels(price),
    availability_enriched: availability,
    flags,
  };
}

export function enrichFamilies(
  families: FamilyExtended[],
  getTierKey: (macroId: string) => 'essential' | 'comfort' | 'advanced' | 'top',
  technologyLibrary: TechnologyLibrary | null
): EnrichedFamily[] {
  return families.map(family => enrichFamily(family, getTierKey(family.macro), technologyLibrary));
}

/**
 * Batch enrich all prices with family context
 * v3.6.2.2: NO INFERENCE. Uses addons_detected and index_value as-is from catalog.
 */
export function enrichPrices(
  prices: Price[],
  familiesMap: Map<string, FamilyExtended>
): EnrichedPrice[] {
  return prices.map(price => enrichPrice(price, familiesMap.get(price.family_id)));
}

/**
 * Create a presentation overlay (for optional export)
 */
export function createPresentationOverlay(
  families: EnrichedFamily[],
  prices: EnrichedPrice[]
) {
  const familiesOverlay: Record<string, any> = {};
  const pricesOverlay: Record<string, any> = {};
  
  families.forEach(f => {
    familiesOverlay[f.id] = {
      display_name: f.display_name,
      display_subtitle: f.display_subtitle,
      knowledge: f.knowledge,
      sales_pills: f.sales_pills,
    };
  });
  
  prices.forEach(p => {
    pricesOverlay[p.erp_code] = {
      display_description: p.display_description,
      treatment_labels: p.treatment_labels,
    };
  });
  
  return {
    version: '1.0',
    generated_at: new Date().toISOString(),
    families: familiesOverlay,
    prices: pricesOverlay,
  };
}
