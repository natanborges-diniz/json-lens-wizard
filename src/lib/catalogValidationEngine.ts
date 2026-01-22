/**
 * MOTOR DE VALIDAÇÃO DECLARATIVO
 * 
 * ZERO HARDCODE: Todas as regras são lidas de validation_rules.json
 * 
 * Tipos de regras suportados:
 * - structure: verifica seções obrigatórias
 * - reference: valida integridade referencial (from -> to)
 * - field_presence: verifica campos obrigatórios
 * - aggregation: regras de negócio complexas
 */

import type { LensData, Price, FamilyExtended, IndexDisplay } from '@/types/lens';

// ════════════════════════════════════════════════════════════════════════════
// TIPOS PARA REGRAS DE VALIDAÇÃO (do JSON)
// ════════════════════════════════════════════════════════════════════════════

export interface ValidationRuleBase {
  id: string;
  type: 'structure' | 'reference' | 'field_presence' | 'aggregation' | 'enum_validation';
  level: 'block' | 'warning';
  message: string;
}

export interface StructureRule extends ValidationRuleBase {
  type: 'structure';
  required_sections: string[];
}

export interface ReferenceRule extends ValidationRuleBase {
  type: 'reference';
  from: string; // e.g. "families[].macro"
  to: string;   // e.g. "macros[].id"
}

export interface FieldPresenceRule extends ValidationRuleBase {
  type: 'field_presence';
  fields: string[]; // e.g. ["prices[].erp_code"]
}

export interface AggregationRule extends ValidationRuleBase {
  type: 'aggregation';
  definition: string;
}

export interface EnumValidationRule extends ValidationRuleBase {
  type: 'enum_validation';
  field: string; // e.g. "families[].clinical_type"
  allowed_values: string[];
  optional?: boolean; // If true, missing values are allowed
}

export type ValidationRule = StructureRule | ReferenceRule | FieldPresenceRule | AggregationRule | EnumValidationRule;

export interface PostImportAction {
  id: string;
  trigger: string; // e.g. "warning:FAMILY_WITHOUT_SKU"
  action: {
    set: Record<string, unknown>;
  };
  message: string;
}

export interface ValidationRulesConfig {
  meta: {
    version: string;
    scope: string;
    name: string;
    generated_at: string;
    description: string;
  };
  blocking_rules: ValidationRule[];
  warning_rules: ValidationRule[];
  post_import_actions: PostImportAction[];
  ui_spec: {
    admin_pages: Array<{
      id: string;
      title: string;
      steps?: string[];
      widgets?: string[];
    }>;
  };
}

// ════════════════════════════════════════════════════════════════════════════
// TIPOS DE RESULTADO
// ════════════════════════════════════════════════════════════════════════════

export interface ValidationError {
  code: string;
  ruleId: string;
  message: string;
  section: string;
  item?: string;
  field?: string;
  context?: Record<string, unknown>;
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
    byRuleId: Record<string, number>;
  };
  rulesVersion: string;
  timestamp: string;
}

export interface PostImportResult {
  actionId: string;
  message: string;
  affectedItems: string[];
  changes: Record<string, unknown>;
}

export interface ImportAuditReport extends ValidationReport {
  mode: 'replace' | 'increment';
  postImportResults: PostImportResult[];
  disabledFamilies: string[];
  orphanSkus: string[];
  familiesWithoutSku: string[];
}

// ════════════════════════════════════════════════════════════════════════════
// CACHE DE REGRAS
// ════════════════════════════════════════════════════════════════════════════

let cachedRules: ValidationRulesConfig | null = null;

export async function loadValidationRules(): Promise<ValidationRulesConfig> {
  if (cachedRules) return cachedRules;
  
  try {
    const response = await fetch('/data/validation_rules.json');
    if (!response.ok) {
      throw new Error(`Failed to load validation rules: ${response.status}`);
    }
    cachedRules = await response.json();
    console.log('[ValidationEngine] Rules loaded:', cachedRules?.meta?.version);
    return cachedRules!;
  } catch (error) {
    console.error('[ValidationEngine] Error loading rules:', error);
    throw error;
  }
}

