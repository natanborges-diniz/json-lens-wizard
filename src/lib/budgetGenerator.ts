/**
 * Consultative Budget Generator - Sprint 4
 * 
 * Gera textos consultivos para orçamentos usando:
 * 1. Knowledge do catálogo (consumer/consultant)
 * 2. Sales pills da família
 * 3. Narrativas do Motor Narrativo (Sprint 3)
 * 4. Conexão anamnese → benefícios
 * 
 * Segue política Zero Criação - textos derivados do catálogo.
 */

import type { 
  FamilyExtended, 
  Technology, 
  AnamnesisData,
  Prescription,
  ClinicalType,
} from '@/types/lens';
import type { EnrichedFamily } from '@/lib/catalogEnricher';
import type { ConsultativeNarrative } from '@/lib/recommendationEngine/narrativeEngine';

// ============================================
// TYPES
// ============================================

export interface BudgetContext {
  /** Nome do cliente */
  customerName: string;
  
  /** Dados da anamnese */
  anamnesis: AnamnesisData;
  
  /** Dados da receita */
  prescription?: Partial<Prescription>;
  
  /** Tipo clínico */
  clinicalType: ClinicalType;
  
  /** Família selecionada */
  family: FamilyExtended;
  
  /** Família enriquecida (com knowledge) */
  enrichedFamily?: EnrichedFamily;
  
  /** Narrativa consultiva (do Motor Narrativo) */
  narrative?: ConsultativeNarrative;
  
  /** Tecnologias resolvidas */
  technologies: Technology[];
  
  /** Preço final */
  finalPrice: number;
  
  /** Índice selecionado */
  selectedIndex: string;
  
  /** Tratamentos selecionados */
  selectedTreatments: string[];
  
  /** Forma de pagamento */
  paymentMethod?: string;
  
  /** Desconto aplicado */
  discount?: number;
  
  /** Info da empresa */
  companyInfo?: {
    name: string;
    slogan?: string;
    phone?: string;
    whatsapp?: string;
  };
}

export interface ConsultativeBudgetText {
  /** Saudação personalizada */
  greeting: string;
  
  /** Seção "Por que esta lente?" */
  whyThisLens: string;
  
  /** Benefícios (bullets) */
  benefits: string[];
  
  /** Tecnologias com descrições */
  technologies: Array<{
    name: string;
    description: string;
    supplierName?: string;
  }>;
  
  /** Resumo de valor */
  valueSummary: string;
  
  /** Fechamento comercial */
  closingStatement: string;
  
  /** Texto completo formatado (Markdown) */
  fullText: string;
  
  /** Texto curto para WhatsApp */
  whatsappText: string;
}

// ============================================
// PHRASE MAPPINGS (from anamnesis)
// ============================================

const USAGE_PHRASES: Record<string, string> = {
  reading: 'focada em leitura e trabalhos de perto',
  computer: 'com uso intensivo de computador e telas',
  work: 'profissional versátil',
  driving: 'com foco em direção e visão de longe',
  outdoor: 'com exposição frequente ao ar livre',
  mixed: 'para atividades variadas do dia a dia',
};

const SCREEN_BENEFITS: Record<string, string> = {
  '0-2': '',
  '3-5': 'proteção para uso moderado de telas',
  '6-8': 'proteção essencial para quem passa muitas horas em telas',
  '8+': 'proteção máxima para uso intensivo de dispositivos digitais',
};

const COMPLAINT_SOLUTIONS: Record<string, string> = {
  eye_fatigue: 'reduzir o cansaço visual',
  headache: 'minimizar dores de cabeça relacionadas à visão',
  near_focus: 'facilitar o foco em distâncias próximas',
  end_day_fatigue: 'manter o conforto visual ao longo do dia',
  light_sensitivity: 'proteger contra o desconforto com luz intensa',
};

const CLINICAL_TYPE_LABELS: Record<ClinicalType, string> = {
  MONOFOCAL: 'lentes monofocais',
  PROGRESSIVA: 'lentes progressivas',
  OCUPACIONAL: 'lentes ocupacionais',
  BIFOCAL: 'lentes bifocais',
};

