import { useState } from 'react';
import { 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Star,
  ThumbsUp,
  Crown,
  Shield,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { Family, Price, Addon, Tier } from '@/types/lens';

interface LensCardProps {
  family: Family;
  bestPrice: Price | null;
  tier: Tier;
  isRecommended?: boolean;
  addons: Addon[];
  selectedAddons: string[];
  onToggleAddon: (addonId: string) => void;
  onSelect: () => void;
  alternativeFamilies?: { family: Family; bestPrice: Price | null }[];
  attributeDefs?: { id: string; name_common: string }[];
}

const tierConfig = {
  essential: {
    label: 'Essencial',
    icon: Shield,
    color: 'text-muted-foreground',
    bgHeader: 'bg-muted',
    borderColor: 'border-muted-foreground/20',
    dotColor: 'bg-muted-foreground',
  },
  comfort: {
    label: 'Conforto',
    icon: Star,
    color: 'text-primary',
    bgHeader: 'bg-primary/10',
    borderColor: 'border-primary/30',
    dotColor: 'bg-primary',
  },
  advanced: {
    label: 'Avançada',
    icon: Zap,
    color: 'text-blue-500',
    bgHeader: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    dotColor: 'bg-blue-400',
  },
  top: {
    label: 'Top de Mercado',
    icon: Crown,
    color: 'text-amber-500',
    bgHeader: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    dotColor: 'bg-amber-400',
  },
};

export const LensCard = ({
  family,
  bestPrice,
  tier,
  isRecommended,
  addons,
  selectedAddons,
  onToggleAddon,
  onSelect,
  alternativeFamilies = [],
  attributeDefs = [],
}: LensCardProps) => {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const config = tierConfig[tier];
  const TierIcon = config.icon;

  // Get attribute display value
  const getAttributeValue = (attrId: string): number => {
    const base = family.attributes_base?.[attrId];
    return typeof base === 'number' ? base : 0;
  };

  // Filter relevant attributes based on category
  const getRelevantAttributes = () => {
    const prefix = family.category === 'PROGRESSIVA' ? 'PROG_' : 'MONO_';
    return attributeDefs.filter(a => a.id.startsWith(prefix) || ['AR_QUALIDADE', 'BLUE', 'DURABILIDADE'].includes(a.id));
  };

  const relevantAttributes = getRelevantAttributes();

  // Compatible addons for this family's supplier/category
  const compatibleAddons = addons.filter(addon => 
    addon.active && 
    addon.rules.categories.includes(family.category)
  );

  // Get addon display name for this supplier
  const getAddonDisplayName = (addon: Addon) => {
    return addon.name_commercial?.[family.supplier] || addon.name_common;
  };

  // Calculate total price with selected addons
  const basePrice = bestPrice ? bestPrice.price_sale_half_pair * 2 : 0;
  const addonPrice = 0; // TODO: Calculate addon prices when available
  const totalPrice = basePrice + addonPrice;

  return (
    <Card className={`flex flex-col h-full border-2 transition-all ${
      isRecommended 
        ? 'ring-2 ring-primary ring-offset-2 border-primary' 
        : config.borderColor
    }`}>
      {/* Header */}
      <CardHeader className={`${config.bgHeader} rounded-t-lg p-4 space-y-2`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TierIcon className={`w-5 h-5 ${config.color}`} />
            <span className={`font-bold ${config.color}`}>{config.label}</span>
          </div>
          {isRecommended && (
            <Badge className="bg-primary text-primary-foreground text-xs gap-1">
              <ThumbsUp className="w-3 h-3" />
              Recomendada
            </Badge>
          )}
        </div>
        
        <div>
          <h3 className="font-bold text-foreground text-lg leading-tight">
            {family.name_original}
          </h3>
          <Badge variant="outline" className="mt-1 text-xs">
            {family.supplier}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 space-y-4">
        {/* Price */}
        <div className="text-center py-3 bg-muted/30 rounded-lg">
          {bestPrice ? (
            <>
              <div className="text-3xl font-bold text-foreground">
                R$ {totalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground">par completo</div>
            </>
          ) : (
            <div className="text-sm text-destructive font-medium">
              Indisponível para esta receita
            </div>
          )}
        </div>

        {/* Attributes */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
            Características
          </h4>
          <div className="space-y-1.5">
            {relevantAttributes.slice(0, 5).map(attr => {
              const value = getAttributeValue(attr.id);
              return (
                <div key={attr.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground truncate flex-1">
                    {attr.name_common}
                  </span>
                  <div className="flex gap-0.5">
                    {[0, 1, 2, 3].map(i => (
                      <div 
                        key={i}
                        className={`w-2.5 h-2.5 rounded-full ${
                          i < value 
                            ? config.dotColor
                            : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Benefits */}
        <div className="space-y-1.5">
          {family.attributes_display_base.slice(0, 3).map((attr, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <Check className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{attr}</span>
            </div>
          ))}
          {family.attributes_display_base.length > 3 && (
            <div className="text-xs text-muted-foreground pl-5">
              +{family.attributes_display_base.length - 3} benefícios
            </div>
          )}
        </div>

        {/* Addons */}
        {compatibleAddons.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
              Complementos
            </h4>
            <div className="space-y-2">
              {compatibleAddons.map(addon => (
                <label 
                  key={addon.id}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <Checkbox 
                    checked={selectedAddons.includes(addon.id)}
                    onCheckedChange={() => onToggleAddon(addon.id)}
                    className="data-[state=checked]:bg-primary"
                  />
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    {getAddonDisplayName(addon)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Alternatives toggle */}
        {alternativeFamilies.length > 0 && (
          <div className="border-t pt-3">
            <button
              onClick={() => setShowAlternatives(!showAlternatives)}
              className="flex items-center gap-1 text-xs text-primary hover:underline w-full justify-center"
            >
              {showAlternatives ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  Ocultar alternativas
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  Ver {alternativeFamilies.length} alternativa{alternativeFamilies.length > 1 ? 's' : ''}
                </>
              )}
            </button>
            
            {showAlternatives && (
              <div className="mt-3 space-y-2">
                {alternativeFamilies.map(alt => (
                  <div 
                    key={alt.family.id}
                    className="p-2 bg-muted/30 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-medium">{alt.family.name_original}</div>
                      <div className="text-xs text-muted-foreground">{alt.family.supplier}</div>
                    </div>
                    {alt.bestPrice && (
                      <div className="text-right">
                        <div className="text-sm font-bold">
                          R$ {(alt.bestPrice.price_sale_half_pair * 2).toLocaleString('pt-BR')}
                        </div>
                        <Button size="sm" variant="ghost" className="h-6 text-xs">
                          Selecionar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Select button */}
        <div className="mt-auto pt-3">
          <Button 
            onClick={onSelect}
            disabled={!bestPrice}
            className={`w-full ${isRecommended ? 'gradient-primary' : ''}`}
          >
            {isRecommended ? 'Escolher Recomendada' : 'Selecionar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
