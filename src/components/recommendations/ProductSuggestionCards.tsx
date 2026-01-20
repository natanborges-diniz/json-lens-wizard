import { Monitor, Sun, Sparkles, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProductSuggestion } from '@/lib/productSuggestionEngine';

interface ProductSuggestionCardsProps {
  suggestions: ProductSuggestion[];
  onSelectOccupational: () => void;
  onSelectSolar: () => void;
  hasOccupational: boolean;
  hasSolar: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  Monitor: Monitor,
  Sun: Sun,
};

export const ProductSuggestionCards = ({
  suggestions,
  onSelectOccupational,
  onSelectSolar,
  hasOccupational,
  hasSolar,
}: ProductSuggestionCardsProps) => {
  if (suggestions.length === 0) return null;

  const getStrengthStyles = (strength: ProductSuggestion['strength']) => {
    switch (strength) {
      case 'high':
        return {
          card: 'border-primary bg-primary/5 shadow-sm',
          badge: 'bg-primary text-primary-foreground',
          badgeText: 'Altamente Recomendado',
        };
      case 'medium':
        return {
          card: 'border-accent/50 bg-accent/5',
          badge: 'bg-accent text-accent-foreground',
          badgeText: 'Recomendado',
        };
      default:
        return {
          card: 'border-muted',
          badge: 'bg-muted text-muted-foreground',
          badgeText: 'Sugerido',
        };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Produtos Adicionais Recomendados</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {suggestions.map((suggestion) => {
          const Icon = iconMap[suggestion.icon] || Monitor;
          const styles = getStrengthStyles(suggestion.strength);
          const isAdded = 
            (suggestion.type === 'occupational' && hasOccupational) ||
            (suggestion.type === 'solar' && hasSolar);
          const handleClick = suggestion.type === 'occupational' 
            ? onSelectOccupational 
            : onSelectSolar;

          return (
            <Card 
              key={suggestion.type}
              className={`transition-all ${styles.card} ${isAdded ? 'opacity-60' : 'hover:shadow-md cursor-pointer'}`}
              onClick={isAdded ? undefined : handleClick}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${suggestion.type === 'occupational' ? 'bg-cyan-100 text-cyan-700' : 'bg-amber-100 text-amber-700'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-medium text-sm">
                        {suggestion.type === 'occupational' ? 'Lente de Escritório' : 'Lente Solar'}
                      </h4>
                      <Badge className={`text-[10px] px-1.5 py-0 ${styles.badge}`}>
                        {styles.badgeText}
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {suggestion.reason}
                    </p>

                    {!isAdded && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="mt-2 h-7 px-2 text-xs gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClick();
                        }}
                      >
                        Ver opções
                        <ChevronRight className="w-3 h-3" />
                      </Button>
                    )}

                    {isAdded && (
                      <Badge variant="secondary" className="mt-2 text-[10px]">
                        ✓ Adicionado ao carrinho
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
