/**
 * POLÍTICA GLOBAL DE IMPORTAÇÃO DE JSON – CATÁLOGO DE LENTES
 * 
 * Este módulo implementa todas as regras definidas na política:
 * 1. SSOT - JSON é a única fonte da verdade
 * 2. Regras para INCREMENTAR e SUBSTITUIR
 * 3. Preservação de chaves estendidas
 * 4. Contrato de integridade referencial
 * 5. Comprovante de alterações
 * 6. Suporte a rollback
 */

import type { LensData, FamilyExtended, MacroExtended, Price, Addon, PricePatch, ErpPatchPayload, PatchReport, ImportMode } from '@/types/lens';

// ════════════════════════════════════════════════════════════════════════════
// TIPOS
// ════════════════════════════════════════════════════════════════════════════

export interface ImportValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  integrityErrors: string[];
}

export interface ImportSummary {
  mode: ImportMode;
  timestamp: string;
  schemaVersion: string;
  changes: {
    section: string;
    action: 'added' | 'updated' | 'unchanged' | 'removed';
    count: number;
    details?: string[];
  }[];
  totals: {
    macros: number;
    families: number;
    addons: number;
    prices: number;
    technologies: number;
  };
  extendedFields: {
    technology_library: boolean;
    benefit_rules: boolean;
    quote_explainer: boolean;
    index_display: boolean;
  };
}

export interface ImportResult {
  success: boolean;
  validation: ImportValidationResult;
  summary: ImportSummary | null;
  mergedData: LensData | null;
  previousData: LensData | null; // Para rollback
}

// Seções obrigatórias para modo SUBSTITUIR
const REQUIRED_SECTIONS_BASE = ['meta', 'scales', 'attribute_defs', 'macros', 'families', 'addons', 'prices'] as const;

// Seções estendidas (validar se existirem)
const EXTENDED_SECTIONS = ['technology_library', 'benefit_rules', 'quote_explainer', 'index_display'] as const;

// ════════════════════════════════════════════════════════════════════════════
// HELPERS - Verificação de valores vazios
// ════════════════════════════════════════════════════════════════════════════

/**
 * Verifica se um valor é considerado "vazio" segundo a política
 * (null, undefined, {}, [], "")
 */
function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'object' && Object.keys(value as object).length === 0) return true;
  return false;
}

/**
 * Verifica recursivamente se um objeto contém valores vazios em seções críticas
 */
function hasEmptyValues(obj: unknown, path: string = ''): string[] {
  const emptyPaths: string[] = [];
  
  if (isEmptyValue(obj)) {
    emptyPaths.push(path || 'root');
    return emptyPaths;
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      emptyPaths.push(path);
    }
  } else if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      const newPath = path ? `${path}.${key}` : key;
      // Não verificar recursivamente em níveis profundos - apenas nível raiz e primeiro nível
      if (isEmptyValue(value) && !path.includes('.')) {
        emptyPaths.push(newPath);
      }
    }
  }
  
  return emptyPaths;
}

// ════════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO - Modo SUBSTITUIR (Seção 3)
// ════════════════════════════════════════════════════════════════════════════