export function clearRulesCache(): void {
  cachedRules = null;
}

// ════════════════════════════════════════════════════════════════════════════
// HELPERS PARA PARSING DE PATHS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Extrai valores de um path como "families[].macro"
 * Retorna array de valores encontrados
 */
function extractValuesFromPath(data: LensData, path: string): { value: unknown; index: number; identifier?: string }[] {
  const results: { value: unknown; index: number; identifier?: string }[] = [];
  
  // Parse path: "section[].field" ou "section[].subfield"
  const match = path.match(/^(\w+)\[\]\.(.+)$/);
  if (!match) {
    // Caminho simples sem array, ex: "meta.version"
    const parts = path.split('.');
    let current: unknown = data;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return [];
      }
    }
    return [{ value: current, index: 0 }];
  }
  
  const [, section, field] = match;
  const array = (data as Record<string, unknown>)[section];
  
  if (!Array.isArray(array)) return [];
  
  array.forEach((item, index) => {
    if (item && typeof item === 'object') {
      const value = (item as Record<string, unknown>)[field];
      const identifier = (item as Record<string, unknown>).id || 
                         (item as Record<string, unknown>).erp_code ||
                         `[${index}]`;
      results.push({ value, index, identifier: String(identifier) });
    }
  });
  
  return results;
}

/**
 * Extrai valores únicos de um path como "macros[].id"
 * Retorna Set de valores
 */
function extractUniqueValuesFromPath(data: LensData, path: string): Set<unknown> {
  const values = extractValuesFromPath(data, path);
  return new Set(values.map(v => v.value).filter(v => v !== null && v !== undefined));
}

// ════════════════════════════════════════════════════════════════════════════
// EXECUTORES DE REGRAS
// ════════════════════════════════════════════════════════════════════════════

function executeStructureRule(rule: StructureRule, data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  
  for (const section of rule.required_sections) {
    if (!(section in data)) {
      errors.push({
        code: 'MISSING_SECTION',
        ruleId: rule.id,
        message: `${rule.message} Seção ausente: "${section}"`,
        section,
        severity: rule.level === 'block' ? 'blocking' : 'warning'
      });
    } else if (data[section as keyof LensData] === null || data[section as keyof LensData] === undefined) {
      errors.push({
        code: 'NULL_SECTION',
        ruleId: rule.id,
        message: `${rule.message} Seção nula: "${section}"`,
        section,
        severity: rule.level === 'block' ? 'blocking' : 'warning'
      });
    }
  }
  
  return errors;
}

function executeReferenceRule(rule: ReferenceRule, data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Extrair seção origem do path (ex: "families" de "families[].macro")
  const fromMatch = rule.from.match(/^(\w+)\[\]/);
  if (!fromMatch) return errors;
  const fromSection = fromMatch[1];
  
  // Obter valores válidos do destino
  const validValues = extractUniqueValuesFromPath(data, rule.to);
  
  // Verificar cada item da origem
  const sourceValues = extractValuesFromPath(data, rule.from);
  
  for (const { value, identifier } of sourceValues) {
    if (value === null || value === undefined) {
      // Campo ausente - não é erro de referência, seria field_presence
      continue;
    }
    
    if (!validValues.has(value)) {
      errors.push({
        code: 'INVALID_REFERENCE',
        ruleId: rule.id,
        message: `${rule.message} (${identifier} → "${value}")`,
        section: fromSection,
        item: identifier,
        field: rule.from.split('.').pop(),
        context: { invalidValue: value },
        severity: rule.level === 'block' ? 'blocking' : 'warning'
      });
    }
  }
  
  return errors;
}

