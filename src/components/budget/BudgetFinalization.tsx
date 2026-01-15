import { useState } from 'react';
import { 
  Check, 
  Star,
  CreditCard,
  Percent,
  DollarSign,
  Copy,
  Plus,
  Sparkles,
  MessageCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useCatalogResolver } from '@/hooks/useCatalogResolver';
import type { FamilyExtended, AnamnesisData, AttributeDef } from '@/types/lens';
import { LensCardConfiguration } from '@/components/recommendations/LensCard';

interface BudgetFinalizationProps {
  configuration: LensCardConfiguration;
  family: FamilyExtended;
  customerName: string;
  anamnesisData: AnamnesisData;
  attributeDefs: AttributeDef[];
  onBack: () => void;
}

const paymentMethods = [
  { id: 'pix', label: 'PIX', discount: 5 },
  { id: 'cash', label: 'Dinheiro', discount: 5 },
  { id: 'debit', label: 'Débito', discount: 3 },
  { id: 'credit_1x', label: 'Crédito 1x', discount: 0 },
  { id: 'credit_3x', label: 'Crédito 3x', discount: 0 },
  { id: 'credit_6x', label: 'Crédito 6x', discount: 0 },
  { id: 'credit_10x', label: 'Crédito 10x', discount: 0 },
  { id: 'credit_12x', label: 'Crédito 12x', discount: 0 },
];