function validateReplaceMode(data: LensData): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const integrityErrors: string[] = [];

  // 3.1 - Validar presença das seções-base obrigatórias
  for (const section of REQUIRED_SECTIONS_BASE) {
    if (!(section in data)) {
      errors.push(`[REPLACE] Seção obrigatória ausente: "${section}"`);
    } else if (isEmptyValue(data[section])) {
      errors.push(`[REPLACE] Seção "${section}" está vazia`);
    }
  }

  // 3.2 - Validar seções estendidas se existirem
  for (const section of EXTENDED_SECTIONS) {
    if (section in data) {
      if (isEmptyValue(data[section])) {
        errors.push(`[REPLACE] Seção estendida "${section}" presente mas vazia`);
      }
    }
  }

  // Validar estrutura específica de cada seção
  if (data.macros && !isEmptyValue(data.macros)) {
    data.macros.forEach((macro, i) => {
      if (!macro.id) errors.push(`[REPLACE] macros[${i}]: campo "id" ausente`);
      if (!macro.category) errors.push(`[REPLACE] macros[${i}]: campo "category" ausente`);
    });
  }

  if (data.families && !isEmptyValue(data.families)) {
    data.families.forEach((family, i) => {
      if (!family.id) errors.push(`[REPLACE] families[${i}]: campo "id" ausente`);
      if (!family.supplier) errors.push(`[REPLACE] families[${i}]: campo "supplier" ausente`);
      if (!family.macro) errors.push(`[REPLACE] families[${i}]: campo "macro" ausente`);
    });
  }

  if (data.prices && !isEmptyValue(data.prices)) {
    data.prices.forEach((price, i) => {
      if (!price.family_id) errors.push(`[REPLACE] prices[${i}]: campo "family_id" ausente`);
      if (!price.erp_code) errors.push(`[REPLACE] prices[${i}]: campo "erp_code" ausente`);
    });
  }

  // 5. Contrato de integridade referencial
  const integrityResult = validateReferentialIntegrity(data);
  integrityErrors.push(...integrityResult);

  return {
    valid: errors.length === 0 && integrityErrors.length === 0,
    errors,
    warnings,
    integrityErrors
  };
}

// ════════════════════════════════════════════════════════════════════════════
// VALIDAÇÃO - Modo INCREMENTAR (Seção 2)
// ════════════════════════════════════════════════════════════════════════════

