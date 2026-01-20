import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Monitor, 
  Sun, 
  Car, 
  Eye, 
  Sparkles, 
  Check,
  ChevronRight,
  User,
  Palette,
  Glasses
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { AnamnesisData, VisualComplaint } from '@/types/lens';

interface CompactAnamnesisProps {
  data: AnamnesisData;
  onUpdate: (data: Partial<AnamnesisData>) => void;
  onComplete: () => void;
  customerName?: string;
  onCustomerNameChange?: (name: string) => void;
}

interface QuestionOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  description?: string;
}

interface Question {
  id: keyof AnamnesisData | 'customerName';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  type: 'single' | 'multi';
  options: QuestionOption[];
  required?: boolean;
}

const questions: Question[] = [
  {
    id: 'primaryUse',
    title: 'Qual o uso principal dos óculos?',
    subtitle: 'Escolha a atividade mais frequente',
    icon: <User className="w-5 h-5" />,
    type: 'single',
    options: [
      { value: 'computer', label: 'Computador', icon: <Monitor className="w-4 h-4" /> },
      { value: 'work', label: 'Trabalho geral', icon: <Glasses className="w-4 h-4" /> },
      { value: 'driving', label: 'Dirigir', icon: <Car className="w-4 h-4" /> },
      { value: 'outdoor', label: 'Ar livre', icon: <Sun className="w-4 h-4" /> },
      { value: 'mixed', label: 'Uso misto', icon: <Sparkles className="w-4 h-4" /> },
    ],
    required: true,
  },
  {
    id: 'screenHours',
    title: 'Quantas horas por dia em telas?',
    subtitle: 'Computador, celular, tablet',
    icon: <Monitor className="w-5 h-5" />,
    type: 'single',
    options: [
      { value: '0-2', label: 'Até 2h' },
      { value: '3-5', label: '3 a 5h' },
      { value: '6-8', label: '6 a 8h' },
      { value: '8+', label: 'Mais de 8h' },
    ],
    required: true,
  },
  {
    id: 'visualComplaints',
    title: 'Tem alguma queixa visual?',
    subtitle: 'Selecione todas que se aplicam',
    icon: <Eye className="w-5 h-5" />,
    type: 'multi',
    options: [
      { value: 'eye_fatigue', label: 'Cansaço visual' },
      { value: 'headache', label: 'Dor de cabeça' },
      { value: 'light_sensitivity', label: 'Sensibilidade à luz' },
      { value: 'end_day_fatigue', label: 'Fadiga ao final do dia' },
      { value: 'none', label: 'Nenhuma' },
    ],
  },
  {
    id: 'nightDriving',
    title: 'Dirige à noite?',
    icon: <Car className="w-5 h-5" />,
    type: 'single',
    options: [
      { value: 'never', label: 'Nunca' },
      { value: 'sometimes', label: 'Às vezes' },
      { value: 'frequent', label: 'Frequentemente' },
    ],
  },
  {
    id: 'outdoorTime',
    title: 'Passa tempo ao ar livre?',
    subtitle: 'Esportes, caminhadas, praia',
    icon: <Sun className="w-5 h-5" />,
    type: 'single',
    options: [
      { value: 'no', label: 'Raramente' },
      { value: 'yes', label: 'Frequentemente' },
    ],
  },
  {
    id: 'aestheticPriority',
    title: 'Prioridade estética?',
    subtitle: 'Lentes mais finas e leves',
    icon: <Palette className="w-5 h-5" />,
    type: 'single',
    options: [
      { value: 'low', label: 'Baixa', description: 'Foco no custo' },
      { value: 'medium', label: 'Média', description: 'Equilíbrio' },
      { value: 'high', label: 'Alta', description: 'Lente premium' },
    ],
  },
];

