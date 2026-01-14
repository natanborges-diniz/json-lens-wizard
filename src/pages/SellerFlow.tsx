import { useState, useEffect } from 'react';
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
  Crown,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLensStore } from '@/store/lensStore';
import type { CustomerProfile, Prescription, Tier, Family, Addon, Price, LensData, MACRO_TO_TIER } from '@/types/lens';
import { toast } from 'sonner';

type Step = 'anamnesis' | 'prescription' | 'frame' | 'recommendations';

// Tier mapping
const macroToTier: Record<string, Tier> = {
  'PROG_BASICO': 'essential',
  'PROG_CONFORTO': 'comfort',
  'PROG_AVANCADO': 'advanced',
  'PROG_TOP': 'top',
  'MONO_BASICO': 'essential',
  'MONO_ENTRADA': 'comfort',
  'MONO_INTER': 'advanced',
  'MONO_TOP': 'top',
};

interface FamilyWithPrice {
  family: Family;
  bestPrice: Price | null;
  tier: Tier;
}

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
  const [frameData, setFrameData] = useState({
    horizontalSize: 54,
    verticalSize: 40,
    bridge: 18,
    dp: 64,
    altura: 18,
  });
  const [lensCategory, setLensCategory] = useState<'PROGRESSIVA' | 'MONOFOCAL'>('PROGRESSIVA');
  const [isLoading, setIsLoading] = useState(false);

  const { 
    families = [], 
    addons = [],
    prices = [],
    macros = [],
    supplierPriorities = [],
    selectedAddons = [],
    toggleAddon,
    clearSelectedAddons,
    isDataLoaded,
    loadLensData,
    getBestPriceForFamily,
  } = useLensStore();

  // Load data on mount if not loaded
  useEffect(() => {
    const loadData = async () => {
      if (!isDataLoaded) {
        setIsLoading(true);
        try {
          const response = await fetch('/data/lenses.json');
          const data: LensData = await response.json();
          loadLensData(data);
        } catch (error) {
          console.error('Error loading lens data:', error);
          toast.error('Erro ao carregar dados das lentes');
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadData();
  }, [isDataLoaded, loadLensData]);

  // Determine if prescription requires progressive lenses
  useEffect(() => {
    const hasAddition = (prescriptionData.rightAddition && prescriptionData.rightAddition > 0) ||
                       (prescriptionData.leftAddition && prescriptionData.leftAddition > 0);
    setLensCategory(hasAddition ? 'PROGRESSIVA' : 'MONOFOCAL');
  }, [prescriptionData.rightAddition, prescriptionData.leftAddition]);

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

  // Get recommendations organized by tier
  const getRecommendationsByTier = (): Record<Tier, FamilyWithPrice[]> => {
    const result: Record<Tier, FamilyWithPrice[]> = {
      essential: [],
      comfort: [],
      advanced: [],
      top: [],
    };

    // Filter families by category and active status
    const categoryFamilies = families.filter(f => 
      f.active && f.category === lensCategory
    );

    // Get priority for suppliers per macro
    const getPriority = (macroId: string, supplier: string): number => {
      const priority = supplierPriorities.find(p => p.macroId === macroId);
      if (!priority) return 999;
      const idx = priority.suppliers.indexOf(supplier);
      return idx >= 0 ? idx : 999;
    };

    // Group by macro and find best price for each family
    categoryFamilies.forEach(family => {
      const tier = macroToTier[family.macro];
      if (!tier) return;

      const prescription = prescriptionData.rightSphere !== undefined ? prescriptionData as Prescription : null;
      const frame = frameData.altura ? { ...frameData } : null;
      
      const bestPrice = getBestPriceForFamily(family.id, prescription, frame);
      
      result[tier].push({
        family,
        bestPrice,
        tier,
      });
    });

    // Sort each tier by supplier priority
    Object.keys(result).forEach(tier => {
      result[tier as Tier].sort((a, b) => {
        const priorityA = getPriority(a.family.macro, a.family.supplier);
        const priorityB = getPriority(b.family.macro, b.family.supplier);
        return priorityA - priorityB;
      });
    });

    return result;
  };

  const recommendations = getRecommendationsByTier();
  const activeAddons = addons.filter(a => a.active && a.rules.categories.includes(lensCategory));

  // Calculate total price for a family
  const calculateTotal = (familyWithPrice: FamilyWithPrice) => {
    if (!familyWithPrice.bestPrice) return 0;
    // Price is per half pair, so multiply by 2 for full pair
    const basePrice = familyWithPrice.bestPrice.price_sale_half_pair * 2;
    
    // Add addon prices (simplified - in real world would need addon pricing)
    // For now, addons are typically bundled or have complex pricing
    return basePrice;
  };

  const getTierConfig = (tier: Tier) => {
    const macro = macros.find(m => macroToTier[m.id] === tier && m.category === lensCategory);
    
    switch (tier) {
      case 'essential':
        return { 
          label: macro?.name_client || 'Essencial', 
          icon: <Shield className="w-5 h-5" />,
          color: 'text-muted-foreground',
          bg: 'bg-muted',
          border: 'border-muted-foreground/20',
          description: macro?.description_client || 'Solução básica com correção visual eficiente'
        };
      case 'comfort':
        return { 
          label: macro?.name_client || 'Conforto', 
          icon: <Star className="w-5 h-5" />,
          color: 'text-primary',
          bg: 'bg-primary/10',
          border: 'border-primary/30',
          description: macro?.description_client || 'Equilíbrio entre qualidade e custo-benefício'
        };
      case 'advanced':
        return { 
          label: macro?.name_client || 'Avançada', 
          icon: <Zap className="w-5 h-5" />,
          color: 'text-info',
          bg: 'bg-info/10',
          border: 'border-info/30',
          description: macro?.description_client || 'Tecnologia de ponta para alta performance visual'
        };
      case 'top':
        return { 
          label: macro?.name_client || 'Top de Mercado', 
          icon: <Crown className="w-5 h-5" />,
          color: 'text-secondary',
          bg: 'bg-secondary/10',
          border: 'border-secondary/30',
          description: macro?.description_client || 'O melhor disponível para máxima satisfação'
        };
    }
  };

  // Get addon name for a specific supplier
  const getAddonName = (addon: Addon, supplier: string) => {
    return addon.name_commercial[supplier] || addon.name_common;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

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
                            rightSphere: parseFloat(e.target.value) || 0
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
                            rightCylinder: parseFloat(e.target.value) || 0
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
                            rightAxis: parseInt(e.target.value) || 0
                          }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Adição (para lentes progressivas)</Label>
                      <Input 
                        type="number"
                        step="0.25"
                        placeholder="0.00"
                        value={prescriptionData.rightAddition || ''}
                        onChange={(e) => setPrescriptionData(prev => ({ 
                          ...prev, 
                          rightAddition: parseFloat(e.target.value) || 0
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
                            leftSphere: parseFloat(e.target.value) || 0
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
                            leftCylinder: parseFloat(e.target.value) || 0
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
                            leftAxis: parseInt(e.target.value) || 0
                          }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Adição (para lentes progressivas)</Label>
                      <Input 
                        type="number"
                        step="0.25"
                        placeholder="0.00"
                        value={prescriptionData.leftAddition || ''}
                        onChange={(e) => setPrescriptionData(prev => ({ 
                          ...prev, 
                          leftAddition: parseFloat(e.target.value) || 0
                        }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Lens category indicator */}
                <div className={`mt-6 p-4 rounded-lg flex items-start gap-3 ${
                  lensCategory === 'PROGRESSIVA' 
                    ? 'bg-primary/10 border border-primary/30' 
                    : 'bg-muted'
                }`}>
                  <Info className={`w-5 h-5 shrink-0 mt-0.5 ${
                    lensCategory === 'PROGRESSIVA' ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <div className="text-sm">
                    <p className="font-medium text-foreground mb-1">
                      {lensCategory === 'PROGRESSIVA' ? 'Lente Progressiva' : 'Lente Monofocal'}
                    </p>
                    <p className="text-muted-foreground">
                      {lensCategory === 'PROGRESSIVA' 
                        ? 'A adição indica necessidade de lentes progressivas (multifocais).'
                        : 'Sem adição, indicamos lentes monofocais (visão simples).'}
                    </p>
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
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Horizontal (mm)</Label>
                    <Input 
                      type="number" 
                      placeholder="54"
                      value={frameData.horizontalSize || ''}
                      onChange={(e) => setFrameData(prev => ({ ...prev, horizontalSize: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Vertical (mm)</Label>
                    <Input 
                      type="number" 
                      placeholder="40"
                      value={frameData.verticalSize || ''}
                      onChange={(e) => setFrameData(prev => ({ ...prev, verticalSize: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Ponte (mm)</Label>
                    <Input 
                      type="number" 
                      placeholder="18"
                      value={frameData.bridge || ''}
                      onChange={(e) => setFrameData(prev => ({ ...prev, bridge: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">DP (mm)</Label>
                    <Input 
                      type="number" 
                      placeholder="64"
                      value={frameData.dp || ''}
                      onChange={(e) => setFrameData(prev => ({ ...prev, dp: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Altura (mm)</Label>
                    <Input 
                      type="number" 
                      placeholder="18"
                      value={frameData.altura || ''}
                      onChange={(e) => setFrameData(prev => ({ ...prev, altura: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div className="mt-6 p-4 bg-info/10 rounded-lg flex items-start gap-3">
                  <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Dica</p>
                    <p>As medidas da armação ajudam a filtrar SKUs compatíveis e recomendar o índice de refração mais adequado para melhor estética.</p>
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
                {' • '}
                <Badge variant="outline">{lensCategory === 'PROGRESSIVA' ? 'Progressiva' : 'Monofocal'}</Badge>
              </p>
            </div>

            {/* Addons Selection */}
            {activeAddons.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Complementos Disponíveis</CardTitle>
                  <CardDescription>Adicione tratamentos para personalizar a solução</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {activeAddons.map((addon) => (
                      <button
                        key={addon.id}
                        onClick={() => toggleAddon(addon.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                          selectedAddons.includes(addon.id)
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-card hover:border-primary/50'
                        }`}
                      >
                        {selectedAddons.includes(addon.id) ? (
                          <Minus className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                        <span>{addon.name_common}</span>
                      </button>
                    ))}
                  </div>
                  {selectedAddons.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-sm text-muted-foreground">
                        Selecionados: {selectedAddons.map(id => addons.find(a => a.id === id)?.name_common).join(', ')}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
                        {tierFamilies.map(({ family, bestPrice }) => (
                          <div 
                            key={family.id}
                            className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                              bestPrice 
                                ? 'bg-muted/30 hover:bg-muted/50' 
                                : 'bg-destructive/5 opacity-60'
                            }`}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-foreground">{family.name_original}</span>
                                <Badge variant="outline" className="text-xs">
                                  {family.supplier}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {family.attributes_display_base.slice(0, 3).map((attr, i) => (
                                  <span 
                                    key={i}
                                    className="text-xs px-2 py-0.5 bg-background rounded-full text-muted-foreground"
                                  >
                                    ✓ {attr}
                                  </span>
                                ))}
                                {family.attributes_display_base.length > 3 && (
                                  <span className="text-xs px-2 py-0.5 bg-background rounded-full text-muted-foreground">
                                    +{family.attributes_display_base.length - 3} mais
                                  </span>
                                )}
                              </div>
                              {bestPrice && bestPrice.addons_detected && bestPrice.addons_detected.length > 0 && (
                                <div className="mt-2 flex gap-1">
                                  {bestPrice.addons_detected.map(addonId => {
                                    const addon = addons.find(a => a.id === addonId);
                                    if (!addon) return null;
                                    return (
                                      <Badge key={addonId} className="text-xs bg-secondary/20 text-secondary-foreground">
                                        {getAddonName(addon, family.supplier)}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                            <div className="text-right ml-4">
                              {bestPrice ? (
                                <>
                                  <div className="text-2xl font-bold text-foreground">
                                    R$ {(bestPrice.price_sale_half_pair * 2).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    par completo
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    ERP: {bestPrice.erp_code}
                                  </div>
                                  <Button size="sm" className="mt-2 gradient-primary text-primary-foreground">
                                    Selecionar
                                  </Button>
                                </>
                              ) : (
                                <div className="text-sm text-destructive">
                                  Indisponível para esta receita
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Summary of no recommendations */}
            {Object.values(recommendations).every(r => r.length === 0) && (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <Info className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma recomendação encontrada</h3>
                  <p className="text-muted-foreground">
                    Verifique se os dados da receita estão corretos ou se existem famílias ativas para esta categoria.
                  </p>
                </CardContent>
              </Card>
            )}
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
