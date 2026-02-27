import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Store, 
  Plus, 
  Loader2,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LogoUpload } from '@/components/settings/LogoUpload';
import { SupplierPriorityManager } from '@/components/settings/SupplierPriorityManager';

interface StoreData {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  cnpj: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  slogan: string | null;
  footer_text: string | null;
  budget_terms: string | null;
  supplier_priorities: string[] | null;
  is_active: boolean;
  created_at: string;
}

const emptyStore: Omit<StoreData, 'id' | 'created_at'> = {
  name: '',
  logo_url: null,
  address: null,
  phone: null,
  email: null,
  cnpj: null,
  whatsapp: null,
  instagram: null,
  facebook: null,
  slogan: null,
  footer_text: null,
  budget_terms: null,
  supplier_priorities: null,
  is_active: true,
};

const StoreManagement = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [stores, setStores] = useState<StoreData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreData | null>(null);
  const [formData, setFormData] = useState(emptyStore);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }

    if (!authLoading && !isAdmin) {
      toast.error('Acesso não autorizado');
      navigate('/dashboard');
    }
  }, [user, isAdmin, authLoading, navigate]);

  const fetchStores = async () => {
    try {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .order('name');

      if (error) throw error;
      setStores((data || []).map(d => ({
        ...d,
        supplier_priorities: Array.isArray(d.supplier_priorities) ? d.supplier_priorities as string[] : null,
      })) as StoreData[]);
    } catch (error) {
      console.error('Error fetching stores:', error);
      toast.error('Erro ao carregar lojas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchStores();
    }
  }, [user, isAdmin]);

  const handleOpenDialog = (store?: StoreData) => {
    if (store) {
      setEditingStore(store);
      setFormData({
        name: store.name,
        logo_url: store.logo_url,
        address: store.address,
        phone: store.phone,
        email: store.email,
        cnpj: store.cnpj,
        whatsapp: store.whatsapp,
        instagram: store.instagram,
        facebook: store.facebook,
        slogan: store.slogan,
        footer_text: store.footer_text,
        budget_terms: store.budget_terms,
        supplier_priorities: (store as any).supplier_priorities || null,
        is_active: store.is_active,
      });
    } else {
      setEditingStore(null);
      setFormData(emptyStore);
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingStore(null);
    setFormData(emptyStore);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Nome da loja é obrigatório');
      return;
    }

    setIsSaving(true);

    try {
      if (editingStore) {
        const { error } = await supabase
          .from('stores')
          .update(formData)
          .eq('id', editingStore.id);

        if (error) throw error;
        toast.success('Loja atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('stores')
          .insert(formData);

        if (error) throw error;
        toast.success('Loja criada com sucesso!');
      }

      handleCloseDialog();
      fetchStores();
    } catch (error) {
      console.error('Error saving store:', error);
      toast.error('Erro ao salvar loja');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (store: StoreData) => {
    try {
      const { error } = await supabase
        .from('stores')
        .update({ is_active: !store.is_active })
        .eq('id', store.id);

      if (error) throw error;
      toast.success(store.is_active ? 'Loja desativada' : 'Loja ativada');
      fetchStores();
    } catch (error) {
      console.error('Error toggling store:', error);
      toast.error('Erro ao alterar status da loja');
    }
  };

  const handleDelete = async (storeId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta loja?')) return;

    try {
      const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', storeId);

      if (error) throw error;
      toast.success('Loja excluída com sucesso!');
      fetchStores();
    } catch (error) {
      console.error('Error deleting store:', error);
      toast.error('Erro ao excluir loja');
    }
  };

  const updateFormField = (field: keyof typeof formData, value: string | boolean | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Store className="w-5 h-5" />
                  Gerenciar Lojas
                </h1>
                <p className="text-xs text-muted-foreground">
                  Cadastre e configure as lojas da rede
                </p>
              </div>
            </div>
            
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              Nova Loja
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Lojas Cadastradas</CardTitle>
            <CardDescription>
              {stores.length} loja(s) cadastrada(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Logo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stores.map((store) => (
                  <TableRow key={store.id}>
                    <TableCell>
                      {store.logo_url ? (
                        <img 
                          src={store.logo_url} 
                          alt={store.name}
                          className="w-10 h-10 object-contain rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                          <Store className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{store.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {store.cnpj || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {store.phone || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={store.is_active ? 'default' : 'secondary'}>
                        {store.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(store)}
                          title={store.is_active ? 'Desativar' : 'Ativar'}
                        >
                          {store.is_active ? (
                            <ToggleRight className="w-4 h-4" />
                          ) : (
                            <ToggleLeft className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(store)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(store.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {stores.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Nenhuma loja cadastrada
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* Store Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingStore ? 'Editar Loja' : 'Nova Loja'}
            </DialogTitle>
            <DialogDescription>
              {editingStore 
                ? 'Atualize as informações da loja'
                : 'Preencha os dados para cadastrar uma nova loja'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Informações Básicas</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="store-name">Nome da Loja *</Label>
                  <Input
                    id="store-name"
                    value={formData.name}
                    onChange={(e) => updateFormField('name', e.target.value)}
                    placeholder="Nome da loja"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-cnpj">CNPJ</Label>
                  <Input
                    id="store-cnpj"
                    value={formData.cnpj || ''}
                    onChange={(e) => updateFormField('cnpj', e.target.value)}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="store-slogan">Slogan</Label>
                <Input
                  id="store-slogan"
                  value={formData.slogan || ''}
                  onChange={(e) => updateFormField('slogan', e.target.value)}
                  placeholder="Sua frase de efeito"
                />
              </div>

              <LogoUpload
                currentLogoUrl={formData.logo_url}
                onLogoChange={(url) => updateFormField('logo_url', url)}
                storeId={editingStore?.id || 'new'}
              />
            </div>

            {/* Contact */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Contato</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="store-phone">Telefone</Label>
                  <Input
                    id="store-phone"
                    value={formData.phone || ''}
                    onChange={(e) => updateFormField('phone', e.target.value)}
                    placeholder="(00) 0000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-whatsapp">WhatsApp</Label>
                  <Input
                    id="store-whatsapp"
                    value={formData.whatsapp || ''}
                    onChange={(e) => updateFormField('whatsapp', e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="store-email">Email</Label>
                <Input
                  id="store-email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => updateFormField('email', e.target.value)}
                  placeholder="contato@loja.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="store-address">Endereço</Label>
                <Textarea
                  id="store-address"
                  value={formData.address || ''}
                  onChange={(e) => updateFormField('address', e.target.value)}
                  placeholder="Rua, número, bairro, cidade - UF"
                  rows={2}
                />
              </div>
            </div>

            {/* Social Media */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Redes Sociais</h3>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="store-instagram">Instagram</Label>
                  <Input
                    id="store-instagram"
                    value={formData.instagram || ''}
                    onChange={(e) => updateFormField('instagram', e.target.value)}
                    placeholder="@loja"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="store-facebook">Facebook</Label>
                  <Input
                    id="store-facebook"
                    value={formData.facebook || ''}
                    onChange={(e) => updateFormField('facebook', e.target.value)}
                    placeholder="facebook.com/loja"
                  />
                </div>
              </div>
            </div>

            {/* Supplier Priorities (E3) */}
            {editingStore && (
              <SupplierPriorityManager
                savedPriorities={(formData.supplier_priorities as string[]) || []}
                onChange={(priorities) => updateFormField('supplier_priorities' as any, priorities as any)}
              />
            )}

            {/* Budget Settings */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm">Orçamento</h3>
              
              <div className="space-y-2">
                <Label htmlFor="store-footer">Texto de Rodapé</Label>
                <Input
                  id="store-footer"
                  value={formData.footer_text || ''}
                  onChange={(e) => updateFormField('footer_text', e.target.value)}
                  placeholder="Obrigado pela preferência!"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="store-terms">Termos e Condições</Label>
                <Textarea
                  id="store-terms"
                  value={formData.budget_terms || ''}
                  onChange={(e) => updateFormField('budget_terms', e.target.value)}
                  placeholder="Orçamento válido por 7 dias..."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingStore ? 'Salvar' : 'Criar Loja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoreManagement;
