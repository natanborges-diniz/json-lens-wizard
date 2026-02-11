import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface StoreInfo {
  id: string;
  name: string;
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

export const useStoreContext = () => {
  const { user, isAdmin } = useAuth();
  const [stores, setStores] = useState<StoreInfo[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchStores = async () => {
      setIsLoading(true);
      try {
        if (isAdmin) {
          // Admins see all active stores
          const { data, error } = await supabase
            .from('stores')
            .select('*')
            .eq('is_active', true)
            .order('name');
          if (error) throw error;
          setStores(data || []);
        } else {
          // Non-admins see stores they have access to
          const { data: accessData, error: accessError } = await supabase
            .from('user_store_access')
            .select('store_id, has_access_to_all')
            .eq('user_id', user.id);
          if (accessError) throw accessError;

          const hasAccessToAll = accessData?.some(a => a.has_access_to_all);
          
          if (hasAccessToAll) {
            const { data, error } = await supabase
              .from('stores')
              .select('*')
              .eq('is_active', true)
              .order('name');
            if (error) throw error;
            setStores(data || []);
          } else {
            const storeIds = accessData?.map(a => a.store_id) || [];
            if (storeIds.length > 0) {
              const { data, error } = await supabase
                .from('stores')
                .select('*')
                .in('id', storeIds)
                .eq('is_active', true)
                .order('name');
              if (error) throw error;
              setStores(data || []);
            } else {
              setStores([]);
            }
          }
        }
      } catch (err) {
        console.error('[useStoreContext] Error fetching stores:', err);
        setStores([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStores();
  }, [user, isAdmin]);

  // Auto-select if only one store
  useEffect(() => {
    if (!isLoading && stores.length === 1 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [stores, isLoading, selectedStoreId]);

  const selectedStore = stores.find(s => s.id === selectedStoreId) || null;
  const needsStoreSelection = !isLoading && stores.length > 1 && !selectedStoreId;

  return {
    stores,
    selectedStoreId,
    selectedStore,
    setSelectedStoreId,
    needsStoreSelection,
    isLoading,
  };
};