function executeFieldPresenceRule(rule: FieldPresenceRule, data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  
  for (const fieldPath of rule.fields) {
    // Parse path
    const match = fieldPath.match(/^(\w+)\[\]\.(.+)$/);
    if (!match) continue;
    
    const [, section, field] = match;
    const array = (data as Record<string, unknown>)[section];
    
    if (!Array.isArray(array)) continue;
    
    array.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      
      const record = item as Record<string, unknown>;
      const value = record[field];
      const identifier = record.id || record.erp_code || `[${index}]`;
      
      // Verificar se campo está ausente, null, undefined, vazio ou array vazio
      const isEmpty = value === null || 
                      value === undefined || 
                      value === '' ||
                      (Array.isArray(value) && value.length === 0);
      
      // Para price_sale_half_pair, também verificar se é numérico
      if (field === 'price_sale_half_pair') {
        if (isEmpty) {
          errors.push({
            code: 'MISSING_REQUIRED_FIELD',
            ruleId: rule.id,
            message: `${rule.message} (${identifier})`,
            section,
            item: String(identifier),
            field,
            severity: rule.level === 'block' ? 'blocking' : 'warning'
          });
        } else if (typeof value !== 'number' || Number.isNaN(value)) {
          errors.push({
            code: 'INVALID_FIELD_TYPE',
            ruleId: rule.id,
            message: `${rule.message} Valor não numérico: ${value} (${identifier})`,
            section,
            item: String(identifier),
            field,
            severity: rule.level === 'block' ? 'blocking' : 'warning'
          });
        }
      } else if (isEmpty) {
        errors.push({
          code: 'MISSING_REQUIRED_FIELD',
          ruleId: rule.id,
          message: `${rule.message} (${identifier})`,
          section,
          item: String(identifier),
          field,
          severity: rule.level === 'block' ? 'blocking' : 'warning'
        });
      }
    });
  }
  
  return errors;
}

function executeAggregationRule(rule: AggregationRule, data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Handler específico por ID (baseado no definition)
  switch (rule.id) {
    case 'FAMILY_WITHOUT_SKU': {
      // Famílias ativas sem nenhum SKU em prices
      const familiesWithPrices = new Set(
        (data.prices || [])
          .filter(p => p.active !== false)
          .map(p => p.family_id)
      );
      
      (data.families || [])
        .filter(f => f.active !== false)
        .forEach(family => {
          if (!familiesWithPrices.has(family.id)) {
            errors.push({
              code: 'FAMILY_WITHOUT_SKU',
              ruleId: rule.id,
              message: `${rule.message} (${family.id}: ${family.name_original || family.id})`,
              section: 'families',
              item: family.id,
              severity: 'warning'
            });
          }
        });
      break;
    }
    
    case 'SKU_WITHOUT_INDEX_DISPLAY': {
      // SKUs com index que não existe em index_display
      if (!data.index_display || data.index_display.length === 0) break;
      
      const validIndices = new Set(data.index_display.map(i => i.value));
      
      (data.prices || []).forEach(price => {
        if (price.index && !validIndices.has(price.index)) {
          errors.push({
            code: 'SKU_WITHOUT_INDEX_DISPLAY',
            ruleId: rule.id,
            message: `${rule.message} (${price.erp_code} → "${price.index}")`,
            section: 'prices',
            item: price.erp_code,
            field: 'index',
            severity: 'warning'
          });
        }
      });
      break;
    }
    
    default:
      console.warn(`[ValidationEngine] Unknown aggregation rule: ${rule.id}`);
  }
  
  return errors;
}

