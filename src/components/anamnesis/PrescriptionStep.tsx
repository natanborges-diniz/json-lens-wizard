import { useEffect } from 'react';
import { Camera, Upload, Edit3, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnamnesisStep } from './AnamnesisStep';
import { deriveClinicalTypeFromRx } from '@/lib/deriveClinicalType';
import type { Prescription, ClinicalType } from '@/types/lens';

interface PrescriptionStepProps {
  data: Partial<Prescription>;
  onUpdate: (data: Partial<Prescription>) => void;
  lensCategory: ClinicalType;
  onClinicalTypeChange?: (type: ClinicalType) => void;
  suggestedClinicalType?: ClinicalType;
}

const clinicalTypeLabels: Record<ClinicalType, string> = {
  MONOFOCAL: 'Monofocal',
  PROGRESSIVA: 'Progressiva',
  OCUPACIONAL: 'Ocupacional',
  BIFOCAL: 'Bifocal',
};

const clinicalTypeDescriptions: Record<ClinicalType, string> = {
  MONOFOCAL: 'Correção para uma distância específica (longe ou perto)',
  PROGRESSIVA: 'Visão contínua para todas as distâncias, sem linha visível',
  OCUPACIONAL: 'Otimizada para ambientes de trabalho (perto e intermediário)',
  BIFOCAL: 'Duas zonas de visão definidas (longe e perto)',
};

export const PrescriptionStep = ({ 
  data, 
  onUpdate, 
  lensCategory, 
  onClinicalTypeChange,
  suggestedClinicalType,
}: PrescriptionStepProps) => {
  // Auto-preselect clinical type from prescription when entering step
  useEffect(() => {
    if (!onClinicalTypeChange) return;
    const derived = deriveClinicalTypeFromRx(data);
    // Only auto-set if the user hasn't manually picked yet
    // (we detect this by checking if current value matches the "neutral" default)
    if (lensCategory === 'PROGRESSIVA' || lensCategory === 'MONOFOCAL') {
      // Always update suggested; only force-set if current doesn't match derived
      if (derived !== lensCategory) {
        onClinicalTypeChange(derived);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnamnesisStep
      title="Dados da Receita"
      subtitle="Você pode fotografar a receita ou inserir os valores manualmente"
      stepNumber={4}
      totalSteps={5}
    >
      <div className="space-y-6">
        {/* Photo upload buttons */}
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="flex-1 min-w-[140px] h-auto py-4">
            <div className="flex flex-col items-center gap-2">
              <Camera className="w-6 h-6" />
              <span className="text-sm">Tirar Foto</span>
            </div>
          </Button>
          <Button variant="outline" className="flex-1 min-w-[140px] h-auto py-4">
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-6 h-6" />
              <span className="text-sm">Enviar Imagem</span>
            </div>
          </Button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground flex items-center gap-1">
              <Edit3 className="w-3 h-3" /> ou preencha manualmente
            </span>
          </div>
        </div>

        {/* Manual input */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Right Eye */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                OD
              </div>
              Olho Direito
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Esférico</Label>
                <Input 
                  type="number"
                  step="0.25"
                  placeholder="0.00"
                  value={data.rightSphere || ''}
                  onChange={(e) => onUpdate({ rightSphere: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Cilíndrico</Label>
                <Input 
                  type="number"
                  step="0.25"
                  placeholder="0.00"
                  value={data.rightCylinder || ''}
                  onChange={(e) => onUpdate({ rightCylinder: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Eixo</Label>
                <Input 
                  type="number"
                  placeholder="0"
                  value={data.rightAxis || ''}
                  onChange={(e) => onUpdate({ rightAxis: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Adição</Label>
              <Input 
                type="number"
                step="0.25"
                placeholder="0.00"
                value={data.rightAddition || ''}
                onChange={(e) => onUpdate({ rightAddition: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Left Eye */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                OE
              </div>
              Olho Esquerdo
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Esférico</Label>
                <Input 
                  type="number"
                  step="0.25"
                  placeholder="0.00"
                  value={data.leftSphere || ''}
                  onChange={(e) => onUpdate({ leftSphere: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Cilíndrico</Label>
                <Input 
                  type="number"
                  step="0.25"
                  placeholder="0.00"
                  value={data.leftCylinder || ''}
                  onChange={(e) => onUpdate({ leftCylinder: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Eixo</Label>
                <Input 
                  type="number"
                  placeholder="0"
                  value={data.leftAxis || ''}
                  onChange={(e) => onUpdate({ leftAxis: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Adição</Label>
              <Input 
                type="number"
                step="0.25"
                placeholder="0.00"
                value={data.leftAddition || ''}
                onChange={(e) => onUpdate({ leftAddition: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>

        {/* Clinical Type Selection */}
        {onClinicalTypeChange && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Tipo de Lente</Label>
            <p className="text-xs text-muted-foreground">
              Sugestão automática: <strong>{clinicalTypeLabels[deriveClinicalTypeFromRx(data)]}</strong> (baseado na receita — você pode alterar)
            </p>
            <Select value={lensCategory} onValueChange={(v) => onClinicalTypeChange(v as ClinicalType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(clinicalTypeLabels) as ClinicalType[]).map(type => (
                  <SelectItem key={type} value={type}>
                    <div className="flex flex-col">
                      <span>{clinicalTypeLabels[type]}</span>
                      <span className="text-xs text-muted-foreground">{clinicalTypeDescriptions[type]}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Lens category indicator */}
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          lensCategory === 'PROGRESSIVA' 
            ? 'bg-primary/10 border border-primary/30' 
            : lensCategory === 'OCUPACIONAL'
              ? 'bg-accent/10 border border-accent/30'
              : lensCategory === 'BIFOCAL'
                ? 'bg-secondary/10 border border-secondary/30'
                : 'bg-muted'
        }`}>
          <Info className={`w-5 h-5 shrink-0 mt-0.5 ${
            lensCategory === 'PROGRESSIVA' ? 'text-primary' : 'text-muted-foreground'
          }`} />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">
              {clinicalTypeLabels[lensCategory]}: {clinicalTypeDescriptions[lensCategory]}
            </p>
          </div>
        </div>
      </div>
    </AnamnesisStep>
  );
};