function validateIncrementMode(data: Partial<LensData>): ImportValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const integrityErrors: string[] = [];

  // 2.1 - Chaves vazias são IGNORADAS (não atualizadas), apenas geram warnings
  // Isso permite enviar JSONs parciais sem precisar incluir todas as seções
  for (const [key, value] of Object.entries(data)) {
    if (isEmptyValue(value)) {
      warnings.push(`[INCREMENT] Chave "${key}" está vazia e será ignorada (não será atualizada)`);
    }
  }

  // 2.4 - Verificar estrutura das chaves que TÊM dados (não vazias)
  if (data.macros && Array.isArray(data.macros) && data.macros.length > 0) {
    data.macros.forEach((macro, i) => {
      if (!macro.id) errors.push(`[INCREMENT] macros[${i}]: campo "id" obrigatório`);
    });
  }

  if (data.families && Array.isArray(data.families) && data.families.length > 0) {
    data.families.forEach((family, i) => {
      if (!family.id) errors.push(`[INCREMENT] families[${i}]: campo "id" obrigatório`);
    });
  }

  if (data.prices && Array.isArray(data.prices) && data.prices.length > 0) {
    data.prices.forEach((price, i) => {
      if (!price.family_id) errors.push(`[INCREMENT] prices[${i}]: campo "family_id" obrigatório`);
      if (!price.erp_code) errors.push(`[INCREMENT] prices[${i}]: campo "erp_code" obrigatório`);
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    integrityErrors
  };
}

// ════════════════════════════════════════════════════════════════════════════
// INTEGRIDADE REFERENCIAL (Seção 5)
// ════════════════════════════════════════════════════════════════════════════

function validateReferentialIntegrity(data: LensData): string[] {
  const errors: string[] = [];
  
  const macroIds = new Set(data.macros?.map(m => m.id) || []);
  const familyIds = new Set(data.families?.map(f => f.id) || []);
  const technologyIds = new Set(
    data.technology_library?.items 
      ? Object.keys(data.technology_library.items) 
      : []
  );

  // 5.1a - families[].macro deve existir em macros[]
  data.families?.forEach(family => {
    if (family.macro && !macroIds.has(family.macro)) {
      errors.push(`[INTEGRIDADE] Family "${family.id}" referencia macro inexistente: "${family.macro}"`);
    }
  });

  // 5.1b - families[].technology_refs devem existir em technology_library.items
  if (data.technology_library?.items) {
    data.families?.forEach(family => {
      family.technology_refs?.forEach(techRef => {
        if (!technologyIds.has(techRef)) {
          errors.push(`[INTEGRIDADE] Family "${family.id}" referencia tecnologia inexistente: "${techRef}"`);
        }
      });
    });
  }

  // 5.1c - prices[].family_id deve existir em families[]
  data.prices?.forEach(price => {
    if (price.family_id && !familyIds.has(price.family_id)) {
      errors.push(`[INTEGRIDADE] Price "${price.erp_code}" referencia family inexistente: "${price.family_id}"`);
    }
  });

  // 5.1d - macros[].tier_key deve ser válido (se presente)
  const validTierKeys = ['essential', 'comfort', 'advanced', 'top'];
  data.macros?.forEach(macro => {
    if (macro.tier_key && !validTierKeys.includes(macro.tier_key)) {
      errors.push(`[INTEGRIDADE] Macro "${macro.id}" tem tier_key inválido: "${macro.tier_key}"`);
    }
  });

  return errors;
}

// ════════════════════════════════════════════════════════════════════════════
// MERGE - Modo INCREMENTAR (Seção 2.2 e 2.3)
// ════════════════════════════════════════════════════════════════════════════

function mergeIncrementData(currentData: LensData, incrementData: Partial<LensData>): LensData {
  // Criar cópia profunda do dataset atual
  const merged: LensData = JSON.parse(JSON.stringify(currentData));
  
  // Iterar sobre todas as chaves do incremento
  for (const [key, value] of Object.entries(incrementData)) {
    // 2.1 - Ignorar valores vazios
    if (isEmptyValue(value)) {
      continue;
    }

    // 2.2 - Se a chave existe no incremento, substituir COMPLETAMENTE
    if (key === 'meta') {
      // Merge especial para meta - preservar campos existentes, sobrescrever novos
      merged.meta = {
        ...merged.meta,
        ...(value as LensData['meta']),
        counts: {
          ...merged.meta?.counts,
          ...(value as LensData['meta'])?.counts
        }
      };
    } else if (Array.isArray(value)) {
      // Para arrays, substituir completamente
      (merged as any)[key] = value;
    } else if (typeof value === 'object' && value !== null) {
      // Para objetos (como technology_library, scales), fazer merge profundo
      if (key === 'technology_library' && value) {
        merged.technology_library = {
          items: {
            ...(merged.technology_library?.items || {}),
            ...((value as any).items || {})
          }
        };
      } else if (key === 'benefit_rules' && value) {
        merged.benefit_rules = value as LensData['benefit_rules'];
      } else if (key === 'quote_explainer' && value) {
        merged.quote_explainer = value as LensData['quote_explainer'];
      } else if (key === 'scales' && value) {
        merged.scales = {
          ...merged.scales,
          ...(value as LensData['scales'])
        };
      } else {
        (merged as any)[key] = value;
      }
    } else {
      (merged as any)[key] = value;
    }
  }

  return merged;
}

// ════════════════════════════════════════════════════════════════════════════
// RESET DE INATIVOS - Aplicado em cada importação
// ════════════════════════════════════════════════════════════════════════════

/**
 * Reseta o status de itens inativos durante a importação.
 */
export function resetInactiveStatesOnImport(data: LensData): LensData {
  console.log('[CatalogImporter] Resetting inactive states for new import...');
  
  const resetData: LensData = {
    ...data,
    prices: data.prices.map(price => ({
      ...price,
      active: true,
      blocked: false,
    })),
    families: data.families,
    addons: data.addons,
  };
  
  console.log('[CatalogImporter] Reset complete:', {
    prices: resetData.prices.length,
    allPricesActive: resetData.prices.every(p => p.active),
  });
  
  return resetData;
}

// ════════════════════════════════════════════════════════════════════════════
// AUTO-DEACTIVATION (PLAN 3 §5.2)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Families without any active, non-blocked prices are automatically deactivated.
 * This ensures the catalog never surfaces families with no purchasable SKUs.
 */
function deactivateFamiliesWithoutActivePrices(data: LensData): LensData {
  const activePricesByFamily = new Map<string, number>();
  
  // Count active, non-blocked prices per family
  data.prices.forEach(price => {
    if (price.active && !price.blocked) {
      activePricesByFamily.set(price.family_id, (activePricesByFamily.get(price.family_id) || 0) + 1);
    }
  });
  
  let deactivatedCount = 0;
  const deactivatedIds: string[] = [];
  
  const updatedFamilies = data.families.map(family => {
    const activePrices = activePricesByFamily.get(family.id) || 0;
    if (activePrices === 0 && family.active) {
      deactivatedCount++;
      deactivatedIds.push(family.id);
      return { ...family, active: false };
    }
    return family;
  });
  
  if (deactivatedCount > 0) {
    console.log(`[CatalogImporter] PLAN 3 §5.2: Auto-deactivated ${deactivatedCount} families without active prices:`, deactivatedIds);
  }
  
  return { ...data, families: updatedFamilies };
}

// ════════════════════════════════════════════════════════════════════════════
// COMPROVANTE (Seção 8)
// ════════════════════════════════════════════════════════════════════════════

function generateImportSummary(
  mode: ImportMode,
  previousData: LensData | null,
  newData: LensData
): ImportSummary {
  const changes: ImportSummary['changes'] = [];

  const compareArrays = (section: string, prev: any[] | undefined, curr: any[] | undefined, idField: string = 'id') => {
    const prevIds = new Set((prev || []).map(item => item[idField]));
    const currIds = new Set((curr || []).map(item => item[idField]));
    
    const added = [...currIds].filter(id => !prevIds.has(id));
    const removed = [...prevIds].filter(id => !currIds.has(id));
    const unchanged = [...currIds].filter(id => prevIds.has(id));

    if (added.length > 0) {
      changes.push({
        section,
        action: 'added',
        count: added.length,
        details: added.slice(0, 5).map(String)
      });
    }
    if (removed.length > 0) {
      changes.push({
        section,
        action: 'removed',
        count: removed.length,
        details: removed.slice(0, 5).map(String)
      });
    }
    if (unchanged.length > 0 && added.length === 0 && removed.length === 0) {
      changes.push({
        section,
        action: 'unchanged',
        count: unchanged.length
      });
    }
    if (unchanged.length > 0 && (added.length > 0 || removed.length > 0)) {
      changes.push({
        section: `${section} (mantidos)`,
        action: 'unchanged',
        count: unchanged.length
      });
    }
  };

  if (mode === 'replace' || !previousData) {
    changes.push({
      section: 'Catálogo Completo',
      action: 'updated',
      count: 1,
      details: ['Substituição completa do dataset']
    });
  }

  compareArrays('macros', previousData?.macros, newData.macros);
  compareArrays('families', previousData?.families, newData.families);
  compareArrays('addons', previousData?.addons, newData.addons);
  compareArrays('prices', previousData?.prices, newData.prices, 'erp_code');

  // Verificar seções estendidas
  const extendedFields = {
    technology_library: !!newData.technology_library?.items && Object.keys(newData.technology_library.items).length > 0,
    benefit_rules: !!newData.benefit_rules?.rules && newData.benefit_rules.rules.length > 0,
    quote_explainer: !!newData.quote_explainer?.rules && newData.quote_explainer.rules.length > 0,
    index_display: !!newData.index_display && newData.index_display.length > 0
  };

  for (const [field, present] of Object.entries(extendedFields)) {
    const wasPresent = previousData && (previousData as any)[field];
    if (present && !wasPresent) {
      changes.push({
        section: field,
        action: 'added',
        count: 1,
        details: ['Nova seção estendida']
      });
    } else if (!present && wasPresent) {
      changes.push({
        section: field,
        action: 'removed',
        count: 1
      });
    } else if (present) {
      changes.push({
        section: field,
        action: 'updated',
        count: 1
      });
    }
  }

  return {
    mode,
    timestamp: new Date().toISOString(),
    schemaVersion: newData.meta?.schema_version || 'unknown',
    changes,
    totals: {
      macros: newData.macros?.length || 0,
      families: newData.families?.length || 0,
      addons: newData.addons?.length || 0,
      prices: newData.prices?.length || 0,
      technologies: newData.technology_library?.items 
        ? Object.keys(newData.technology_library.items).length 
        : 0
    },
    extendedFields
  };
}

// ════════════════════════════════════════════════════════════════════════════
// ERP PATCH - Merge granular por supplier:erp_code (Plan 6)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Validates an ERP patch payload against current catalog
 */
export function validateErpPatch(
  patch: ErpPatchPayload,
  currentFamilies: FamilyExtended[],
  currentPrices: Price[]
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!patch.prices_patch || !Array.isArray(patch.prices_patch) || patch.prices_patch.length === 0) {
    errors.push('[ERP_PATCH] prices_patch vazio ou ausente');
    return { valid: false, errors, warnings };
  }

  const familyIds = new Set(currentFamilies.map(f => f.id));
  const existingKeys = new Set(currentPrices.map(p => `${p.supplier}:${p.erp_code}`));
  let validCount = 0;

  patch.prices_patch.forEach((item, i) => {
    if (!item.supplier || !item.erp_code) {
      errors.push(`[ERP_PATCH] Item ${i}: supplier e erp_code são obrigatórios`);
      return;
    }

    const key = `${item.supplier}:${item.erp_code}`;
    const isNew = !existingKeys.has(key);

    if (isNew) {
      if (!item.family_id) {
        errors.push(`[ERP_PATCH] Item ${i} (${item.erp_code}): SKU novo requer family_id`);
        return;
      }
      if (!familyIds.has(item.family_id)) {
        errors.push(`[ERP_PATCH] Item ${i} (${item.erp_code}): family_id "${item.family_id}" não existe no catálogo`);
        return;
      }
    }

    validCount++;
  });

  if (validCount === 0 && patch.prices_patch.length > 0) {
    errors.push('[ERP_PATCH] Nenhum item válido após validação');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Merges ERP patch into current catalog data with granular price updates
 */
export function mergeErpPatch(
  currentData: LensData,
  patchPayload: ErpPatchPayload
): { mergedData: LensData; report: PatchReport } {
  const report: PatchReport = {
    added: 0,
    updated: 0,
    unchanged: 0,
    ignored: 0,
    ignored_fields_log: [],
    errors: [],
  };

  const allowDescUpdate = patchPayload.options?.allow_description_update === true;

  // Build index map preserving original positions
  const priceMap = new Map<string, { price: Price; originalIndex: number }>();
  currentData.prices.forEach((price, idx) => {
    const key = `${price.supplier}:${price.erp_code}`;
    priceMap.set(key, { price: { ...price }, originalIndex: idx });
  });

  const familyIds = new Set(currentData.families.map(f => f.id));
  const newPrices: Price[] = [];

  // Protected fields for existing SKUs
  const ALWAYS_PROTECTED = ['family_id', 'index', 'index_value'];

  for (const patch of patchPayload.prices_patch) {
    if (!patch.supplier || !patch.erp_code) {
      report.errors.push(`SKU sem supplier/erp_code ignorado`);
      report.ignored++;
      continue;
    }

    const key = `${patch.supplier}:${patch.erp_code}`;
    const existing = priceMap.get(key);

    if (existing) {
      // ─── UPDATE existing SKU ───
      const ignoredFields: string[] = [];
      const patchFields: Partial<Price> = {};

      // Build update object, skipping protected fields
      if (patch.price_sale_half_pair !== undefined) patchFields.price_sale_half_pair = patch.price_sale_half_pair;
      if (patch.price_purchase_half_pair !== undefined) patchFields.price_purchase_half_pair = patch.price_purchase_half_pair;
      if (patch.active !== undefined) patchFields.active = patch.active;
      if (patch.blocked !== undefined) patchFields.blocked = patch.blocked;
      if (patch.clinical_type !== undefined) patchFields.clinical_type = patch.clinical_type;
      if (patch.manufacturing_type !== undefined) patchFields.manufacturing_type = patch.manufacturing_type;
      if (patch.process !== undefined) patchFields.process = patch.process;

      // Merge specs if provided
      if (patch.specs && Object.keys(patch.specs).length > 0) {
        patchFields.specs = { ...existing.price.specs, ...patch.specs } as Price['specs'];
      }

      // family_id: always ignored for existing SKU
      if (patch.family_id !== undefined) {
        ignoredFields.push('family_id');
      }

      // description: ignored unless flag set
      if (patch.description !== undefined) {
        if (allowDescUpdate) {
          patchFields.description = patch.description;
        } else {
          ignoredFields.push('description');
        }
      }

      // Check if anything actually changed
      let hasChanges = false;
      for (const [field, value] of Object.entries(patchFields)) {
        if (field === 'specs') {
          // Deep compare specs
          const oldSpecs = JSON.stringify(existing.price.specs);
          const newSpecs = JSON.stringify(value);
          if (oldSpecs !== newSpecs) { hasChanges = true; break; }
        } else if ((existing.price as any)[field] !== value) {
          hasChanges = true;
          break;
        }
      }

      if (hasChanges) {
        existing.price = { ...existing.price, ...patchFields };
        report.updated++;
      } else {
        report.unchanged++;
      }

      if (ignoredFields.length > 0) {
        report.ignored_fields_log.push({ erp_code: patch.erp_code, fields: ignoredFields });
      }
    } else {
      // ─── NEW SKU ───
      if (!patch.family_id) {
        report.errors.push(`SKU novo "${patch.erp_code}": family_id obrigatório`);
        report.ignored++;
        continue;
      }
      if (!familyIds.has(patch.family_id)) {
        report.errors.push(`SKU novo "${patch.erp_code}": family_id "${patch.family_id}" não existe`);
        report.ignored++;
        continue;
      }

      const newPrice: Price = {
        family_id: patch.family_id,
        erp_code: patch.erp_code,
        supplier: patch.supplier,
        description: patch.description || '',
        lens_category_raw: '',
        manufacturing_type: patch.manufacturing_type || '',
        index: '',
        price_purchase_half_pair: patch.price_purchase_half_pair || 0,
        price_sale_half_pair: patch.price_sale_half_pair || 0,
        active: patch.active ?? true,
        blocked: patch.blocked ?? false,
        specs: {
          diameter_min_mm: 0,
          diameter_max_mm: 0,
          altura_min_mm: 0,
          altura_max_mm: 0,
          sphere_min: 0,
          sphere_max: 0,
          cyl_min: 0,
          cyl_max: 0,
          ...(patch.specs || {}),
        } as Price['specs'],
        ...(patch.clinical_type && { clinical_type: patch.clinical_type }),
        ...(patch.process && { process: patch.process }),
      };

      newPrices.push(newPrice);
      report.added++;
    }
  }

  // Rebuild prices: existing in original order + new at end
  const rebuiltPrices: Price[] = new Array(currentData.prices.length);
  for (const [, entry] of priceMap) {
    rebuiltPrices[entry.originalIndex] = entry.price;
  }
  // Append new
  rebuiltPrices.push(...newPrices);

  const mergedData: LensData = {
    ...currentData,
    prices: rebuiltPrices,
  };

  console.log('[CatalogImporter] ERP Patch report:', report);
  return { mergedData, report };
}

// ════════════════════════════════════════════════════════════════════════════
// FUNÇÕES PÚBLICAS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Valida um JSON de importação segundo a política global
 */
export function validateImport(
  data: unknown, 
  mode: ImportMode
): ImportValidationResult {
  // Verificar se é um objeto válido
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['JSON inválido: não é um objeto'],
      warnings: [],
      integrityErrors: []
    };
  }

  if (mode === 'replace') {
    return validateReplaceMode(data as LensData);
  } else {
    return validateIncrementMode(data as Partial<LensData>);
  }
}

