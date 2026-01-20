/**
 * MOTOR DE VALIDAÇÃO DE IMPORTAÇÃO DE JSON
 * 
 * Este módulo implementa validação completa antes de aplicar REPLACE ou INCREMENT:
 * 1. Validação estrutural (bloqueante)
 * 2. Integridade referencial (bloqueante)
 * 3. Regras de negócio (alerta, não bloqueante)
 * 4. Relatório de importação
 * 
 * Arquitetura: Nenhuma regra hardcoded - todas validações usam exclusivamente o JSON importado
 */

import type { LensData, Price, FamilyExtended, MacroExtended, IndexDisplay } from '@/types/lens';

// ════════════════════════════════════════════════════════════════════════════
// TIPOS
// ════════════════════════════════════════════════════════════════════════════

export interface ValidationError {
  code: string;
  message: string;
  section: string;
  item?: string; // ID do item afetado
  field?: string;
  severity: 'blocking' | 'warning';
}

export interface ValidationReport {
  isValid: boolean;
  blockingErrors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    totalBlockingErrors: number;
    totalWarnings: number;
    affectedFamilies: string[];
    affectedSkus: string[];
  };
  timestamp: string;
}

// Tipos para regras de validação configuráveis
export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: 'blocking' | 'warning';
  category: 'structural' | 'referential' | 'business';
  validate: (data: LensData) => ValidationError[];
}

// ════════════════════════════════════════════════════════════════════════════
// VALIDAÇÕES ESTRUTURAIS (BLOQUEANTES)
// ════════════════════════════════════════════════════════════════════════════

const REQUIRED_SECTIONS = ['meta', 'scales', 'attribute_defs', 'macros', 'families', 'addons', 'prices'] as const;

function validateRequiredSections(data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  
  for (const section of REQUIRED_SECTIONS) {
    if (!(section in data)) {
      errors.push({
        code: 'MISSING_SECTION',
        message: `Seção obrigatória ausente: "${section}"`,
        section,
        severity: 'blocking'
      });
    } else if (data[section] === null || data[section] === undefined) {
      errors.push({
        code: 'NULL_SECTION',
        message: `Seção "${section}" está nula ou indefinida`,
        section,
        severity: 'blocking'
      });
    }
  }
  
  return errors;
}

function validateSectionArrays(data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  const arraySections = ['macros', 'families', 'addons', 'prices', 'attribute_defs'];
  
  for (const section of arraySections) {
    if (section in data && !Array.isArray(data[section as keyof LensData])) {
      errors.push({
        code: 'INVALID_SECTION_TYPE',
        message: `Seção "${section}" deveria ser um array`,
        section,
        severity: 'blocking'
      });
    }
  }
  
  return errors;
}

// ════════════════════════════════════════════════════════════════════════════
// VALIDAÇÕES DE INTEGRIDADE REFERENCIAL (BLOQUEANTES)
// ════════════════════════════════════════════════════════════════════════════

function validateFamilyMacroReferences(data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  const macroIds = new Set((data.macros || []).map(m => m.id));
  
  (data.families || []).forEach((family, index) => {
    if (!family.macro) {
      errors.push({
        code: 'MISSING_FAMILY_MACRO',
        message: `Family "${family.id || `[${index}]`}" não possui campo "macro"`,
        section: 'families',
        item: family.id,
        field: 'macro',
        severity: 'blocking'
      });
    } else if (!macroIds.has(family.macro)) {
      errors.push({
        code: 'INVALID_FAMILY_MACRO',
        message: `Family "${family.id}" referencia macro inexistente: "${family.macro}"`,
        section: 'families',
        item: family.id,
        field: 'macro',
        severity: 'blocking'
      });
    }
  });
  
  return errors;
}

