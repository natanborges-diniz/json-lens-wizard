/**
 * CatalogEnricher - Runtime enrichment layer for catalog data
 * 
 * Implements 3 layers of enrichment WITHOUT modifying the original JSON:
 * - LAYER A: View Fields (display_name, display_subtitle, display_description, treatment_labels)
 * - LAYER B: Availability Migration (specs -> availability, safe defaults)
 * - LAYER C: Knowledge Generation (consumer/consultant text, sales_pills)
 * 
 * ZERO CREATION POLICY: No new SKUs, families, or products are created.
 * Only display/presentation fields are generated.
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

// Treatment ID to friendly label mapping
const TREATMENT_LABEL_MAP: Record<string, string> = {
  // Antireflexo
  'AR': 'Antirreflexo',
  'AR_PREMIUM': 'Antirreflexo Premium',
  'AR_BASICO': 'Antirreflexo Básico',
  'MEIRYO': 'Antirreflexo Premium (Meiryo)',
  'CRIZAL': 'Antirreflexo Crizal',
  'CRIZAL_EASY': 'Antirreflexo Crizal Easy',
  'CRIZAL_SAPPHIRE': 'Antirreflexo Crizal Sapphire',
  'CRIZAL_PREVENCIA': 'Antirreflexo Crizal Prevencia',
  'CRIZAL_ROCK': 'Antirreflexo Crizal Rock',
  'DURAVISION': 'Antirreflexo DuraVision',
  'DURAVISION_PLATINUM': 'Antirreflexo DuraVision Platinum',
  'DURAVISION_SILVER': 'Antirreflexo DuraVision Silver',
  'HICOAT': 'Antirreflexo Hi-Coat',
  'SUPER_HI_VISION': 'Antirreflexo Super Hi-Vision',
  'CLEANCOAT': 'Antirreflexo CleanCoat',
  'LR': 'Antirreflexo LR',
  'LONGLIFE': 'Antirreflexo LongLife',
  'NORISK': 'Antirreflexo NoRisk',
  'NORISC': 'Antirreflexo NoRisk',
  
  // Filtro de luz azul
  'BLUE': 'Filtro de Luz Azul',
  'BLUEGUARD': 'Filtro BlueGuard',
  'BLUECONTROL': 'Filtro BlueControl',
  'BLUE_UV_FILTER': 'Filtro Blue UV',
  'BLUE_CUT': 'Filtro Blue Cut',
  'LONGBLUE': 'Filtro LongBlue',
  'PREVENCIA': 'Proteção Luz Azul (Prevencia)',
  'EPS': 'Proteção EPS',
  
  // Fotossensível
  'FOTO': 'Fotossensível',
  'PHOTOCHROMIC': 'Fotossensível',
  'TRANSITIONS': 'Transitions',
  'TRANSITIONS_GEN8': 'Transitions Gen 8',
  'TRANSITIONS_XTRACTIVE': 'Transitions XTRActive',
  'SENSITY': 'Fotossensível Sensity',
  'SENSITY_DARK': 'Sensity Dark',
  'SENSITY_SHINE': 'Sensity Shine',
  'PHOTOFUSION': 'PhotoFusion',
  'PHOTOFUSION_X': 'PhotoFusion X',
  'ACCLIMATES': 'Acclimates',
  
  // Polarizado
  'POLARIZADO': 'Polarizado',
  'POLARIZED': 'Polarizado',
  'DRIVEWEAR': 'DriveWear (Polarizado)',
  'XPERIO': 'Xperio (Polarizado)',
  
  // Proteção UV
  'UV': 'Proteção UV',
  'UV400': 'Proteção UV 400',
  
  // Materiais
  'POLI': 'Policarbonato',
  'POLICARBONATO': 'Policarbonato',
  'TRIVEX': 'Trivex',
  'RESINA': 'Resina',
  'CRISTAL': 'Cristal',
  
  // Colorações
  'COLORIDO': 'Colorido',
  'SOLID': 'Cor Sólida',
  'GRADIENT': 'Cor Degradê',
  'MIRROR': 'Espelhado',
};

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
 * Transform technical family ID to human-readable name
 * Example: "ZEISS_PRECISION_PURE" -> "Precision Pure"
 */
