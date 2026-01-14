import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface AnamnesisStepProps {
  title: string;
  subtitle: string;
  stepNumber: number;
  totalSteps: number;
  children: ReactNode;
}

export const AnamnesisStep = ({ title, subtitle, stepNumber, totalSteps, children }: AnamnesisStepProps) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
            {stepNumber}
          </span>
          <span>de {totalSteps}</span>
        </div>
        <h2 className="text-2xl font-bold text-foreground mb-2">{title}</h2>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>
      
      <Card>
        <CardContent className="pt-6">
          {children}
        </CardContent>
      </Card>
    </div>
  );
};
