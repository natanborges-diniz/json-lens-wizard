import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Building2, 
  Save, 
  Loader2,
  Instagram,
  Facebook,
  Phone,
  Mail,
  MapPin,
  Store
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LogoUpload } from '@/components/settings/LogoUpload';

interface CompanySettings {
  id: string;
  company_name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  cnpj: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  slogan: string | null;
  footer_text: string | null;
  budget_terms: string | null;
}

const Settings = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('company_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        setSettings(data);
      } catch (error) {
        console.error('Error fetching settings:', error);
        toast.error('Erro ao carregar configurações');
      } finally {
        setIsLoading(false);
      }
    };

    if (user && isAdmin) {
      fetchSettings();
    }
  }, [user, isAdmin]);

  const handleSave = async () => {
    if (!settings) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({
          company_name: settings.company_name,
          logo_url: settings.logo_url,
          address: settings.address,
          phone: settings.phone,
          email: settings.email,
          cnpj: settings.cnpj,
          instagram: settings.instagram,
          facebook: settings.facebook,
          whatsapp: settings.whatsapp,
          slogan: settings.slogan,
          footer_text: settings.footer_text,
          budget_terms: settings.budget_terms,
        })
        .eq('id', settings.id);

      if (error) throw error;
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof CompanySettings, value: string) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Configurações não encontradas</p>
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
                  <Building2 className="w-5 h-5" />
                  Configurações da Empresa
                </h1>
                <p className="text-xs text-muted-foreground">
                  Informações institucionais e personalização
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Link to="/stores">
                <Button variant="outline" className="gap-2">
                  <Store className="w-4 h-4" />
                  Lojas
                </Button>
              </Link>
              
              <Button onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Nome e identidade da sua ótica</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Nome da Empresa</Label>
                  <Input
                    id="company_name"
                    value={settings.company_name}
                    onChange={(e) => updateField('company_name', e.target.value)}
                    placeholder="Nome da sua ótica"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={settings.cnpj || ''}
                    onChange={(e) => updateField('cnpj', e.target.value)}
                    placeholder="00.000.000/0000-00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slogan">Slogan</Label>
                <Input
                  id="slogan"
                  value={settings.slogan || ''}
                  onChange={(e) => updateField('slogan', e.target.value)}
                  placeholder="Sua frase de efeito"
                />
              </div>

              <LogoUpload
                currentLogoUrl={settings.logo_url}
                onLogoChange={(url) => updateField('logo_url', url || '')}
                storeId="company"
                label="Logo da Empresa"
              />
            </CardContent>
          </Card>

          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle>Contato</CardTitle>
              <CardDescription>Informações de contato da empresa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Telefone
                  </Label>
                  <Input
                    id="phone"
                    value={settings.phone || ''}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="(00) 0000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    WhatsApp
                  </Label>
                  <Input
                    id="whatsapp"
                    value={settings.whatsapp || ''}
                    onChange={(e) => updateField('whatsapp', e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={settings.email || ''}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="contato@suaotica.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Endereço
                </Label>
                <Textarea
                  id="address"
                  value={settings.address || ''}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Rua, número, bairro, cidade - UF"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Social Media */}
          <Card>
            <CardHeader>
              <CardTitle>Redes Sociais</CardTitle>
              <CardDescription>Links para suas redes sociais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="flex items-center gap-2">
                    <Instagram className="w-4 h-4" />
                    Instagram
                  </Label>
                  <Input
                    id="instagram"
                    value={settings.instagram || ''}
                    onChange={(e) => updateField('instagram', e.target.value)}
                    placeholder="@suaotica"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook" className="flex items-center gap-2">
                    <Facebook className="w-4 h-4" />
                    Facebook
                  </Label>
                  <Input
                    id="facebook"
                    value={settings.facebook || ''}
                    onChange={(e) => updateField('facebook', e.target.value)}
                    placeholder="facebook.com/suaotica"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Budget Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Orçamento</CardTitle>
              <CardDescription>Textos que aparecem nos orçamentos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="footer_text">Texto de Rodapé</Label>
                <Input
                  id="footer_text"
                  value={settings.footer_text || ''}
                  onChange={(e) => updateField('footer_text', e.target.value)}
                  placeholder="Obrigado pela preferência!"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="budget_terms">Termos e Condições</Label>
                <Textarea
                  id="budget_terms"
                  value={settings.budget_terms || ''}
                  onChange={(e) => updateField('budget_terms', e.target.value)}
                  placeholder="Orçamento válido por 7 dias. Preços sujeitos a alteração..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;