function executeEnumValidationRule(rule: EnumValidationRule, data: LensData): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Parse field path (e.g. "families[].clinical_type")
  const match = rule.field.match(/^(\w+)\[\]\.(.+)$/);
  if (!match) return errors;
  
  const [, section, field] = match;
  const array = (data as Record<string, unknown>)[section];
  
  if (!Array.isArray(array)) return errors;
  
  const allowedSet = new Set(rule.allowed_values);
  
  array.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    
    const record = item as Record<string, unknown>;
    const value = record[field];
    const identifier = record.id || record.erp_code || `[${index}]`;
    
    // If field is missing/null/undefined
    if (value === null || value === undefined || value === '') {
      // If optional, skip validation
      if (rule.optional) return;
      // Otherwise, skip - will be caught by field_presence rule if needed
      return;
    }
    
    // Check if value is in allowed set
    if (!allowedSet.has(String(value))) {
      errors.push({
        code: 'INVALID_ENUM_VALUE',
        ruleId: rule.id,
        message: `${rule.message} (${identifier} → "${value}")`,
        section,
        item: String(identifier),
        field,
        context: { invalidValue: value, allowed: rule.allowed_values },
        severity: rule.level === 'block' ? 'blocking' : 'warning'
      });
    }
  });
  
  return errors;
}

// ════════════════════════════════════════════════════════════════════════════
// ENGINE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

/**
 * Executa todas as regras de validação do JSON importado
 */
export async function validateCatalogImport(
  data: LensData,
  mode: 'replace' | 'increment' = 'replace'
): Promise<ValidationReport> {
  const rules = await loadValidationRules();
  const allErrors: ValidationError[] = [];
  const byRuleId: Record<string, number> = {};
  
  // Executar regras bloqueantes primeiro
  for (const rule of rules.blocking_rules) {
    let ruleErrors: ValidationError[] = [];
    
    switch (rule.type) {
      case 'structure':
        ruleErrors = executeStructureRule(rule as StructureRule, data);
        break;
      case 'reference':
        ruleErrors = executeReferenceRule(rule as ReferenceRule, data);
        break;
      case 'field_presence':
        ruleErrors = executeFieldPresenceRule(rule as FieldPresenceRule, data);
        break;
      case 'aggregation':
        ruleErrors = executeAggregationRule(rule as AggregationRule, data);
        break;
      case 'enum_validation':
        ruleErrors = executeEnumValidationRule(rule as EnumValidationRule, data);
        break;
    }
    
    if (ruleErrors.length > 0) {
      byRuleId[rule.id] = ruleErrors.length;
      allErrors.push(...ruleErrors);
    }
  }
  
  // Se houver erros bloqueantes estruturais, parar aqui
  const structuralErrors = allErrors.filter(e => 
    e.severity === 'blocking' && e.code === 'MISSING_SECTION'
  );
  if (structuralErrors.length > 0) {
    return buildReport(allErrors, byRuleId, rules.meta.version);
  }
  
  // Executar regras de warning
  for (const rule of rules.warning_rules) {
    let ruleErrors: ValidationError[] = [];
    
    switch (rule.type) {
      case 'structure':
        ruleErrors = executeStructureRule(rule as StructureRule, data);
        break;
      case 'reference':
        ruleErrors = executeReferenceRule(rule as ReferenceRule, data);
        break;
      case 'field_presence':
        ruleErrors = executeFieldPresenceRule(rule as FieldPresenceRule, data);
        break;
      case 'aggregation':
        ruleErrors = executeAggregationRule(rule as AggregationRule, data);
        break;
      case 'enum_validation':
        ruleErrors = executeEnumValidationRule(rule as EnumValidationRule, data);
        break;
    }
    
    if (ruleErrors.length > 0) {
      byRuleId[rule.id] = ruleErrors.length;
      allErrors.push(...ruleErrors);
    }
  }
  
  return buildReport(allErrors, byRuleId, rules.meta.version);
}

function buildReport(
  errors: ValidationError[], 
  byRuleId: Record<string, number>,
  rulesVersion: string
): ValidationReport {
  const blockingErrors = errors.filter(e => e.severity === 'blocking');
  const warnings = errors.filter(e => e.severity === 'warning');
  
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
      affectedSkus: Array.from(affectedSkus),
      byRuleId
    },
    rulesVersion,
    timestamp: new Date().toISOString()
  };
}

// ════════════════════════════════════════════════════════════════════════════
// AÇÕES PÓS-IMPORT (GOVERNANÇA: Requer confirmação explícita)
// ════════════════════════════════════════════════════════════════════════════

