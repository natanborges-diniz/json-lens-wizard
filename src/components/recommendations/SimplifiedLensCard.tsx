/**
 * SimplifiedLensCard - Card otimizado para varejo (com dados reais do catálogo)
 * 
 * Exibe obrigatoriamente:
 * A) knowledge.consumer (Por que esta lente)
 * B) sales_pills reais (sem fallback genérico)
 * C) Tecnologias resolvidas (top 3)
 * D) Inline upgrades (índice + tratamentos) com preço dinâmico
 * E) Tooltip de score breakdown
 */

import { useState, useMemo, useCallback } from 'react';
import { 
  Check, 
  ChevronRight,
  Crown,
  Shield,
  ThumbsUp,
  Zap,
  Eye,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ValueBars } from './ValueBars';
import { LensDetailsDrawer } from './LensDetailsDrawer';
import { ScoreIndicator } from './ScoreIndicator';
import { InlineUpgradeSelector } from './InlineUpgradeSelector';
import { useCatalogEnricher } from '@/hooks/useCatalogEnricher';
import type { Family, Price, Addon, Tier, ClinicalType } from '@/types/lens';
import type { ScoredFamily } from '@/lib/recommendationEngine/types';

interface SimplifiedLensCardProps {
  family: Family;
  bestPrice: Price | null;
  allPrices: Price[];
  tier: Tier;
  isRecommended?: boolean;
  isSelected?: boolean;
  addons: Addon[];
  onSelect: (config: LensCardSelection) => void;
  alternativeCount?: number;
  onViewAlternatives?: () => void;
  scoredFamily?: ScoredFamily;
  showScore?: boolean;
}

export interface LensCardSelection {
  familyId: string;
  selectedPrice: Price;
  selectedIndex: string;
  selectedTreatments: string[];
  totalPrice: number;
}

// Tier icons
const TIER_ICONS: Record<Tier, React.ElementType> = {
  essential: Shield,
  comfort: ThumbsUp,
  advanced: Zap,
  top: Crown,
};

// Tier labels (PT-BR)
const TIER_LABELS: Record<Tier, string> = {
  essential: 'Essential',
  comfort: 'Conforto',
  advanced: 'Avançada',
  top: 'Premium',
};

// Tier colors
const TIER_STYLES: Record<Tier, {
  bg: string;
  border: string;
  accent: string;
  selectedRing: string;
}> = {
  essential: {
    bg: 'bg-slate-50 dark:bg-slate-900/50',
    border: 'border-slate-200 dark:border-slate-700',
    accent: 'text-slate-600 dark:text-slate-400',
    selectedRing: 'ring-slate-400',
  },
  comfort: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    accent: 'text-blue-600 dark:text-blue-400',
    selectedRing: 'ring-blue-400',
  },
  advanced: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    accent: 'text-purple-600 dark:text-purple-400',
    selectedRing: 'ring-purple-400',
  },
  top: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    accent: 'text-amber-600 dark:text-amber-400',
    selectedRing: 'ring-amber-400',
  },
};

// Get index from price (V3.6.x compatible)
const getIndexFromPrice = (price: Price): string => {
  const avail = (price as any).availability;
  if (avail?.index) return avail.index;
  if ((price as any).index) return (price as any).index;
  return '1.50';
};

