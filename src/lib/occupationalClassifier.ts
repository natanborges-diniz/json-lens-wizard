/**
 * OCCUPATIONAL LENS CLASSIFIER
 * 
 * Classifica SKUs como lentes ocupacionais baseado em regras de descrição.
 * Não altera preços nem cria SKUs - apenas identifica e agrupa.
 */

import type { Price, FamilyExtended, MacroExtended, LensData } from '@/types/lens';

// ════════════════════════════════════════════════════════════════════════════
// REGRAS DE CLASSIFICAÇÃO OCUPACIONAL
// ════════════════════════════════════════════════════════════════════════════

// Keywords que INDICAM ocupacional (case-insensitive)
const OC_POSITIVE_KEYWORDS = [
  'OFFICE',
  'DIGITAL',
  'NEAR',
  'ROOM',
  'EYEZEN',
  'ANTI FATIGUE',
  'ANTIFATIGUE',
  'WORKSTYLE',
  'SYNC',
  'BOOST',
  'RELAX',
  'COMPUTER',
  'INDOOR',
];

// Keywords que EXCLUEM da classificação OC (são progressivas verdadeiras)
const OC_EXCLUSION_KEYWORDS = [
  'VARILUX',
  'PROGRESSIVE',
  'PHYSIO',
  'IPSEO',
  'LIBERTY',
  'COMFORT',
  'SMARTLIFE',
  'PRECISION',
];

// Produtos específicos que sabemos ser ocupacionais
const OC_PRODUCT_NAMES = [
  'EYEZEN BOOST',
  'EYEZEN START',
  'OFFICE',
  'SYNC III',
  'WORKSTYLE',
  'INTERVIEW',
  'ADDPOWER',
  'RELAX',
];

// ════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ════════════════════════════════════════════════════════════════════════════

export interface OcClassificationRule {
  id: string;
  type: 'include' | 'exclude';
  pattern: string;
  priority: number;
}

export interface OcSkuResult {
  erp_code: string;
  description: string;
  original_family_id: string;
  suggested_oc_tier: 'OC_BASICO' | 'OC_CONFORTO' | 'OC_AVANCADO';
  matched_keywords: string[];
  confidence: 'high' | 'medium' | 'low';
  supplier: string;
  add_range?: { min: number; max: number };
}

export interface OcClassificationReport {
  timestamp: string;
  total_skus_analyzed: number;
  oc_skus_found: number;
  skus_by_tier: {
    OC_BASICO: number;
    OC_CONFORTO: number;
    OC_AVANCADO: number;
  };
  skus_by_supplier: Record<string, number>;
  suggested_families: OcFamilySuggestion[];
  sku_details: OcSkuResult[];
  excluded_skus: { erp_code: string; description: string; exclusion_reason: string }[];
}

export interface OcFamilySuggestion {
  id: string;
  name_original: string;
  supplier: string;
  macro: 'OC_BASICO' | 'OC_CONFORTO' | 'OC_AVANCADO';
  sku_count: number;
  product_line: string;
}

// ════════════════════════════════════════════════════════════════════════════
// MACROS OCUPACIONAIS
// ════════════════════════════════════════════════════════════════════════════

export const OC_MACROS: MacroExtended[] = [
  {
    id: 'OC_BASICO',
    category: 'OCUPACIONAL',
    name_client: 'Ocupacional Essencial',
    description_client: 'Lente para trabalho em distâncias intermediárias e perto.',
    tier_key: 'essential',
    display: {
      icon: 'Monitor',
      color_class: 'text-cyan-600',
      bg_header_class: 'bg-gradient-to-r from-cyan-50 to-teal-100',
      border_class: 'border-cyan-200',
      dot_color_class: 'bg-cyan-500',
    },
  },
  {
    id: 'OC_CONFORTO',
    category: 'OCUPACIONAL',
    name_client: 'Ocupacional Conforto',
    description_client: 'Conforto otimizado para uso prolongado de telas.',
    tier_key: 'comfort',
    display: {
      icon: 'MonitorSmartphone',
      color_class: 'text-teal-600',
      bg_header_class: 'bg-gradient-to-r from-teal-50 to-emerald-100',
      border_class: 'border-teal-200',
      dot_color_class: 'bg-teal-500',
    },
  },
  {
    id: 'OC_AVANCADO',
    category: 'OCUPACIONAL',
    name_client: 'Ocupacional Avançado',
    description_client: 'Máximo conforto e personalização para profissionais.',
    tier_key: 'advanced',
    display: {
      icon: 'Laptop',
      color_class: 'text-emerald-600',
      bg_header_class: 'bg-gradient-to-r from-emerald-50 to-green-100',
      border_class: 'border-emerald-200',
      dot_color_class: 'bg-emerald-500',
    },
  },
];

