import { Camera, Upload, Edit3, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AnamnesisStep } from './AnamnesisStep';
import type { Prescription, ClinicalType } from '@/types/lens';

interface PrescriptionStepProps {
  data: Partial<Prescription>;
  onUpdate: (data: Partial<Prescription>) => void;
  lensCategory: ClinicalType;
}

export const PrescriptionStep = ({ data, onUpdate, lensCategory }: PrescriptionStepProps) => {
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

        {/* Lens category indicator - friendly language */}
        <div className={`p-4 rounded-lg flex items-start gap-3 ${
          lensCategory === 'PROGRESSIVA' 
            ? 'bg-primary/10 border border-primary/30' 
            : 'bg-muted'
        }`}>
          <Info className={`w-5 h-5 shrink-0 mt-0.5 ${
            lensCategory === 'PROGRESSIVA' ? 'text-primary' : 'text-muted-foreground'
          }`} />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">
              {lensCategory === 'PROGRESSIVA' 
                ? 'Você precisa de lentes para ver de longe e de perto' 
                : 'Você precisa de lentes para uma distância específica'}
            </p>
            <p className="text-muted-foreground">
              {lensCategory === 'PROGRESSIVA' 
                ? 'Vamos recomendar opções que funcionam para todas as distâncias, sem linha visível.'
                : 'Vamos recomendar as melhores opções para sua necessidade.'}
            </p>
          </div>
        </div>
      </div>
    </AnamnesisStep>
  );
};