export interface PendingPostImportAction {
  actionId: string;
  message: string;
  affectedItems: string[];
  changes: Record<string, unknown>;
}

/**
 * Identifica ações pós-import que PRECISAM de confirmação do usuário.
 * GOVERNANÇA: Não executa automaticamente - apenas identifica e retorna para confirmação.
 */
export async function identifyPostImportActions(
  data: LensData,
  report: ValidationReport
): Promise<PendingPostImportAction[]> {
  const rules = await loadValidationRules();
  const pendingActions: PendingPostImportAction[] = [];
  
  for (const action of rules.post_import_actions) {
    const [level, ruleId] = action.trigger.split(':');
    const hasWarning = report.warnings.some(w => w.ruleId === ruleId);
    
    if (!hasWarning && level === 'warning') continue;
    
    if (action.id === 'AUTO_DISABLE_FAMILIES_WITHOUT_SKU') {
      const familyWarnings = report.warnings.filter(w => w.ruleId === 'FAMILY_WITHOUT_SKU');
      const affectedIds = familyWarnings.map(w => w.item).filter(Boolean) as string[];
      
      if (affectedIds.length > 0) {
        pendingActions.push({
          actionId: action.id,
          message: action.message,
          affectedItems: affectedIds,
          changes: action.action.set
        });
      }
    }
  }
  
  return pendingActions;
}

/**
 * Aplica uma ação pós-import APÓS confirmação explícita do usuário.
 * GOVERNANÇA: Só deve ser chamada após o usuário confirmar a ação.
 */
export function applyConfirmedPostImportAction(
  data: LensData,
  action: PendingPostImportAction
): LensData {
  let modifiedData = { ...data, families: [...(data.families || [])] };
  
  if (action.actionId === 'AUTO_DISABLE_FAMILIES_WITHOUT_SKU') {
    const affectedIds = new Set(action.affectedItems);
    
    modifiedData.families = modifiedData.families.map(family => {
      if (affectedIds.has(family.id)) {
        return {
          ...family,
          active: false,
          availability_status: 'SEM_SKU_NO_ERP'
        };
      }
      return family;
    });
  }
  
  return modifiedData;
}

/**
 * @deprecated Use identifyPostImportActions + applyConfirmedPostImportAction
 * Mantido para compatibilidade - será removido em versão futura.
 * GOVERNANÇA: Esta função NÃO deve ser usada em produção.
 */
export async function executePostImportActions(
  data: LensData,
  report: ValidationReport
): Promise<{ modifiedData: LensData; results: PostImportResult[] }> {
  console.warn('[GOVERNANÇA] executePostImportActions está deprecated. Use identifyPostImportActions + applyConfirmedPostImportAction.');
  
  const pendingActions = await identifyPostImportActions(data, report);
  const results: PostImportResult[] = [];
  let modifiedData = data;
  
  // GOVERNANÇA: Retorna os dados SEM modificar automaticamente
  // As ações pendentes são retornadas para confirmação
  for (const action of pendingActions) {
    results.push({
      actionId: action.actionId,
      message: `[PENDENTE] ${action.message} (${action.affectedItems.length} itens aguardando confirmação)`,
      affectedItems: action.affectedItems,
      changes: action.changes
    });
  }
  
  return { modifiedData, results };
}

// ════════════════════════════════════════════════════════════════════════════
// AUDITORIA DO CATÁLOGO
// ════════════════════════════════════════════════════════════════════════════

export interface CatalogAuditResult {
  orphanSkus: Array<{ erp_code: string; family_id: string }>;
  familiesWithoutSku: Array<{ id: string; name: string }>;
  disabledFamilies: Array<{ id: string; name: string; reason: string }>;
  blockingSummary: Record<string, number>;
  warningSummary: Record<string, number>;
  timestamp: string;
}

/**
 * Executa auditoria completa do catálogo atual
 */
