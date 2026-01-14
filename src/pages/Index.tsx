import { Link } from 'react-router-dom';
import { Eye, Settings, ShoppingBag, ArrowRight, Database, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Eye className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">LensFlow</h1>
              <p className="text-xs text-muted-foreground">Sistema de Lentes</p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Database className="w-4 h-4" />
            Gestão inteligente por JSON
          </div>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 leading-tight">
            Orçamento de lentes{' '}
            <span className="text-primary">simplificado</span>
          </h2>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
            Unifique fornecedores, aplique estratégia comercial e maximize clareza, 
            confiança e ticket médio em cada venda.
          </p>

          {/* Mode Selection Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Seller Mode */}
            <Link to="/seller" className="group">
              <Card className="h-full border-2 border-transparent hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 cursor-pointer">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <ShoppingBag className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <CardTitle className="text-2xl text-foreground">Modo Vendedor</CardTitle>
                  <CardDescription className="text-base">
                    Atendimento ao cliente com sugestões inteligentes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center mt-0.5 shrink-0">
                      <div className="w-2 h-2 rounded-full bg-success" />
                    </div>
                    <span>Anamnese objetiva do cliente</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center mt-0.5 shrink-0">
                      <div className="w-2 h-2 rounded-full bg-success" />
                    </div>
                    <span>Sugestões em 4 níveis de solução</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center mt-0.5 shrink-0">
                      <div className="w-2 h-2 rounded-full bg-success" />
                    </div>
                    <span>Comparativo claro e objetivo</span>
                  </div>
                  
                  <Button variant="ghost" className="w-full mt-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    Iniciar Venda
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </Link>

            {/* Admin Mode */}
            <Link to="/admin" className="group">
              <Card className="h-full border-2 border-transparent hover:border-secondary/30 transition-all duration-300 hover:shadow-lg hover:shadow-secondary/5 cursor-pointer">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-2xl gradient-premium flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Settings className="w-7 h-7 text-secondary-foreground" />
                  </div>
                  <CardTitle className="text-2xl text-foreground">Modo Administrador</CardTitle>
                  <CardDescription className="text-base">
                    Curadoria de base e estratégia comercial
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <div className="w-5 h-5 rounded-full bg-secondary/20 flex items-center justify-center mt-0.5 shrink-0">
                      <div className="w-2 h-2 rounded-full bg-secondary" />
                    </div>
                    <span>Importação de dados via JSON</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <div className="w-5 h-5 rounded-full bg-secondary/20 flex items-center justify-center mt-0.5 shrink-0">
                      <div className="w-2 h-2 rounded-full bg-secondary" />
                    </div>
                    <span>Prioridade de fornecedores</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-muted-foreground">
                    <div className="w-5 h-5 rounded-full bg-secondary/20 flex items-center justify-center mt-0.5 shrink-0">
                      <div className="w-2 h-2 rounded-full bg-secondary" />
                    </div>
                    <span>Gestão de famílias e módulos</span>
                  </div>
                  
                  <Button variant="ghost" className="w-full mt-4 group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors">
                    Acessar Painel
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-t border-border/50 bg-muted/30">
        <div className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">4</div>
              <div className="text-sm text-muted-foreground">Níveis de Solução</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">100%</div>
              <div className="text-sm text-muted-foreground">Via JSON</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">Multi</div>
              <div className="text-sm text-muted-foreground">Fornecedores</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-1">Zero</div>
              <div className="text-sm text-muted-foreground">SKU Manual</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6">
        <div className="container mx-auto px-6 text-center text-sm text-muted-foreground">
          <p>LensFlow — Sistema de Orçamento de Lentes Oftálmicas</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
