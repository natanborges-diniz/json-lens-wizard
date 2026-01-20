/**
 * useCatalogLoader - Hook centralizado para carregamento do catálogo
 * 
 * POLÍTICA DE CARREGAMENTO:
 * - forceLocal=true: SEMPRE usa arquivo local (para imports explícitos)
 * - forceLocal=false (padrão): Tenta nuvem, fallback local
 * 
 * Esta arquitetura elimina a confusão local vs nuvem:
 * - Quando usuário faz IMPORT explícito → forceLocal=true → arquivo local é lei
 * - Quando app carrega normalmente → usa nuvem (que foi sincronizada do último import)
 */

import { useState, useCallback } from 'react';
import { useLensStore } from '@/store/lensStore';
import { supabase } from '@/integrations/supabase/client';
import type { LensData } from '@/types/lens';
import { toast } from 'sonner';

export type LoadSource = 'cloud' | 'local' | 'none';

export interface CatalogLoaderResult {
  isLoading: boolean;
  loadSource: LoadSource;
  loadCatalog: (forceLocal?: boolean) => Promise<boolean>;
  reloadFromLocal: () => Promise<boolean>;
  syncLocalToCloud: () => Promise<boolean>;
  lastLoadedAt: string | null;
}

export function useCatalogLoader(): CatalogLoaderResult {
  const [isLoading, setIsLoading] = useState(false);
  const [loadSource, setLoadSource] = useState<LoadSource>('none');
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  
  const { loadLensData, saveCatalogToCloud, loadCatalogFromCloud } = useLensStore();

  /**
   * Carrega o catálogo local do arquivo público
   */
  const loadLocalCatalog = useCallback(async (): Promise<LensData | null> => {
    try {
      const response = await fetch('/data/lenses.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: LensData = await response.json();
      console.log('[CatalogLoader] Local catalog loaded:', {
        families: data.families?.length || 0,
        prices: data.prices?.length || 0,
        occupationalFamilies: data.families?.filter(f => f.category === 'OCUPACIONAL').length || 0
      });
      return data;
    } catch (error) {
      console.error('[CatalogLoader] Failed to load local catalog:', error);
      return null;
    }
  }, []);

  /**
   * Carrega catálogo priorizando origem conforme flag
   * @param forceLocal - Se true, ignora nuvem e usa apenas local
   */
  const loadCatalog = useCallback(async (forceLocal: boolean = false): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // Modo FORCE LOCAL: ignora completamente a nuvem
      if (forceLocal) {
        console.log('[CatalogLoader] Force local mode - ignoring cloud');
        const localData = await loadLocalCatalog();
        if (localData) {
          loadLensData(localData);
          setLoadSource('local');
          setLastLoadedAt(new Date().toISOString());
          return true;
        }
        toast.error('Falha ao carregar catálogo local');
        return false;
      }

      // Modo NORMAL: tenta nuvem primeiro, fallback local
      console.log('[CatalogLoader] Normal mode - trying cloud first');
      const cloudLoaded = await loadCatalogFromCloud();
      
      if (cloudLoaded) {
        setLoadSource('cloud');
        setLastLoadedAt(new Date().toISOString());
        console.log('[CatalogLoader] Loaded from cloud');
        return true;
      }

      // Fallback para local
      console.log('[CatalogLoader] Cloud failed, falling back to local');
      const localData = await loadLocalCatalog();
      if (localData) {
        loadLensData(localData);
        setLoadSource('local');
        setLastLoadedAt(new Date().toISOString());
        return true;
      }

      toast.error('Nenhum catálogo disponível');
      return false;
    } catch (error) {
      console.error('[CatalogLoader] Load error:', error);
      toast.error('Erro ao carregar catálogo');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadLensData, loadCatalogFromCloud, loadLocalCatalog]);

  /**
   * Força reload do arquivo local e sincroniza com a nuvem
   * Use quando o arquivo local foi atualizado externamente
   */
  const reloadFromLocal = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      console.log('[CatalogLoader] Force reloading from local file...');
      const localData = await loadLocalCatalog();
      
      if (!localData) {
        toast.error('Falha ao carregar arquivo local');
        return false;
      }

      // Carrega no store
      loadLensData(localData);
      setLoadSource('local');
      setLastLoadedAt(new Date().toISOString());

      // Sincroniza automaticamente com a nuvem
      console.log('[CatalogLoader] Syncing to cloud...');
      const syncSuccess = await saveCatalogToCloud();
      
      if (syncSuccess) {
        toast.success('Catálogo recarregado e sincronizado com a nuvem');
      } else {
        toast.warning('Catálogo carregado mas sincronização falhou');
      }

      return true;
    } catch (error) {
      console.error('[CatalogLoader] Reload error:', error);
      toast.error('Erro ao recarregar catálogo');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loadLensData, saveCatalogToCloud, loadLocalCatalog]);

  /**
   * Sincroniza o catálogo atual do store para a nuvem
   */
  const syncLocalToCloud = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await saveCatalogToCloud();
      if (success) {
        toast.success('Catálogo sincronizado com a nuvem');
      } else {
        toast.error('Falha na sincronização');
      }
      return success;
    } catch (error) {
      console.error('[CatalogLoader] Sync error:', error);
      toast.error('Erro na sincronização');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [saveCatalogToCloud]);

  return {
    isLoading,
    loadSource,
    loadCatalog,
    reloadFromLocal,
    syncLocalToCloud,
    lastLoadedAt,
  };
}