// ════════════════════════════════════════════════════════════════════════════
// FUNÇÕES DE CLASSIFICAÇÃO
// ════════════════════════════════════════════════════════════════════════════

/**
 * Verifica se uma descrição corresponde a uma lente ocupacional
 */
export function isOccupationalLens(
  description: string,
  specs?: { add_min?: number; add_max?: number }
): { isOc: boolean; matchedKeywords: string[]; exclusionReason?: string } {
  const normalizedDesc = description.toUpperCase();
  
  // Primeiro verificar exclusões
  for (const keyword of OC_EXCLUSION_KEYWORDS) {
    if (normalizedDesc.includes(keyword.toUpperCase())) {
      // Exceção: VARILUX com DIGITIME/OFFICE é ocupacional
      if (keyword === 'VARILUX' && 
          (normalizedDesc.includes('DIGITIME') || normalizedDesc.includes('OFFICE'))) {
        continue;
      }
      return { 
        isOc: false, 
        matchedKeywords: [], 
        exclusionReason: `Contém "${keyword}" (progressiva verdadeira)` 
      };
    }
  }
  
  // Verificar matches positivos
  const matchedKeywords: string[] = [];
  
  // Verificar produtos específicos primeiro (maior confiança)
  for (const productName of OC_PRODUCT_NAMES) {
    if (normalizedDesc.includes(productName.toUpperCase())) {
      matchedKeywords.push(productName);
    }
  }
  
  // Verificar keywords gerais
  for (const keyword of OC_POSITIVE_KEYWORDS) {
    if (normalizedDesc.includes(keyword.toUpperCase()) && 
        !matchedKeywords.some(m => m.toUpperCase().includes(keyword.toUpperCase()))) {
      matchedKeywords.push(keyword);
    }
  }
  
  // Regra complementar: adição baixa (≤ 0.80) sem referência a progressiva
  if (specs?.add_max && specs.add_max <= 0.80 && !normalizedDesc.includes('PROG')) {
    if (matchedKeywords.length > 0) {
      // Reforça classificação OC
      matchedKeywords.push('LOW_ADD');
    }
  }
  
  return {
    isOc: matchedKeywords.length > 0,
    matchedKeywords
  };
}

/**
 * Determina o tier ocupacional baseado na descrição e preço
 */
export function determineOcTier(
  description: string,
  supplier: string,
  price?: number
): 'OC_BASICO' | 'OC_CONFORTO' | 'OC_AVANCADO' {
  const normalizedDesc = description.toUpperCase();
  
  // Keywords que indicam nível avançado
  const advancedKeywords = ['SAPPHIRE', 'PREMIUM', 'XTRA', 'X SERIES', 'SYNC III'];
  const comfortKeywords = ['BOOST', 'ROCK', 'OPTIFOG', 'PREVENCIA'];
  
  for (const keyword of advancedKeywords) {
    if (normalizedDesc.includes(keyword)) {
      return 'OC_AVANCADO';
    }
  }
  
  for (const keyword of comfortKeywords) {
    if (normalizedDesc.includes(keyword)) {
      return 'OC_CONFORTO';
    }
  }
  
  // Por preço (se disponível)
  if (price) {
    if (price > 1200) return 'OC_AVANCADO';
    if (price > 700) return 'OC_CONFORTO';
  }
  
  // Padrão: básico
  return 'OC_BASICO';
}