/**
 * Executa a importação completa com validação, merge e geração de comprovante
 */
export function executeImport(
  importData: unknown,
  currentData: LensData | null,
  mode: ImportMode
): ImportResult {
  // Validar primeiro
  const validation = validateImport(importData, mode);
  
  if (!validation.valid) {
    return {
      success: false,
      validation,
      summary: null,
      mergedData: null,
      previousData: currentData
    };
  }

  let mergedData: LensData;
  
  if (mode === 'replace') {
    // Substituição completa
    mergedData = importData as LensData;
  } else {
    // Incremento: merge com dados existentes
    if (!currentData) {
      return {
        success: false,
        validation: {
          valid: false,
          errors: ['[INCREMENT] Modo incrementar requer dados existentes no catálogo'],
          warnings: [],
          integrityErrors: []
        },
        summary: null,
        mergedData: null,
        previousData: null
      };
    }
    mergedData = mergeIncrementData(currentData, importData as Partial<LensData>);
  }

  // PLAN 3 §5.2: Auto-deactivate families without active prices
  mergedData = deactivateFamiliesWithoutActivePrices(mergedData);

  // Validar integridade do resultado final
  const finalIntegrityCheck = validateReferentialIntegrity(mergedData);
  if (finalIntegrityCheck.length > 0) {
    return {
      success: false,
      validation: {
        valid: false,
        errors: [],
        warnings: validation.warnings,
        integrityErrors: finalIntegrityCheck
      },
      summary: null,
      mergedData: null,
      previousData: currentData
    };
  }

  // Gerar comprovante
  const summary = generateImportSummary(mode, currentData, mergedData);

  return {
    success: true,
    validation,
    summary,
    mergedData,
    previousData: currentData
  };
}

