/**
 * CounterModeView — Seller-focused "Modo Balcão" for quick multi-supplier comparison.
 * 
 * Layout: tier groups as horizontal rows, suppliers as columns.
 * Between tiers: upsell upgrade paths showing what the customer gains.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUp, Sparkles, TrendingUp } from 'lucide-react';
import { SUPPORTED_SUPPLIERS } from '@/types/supplier';
import type { ComparisonGroup } from '@/pages/ComparisonHub';
import CounterModeCard from './CounterModeCard';
import { CommercialPositioningScale } from '@/components/visuals';

interface Props {
  comparisonGroups: ComparisonGroup[];
  clinicalType: string;
  isLoading?: boolean;
}

const tierLabels: Record<string, string> = {
  essential: 'Essential',
  comfort: 'Conforto',
  advanced: 'Avançado',
  top: 'Top',
};

const tierOrder = ['essential', 'comfort', 'advanced', 'top'];

const tierGradients: Record<string, string> = {
  essential: 'from-slate-500/10 to-transparent',
  comfort: 'from-blue-500/10 to-transparent',
  advanced: 'from-purple-500/10 to-transparent',
  top: 'from-amber-500/10 to-transparent',
};

/** Compute the gains when upgrading from one tier group to the next */
function computeUpgradeGains(
  fromGroup: ComparisonGroup,
  toGroup: ComparisonGroup
): string[] {
  const gains: string[] = [];

  // Compare average value axes
  const fromAxes = fromGroup.valueAxes || {};
  const toAxes = toGroup.valueAxes || {};

  const axisLabels: Record<string, string> = {
    comfort: 'conforto visual',
    sharpness: 'nitidez',
    field_of_view: 'campo de visão',
    digital_protection: 'proteção digital',
    personalization: 'personalização',
    durability: 'durabilidade',
  };

  for (const [key, label] of Object.entries(axisLabels)) {
    const from = (fromAxes as any)[key] || 0;
    const to = (toAxes as any)[key] || 0;
    if (to > from) {
      gains.push(`+${to - from} em ${label}`);
    }
  }

  // Add description-based gain if available
  if (toGroup.description) {
    gains.push(toGroup.description);
  }

  return gains.slice(0, 4);
}

const UpgradeArrow = ({ gains, fromTier, toTier }: {
  gains: string[];
  fromTier: string;
  toTier: string;
}) => {
  if (gains.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 my-2 mx-auto max-w-2xl">
      <div className="flex-1 h-px bg-border" />
      <div className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg bg-primary/5 border border-primary/20">
        <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
          <ArrowUp className="w-3.5 h-3.5" />
          <span>Subindo de {tierLabels[fromTier]} para {tierLabels[toTier]}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-center">
          {gains.map((gain, i) => (
            <Badge key={i} variant="outline" className="text-[10px] gap-1 text-primary border-primary/30">
              <Sparkles className="w-2.5 h-2.5" />
              {gain}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
};

const CounterModeView = ({ comparisonGroups, clinicalType, isLoading }: Props) => {
  const { data: technologies } = useQuery({
    queryKey: ['counter-technologies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_technologies')
        .select('id, supplier_code, original_name, display_name, tech_group')
        .eq('active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: benefits } = useQuery({
    queryKey: ['counter-benefits'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_benefits')
        .select('id, supplier_code, original_text, benefit_category, short_argument')
        .eq('active', true);
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (comparisonGroups.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Nenhum grupo de comparação para {clinicalType}.
      </div>
    );
  }

  const sortedGroups = [...comparisonGroups].sort(
    (a, b) => tierOrder.indexOf(a.commercialTier) - tierOrder.indexOf(b.commercialTier)
  );

  return (
    <div className="space-y-1">
      {sortedGroups.map((group, idx) => {
        const tier = group.commercialTier;
        const prevGroup = idx > 0 ? sortedGroups[idx - 1] : null;
        const upgradeGains = prevGroup
          ? computeUpgradeGains(prevGroup, group)
          : [];

        return (
          <div key={group.canonicalId}>
            {/* Upgrade arrow between tiers */}
            {prevGroup && (
              <UpgradeArrow
                gains={upgradeGains}
                fromTier={prevGroup.commercialTier}
                toTier={tier}
              />
            )}

            {/* Tier header */}
            <div className={`bg-gradient-to-r ${tierGradients[tier] || ''} rounded-xl p-4 mb-3`}>
              <div className="flex items-center gap-3 mb-3">
                <CommercialPositioningScale activeTier={tier as any} compact showLabels={false} />
                <h2 className="text-lg font-bold flex-1">{group.canonicalName}</h2>
                <Badge variant="secondary" className="text-xs">{tierLabels[tier]}</Badge>
              </div>

              {/* Supplier cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {SUPPORTED_SUPPLIERS.map(supplier => {
                  const supplierData = group.suppliers[supplier.code];
                  if (!supplierData) {
                    return (
                      <div
                        key={supplier.code}
                        className="border border-dashed border-muted rounded-lg p-6 flex items-center justify-center text-xs text-muted-foreground"
                      >
                        {supplier.name} — sem equivalente
                      </div>
                    );
                  }

                  return (
                    <CounterModeCard
                      key={supplier.code}
                      supplierCode={supplier.code}
                      supplierName={supplier.name}
                      supplierColor={supplier.color}
                      data={supplierData}
                      technologies={technologies || []}
                      benefits={benefits || []}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CounterModeView;