const TIER_QUALITY: Record<string, string> = {
  essential: 'qualidade confiável',
  comfort: 'excelente equilíbrio entre qualidade e preço',
  advanced: 'alta tecnologia e conforto superior',
  top: 'o que há de melhor no mercado',
};

// ============================================
// GENERATORS
// ============================================

/**
 * Gera texto consultivo completo para o orçamento
 */
export function generateConsultativeBudget(context: BudgetContext): ConsultativeBudgetText {
  const { 
    customerName, 
    anamnesis, 
    clinicalType, 
    family, 
    enrichedFamily,
    narrative,
    technologies,
    finalPrice,
    selectedIndex,
    selectedTreatments,
    paymentMethod,
    companyInfo,
  } = context;

  // 1. Greeting
  const greeting = generateGreeting(customerName, companyInfo?.name);
  
  // 2. Why This Lens (prioriza knowledge do catálogo)
  const whyThisLens = generateWhyThisLens(context);
  
  // 3. Benefits (sales_pills ou attributes_display_base)
  const benefits = generateBenefits(family, enrichedFamily, narrative);
  
  // 4. Technologies with descriptions
  const techList = generateTechnologyList(technologies, family.supplier);
  
  // 5. Value Summary
  const valueSummary = generateValueSummary(
    clinicalType, 
    family, 
    selectedIndex, 
    selectedTreatments,
    finalPrice,
    paymentMethod
  );
  
  // 6. Closing Statement
  const closingStatement = generateClosing(companyInfo);
  
  // 7. Full Text (Markdown)
  const fullText = composeFullText({
    greeting,
    whyThisLens,
    benefits,
    technologies: techList,
    valueSummary,
    closingStatement,
    family,
    clinicalType,
  });
  
  // 8. WhatsApp Text (compact)
  const whatsappText = composeWhatsAppText({
    customerName,
    family,
    clinicalType,
    benefits: benefits.slice(0, 3),
    finalPrice,
    paymentMethod,
    companyInfo,
  });

  return {
    greeting,
    whyThisLens,
    benefits,
    technologies: techList,
    valueSummary,
    closingStatement,
    fullText,
    whatsappText,
  };
}

/**
 * Gera saudação personalizada
 */
function generateGreeting(customerName: string, companyName?: string): string {
  const name = customerName || 'Cliente';
  if (companyName) {
    return `Olá, ${name}! 👓 A equipe ${companyName} preparou este orçamento especialmente para você.`;
  }
  return `Olá, ${name}! 👓 Preparamos este orçamento especialmente para você.`;
}

/**
 * Gera seção "Por que esta lente?"
 * Prioridade: knowledge.consumer > narrative.whyThisLens > gerado
 */
function generateWhyThisLens(context: BudgetContext): string {
  const { enrichedFamily, narrative, anamnesis, clinicalType, family } = context;

  // 1. Prioridade: knowledge.consumer do catálogo
  if (enrichedFamily?.knowledge?.consumer) {
    return enrichedFamily.knowledge.consumer;
  }

  // 2. Fallback: narrative do Motor Narrativo
  if (narrative?.whyThisLens) {
    return narrative.whyThisLens;
  }

  // 3. Gerar baseado na anamnese
  const parts: string[] = [];
  
  // Usage connection
  const usagePhrase = USAGE_PHRASES[anamnesis.primaryUse];
  if (usagePhrase) {
    parts.push(`Considerando sua rotina ${usagePhrase}`);
  }

  // Screen protection
  const screenBenefit = SCREEN_BENEFITS[anamnesis.screenHours];
  if (screenBenefit) {
    parts.push(screenBenefit);
  }

  // Complaints solutions
  const complaints = anamnesis.visualComplaints
    .filter(c => c !== 'none')
    .map(c => COMPLAINT_SOLUTIONS[c])
    .filter(Boolean);
  
  if (complaints.length > 0) {
    parts.push(`ajudando a ${complaints.slice(0, 2).join(' e ')}`);
  }

  // Clinical type
  const typeLabel = CLINICAL_TYPE_LABELS[clinicalType];
  
  if (parts.length === 0) {
    return `Selecionamos as ${typeLabel} ${(family as any).display_name || (family as any).name_display || family.name_original} da ${family.supplier}, que oferecem excelente qualidade para suas necessidades.`;
  }

  return `${parts.join(', ')}, selecionamos as ${typeLabel} ${(family as any).display_name || (family as any).name_display || family.name_original} da ${family.supplier}.`;
}