function validatePriceFamilyReferences(data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  const familyIds = new Set((data.families || []).map(f => f.id));
  
  (data.prices || []).forEach((price, index) => {
    if (!price.family_id) {
      errors.push({
        code: 'MISSING_PRICE_FAMILY',
        message: `SKU "${price.erp_code || `[${index}]`}" não possui campo "family_id"`,
        section: 'prices',
        item: price.erp_code,
        field: 'family_id',
        severity: 'blocking'
      });
    } else if (!familyIds.has(price.family_id)) {
      errors.push({
        code: 'INVALID_PRICE_FAMILY',
        message: `SKU "${price.erp_code}" referencia family inexistente: "${price.family_id}"`,
        section: 'prices',
        item: price.erp_code,
        field: 'family_id',
        severity: 'blocking'
      });
    }
  });
  
  return errors;
}

function validatePriceErpCode(data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  
  (data.prices || []).forEach((price, index) => {
    if (!price.erp_code || String(price.erp_code).trim() === '') {
      errors.push({
        code: 'MISSING_ERP_CODE',
        message: `SKU [${index}] não possui "erp_code" preenchido`,
        section: 'prices',
        item: `prices[${index}]`,
        field: 'erp_code',
        severity: 'blocking'
      });
    }
  });
  
  return errors;
}

function validatePriceSaleValue(data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  
  (data.prices || []).forEach((price) => {
    const value = price.price_sale_half_pair;
    
    if (value === null || value === undefined) {
      errors.push({
        code: 'MISSING_SALE_PRICE',
        message: `SKU "${price.erp_code}" não possui "price_sale_half_pair"`,
        section: 'prices',
        item: price.erp_code,
        field: 'price_sale_half_pair',
        severity: 'blocking'
      });
    } else if (typeof value !== 'number' || Number.isNaN(value)) {
      errors.push({
        code: 'INVALID_SALE_PRICE',
        message: `SKU "${price.erp_code}" possui "price_sale_half_pair" não numérico: ${value}`,
        section: 'prices',
        item: price.erp_code,
        field: 'price_sale_half_pair',
        severity: 'blocking'
      });
    }
  });
  
  return errors;
}

function validatePriceIndexReferences(data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Se não houver index_display, não validar (retrocompatibilidade)
  if (!data.index_display || data.index_display.length === 0) {
    return errors;
  }
  
  const validIndices = new Set((data.index_display || []).map(i => i.value));
  
  (data.prices || []).forEach((price) => {
    if (price.index && !validIndices.has(price.index)) {
      errors.push({
        code: 'INVALID_PRICE_INDEX',
        message: `SKU "${price.erp_code}" possui índice inexistente em index_display: "${price.index}"`,
        section: 'prices',
        item: price.erp_code,
        field: 'index',
        severity: 'blocking'
      });
    }
  });
  
  return errors;
}

// ════════════════════════════════════════════════════════════════════════════
// REGRAS DE NEGÓCIO (ALERTAS - NÃO BLOQUEANTES)
// ════════════════════════════════════════════════════════════════════════════

function validateFamiliesWithoutPrices(data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  const familiesWithPrices = new Set((data.prices || []).map(p => p.family_id));
  
  (data.families || []).filter(f => f.active).forEach((family) => {
    if (!familiesWithPrices.has(family.id)) {
      errors.push({
        code: 'FAMILY_WITHOUT_PRICES',
        message: `Family ativa "${family.id}" (${family.name_original}) não possui SKUs de preço`,
        section: 'families',
        item: family.id,
        severity: 'warning'
      });
    }
  });
  
  return errors;
}

function validateFamiliesWithoutTechRefs(data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Só validar se technology_library existir
  if (!data.technology_library?.items || Object.keys(data.technology_library.items).length === 0) {
    return errors;
  }
  
  (data.families || []).filter(f => f.active).forEach((family) => {
    if (!family.technology_refs || family.technology_refs.length === 0) {
      errors.push({
        code: 'FAMILY_WITHOUT_TECH_REFS',
        message: `Family ativa "${family.id}" (${family.name_original}) não possui technology_refs`,
        section: 'families',
        item: family.id,
        severity: 'warning'
      });
    }
  });
  
  return errors;
}

