/**
 * xlsxToPricesPatch - Converts XLSX workbook to PricePatch[] using supplier_profiles config
 * Plan 6: ERP Native Import
 */

import * as XLSX from 'xlsx';
import type { PricePatch, FamilyExtended, PriceSpec } from '@/types/lens';

export interface XlsxPatchResult {
  prices_patch: PricePatch[];
  stats: {
    rows_read: number;
    rows_valid: number;
    rows_ignored: number;
    rows_error: number;
  };
  errors: string[];
}

interface FamilyDictEntry {
  family_id: string;
  contains?: string[];
  exact?: string;
  priority?: number;
}

/**
 * Normalize a numeric value from string (handles comma as decimal separator)
 */
function normalizeNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') return isNaN(value) ? undefined : value;
  const str = String(value).trim().replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? undefined : num;
}

/**
 * Normalize a boolean-like value
 */
function normalizeBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === null || value === undefined || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  const str = String(value).trim().toUpperCase();
  if (['SIM', 'S', 'YES', 'Y', '1', 'TRUE', 'ATIVO', 'ATIVA'].includes(str)) return true;
  if (['NAO', 'NÃO', 'N', 'NO', '0', 'FALSE', 'INATIVO', 'INATIVA'].includes(str)) return false;
  return defaultValue;
}

/**
 * Resolve family_id from description using family_dictionary keywords
 */
function resolveFamilyId(
  description: string,
  familyDictionary: FamilyDictEntry[],
  catalogFamilies: FamilyExtended[]
): string | undefined {
  if (!description || !familyDictionary?.length) return undefined;

  const descUpper = description.toUpperCase();
  const familyIds = new Set(catalogFamilies.map(f => f.id));

  // Sort by priority (higher first), then by specificity (more keywords = more specific)
  const sorted = [...familyDictionary].sort((a, b) => {
    const pA = a.priority ?? 0;
    const pB = b.priority ?? 0;
    if (pB !== pA) return pB - pA;
    return (b.contains?.length ?? 0) - (a.contains?.length ?? 0);
  });

  for (const entry of sorted) {
    if (!familyIds.has(entry.family_id)) continue;

    if (entry.exact && descUpper === entry.exact.toUpperCase()) {
      return entry.family_id;
    }

    if (entry.contains?.length) {
      const allMatch = entry.contains.every(kw => descUpper.includes(kw.toUpperCase()));
      if (allMatch) return entry.family_id;
    }
  }

  return undefined;
}

/**
 * Get cell value from row using column mapping
 */
function getMappedValue(row: Record<string, unknown>, columnMapping: Record<string, string>, field: string): unknown {
  const colName = columnMapping[field];
  if (!colName) return undefined;
  return row[colName];
}

/**
 * Parse XLSX workbook into PricePatch[] using supplier configuration
 */
export function xlsxToPricesPatch(
  workbook: XLSX.WorkBook,
  supplier: string,
  columnMapping: Record<string, string>,
  familyDictionary: FamilyDictEntry[],
  catalogFamilies: FamilyExtended[]
): XlsxPatchResult {
  const errors: string[] = [];
  const prices_patch: PricePatch[] = [];

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { prices_patch: [], stats: { rows_read: 0, rows_valid: 0, rows_ignored: 0, rows_error: 0 }, errors: ['Workbook sem sheets'] };
  }

  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  let rows_ignored = 0;
  let rows_error = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel row (1-indexed + header)

    const erp_code = String(getMappedValue(row, columnMapping, 'erp_code') ?? '').trim();
    if (!erp_code) {
      rows_ignored++;
      continue;
    }

    const description = String(getMappedValue(row, columnMapping, 'description') ?? '').trim();
    const family_id = resolveFamilyId(description, familyDictionary, catalogFamilies);

    const price_sale = normalizeNumber(getMappedValue(row, columnMapping, 'price_sale'));
    const price_purchase = normalizeNumber(getMappedValue(row, columnMapping, 'price_purchase'));
    const active = normalizeBoolean(getMappedValue(row, columnMapping, 'status'), true);

    // Parse specs ranges
    const specs: Partial<PriceSpec> = {};
    const sphere_min = normalizeNumber(getMappedValue(row, columnMapping, 'sphere_min'));
    const sphere_max = normalizeNumber(getMappedValue(row, columnMapping, 'sphere_max'));
    const cyl_min = normalizeNumber(getMappedValue(row, columnMapping, 'cyl_min'));
    const cyl_max = normalizeNumber(getMappedValue(row, columnMapping, 'cyl_max'));
    const add_min = normalizeNumber(getMappedValue(row, columnMapping, 'add_min'));
    const add_max = normalizeNumber(getMappedValue(row, columnMapping, 'add_max'));
    const diameter_min = normalizeNumber(getMappedValue(row, columnMapping, 'diameter_min'));
    const diameter_max = normalizeNumber(getMappedValue(row, columnMapping, 'diameter_max'));
    const altura_min = normalizeNumber(getMappedValue(row, columnMapping, 'altura_min'));
    const altura_max = normalizeNumber(getMappedValue(row, columnMapping, 'altura_max'));

    if (sphere_min !== undefined) specs.sphere_min = sphere_min;
    if (sphere_max !== undefined) specs.sphere_max = sphere_max;
    if (cyl_min !== undefined) specs.cyl_min = cyl_min;
    if (cyl_max !== undefined) specs.cyl_max = cyl_max;
    if (add_min !== undefined) specs.add_min = add_min;
    if (add_max !== undefined) specs.add_max = add_max;
    if (diameter_min !== undefined) specs.diameter_min_mm = diameter_min;
    if (diameter_max !== undefined) specs.diameter_max_mm = diameter_max;
    if (altura_min !== undefined) specs.altura_min_mm = altura_min;
    if (altura_max !== undefined) specs.altura_max_mm = altura_max;

    const patch: PricePatch = {
      supplier,
      erp_code,
      ...(family_id && { family_id }),
      ...(description && { description }),
      ...(price_sale !== undefined && { price_sale_half_pair: price_sale }),
      ...(price_purchase !== undefined && { price_purchase_half_pair: price_purchase }),
      active,
      ...(Object.keys(specs).length > 0 && { specs }),
    };

    if (!family_id) {
      errors.push(`Linha ${rowNum}: family_id não resolvido para erp_code="${erp_code}" (desc="${description.substring(0, 50)}")`);
      // Still include the patch — it may match an existing SKU where family_id is optional
    }

    prices_patch.push(patch);
  }

  return {
    prices_patch,
    stats: {
      rows_read: rows.length,
      rows_valid: prices_patch.length,
      rows_ignored,
      rows_error,
    },
    errors,
  };
}