/**
 * Gera lista de benefícios
 */
function generateBenefits(
  family: FamilyExtended,
  enrichedFamily?: EnrichedFamily,
  narrative?: ConsultativeNarrative
): string[] {
  // 1. Sales pills do catálogo (enriched)
  if (enrichedFamily?.sales_pills && enrichedFamily.sales_pills.length > 0) {
    return enrichedFamily.sales_pills.slice(0, 5);
  }

  // 2. Narrative benefits
  if (narrative?.benefits && narrative.benefits.length > 0) {
    return narrative.benefits.slice(0, 5);
  }

  // 3. attributes_display_base
  if (family.attributes_display_base && family.attributes_display_base.length > 0) {
    return family.attributes_display_base.slice(0, 5);
  }

  // 4. Default based on tier
  const tier = (family as any).tier_target || 'comfort';
  return [
    TIER_QUALITY[tier] || 'Qualidade garantida',
    'Adaptação facilitada',
    'Conforto visual',
  ];
}

/**
 * Gera lista de tecnologias formatada
 */
function generateTechnologyList(
  technologies: Technology[],
  supplier: string
): Array<{ name: string; description: string; supplierName?: string }> {
  return technologies.map(tech => ({
    name: tech.name_common,
    description: tech.description_short || '',
    supplierName: tech.name_commercial?.[supplier] || undefined,
  }));
}

/**
 * Gera resumo de valor
 */