export async function auditCatalog(data: LensData): Promise<CatalogAuditResult> {
  const report = await validateCatalogImport(data);
  
  // SKUs órfãos (family_id inexistente)
  const familyIds = new Set((data.families || []).map(f => f.id));
  const orphanSkus = (data.prices || [])
    .filter(p => !familyIds.has(p.family_id))
    .map(p => ({ erp_code: p.erp_code, family_id: p.family_id }));
  
  // Famílias ativas sem SKU
  const familiesWithPrices = new Set((data.prices || []).map(p => p.family_id));
  const familiesWithoutSku = (data.families || [])
    .filter(f => f.active !== false && !familiesWithPrices.has(f.id))
    .map(f => ({ id: f.id, name: f.name_original || f.id }));
  
  // Famílias desativadas automaticamente
  const disabledFamilies = (data.families || [])
    .filter(f => f.active === false && f.availability_status === 'SEM_SKU_NO_ERP')
    .map(f => ({ 
      id: f.id, 
      name: f.name_original || f.id,
      reason: 'SEM_SKU_NO_ERP' 
    }));
  
  // Resumo por regra
  const blockingSummary: Record<string, number> = {};
  const warningSummary: Record<string, number> = {};
  
  report.blockingErrors.forEach(e => {
    blockingSummary[e.ruleId] = (blockingSummary[e.ruleId] || 0) + 1;
  });
  
  report.warnings.forEach(e => {
    warningSummary[e.ruleId] = (warningSummary[e.ruleId] || 0) + 1;
  });
  
  return {
    orphanSkus,
    familiesWithoutSku,
    disabledFamilies,
    blockingSummary,
    warningSummary,
    timestamp: new Date().toISOString()
  };
}

// ════════════════════════════════════════════════════════════════════════════
// EXPORTAÇÃO DE RELATÓRIO
// ════════════════════════════════════════════════════════════════════════════

export function formatValidationReport(report: ValidationReport): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '              RELATÓRIO DE VALIDAÇÃO DE IMPORTAÇÃO             ',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Status: ${report.isValid ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`,
    `Versão das Regras: ${report.rulesVersion}`,
    `Data/Hora: ${new Date(report.timestamp).toLocaleString('pt-BR')}`,
    '',
    `Erros Bloqueantes: ${report.summary.totalBlockingErrors}`,
    `Alertas: ${report.summary.totalWarnings}`,
    `Famílias Afetadas: ${report.summary.affectedFamilies.length}`,
    `SKUs Afetados: ${report.summary.affectedSkus.length}`,
    '',
  ];
  
  if (report.blockingErrors.length > 0) {
    lines.push('─── ERROS BLOQUEANTES ───', '');
    report.blockingErrors.forEach(e => {
      lines.push(`[${e.ruleId}] ${e.message}`);
    });
    lines.push('');
  }
  
  if (report.warnings.length > 0) {
    lines.push('─── ALERTAS ───', '');
    report.warnings.forEach(e => {
      lines.push(`[${e.ruleId}] ${e.message}`);
    });
    lines.push('');
  }
  
  lines.push('─── CONTAGEM POR REGRA ───', '');
  Object.entries(report.summary.byRuleId).forEach(([ruleId, count]) => {
    lines.push(`  ${ruleId}: ${count}`);
  });
  
  return lines.join('\n');
}

export function exportAuditToCSV(audit: CatalogAuditResult): string {
  const lines: string[] = ['Tipo,ID,Nome,Razão/FamilyID'];
  
  audit.orphanSkus.forEach(s => {
    lines.push(`SKU Órfão,${s.erp_code},,${s.family_id}`);
  });
  
  audit.familiesWithoutSku.forEach(f => {
    lines.push(`Família sem SKU,${f.id},${f.name},`);
  });
  
  audit.disabledFamilies.forEach(f => {
    lines.push(`Família Desativada,${f.id},${f.name},${f.reason}`);
  });
  
  return lines.join('\n');
}

export function exportAuditToJSON(audit: CatalogAuditResult): string {
  return JSON.stringify(audit, null, 2);
}