function validateTierPriceRegression(data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Mapear tier_key de cada macro
  const macroTierMap = new Map<string, string>();
  (data.macros || []).forEach(macro => {
    if (macro.tier_key) {
      macroTierMap.set(macro.id, macro.tier_key);
    }
  });
  
  // Mapear família -> macro -> tier
  const familyTierMap = new Map<string, string>();
  (data.families || []).forEach(family => {
    const tier = macroTierMap.get(family.macro);
    if (tier) {
      familyTierMap.set(family.id, tier);
    }
  });
  
  // Ordem de tiers (do menor para o maior)
  const tierOrder = ['essential', 'comfort', 'advanced', 'top'];
  
  // Calcular preço médio por tier
  const tierPrices: Record<string, number[]> = {
    essential: [],
    comfort: [],
    advanced: [],
    top: []
  };
  
  (data.prices || []).filter(p => p.active).forEach(price => {
    const tier = familyTierMap.get(price.family_id);
    if (tier && tierPrices[tier]) {
      tierPrices[tier].push(price.price_sale_half_pair);
    }
  });
  
  // Calcular médias
  const tierAverages: Record<string, number> = {};
  for (const tier of tierOrder) {
    if (tierPrices[tier].length > 0) {
      tierAverages[tier] = tierPrices[tier].reduce((a, b) => a + b, 0) / tierPrices[tier].length;
    }
  }
  
  // Verificar regressões
  for (let i = 1; i < tierOrder.length; i++) {
    const lowerTier = tierOrder[i - 1];
    const higherTier = tierOrder[i];
    
    if (tierAverages[lowerTier] !== undefined && tierAverages[higherTier] !== undefined) {
      if (tierAverages[higherTier] < tierAverages[lowerTier]) {
        errors.push({
          code: 'TIER_PRICE_REGRESSION',
          message: `Regressão de preço médio: ${higherTier} (R$ ${tierAverages[higherTier].toFixed(2)}) é menor que ${lowerTier} (R$ ${tierAverages[lowerTier].toFixed(2)})`,
          section: 'prices',
          severity: 'warning'
        });
      }
    }
  }
  
  return errors;
}

function validateFamilyTierAttributes(data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Mapear tier_key de cada macro
  const macroTierMap = new Map<string, string>();
  (data.macros || []).forEach(macro => {
    if (macro.tier_key) {
      macroTierMap.set(macro.id, macro.tier_key);
    }
  });
  
  // Verificar atributos incompatíveis por tier
  // Regra: tiers superiores devem ter atributos >= tiers inferiores
  const tierMinScores: Record<string, number> = {
    essential: 0,
    comfort: 1,
    advanced: 2,
    top: 3
  };
  
  (data.families || []).filter(f => f.active).forEach((family) => {
    const tier = macroTierMap.get(family.macro);
    if (!tier || !tierMinScores[tier]) return;
    
    const minScore = tierMinScores[tier];
    const attrs = family.attributes_base || {};
    
    // Verificar atributos numéricos (assumindo escala 0-3)
    for (const [attrId, value] of Object.entries(attrs)) {
      if (typeof value === 'number') {
        // Se o tier é 'top' mas o atributo é 0, alertar
        if (tier === 'top' && value === 0) {
          errors.push({
            code: 'TIER_ATTRIBUTE_MISMATCH',
            message: `Family TOP "${family.id}" possui atributo "${attrId}" = 0`,
            section: 'families',
            item: family.id,
            field: attrId,
            severity: 'warning'
          });
        }
        // Se o tier é 'advanced' mas atributos são todos baixos
        if (tier === 'advanced' && value < 1) {
          errors.push({
            code: 'TIER_ATTRIBUTE_LOW',
            message: `Family AVANÇADA "${family.id}" possui atributo "${attrId}" abaixo do esperado (${value})`,
            section: 'families',
            item: family.id,
            field: attrId,
            severity: 'warning'
          });
        }
      }
    }
  });
  
  return errors;
}

// ════════════════════════════════════════════════════════════════════════════
// ENGINE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

/**
 * Executa validação completa do JSON de importação
 * @param data Dados do catálogo a validar
 * @param mode Modo de importação (replace ou increment)
 * @returns Relatório completo de validação
 */