function humanizeFamilyId(id: string): string {
  // Remove common supplier prefixes
  const supplierPrefixes = ['ZEISS_', 'ESSILOR_', 'HOYA_', 'RODENSTOCK_', 'TOKAI_', 'VARILUX_'];
  let cleanId = id;
  
  for (const prefix of supplierPrefixes) {
    if (cleanId.startsWith(prefix)) {
      cleanId = cleanId.substring(prefix.length);
      break;
    }
  }
  
  // Replace underscores with spaces and capitalize properly
  return cleanId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * LAYER A.1: Generate display_name for family
 */
export function generateFamilyDisplayName(family: FamilyExtended): string {
  // Priority 1: Use existing commercial name if available
  if ((family as any).family_name_commercial) {
    return (family as any).family_name_commercial;
  }
  
  // Priority 2: Use name_original if it looks commercial (not all caps with underscores)
  if (family.name_original && !family.name_original.includes('_') && !/^[A-Z\s]+$/.test(family.name_original)) {
    return family.name_original;
  }
  
  // Priority 3: Transform ID to human-readable
  return humanizeFamilyId(family.id);
}

/**
 * LAYER A.2: Generate display_subtitle for family
 * Format: "Clinical Type · Tier · Supplier"
 */
export function generateFamilyDisplaySubtitle(
  family: FamilyExtended, 
  tierKey: 'essential' | 'comfort' | 'advanced' | 'top'
): string {
  const clinicalType = family.clinical_type || family.category;
  const clinicalLabel = CLINICAL_TYPE_LABELS[clinicalType] || clinicalType;
  const tierLabel = TIER_LABELS[tierKey] || tierKey;
  
  return `${clinicalLabel} · ${tierLabel} · ${family.supplier}`;
}

/**
 * LAYER A.3: Generate display_description for SKU/Price
 * Derives from SKU data: clinical_type + index + treatments
 */
export function generatePriceDisplayDescription(
  price: Price,
  family: FamilyExtended | undefined
): string {
  const clinicalType = price.clinical_type || family?.clinical_type || family?.category || 'MONOFOCAL';
  const clinicalLabel = CLINICAL_TYPE_LABELS[clinicalType] || clinicalType;
  
  // Get index (new schema: availability.index, old: price.index)
  const index = (price as any).availability?.index || price.index || '1.50';
  
  // Collect treatments
  const treatments: string[] = [];
  
  // From treatments_raw
  if (price.treatments_raw) {
    Object.keys(price.treatments_raw).forEach(key => {
      const label = resolveTreatmentLabel(key, price.treatments_raw![key]);
      if (label) treatments.push(label);
    });
  }
  
  // From addons_detected
  if (price.addons_detected && price.addons_detected.length > 0) {
    price.addons_detected.forEach(addon => {
      const label = resolveTreatmentLabel(addon);
      if (label && !treatments.some(t => t.includes(label))) {
        treatments.push(label);
      }
    });
  }
  
  // Build description
  let description = `${clinicalLabel} ${index}`;
  
  if (treatments.length > 0) {
    description += ` com ${treatments.slice(0, 3).join(' + ')}`;
    if (treatments.length > 3) {
      description += ` +${treatments.length - 3}`;
    }
  }
  
  return description;
}

/**
 * LAYER A.4: Generate treatment_labels map for SKU
 */
export function generateTreatmentLabels(price: Price): Record<string, string> {
  const labels: Record<string, string> = {};
  
  // From treatments_raw
  if (price.treatments_raw) {
    Object.entries(price.treatments_raw).forEach(([key, value]) => {
      labels[key] = resolveTreatmentLabel(key, value) || value;
    });
  }
  
  // From addons_detected
  if (price.addons_detected) {
    price.addons_detected.forEach(addon => {
      if (!labels[addon]) {
        labels[addon] = resolveTreatmentLabel(addon) || addon;
      }
    });
  }
  
  return labels;
}

/**
 * Resolve a treatment key/value to a friendly label
 */
function resolveTreatmentLabel(key: string, value?: string): string {
  const upperKey = key.toUpperCase();
  
  // Direct match in label map
  if (TREATMENT_LABEL_MAP[upperKey]) {
    return TREATMENT_LABEL_MAP[upperKey];
  }
  
  // Check if value is in label map
  if (value) {
    const upperValue = value.toUpperCase();
    if (TREATMENT_LABEL_MAP[upperValue]) {
      return TREATMENT_LABEL_MAP[upperValue];
    }
    
    // Return formatted value if not found
    return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
  }
  
  // Partial matches
  for (const [mapKey, label] of Object.entries(TREATMENT_LABEL_MAP)) {
    if (upperKey.includes(mapKey) || mapKey.includes(upperKey)) {
      return label;
    }
  }
  
  // Fallback: humanize the key
  return key.charAt(0).toUpperCase() + key.slice(1).toLowerCase().replace(/_/g, ' ');
}

// ============================================================================
// LAYER B: AVAILABILITY MIGRATION
// ============================================================================

// Safe defaults by clinical type (for when no specs/availability exist)
const AVAILABILITY_DEFAULTS: Record<ClinicalType, {
  sphere: { min: number; max: number };
  cylinder: { min: number; max: number };
  addition?: { min: number; max: number };
}> = {
  'MONOFOCAL': {
    sphere: { min: -10, max: 10 },
    cylinder: { min: -6, max: 0 },
  },
  'PROGRESSIVA': {
    sphere: { min: -8, max: 8 },
    cylinder: { min: -4, max: 0 },
    addition: { min: 0.75, max: 3.50 },
  },
  'OCUPACIONAL': {
    sphere: { min: -8, max: 8 },
    cylinder: { min: -4, max: 0 },
    addition: { min: 0.75, max: 2.50 },
  },
  'BIFOCAL': {
    sphere: { min: -8, max: 8 },
    cylinder: { min: -3, max: 0 },
    addition: { min: 0.75, max: 3.50 },
  },
};

/**
 * LAYER B: Migrate specs to availability format or apply safe defaults
 * Returns enriched availability + flags
 */
export function enrichAvailability(
  price: Price,
  clinicalType: ClinicalType
): {
  availability: EnrichedPrice['availability_enriched'];
  flags: Record<string, boolean>;
} {
  const flags: Record<string, boolean> = { ...price.flags };
  
  // Check if already has availability (new schema)
  const existingAvailability = (price as any).availability;
  if (existingAvailability?.sphere?.min !== undefined) {
    return {
      availability: {
        sphere: existingAvailability.sphere,
        cylinder: existingAvailability.cylinder || { min: -6, max: 0 },
        addition: existingAvailability.addition,
        diameters_mm: existingAvailability.diameters_mm,
      },
      flags,
    };
  }
  
  // Check if has specs (old schema) - migrate
  const specs = price.specs;
  if (specs && specs.sphere_min !== undefined) {
    // Generate diameters from range
    const diameters: number[] = [];
    if (specs.diameter_min_mm && specs.diameter_max_mm) {
      for (let d = specs.diameter_min_mm; d <= specs.diameter_max_mm; d += 5) {
        diameters.push(d);
      }
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
  
  // No specs/availability - apply safe defaults
  const defaults = AVAILABILITY_DEFAULTS[clinicalType] || AVAILABILITY_DEFAULTS['MONOFOCAL'];
  
  return {
    availability: {
      sphere: defaults.sphere,
      cylinder: defaults.cylinder,
      addition: defaults.addition,
    },
    flags: { ...flags, availability_defaulted: true },
  };
}

// ============================================================================
// LAYER C: KNOWLEDGE GENERATION
// ============================================================================

// Tier-based generic descriptions (when no technology_refs)
const TIER_KNOWLEDGE_TEMPLATES: Record<string, {
  consumer: string;
  consultant: string[];
  pills: string[];
}> = {
  essential: {
    consumer: 'Uma lente de entrada com boa qualidade óptica para uso diário. Oferece correção visual confiável com custo acessível.',
    consultant: [
      'Posicionamento: entrada de linha, foco em custo-benefício',
      'Indicação: usuários com prescrições simples a moderadas',
      'Argumento: qualidade óptica básica garantida pelo fabricante',
      'Contra-objeção: ideal para quem busca funcionalidade sem investimento alto',
    ],
    pills: [
      'Custo-benefício',
      'Qualidade óptica básica',
      'Uso diário',
    ],
  },
  comfort: {
    consumer: 'Uma lente intermediária que combina conforto visual com tecnologia aprimorada. Ideal para quem busca mais qualidade sem investir no topo de linha.',
    consultant: [
      'Posicionamento: intermediário, equilíbrio qualidade/preço',
      'Indicação: usuários que valorizam conforto e passam tempo em atividades variadas',
      'Argumento: melhor adaptação e campos de visão ampliados vs. essencial',
      'Diferencial: tecnologias de conforto inclusas (ex: digital, anti-fadiga)',
    ],
    pills: [
      'Conforto visual',
      'Adaptação facilitada',
      'Tecnologia intermediária',
      'Bom custo-benefício',
    ],
  },
  advanced: {
    consumer: 'Uma lente de alta tecnologia com campos de visão ampliados e melhor adaptação. Projetada para usuários exigentes que precisam de performance em diversas situações.',
    consultant: [
      'Posicionamento: premium, alta performance',
      'Indicação: usuários exigentes, prescrições complexas, múltiplas atividades',
      'Argumento: campos de visão significativamente maiores, adaptação mais rápida',
      'Diferencial: tecnologias exclusivas de personalização e conforto digital',
      'Contra-objeção: investimento justificado pela qualidade visual superior',
    ],
    pills: [
      'Alta tecnologia',
      'Campos ampliados',
      'Adaptação rápida',
      'Performance premium',
    ],
  },
  top: {
    consumer: 'A lente mais avançada disponível, com a melhor tecnologia do mercado. Oferece a máxima qualidade visual, campos de visão expandidos e conforto excepcional em qualquer situação.',
    consultant: [
      'Posicionamento: topo de linha, referência do mercado',
      'Indicação: usuários que exigem o melhor, sem compromisso de preço',
      'Argumento: tecnologia de ponta, personalização máxima, garantia estendida',
      'Diferencial: exclusividades do fabricante, menor taxa de inadaptação',
      'Contra-objeção: investimento em qualidade de vida visual duradoura',
    ],
    pills: [
      'Máxima tecnologia',
      'Campos expandidos',
      'Personalização total',
      'Conforto excepcional',
      'Referência do mercado',
    ],
  },
};

// Clinical type specific intro
const CLINICAL_INTRO: Record<ClinicalType, string> = {
  'MONOFOCAL': 'Esta é uma lente de visão simples',
  'PROGRESSIVA': 'Esta é uma lente progressiva multifocal',
  'OCUPACIONAL': 'Esta é uma lente ocupacional para perto e intermediário',
  'BIFOCAL': 'Esta é uma lente bifocal com dois campos de visão',
};

/**
 * LAYER C: Generate knowledge texts based on technology_refs
 */
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
  
  // If no technologies, return tier-based generic
  if (technologies.length === 0) {
    const clinicalIntro = CLINICAL_INTRO[clinicalType] || CLINICAL_INTRO['MONOFOCAL'];
    
    return {
      consumer: `${clinicalIntro} da categoria ${TIER_LABELS[tierKey]}. ${tierTemplate.consumer}`,
      consultant: tierTemplate.consultant,
      sales_pills: tierTemplate.pills,
    };
  }
  
  // Build from technologies
  const consumerParts: string[] = [];
  const consultantParts: string[] = [];
  const pills: string[] = [];
  
  // Intro
  const clinicalIntro = CLINICAL_INTRO[clinicalType] || CLINICAL_INTRO['MONOFOCAL'];
  consumerParts.push(`${clinicalIntro} ${generateFamilyDisplayName(family)} da ${family.supplier}.`);
  
  // Add technology descriptions
  technologies.forEach(tech => {
    if (tech.description_short) {
      consumerParts.push(tech.description_short);
    }
    
    if (tech.benefits && tech.benefits.length > 0) {
      pills.push(...tech.benefits.slice(0, 2));
      consultantParts.push(`${tech.name_common}: ${tech.benefits.join(', ')}`);
    }
  });
  
  // Add tier context
  consultantParts.push(`Categoria: ${TIER_LABELS[tierKey]} - ${tierTemplate.consultant[0]}`);
  
  // Deduplicate pills
  const uniquePills = [...new Set(pills)].slice(0, 5);
  
  // If not enough pills, add from tier template
  if (uniquePills.length < 3) {
    tierTemplate.pills.forEach(pill => {
      if (uniquePills.length < 5 && !uniquePills.includes(pill)) {
        uniquePills.push(pill);
      }
    });
  }
  
  return {
    consumer: consumerParts.join(' '),
    consultant: consultantParts,
    sales_pills: uniquePills,
  };
}

/**
 * Resolve technology references to Technology objects
 */
function resolveTechnologies(
  refs: string[],
  library: TechnologyLibrary | null
): Technology[] {
  if (!library?.items || refs.length === 0) return [];
  
  return refs
    .map(ref => library.items[ref])
    .filter((tech): tech is Technology => tech !== undefined);
}

// ============================================================================
// MAIN ENRICHMENT FUNCTIONS
// ============================================================================

/**
 * Enrich a family with all Layer A + C fields
 */
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
    knowledge: {
      consumer: knowledge.consumer,
      consultant: knowledge.consultant,
    },
    sales_pills: knowledge.sales_pills,
  };
}

