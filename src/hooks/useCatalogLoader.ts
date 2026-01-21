/**
 * useCatalogLoader - Hook centralizado para carregamento do catálogo
 * 
 * ARQUITETURA SIMPLIFICADA:
 * - Nuvem é a ÚNICA fonte de verdade
 * - Arquivo local é usado apenas para seed inicial (quando nuvem está vazia)
 * - Auto-save para nuvem em todas as edições
 */

import { useState, useCallback } from 'react';
import { useLensStore } from '@/store/lensStore';
import type { LensData } from '@/types/lens';
import { toast } from 'sonner';

export interface CatalogLoaderResult {
  isLoading: boolean;
  loadCatalog: () => Promise<boolean>;
  lastLoadedAt: string | null;
}

export function useCatalogLoader(): CatalogLoaderResult {
  const [isLoading, setIsLoading] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);
  
  const { loadLensData, saveCatalogToCloud, loadCatalogFromCloud } = useLensStore();

  /**
   * Carrega o catálogo local do arquivo público (usado apenas para seed)
   */
  const loadLocalCatalog = useCallback(async (): Promise<LensData | null> => {
    try {
      const response = await fetch('/data/lenses.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data: LensData = await response.json();
      console.log('[CatalogLoader] Local catalog loaded for seeding:', {
        families: data.families?.length || 0,
        prices: data.prices?.length || 0,
      });
      return data;
    } catch (error) {
      console.error('[CatalogLoader] Failed to load local catalog:', error);
      return null;
    }
  }, []);

  /**
   * Carrega catálogo da nuvem (única fonte de verdade)
   * Se nuvem estiver vazia, faz seed automático do arquivo local
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

      // Nuvem vazia - fazer seed automático do arquivo local
      console.log('[CatalogLoader] Cloud empty, auto-seeding from local file...');
      const localData = await loadLocalCatalog();
      
      if (localData) {
        loadLensData(localData);
        setLastLoadedAt(new Date().toISOString());
        
        // Seed automático para nuvem
        console.log('[CatalogLoader] Seeding to cloud...');
        const seedSuccess = await saveCatalogToCloud();
        
        if (seedSuccess) {
          toast.info('Catálogo inicializado na nuvem');
          console.log('[CatalogLoader] ✓ Auto-seed complete');
        } else {
          console.warn('[CatalogLoader] ⚠ Seed to cloud failed, but local data loaded');
        }
        
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
  }, [loadLensData, loadCatalogFromCloud, loadLocalCatalog, saveCatalogToCloud]);

  return {
    isLoading,
    loadCatalog,
    lastLoadedAt,
  };
}