/**
 * Formata o comprovante para exibição
 */
export function formatImportReceipt(summary: ImportSummary): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '                    COMPROVANTE DE IMPORTAÇÃO                   ',
    '═══════════════════════════════════════════════════════════════',
    '',
    `Modo: ${summary.mode.toUpperCase()}`,
    `Data/Hora: ${new Date(summary.timestamp).toLocaleString('pt-BR')}`,
    `Schema Version: ${summary.schemaVersion}`,
    '',
    '───────────────────────────────────────────────────────────────',
    '                         ALTERAÇÕES                            ',
    '───────────────────────────────────────────────────────────────',
  ];

  for (const change of summary.changes) {
    const actionEmoji = {
      'added': '➕',
      'updated': '🔄',
      'unchanged': '✓',
      'removed': '➖'
    }[change.action];
    
    lines.push(`${actionEmoji} ${change.section}: ${change.count} item(s) ${change.action}`);
    if (change.details && change.details.length > 0) {
      lines.push(`   └─ ${change.details.join(', ')}${change.details.length >= 5 ? '...' : ''}`);
    }
  }

  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('                          TOTAIS                              ');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`Macros: ${summary.totals.macros}`);
  lines.push(`Famílias: ${summary.totals.families}`);
  lines.push(`Add-ons: ${summary.totals.addons}`);
  lines.push(`SKUs/Preços: ${summary.totals.prices}`);
  lines.push(`Tecnologias: ${summary.totals.technologies}`);
  lines.push('');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push('                    CAMPOS ESTENDIDOS                         ');
  lines.push('───────────────────────────────────────────────────────────────');
  lines.push(`technology_library: ${summary.extendedFields.technology_library ? '✓' : '✗'}`);
  lines.push(`benefit_rules: ${summary.extendedFields.benefit_rules ? '✓' : '✗'}`);
  lines.push(`quote_explainer: ${summary.extendedFields.quote_explainer ? '✓' : '✗'}`);
  lines.push(`index_display: ${summary.extendedFields.index_display ? '✓' : '✗'}`);
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
