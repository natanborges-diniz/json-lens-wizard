import { useEffect, useState } from 'react';
import { Loader2, Store, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StoreData {
  id: string;
  name: string;
  is_active: boolean;
}

interface UserStoreAccess {
  store_id: string;
  has_access_to_all: boolean;
}

interface StoreAccessManagerProps {
  userId: string;
  userName: string;
  onClose: () => void;
}

export const StoreAccessManager = ({ userId, userName, onClose }: StoreAccessManagerProps) => {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [userAccess, setUserAccess] = useState<UserStoreAccess[]>([]);
  const [hasAccessToAll, setHasAccessToAll] = useState(false);
  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all active stores
        const { data: storesData, error: storesError } = await supabase
          .from('stores')
          .select('id, name, is_active')
          .eq('is_active', true)
          .order('name');

        if (storesError) throw storesError;
        setStores(storesData || []);

        // Fetch user's current access
        const { data: accessData, error: accessError } = await supabase
          .from('user_store_access')
          .select('store_id, has_access_to_all')
          .eq('user_id', userId);

        if (accessError) throw accessError;
        
        if (accessData && accessData.length > 0) {
          setUserAccess(accessData);
          
          // Check if user has access to all
          const allAccess = accessData.some(a => a.has_access_to_all);
          setHasAccessToAll(allAccess);
          
          // Set selected stores
          const storeIds = new Set(accessData.map(a => a.store_id));
          setSelectedStores(storeIds);
        }
      } catch (error) {
        console.error('Error fetching store access:', error);
        toast.error('Erro ao carregar acessos');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  const handleToggleStore = (storeId: string) => {
    setSelectedStores(prev => {
      const newSet = new Set(prev);
      if (newSet.has(storeId)) {
        newSet.delete(storeId);
      } else {
        newSet.add(storeId);
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    setHasAccessToAll(prev => !prev);
    if (!hasAccessToAll) {
      // When enabling "all", select all stores
      setSelectedStores(new Set(stores.map(s => s.id)));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Delete existing access entries for this user
      const { error: deleteError } = await supabase
        .from('user_store_access')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // Insert new access entries
      if (hasAccessToAll) {
        // If "all" is selected, just insert one entry with has_access_to_all = true
        // We still need a store_id, so use the first store
        if (stores.length > 0) {
          const { error: insertError } = await supabase
            .from('user_store_access')
            .insert({
              user_id: userId,
              store_id: stores[0].id,
              has_access_to_all: true,
            });

          if (insertError) throw insertError;
        }
      } else if (selectedStores.size > 0) {
        // Insert individual store access
        const accessEntries = Array.from(selectedStores).map(storeId => ({
          user_id: userId,
          store_id: storeId,
          has_access_to_all: false,
        }));

        const { error: insertError } = await supabase
          .from('user_store_access')
          .insert(accessEntries);

        if (insertError) throw insertError;
      }

      toast.success('Permissões atualizadas com sucesso!');
      onClose();
    } catch (error) {
      console.error('Error saving store access:', error);
      toast.error('Erro ao salvar permissões');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Store className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Nenhuma loja cadastrada</p>
        <p className="text-sm">Cadastre lojas primeiro para configurar acessos</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Store className="w-4 h-4" />
        <span className="font-medium">Acessos de: {userName}</span>
      </div>

      {/* Access to all toggle */}
      <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
        <Checkbox
          id="all-stores"
          checked={hasAccessToAll}
          onCheckedChange={handleToggleAll}
        />
        <Label htmlFor="all-stores" className="flex items-center gap-2 cursor-pointer">
          <span>Acesso a todas as lojas</span>
          {hasAccessToAll && (
            <Badge variant="default" className="text-xs">Todas</Badge>
          )}
        </Label>
      </div>

      {/* Individual stores */}
      {!hasAccessToAll && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {stores.map(store => (
            <div 
              key={store.id}
              className="flex items-center space-x-2 p-2 hover:bg-muted/30 rounded"
            >
              <Checkbox
                id={`store-${store.id}`}
                checked={selectedStores.has(store.id)}
                onCheckedChange={() => handleToggleStore(store.id)}
              />
              <Label 
                htmlFor={`store-${store.id}`} 
                className="flex-1 cursor-pointer"
              >
                {store.name}
              </Label>
              {selectedStores.has(store.id) && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="text-sm text-muted-foreground pt-2 border-t">
        {hasAccessToAll 
          ? 'Usuário terá acesso a todas as lojas (atuais e futuras)'
          : selectedStores.size === 0
            ? 'Nenhuma loja selecionada - usuário não terá acesso'
            : `${selectedStores.size} loja(s) selecionada(s)`
        }
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Salvar Permissões
        </Button>
      </div>
    </div>
  );
};
