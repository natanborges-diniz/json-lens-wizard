/**
 * TierExplainer - Visual component explaining tier selection criteria
 * Makes it clear WHY each tier exists and what differentiates them
 */

import { Shield, ThumbsUp, Zap, Crown, Check, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Tier } from '@/types/lens';

interface TierExplainerProps {
  tier: Tier;
  showFull?: boolean;
  isRecommended?: boolean;
}

// Configuration for each tier
const TIER_CONFIG: Record<Tier, {
  icon: React.ElementType;
  label: string;
  shortDescription: string;
  longDescription: string;
  idealFor: string[];
  features: string[];
  colorClass: string;
  bgClass: string;
  borderClass: string;
}> = {
  essential: {
    icon: Shield,
    label: 'Essencial',
    shortDescription: 'Qualidade básica para o dia a dia',
    longDescription: 'Lentes de entrada com boa correção visual. Indicadas para uso regular sem exigências específicas de tecnologia ou conforto avançado.',
    idealFor: [
      'Usuários de primeira viagem',
      'Prescrições simples e estáveis',
      'Uso ocasional ou backup',
      'Orçamento limitado',
    ],
    features: [
      'Correção visual confiável',
      'Custo acessível',
      'Tratamento básico',
    ],
    colorClass: 'text-slate-600',
    bgClass: 'bg-slate-50',
    borderClass: 'border-slate-200',
  },
  comfort: {
    icon: ThumbsUp,
    label: 'Conforto',
    shortDescription: 'Equilíbrio ideal entre qualidade e preço',
    longDescription: 'Lentes intermediárias com tecnologias de conforto. Melhor adaptação e campos de visão ampliados em relação ao Essencial.',
    idealFor: [
      'Uso diário intensivo',
      'Quem passa tempo em telas',
      'Adaptação mais rápida desejada',
      'Busca qualidade sem topo de linha',
    ],
    features: [
      'Campos de visão ampliados',
      'Adaptação facilitada',
      'Tratamentos intermediários',
      'Bom custo-benefício',
    ],
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
  },
  advanced: {
    icon: Zap,
    label: 'Avançada',
    shortDescription: 'Alta tecnologia para usuários exigentes',
    longDescription: 'Lentes premium com tecnologia de ponta. Máximo conforto, campos de visão expandidos e funcionalidades exclusivas.',
    idealFor: [
      'Usuários exigentes',
      'Prescrições complexas',
      'Múltiplas atividades (trabalho + lazer)',
      'Desconforto com lentes anteriores',
    ],
    features: [
      'Tecnologia de ponta',
      'Personalização avançada',
      'Campos expandidos',
      'Adaptação rápida',
      'Garantia estendida',
    ],
    colorClass: 'text-purple-600',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
  },
  top: {
    icon: Crown,
    label: 'Top',
    shortDescription: 'O melhor disponível no mercado',
    longDescription: 'As lentes mais avançadas existentes. Referência absoluta em tecnologia, conforto e personalização para quem não aceita menos.',
    idealFor: [
      'Quem exige o melhor',
      'Intolerância a adaptação',
      'Prescrições muito complexas',
      'Performance visual crítica',
    ],
    features: [
      'Máxima tecnologia',
      'Personalização total',
      'Menor taxa de inadaptação',
      'Campos de visão máximos',
      'Suporte premium',
    ],
    colorClass: 'text-amber-600',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-200',
  },
};

export const TierExplainer = ({ tier, showFull = false, isRecommended = false }: TierExplainerProps) => {
  const config = TIER_CONFIG[tier];
  const Icon = config.icon;

  if (showFull) {
    return (
      <Card className={`${config.borderClass} ${config.bgClass}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${config.colorClass}`} />
            <span className={`font-bold ${config.colorClass}`}>{config.label}</span>
            {isRecommended && (
              <Badge className="bg-primary text-primary-foreground text-[10px] ml-auto">
                Recomendado
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground">
            {config.longDescription}
          </p>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground">
              Ideal para:
            </h4>
            <ul className="space-y-1">
              {config.idealFor.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                  <ArrowRight className="w-3 h-3 mt-0.5 text-muted-foreground shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compact version with popover
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${config.bgClass} hover:opacity-80`}>
          <Icon className={`w-4 h-4 ${config.colorClass}`} />
          <span className={`text-sm font-semibold ${config.colorClass}`}>{config.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className={`p-3 ${config.bgClass} border-b ${config.borderClass}`}>
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${config.colorClass}`} />
            <span className={`font-bold ${config.colorClass}`}>{config.label}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {config.shortDescription}
          </p>
        </div>
        <div className="p-3 space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Inclui:
          </h4>
          <ul className="space-y-1">
            {config.features.slice(0, 4).map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-xs">
                <Check className="w-3 h-3 mt-0.5 text-success shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Horizontal tier comparison strip
export const TierComparisonStrip = ({ currentTier }: { currentTier: Tier }) => {
  const tiers: Tier[] = ['essential', 'comfort', 'advanced', 'top'];
  const currentIndex = tiers.indexOf(currentTier);

  return (
    <div className="flex items-center gap-1 p-2 bg-muted/30 rounded-lg overflow-x-auto">
      {tiers.map((tier, index) => {
        const config = TIER_CONFIG[tier];
        const Icon = config.icon;
        const isCurrent = tier === currentTier;
        const isPast = index < currentIndex;
        const isFuture = index > currentIndex;

        return (
          <div key={tier} className="flex items-center">
            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
              isCurrent 
                ? `${config.bgClass} ${config.colorClass} font-semibold ring-2 ring-offset-1 ${config.borderClass.replace('border-', 'ring-')}`
                : isPast
                  ? 'bg-muted text-muted-foreground'
                  : 'text-muted-foreground opacity-60'
            }`}>
              <Icon className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">{config.label}</span>
            </div>
            {index < tiers.length - 1 && (
              <ArrowRight className={`w-3 h-3 mx-1 ${
                index < currentIndex ? 'text-muted-foreground' : 'text-muted'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
};