/**
 * Enrich a price/SKU with all Layer A + B fields
 */
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

/**
 * Batch enrich all families
 */
export function enrichFamilies(
  families: FamilyExtended[],
  getTierKey: (macroId: string) => 'essential' | 'comfort' | 'advanced' | 'top',
  technologyLibrary: TechnologyLibrary | null
): EnrichedFamily[] {
  return families.map(family => 
    enrichFamily(family, getTierKey(family.macro), technologyLibrary)
  );
}

/**
 * Batch enrich all prices with family context
 * Includes LAYER D: Deterministic addon inference from description/treatments_raw
 * when addons_detected is empty (build step, NOT UI)
 */
export function enrichPrices(
  prices: Price[],
  familiesMap: Map<string, FamilyExtended>
): EnrichedPrice[] {
  // Check if catalog already has addons_detected populated
  const hasNativeAddons = prices.some(p => p.addons_detected && p.addons_detected.length > 0);
  
  return prices.map(price => {
    let enrichedPrice = price;
    
    // LAYER D: Infer addons if catalog doesn't provide them (deterministic, auditable)
    if (!hasNativeAddons && (!price.addons_detected || price.addons_detected.length === 0)) {
      const inferred = inferAddonsFromDescription(price);
      if (inferred.length > 0) {
        enrichedPrice = { 
          ...price, 
          addons_detected: inferred,
          flags: { ...price.flags, addons_inferred: true },
        };
      }
    }
    
    return enrichPrice(enrichedPrice, familiesMap.get(enrichedPrice.family_id));
  });
}

