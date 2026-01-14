import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight,
  User,
  FileText,
  Glasses,
  Sparkles,
  Check,
  Plus,
  Minus,
  Info,
  Star,
  Zap,
  Shield,
  Crown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useLensStore } from '@/store/lensStore';
import type { CustomerProfile, Prescription, Tier, Family, Module } from '@/types/lens';
import { toast } from 'sonner';

type Step = 'anamnesis' | 'prescription' | 'frame' | 'recommendations';

const SellerFlow = () => {
  const [currentStep, setCurrentStep] = useState<Step>('anamnesis');
  const [customerData, setCustomerData] = useState<Partial<CustomerProfile>>({
    primaryUse: 'general',
    digitalDeviceHours: 4,
    outdoorActivities: false,
    sensitiveToLight: false,
    wearGlassesCurrently: false,
  });
  const [prescriptionData, setPrescriptionData] = useState<Partial<Prescription>>({
    rightSphere: 0,
    rightCylinder: 0,
    rightAxis: 0,
    leftSphere: 0,
    leftCylinder: 0,
    leftAxis: 0,
  });

  const { 
    families, 
    modules, 
    supplierPriorities,
    selectedModules,
    toggleModule,
    clearSelectedModules
  } = useLensStore();

  const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
    { id: 'anamnesis', label: 'Anamnese', icon: <User className="w-4 h-4" /> },
    { id: 'prescription', label: 'Receita', icon: <FileText className="w-4 h-4" /> },
    { id: 'frame', label: 'Armação', icon: <Glasses className="w-4 h-4" /> },
    { id: 'recommendations', label: 'Soluções', icon: <Sparkles className="w-4 h-4" /> },
  ];

  const stepIndex = steps.findIndex(s => s.id === currentStep);
  const progress = ((stepIndex + 1) / steps.length) * 100;

  const goNext = () => {
    const idx = steps.findIndex(s => s.id === currentStep);
    if (idx < steps.length - 1) {
      setCurrentStep(steps[idx + 1].id);
    }
  };

  const goBack = () => {
    const idx = steps.findIndex(s => s.id === currentStep);
    if (idx > 0) {
      setCurrentStep(steps[idx - 1].id);
    }
  };

  const getRecommendationsByTier = (): Record<Tier, Family[]> => {
    const activeF = families.filter(f => f.active);
    return {
      essential: activeF.filter(f => f.tier === 'essential'),
      comfort: activeF.filter(f => f.tier === 'comfort'),
      advanced: activeF.filter(f => f.tier === 'advanced'),
      top: activeF.filter(f => f.tier === 'top'),
    };
  };

  const recommendations = getRecommendationsByTier();
  const activeModules = modules.filter(m => m.active);

  const calculateTotal = (family: Family) => {
    const modulesCost = selectedModules.reduce((sum, id) => {
      const mod = modules.find(m => m.id === id);
      return sum + (mod?.price || 0);
    }, 0);
    return family.basePrice + modulesCost;
  };

  const getTierConfig = (tier: Tier) => {
    switch (tier) {
      case 'essential':
        return { 
          label: 'Essencial', 
          icon: <Shield className="w-5 h-5" />,
          color: 'text-muted-foreground',
          bg: 'bg-muted',
          border: 'border-muted-foreground/20',
          description: 'Solução básica com correção visual eficiente'
        };
      case 'comfort':
        return { 
          label: 'Conforto', 
          icon: <Star className="w-5 h-5" />,
          color: 'text-primary',
          bg: 'bg-primary/10',
          border: 'border-primary/30',
          description: 'Equilíbrio entre qualidade e custo-benefício'
        };
      case 'advanced':
        return { 
          label: 'Avançada', 
          icon: <Zap className="w-5 h-5" />,
          color: 'text-info',
          bg: 'bg-info/10',
          border: 'border-info/30',
          description: 'Tecnologia de ponta para alta performance visual'
        };
      case 'top':
        return { 
          label: 'Top de Mercado', 
          icon: <Crown className="w-5 h-5" />,
          color: 'text-secondary',
          bg: 'bg-secondary/10',
          border: 'border-secondary/30',
          description: 'O melhor disponível para máxima satisfação'
        };
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg font-bold text-foreground">Nova Venda</h1>
                <p className="text-xs text-muted-foreground">
                  {steps.find(s => s.id === currentStep)?.label}
                </p>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-2">
              {steps.map((step, idx) => (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(step.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                      step.id === currentStep
                        ? 'bg-primary text-primary-foreground'
                        : idx < stepIndex
                        ? 'bg-success/20 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {idx < stepIndex ? <Check className="w-4 h-4" /> : step.icon}
                    <span className="hidden lg:inline">{step.label}</span>
                  </button>
                  {idx < steps.length - 1 && (
                    <div className={`w-8 h-0.5 mx-1 ${
                      idx < stepIndex ? 'bg-success' : 'bg-border'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <Progress value={progress} className="h-1" />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8 max-w-4xl">
        {/* Anamnesis Step */}
        {currentStep === 'anamnesis' && (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Conhecendo o Cliente</h2>
              <p className="text-muted-foreground">Informações para recomendação personalizada</p>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Cliente</Label>
                    <Input 
                      id="name" 
                      placeholder="Nome completo"
                      value={customerData.name || ''}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age">Idade</Label>
                    <Input 
                      id="age" 
                      type="number"
                      placeholder="Anos"
                      value={customerData.age || ''}
                      onChange={(e) => setCustomerData(prev => ({ ...prev, age: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="occupation">Profissão / Ocupação</Label>
                  <Input 
                    id="occupation" 
                    placeholder="Ex: Programador, Professor, Motorista..."
                    value={customerData.occupation || ''}
                    onChange={(e) => setCustomerData(prev => ({ ...prev, occupation: e.target.value }))}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Uso Principal dos Óculos</Label>
                  <RadioGroup 
                    value={customerData.primaryUse || 'general'}
                    onValueChange={(v) => setCustomerData(prev => ({ ...prev, primaryUse: v as CustomerProfile['primaryUse'] }))}
                    className="grid grid-cols-2 gap-3"
                  >
                    {[
                      { value: 'reading', label: 'Leitura', desc: 'Livros, documentos' },
                      { value: 'computer', label: 'Computador', desc: 'Trabalho, telas' },
                      { value: 'driving', label: 'Dirigir', desc: 'Veículos, estradas' },
                      { value: 'general', label: 'Uso Geral', desc: 'Todas as situações' },
                    ].map((opt) => (
                      <Label
                        key={opt.value}
                        htmlFor={opt.value}
                        className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${
                          customerData.primaryUse === opt.value
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <RadioGroupItem value={opt.value} id={opt.value} />
                        <div>
                          <div className="font-medium">{opt.label}</div>
                          <div className="text-xs text-muted-foreground">{opt.desc}</div>
                        </div>
                      </Label>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Horas diárias em dispositivos digitais</Label>
                    <span className="text-sm font-medium text-primary">{customerData.digitalDeviceHours}h</span>
                  </div>
                  <Slider
                    value={[customerData.digitalDeviceHours || 4]}
                    onValueChange={([v]) => setCustomerData(prev => ({ ...prev, digitalDeviceHours: v }))}
                    min={0}
                    max={16}
                    step={1}
                    className="py-4"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0h</span>
                    <span>8h</span>
                    <span>16h</span>
                  </div>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <Label>Pratica atividades ao ar livre?</Label>
                      <p className="text-xs text-muted-foreground">Esportes, caminhadas, etc.</p>
                    </div>
                    <Switch
                      checked={customerData.outdoorActivities}
                      onCheckedChange={(v) => setCustomerData(prev => ({ ...prev, outdoorActivities: v }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <Label>Sensibilidade à luz?</Label>
                      <p className="text-xs text-muted-foreground">Desconforto com luz forte</p>
                    </div>
                    <Switch
                      checked={customerData.sensitiveToLight}
                      onCheckedChange={(v) => setCustomerData(prev => ({ ...prev, sensitiveToLight: v }))}
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                    <div>
                      <Label>Já usa óculos?</Label>
                      <p className="text-xs text-muted-foreground">Possui experiência prévia</p>
                    </div>
                    <Switch
                      checked={customerData.wearGlassesCurrently}
                      onCheckedChange={(v) => setCustomerData(prev => ({ ...prev, wearGlassesCurrently: v }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Prescription Step */}
        {currentStep === 'prescription' && (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Receita Médica</h2>
              <p className="text-muted-foreground">Insira os dados da receita oftalmológica</p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Right Eye */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                        OD
                      </div>
                      Olho Direito
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Esférico</Label>
                        <Input 
                          type="number"
                          step="0.25"
                          placeholder="0.00"
                          value={prescriptionData.rightSphere || ''}
                          onChange={(e) => setPrescriptionData(prev => ({ 
                            ...prev, 
                            rightSphere: parseFloat(e.target.value) 
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Cilíndrico</Label>
                        <Input 
                          type="number"
                          step="0.25"
                          placeholder="0.00"
                          value={prescriptionData.rightCylinder || ''}
                          onChange={(e) => setPrescriptionData(prev => ({ 
                            ...prev, 
                            rightCylinder: parseFloat(e.target.value) 
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Eixo</Label>
                        <Input 
                          type="number"
                          placeholder="0"
                          value={prescriptionData.rightAxis || ''}
                          onChange={(e) => setPrescriptionData(prev => ({ 
                            ...prev, 
                            rightAxis: parseInt(e.target.value) 
                          }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Adição (se progressivo)</Label>
                      <Input 
                        type="number"
                        step="0.25"
                        placeholder="0.00"
                        value={prescriptionData.rightAddition || ''}
                        onChange={(e) => setPrescriptionData(prev => ({ 
                          ...prev, 
                          rightAddition: parseFloat(e.target.value) 
                        }))}
                      />
                    </div>
                  </div>

                  {/* Left Eye */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                        OE
                      </div>
                      Olho Esquerdo
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Esférico</Label>
                        <Input 
                          type="number"
                          step="0.25"
                          placeholder="0.00"
                          value={prescriptionData.leftSphere || ''}
                          onChange={(e) => setPrescriptionData(prev => ({ 
                            ...prev, 
                            leftSphere: parseFloat(e.target.value) 
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Cilíndrico</Label>
                        <Input 
                          type="number"
                          step="0.25"
                          placeholder="0.00"
                          value={prescriptionData.leftCylinder || ''}
                          onChange={(e) => setPrescriptionData(prev => ({ 
                            ...prev, 
                            leftCylinder: parseFloat(e.target.value) 
                          }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Eixo</Label>
                        <Input 
                          type="number"
                          placeholder="0"
                          value={prescriptionData.leftAxis || ''}
                          onChange={(e) => setPrescriptionData(prev => ({ 
                            ...prev, 
                            leftAxis: parseInt(e.target.value) 
                          }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Adição (se progressivo)</Label>
                      <Input 
                        type="number"
                        step="0.25"
                        placeholder="0.00"
                        value={prescriptionData.leftAddition || ''}
                        onChange={(e) => setPrescriptionData(prev => ({ 
                          ...prev, 
                          leftAddition: parseFloat(e.target.value) 
                        }))}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Frame Step */}
        {currentStep === 'frame' && (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Medidas da Armação</h2>
              <p className="text-muted-foreground">Dados técnicos da armação escolhida</p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Horizontal (mm)</Label>
                    <Input type="number" placeholder="54" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Vertical (mm)</Label>
                    <Input type="number" placeholder="40" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Ponte (mm)</Label>
                    <Input type="number" placeholder="18" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">DP (mm)</Label>
                    <Input type="number" placeholder="64" />
                  </div>
                </div>

                <div className="mt-6 p-4 bg-info/10 rounded-lg flex items-start gap-3">
                  <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Dica</p>
                    <p>As medidas da armação ajudam a calcular a espessura ideal da lente e recomendar o índice de refração mais adequado.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recommendations Step */}
        {currentStep === 'recommendations' && (
          <div className="space-y-6 animate-slide-up">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Soluções Recomendadas</h2>
              <p className="text-muted-foreground">
                {customerData.name ? `Para ${customerData.name}` : 'Escolha o nível de solução ideal'}
              </p>
            </div>

            {/* Modules Selection */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Complementos Selecionados</CardTitle>
                <CardDescription>Adicione tratamentos para personalizar a solução</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {activeModules.map((mod) => (
                    <button
                      key={mod.id}
                      onClick={() => toggleModule(mod.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                        selectedModules.includes(mod.id)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      {selectedModules.includes(mod.id) ? (
                        <Minus className="w-4 h-4" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      <span>{mod.name}</span>
                      <span className="text-xs opacity-70">+R${mod.price}</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tier Recommendations */}
            <div className="space-y-4">
              {(['essential', 'comfort', 'advanced', 'top'] as Tier[]).map((tier) => {
                const config = getTierConfig(tier);
                const tierFamilies = recommendations[tier];
                
                if (tierFamilies.length === 0) return null;

                return (
                  <Card key={tier} className={`border-2 ${config.border}`}>
                    <CardHeader className={`${config.bg} rounded-t-lg`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={config.color}>{config.icon}</div>
                          <div>
                            <CardTitle className={`text-lg ${config.color}`}>
                              {config.label}
                            </CardTitle>
                            <CardDescription>{config.description}</CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {tierFamilies.map((family) => (
                          <div 
                            key={family.id}
                            className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-foreground">{family.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {family.supplier}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {family.commercialName}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {family.benefits.slice(0, 3).map((benefit, i) => (
                                  <span 
                                    key={i}
                                    className="text-xs px-2 py-0.5 bg-background rounded-full text-muted-foreground"
                                  >
                                    ✓ {benefit}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="text-2xl font-bold text-foreground">
                                R$ {calculateTotal(family).toLocaleString('pt-BR')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {selectedModules.length > 0 && (
                                  <span>base + {selectedModules.length} complemento(s)</span>
                                )}
                              </div>
                              <Button size="sm" className="mt-2 gradient-primary text-primary-foreground">
                                Selecionar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={stepIndex === 0}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>

          {currentStep !== 'recommendations' ? (
            <Button onClick={goNext} className="gap-2 gradient-primary text-primary-foreground">
              Continuar
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button 
              className="gap-2 gradient-premium text-secondary-foreground"
              onClick={() => toast.success('Orçamento finalizado!')}
            >
              Finalizar Orçamento
              <Check className="w-4 h-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default SellerFlow;