function generateValueSummary(
  clinicalType: ClinicalType,
  family: FamilyExtended,
  selectedIndex: string,
  selectedTreatments: string[],
  finalPrice: number,
  paymentMethod?: string
): string {
  const typeLabel = CLINICAL_TYPE_LABELS[clinicalType];
  const priceFormatted = finalPrice.toLocaleString('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  });

  let summary = `Suas ${typeLabel} **${(family as any).display_name || (family as any).name_display || family.name_original}** (${family.supplier}) com índice ${selectedIndex}`;
  
  if (selectedTreatments.length > 0) {
    summary += ` e ${selectedTreatments.length} tratamento(s)`;
  }

  summary += ` por **${priceFormatted}**`;

  if (paymentMethod) {
    const paymentLabels: Record<string, string> = {
      pix: 'via PIX',
      cash: 'à vista',
      debit: 'no débito',
      credit_1x: 'em 1x no cartão',
      credit_3x: 'em 3x no cartão',
      credit_6x: 'em 6x no cartão',
      credit_10x: 'em 10x no cartão',
      credit_12x: 'em 12x no cartão',
    };
    summary += ` ${paymentLabels[paymentMethod] || ''}`;
  }

  return summary + '.';
}

/**
 * Gera fechamento comercial
 */
function generateClosing(companyInfo?: { name: string; phone?: string; whatsapp?: string }): string {
  if (companyInfo?.whatsapp) {
    return `✨ Estamos à disposição para esclarecer qualquer dúvida! Aguardamos seu retorno. — Equipe ${companyInfo.name}`;
  }
  if (companyInfo?.name) {
    return `✨ Estamos à disposição para esclarecer qualquer dúvida! — Equipe ${companyInfo.name}`;
  }
  return '✨ Estamos à disposição para esclarecer qualquer dúvida!';
}

/**
 * Compõe texto completo em Markdown
 */
function composeFullText(params: {
  greeting: string;
  whyThisLens: string;
  benefits: string[];
  technologies: Array<{ name: string; description: string; supplierName?: string }>;
  valueSummary: string;
  closingStatement: string;
  family: FamilyExtended;
  clinicalType: ClinicalType;
}): string {
  const { greeting, whyThisLens, benefits, technologies, valueSummary, closingStatement, family } = params;

  let text = `${greeting}\n\n`;
  
  // Why this lens section
  text += `## 🎯 Por que esta lente?\n\n${whyThisLens}\n\n`;
  
  // Benefits
  if (benefits.length > 0) {
    text += `## ✨ Destaques\n\n`;
    benefits.forEach(b => {
      text += `- ${b}\n`;
    });
    text += '\n';
  }

  // Technologies
  if (technologies.length > 0) {
    text += `## 🔬 Tecnologias Incluídas\n\n`;
    technologies.forEach(tech => {
      const name = tech.supplierName ? `${tech.name} (${tech.supplierName})` : tech.name;
      text += `- **${name}**`;
      if (tech.description) {
        text += `: ${tech.description}`;
      }
      text += '\n';
    });
    text += '\n';
  }

  // Value summary
  text += `## 💰 Investimento\n\n${valueSummary}\n\n`;
  
  // Closing
  text += `---\n\n${closingStatement}`;

  return text;
}

/**
 * Compõe texto compacto para WhatsApp
 */
function composeWhatsAppText(params: {
  customerName: string;
  family: FamilyExtended;
  clinicalType: ClinicalType;
  benefits: string[];
  finalPrice: number;
  paymentMethod?: string;
  companyInfo?: { name: string; phone?: string };
}): string {
  const { customerName, family, clinicalType, benefits, finalPrice, paymentMethod, companyInfo } = params;
  
  const typeLabel = CLINICAL_TYPE_LABELS[clinicalType];
  const priceFormatted = finalPrice.toLocaleString('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  });

  let text = `👓 *ORÇAMENTO - ${(customerName || 'Cliente').toUpperCase()}*\n\n`;
  text += `Lente: *${(family as any).display_name || (family as any).name_display || family.name_original}* (${family.supplier})\n`;
  text += `Tipo: ${typeLabel}\n\n`;

  if (benefits.length > 0) {
    text += `✨ *Destaques:*\n`;
    benefits.forEach(b => {
      text += `• ${b}\n`;
    });
    text += '\n';
  }

  text += `💰 *Valor: ${priceFormatted}*`;
  
  if (paymentMethod) {
    const paymentLabels: Record<string, string> = {
      pix: ' (PIX)',
      cash: ' (à vista)',
      credit_3x: ' (3x)',
      credit_6x: ' (6x)',
      credit_10x: ' (10x)',
      credit_12x: ' (12x)',
    };
    text += paymentLabels[paymentMethod] || '';
  }

  text += '\n\n';

  if (companyInfo?.name) {
    text += `— ${companyInfo.name}`;
  }

  return text;
}

// ============================================
// EXPORT FOR AI GENERATION
// ============================================

/**
 * Prepara payload para edge function generate-budget-text
 * Inclui knowledge e narrative para contexto rico
 */
export function prepareBudgetAIPayload(context: BudgetContext): Record<string, unknown> {
  const { 
    customerName, 
    anamnesis, 
    prescription, 
    clinicalType, 
    family, 
    enrichedFamily,
    narrative,
    technologies,
    finalPrice,
    selectedIndex,
    selectedTreatments,
    paymentMethod,
    companyInfo,
  } = context;

  return {
    customerName: customerName || 'Cliente',
    anamnesisData: anamnesis,
    prescriptionData: prescription || {},
    lensCategory: clinicalType,
    familyName: (family as any).display_name || (family as any).name_display || family.name_original,
    supplier: family.supplier,
    selectedIndex,
    selectedTreatments,
    basePrice: finalPrice,
    finalTotal: finalPrice,
    paymentMethod,
    companyInfo: companyInfo || { companyName: 'Ótica' },
    // Enhanced context from catalog
    knowledgeConsumer: enrichedFamily?.knowledge?.consumer || null,
    knowledgeConsultant: enrichedFamily?.knowledge?.consultant || null,
    salesPills: enrichedFamily?.sales_pills || [],
    narrativeWhyThisLens: narrative?.whyThisLens || null,
    technologies: technologies.map(t => ({
      name: t.name_common,
      description: t.description_short,
      benefits: t.benefits,
    })),
    tierKey: (family as any).tier_target || null,
  };
}
