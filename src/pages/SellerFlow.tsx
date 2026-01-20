import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight,
  User,
  FileText,
  Glasses,
  Sparkles,
  Check,
  Loader2,
  ThumbsUp,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useLensStore } from '@/store/lensStore';
import { useCatalogResolver } from '@/hooks/useCatalogResolver';
import type { 
  Prescription, 
  Tier, 
  Family, 
  Price, 
  LensData, 
  AnamnesisData,
  FrameMeasurements,
  LensCategory
} from '@/types/lens';
import type { SelectedProduct } from '@/lib/productSuggestionEngine';
import { toast } from 'sonner';

// Import anamnesis components
import { UsageProfileStep } from '@/components/anamnesis/UsageProfileStep';
import { VisualComplaintsStep } from '@/components/anamnesis/VisualComplaintsStep';
import { LifestyleStep } from '@/components/anamnesis/LifestyleStep';
import { PrescriptionStep } from '@/components/anamnesis/PrescriptionStep';
import { FrameStep } from '@/components/anamnesis/FrameStep';
import { RecommendationsGrid } from '@/components/recommendations/RecommendationsGrid';
import { BudgetFinalization } from '@/components/budget/BudgetFinalization';
import { LensCardConfiguration } from '@/components/recommendations/LensCard';

interface FamilyWithPrice {
  family: Family;
  bestPrice: Price | null;
  allPrices: Price[];
  tier: Tier;
  score: number;
}

// Default anamnesis data
const defaultAnamnesis: AnamnesisData = {
  primaryUse: 'mixed',
  screenHours: '3-5',
  nightDriving: 'sometimes',
  visualComplaints: [],
  outdoorTime: 'no',
  clearLensPreference: 'indifferent',
  aestheticPriority: 'medium',
};

type Step = 'profile' | 'complaints' | 'lifestyle' | 'prescription' | 'frame' | 'recommendations' | 'budget';

