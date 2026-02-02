/**
 * useCatalogLoader - Hook centralizado para carregamento do catálogo
 * 
 * ARQUITETURA CLOUD-ONLY:
 * - Nuvem (Supabase Storage) é a ÚNICA fonte de verdade
 * - Não há fallback local - catálogo deve ser importado via Admin
 * - Auto-save para nuvem em todas as edições
 */

import { useState, useCallback } from 'react';
import { useLensStore } from '@/store/lensStore';
import { toast } from 'sonner';

export interface CatalogLoaderResult {
  isLoading: boolean;
  loadCatalog: () => Promise<boolean>;
  lastLoadedAt: string | null;
}

export function useCatalogLoader(): CatalogLoaderResult {
  const [isLoading, setIsLoading] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  
  const { loadCatalogFromCloud } = useLensStore();

  /**
   * Carrega catálogo exclusivamente da nuvem
   * Se nuvem estiver vazia, orienta o admin a importar via Dashboard
   */
  const loadCatalog = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      console.log('[CatalogLoader] Loading from cloud (single source of truth)...');
      const cloudLoaded = await loadCatalogFromCloud();
      
      if (cloudLoaded) {
        setLastLoadedAt(new Date().toISOString());
        console.log('[CatalogLoader] ✓ Loaded from cloud');
        return true;
      }

      // Nuvem vazia - orientar importação via Admin
      console.warn('[CatalogLoader] Cloud catalog is empty');
      toast.error('Catálogo não encontrado. Importe um catálogo via Admin → Edição Manual.');
      return false;
    } catch (error) {
      console.error('[CatalogLoader] Load error:', error);
      toast.error('Erro ao carregar catálogo da nuvem');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadCatalogFromCloud]);

  return {
    isLoading,
    loadCatalog,
    lastLoadedAt,
  };
}