/**
 * Extrai a linha de produto do nome/descrição
 */
function extractProductLine(description: string, supplier: string): string {
  const normalizedDesc = description.toUpperCase();
  
  // Mapeamento de produtos conhecidos
  const productLines: Record<string, string> = {
    'EYEZEN BOOST': 'Eyezen Boost',
    'EYEZEN START': 'Eyezen Start',
    'SYNC III': 'Sync III',
    'INTERVIEW': 'Interview',
    'OFFICE': 'Office',
    'WORKSTYLE': 'Workstyle',
    'INDOOR': 'Indoor',
  };
  
  for (const [pattern, name] of Object.entries(productLines)) {
    if (normalizedDesc.includes(pattern)) {
      return `${supplier} ${name}`;
    }
  }
  
  return `${supplier} Ocupacional`;
}

/**
 * Executa a classificação completa de SKUs ocupacionais
 */
export function runOccupationalClassification(lensData: LensData): OcClassificationReport {
  const report: OcClassificationReport = {
    timestamp: new Date().toISOString(),
    total_skus_analyzed: 0,
    oc_skus_found: 0,
    skus_by_tier: {
      OC_BASICO: 0,
      OC_CONFORTO: 0,
      OC_AVANCADO: 0,
    },
    skus_by_supplier: {},
    suggested_families: [],
    sku_details: [],
    excluded_skus: [],
  };
  
  const prices = lensData.prices || [];
  report.total_skus_analyzed = prices.length;
  
  // Agrupar por linha de produto para sugerir famílias
  const productLineGroups: Record<string, OcSkuResult[]> = {};
  
  for (const price of prices) {
    const { isOc, matchedKeywords, exclusionReason } = isOccupationalLens(
      price.description,
      price.specs
    );
    
    if (!isOc) {
      if (exclusionReason) {
        report.excluded_skus.push({
          erp_code: price.erp_code,
          description: price.description,
          exclusion_reason: exclusionReason,
        });
      }
      continue;
    }
    
    const tier = determineOcTier(
      price.description,
      price.supplier,
      price.price_sale_half_pair
    );
    
    const confidence: 'high' | 'medium' | 'low' = 
      matchedKeywords.length >= 2 ? 'high' :
      matchedKeywords.length === 1 && OC_PRODUCT_NAMES.some(p => 
        matchedKeywords[0].toUpperCase().includes(p.toUpperCase())
      ) ? 'high' : 'medium';
    
    const result: OcSkuResult = {
      erp_code: price.erp_code,
      description: price.description,
      original_family_id: price.family_id,
      suggested_oc_tier: tier,
      matched_keywords: matchedKeywords,
      confidence,
      supplier: price.supplier,
      add_range: price.specs?.add_min !== undefined ? {
        min: price.specs.add_min,
        max: price.specs.add_max || 0
      } : undefined,
    };
    
    report.sku_details.push(result);
    report.oc_skus_found++;
    report.skus_by_tier[tier]++;
    report.skus_by_supplier[price.supplier] = 
      (report.skus_by_supplier[price.supplier] || 0) + 1;
    
    // Agrupar por linha de produto
    const productLine = extractProductLine(price.description, price.supplier);
    const groupKey = `${productLine}_${tier}`;
    if (!productLineGroups[groupKey]) {
      productLineGroups[groupKey] = [];
    }
    productLineGroups[groupKey].push(result);
  }
  
  // Gerar sugestões de famílias
  for (const [groupKey, skus] of Object.entries(productLineGroups)) {
    if (skus.length === 0) continue;
    
    const firstSku = skus[0];
    const productLine = extractProductLine(firstSku.description, firstSku.supplier);
    
    // Gerar ID único para a família
    const familyId = `OC_${firstSku.supplier.toUpperCase()}_${productLine.replace(/\s+/g, '_').toUpperCase()}`;
    
    report.suggested_families.push({
      id: familyId,
      name_original: productLine,
      supplier: firstSku.supplier,
      macro: firstSku.suggested_oc_tier,
      sku_count: skus.length,
      product_line: productLine,
    });
  }
  
  // Ordenar famílias por quantidade de SKUs
  report.suggested_families.sort((a, b) => b.sku_count - a.sku_count);
  
  return report;
}

