import { Info, Ruler } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AnamnesisStep } from './AnamnesisStep';
import type { FrameMeasurements } from '@/types/lens';

interface FrameStepProps {
  data: Partial<FrameMeasurements>;
  onUpdate: (data: Partial<FrameMeasurements>) => void;
}

export const FrameStep = ({ data, onUpdate }: FrameStepProps) => {
  // Calculate minimum diameter based on measurements
  const calculateMinDiameter = () => {
    if (!data.horizontalSize || !data.dp || !data.bridge) return null;
    // Simplified calculation: (horizontal + bridge - DP/2) + margin
    const minDiam = Math.ceil((data.horizontalSize + (data.bridge / 2)) + 4);
    return minDiam;
  };

  const minDiameter = calculateMinDiameter();

  return (
    <AnamnesisStep
      title="Medidas da Armação"
      subtitle="Estas medidas ajudam a encontrar a lente ideal para seu óculos"
      stepNumber={5}
      totalSteps={5}
    >
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Ruler className="w-4 h-4" />
          <span>As medidas estão na haste interna da armação</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Largura da lente (A)</Label>
            <div className="relative">
              <Input 
                type="number" 
                placeholder="54"
                value={data.horizontalSize || ''}
                onChange={(e) => onUpdate({ horizontalSize: parseInt(e.target.value) || 0 })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Ponte (DBL)</Label>
            <div className="relative">
              <Input 
                type="number" 
                placeholder="18"
                value={data.bridge || ''}
                onChange={(e) => onUpdate({ bridge: parseInt(e.target.value) || 0 })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Altura da lente</Label>
            <div className="relative">
              <Input 
                type="number" 
                placeholder="40"
                value={data.verticalSize || ''}
                onChange={(e) => onUpdate({ verticalSize: parseInt(e.target.value) || 0 })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">DP (distância pupilar)</Label>
            <div className="relative">
              <Input 
                type="number" 
                placeholder="64"
                value={data.dp || ''}
                onChange={(e) => onUpdate({ dp: parseInt(e.target.value) || 0 })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
            </div>
            <p className="text-xs text-muted-foreground">Mono ou binocular</p>
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs">Altura de montagem</Label>
            <div className="relative">
              <Input 
                type="number" 
                placeholder="18"
                value={data.altura || ''}
                onChange={(e) => onUpdate({ altura: parseInt(e.target.value) || 0 })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">mm</span>
            </div>
          </div>
        </div>

        {/* Calculated diameter info - friendly */}
        {minDiameter && (
          <div className="p-4 bg-info/10 rounded-lg flex items-start gap-3 border border-info/20">
            <Info className="w-5 h-5 text-info shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground mb-1">Tudo certo com as medidas!</p>
              <p className="text-muted-foreground">
                Vamos mostrar apenas as lentes que funcionam perfeitamente com esta armação.
              </p>
            </div>
          </div>
        )}
      </div>
    </AnamnesisStep>
  );
};
