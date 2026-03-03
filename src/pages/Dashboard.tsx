import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  ShoppingCart, 
  TrendingUp, 
  Plus, 
  Settings, 
  LogOut,
  LayoutDashboard,
  Building2,
  UserCog,
  Eye,
  UserPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DashboardStats {
  totalServices: number;
  totalBudgets: number;
  totalSales: number;
  conversionRate: number;
  myServices: number;
  myBudgets: number;
  mySales: number;
  myConversionRate: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isManager, isSeller, signOut, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalServices: 0,
    totalBudgets: 0,
    totalSales: 0,
    conversionRate: 0,
    myServices: 0,
    myBudgets: 0,
    mySales: 0,
    myConversionRate: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      
      try {
        // Fetch my services count
        const { count: myServicesCount } = await supabase
          .from('services')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', user.id);

        // Fetch my sales count
        const { count: mySalesCount } = await supabase
          .from('sales')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', user.id);

        const myServices = myServicesCount || 0;
        const mySales = mySalesCount || 0;
        const myConversionRate = myServices > 0 ? (mySales / myServices) * 100 : 0;

        let totalServices = myServices;
        let totalSales = mySales;

        // If admin or manager, get total stats
        if (isAdmin || isManager) {
          const { count: allServicesCount } = await supabase
            .from('services')
            .select('*', { count: 'exact', head: true });

          const { count: allSalesCount } = await supabase
            .from('sales')
            .select('*', { count: 'exact', head: true });

          totalServices = allServicesCount || 0;
          totalSales = allSalesCount || 0;
        }

        const totalConversionRate = totalServices > 0 ? (totalSales / totalServices) * 100 : 0;

        setStats({
          totalServices,
          totalBudgets: 0,
          totalSales,
          conversionRate: totalConversionRate,
          myServices,
          myBudgets: 0,
          mySales,
          myConversionRate,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [user, isAdmin, isManager]);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Logout realizado com sucesso');
    navigate('/login');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) return null;

  const getRoleBadge = () => {
    if (isAdmin) return <Badge variant="default">Administrador</Badge>;
    if (isManager) return <Badge variant="secondary">Gerente</Badge>;
    return <Badge variant="outline">Vendedor</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <LayoutDashboard className="w-6 h-6 text-primary" />
              <div>
                <h1 className="text-lg font-bold text-foreground">Dashboard</h1>
                <p className="text-xs text-muted-foreground">
                  Olá, {profile?.full_name || 'Usuário'}
                </p>
              </div>
              {getRoleBadge()}
            </div>
            
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link to="/catalog">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">Catálogo</span>
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Link to="/seller">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <Plus className="w-8 h-8 text-primary mb-2" />
                <span className="text-sm font-medium">Novo Atendimento</span>
              </CardContent>
            </Card>
          </Link>
          
          <Link to="/management">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <Users className="w-8 h-8 text-primary mb-2" />
                <span className="text-sm font-medium">Clientes</span>
              </CardContent>
            </Card>
          </Link>

          <Link to="/management?tab=budgets">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="flex flex-col items-center justify-center py-6">
                <FileText className="w-8 h-8 text-primary mb-2" />
                <span className="text-sm font-medium">Orçamentos</span>
              </CardContent>
            </Card>
          </Link>

          {isAdmin && (
            <Link to="/settings">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="flex flex-col items-center justify-center py-6">
                  <Building2 className="w-8 h-8 text-primary mb-2" />
                  <span className="text-sm font-medium">Empresa</span>
                </CardContent>
              </Card>
            </Link>
          )}

          {!isAdmin && (
            <Link to="/management?tab=sales">
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardContent className="flex flex-col items-center justify-center py-6">
                  <ShoppingCart className="w-8 h-8 text-primary mb-2" />
                  <span className="text-sm font-medium">Vendas</span>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Meus Atendimentos</CardDescription>
              <CardTitle className="text-3xl">{stats.myServices}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Total de atendimentos realizados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Minhas Vendas</CardDescription>
              <CardTitle className="text-3xl text-success">{stats.mySales}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Vendas finalizadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Minha Conversão</CardDescription>
              <CardTitle className="text-3xl">{stats.myConversionRate.toFixed(1)}%</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Taxa de conversão</p>
            </CardContent>
          </Card>

          {(isAdmin || isManager) && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardDescription>Conversão Geral</CardDescription>
                <CardTitle className="text-3xl">{stats.conversionRate.toFixed(1)}%</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {stats.totalSales} vendas de {stats.totalServices} atendimentos
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Admin/Manager Section */}
        {(isAdmin || isManager) && (
          <>
            <Separator className="my-8" />
            
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Visão Geral da Equipe
              </h2>
              
              <div className="grid md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Atendimentos</CardDescription>
                    <CardTitle className="text-2xl">{stats.totalServices}</CardTitle>
                  </CardHeader>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Vendas</CardDescription>
                    <CardTitle className="text-2xl text-success">{stats.totalSales}</CardTitle>
                  </CardHeader>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Taxa de Conversão</CardDescription>
                    <CardTitle className="text-2xl">{stats.conversionRate.toFixed(1)}%</CardTitle>
                  </CardHeader>
                </Card>
              </div>
            </div>
          </>
        )}

        {/* Admin Only Section */}
        {isAdmin && (
          <>
            <Separator className="my-8" />
            
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <UserCog className="w-5 h-5" />
                Administração
              </h2>
              
              <div className="grid md:grid-cols-3 gap-4">
                <Link to="/users">
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <UserPlus className="w-5 h-5" />
                        Gerenciar Usuários
                      </CardTitle>
                      <CardDescription>
                        Crie e gerencie os acessos da equipe
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>

                <Link to="/settings">
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="w-5 h-5" />
                        Configurações da Empresa
                      </CardTitle>
                      <CardDescription>
                        Configure logo, informações de contato e termos do orçamento
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>

                <Link to="/catalog">
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Eye className="w-5 h-5" />
                        Gestão do Catálogo
                      </CardTitle>
                      <CardDescription>
                        Famílias, fornecedores, importação, qualidade e histórico
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;