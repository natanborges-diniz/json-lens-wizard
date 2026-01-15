import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Users, 
  FileText, 
  ShoppingCart, 
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Loader2,
  Download,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Service {
  id: string;
  customer_id: string;
  seller_id: string;
  status: 'in_progress' | 'budget_sent' | 'converted' | 'lost';
  anamnesis_data: unknown;
  prescription_data: unknown;
  frame_data: unknown;
  lens_category: string | null;
  notes: string | null;
  created_at: string;
  customer?: {
    name: string;
    phone: string | null;
  } | null;
  seller?: {
    full_name: string;
  };
}

interface Budget {
  id: string;
  service_id: string;
  family_name: string;
  supplier: string;
  selected_index: string;
  selected_treatments: string[];
  final_total: number;
  is_finalized: boolean;
  ai_description: string | null;
  created_at: string;
  service?: Service;
}

interface Sale {
  id: string;
  budget_id: string;
  seller_id: string;
  customer_id: string;
  final_value: number;
  payment_method: string;
  created_at: string;
  customer?: {
    name: string;
  };
  seller?: {
    full_name: string;
  };
}

interface SellerStats {
  seller_id: string;
  seller_name: string;
  services_count: number;
  sales_count: number;
  conversion_rate: number;
}

const Management = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin, isManager, isLoading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'services');
  const [services, setServices] = useState<Service[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [sellerStats, setSellerStats] = useState<SellerStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog states
  const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
  const [showBudgetPreview, setShowBudgetPreview] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    setSearchParams({ tab: activeTab });
  }, [activeTab, setSearchParams]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Fetch services
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          customer:customers(name, phone)
        `)
        .order('created_at', { ascending: false });

      if (servicesError) throw servicesError;
      setServices(servicesData || []);

      // Fetch budgets with service info
      const { data: budgetsData, error: budgetsError } = await supabase
        .from('budgets')
        .select(`
          *,
          service:services(
            *,
            customer:customers(name, phone)
          )
        `)
        .order('created_at', { ascending: false });

      if (budgetsError) throw budgetsError;
      setBudgets(budgetsData || []);

      // Fetch sales
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          customer:customers(name)
        `)
        .order('created_at', { ascending: false });

      if (salesError) throw salesError;
      setSales(salesData || []);

      // If admin or manager, calculate seller stats
      if (isAdmin || isManager) {
        // Get unique sellers from services
        const sellerIds = [...new Set(servicesData?.map(s => s.seller_id) || [])];
        
        const stats: SellerStats[] = [];
        for (const sellerId of sellerIds) {
          const sellerServices = servicesData?.filter(s => s.seller_id === sellerId) || [];
          const sellerSales = salesData?.filter(s => s.seller_id === sellerId) || [];
          
          // Get seller name from profiles
          const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', sellerId)
            .maybeSingle();

          stats.push({
            seller_id: sellerId,
            seller_name: profileData?.full_name || 'Vendedor',
            services_count: sellerServices.length,
            sales_count: sellerSales.length,
            conversion_rate: sellerServices.length > 0 
              ? (sellerSales.length / sellerServices.length) * 100 
              : 0,
          });
        }

        setSellerStats(stats.sort((a, b) => b.conversion_rate - a.conversion_rate));
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, isAdmin, isManager]);

  const getStatusBadge = (status: Service['status']) => {
    const statusConfig = {
      'in_progress': { label: 'Em Andamento', variant: 'secondary' as const, icon: Clock },
      'budget_sent': { label: 'Orçamento Enviado', variant: 'outline' as const, icon: FileText },
      'converted': { label: 'Convertido', variant: 'default' as const, icon: CheckCircle },
      'lost': { label: 'Perdido', variant: 'destructive' as const, icon: XCircle },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  const filteredServices = services.filter(service => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      service.customer?.name.toLowerCase().includes(query) ||
      service.lens_category?.toLowerCase().includes(query)
    );
  });

  const filteredBudgets = budgets.filter(budget => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      budget.family_name.toLowerCase().includes(query) ||
      budget.supplier.toLowerCase().includes(query) ||
      budget.service?.customer?.name.toLowerCase().includes(query)
    );
  });

  const handleViewBudget = (budget: Budget) => {
    setSelectedBudget(budget);
    setShowBudgetPreview(true);
  };

  const handleFinalizeSale = async (budget: Budget) => {
    if (!user || !budget.service) return;

    try {
      // Update service status
      await supabase
        .from('services')
        .update({ status: 'converted' })
        .eq('id', budget.service_id);

      // Update budget as finalized
      await supabase
        .from('budgets')
        .update({ is_finalized: true, finalized_at: new Date().toISOString() })
        .eq('id', budget.id);

      // Create sale record
      await supabase
        .from('sales')
        .insert({
          budget_id: budget.id,
          service_id: budget.service_id,
          seller_id: budget.service.seller_id,
          customer_id: budget.service.customer_id,
          final_value: budget.final_total,
          payment_method: 'credit_1x',
        });

      toast.success('Venda finalizada com sucesso!');
      fetchData();
    } catch (error) {
      console.error('Error finalizing sale:', error);
      toast.error('Erro ao finalizar venda');
    }
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
                <h1 className="text-lg font-bold text-foreground">Gerenciamento</h1>
                <p className="text-xs text-muted-foreground">
                  Clientes, orçamentos e vendas
                </p>
              </div>
            </div>
            
            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Search */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, produto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="services" className="gap-2">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Atendimentos</span>
            </TabsTrigger>
            <TabsTrigger value="budgets" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Orçamentos</span>
            </TabsTrigger>
            <TabsTrigger value="sales" className="gap-2">
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Vendas</span>
            </TabsTrigger>
            {(isAdmin || isManager) && (
              <TabsTrigger value="stats" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Conversão</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* Services Tab */}
          <TabsContent value="services">
            <Card>
              <CardHeader>
                <CardTitle>Atendimentos</CardTitle>
                <CardDescription>
                  {filteredServices.length} atendimento(s) encontrado(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredServices.map((service) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-medium">
                          {service.customer?.name || 'Cliente'}
                          {service.customer?.phone && (
                            <span className="block text-xs text-muted-foreground">
                              {service.customer.phone}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {service.lens_category === 'PROGRESSIVA' ? 'Progressiva' : 'Monofocal'}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(service.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(service.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredServices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nenhum atendimento encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Budgets Tab */}
          <TabsContent value="budgets">
            <Card>
              <CardHeader>
                <CardTitle>Orçamentos</CardTitle>
                <CardDescription>
                  {filteredBudgets.length} orçamento(s) encontrado(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBudgets.map((budget) => (
                      <TableRow key={budget.id}>
                        <TableCell className="font-medium">
                          {budget.service?.customer?.name || 'Cliente'}
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{budget.family_name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {budget.supplier} • {budget.selected_index}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-success">
                          R$ {budget.final_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          {budget.is_finalized ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Finalizado
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pendente</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(budget.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleViewBudget(budget)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {!budget.is_finalized && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleFinalizeSale(budget)}
                                className="text-success"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredBudgets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nenhum orçamento encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sales Tab */}
          <TabsContent value="sales">
            <Card>
              <CardHeader>
                <CardTitle>Vendas Finalizadas</CardTitle>
                <CardDescription>
                  {sales.length} venda(s) realizada(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium">
                          {sale.customer?.name || 'Cliente'}
                        </TableCell>
                        <TableCell className="font-medium text-success">
                          R$ {sale.final_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{sale.payment_method}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(sale.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))}
                    {sales.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Nenhuma venda encontrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stats Tab - Admin/Manager only */}
          {(isAdmin || isManager) && (
            <TabsContent value="stats">
              <Card>
                <CardHeader>
                  <CardTitle>Taxa de Conversão por Vendedor</CardTitle>
                  <CardDescription>
                    Desempenho da equipe de vendas
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vendedor</TableHead>
                        <TableHead className="text-center">Atendimentos</TableHead>
                        <TableHead className="text-center">Vendas</TableHead>
                        <TableHead className="text-center">Conversão</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sellerStats.map((stat) => (
                        <TableRow key={stat.seller_id}>
                          <TableCell className="font-medium">{stat.seller_name}</TableCell>
                          <TableCell className="text-center">{stat.services_count}</TableCell>
                          <TableCell className="text-center text-success">{stat.sales_count}</TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={stat.conversion_rate >= 50 ? 'default' : stat.conversion_rate >= 30 ? 'secondary' : 'outline'}
                            >
                              {stat.conversion_rate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {sellerStats.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Nenhum dado de conversão encontrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Budget Preview Dialog */}
      <Dialog open={showBudgetPreview} onOpenChange={setShowBudgetPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Visualização do Orçamento</DialogTitle>
            <DialogDescription>
              {selectedBudget?.service?.customer?.name || 'Cliente'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedBudget && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground">Produto</span>
                  <p className="font-medium">{selectedBudget.family_name}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Fornecedor</span>
                  <p className="font-medium">{selectedBudget.supplier}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Índice</span>
                  <p className="font-medium">{selectedBudget.selected_index}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Valor Final</span>
                  <p className="font-medium text-success text-lg">
                    R$ {selectedBudget.final_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {selectedBudget.selected_treatments.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">Tratamentos</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedBudget.selected_treatments.map((treatment, i) => (
                      <Badge key={i} variant="secondary">{treatment}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedBudget.ai_description && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm text-muted-foreground mb-2 block">Descrição Personalizada</span>
                    <div className="prose prose-sm max-w-none bg-muted/50 p-4 rounded-lg">
                      {selectedBudget.ai_description}
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  Exportar PDF
                </Button>
                {!selectedBudget.is_finalized && (
                  <Button 
                    className="gap-2"
                    onClick={() => {
                      handleFinalizeSale(selectedBudget);
                      setShowBudgetPreview(false);
                    }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Finalizar Venda
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Management;