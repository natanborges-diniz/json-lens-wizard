import { 
  BookOpen, 
  Monitor, 
  Briefcase, 
  Car, 
  Sun, 
  Layers,
  Clock,
  Moon
} from 'lucide-react';
import { AnamnesisStep } from './AnamnesisStep';
import { OptionCard } from './OptionCard';
import type { PrimaryUse, ScreenHours, NightDriving, AnamnesisData } from '@/types/lens';

interface UsageProfileStepProps {
  data: Partial<AnamnesisData>;
  onUpdate: (data: Partial<AnamnesisData>) => void;
}

const primaryUseOptions: { value: PrimaryUse; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'reading', label: 'Leitura', description: 'Livros, revistas, documentos', icon: <BookOpen className="w-5 h-5" /> },
  { value: 'computer', label: 'Computador / celular', description: 'Telas e dispositivos digitais', icon: <Monitor className="w-5 h-5" /> },
  { value: 'work', label: 'Trabalho em geral', description: 'Atividades profissionais diversas', icon: <Briefcase className="w-5 h-5" /> },
  { value: 'driving', label: 'Direção', description: 'Conduzir veículos', icon: <Car className="w-5 h-5" /> },
  { value: 'outdoor', label: 'Uso externo (sol)', description: 'Atividades ao ar livre', icon: <Sun className="w-5 h-5" /> },
  { value: 'mixed', label: 'Uso misto', description: 'Um pouco de tudo', icon: <Layers className="w-5 h-5" /> },
];

const screenHoursOptions: { value: ScreenHours; label: string; description: string }[] = [
  { value: '0-2', label: 'Até 2 horas', description: 'Uso esporádico de telas' },
  { value: '3-5', label: '3 a 5 horas', description: 'Uso moderado' },
  { value: '6-8', label: '6 a 8 horas', description: 'Uso frequente' },
  { value: '8+', label: 'Mais de 8 horas', description: 'Uso intenso o dia todo' },
];

const nightDrivingOptions: { value: NightDriving; label: string; description: string }[] = [
  { value: 'frequent', label: 'Sim, com frequência', description: 'Dirijo regularmente à noite' },
  { value: 'sometimes', label: 'Às vezes', description: 'Ocasionalmente dirijo à noite' },
  { value: 'no', label: 'Não', description: 'Não costumo dirigir à noite' },
];

export const UsageProfileStep = ({ data, onUpdate }: UsageProfileStepProps) => {
  return (
    <AnamnesisStep
      title="Perfil de Uso"
      subtitle="Conte-nos sobre sua rotina para encontrar a melhor solução"
      stepNumber={1}
      totalSteps={5}
    >
      <div className="space-y-8">
        {/* Primary Use */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Qual é o principal uso dos seus óculos?</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {primaryUseOptions.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={data.primaryUse === opt.value}
                onClick={() => onUpdate({ primaryUse: opt.value })}
                icon={opt.icon}
                label={opt.label}
                description={opt.description}
              />
            ))}
          </div>
        </div>

        {/* Screen Hours */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            Quantas horas por dia você usa telas?
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {screenHoursOptions.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={data.screenHours === opt.value}
                onClick={() => onUpdate({ screenHours: opt.value })}
                label={opt.label}
                description={opt.description}
              />
            ))}
          </div>
        </div>

        {/* Night Driving */}
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Moon className="w-5 h-5 text-primary" />
            Você costuma dirigir à noite?
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {nightDrivingOptions.map((opt) => (
              <OptionCard
                key={opt.value}
                selected={data.nightDriving === opt.value}
                onClick={() => onUpdate({ nightDriving: opt.value })}
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
