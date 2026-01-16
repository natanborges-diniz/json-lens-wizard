/**
 * SKU CLASSIFICATION ENGINE
 * 
 * Motor de verificação e classificação de SKUs baseado em regras externas (JSON).
 * 
 * Funcionalidades:
 * 1. Normalizar prices[].description
 * 2. Aplicar regras de match definidas no JSON (family_matching_engine)
 * 3. Atribuir family_id automaticamente aos SKUs
 * 4. Marcar families como inactive se não houver SKUs ativos
 * 5. Gerar relatório de SKUs sem família e famílias sem preço
 * 6. Fallback Essential para nunca quebrar a base
 */

import type { Price, FamilyExtended, LensData } from '@/types/lens';

// ════════════════════════════════════════════════════════════════════════════
// TIPOS DO MOTOR DE CLASSIFICAÇÃO
// ════════════════════════════════════════════════════════════════════════════

export interface MatchingCondition {
  field: 'description' | 'supplier' | 'lens_category_raw' | 'manufacturing_type' | 'index';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'regex' | 'not_contains';
  value: string;
  case_sensitive?: boolean;
}

export interface MatchingRule {
  id: string;
  name: string;
  priority: number; // Menor = maior prioridade
  conditions: MatchingCondition[];
  match_type: 'all' | 'any'; // AND ou OR para condições
  target_family_id: string;
  enabled: boolean;
}

export interface NormalizationRule {
  id: string;
  pattern: string; // Regex pattern
  replacement: string;
  enabled: boolean;
  description?: string;
}

export interface FamilyMatchingEngine {
  version: string;
  fallback_family_id: string; // Family ID padrão (Essential)
  normalization_rules: NormalizationRule[];
  matching_rules: MatchingRule[];
  auto_deactivate_empty_families: boolean;
}

export interface ClassificationReport {
  timestamp: string;
  total_skus: number;
  classified_skus: number;
  unclassified_skus: number;
  fallback_count: number;
  families_without_prices: string[];
  orphaned_skus: SkuClassificationResult[];
  classification_summary: {
    family_id: string;
    family_name: string;
    sku_count: number;
    by_rule: string[];
  }[];
  deactivated_families: string[];
  errors: string[];
  warnings: string[];
}

export interface SkuClassificationResult {
  erp_code: string;
  original_description: string;
  normalized_description: string;
  original_family_id: string;
  new_family_id: string;
  matched_rule_id: string | null;
  match_type: 'rule' | 'fallback' | 'unchanged';
  confidence: 'high' | 'medium' | 'low';
}

export interface ClassificationEngineResult {
  success: boolean;
  report: ClassificationReport;
  updated_prices: Price[];
  updated_families: FamilyExtended[];
}

// ════════════════════════════════════════════════════════════════════════════
// ENGINE PADRÃO (DEFAULT) - Pode ser sobrescrito pelo JSON
// ════════════════════════════════════════════════════════════════════════════

const DEFAULT_ENGINE: FamilyMatchingEngine = {
  version: '1.0',
  fallback_family_id: 'ESSENTIAL_DEFAULT',
  normalization_rules: [
    {
      id: 'norm_spaces',
      pattern: '\\s+',
      replacement: ' ',
      enabled: true,
      description: 'Normaliza múltiplos espaços'
    },
    {
      id: 'norm_trim',
      pattern: '^\\s+|\\s+$',
      replacement: '',
      enabled: true,
      description: 'Remove espaços no início/fim'
    },
    {
      id: 'norm_uppercase',
      pattern: '.*',
      replacement: 'UPPER',
      enabled: true,
      description: 'Converte para maiúsculas'
    },
    {
      id: 'norm_accents',
      pattern: '[áàãâä]',
      replacement: 'A',
      enabled: true,
      description: 'Normaliza acentos A'
    },
    {
      id: 'norm_accents_e',
      pattern: '[éèêë]',
      replacement: 'E',
      enabled: true,
      description: 'Normaliza acentos E'
    },
    {
      id: 'norm_accents_i',
      pattern: '[íìîï]',
      replacement: 'I',
      enabled: true,
      description: 'Normaliza acentos I'
    },
    {
      id: 'norm_accents_o',
      pattern: '[óòõôö]',
      replacement: 'O',
      enabled: true,
      description: 'Normaliza acentos O'
    },
    {
      id: 'norm_accents_u',
      pattern: '[úùûü]',
      replacement: 'U',
      enabled: true,
      description: 'Normaliza acentos U'
    },
    {
      id: 'norm_cedilla',
      pattern: 'ç',
      replacement: 'C',
      enabled: true,
      description: 'Normaliza cedilha'
    }
  ],
  matching_rules: [],
  auto_deactivate_empty_families: true
};

