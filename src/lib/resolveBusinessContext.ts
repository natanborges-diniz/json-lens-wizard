/**
 * resolveBusinessContext
 * 
 * Centralizes the decision of which business identity to use in budgets/PDFs.
 * Rule: visual identity + contact → store (if available), policies → company_settings (always).
 */

export interface BusinessContext {
  store_id: string | null;
  company_name: string;
  logo_url: string | null;
  slogan: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  cnpj: string | null;
  budget_terms: string | null;
  footer_text: string | null;
}

interface StoreRecord {
  id: string;
  name: string;
  logo_url?: string | null;
  slogan?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  cnpj?: string | null;
  budget_terms?: string | null;
  footer_text?: string | null;
}

interface CompanyRecord {
  company_name: string;
  logo_url?: string | null;
  slogan?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  cnpj?: string | null;
  budget_terms?: string | null;
  footer_text?: string | null;
}

/**
 * Resolve business context using store > company precedence for identity/contact,
 * and company_settings for global policies (budget_terms, footer_text).
 */
export function resolveBusinessContext(
  companySettings: CompanyRecord | null,
  store?: StoreRecord | null,
): BusinessContext {
  const company = companySettings || { company_name: 'Ótica' };

  // If no store, everything comes from company_settings
  if (!store) {
    if (companySettings) {
      console.log('[BusinessContext] No store selected, using company_settings');
    }
    return {
      store_id: null,
      company_name: company.company_name,
      logo_url: company.logo_url ?? null,
      slogan: company.slogan ?? null,
      phone: company.phone ?? null,
      whatsapp: company.whatsapp ?? null,
      email: company.email ?? null,
      address: company.address ?? null,
      cnpj: company.cnpj ?? null,
      budget_terms: company.budget_terms ?? null,
      footer_text: company.footer_text ?? null,
    };
  }

  // Store provides identity/contact, company provides policies
  return {
    store_id: store.id,
    // Identity & contact: store takes precedence, fallback to company
    company_name: store.name || company.company_name,
    logo_url: store.logo_url ?? company.logo_url ?? null,
    slogan: store.slogan ?? company.slogan ?? null,
    phone: store.phone ?? company.phone ?? null,
    whatsapp: store.whatsapp ?? company.whatsapp ?? null,
    email: store.email ?? company.email ?? null,
    address: store.address ?? company.address ?? null,
    cnpj: store.cnpj ?? company.cnpj ?? null,
    // Policies: store overrides if set, otherwise company
    budget_terms: store.budget_terms ?? company.budget_terms ?? null,
    footer_text: store.footer_text ?? company.footer_text ?? null,
  };
}
