/**
 * CommercialAuditTab - Auditoria Comercial Estrutural do Catálogo
 * 
 * Diagnóstico read-only que analisa:
 * 1. Média de attributes_base por tier
 * 2. Famílias sem technology_refs
 * 3. Tecnologias mais usadas por tier
 * 4. Anomalias de posicionamento (tech de alto nível em tier baixo)
 * 5. Narrativas de exemplo (demonstrativas)
 * 
 * Resolução de tier: tier_target → macro.tier_key → 'unknown'
 * Anomalia: high_tier_bias >= 0.70 em família essential/comfort
 */

import { useMemo } from 'react';
import { 
  BarChart3, 
  AlertTriangle, 
  Cpu, 
  FileText, 
  Package,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { FamilyExtended, MacroExtended, Technology } from '@/types/lens';
import type { ScoredFamily, TierKey } from '@/lib/recommendationEngine/types';
import { generateFamilyNarrative } from '@/lib/recommendationEngine/narrativeEngine';

// ============================================
// TYPES
// ============================================

type StrictTier = TierKey | 'unknown';

const VALID_TIERS: TierKey[] = ['essential', 'comfort', 'advanced', 'top'];

const TIER_LABELS: Record<StrictTier, string> = {
  essential: 'Essencial',
  comfort: 'Conforto',
  advanced: 'Avançado',
  top: 'Top',
  unknown: 'Sem Tier',
};

const TIER_COLORS: Record<StrictTier, string> = {
  essential: 'bg-muted text-muted-foreground',
  comfort: 'bg-primary/10 text-primary',
  advanced: 'bg-accent/80 text-accent-foreground',
  top: 'bg-destructive/10 text-destructive',
  unknown: 'bg-warning/10 text-warning',
};

interface CommercialAuditTabProps {
  families: FamilyExtended[];
  macros: MacroExtended[];
  technologyLibrary: Record<string, Technology> | null;
}

// ============================================
// TIER RESOLUTION (strict — no name inference)
// ============================================

function resolveStrictTier(
  family: FamilyExtended,
  catalogMacros: MacroExtended[],
): StrictTier {
  // 1. Direct tier_target on family
  if (family.tier_target && VALID_TIERS.includes(family.tier_target as TierKey)) {
    return family.tier_target as TierKey;
  }
  // 2. Macro's tier_key
  const macro = catalogMacros.find(m => m.id === family.macro);
  if (macro?.tier_key && VALID_TIERS.includes(macro.tier_key as TierKey)) {
    return macro.tier_key as TierKey;
  }
  // 3. Unknown
  return 'unknown';
}

// ============================================
// SYNTHETIC ANAMNESIS (fixed for narrative demo)
// ============================================

const SYNTHETIC_ANAMNESIS = {
  primaryUse: 'mixed' as const,
  screenHours: '6-8' as const,
  nightDriving: 'sometimes' as const,
  visualComplaints: ['eye_fatigue' as const],
  outdoorTime: 'no' as const,
  clearLensPreference: 'indifferent' as const,
  aestheticPriority: 'medium' as const,
};

// ============================================
// COMPONENT
// ============================================

export function CommercialAuditTab({ families, macros, technologyLibrary }: CommercialAuditTabProps) {
  const techLib = technologyLibrary || {};
  const activeFamilies = useMemo(() => families.filter(f => f.active), [families]);

  // Group families by strict tier
  const familiesByTier = useMemo(() => {
    const grouped: Record<StrictTier, FamilyExtended[]> = {
      essential: [], comfort: [], advanced: [], top: [], unknown: [],
    };
    activeFamilies.forEach(f => {
      const tier = resolveStrictTier(f, macros);
      grouped[tier].push(f);
    });
    return grouped;
  }, [activeFamilies, macros]);

  const tiersPresent = useMemo(() => {
    const all: StrictTier[] = [...VALID_TIERS, 'unknown'];
    return all.filter(t => familiesByTier[t].length > 0);
  }, [familiesByTier]);

  // ============================================
  // SECTION 1: Average attributes_base per tier
  // ============================================
  const attributeAverages = useMemo(() => {
    // Collect all attribute keys
    const allKeys = new Set<string>();
    activeFamilies.forEach(f => {
      if (f.attributes_base) {
        Object.keys(f.attributes_base).forEach(k => {
          if (typeof f.attributes_base[k] === 'number') allKeys.add(k);
        });
      }
    });
    const keys = [...allKeys].sort();

    const averages: Record<StrictTier, Record<string, number>> = {} as any;
    tiersPresent.forEach(tier => {
      const fams = familiesByTier[tier];
      const sums: Record<string, number> = {};
      const counts: Record<string, number> = {};
      fams.forEach(f => {
        keys.forEach(k => {
          const val = f.attributes_base?.[k];
          if (typeof val === 'number') {
            sums[k] = (sums[k] || 0) + val;
            counts[k] = (counts[k] || 0) + 1;
          }
        });
      });
      averages[tier] = {};
      keys.forEach(k => {
        averages[tier][k] = counts[k] ? Number((sums[k] / counts[k]).toFixed(2)) : 0;
      });
    });

    return { keys, averages };
  }, [activeFamilies, familiesByTier, tiersPresent]);

  // ============================================
  // SECTION 2: Families without technology_refs
  // ============================================
  const familiesWithoutTech = useMemo(() => {
    const result: Record<StrictTier, FamilyExtended[]> = {} as any;
    tiersPresent.forEach(tier => {
      result[tier] = familiesByTier[tier].filter(
        f => !f.technology_refs || f.technology_refs.length === 0
      );
    });
    return result;
  }, [familiesByTier, tiersPresent]);

  const totalWithoutTech = useMemo(
    () => Object.values(familiesWithoutTech).reduce((sum, arr) => sum + arr.length, 0),
    [familiesWithoutTech]
  );

  // ============================================
  // SECTION 3: Most used technologies per tier + high_tier_bias
  // ============================================
  const techUsage = useMemo(() => {
    // Count usage per tech per tier
    const usageMap: Record<string, Record<StrictTier, number>> = {};
    
    tiersPresent.forEach(tier => {
      familiesByTier[tier].forEach(f => {
        (f.technology_refs || []).forEach(techId => {
          if (!usageMap[techId]) usageMap[techId] = {} as any;
          usageMap[techId][tier] = (usageMap[techId][tier] || 0) + 1;
        });
      });
    });

    // Calculate high_tier_bias per tech
    const techStats = Object.entries(usageMap).map(([techId, tiers]) => {
      const total = Object.values(tiers).reduce((s, n) => s + n, 0);
      const highTierCount = (tiers.advanced || 0) + (tiers.top || 0);
      const highTierBias = total > 0 ? highTierCount / total : 0;
      const techName = techLib[techId]?.name_common || techId;
      return { techId, techName, tiers, total, highTierBias };
    });

    // Group by tier (ranked by count desc)
    const perTier: Record<StrictTier, typeof techStats> = {} as any;
    tiersPresent.forEach(tier => {
      perTier[tier] = techStats
        .filter(t => (t.tiers[tier] || 0) > 0)
        .sort((a, b) => (b.tiers[tier] || 0) - (a.tiers[tier] || 0))
        .slice(0, 10);
    });

    return { techStats, perTier };
  }, [familiesByTier, tiersPresent, techLib]);

  // ============================================
  // SECTION 4: Positioning anomalies
  // ============================================
  const anomalies = useMemo(() => {
    const BIAS_THRESHOLD = 0.70;
    const results: Array<{
      family: FamilyExtended;
      tier: StrictTier;
      techId: string;
      techName: string;
      highTierBias: number;
    }> = [];

    (['essential', 'comfort'] as StrictTier[]).forEach(tier => {
      familiesByTier[tier].forEach(fam => {
        (fam.technology_refs || []).forEach(techId => {
          const stat = techUsage.techStats.find(t => t.techId === techId);
          if (stat && stat.highTierBias >= BIAS_THRESHOLD) {
            results.push({
              family: fam,
              tier,
              techId,
              techName: stat.techName,
              highTierBias: stat.highTierBias,
            });
          }
        });
      });
    });

    return results;
  }, [familiesByTier, techUsage]);

  // ============================================
  // SECTION 5: Narrative examples
  // ============================================
  const narrativeExamples = useMemo(() => {
    const examples: Array<{
      label: string;
      family: FamilyExtended;
      tier: StrictTier;
      narrative: ReturnType<typeof generateFamilyNarrative>;
    }> = [];

    // Helper to find a family by clinical type and tier
    const findFamily = (clinicalType: string, tier: TierKey): FamilyExtended | null => {
      return familiesByTier[tier].find(f => {
        const ct = f.clinical_type || f.category;
        return ct === clinicalType;
      }) || null;
    };

    const candidates: Array<{ label: string; clinical: string; tier: TierKey }> = [
      { label: 'Monofocal Essential', clinical: 'MONOFOCAL', tier: 'essential' },
      { label: 'Progressiva Comfort', clinical: 'PROGRESSIVA', tier: 'comfort' },
      { label: 'Progressiva Top', clinical: 'PROGRESSIVA', tier: 'top' },
    ];

    candidates.forEach(({ label, clinical, tier }) => {
      const family = findFamily(clinical, tier);
      if (!family) return;

      // Build a minimal ScoredFamily for the narrative engine
      const scoredFamily: ScoredFamily = {
        family,
        score: {
          final: 75,
          clinical: {
            total: 70,
            components: { prescriptionMatch: 30, complaintsMatch: 20, lifestyleMatch: 20 },
            reasons: [],
            flags: { prescriptionIncompatible: false, categoryMismatch: false },
          },
          commercial: {
            total: 80,
            components: { availability: 15, tierPosition: 20, dataRichness: 15, technologyCount: 15, supplierPriority: 15 },
            reasons: [],
          },
          tierKey: tier,
          rankInTier: 1,
          isEligible: true,
        },
        startingPrice: null,
        compatiblePrices: [],
        technologies: (family.technology_refs || [])
          .map(id => techLib[id])
          .filter(Boolean) as Technology[],
        salesPills: (family as any).sales_pills || [],
        knowledgeConsumer: (family as any).knowledge?.consumer || null,
        knowledgeConsultant: (family as any).knowledge?.consultant || null,
      };

      const narrative = generateFamilyNarrative(scoredFamily, SYNTHETIC_ANAMNESIS, techLib);
      examples.push({ label, family, tier, narrative });
    });

    return examples;
  }, [familiesByTier, techLib]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Auditoria Comercial Estrutural</AlertTitle>
        <AlertDescription>
          Diagnóstico read-only da estrutura comercial do catálogo. Nenhum dado é alterado.
          Resolução de tier: <code className="text-xs bg-muted px-1 rounded">tier_target → macro.tier_key → unknown</code>
        </AlertDescription>
      </Alert>

      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {tiersPresent.map(tier => (
          <Badge key={tier} className={TIER_COLORS[tier]}>
            {TIER_LABELS[tier]}: {familiesByTier[tier].length} famílias
          </Badge>
        ))}
      </div>

      {/* Section 1: Attribute Averages */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Média de attributes_base por Tier
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attributeAverages.keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum atributo numérico encontrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Atributo</TableHead>
                    {tiersPresent.map(t => (
                      <TableHead key={t} className="text-xs text-center">{TIER_LABELS[t]}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attributeAverages.keys.map(attrKey => (
                    <TableRow key={attrKey}>
                      <TableCell className="text-xs font-mono">{attrKey}</TableCell>
                      {tiersPresent.map(tier => (
                        <TableCell key={tier} className="text-xs text-center">
                          {attributeAverages.averages[tier]?.[attrKey]?.toFixed(1) ?? '–'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Families without technology_refs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="w-4 h-4" />
            Famílias sem technology_refs
            {totalWithoutTech > 0 && (
              <Badge variant="destructive" className="text-[10px]">{totalWithoutTech}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalWithoutTech === 0 ? (
            <p className="text-sm text-muted-foreground">Todas as famílias possuem technology_refs. ✓</p>
          ) : (
            <div className="space-y-3">
              {tiersPresent.map(tier => {
                const fams = familiesWithoutTech[tier];
                if (!fams || fams.length === 0) return null;
                return (
                  <div key={tier}>
                    <Badge className={`${TIER_COLORS[tier]} mb-1`}>{TIER_LABELS[tier]} ({fams.length})</Badge>
                    <div className="ml-2 space-y-0.5">
                      {fams.map(f => (
                        <div key={f.id} className="text-xs flex items-center gap-2">
                          <span className="font-medium">{f.name_original}</span>
                          <span className="text-muted-foreground">({f.supplier})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Most used technologies per tier */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            Tecnologias mais usadas por Tier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tiersPresent.map(tier => {
              const techs = techUsage.perTier[tier];
              if (!techs || techs.length === 0) return null;
              return (
                <div key={tier} className="space-y-1">
                  <Badge className={TIER_COLORS[tier]}>{TIER_LABELS[tier]}</Badge>
                  <div className="space-y-0.5 ml-1">
                    {techs.map(t => (
                      <div key={t.techId} className="text-xs flex items-center justify-between gap-2">
                        <span className="truncate">{t.techName}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-muted-foreground">{t.tiers[tier]}×</span>
                          <span className={`text-[10px] font-mono ${t.highTierBias >= 0.7 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                            bias:{(t.highTierBias * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Positioning anomalies */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Anomalias de Posicionamento
            {anomalies.length > 0 && (
              <Badge variant="destructive" className="text-[10px]">{anomalies.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {anomalies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma anomalia detectada (limiar: high_tier_bias ≥ 70% em tier essential/comfort). ✓
            </p>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground mb-2">
                Famílias em tier baixo (essential/comfort) usando tecnologias predominantemente de tiers altos (advanced/top).
              </p>
              {anomalies.map((a, idx) => (
                <div key={`${a.family.id}-${a.techId}-${idx}`} className="flex items-center gap-2 py-1 border-b border-border/50 last:border-0">
                  <Badge className={TIER_COLORS[a.tier]} >{TIER_LABELS[a.tier]}</Badge>
                  <span className="text-xs font-medium truncate">{a.family.name_original}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-xs">{a.techName}</span>
                  <Badge variant="destructive" className="text-[10px] shrink-0">
                    bias: {(a.highTierBias * 100).toFixed(0)}%
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 5: Narrative examples */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Narrativas de Exemplo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {narrativeExamples.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma família encontrada para os perfis solicitados (1 mono essential, 1 prog comfort, 1 prog top).
            </p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {narrativeExamples.map((ex, idx) => (
                <AccordionItem key={idx} value={`narrative-${idx}`}>
                  <AccordionTrigger className="text-sm py-2">
                    <div className="flex items-center gap-2">
                      <Badge className={TIER_COLORS[ex.tier]}>{ex.label}</Badge>
                      <span>{ex.family.name_original}</span>
                      <span className="text-xs text-muted-foreground">({ex.family.supplier})</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {/* Demonstrative warning */}
                    <Alert className="mb-3 border-warning/50 bg-warning/5">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                      <AlertDescription className="text-xs text-warning">
                        Narrativa demonstrativa — gerada com anamnese sintética fixa. Não reflete um atendimento real.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-semibold text-xs text-muted-foreground">Headline:</span>
                        <p className="font-medium">{ex.narrative.headline}</p>
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-muted-foreground">Por que esta lente?</span>
                        <p>{ex.narrative.whyThisLens}</p>
                      </div>
                      {ex.narrative.benefits.length > 0 && (
                        <div>
                          <span className="font-semibold text-xs text-muted-foreground">Benefícios:</span>
                          <ul className="list-disc list-inside text-xs mt-0.5">
                            {ex.narrative.benefits.map((b, i) => <li key={i}>{b}</li>)}
                          </ul>
                        </div>
                      )}
                      {ex.narrative.technologies.length > 0 && (
                        <div>
                          <span className="font-semibold text-xs text-muted-foreground">Tecnologias:</span>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {ex.narrative.technologies.map((t, i) => (
                              <Badge key={i} variant="outline" className="text-[10px]">{t.name} — {t.description}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {ex.narrative.knowledgeConsumer && (
                        <div>
                          <span className="font-semibold text-xs text-muted-foreground">Knowledge (cliente):</span>
                          <p className="text-xs">{ex.narrative.knowledgeConsumer}</p>
                        </div>
                      )}
                      {ex.narrative.knowledgeConsultant && (
                        <div>
                          <span className="font-semibold text-xs text-muted-foreground">Knowledge (consultor):</span>
                          <p className="text-xs">{ex.narrative.knowledgeConsultant}</p>
                        </div>
                      )}
                      {ex.narrative.upsellHint && (
                        <div>
                          <span className="font-semibold text-xs text-muted-foreground">Upsell:</span>
                          <p className="text-xs italic">{ex.narrative.upsellHint}</p>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CommercialAuditTab;