const SellerFlow = () => {
  const [currentStep, setCurrentStep] = useState<Step>('profile');
  const [customerName, setCustomerName] = useState('');
  const [anamnesisData, setAnamnesisData] = useState<AnamnesisData>(defaultAnamnesis);
  const [prescriptionData, setPrescriptionData] = useState<Partial<Prescription>>({
    rightSphere: 0,
    rightCylinder: 0,
    rightAxis: 0,
    leftSphere: 0,
    leftCylinder: 0,
    leftAxis: 0,
  });
  const [frameData, setFrameData] = useState<Partial<FrameMeasurements>>({
    horizontalSize: 54,
    verticalSize: 40,
    bridge: 18,
    dp: 64,
    altura: 18,
  });
  const [lensCategory, setLensCategory] = useState<LensCategory>('PROGRESSIVA');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedConfiguration, setSelectedConfiguration] = useState<LensCardConfiguration | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);

  // Use catalog resolver for dynamic tier mapping (no hardcode)
  const { getTierKey } = useCatalogResolver();

  const { 
    families = [], 
    addons = [],
    prices = [],
    macros = [],
    supplierPriorities = [],
    attributeDefs = [],
    isDataLoaded,
    loadLensData,
    loadCatalogFromCloud,
    getBestPriceForFamily,
    getCompatiblePrices,
  } = useLensStore();

  // Load data on mount - ALWAYS try cloud first for fresh data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Always try to load fresh data from cloud
        const cloudLoaded = await loadCatalogFromCloud();
        console.log('[SellerFlow] Cloud catalog loaded:', cloudLoaded);
        
        if (!cloudLoaded && families.length === 0) {
          // Only fallback to local if cloud failed AND we have no data
          console.log('[SellerFlow] No cloud catalog found, loading from lenses.json...');
          const response = await fetch('/data/lenses.json');
          const data: LensData = await response.json();
          loadLensData(data);
        }
      } catch (error) {
        console.error('[SellerFlow] Error loading lens data:', error);
        if (families.length === 0) {
          // Only fallback if we truly have no data
          try {
            const response = await fetch('/data/lenses.json');
            const data: LensData = await response.json();
            loadLensData(data);
          } catch (e) {
            console.error('[SellerFlow] Failed to load fallback data:', e);
            toast.error('Erro ao carregar dados das lentes');
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [loadLensData, loadCatalogFromCloud]);

  // Debug: verificar integridade dos dados carregados
  useEffect(() => {
    if (families.length > 0 && prices.length > 0) {
      const familyIds = new Set(families.map(f => f.id));
      const pricesWithoutFamily = prices.filter(p => !familyIds.has(p.family_id));
      
      if (pricesWithoutFamily.length > 0) {
        console.warn(`[SellerFlow] ${pricesWithoutFamily.length} preços sem família correspondente`);
      }
      
      const familiesWithPrices = families.filter(f => 
        prices.some(p => p.family_id === f.id && p.active && !p.blocked)
      );
      console.log(`[SellerFlow] ${familiesWithPrices.length}/${families.length} famílias têm preços ativos`);
    }
  }, [families, prices]);

  // Determine if prescription requires progressive lenses
  useEffect(() => {
    const hasAddition = (prescriptionData.rightAddition && prescriptionData.rightAddition > 0) ||
                       (prescriptionData.leftAddition && prescriptionData.leftAddition > 0);
    setLensCategory(hasAddition ? 'PROGRESSIVA' : 'MONOFOCAL');
  }, [prescriptionData.rightAddition, prescriptionData.leftAddition]);

  const steps: { id: Step; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Perfil', icon: <User className="w-4 h-4" /> },
    { id: 'complaints', label: 'Queixas', icon: <Info className="w-4 h-4" /> },
    { id: 'lifestyle', label: 'Estilo', icon: <Sparkles className="w-4 h-4" /> },
    { id: 'prescription', label: 'Receita', icon: <FileText className="w-4 h-4" /> },
    { id: 'frame', label: 'Armação', icon: <Glasses className="w-4 h-4" /> },
    { id: 'recommendations', label: 'Soluções', icon: <ThumbsUp className="w-4 h-4" /> },
    { id: 'budget', label: 'Orçamento', icon: <Check className="w-4 h-4" /> },
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

  // Calculate recommendation score based on anamnesis
  const calculateScore = (family: Family, price: Price | null): number => {
    let score = 100;

    // High screen usage favors digital/blue filter
    if (anamnesisData.screenHours === '6-8' || anamnesisData.screenHours === '8+') {
      if (family.macro.includes('DIGITAL') || price?.addons_detected?.includes('BLUE')) {
        score += 30;
      }
    }

    // Light sensitivity favors photochromic or AR
    if (anamnesisData.visualComplaints.includes('light_sensitivity')) {
      if (price?.addons_detected?.includes('FOTOSSENSIVEL') || price?.addons_detected?.includes('AR')) {
        score += 25;
      }
    }

    // Eye fatigue favors comfort/advanced tiers
    if (anamnesisData.visualComplaints.includes('eye_fatigue') || anamnesisData.visualComplaints.includes('end_day_fatigue')) {
      if (family.macro.includes('CONFORTO') || family.macro.includes('AVANCADO') || family.macro.includes('TOP')) {
        score += 20;
      }
    }

    // Outdoor time favors photochromic
    if (anamnesisData.outdoorTime === 'yes') {
      if (price?.addons_detected?.includes('FOTOSSENSIVEL')) {
        score += 25;
      }
    }

    // Night driving favors quality AR
    if (anamnesisData.nightDriving === 'frequent') {
      if (price?.addons_detected?.includes('AR')) {
        score += 20;
      }
    }

    // Aesthetic priority favors higher index
    if (anamnesisData.aestheticPriority === 'high') {
      if (price?.index && (price.index === '1.74' || price.index === '1.67')) {
        score += 15;
      }
    }

    return score;
  };

  // Get recommendations organized by tier with scoring
  const getRecommendationsByTier = useMemo((): Record<Tier, FamilyWithPrice[]> => {
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
      const tier = getTierKey(family.macro);
      if (!tier) return;

      // Only pass prescription if it has real values (not just initialization defaults)
      const hasRealPrescription = 
        prescriptionData.rightSphere !== 0 || 
        prescriptionData.leftSphere !== 0 ||
        prescriptionData.rightCylinder !== 0 ||
        prescriptionData.leftCylinder !== 0;
      
      const prescription = hasRealPrescription ? prescriptionData as Prescription : null;
      const frame = frameData.altura ? frameData as FrameMeasurements : null;
      
      const bestPrice = getBestPriceForFamily(family.id, prescription, frame);
      const allPrices = getCompatiblePrices(family.id, prescription, frame);
      const score = calculateScore(family, bestPrice);
      
      result[tier].push({
        family,
        bestPrice,
        allPrices,
        tier,
        score,
      });
    });

    // Sort each tier by score (highest first), then by supplier priority
    Object.keys(result).forEach(tier => {
      result[tier as Tier].sort((a, b) => {
        // First by score (higher is better)
        if (b.score !== a.score) return b.score - a.score;
        // Then by supplier priority
        const priorityA = getPriority(a.family.macro, a.family.supplier);
        const priorityB = getPriority(b.family.macro, b.family.supplier);
        return priorityA - priorityB;
      });
    });

    return result;
  }, [families, lensCategory, prescriptionData, frameData, supplierPriorities, anamnesisData, getBestPriceForFamily, getCompatiblePrices]);

  const recommendations = getRecommendationsByTier;
  const activeAddons = addons.filter(a => a.active && a.rules.categories.includes(lensCategory));

  // Get occupational recommendations for suggestions
  const occupationalRecommendations = useMemo((): Record<Tier, FamilyWithPrice[]> => {
    const result: Record<Tier, FamilyWithPrice[]> = {
      essential: [],
      comfort: [],
      advanced: [],
      top: [],
    };

    const ocFamilies = families.filter(f => f.active && f.category === 'OCUPACIONAL');

    ocFamilies.forEach(family => {
      const tier = getTierKey(family.macro);
      if (!tier) return;

      const bestPrice = getBestPriceForFamily(family.id, null, null);
      const allPrices = getCompatiblePrices(family.id, null, null);
      const score = calculateScore(family, bestPrice);

      result[tier].push({
        family,
        bestPrice,
        allPrices,
        tier,
        score,
      });
    });

    return result;
  }, [families, getBestPriceForFamily, getCompatiblePrices, getTierKey, calculateScore]);

  // Find the most recommended option across all tiers
  const getMostRecommended = (): FamilyWithPrice | null => {
    let best: FamilyWithPrice | null = null;
    let bestScore = 0;
    
    (['comfort', 'advanced'] as Tier[]).forEach(tier => {
      const tierFamilies = recommendations[tier];
      if (tierFamilies.length > 0 && tierFamilies[0].bestPrice) {
        if (tierFamilies[0].score > bestScore) {
          best = tierFamilies[0];
          bestScore = tierFamilies[0].score;
        }
      }
    });
    
    return best;
  };

  const mostRecommended = getMostRecommended();

  // Handle lens selection (backward compatibility)
  const handleSelectLens = (configuration: LensCardConfiguration) => {
    setSelectedConfiguration(configuration);
    toast.success('Lente selecionada!');
  };

  // Handle multiple products selection
  const handleSelectProducts = (products: SelectedProduct[]) => {
    setSelectedProducts(products);
    if (products.length > 0) {
      // Create configuration from primary product for budget
      const primary = products.find(p => p.type === 'primary');
      if (primary) {
        const family = families.find(f => f.id === primary.familyId);
        const price = prices.find(p => p.erp_code === primary.selectedPriceErpCode);
        if (family && price) {
          setSelectedConfiguration({
            familyId: primary.familyId,
            selectedPrice: price,
            selectedIndex: primary.selectedIndex,
            selectedTreatments: primary.selectedTreatments,
            totalPrice: primary.unitPrice,
          });
        }
      }
      setCurrentStep('budget');
    }
  };

  // Get selected family details
  const getSelectedFamily = (): Family | null => {
    if (!selectedConfiguration) return null;
    return families.find(f => f.id === selectedConfiguration.familyId) || null;
  };

  // Update anamnesis data helper
  const updateAnamnesis = (data: Partial<AnamnesisData>) => {
    setAnamnesisData(prev => ({ ...prev, ...data }));
  };

  // Handle finalize budget
  const handleFinalizeBudget = () => {
    if (selectedConfiguration || selectedProducts.length > 0) {
      setCurrentStep('budget');
    } else {
      toast.error('Selecione uma lente primeiro');
    }
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
            
            <div className="hidden md:flex items-center gap-1">
              {steps.map((step, idx) => (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => setCurrentStep(step.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs transition-all ${
                      step.id === currentStep
                        ? 'bg-primary text-primary-foreground'
                        : idx < stepIndex
                        ? 'bg-success/20 text-success'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {idx < stepIndex ? <Check className="w-3 h-3" /> : step.icon}
                    <span className="hidden lg:inline">{step.label}</span>
                  </button>
                  {idx < steps.length - 1 && (
                    <div className={`w-4 h-0.5 mx-0.5 ${
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
      <main className="container mx-auto px-6 py-8 max-w-3xl">
        {/* Step 1: Usage Profile */}
        {currentStep === 'profile' && (
          <div className="animate-slide-up">
            <div className="mb-6">
              <Label htmlFor="customerName" className="text-sm">Nome do Cliente (opcional)</Label>
              <Input 
                id="customerName"
                placeholder="Nome do cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-2"
              />
            </div>
            <UsageProfileStep 
              data={anamnesisData} 
              onUpdate={updateAnamnesis} 
            />
          </div>
        )}

        {/* Step 2: Visual Complaints */}
        {currentStep === 'complaints' && (
          <div className="animate-slide-up">
            <VisualComplaintsStep 
              data={anamnesisData} 
              onUpdate={updateAnamnesis} 
            />
          </div>
        )}

        {/* Step 3: Lifestyle */}
        {currentStep === 'lifestyle' && (
          <div className="animate-slide-up">
            <LifestyleStep 
              data={anamnesisData} 
              onUpdate={updateAnamnesis} 
            />
          </div>
        )}

        {/* Step 4: Prescription */}
        {currentStep === 'prescription' && (
          <div className="animate-slide-up">
            <PrescriptionStep 
              data={prescriptionData}
              onUpdate={(data) => setPrescriptionData(prev => ({ ...prev, ...data }))}
              lensCategory={lensCategory}
            />
          </div>
        )}

        {/* Step 5: Frame */}
        {currentStep === 'frame' && (
          <div className="animate-slide-up">
            <FrameStep 
              data={frameData}
              onUpdate={(data) => setFrameData(prev => ({ ...prev, ...data }))}
            />
          </div>
        )}

        {/* Step 6: Recommendations */}
        {currentStep === 'recommendations' && (
          <div className="space-y-6 animate-slide-up max-w-7xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">Soluções Recomendadas</h2>
              <p className="text-muted-foreground">
                {customerName ? `Para ${customerName} • ` : ''}
                Escolha a melhor opção para o seu cliente
              </p>
            </div>

            <RecommendationsGrid
              recommendations={recommendations}
              occupationalRecommendations={occupationalRecommendations}
              addons={activeAddons}
              onSelectLens={handleSelectLens}
              onSelectProducts={handleSelectProducts}
              selectedFamilyId={selectedConfiguration?.familyId}
              mostRecommendedId={mostRecommended?.family.id}
              lensCategory={lensCategory}
              attributeDefs={attributeDefs}
              anamnesisData={anamnesisData}
              prescriptionData={prescriptionData}
              lensData={isDataLoaded ? { 
                meta: { schema_version: '', dataset_name: '', generated_at: '', counts: { families: 0, addons: 0, skus_prices: 0 }, notes: [] },
                scales: {},
                attribute_defs: attributeDefs,
                macros,
                families,
                addons,
                products_avulsos: [],
                prices,
              } : null}
            />
          </div>
        )}

        {/* Step 7: Budget Finalization */}
        {currentStep === 'budget' && selectedConfiguration && (
          <div className="animate-slide-up max-w-4xl mx-auto">
            <BudgetFinalization
              configuration={selectedConfiguration}
              family={getSelectedFamily()!}
              customerName={customerName}
              anamnesisData={anamnesisData}
              prescriptionData={prescriptionData}
              frameData={frameData}
              attributeDefs={attributeDefs}
              lensCategory={lensCategory}
              additionalProducts={selectedProducts.filter(p => p.type !== 'primary')}
              onBack={() => setCurrentStep('recommendations')}
            />
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t">
          <Button 
            variant="outline" 
            onClick={goBack}
            disabled={stepIndex === 0}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          
          {currentStep === 'recommendations' ? (
            <Button 
              onClick={handleFinalizeBudget}
              disabled={!selectedConfiguration}
              className="gap-2 gradient-secondary text-secondary-foreground"
            >
              <Check className="w-4 h-4" />
              Finalizar Orçamento
            </Button>
          ) : currentStep === 'budget' ? (
            <div />
          ) : stepIndex < steps.length - 1 ? (
            <Button onClick={goNext} className="gap-2 gradient-primary text-primary-foreground">
              Continuar
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : null}
        </div>
      </main>
    </div>
  );
};

export default SellerFlow;