/**
 * Gera dados INCREMENT JSON para inserir macros e famílias OC
 */
export function generateOcIncrementData(
  report: OcClassificationReport,
  existingFamilyIds: Set<string>
): {
  macros: MacroExtended[];
  families: FamilyExtended[];
} {
  // Filtrar famílias que já existem
  const newFamilies: FamilyExtended[] = report.suggested_families
    .filter(suggestion => !existingFamilyIds.has(suggestion.id))
    .map(suggestion => ({
      id: suggestion.id,
      supplier: suggestion.supplier,
      name_original: suggestion.name_original,
      category: 'OCUPACIONAL' as const,
      macro: suggestion.macro,
      attributes_base: {
        // Atributos padrão para ocupacionais
        MONO_DIGITAL: suggestion.macro === 'OC_AVANCADO' ? 3 : 
                      suggestion.macro === 'OC_CONFORTO' ? 2 : 1,
        MONO_CONFORTO: suggestion.macro === 'OC_AVANCADO' ? 3 : 
                       suggestion.macro === 'OC_CONFORTO' ? 2 : 1,
        MONO_NITIDEZ: 2,
        UV: true,
      },
      attributes_display_base: ['MONO_DIGITAL', 'MONO_CONFORTO'],
      technology_refs: ['digital_comfort'],
      active: true,
    }));
  
  return {
    macros: OC_MACROS,
    families: newFamilies,
  };
}

/**
 * Formata o relatório para exibição
 */
export function formatOcClassificationReport(report: OcClassificationReport): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '  RELATÓRIO DE CLASSIFICAÇÃO - LENTES OCUPACIONAIS',
    '═══════════════════════════════════════════════════════════════',
    '',
    `📅 Data: ${new Date(report.timestamp).toLocaleString('pt-BR')}`,
    '',
    '📊 RESUMO',
    '─────────────────────────────────────────────────────────────────',
    `   Total SKUs analisados: ${report.total_skus_analyzed}`,
    `   SKUs ocupacionais encontrados: ${report.oc_skus_found}`,
    '',
    '📈 POR TIER',
    '─────────────────────────────────────────────────────────────────',
    `   Essencial (OC_BASICO): ${report.skus_by_tier.OC_BASICO}`,
    `   Conforto (OC_CONFORTO): ${report.skus_by_tier.OC_CONFORTO}`,
    `   Avançado (OC_AVANCADO): ${report.skus_by_tier.OC_AVANCADO}`,
    '',
    '🏭 POR FORNECEDOR',
    '─────────────────────────────────────────────────────────────────',
  ];
  
  for (const [supplier, count] of Object.entries(report.skus_by_supplier)) {
    lines.push(`   ${supplier}: ${count} SKUs`);
  }
  
  lines.push('');
  lines.push('📁 FAMÍLIAS SUGERIDAS');
  lines.push('─────────────────────────────────────────────────────────────────');
  
  for (const family of report.suggested_families) {
    lines.push(`   ${family.id}`);
    lines.push(`      Nome: ${family.name_original}`);
    lines.push(`      Fornecedor: ${family.supplier}`);
    lines.push(`      Macro: ${family.macro}`);
    lines.push(`      SKUs: ${family.sku_count}`);
    lines.push('');
  }
  
  if (report.excluded_skus.length > 0) {
    lines.push('');
    lines.push('⚠️ SKUs EXCLUÍDOS (são progressivas)');
    lines.push('─────────────────────────────────────────────────────────────────');
    for (const excluded of report.excluded_skus.slice(0, 10)) {
      lines.push(`   ${excluded.erp_code}: ${excluded.exclusion_reason}`);
    }
    if (report.excluded_skus.length > 10) {
      lines.push(`   ... e mais ${report.excluded_skus.length - 10} SKUs`);
    }
  }
  
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}
