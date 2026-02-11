import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Info,
  Store,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useLensStore } from '@/store/lensStore';
import { useCatalogLoader } from '@/hooks/useCatalogLoader';
import { useCatalogResolver } from '@/hooks/useCatalogResolver';
import { useRecommendationEngine } from '@/hooks/useRecommendationEngine';
import { useStoreContext } from '@/hooks/useStoreContext';
import { useDraftPersistence } from '@/hooks/useDraftPersistence';
import type { 
  Prescription, 
  Tier, 
  Family, 
  Price, 
  LensData, 
  AnamnesisData,
  FrameMeasurements,
  ClinicalType
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
  const [lensCategory, setLensCategory] = useState<ClinicalType>('PROGRESSIVA');
  const [suggestedClinicalType, setSuggestedClinicalType] = useState<ClinicalType>('PROGRESSIVA');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedConfiguration, setSelectedConfiguration] = useState<LensCardConfiguration | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);

  // Store context
  const { 
    stores, 
    selectedStoreId, 
    selectedStore, 
    setSelectedStoreId, 
    needsStoreSelection, 
    isLoading: storesLoading 
  } = useStoreContext();

  // Draft persistence
  const { 
    existingDraft, 
    isCheckingDraft, 
    draftServiceId,
    draftCustomerId,
    resumeDraft, 
    discardDraft, 
    saveDraft,
    promoteDraft,
  } = useDraftPersistence({ storeId: selectedStoreId });

  // Draft resume state
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const draftPromptShownRef = useRef(false);

  useEffect(() => {
    if (existingDraft && !isCheckingDraft && !draftPromptShownRef.current) {
      draftPromptShownRef.current = true;
      setShowDraftPrompt(true);
    }
  }, [existingDraft, isCheckingDraft]);

  const handleResumeDraft = () => {
    const draft = resumeDraft();
    if (draft) {
      setCustomerName(draft.customerName);
      if (draft.anamnesisData) setAnamnesisData(draft.anamnesisData);
      if (draft.prescriptionData) setPrescriptionData(draft.prescriptionData);
      if (draft.frameData) setFrameData(draft.frameData);
      if (draft.lensCategory) setLensCategory(draft.lensCategory);
      toast.success('Atendimento anterior retomado');
    }
    setShowDraftPrompt(false);
  };

  const handleDiscardDraft = async () => {
    await discardDraft();
    setShowDraftPrompt(false);
    toast.info('Rascunho descartado');
  };

  // Use catalog resolver for dynamic tier mapping (no hardcode)
  const { getTierKey } = useCatalogResolver();

  // Use centralized catalog loader - cloud is single source of truth
  const { loadCatalog, isLoading: catalogLoading } = useCatalogLoader();

  const { 
    families = [], 
    addons = [],
    prices = [],
    macros = [],
    supplierPriorities = [],
    attributeDefs = [],
    isDataLoaded,
    loadLensData,
    getBestPriceForFamily,
    getCompatiblePrices,
    rawLensData,
  } = useLensStore();

  // Load data on mount - only once per component lifecycle
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (hasLoadedRef.current) return;
    if (families.length > 0) {
      hasLoadedRef.current = true;
      return;
    }
    hasLoadedRef.current = true;
    const loadData = async () => {
      setIsLoading(true);
      try {
        const success = await loadCatalog();
        console.log('[SellerFlow] Catalog loaded:', success);
        if (!success) {
          toast.error('Erro ao carregar dados das lentes');
        }
      } catch (error) {
        console.error('[SellerFlow] Error loading lens data:', error);
        toast.error('Erro ao carregar dados das lentes');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Suggest clinical type based on prescription (but don't force)
  useEffect(() => {
    const hasAddition = (prescriptionData.rightAddition && prescriptionData.rightAddition > 0) ||
                       (prescriptionData.leftAddition && prescriptionData.leftAddition > 0);
    const suggested: ClinicalType = hasAddition ? 'PROGRESSIVA' : 'MONOFOCAL';
    setSuggestedClinicalType(suggested);
  }, [prescriptionData.rightAddition, prescriptionData.leftAddition]);

  // Save draft on step change (debounced via hook)
  const prevStepRef = useRef(currentStep);
  useEffect(() => {
    if (prevStepRef.current !== currentStep && currentStep !== 'budget') {
      prevStepRef.current = currentStep;
      saveDraft(customerName, anamnesisData, prescriptionData as Partial<Prescription>, frameData as Partial<FrameMeasurements>, lensCategory);
    }
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Build lensData for the recommendation engine
  const lensDataForEngine: LensData | null = isDataLoaded ? {
    meta: { schema_version: '', dataset_name: '', generated_at: '', counts: { families: 0, addons: 0, skus_prices: 0 }, notes: [] },
    scales: {},
    attribute_defs: attributeDefs,
    macros,
    families,
    addons,
    products_avulsos: [],
    prices,
    technology_library: rawLensData?.technology_library,
  } : null;

  // Use the new recommendation engine
  const { 
    recommendations, 
    topRecommendationId, 
    stats: engineStats,
    isReady: engineReady,
    engineResult,
  } = useRecommendationEngine({
    lensData: lensDataForEngine,
    lensCategory,
    anamnesisData,
    prescriptionData,
  });

  const activeAddons = addons.filter(a => a.active && a.rules?.categories?.includes(lensCategory));

  // Get occupational recommendations using the engine too
  const { recommendations: occupationalRecommendations } = useRecommendationEngine({
    lensData: lensDataForEngine,
    lensCategory: 'OCUPACIONAL',
    anamnesisData,
    prescriptionData,
  });

  // Log engine stats
  useEffect(() => {
    if (engineReady) {
      console.log(`[SellerFlow] RecommendationEngine stats:`, engineStats);
    }
  }, [engineReady, engineStats]);

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

  if (isLoading || isCheckingDraft || storesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando dados...</p>
        </div>
      </div>
    );
  }

  // Draft resume prompt
  if (showDraftPrompt && existingDraft) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 space-y-4">
            <div className="text-center">
              <RotateCcw className="w-10 h-10 mx-auto mb-3 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Atendimento em andamento</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Você tem um rascunho para <strong>{existingDraft.customerName}</strong>. Deseja continuar?
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 gap-2" onClick={handleDiscardDraft}>
                <Trash2 className="w-4 h-4" />
                Descartar
              </Button>
              <Button className="flex-1 gap-2" onClick={handleResumeDraft}>
                <RotateCcw className="w-4 h-4" />
                Continuar
              </Button>
            </div>
          </CardContent>
        </Card>
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
                  {selectedStore && <span className="ml-1">• {selectedStore.name}</span>}
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
      <main className="container mx-auto px-6 py-8">
        {/* Store Selection (if needed) */}
        {needsStoreSelection && currentStep === 'profile' && (
          <div className="mb-6 p-4 rounded-lg border border-primary/30 bg-primary/5">
            <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Store className="w-4 h-4" />
              Selecione a Loja
            </Label>
            <Select value={selectedStoreId || ''} onValueChange={setSelectedStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha a loja..." />
              </SelectTrigger>
              <SelectContent>
                {stores.map(store => (
                  <SelectItem key={store.id} value={store.id}>
                    {store.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
              onClinicalTypeChange={setLensCategory}
              suggestedClinicalType={suggestedClinicalType}
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
          <div className="space-y-6 animate-slide-up w-full">
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
              mostRecommendedId={topRecommendationId || undefined}
              lensCategory={lensCategory}
              attributeDefs={attributeDefs}
              anamnesisData={anamnesisData}
              prescriptionData={prescriptionData}
              lensData={lensDataForEngine}
              engineResult={engineResult}
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
              engineResult={engineResult}
              lensData={lensDataForEngine}
              storeId={selectedStoreId}
              draftServiceId={draftServiceId}
              draftCustomerId={draftCustomerId}
              onDraftPromoted={promoteDraft}
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