export const SimplifiedLensCard = ({
  family,
  bestPrice,
  allPrices,
  tier,
  isRecommended,
  isSelected,
  addons,
  onSelect,
  alternativeCount = 0,
  onViewAlternatives,
  scoredFamily,
  showScore = true,
}: SimplifiedLensCardProps) => {
  const [showDetails, setShowDetails] = useState(false);
  const { getEnrichedFamily } = useCatalogEnricher();
  const enrichedFamily = getEnrichedFamily(family.id);
  
  const styles = TIER_STYLES[tier];
  const TierIcon = TIER_ICONS[tier];
  const lensCategory = (family.clinical_type || family.category) as ClinicalType;

  // Find cheapest price as initial baseline
  const cheapestPrice = useMemo(() => {
    if (!allPrices.length) return null;
    return [...allPrices].sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0];
  }, [allPrices]);

  // Inline upgrade state
  const [selectedIndex, setSelectedIndex] = useState<string>(() => 
    cheapestPrice ? getIndexFromPrice(cheapestPrice) : '1.50'
  );
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>(() =>
    cheapestPrice?.addons_detected || []
  );

  // Calculate current price based on inline selections
  const currentPrice = useMemo(() => {
    if (!allPrices.length) return null;
    const pricesForIndex = allPrices.filter(p => getIndexFromPrice(p) === selectedIndex);
    if (pricesForIndex.length === 0) return cheapestPrice;

    if (selectedTreatments.length === 0) {
      const noTreatment = pricesForIndex.filter(p => !p.addons_detected?.length);
      const candidates = noTreatment.length > 0 ? noTreatment : pricesForIndex;
      return candidates.sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0];
    }

    // Find price matching all selected treatments
    const matching = pricesForIndex.filter(p => {
      const detected = p.addons_detected || [];
      return selectedTreatments.every(t => detected.includes(t));
    });
    if (matching.length > 0) {
      return matching.sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0];
    }

    // Fallback: cheapest for this index
    return pricesForIndex.sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0];
  }, [allPrices, selectedIndex, selectedTreatments, cheapestPrice]);

  const priceDisplay = currentPrice ? currentPrice.price_sale_half_pair * 2 : null;
  const basePriceDisplay = cheapestPrice ? cheapestPrice.price_sale_half_pair * 2 : null;
  const hasUpgrade = priceDisplay && basePriceDisplay && priceDisplay > basePriceDisplay;
  const hasOptions = allPrices.length > 0 && priceDisplay !== null && priceDisplay > 0;

  // Display name
  const displayName = useMemo(() => {
    let familyName = '';
    if (enrichedFamily?.display_name) {
      familyName = enrichedFamily.display_name;
    } else if (family.name_original) {
      familyName = family.name_original;
    } else {
      familyName = family.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    if (familyName.toLowerCase().includes(family.supplier.toLowerCase())) {
      return familyName;
    }
    return `${family.supplier} ${familyName}`;
  }, [enrichedFamily, family]);

  const subtitle = useMemo(() => {
    const category = lensCategory === 'PROGRESSIVA' ? 'Progressiva' 
      : lensCategory === 'OCUPACIONAL' ? 'Ocupacional' : 'Monofocal';
    return `${category} • ${TIER_LABELS[tier]} • ${family.supplier}`;
  }, [lensCategory, tier, family.supplier]);

  // A) Knowledge consumer
  const knowledgeConsumer = useMemo(() => {
    if (scoredFamily?.knowledgeConsumer) return scoredFamily.knowledgeConsumer;
    if (enrichedFamily?.knowledge?.consumer) return enrichedFamily.knowledge.consumer;
    return null;
  }, [scoredFamily, enrichedFamily]);

  // B) Sales pills - REAL data
  const salesPills = useMemo(() => {
    if (scoredFamily?.salesPills?.length) return scoredFamily.salesPills.slice(0, 4);
    if (enrichedFamily?.sales_pills?.length) return enrichedFamily.sales_pills.slice(0, 4);
    if (scoredFamily?.technologies?.length) {
      return scoredFamily.technologies
        .flatMap(t => t.benefits?.slice(0, 1) || [t.name_common])
        .slice(0, 4);
    }
    if (family.attributes_base) {
      const attrs = Object.entries(family.attributes_base)
        .filter(([_, v]) => typeof v === 'number' && v >= 3)
        .map(([k]) => k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))
        .slice(0, 3);
      if (attrs.length > 0) return attrs;
    }
    return [];
  }, [scoredFamily, enrichedFamily, family]);

  // C) Technologies
  const resolvedTechnologies = useMemo(() => {
    return scoredFamily?.technologies?.slice(0, 3) || [];
  }, [scoredFamily]);

  // Handlers
  const handleIndexChange = useCallback((index: string) => {
    setSelectedIndex(index);
    setSelectedTreatments([]); // Reset treatments on index change
  }, []);

  const handleTreatmentToggle = useCallback((treatmentId: string) => {
    setSelectedTreatments(prev => 
      prev.includes(treatmentId) 
        ? prev.filter(t => t !== treatmentId) 
        : [...prev, treatmentId]
    );
  }, []);

  const handleSelect = () => {
    if (!currentPrice) return;
    onSelect({
      familyId: family.id,
      selectedPrice: currentPrice,
      selectedIndex,
      selectedTreatments,
      totalPrice: currentPrice.price_sale_half_pair * 2,
    });
  };

  return (
    <>
      <Card className={`
        flex flex-col h-full border-2 transition-all duration-200
        ${isSelected 
          ? `ring-4 ${styles.selectedRing} ring-offset-2 border-transparent shadow-lg scale-[1.02]`
          : isRecommended 
            ? 'ring-2 ring-primary ring-offset-2 border-primary shadow-md' 
            : styles.border
        }
        hover:shadow-md hover:-translate-y-0.5
      `}>
        {/* Header */}
        <CardHeader className={`${styles.bg} rounded-t-lg p-4 space-y-2`}>
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className={`gap-1 ${styles.accent} border-current`}>
              <TierIcon className="w-3.5 h-3.5" />
              {TIER_LABELS[tier]}
            </Badge>
            <div className="flex gap-1 items-center">
              {showScore && scoredFamily && (
                <ScoreIndicator score={scoredFamily.score} compact={true} showReasons={true} />
              )}
              {isSelected && (
                <Badge className="bg-success text-success-foreground text-xs gap-1">
                  <Check className="w-3 h-3" />
                  Selecionada
                </Badge>
              )}
              {isRecommended && !isSelected && (
                <Badge className="bg-primary text-primary-foreground text-xs">
                  Melhor opção
                </Badge>
              )}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-foreground text-lg leading-tight line-clamp-1">
              {displayName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4 space-y-3">
          {/* A) Knowledge Consumer */}
          {knowledgeConsumer && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5 line-clamp-3">
              <span className="font-medium text-foreground text-[10px] uppercase tracking-wide block mb-1">
                Por que esta lente
              </span>
              {knowledgeConsumer}
            </div>
          )}

          {/* B) Sales Pills */}
          <div className="flex flex-wrap gap-1.5">
            {salesPills.map((pill, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs font-normal">{pill}</Badge>
            ))}
            {salesPills.length === 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Dados parciais
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Esta família não possui pílulas de venda no catálogo.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* C) Technologies */}
          {resolvedTechnologies.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">
                Tecnologias
              </span>
              <div className="space-y-1">
                {resolvedTechnologies.map((tech, idx) => (
                  <TooltipProvider key={idx}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-start gap-1.5 text-xs">
                          <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                          <span className="text-muted-foreground line-clamp-1">
                            <span className="font-medium text-foreground">{tech.name_common}</span>
                            {tech.group && (
                              <span className="text-[10px] text-muted-foreground ml-1">({tech.group})</span>
                            )}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p className="font-medium">{tech.name_common}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {tech.description_short || tech.description_long?.substring(0, 100) || 'Sem descrição disponível'}
                        </p>
                        {tech.benefits?.length > 0 && (
                          <ul className="text-xs mt-1 space-y-0.5">
                            {tech.benefits.slice(0, 3).map((b, i) => <li key={i}>• {b}</li>)}
                          </ul>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>
          )}

          {/* D) Inline Upgrade Selector - Index + Treatments */}
          {/* Debug removed - toggles working */}
          <InlineUpgradeSelector
            allPrices={allPrices}
            selectedIndex={selectedIndex}
            selectedTreatments={selectedTreatments}
            onIndexChange={handleIndexChange}
            onTreatmentToggle={handleTreatmentToggle}
          />

          {/* Value Bars */}
          <ValueBars tier={tier} family={enrichedFamily || undefined} scoredFamily={scoredFamily} />

          {/* Price Display - Dynamic based on selections */}
          <div className={`text-center py-3 rounded-lg transition-colors ${
            isSelected ? 'bg-success/10' : 'bg-muted/30'
          }`}>
            {hasOptions && priceDisplay ? (
              <>
                {hasUpgrade ? (
                  <div className="text-xs text-muted-foreground mb-1 line-through">
                    Base: R$ {basePriceDisplay!.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mb-1">A partir de</div>
                )}
                <div className={`text-2xl font-bold ${isSelected ? 'text-success' : 'text-foreground'}`}>
                  R$ {priceDisplay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground mt-1">par completo</div>
              </>
            ) : (
              <div className="text-sm text-destructive font-medium py-2">
                Sem opções para esta receita
              </div>
            )}
          </div>

          {/* View Details Link */}
          <button
            onClick={() => setShowDetails(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1 justify-center"
          >
            <Eye className="w-3 h-3" />
            Todas as configurações
            {allPrices.length > 1 && ` (${allPrices.length} SKUs)`}
          </button>

          {/* CTA Button */}
          <div className="mt-auto pt-2">
            <Button 
              onClick={handleSelect}
              disabled={!hasOptions}
              variant={isSelected ? 'outline' : 'default'}
              className={`w-full ${
                isSelected 
                  ? 'border-success text-success hover:bg-success/10' 
                  : isRecommended 
                    ? 'bg-primary hover:bg-primary/90' 
                    : ''
              }`}
            >
              {isSelected ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Selecionada
                </>
              ) : isRecommended ? (
                'Escolher Esta Lente'
              ) : (
                <>
                  Selecionar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Details Drawer - full SKU explorer */}
      <LensDetailsDrawer
        open={showDetails}
        onOpenChange={setShowDetails}
        family={family}
        enrichedFamily={enrichedFamily || undefined}
        allPrices={allPrices}
        bestPrice={currentPrice}
        tier={tier}
        addons={addons}
        onSelect={onSelect}
        alternativeCount={alternativeCount}
        onViewAlternatives={onViewAlternatives}
      />
    </>
  );
};
