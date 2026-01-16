import { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Edit2,
  Shield,
  Heart,
  Star,
  Gem,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { MacroExtended, FamilyExtended } from '@/types/lens';

// Icon mapping for tiers
const tierIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'essential': Shield,
  'comfort': Heart,
  'advanced': Star,
  'top': Gem,
};

const tierColors: Record<string, { border: string; bg: string; text: string }> = {
  'essential': { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-600' },
  'comfort': { border: 'border-green-200', bg: 'bg-green-50', text: 'text-green-600' },
  'advanced': { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-600' },
  'top': { border: 'border-violet-200', bg: 'bg-violet-50', text: 'text-violet-600' },
};

const tierLabels: Record<string, string> = {
  'essential': 'Essencial',
  'comfort': 'Conforto',
  'advanced': 'Avançado',
  'top': 'Premium',
};

interface MacroCardProps {
  macro: MacroExtended;
  families: FamilyExtended[];
  onUpdate?: (macroId: string, updates: Partial<MacroExtended>, affectedFamilies: FamilyExtended[]) => void;
}

export const MacroCard = ({ 
  macro, 
  families,
  onUpdate 
}: MacroCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Partial<MacroExtended> | null>(null);
  
  const [editData, setEditData] = useState({
    name_client: macro.name_client,
    description_client: macro.description_client,
    tier_key: macro.tier_key || 'essential',
  });

  const tierKey = macro.tier_key || 'essential';
  const IconComponent = tierIcons[tierKey] || Shield;
  const colors = tierColors[tierKey] || tierColors['essential'];

  // Get families using this macro
  const macroFamilies = families.filter(f => f.macro === macro.id);
  const activeFamilies = macroFamilies.filter(f => f.active);

  const handleSaveClick = () => {
    const updates: Partial<MacroExtended> = {};
    
    if (editData.name_client !== macro.name_client) {
      updates.name_client = editData.name_client;
    }
    if (editData.description_client !== macro.description_client) {
      updates.description_client = editData.description_client;
    }
    if (editData.tier_key !== macro.tier_key) {
      updates.tier_key = editData.tier_key;
    }

    if (Object.keys(updates).length === 0) {
      setIsEditing(false);
      return;
    }

    setPendingUpdates(updates);
    setShowConfirmDialog(true);
  };

  const handleConfirmSave = () => {
    if (onUpdate && pendingUpdates) {
      onUpdate(macro.id, pendingUpdates, macroFamilies);
    }
    setShowConfirmDialog(false);
    setPendingUpdates(null);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditData({
      name_client: macro.name_client,
      description_client: macro.description_client,
      tier_key: macro.tier_key || 'essential',
    });
    setIsEditing(false);
  };

  return (
    <>
      <Card className={cn(
        "border-2 transition-all duration-200",
        colors.border,
        isExpanded && "ring-1 ring-primary/20"
      )}>
        <div 
          className="flex items-center gap-3 p-4 cursor-pointer"
          onClick={() => !isEditing && setIsExpanded(!isExpanded)}
        >
          {/* Icon */}
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            colors.bg
          )}>
            <IconComponent className={cn("w-5 h-5", colors.text)} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground truncate">
                {macro.name_client}
              </p>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {macro.category}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {macro.description_client}
            </p>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-[10px]">
              {activeFamilies.length}/{macroFamilies.length} famílias
            </Badge>
            <Badge className={cn("text-[10px]", colors.bg, colors.text, "border-0")}>
              {tierLabels[tierKey]}
            </Badge>
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
                      Nome para Cliente
                    </label>
                    <Input
                      value={editData.name_client}
                      onChange={(e) => setEditData(prev => ({ ...prev, name_client: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Descrição para Cliente
                    </label>
                    <Textarea
                      value={editData.description_client}
                      onChange={(e) => setEditData(prev => ({ ...prev, description_client: e.target.value }))}
                      className="text-sm min-h-[60px]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                      Tier
                    </label>
                    <Select 
                      value={editData.tier_key} 
                      onValueChange={(v: 'essential' | 'comfort' | 'advanced' | 'top') => setEditData(prev => ({ ...prev, tier_key: v }))}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="essential">Essencial</SelectItem>
                        <SelectItem value="comfort">Conforto</SelectItem>
                        <SelectItem value="advanced">Avançado</SelectItem>
                        <SelectItem value="top">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={handleSaveClick} className="text-xs">
                      Salvar
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={handleCancelEdit}
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
                      {macro.id}
                    </code>
                  </div>

                  {/* Families using this macro */}
                  {macroFamilies.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Famílias usando este macro ({macroFamilies.length}):
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {macroFamilies.map((family) => (
                          <Badge 
                            key={family.id} 
                            variant={family.active ? "secondary" : "outline"}
                            className={cn("text-xs", !family.active && "opacity-50")}
                          >
                            {family.name_original}
                          </Badge>
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

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Confirmar Alterações
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Você está prestes a alterar o macro <strong>{macro.name_client}</strong>.
                </p>
                
                {pendingUpdates && (
                  <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                    <p className="font-medium text-foreground">Mudanças:</p>
                    {pendingUpdates.name_client && (
                      <p>• Nome: <span className="text-muted-foreground">{macro.name_client}</span> → <span className="text-primary">{pendingUpdates.name_client}</span></p>
                    )}
                    {pendingUpdates.description_client && (
                      <p>• Descrição atualizada</p>
                    )}
                    {pendingUpdates.tier_key && (
                      <p>• Tier: <span className="text-muted-foreground">{tierLabels[macro.tier_key || 'essential']}</span> → <span className="text-primary">{tierLabels[pendingUpdates.tier_key]}</span></p>
                    )}
                  </div>
                )}

                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                  <p className="text-sm font-medium text-warning">
                    Esta alteração afetará {macroFamilies.length} família(s):
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2 max-h-20 overflow-y-auto">
                    {macroFamilies.slice(0, 10).map(f => (
                      <Badge key={f.id} variant="outline" className="text-xs">
                        {f.name_original}
                      </Badge>
                    ))}
                    {macroFamilies.length > 10 && (
                      <Badge variant="outline" className="text-xs">
                        +{macroFamilies.length - 10} mais
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingUpdates(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave}>
              Confirmar Alterações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
