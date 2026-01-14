import { 
  Eye, 
  Frown,
  Focus,
  Sunset,
  Lightbulb,
  ThumbsUp
} from 'lucide-react';
import { AnamnesisStep } from './AnamnesisStep';
import { OptionCard } from './OptionCard';
import type { VisualComplaint, AnamnesisData } from '@/types/lens';

interface VisualComplaintsStepProps {
  data: Partial<AnamnesisData>;
  onUpdate: (data: Partial<AnamnesisData>) => void;
}

const complaintOptions: { value: VisualComplaint; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'eye_fatigue', label: 'Cansaço visual', description: 'Olhos cansados ao longo do dia', icon: <Eye className="w-5 h-5" /> },
  { value: 'headache', label: 'Dor de cabeça', description: 'Dores de cabeça frequentes', icon: <Frown className="w-5 h-5" /> },
  { value: 'near_focus', label: 'Dificuldade para focar perto', description: 'Problemas para ver de perto', icon: <Focus className="w-5 h-5" /> },
  { value: 'end_day_fatigue', label: 'Visão cansada no fim do dia', description: 'Piora da visão ao anoitecer', icon: <Sunset className="w-5 h-5" /> },
  { value: 'light_sensitivity', label: 'Incômodo com reflexos ou luz', description: 'Sensibilidade à luz forte', icon: <Lightbulb className="w-5 h-5" /> },
  { value: 'none', label: 'Nenhum desconforto', description: 'Não sinto problemas visuais', icon: <ThumbsUp className="w-5 h-5" /> },
];

export const VisualComplaintsStep = ({ data, onUpdate }: VisualComplaintsStepProps) => {
  const complaints = data.visualComplaints || [];
  
  const toggleComplaint = (complaint: VisualComplaint) => {
    // If selecting "none", clear all others
    if (complaint === 'none') {
      onUpdate({ visualComplaints: ['none'] });
      return;
    }
    
    // If selecting something else, remove "none" if present
    let newComplaints = complaints.filter(c => c !== 'none');
    
    if (newComplaints.includes(complaint)) {
      newComplaints = newComplaints.filter(c => c !== complaint);
    } else {
      newComplaints = [...newComplaints, complaint];
    }
    
    onUpdate({ visualComplaints: newComplaints.length > 0 ? newComplaints : [] });
  };

  return (
    <AnamnesisStep
      title="Queixas Visuais"
      subtitle="Selecione todos os desconfortos que você sente (pode marcar mais de um)"
      stepNumber={2}
      totalSteps={5}
    >
      <div className="space-y-4">
        <h3 className="font-semibold text-foreground">Você sente algum destes desconfortos?</h3>
        <p className="text-sm text-muted-foreground">Você pode selecionar múltiplas opções</p>
        
        <div className="grid gap-3 sm:grid-cols-2">
          {complaintOptions.map((opt) => (
            <OptionCard
              key={opt.value}
              selected={complaints.includes(opt.value)}
              onClick={() => toggleComplaint(opt.value)}
              icon={opt.icon}
              label={opt.label}
              description={opt.description}
              multiSelect
            />
          ))}
        </div>
        
        {complaints.length > 0 && complaints[0] !== 'none' && (
          <div className="mt-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Selecionados: </span>
              {complaints.map(c => complaintOptions.find(o => o.value === c)?.label).join(', ')}
            </p>
          </div>
        )}
      </div>
    </AnamnesisStep>
  );
};
