import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CompanySettings } from '@/components/budget/BudgetDocument';

export const useCompanySettings = () => {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('company_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setSettings({
            company_name: data.company_name,
            logo_url: data.logo_url,
            slogan: data.slogan,
            phone: data.phone,
            whatsapp: data.whatsapp,
            email: data.email,
            address: data.address,
            cnpj: data.cnpj,
            budget_terms: data.budget_terms,
            footer_text: data.footer_text,
          });
        } else {
          // Default settings if none exist
          setSettings({
            company_name: 'Ótica',
          });
        }
      } catch (err) {
        console.error('Error fetching company settings:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar configurações');
        setSettings({
          company_name: 'Ótica',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { settings, isLoading, error };
};
