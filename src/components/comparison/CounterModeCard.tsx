/**
 * CounterModeCard — Quick-read card for seller counter use.
 * Shows: supplier brand, family name, short argument, top benefits, value axes summary.
 * Designed for fast scanning during customer conversations.
 */

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Zap, Target, MessageSquare, Sparkles } from 'lucide-react';
import type { ValueAxes } from '@/types/supplier';
import { ConfidenceBadge } from '@/components/audit/ConfidenceBadge';

interface SupplierEntry {
  familyId: string;
  originalName: string;
  displayName: string | null;
  keyDifferentiator: string | null;
  targetAudience: string | null;
  valueAxes: Partial<ValueAxes>;
  confidence: string;
  reviewStatus: string;
  technologyIds: string[];
  benefitIds: string[];
}

interface CounterModeCardProps {
  supplierCode: string;
  supplierName: string;
  supplierColor: string;
  data: SupplierEntry;
  technologies: Array<{ id: string; display_name: string | null; original_name: string; tech_group: string | null }>;
  benefits: Array<{ id: string; short_argument: string | null; original_text: string; benefit_category: string }>;
  isHighlighted?: boolean;
}

const TOP_AXES: (keyof ValueAxes)[] = ['comfort', 'sharpness', 'field_of_view'];
const AXES_EMOJI: Record<string, string> = {
  comfort: '😌',
  sharpness: '🔍',
  field_of_view: '👁️',
  digital_protection: '🖥️',
  personalization: '🎯',
  durability: '🛡️',
};
const AXES_SHORT: Record<string, string> = {
  comfort: 'Conforto',
  sharpness: 'Nitidez',
  field_of_view: 'Campo',
  digital_protection: 'Digital',
  personalization: 'Personal.',
  durability: 'Durab.',
};

const MiniBar = ({ value, max = 5 }: { value: number; max?: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: max }, (_, i) => (
      <div
        key={i}
        className={`w-2 h-2 rounded-sm ${
          i < value ? 'bg-primary' : 'bg-muted'
        }`}
      />
    ))}
  </div>
);

const CounterModeCard = ({
  supplierCode,
  supplierName,
  supplierColor,
  data,
  technologies,
  benefits,
  isHighlighted,
}: CounterModeCardProps) => {
  const familyTechs = data.technologyIds
    .map(id => technologies.find(t => t.id === id))
    .filter(Boolean)
    .slice(0, 3);

  const familyBenefits = data.benefitIds
    .map(id => benefits.find(b => b.id === id))
    .filter(Boolean)
    .slice(0, 3);

  const topAxes = TOP_AXES.map(key => ({
    key,
    value: (data.valueAxes as any)?.[key] || 0,
    label: AXES_SHORT[key],
    emoji: AXES_EMOJI[key],
  })).filter(a => a.value > 0);

  return (
    <Card className={`relative overflow-hidden transition-all duration-200 hover:shadow-md ${
      isHighlighted ? 'ring-2 ring-primary ring-offset-2' : ''
    }`}>
      {/* Supplier color bar */}
      <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: supplierColor }} />

      <CardContent className="pt-4 pb-3 px-4 space-y-2.5">
        {/* Header: supplier + name */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: supplierColor }}>
              {supplierName}
            </span>
            <ConfidenceBadge
              confidence={data.confidence as any}
              reviewStatus={data.reviewStatus as any}
              compact
            />
          </div>
          <h3 className="font-bold text-sm leading-tight mt-0.5">
            {data.displayName || data.originalName}
          </h3>
        </div>

        {/* Short selling argument — the key differentiator */}
        {data.keyDifferentiator && (
          <div className="flex items-start gap-1.5 bg-primary/5 rounded-md px-2.5 py-2">
            <MessageSquare className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-foreground leading-relaxed">
              {data.keyDifferentiator}
            </p>
          </div>
        )}

        {/* Quick value axes — dots */}
        {topAxes.length > 0 && (
          <div className="flex gap-3">
            {topAxes.map(axis => (
              <TooltipProvider key={axis.key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xs">{axis.emoji}</span>
                      <MiniBar value={axis.value} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{axis.label}: {axis.value}/5</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        )}

        <Separator />

        {/* Benefits — short arguments (selling pills) */}
        {familyBenefits.length > 0 && (
          <div className="space-y-1">
            {familyBenefits.map((ben: any) => (
              <div key={ben.id} className="flex items-start gap-1.5 text-xs">
                <Zap className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                <span className="text-muted-foreground">
                  {ben.short_argument || ben.original_text}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Technologies — compact chips */}
        {familyTechs.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {familyTechs.map((tech: any) => (
              <Badge key={tech.id} variant="secondary" className="text-[9px] px-1.5 py-0">
                <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                {tech.display_name || tech.original_name}
              </Badge>
            ))}
          </div>
        )}

        {/* Target audience */}
        {data.targetAudience && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Target className="w-3 h-3" />
            {data.targetAudience}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CounterModeCard;
