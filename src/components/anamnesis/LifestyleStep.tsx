import { 
  Sun, 
  Home,
  Sparkles,
  Glasses
} from 'lucide-react';
import { AnamnesisStep } from './AnamnesisStep';
import { OptionCard } from './OptionCard';
import type { OutdoorPreference, ClearLensPreference, AestheticPriority, AnamnesisData } from '@/types/lens';

interface LifestyleStepProps {
  data: Partial<AnamnesisData>;
  onUpdate: (data: Partial<AnamnesisData>) => void;
}

const outdoorOptions: { value: OutdoorPreference; label: string; icon: React.ReactNode }[] = [
  { value: 'yes', label: 'Sim', icon: <Sun className="w-5 h-5" /> },
  { value: 'no', label: 'Não', icon: <Home className="w-5 h-5" /> },
];

const clearLensOptions: { value: ClearLensPreference; label: string }[] = [
  { value: 'yes', label: 'Sim, prefiro lentes bem claras' },
  { value: 'no', label: 'Não, posso usar lentes com cor' },
  { value: 'indifferent', label: 'Tanto faz' },
];

const aestheticOptions: { value: AestheticPriority; label: string; description: string }[] = [
  { value: 'high', label: 'Muito importante', description: 'Quero as lentes mais finas possíveis' },
  { value: 'medium', label: 'Um pouco', description: 'Prefiro lentes finas, mas sem exagero' },
  { value: 'low', label: 'Não é prioridade', description: 'A funcionalidade importa mais' },
];

export const LifestyleStep = ({ data, onUpdate }: LifestyleStepProps) => {
  return (
    <AnamnesisStep
      title="Estilo de Vida"
      subtitle="Suas preferências nos ajudam a personalizar ainda mais"
      stepNumber={3}
      totalSteps={5}
    >
      <div className="space-y-8">
        {/* Outdoor Time */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Você passa muito tempo em ambientes externos?</h3>
          <div className="grid gap-3 grid-cols-2">
            {outdoorOptions.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={data.outdoorTime === opt.value}
                onClick={() => onUpdate({ outdoorTime: opt.value })}
                icon={opt.icon}
                label={opt.label}
              />
            ))}
          </div>
        </div>

        {/* Clear Lens Preference */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Glasses className="w-5 h-5 text-primary" />
            Prefere óculos mais claros em ambientes internos?
          </h3>
          <div className="grid gap-3">
            {clearLensOptions.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={data.clearLensPreference === opt.value}
                onClick={() => onUpdate({ clearLensPreference: opt.value })}
                label={opt.label}
              />
            ))}
          </div>
        </div>

        {/* Aesthetic Priority */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Para você, estética e lente mais fina são importantes?
          </h3>
          <div className="grid gap-3">
            {aestheticOptions.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={data.aestheticPriority === opt.value}
                onClick={() => onUpdate({ aestheticPriority: opt.value })}
                label={opt.label}
                description={opt.description}
              />
            ))}
          </div>
        </div>
      </div>
    </AnamnesisStep>
  );
};
