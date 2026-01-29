import { forwardRef } from 'react';
import { 
  Check, 
  Star, 
  Phone, 
  Mail, 
  MapPin,
  Sparkles,
  Shield,
  Clock
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { FamilyExtended, AnamnesisData, AttributeDef, Technology, LensCategory } from '@/types/lens';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface CompanySettings {
  company_name: string;
  logo_url?: string | null;
  slogan?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  address?: string | null;
  cnpj?: string | null;
  budget_terms?: string | null;
  footer_text?: string | null;
}

// Resolved attribute with human-readable label
export interface ResolvedAttribute {
  id: string;
  name: string;
  value: number;
  label: string;  // Human-readable label from benefit_rules
  stars: number;
  group?: string;
}

// Detailed technology with benefits
export interface TechnologyDetailed {
  id: string;
  name: string;
  description: string;
  benefits: string[];
  supplierName?: string;  // Commercial name for this supplier
}

export interface BudgetDocumentData {
  customerName: string;
  customerPhone?: string;
  budgetId?: string;
  createdAt: Date;
  validUntil: Date;
  
  // Product info
  familyName: string;
  supplier: string;
  lensCategory: LensCategory;
  selectedIndex: string;
  selectedTreatments: string[];
  
  // ERP code for seller (internal use only)
  erpCode?: string;
  
  // Pricing
  basePrice: number;
  secondPairEnabled: boolean;
  secondPairPrice: number;
  paymentMethod: string;
  paymentDiscount: number;
  extraDiscount: number;
  totalDiscount: number;
  finalTotal: number;
  
  // Content - legacy (for backward compatibility)
  technologies: Technology[];
  benefits: string[];
  attributes: Array<{ name: string; stars: number }>;
  aiDescription?: string;
  notes?: string;
  
  // Enhanced content - new fields with human-readable data
  resolvedAttributes?: ResolvedAttribute[];
  quoteExplanations?: string[];  // From quote_explainer based on anamnesis
  technologiesDetailed?: TechnologyDetailed[];
}

interface BudgetDocumentProps {
  data: BudgetDocumentData;
  companySettings: CompanySettings;
}

const paymentMethodLabels: Record<string, string> = {
  'pix': 'PIX',
  'cash': 'Dinheiro',
  'debit': 'Cartão de Débito',
  'credit_1x': 'Cartão de Crédito 1x',
  'credit_3x': 'Cartão de Crédito 3x',
  'credit_6x': 'Cartão de Crédito 6x',
  'credit_10x': 'Cartão de Crédito 10x',
  'credit_12x': 'Cartão de Crédito 12x',
};

export const BudgetDocument = forwardRef<HTMLDivElement, BudgetDocumentProps>(
  ({ data, companySettings }, ref) => {
    const formatCurrency = (value: number) => {
      return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
      <div ref={ref} id="budget-document" className="bg-white text-gray-900 p-8 max-w-[210mm] mx-auto font-sans">
        {/* Header */}
        <header className="flex items-start justify-between mb-8 pb-6 border-b-2 border-primary/30">
          <div className="flex items-center gap-4">
            {companySettings.logo_url ? (
              <img 
                src={companySettings.logo_url} 
                alt={companySettings.company_name}
                className="h-16 w-auto object-contain"
              />
            ) : (
              <div className="h-16 w-16 bg-primary/10 rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-primary">
                  {companySettings.company_name.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{companySettings.company_name}</h1>
              {companySettings.slogan && (
                <p className="text-sm text-gray-500 italic">{companySettings.slogan}</p>
              )}
            </div>
          </div>
          <div className="text-right text-sm text-gray-600">
            {companySettings.phone && (
              <p className="flex items-center justify-end gap-1">
                <Phone className="w-3 h-3" /> {companySettings.phone}
              </p>
            )}
            {companySettings.whatsapp && companySettings.whatsapp !== companySettings.phone && (
              <p className="flex items-center justify-end gap-1">
                WhatsApp: {companySettings.whatsapp}
              </p>
            )}
            {companySettings.email && (
              <p className="flex items-center justify-end gap-1">
                <Mail className="w-3 h-3" /> {companySettings.email}
              </p>
            )}
            {companySettings.address && (
              <p className="flex items-center justify-end gap-1 max-w-[200px] text-right">
                <MapPin className="w-3 h-3 shrink-0" /> {companySettings.address}
              </p>
            )}
          </div>
        </header>

        {/* Document Title */}
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-primary uppercase tracking-wide">
            Orçamento de Lentes
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Documento #{data.budgetId?.slice(0, 8) || 'NOVO'}
          </p>
        </div>

        {/* Client & Date Info */}
        <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide">Cliente</span>
            <p className="font-semibold text-lg">{data.customerName || 'Cliente'}</p>
            {data.customerPhone && (
              <p className="text-sm text-gray-600">{data.customerPhone}</p>
            )}
          </div>
          <div className="text-right">
            <div className="mb-2">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Data</span>
              <p className="font-medium">{format(data.createdAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500 uppercase tracking-wide">Validade</span>
              <p className="font-medium text-primary">{format(data.validUntil, "dd/MM/yyyy", { locale: ptBR })}</p>
            </div>
          </div>
        </div>

        {/* Product Section */}
        <section className="mb-6">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-gray-800">
            <Shield className="w-5 h-5 text-primary" />
            Produto Selecionado
          </h3>
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="text-xl font-bold text-gray-900">{data.familyName}</h4>
                <p className="text-sm text-gray-600">{data.supplier}</p>
              </div>
              <Badge className="bg-primary text-white">
                {data.lensCategory === 'PROGRESSIVA' 
                  ? 'Progressiva' 
                  : data.lensCategory === 'OCUPACIONAL'
                    ? 'Ocupacional'
                    : 'Monofocal'}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Índice de Refração:</span>
                <span className="ml-2 font-semibold">{data.selectedIndex}</span>
              </div>
              {data.selectedTreatments.length > 0 && (
                <div>
                  <span className="text-gray-500">Tratamentos:</span>
                  <span className="ml-2 font-semibold">{data.selectedTreatments.join(', ')}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Quote Explanations - NEW: Personalized recommendations based on anamnesis */}
        {data.quoteExplanations && data.quoteExplanations.length > 0 && (
          <section className="mb-6">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-gray-800">
              <Sparkles className="w-5 h-5 text-primary" />
              Por Que Esta Lente Para Você
            </h3>
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
              {data.quoteExplanations.map((paragraph, idx) => (
                <p key={idx} className="text-sm text-gray-700 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        )}

        {/* Technologies Section - Enhanced with detailed benefits */}
        {data.technologiesDetailed && data.technologiesDetailed.length > 0 ? (
          <section className="mb-6">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-gray-800">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Tecnologias Incluídas
            </h3>
            <div className="grid gap-3">
              {data.technologiesDetailed.map((tech) => (
                <div key={tech.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    {tech.supplierName || tech.name}
                  </h5>
                  <p className="text-sm text-gray-600 mt-1">{tech.description}</p>
                  {tech.benefits && tech.benefits.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {tech.benefits.map((benefit, i) => (
                        <li key={i} className="text-xs text-gray-600 flex items-center gap-1">
                          <Check className="w-3 h-3 text-green-600" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : data.technologies.length > 0 && (
          // Fallback to legacy technologies display
          <section className="mb-6">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-gray-800">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Tecnologias Embarcadas
            </h3>
            <div className="grid gap-3">
              {data.technologies.map((tech) => (
                <div key={tech.id} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <h5 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    {tech.name_common}
                  </h5>
                  <p className="text-sm text-gray-600 mt-1">{tech.description_short}</p>
                  {tech.benefits && tech.benefits.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {tech.benefits.slice(0, 3).map((benefit, i) => (
                        <li key={i} className="text-xs text-gray-500 flex items-center gap-1">
                          <Check className="w-3 h-3 text-green-500" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Attributes - Enhanced with human-readable labels */}
        {data.resolvedAttributes && data.resolvedAttributes.length > 0 ? (
          <section className="mb-6">
            <h3 className="text-lg font-bold mb-3 text-gray-800">Diferenciais desta Lente</h3>
            <div className="grid grid-cols-2 gap-2">
              {data.resolvedAttributes
                .filter(attr => attr.value >= 2) // Show only intermediate or better
                .map((attr, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded p-2">
                    <Check className="w-4 h-4 text-green-600 shrink-0" />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-gray-800">{attr.label}</span>
                      <span className="text-xs text-gray-500 block">{attr.name}</span>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ) : data.attributes.length > 0 && (
          // Fallback to legacy star-based display
          <section className="mb-6">
            <h3 className="text-lg font-bold mb-3 text-gray-800">Características Técnicas</h3>
            <div className="grid grid-cols-2 gap-2">
              {data.attributes.map((attr, idx) => (
                <div key={idx} className="flex items-center justify-between bg-gray-50 rounded p-2">
                  <span className="text-sm text-gray-700">{attr.name}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-3.5 h-3.5 ${
                          star <= attr.stars 
                            ? 'text-amber-400 fill-amber-400' 
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Benefits Section */}
        {(data.benefits ?? []).length > 0 && (
          <section className="mb-6">
            <h3 className="text-lg font-bold mb-3 text-gray-800">Benefícios Inclusos</h3>
            <div className="grid grid-cols-2 gap-2">
              {(data.benefits ?? []).map((benefit, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  <span className="text-gray-700">{benefit}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI Description - complementary to quote explanations */}
        {data.aiDescription && !data.quoteExplanations?.length && (
          <section className="mb-6">
            <h3 className="text-lg font-bold mb-3 text-gray-800">Por Que Esta Lente?</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 prose prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: data.aiDescription.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
            </div>
          </section>
        )}

        <Separator className="my-6" />

        {/* Pricing Section */}
        <section className="mb-6">
          <h3 className="text-lg font-bold mb-3 text-gray-800">Resumo de Valores</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Valor das lentes (par)</span>
                <span className="font-medium">R$ {formatCurrency(data.basePrice)}</span>
              </div>
              
              {data.secondPairEnabled && data.secondPairPrice > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">2º Par promocional</span>
                  <span className="font-medium">R$ {formatCurrency(data.secondPairPrice)}</span>
                </div>
              )}
              
              {data.totalDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Desconto aplicado</span>
                  <span className="font-medium">-R$ {formatCurrency(data.totalDiscount)}</span>
                </div>
              )}
              
              <Separator className="my-2" />
              
              <div className="flex justify-between text-xl font-bold">
                <span className="text-gray-900">TOTAL</span>
                <span className="text-primary">R$ {formatCurrency(data.finalTotal)}</span>
              </div>
              
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600">Forma de pagamento</span>
                <span className="font-medium">{paymentMethodLabels[data.paymentMethod] || data.paymentMethod}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Payment Options Info */}
        <section className="mb-6">
          <h4 className="font-semibold text-sm text-gray-700 mb-2">Condições de Pagamento</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-green-50 rounded p-2 text-center">
              <p className="font-bold text-green-700">PIX / Dinheiro</p>
              <p className="text-green-600">5% de desconto</p>
            </div>
            <div className="bg-blue-50 rounded p-2 text-center">
              <p className="font-bold text-blue-700">Débito</p>
              <p className="text-blue-600">3% de desconto</p>
            </div>
            <div className="bg-purple-50 rounded p-2 text-center">
              <p className="font-bold text-purple-700">Crédito</p>
              <p className="text-purple-600">Até 12x sem juros</p>
            </div>
          </div>
        </section>

        {/* Notes */}
        {data.notes && (
          <section className="mb-6">
            <h4 className="font-semibold text-sm text-gray-700 mb-2">Observações</h4>
            <p className="text-sm text-gray-600 bg-yellow-50 rounded p-3 border border-yellow-200">
              {data.notes}
            </p>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-3 h-3" />
            <span>Orçamento válido por 14 dias</span>
          </div>
          {companySettings.budget_terms && (
            <p className="mb-2">{companySettings.budget_terms}</p>
          )}
          {companySettings.footer_text && (
            <p className="italic">{companySettings.footer_text}</p>
          )}
          {companySettings.cnpj && (
            <p className="mt-2">CNPJ: {companySettings.cnpj}</p>
          )}
        </footer>
      </div>
    );
  }
);

BudgetDocument.displayName = 'BudgetDocument';