// ════════════════════════════════════════════════════════════════════════════
// FUNÇÕES DE NORMALIZAÇÃO
// ════════════════════════════════════════════════════════════════════════════

/**
 * Aplica regras de normalização na descrição
 */
export function normalizeDescription(
  description: string, 
  rules: NormalizationRule[]
): string {
  let normalized = description;
  
  for (const rule of rules) {
    if (!rule.enabled) continue;
    
    try {
      // Tratamento especial para UPPER
      if (rule.replacement === 'UPPER') {
        normalized = normalized.toUpperCase();
        continue;
      }
      
      const regex = new RegExp(rule.pattern, 'gi');
      normalized = normalized.replace(regex, rule.replacement);
    } catch (e) {
      console.warn(`[SKU Engine] Invalid regex in rule ${rule.id}:`, e);
    }
  }
  
  return normalized.trim();
}

// ════════════════════════════════════════════════════════════════════════════
// FUNÇÕES DE MATCHING
// ════════════════════════════════════════════════════════════════════════════

/**
 * Verifica se uma condição é satisfeita
 */
function evaluateCondition(
  price: Price, 
  normalizedDescription: string,
  condition: MatchingCondition
): boolean {
  let fieldValue: string;
  
  switch (condition.field) {
    case 'description':
      fieldValue = normalizedDescription;
      break;
    case 'supplier':
      fieldValue = price.supplier || '';
      break;
    case 'lens_category_raw':
      fieldValue = price.lens_category_raw || '';
      break;
    case 'manufacturing_type':
      fieldValue = price.manufacturing_type || '';
      break;
    case 'index':
      fieldValue = price.index || '';
      break;
    default:
      return false;
  }
  
  const compareValue = condition.case_sensitive 
    ? condition.value 
    : condition.value.toLowerCase();
  const compareField = condition.case_sensitive 
    ? fieldValue 
    : fieldValue.toLowerCase();
  
  switch (condition.operator) {
    case 'contains':
      return compareField.includes(compareValue);
    case 'not_contains':
      return !compareField.includes(compareValue);
    case 'equals':
      return compareField === compareValue;
    case 'starts_with':
      return compareField.startsWith(compareValue);
    case 'ends_with':
      return compareField.endsWith(compareValue);
    case 'regex':
      try {
        const regex = new RegExp(condition.value, condition.case_sensitive ? '' : 'i');
        return regex.test(fieldValue);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Tenta encontrar um match para o SKU usando as regras
 */
function findMatchingRule(
  price: Price,
  normalizedDescription: string,
  rules: MatchingRule[]
): MatchingRule | null {
  // Ordenar por prioridade (menor = maior prioridade)
  const sortedRules = [...rules]
    .filter(r => r.enabled)
    .sort((a, b) => a.priority - b.priority);
  
  for (const rule of sortedRules) {
    const results = rule.conditions.map(cond => 
      evaluateCondition(price, normalizedDescription, cond)
    );
    
    const matches = rule.match_type === 'all' 
      ? results.every(r => r)
      : results.some(r => r);
    
    if (matches) {
      return rule;
    }
  }
  
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL DE CLASSIFICAÇÃO
// ════════════════════════════════════════════════════════════════════════════

/**
 * Executa o motor de classificação completo
 */
export function runClassificationEngine(
  lensData: LensData,
  customEngine?: Partial<FamilyMatchingEngine>
): ClassificationEngineResult {
  const engine: FamilyMatchingEngine = {
    ...DEFAULT_ENGINE,
    ...customEngine,
    normalization_rules: [
      ...(customEngine?.normalization_rules || DEFAULT_ENGINE.normalization_rules)
    ],
    matching_rules: [
      ...(customEngine?.matching_rules || DEFAULT_ENGINE.matching_rules)
    ]
  };
  
  const report: ClassificationReport = {
    timestamp: new Date().toISOString(),
    total_skus: lensData.prices?.length || 0,
    classified_skus: 0,
    unclassified_skus: 0,
    fallback_count: 0,
    families_without_prices: [],
    orphaned_skus: [],
    classification_summary: [],
    deactivated_families: [],
    errors: [],
    warnings: []
  };
  
  const familyIds = new Set((lensData.families || []).map(f => f.id));
  const familySkuCount: Record<string, { count: number; rules: Set<string> }> = {};
  
  // Inicializar contadores para todas as famílias
  for (const family of lensData.families || []) {
    familySkuCount[family.id] = { count: 0, rules: new Set() };
  }
  
  // Processar cada SKU/Price
  const updatedPrices: Price[] = [];
  const classificationResults: SkuClassificationResult[] = [];
  
  for (const price of lensData.prices || []) {
    const originalDescription = price.description || '';
    const normalizedDescription = normalizeDescription(
      originalDescription, 
      engine.normalization_rules
    );
    
    let newFamilyId = price.family_id;
    let matchedRule: MatchingRule | null = null;
    let matchType: SkuClassificationResult['match_type'] = 'unchanged';
    let confidence: SkuClassificationResult['confidence'] = 'high';
    
    // Verificar se family_id atual é válido
    const currentFamilyValid = price.family_id && familyIds.has(price.family_id);
    
    // Tentar encontrar regra de match
    matchedRule = findMatchingRule(price, normalizedDescription, engine.matching_rules);
    
    if (matchedRule) {
      // Match encontrado por regra
      if (familyIds.has(matchedRule.target_family_id)) {
        newFamilyId = matchedRule.target_family_id;
        matchType = 'rule';
        confidence = 'high';
        report.classified_skus++;
      } else {
        report.errors.push(
          `Regra "${matchedRule.id}" aponta para família inexistente: ${matchedRule.target_family_id}`
        );
        // Usar fallback
        if (familyIds.has(engine.fallback_family_id)) {
          newFamilyId = engine.fallback_family_id;
          matchType = 'fallback';
          confidence = 'low';
          report.fallback_count++;
        }
      }
    } else if (!currentFamilyValid) {
      // Sem regra e family_id atual inválido - usar fallback
      if (familyIds.has(engine.fallback_family_id)) {
        newFamilyId = engine.fallback_family_id;
        matchType = 'fallback';
        confidence = 'low';
        report.fallback_count++;
        report.unclassified_skus++;
      } else {
        // Nem fallback existe - mantém original e marca como problema
        report.warnings.push(
          `SKU "${price.erp_code}" sem família válida e fallback inexistente`
        );
        report.unclassified_skus++;
      }
    } else {
      // Family_id atual válido e sem regra - mantém
      matchType = 'unchanged';
    }
    
    // Atualizar contador da família
    if (newFamilyId && familySkuCount[newFamilyId]) {
      familySkuCount[newFamilyId].count++;
      if (matchedRule) {
        familySkuCount[newFamilyId].rules.add(matchedRule.id);
      }
    }
    
    // Registrar resultado
    const result: SkuClassificationResult = {
      erp_code: price.erp_code,
      original_description: originalDescription,
      normalized_description: normalizedDescription,
      original_family_id: price.family_id,
      new_family_id: newFamilyId,
      matched_rule_id: matchedRule?.id || null,
      match_type: matchType,
      confidence
    };
    
    classificationResults.push(result);
    
    // Adicionar à lista de órfãos se não classificado
    if (matchType === 'fallback' || !currentFamilyValid) {
      report.orphaned_skus.push(result);
    }
    
    // Criar price atualizado
    updatedPrices.push({
      ...price,
      family_id: newFamilyId,
      // Armazenar descrição normalizada em campo auxiliar (não sobrescreve original)
      description: originalDescription // Mantém original
    });
  }
  
  // Identificar famílias sem preços ativos
  const updatedFamilies: FamilyExtended[] = [];
  
  for (const family of lensData.families || []) {
    const activePriceCount = updatedPrices.filter(
      p => p.family_id === family.id && p.active && !p.blocked
    ).length;
    
    if (activePriceCount === 0) {
      report.families_without_prices.push(family.id);
      
      // Auto-desativar se configurado
      if (engine.auto_deactivate_empty_families && family.active) {
        updatedFamilies.push({ ...family, active: false });
        report.deactivated_families.push(family.id);
      } else {
        updatedFamilies.push(family);
      }
    } else {
      updatedFamilies.push(family);
    }
  }
  
  // Gerar resumo por família
  for (const [familyId, data] of Object.entries(familySkuCount)) {
    const family = lensData.families?.find(f => f.id === familyId);
    if (data.count > 0 || !family) {
      report.classification_summary.push({
        family_id: familyId,
        family_name: family?.name_original || 'Desconhecida',
        sku_count: data.count,
        by_rule: [...data.rules]
      });
    }
  }
  
  // Ordenar resumo por contagem
  report.classification_summary.sort((a, b) => b.sku_count - a.sku_count);
  
  return {
    success: report.errors.length === 0,
    report,
    updated_prices: updatedPrices,
    updated_families: updatedFamilies
  };
}

// ════════════════════════════════════════════════════════════════════════════
// FUNÇÕES AUXILIARES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Valida a configuração do engine
 */
export function validateEngineConfig(
  engine: Partial<FamilyMatchingEngine>,
  familyIds: Set<string>
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validar fallback
  if (engine.fallback_family_id && !familyIds.has(engine.fallback_family_id)) {
    errors.push(`Família de fallback "${engine.fallback_family_id}" não existe`);
  }
  
  // Validar regras de match
  for (const rule of engine.matching_rules || []) {
    if (!rule.id) {
      errors.push('Regra de match sem ID');
    }
    if (!rule.target_family_id) {
      errors.push(`Regra "${rule.id}" sem target_family_id`);
    } else if (!familyIds.has(rule.target_family_id)) {
      warnings.push(`Regra "${rule.id}" aponta para família inexistente: ${rule.target_family_id}`);
    }
    if (!rule.conditions || rule.conditions.length === 0) {
      errors.push(`Regra "${rule.id}" sem condições`);
    }
  }
  
  // Validar regras de normalização
  for (const rule of engine.normalization_rules || []) {
    if (!rule.id) {
      errors.push('Regra de normalização sem ID');
    }
    try {
      if (rule.pattern && rule.replacement !== 'UPPER') {
        new RegExp(rule.pattern);
      }
    } catch {
      errors.push(`Regra "${rule.id}" tem regex inválido: ${rule.pattern}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Extrai o engine do LensData
 */
export function getEngineFromLensData(lensData: LensData): FamilyMatchingEngine | null {
  // O engine pode estar em lensData.family_matching_engine (extensão do schema)
  const engine = (lensData as any).family_matching_engine;
  if (engine && typeof engine === 'object') {
    return engine as FamilyMatchingEngine;
  }
  return null;
}

/**
 * Formata o relatório em texto legível
 */
export function formatClassificationReport(report: ClassificationReport): string {
  const lines: string[] = [];
  
  lines.push('═'.repeat(60));
  lines.push('RELATÓRIO DE CLASSIFICAÇÃO DE SKUs');
  lines.push('═'.repeat(60));
  lines.push(`Data: ${new Date(report.timestamp).toLocaleString('pt-BR')}`);
  lines.push('');
  
  lines.push('📊 RESUMO GERAL');
  lines.push('-'.repeat(40));
  lines.push(`Total de SKUs: ${report.total_skus}`);
  lines.push(`SKUs classificados por regra: ${report.classified_skus}`);
  lines.push(`SKUs usando fallback: ${report.fallback_count}`);
  lines.push(`SKUs sem classificação: ${report.unclassified_skus}`);
  lines.push('');
  
  if (report.families_without_prices.length > 0) {
    lines.push('⚠️ FAMÍLIAS SEM PREÇOS ATIVOS');
    lines.push('-'.repeat(40));
    for (const familyId of report.families_without_prices.slice(0, 20)) {
      lines.push(`  • ${familyId}`);
    }
    if (report.families_without_prices.length > 20) {
      lines.push(`  ... e mais ${report.families_without_prices.length - 20} famílias`);
    }
    lines.push('');
  }
  
  if (report.orphaned_skus.length > 0) {
    lines.push('🔍 SKUs SEM FAMÍLIA VÁLIDA (Órfãos)');
    lines.push('-'.repeat(40));
    for (const sku of report.orphaned_skus.slice(0, 20)) {
      lines.push(`  • ${sku.erp_code}: ${sku.original_description.substring(0, 50)}...`);
      lines.push(`    → Atribuído a: ${sku.new_family_id} (${sku.match_type})`);
    }
    if (report.orphaned_skus.length > 20) {
      lines.push(`  ... e mais ${report.orphaned_skus.length - 20} SKUs órfãos`);
    }
    lines.push('');
  }
  
  if (report.deactivated_families.length > 0) {
    lines.push('🔴 FAMÍLIAS DESATIVADAS AUTOMATICAMENTE');
    lines.push('-'.repeat(40));
    for (const familyId of report.deactivated_families) {
      lines.push(`  • ${familyId}`);
    }
    lines.push('');
  }
  
  if (report.errors.length > 0) {
    lines.push('❌ ERROS');
    lines.push('-'.repeat(40));
    for (const error of report.errors) {
      lines.push(`  • ${error}`);
    }
    lines.push('');
  }
  
  if (report.warnings.length > 0) {
    lines.push('⚠️ AVISOS');
    lines.push('-'.repeat(40));
    for (const warning of report.warnings) {
      lines.push(`  • ${warning}`);
    }
    lines.push('');
  }
  
  lines.push('═'.repeat(60));
  
  return lines.join('\n');
}