// ============================================================================
// LAYER D: DETERMINISTIC ADDON INFERENCE (build step)
// ============================================================================

/**
 * Infer addons from SKU description and treatments_raw.
 * This runs ONCE at catalog load time, NOT in UI components.
 * 
 * Rules:
 * - Pattern-based, deterministic by supplier
 * - Produces standardized tags (BLUE, TRANSITIONS, AR_PREMIUM, etc.)
 * - Logged via flags.addons_inferred = true for audit
 */
const ADDON_INFERENCE_PATTERNS: { pattern: RegExp; addonId: string }[] = [
  // Blue light filters
  { pattern: /\b(blue\s*(?:uv|guard|protect|light|cut)?|luz\s*azul|blueguard|blue\s*control|bluecontrol)\b/i, addonId: 'BLUE' },
  // Photochromic - brand specific
  { pattern: /\b(transitions?|xtractive)\b/i, addonId: 'TRANSITIONS' },
  { pattern: /\b(sensity)\b/i, addonId: 'SENSITY' },
  { pattern: /\b(photo\s*fusion)\b/i, addonId: 'PHOTOFUSION' },
  { pattern: /\b(foto(?:ss?ens[ií]vel|crom[áa]tic[ao])?|photochromic)\b/i, addonId: 'FOTOSSENSIVEL' },
  // Polarized
  { pattern: /\b(polarizad[ao]|polarized|xperio|drivewear)\b/i, addonId: 'POLARIZADO' },
  // AR Premium (brand coatings)
  { pattern: /\b(crizal|optifog|satin|prevencia|diamond|duravision|super\s*hi[\s-]*vision|hi[\s-]*coat)\b/i, addonId: 'AR_PREMIUM' },
];

function inferAddonsFromDescription(price: Price): string[] {
  const desc = (price.description || '');
  const rawKeys = Object.keys(price.treatments_raw || {}).join(' ');
  const combined = `${desc} ${rawKeys}`;
  
  const detected: string[] = [];
  for (const { pattern, addonId } of ADDON_INFERENCE_PATTERNS) {
    if (pattern.test(combined) && !detected.includes(addonId)) {
      detected.push(addonId);
    }
  }
  return detected;
}

/**
 * Create a presentation overlay (for optional export)
 */
export function createPresentationOverlay(
  families: EnrichedFamily[],
  prices: EnrichedPrice[]
): {
  version: string;
  generated_at: string;
  families: Record<string, {
    display_name: string;
    display_subtitle: string;
    knowledge: { consumer: string; consultant: string[] };
    sales_pills: string[];
  }>;
  prices: Record<string, {
    display_description: string;
    treatment_labels: Record<string, string>;
  }>;
} {
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
