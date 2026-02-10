/**
 * SimplifiedLensCard - Card otimizado para varejo (dados reais do catálogo v3.6.2.2)
 * 
 * v3.6.2.2 RULES:
 * - display_name from family.display_name (NEVER concatenate from SKU)
 * - index from prices[].index_value
 * - addons from prices[].addons_detected[]
 * - toggles from families[].options
 * - addons[] library for labels
 * - NO inference from description/regex
 * - Debug tooltip: family_id + sku_id + index_value + addons_detected
 */

import { useState, useMemo, useCallback, useRef } from 'react';
import { 
  Check, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Crown,
  Shield,
  ThumbsUp,
  Zap,
  Eye,
  LayoutGrid,
  Sparkles,
  AlertTriangle,
  Bug
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
import { buildOptionMatrix, type OptionMatrix } from '@/lib/optionMatrix';
import { useCatalogEnricher } from '@/hooks/useCatalogEnricher';
import { useLensStore } from '@/store/lensStore';
import type { Family, Price, Addon, Tier, ClinicalType, CatalogAddon, FamilyExtended } from '@/types/lens';
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

const TIER_ICONS: Record<Tier, React.ElementType> = {
  essential: Shield,
  comfort: ThumbsUp,
  advanced: Zap,
  top: Crown,
};

const TIER_LABELS: Record<Tier, string> = {
  essential: 'Essential',
  comfort: 'Conforto',
  advanced: 'Avançada',
  top: 'Premium',
};

const TIER_STYLES: Record<Tier, {
  bg: string; border: string; accent: string; selectedRing: string;
}> = {
  essential: { bg: 'bg-slate-50 dark:bg-slate-900/50', border: 'border-slate-200 dark:border-slate-700', accent: 'text-slate-600 dark:text-slate-400', selectedRing: 'ring-slate-400' },
  comfort: { bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', accent: 'text-blue-600 dark:text-blue-400', selectedRing: 'ring-blue-400' },
  advanced: { bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-800', accent: 'text-purple-600 dark:text-purple-400', selectedRing: 'ring-purple-400' },
  top: { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', accent: 'text-amber-600 dark:text-amber-400', selectedRing: 'ring-amber-400' },
};

// Expandable "Por que esta lente" block
const KnowledgeConsumerBlock = ({ text }: { text: string }) => {
  const [expanded, setExpanded] = useState(false);
  const needsExpand = text.length > 120;

  return (
    <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">
      <span className="font-medium text-foreground text-[10px] uppercase tracking-wide block mb-1">
        Por que esta lente
      </span>
      <p className={needsExpand && !expanded ? 'line-clamp-3' : ''}>
        {text}
      </p>
      {needsExpand && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 flex items-center gap-0.5 text-primary hover:underline text-[10px] font-medium"
        >
          {expanded ? (
            <><ChevronUp className="w-3 h-3" />Ver menos</>
          ) : (
            <><ChevronDown className="w-3 h-3" />Ver mais</>
          )}
        </button>
      )}
    </div>
  );
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
  const storeAddons = useLensStore(s => s.addons);
  const enrichedFamily = getEnrichedFamily(family.id);
  const familyExt = (family as FamilyExtended);
  
  const styles = TIER_STYLES[tier];
  const TierIcon = TIER_ICONS[tier];
  const lensCategory = (family.clinical_type || family.category) as ClinicalType;

  // v3.6.2.2: Build OptionMatrix with family options & addons library (NO inference)
  const optionMatrix = useMemo(() => 
    buildOptionMatrix(family.id, allPrices, null, familyExt, storeAddons as CatalogAddon[]),
    [family.id, allPrices, familyExt, storeAddons]
  );

  const cheapestPrice = useMemo(() => {
    if (!allPrices.length) return null;
    return [...allPrices].sort((a, b) => a.price_sale_half_pair - b.price_sale_half_pair)[0];
  }, [allPrices]);

  const [selectedIndex, setSelectedIndex] = useState<string>(() => 
    optionMatrix.indexOptions.length > 0 ? optionMatrix.indexOptions[0].index : '1.50'
  );
  const [selectedTreatments, setSelectedTreatments] = useState<string[]>([]);

  const resolved = useMemo(() => 
    optionMatrix.resolve(selectedIndex, selectedTreatments),
    [optionMatrix, selectedIndex, selectedTreatments]
  );

  const currentPrice = resolved?.price || cheapestPrice;
  const priceDisplay = resolved?.pairPrice || (cheapestPrice ? cheapestPrice.price_sale_half_pair * 2 : null);
  const basePriceDisplay = cheapestPrice ? cheapestPrice.price_sale_half_pair * 2 : null;
  const hasUpgrade = priceDisplay && basePriceDisplay && priceDisplay > basePriceDisplay;
  const hasOptions = allPrices.length > 0 && priceDisplay !== null && priceDisplay > 0;

  // v3.6.2.6: Display name from catalog — NO inference, NO abbreviation
  // Priority: enrichedFamily.display_name → family.display_name → family.name_display → humanize(name_original)
  const displayName = useMemo(() => {
    return enrichedFamily?.display_name 
      || familyExt.display_name 
      || familyExt.name_display 
      || familyExt.name_original?.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) 
      || family.id;
  }, [enrichedFamily, familyExt, family]);

  // Prepend supplier if not already in name
  const fullDisplayName = useMemo(() => {
    if (displayName.toUpperCase().includes(family.supplier.toUpperCase())) return displayName;
    return `${family.supplier} ${displayName}`;
  }, [displayName, family.supplier]);

  const subtitle = useMemo(() => {
    // v3.6.2.5: Use catalog subtitle directly (no appending supplier)
    if (familyExt.display_subtitle) return familyExt.display_subtitle;
    const category = lensCategory === 'PROGRESSIVA' ? 'Progressiva' 
      : lensCategory === 'OCUPACIONAL' ? 'Ocupacional' : 'Monofocal';
    return `${category} • ${TIER_LABELS[tier]} • ${family.supplier}`;
  }, [familyExt, lensCategory, tier, family.supplier]);

  const knowledgeConsumer = useMemo(() => {
    if (scoredFamily?.knowledgeConsumer) return scoredFamily.knowledgeConsumer;
    if (enrichedFamily?.knowledge?.consumer) return enrichedFamily.knowledge.consumer;
    return null;
  }, [scoredFamily, enrichedFamily]);

  const salesPills = useMemo(() => {
    if (scoredFamily?.salesPills?.length) return scoredFamily.salesPills.slice(0, 4);
    if (enrichedFamily?.sales_pills?.length) return enrichedFamily.sales_pills.slice(0, 4);
    if (scoredFamily?.technologies?.length) {
      return scoredFamily.technologies.flatMap(t => t.benefits?.slice(0, 1) || [t.name_common]).slice(0, 4);
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

  const resolvedTechnologies = useMemo(() => {
    return scoredFamily?.technologies?.slice(0, 3) || [];
  }, [scoredFamily]);

  const handleIndexChange = useCallback((index: string) => {
    setSelectedIndex(index);
    setSelectedTreatments([]);
  }, []);

  const handleTreatmentToggle = useCallback((treatmentId: string) => {
    setSelectedTreatments(prev => 
      prev.includes(treatmentId) ? prev.filter(t => t !== treatmentId) : [...prev, treatmentId]
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
                  <Check className="w-3 h-3" />Selecionada
                </Badge>
              )}
              {isRecommended && !isSelected && (
                <Badge className="bg-primary text-primary-foreground text-xs">Melhor opção</Badge>
              )}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-foreground text-base leading-tight line-clamp-2">
              {fullDisplayName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-4 space-y-3">
          {/* Knowledge Consumer - Expandable */}
          {knowledgeConsumer && (
            <KnowledgeConsumerBlock text={knowledgeConsumer} />
          )}

          {/* Sales Pills */}
          <div className="flex flex-wrap gap-1.5">
            {salesPills.map((pill, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs font-normal">{pill}</Badge>
            ))}
            {salesPills.length === 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                      <AlertTriangle className="w-3 h-3" />Dados parciais
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Esta família não possui pílulas de venda no catálogo.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>

          {/* Technologies */}
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
                            {tech.group && <span className="text-[10px] text-muted-foreground ml-1">({tech.group})</span>}
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

          {/* Inline Upgrade Selector - OptionMatrix driven (v3.6.2.2) */}
          <InlineUpgradeSelector
            matrix={optionMatrix}
            selectedIndex={selectedIndex}
            selectedTreatments={selectedTreatments}
            onIndexChange={handleIndexChange}
            onTreatmentToggle={handleTreatmentToggle}
          />

          {/* Value Bars */}
          <ValueBars tier={tier} family={enrichedFamily || undefined} scoredFamily={scoredFamily} />

          {/* Price Display */}
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

          {/* Debug Tooltip (dev mode) */}
          {import.meta.env.DEV && resolved && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground/40 cursor-help">
                    <Bug className="w-3 h-3" />
                    <span>debug</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-sm font-mono text-[10px]">
                  <div className="space-y-0.5">
                    <p><strong>family_id:</strong> {family.id}</p>
                    <p><strong>sku_erp:</strong> {resolved.price.sku_erp ?? 'N/A'}</p>
                    <p><strong>erp_code:</strong> {resolved.price.erp_code}</p>
                    <p><strong>resolved_sku:</strong> {resolved.erpCode}</p>
                    <p><strong>index_value:</strong> {(resolved.price as any).index_value ?? 'N/A'}</p>
                    <p><strong>addons_detected:</strong> {JSON.stringify(resolved.price.addons_detected || [])}</p>
                    <p><strong>pair_price:</strong> R$ {resolved.pairPrice.toFixed(2)}</p>
                    <p><strong>options.indexes:</strong> {JSON.stringify(familyExt.options?.indexes_available || [])}</p>
                    <p><strong>options.addons:</strong> {JSON.stringify(familyExt.options?.addons_available || [])}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* View Alternatives / Details */}
          <div className="flex flex-col gap-1.5 items-center">
            {alternativeCount > 0 && onViewAlternatives && (
              <button
                onClick={onViewAlternatives}
                className="text-xs text-primary hover:underline flex items-center gap-1 justify-center font-medium"
              >
                <LayoutGrid className="w-3 h-3" />
                Ver {alternativeCount} {alternativeCount === 1 ? 'lente equivalente' : 'lentes equivalentes'}
              </button>
            )}
            <button
              onClick={() => setShowDetails(true)}
              className="text-xs text-muted-foreground hover:text-primary hover:underline flex items-center gap-1 justify-center"
            >
              <Eye className="w-3 h-3" />
              Detalhes e configurações
            </button>
          </div>

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
                <><Check className="w-4 h-4 mr-2" />Selecionada</>
              ) : isRecommended ? (
                'Escolher Esta Lente'
              ) : (
                <>Selecionar<ChevronRight className="w-4 h-4 ml-1" /></>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

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
