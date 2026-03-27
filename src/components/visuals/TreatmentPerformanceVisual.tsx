/**
 * Treatment Performance Visual
 * 
 * Horizontal bar chart showing treatment performance across multiple axes.
 * Used for comparing AR, scratch resistance, blue filter, UV, etc.
 */

import { Shield, Droplets, Sun, Eye, Sparkles, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface TreatmentAxis {
  key: string;
  label: string;
  value: number; // 0-5
  max?: number;
}

interface Props {
  treatmentName: string;
  axes: TreatmentAxis[];
  supplierCode?: string;
  compact?: boolean;
}

const axisIcons: Record<string, React.ElementType> = {
  ar: Sparkles,
  scratch: Shield,
  blue: Eye,
  uv: Sun,
  clean: Droplets,
  photochromic: Zap,
};

const axisColors: Record<string, string> = {
  ar: 'bg-purple-500',
  scratch: 'bg-emerald-500',
  blue: 'bg-blue-500',
  uv: 'bg-amber-500',
  clean: 'bg-cyan-500',
  photochromic: 'bg-orange-500',
};

const TreatmentPerformanceVisual = ({ treatmentName, axes, supplierCode, compact = false }: Props) => {
  return (
    <div className={`rounded-lg border bg-card ${compact ? 'p-2' : 'p-3'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-semibold text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
          {treatmentName}
        </span>
        {supplierCode && (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {supplierCode}
          </span>
        )}
      </div>

      <div className={`space-y-${compact ? '1' : '1.5'}`}>
        <TooltipProvider>
          {axes.map((axis) => {
            const Icon = axisIcons[axis.key] || Shield;
            const barColor = axisColors[axis.key] || 'bg-primary';
            const max = axis.max || 5;
            const pct = Math.min((axis.value / max) * 100, 100);

            return (
              <Tooltip key={axis.key}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Icon className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-muted-foreground shrink-0`} />
                    <div className="flex-1">
                      <div className={`${compact ? 'h-1.5' : 'h-2'} bg-muted rounded-full overflow-hidden`}>
                        <div
                          className={`h-full rounded-full ${barColor} transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} font-mono w-4 text-right text-muted-foreground`}>
                      {axis.value}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                  {axis.label}: {axis.value}/{max}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    </div>
  );
};

export default TreatmentPerformanceVisual;

/** Helper to build axes from DB treatment record */
export function buildTreatmentAxes(treatment: {
  anti_reflective_level?: number | null;
  scratch_resistance_level?: number | null;
  blue_light_filter_percent?: number | null;
  uv_filter_percent?: number | null;
  easy_clean_level?: number | null;
  photochromic_darkening_percent?: number | null;
}): TreatmentAxis[] {
  const axes: TreatmentAxis[] = [];

  if (treatment.anti_reflective_level != null) {
    axes.push({ key: 'ar', label: 'Antirreflexo', value: treatment.anti_reflective_level });
  }
  if (treatment.scratch_resistance_level != null) {
    axes.push({ key: 'scratch', label: 'Resistência a Riscos', value: treatment.scratch_resistance_level });
  }
  if (treatment.blue_light_filter_percent != null) {
    axes.push({ key: 'blue', label: 'Filtro Luz Azul', value: Math.round(treatment.blue_light_filter_percent / 20), max: 5 });
  }
  if (treatment.uv_filter_percent != null) {
    axes.push({ key: 'uv', label: 'Proteção UV', value: Math.round(treatment.uv_filter_percent / 20), max: 5 });
  }
  if (treatment.easy_clean_level != null) {
    axes.push({ key: 'clean', label: 'Facilidade de Limpeza', value: treatment.easy_clean_level });
  }
  if (treatment.photochromic_darkening_percent != null) {
    axes.push({ key: 'photochromic', label: 'Escurecimento', value: Math.round(treatment.photochromic_darkening_percent / 20), max: 5 });
  }

  return axes;
}
