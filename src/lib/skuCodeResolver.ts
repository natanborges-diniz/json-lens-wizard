/**
 * SKU Code Resolver - Single source of truth for SKU display codes
 * 
 * REGRA OBRIGATÓRIA:
 * 1. Priorizar price.sku_erp
 * 2. Fallback: price.erp_code
 * 3. Se nenhum existir: retorna null (NÃO inventar, NÃO exibir)
 * 4. O SKU exibido deve bater 1:1 com o ERP
 */

import type { Price } from '@/types/lens';

/**
 * Resolve the display SKU code from a Price object.
 * Returns null if no valid SKU code exists (catalog error).
 */
export function resolveSkuCode(price: Price): string | null {
  if (price.sku_erp && price.sku_erp.trim() !== '') return price.sku_erp.trim();
  if (price.erp_code && price.erp_code.trim() !== '') return price.erp_code.trim();
  return null;
}

/**
 * Check if a Price has a valid SKU code.
 * Prices without valid SKU codes should be flagged as catalog errors.
 */
export function hasValidSkuCode(price: Price): boolean {
  return resolveSkuCode(price) !== null;
}
