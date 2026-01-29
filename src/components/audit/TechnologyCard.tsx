import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Edit2,
  Sun,
  Monitor,
  Sparkles,
  Shield,
  User,
  Smartphone,
  Eye,
  Glasses,
  Waves,
  Maximize,
  Focus
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Technology } from '@/types/lens';

// Icon mapping
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  'Sun': Sun,
  'Monitor': Monitor,
  'Sparkles': Sparkles,
  'Shield': Shield,
  'User': User,
  'Smartphone': Smartphone,
  'Eye': Eye,
  'Glasses': Glasses,
  'Waves': Waves,
  'Maximize': Maximize,
  'Focus': Focus,
};

interface TechnologyCardProps {
  technology: Technology;
  usageCount: number;
  onUpdate?: (techId: string, updates: Partial<Technology>) => void;
}

export const TechnologyCard = ({ 
  technology, 
  usageCount,
  onUpdate 
}: TechnologyCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name_common: technology.name_common,
    description_short: technology.description_short,
    description_long: technology.description_long,
    benefits: technology.benefits.join('\n'),
  });

  const IconComponent = iconMap[technology.icon || 'Shield'] || Shield;

  const handleSave = () => {
    if (onUpdate) {
      onUpdate(technology.id, {
        name_common: editData.name_common,
        description_short: editData.description_short,
        description_long: editData.description_long,
        benefits: editData.benefits.split('\n').filter(b => b.trim()),
      });
    }
    setIsEditing(false);
  };

  const commercialNames = Object.entries(technology.name_commercial || {});

  return (
    <Card className={cn(
      "bg-card border transition-all duration-200",
      isExpanded && "ring-1 ring-primary/20"
    )}>
      <div 
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => !isEditing && setIsExpanded(!isExpanded)}
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <IconComponent className="w-5 h-5 text-primary" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground truncate">
              {technology.name_common}
            </p>
            {usageCount > 0 && (
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {usageCount} famílias
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {technology.description_short}
          </p>
        </div>

        {/* Commercial Names */}
        <div className="flex gap-1 shrink-0">
          {commercialNames.slice(0, 2).map(([supplier, name]) => (
            <Badge 
              key={supplier} 
              variant="outline" 
              className="text-[10px] max-w-[100px] truncate"
              title={`${supplier}: ${name}`}
            >
              {supplier}
            </Badge>
          ))}
          {commercialNames.length > 2 && (
            <Badge variant="outline" className="text-[10px]">
              +{commercialNames.length - 2}
            </Badge>
          )}
        </div>

        {/* Expand Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="p-1 hover:bg-muted rounded transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <CardContent className="pt-0 pb-4 px-4 border-t bg-muted/20">
          <div className="space-y-4 pt-4">
            {isEditing ? (
              // Edit Mode
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Nome Comum
                  </label>
                  <Input
                    value={editData.name_common}
                    onChange={(e) => setEditData(prev => ({ ...prev, name_common: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Descrição Curta
                  </label>
                  <Input
                    value={editData.description_short}
                    onChange={(e) => setEditData(prev => ({ ...prev, description_short: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Descrição Completa
                  </label>
                  <Textarea
                    value={editData.description_long}
                    onChange={(e) => setEditData(prev => ({ ...prev, description_long: e.target.value }))}
                    className="text-sm min-h-[80px]"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Benefícios (um por linha)
                  </label>
                  <Textarea
                    value={editData.benefits}
                    onChange={(e) => setEditData(prev => ({ ...prev, benefits: e.target.value }))}
                    className="text-sm min-h-[60px]"
                    placeholder="Benefício 1&#10;Benefício 2&#10;Benefício 3"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleSave} className="text-xs">
                    Salvar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => {
                      setEditData({
                        name_common: technology.name_common,
                        description_short: technology.description_short,
                        description_long: technology.description_long,
                        benefits: technology.benefits.join('\n'),
                      });
                      setIsEditing(false);
                    }}
                    className="text-xs"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              // View Mode
              <>
                {/* ID */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">ID:</span>
                  <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                    {technology.id}
                  </code>
                </div>

                {/* Description Long */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Descrição completa:</p>
                  <p className="text-sm text-foreground">
                    {technology.description_long}
                  </p>
                </div>

                {/* Benefits */}
                {(technology.benefits ?? []).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Benefícios:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(technology.benefits ?? []).map((benefit, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {benefit}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Commercial Names by Supplier */}
                {commercialNames.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Nomes comerciais:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {commercialNames.map(([supplier, name]) => (
                        <div 
                          key={supplier}
                          className="bg-muted/50 rounded px-2 py-1.5 text-xs"
                        >
                          <span className="font-medium">{supplier}:</span>{' '}
                          <span className="text-muted-foreground">{name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Edit Button */}
                {onUpdate && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setIsEditing(true)}
                    className="text-xs gap-1.5"
                  >
                    <Edit2 className="w-3 h-3" />
                    Editar
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};