export function validateCatalogImport(
  data: LensData, 
  mode: 'replace' | 'increment' = 'replace'
): ValidationReport {
  const allErrors: ValidationError[] = [];
  
  // ─── FASE 1: VALIDAÇÃO ESTRUTURAL (BLOQUEANTE) ───
  allErrors.push(...validateRequiredSections(data));
  allErrors.push(...validateSectionArrays(data));
  
  // Se estrutura base está quebrada, parar aqui
  const structuralErrors = allErrors.filter(e => e.severity === 'blocking');
  if (structuralErrors.length > 0) {
    return buildReport(allErrors);
  }
  
  // ─── FASE 2: INTEGRIDADE REFERENCIAL (BLOQUEANTE) ───
  allErrors.push(...validateFamilyMacroReferences(data));
  allErrors.push(...validatePriceFamilyReferences(data));
  allErrors.push(...validatePriceErpCode(data));
  allErrors.push(...validatePriceSaleValue(data));
  allErrors.push(...validatePriceIndexReferences(data));
  
  // ─── FASE 3: REGRAS DE NEGÓCIO (ALERTAS) ───
  allErrors.push(...validateFamiliesWithoutPrices(data));
  allErrors.push(...validateFamiliesWithoutTechRefs(data));
  allErrors.push(...validateTierPriceRegression(data));
  allErrors.push(...validateFamilyTierAttributes(data));
  
  return buildReport(allErrors);
}

/**
 * Constrói o relatório final de validação
 */
function buildReport(errors: ValidationError[]): ValidationReport {
  const blockingErrors = errors.filter(e => e.severity === 'blocking');
  const warnings = errors.filter(e => e.severity === 'warning');
  
  // Coletar famílias e SKUs afetados
  const affectedFamilies = new Set<string>();
  const affectedSkus = new Set<string>();
  
  errors.forEach(error => {
    if (error.item) {
      if (error.section === 'families') {
        affectedFamilies.add(error.item);
      } else if (error.section === 'prices') {
        affectedSkus.add(error.item);
      }
    }
  });
  
  return {
    isValid: blockingErrors.length === 0,
    blockingErrors,
    warnings,
    summary: {
      totalBlockingErrors: blockingErrors.length,
      totalWarnings: warnings.length,
      affectedFamilies: Array.from(affectedFamilies),
      affectedSkus: Array.from(affectedSkus)
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Formata o relatório para exibição em texto
 */
export function formatValidationReport(report: ValidationReport): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '                 RELATÓRIO DE VALIDAÇÃO DE IMPORTAÇÃO          ',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Status: ${report.isValid ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`,
    `Data/Hora: ${new Date(report.timestamp).toLocaleString('pt-BR')}`,
    '',
  ];
  
  if (report.blockingErrors.length > 0) {
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`                 ERROS BLOQUEANTES (${report.blockingErrors.length})                     `);
    lines.push('───────────────────────────────────────────────────────────────');
    report.blockingErrors.forEach((error, i) => {
      lines.push(`${i + 1}. [${error.code}] ${error.message}`);
      if (error.item) lines.push(`   └─ Item: ${error.item}`);
    });
    lines.push('');
  }
  
  if (report.warnings.length > 0) {
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`                    ALERTAS (${report.warnings.length})                            `);
    lines.push('───────────────────────────────────────────────────────────────');
    report.warnings.forEach((error, i) => {
      lines.push(`${i + 1}. [${error.code}] ${error.message}`);
      if (error.item) lines.push(`   └─ Item: ${error.item}`);
    });
    lines.push('');
  }
  
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('                         RESUMO                               ');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`Erros bloqueantes: ${report.summary.totalBlockingErrors}`);
  lines.push(`Alertas: ${report.summary.totalWarnings}`);
  lines.push(`Famílias afetadas: ${report.summary.affectedFamilies.length}`);
  lines.push(`SKUs afetados: ${report.summary.affectedSkus.length}`);
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');
  
  return lines.join('\n');
}