export const CompactAnamnesis = ({
  data,
  onUpdate,
  onComplete,
  customerName = '',
  onCustomerNameChange,
}: CompactAnamnesisProps) => {
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [completedQuestions, setCompletedQuestions] = useState<Set<number>>(new Set());

  // Calculate which questions are answered
  useEffect(() => {
    const completed = new Set<number>();
    questions.forEach((q, index) => {
      const value = data[q.id as keyof AnamnesisData];
      if (q.type === 'multi') {
        if (Array.isArray(value) && value.length > 0) {
          completed.add(index);
        }
      } else if (value) {
        completed.add(index);
      }
    });
    setCompletedQuestions(completed);
  }, [data]);

  const progress = (completedQuestions.size / questions.length) * 100;
  const canProceed = completedQuestions.size >= 2; // At least 2 questions answered

  const handleOptionClick = (question: Question, optionValue: string) => {
    if (question.type === 'multi') {
      const currentValues = (data[question.id as keyof AnamnesisData] as string[]) || [];
      
      // Handle "none" option - clears others
      if (optionValue === 'none') {
        onUpdate({ [question.id]: [] });
      } else {
        // Remove "none" if selecting something else
        const filtered = currentValues.filter(v => v !== 'none');
        const newValues = filtered.includes(optionValue)
          ? filtered.filter(v => v !== optionValue)
          : [...filtered, optionValue];
        onUpdate({ [question.id]: newValues } as Partial<AnamnesisData>);
      }
    } else {
      onUpdate({ [question.id]: optionValue } as Partial<AnamnesisData>);
      // Auto-advance to next question
      if (activeQuestion < questions.length - 1) {
        setTimeout(() => setActiveQuestion(activeQuestion + 1), 300);
      }
    }
  };

  const isSelected = (question: Question, optionValue: string): boolean => {
    const value = data[question.id as keyof AnamnesisData];
    if (question.type === 'multi') {
      return Array.isArray(value) && (value as string[]).includes(optionValue);
    }
    return value === optionValue;
  };

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Perfil do Cliente</h2>
          <p className="text-sm text-muted-foreground">
            {completedQuestions.size} de {questions.length} respondidas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={progress} className="w-32 h-2" />
          <span className="text-sm font-medium text-muted-foreground">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* Questions grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {questions.map((question, index) => {
          const isActive = activeQuestion === index;
          const isCompleted = completedQuestions.has(index);
          
          return (
            <motion.div
              key={question.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={cn(
                  'cursor-pointer transition-all duration-200 overflow-hidden',
                  isActive && 'ring-2 ring-primary shadow-lg',
                  isCompleted && !isActive && 'bg-success/5 border-success/30',
                  !isActive && !isCompleted && 'hover:border-primary/50'
                )}
                onClick={() => setActiveQuestion(index)}
              >
                {/* Question header */}
                <div className="p-4 border-b bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'p-1.5 rounded-lg',
                        isCompleted ? 'bg-success/20 text-success' : 'bg-primary/10 text-primary'
                      )}>
                        {isCompleted ? <Check className="w-4 h-4" /> : question.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-medium leading-tight">{question.title}</h3>
                        {question.subtitle && (
                          <p className="text-xs text-muted-foreground">{question.subtitle}</p>
                        )}
                      </div>
                    </div>
                    {!isActive && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </div>

                {/* Options - always visible but collapsible */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-3 space-y-2">
                        {question.options.map((option) => {
                          const selected = isSelected(question, option.value);
                          return (
                            <button
                              key={option.value}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOptionClick(question, option.value);
                              }}
                              className={cn(
                                'w-full flex items-center gap-2 p-2.5 rounded-lg text-left text-sm transition-all',
                                selected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted/50 hover:bg-muted'
                              )}
                            >
                              {option.icon && (
                                <span className={cn(selected && 'text-primary-foreground')}>
                                  {option.icon}
                                </span>
                              )}
                              <span className="flex-1">{option.label}</span>
                              {option.description && (
                                <span className={cn(
                                  'text-xs',
                                  selected ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                )}>
                                  {option.description}
                                </span>
                              )}
                              {selected && <Check className="w-4 h-4" />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Compact view when not active - show selected value */}
                {!isActive && isCompleted && (
                  <div className="px-4 py-2 bg-muted/20">
                    <div className="flex flex-wrap gap-1">
                      {question.options
                        .filter(o => isSelected(question, o.value))
                        .map(o => (
                          <Badge key={o.value} variant="secondary" className="text-xs">
                            {o.label}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          {canProceed ? (
            <span className="text-success flex items-center gap-1">
              <Check className="w-4 h-4" />
              Pronto para continuar
            </span>
          ) : (
            <span>Responda ao menos 2 perguntas</span>
          )}
        </div>
        <Button
          onClick={onComplete}
          disabled={!canProceed}
          className="gap-2"
        >
          Ver Recomendações
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};