export const BudgetFinalization = ({
  configuration,
  family,
  customerName,
  anamnesisData,
  attributeDefs,
  onBack,
}: BudgetFinalizationProps) => {
  const [paymentMethod, setPaymentMethod] = useState('credit_1x');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [secondPairEnabled, setSecondPairEnabled] = useState(false);
  const [secondPairPrice, setSecondPairPrice] = useState(0);
  const [notes, setNotes] = useState('');

  // Use catalog resolver for all display data (no hardcode)
  const { 
    scaleToStars, 
    getTechnologiesForFamily, 
    generateQuoteExplanation 
  } = useCatalogResolver();

  // Get technologies for this family from JSON
  const technologies = getTechnologiesForFamily(family);
  
  // Get personalized explanation based on anamnesis
  const explanations = generateQuoteExplanation(family, anamnesisData);

  const basePrice = configuration.totalPrice;
  
  // Calculate payment method discount
  const paymentDiscount = paymentMethods.find(p => p.id === paymentMethod)?.discount || 0;
  
  // Calculate manual discount
  const manualDiscount = discountType === 'percentage' 
    ? basePrice * (discountValue / 100)
    : discountValue;

  // Calculate totals
  const subtotal = basePrice + (secondPairEnabled ? secondPairPrice : 0);
  const totalDiscount = (basePrice * paymentDiscount / 100) + manualDiscount;
  const finalTotal = Math.max(0, subtotal - totalDiscount);

  // Get relevant attributes
  const getRelevantAttributes = () => {
    const prefix = family.category === 'PROGRESSIVA' ? 'PROG_' : 'MONO_';
    return attributeDefs.filter(a => 
      a.id.startsWith(prefix) || ['AR_QUALIDADE', 'BLUE', 'DURABILIDADE'].includes(a.id)
    );
  };

  const relevantAttributes = getRelevantAttributes();

  const handleCopy = () => {
    const techText = technologies.length > 0 
      ? `Tecnologias: ${technologies.map(t => t.name_common).join(', ')}\n` 
      : '';
    
    const text = `
ORÇAMENTO - ${customerName || 'Cliente'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Lente: ${family.name_original} (${family.supplier})
Índice: ${configuration.selectedIndex}
${configuration.selectedTreatments.length > 0 ? `Tratamentos: ${configuration.selectedTreatments.join(', ')}` : ''}
${techText}
Preço base: R$ ${basePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
${secondPairEnabled ? `2º Par: R$ ${secondPairPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
${totalDiscount > 0 ? `Desconto: -R$ ${totalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL: R$ ${finalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
Pagamento: ${paymentMethods.find(p => p.id === paymentMethod)?.label}
${notes ? `\nObs: ${notes}` : ''}
    `.trim();
    
    navigator.clipboard.writeText(text);
    toast.success('Orçamento copiado!');
  };

  const handleFinalize = () => {
    toast.success('Orçamento finalizado com sucesso!');
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">Finalizar Orçamento</h2>
        <p className="text-muted-foreground">
          {customerName ? `Para ${customerName}` : 'Revise os detalhes do orçamento'}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: Product Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Check className="w-5 h-5 text-success" />
              Lente Selecionada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-bold text-lg">{family.name_original}</h3>
              <Badge variant="outline">{family.supplier}</Badge>
            </div>

            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Índice:</span>
                <span className="font-medium">{configuration.selectedIndex}</span>
              </div>
              {configuration.selectedTreatments.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tratamentos:</span>
                  <span className="font-medium">{configuration.selectedTreatments.length}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Attributes Explanation */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Características da Lente</h4>
              {relevantAttributes.slice(0, 6).map(attr => {
                const rawValue = family.attributes_base?.[attr.id];
                const value = typeof rawValue === 'number' ? rawValue : 0;
                const stars = scaleToStars(value);
                return (
                  <div key={attr.id} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{attr.name_common}</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(i => (
                        <Star 
                          key={i}
                          className={`w-3 h-3 ${i <= stars ? 'text-amber-500 fill-current' : 'text-muted'}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator />

            {/* Technologies - from JSON technology_library */}
            {technologies.length > 0 && (
              <>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Tecnologias Embarcadas
                  </h4>
                  {technologies.map(tech => (
                    <div key={tech.id} className="flex items-start gap-2 text-xs bg-primary/5 rounded-lg p-2">
                      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-foreground">{tech.name_common}</span>
                        <p className="text-muted-foreground">{tech.description_short}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator />
              </>
            )}

            {/* Benefits */}
            <div className="space-y-1.5">
              <h4 className="text-sm font-semibold">Benefícios Inclusos</h4>
              {family.attributes_display_base.map((attr, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <Check className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{attr}</span>
                </div>
              ))}
            </div>

            {/* Dynamic Explanation - from quote_explainer */}
            {explanations.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <MessageCircle className="w-4 h-4 text-primary" />
                    Por que esta lente?
                  </h4>
                  <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                    {explanations.map((paragraph, i) => (
                      <p key={i} className="text-xs text-muted-foreground leading-relaxed">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Right: Pricing & Payment */}
        <div className="space-y-4">
          {/* Payment Method */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Forma de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="grid grid-cols-2 gap-2">
                {paymentMethods.map(method => (
                  <div key={method.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={method.id} id={method.id} />
                    <Label htmlFor={method.id} className="text-sm cursor-pointer">
                      {method.label}
                      {method.discount > 0 && (
                        <Badge variant="secondary" className="ml-1 text-[10px]">
                          -{method.discount}%
                        </Badge>
                      )}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Discount */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Percent className="w-5 h-5" />
                Desconto Adicional
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button
                  variant={discountType === 'percentage' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDiscountType('percentage')}
                >
                  <Percent className="w-4 h-4 mr-1" />
                  %
                </Button>
                <Button
                  variant={discountType === 'fixed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDiscountType('fixed')}
                >
                  <DollarSign className="w-4 h-4 mr-1" />
                  R$
                </Button>
              </div>
              <Input
                type="number"
                value={discountValue || ''}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                placeholder={discountType === 'percentage' ? 'Ex: 10' : 'Ex: 100'}
              />
            </CardContent>
          </Card>

          {/* Second Pair */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  2º Par Promocional
                </span>
                <Switch checked={secondPairEnabled} onCheckedChange={setSecondPairEnabled} />
              </CardTitle>
            </CardHeader>
            {secondPairEnabled && (
              <CardContent>
                <Label htmlFor="secondPairPrice">Valor do 2º par</Label>
                <Input
                  id="secondPairPrice"
                  type="number"
                  value={secondPairPrice || ''}
                  onChange={(e) => setSecondPairPrice(Number(e.target.value))}
                  placeholder="Ex: 500"
                  className="mt-2"
                />
              </CardContent>
            )}
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações para o cliente..."
                rows={2}
              />
            </CardContent>
          </Card>

          {/* Total */}
          <Card className="bg-primary/5 border-primary/30">
            <CardContent className="pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal (par):</span>
                <span>R$ {basePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              {secondPairEnabled && secondPairPrice > 0 && (
                <div className="flex justify-between text-sm">
                  <span>2º Par:</span>
                  <span>R$ {secondPairPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              {totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-success">
                  <span>Desconto:</span>
                  <span>-R$ {totalDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-xl font-bold">
                <span>Total:</span>
                <span className="text-primary">R$ {finalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-end pt-4">
        <Button variant="outline" onClick={handleCopy} className="gap-2">
          <Copy className="w-4 h-4" />
          Copiar
        </Button>
        <Button onClick={handleFinalize} className="gap-2 gradient-primary text-primary-foreground">
          <Check className="w-4 h-4" />
          Finalizar Orçamento
        </Button>
      </div>
    </div>
  );
};