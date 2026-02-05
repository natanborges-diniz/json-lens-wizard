import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BudgetData {
  customerName: string;
  anamnesisData: {
    primaryUse: string;
    screenHours: string;
    nightDriving: string;
    visualComplaints: string[];
    outdoorTime: string;
    clearLensPreference: string;
    aestheticPriority: string;
  };
  prescriptionData: {
    rightSphere?: number;
    rightCylinder?: number;
    leftSphere?: number;
    leftCylinder?: number;
    rightAddition?: number;
    leftAddition?: number;
  };
  lensCategory: string;
  familyName: string;
  supplier: string;
  selectedIndex: string;
  selectedTreatments: string[];
  basePrice: number;
  finalTotal: number;
  paymentMethod: string;
  secondPair?: {
    enabled: boolean;
    price: number;
    description?: string;
  };
  companyInfo: {
    companyName: string;
    slogan?: string;
    phone?: string;
    whatsapp?: string;
  };
  attributes?: Record<string, number>;
  benefits?: string[];
  // NEW: Sprint 4 - Enhanced catalog context
  knowledgeConsumer?: string | null;
  knowledgeConsultant?: string | null;
  salesPills?: string[];
  narrativeWhyThisLens?: string | null;
  technologies?: Array<{
    name: string;
    description?: string;
    benefits?: string[];
  }>;
  tierKey?: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const budgetData: BudgetData = await req.json();
    console.log('Generating budget text for:', budgetData.customerName);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Build context about the customer
    const usageMap: Record<string, string> = {
      'reading': 'leitura',
      'computer': 'uso de computador',
      'work': 'trabalho',
      'driving': 'direção',
      'outdoor': 'atividades ao ar livre',
      'mixed': 'atividades diversas',
    };

    const screenHoursMap: Record<string, string> = {
      '0-2': 'pouco tempo em telas (0-2 horas)',
      '3-5': 'tempo moderado em telas (3-5 horas)',
      '6-8': 'muito tempo em telas (6-8 horas)',
      '8+': 'uso intensivo de telas (mais de 8 horas)',
    };

    const complaintsMap: Record<string, string> = {
      'eye_fatigue': 'cansaço visual',
      'headache': 'dores de cabeça',
      'near_focus': 'dificuldade para focar de perto',
      'end_day_fatigue': 'fadiga ao final do dia',
      'light_sensitivity': 'sensibilidade à luz',
      'none': 'sem queixas específicas',
    };

    const nightDrivingMap: Record<string, string> = {
      'frequent': 'dirige frequentemente à noite',
      'sometimes': 'dirige ocasionalmente à noite',
      'no': 'não costuma dirigir à noite',
    };

    const tierLabels: Record<string, string> = {
      'essential': 'Essencial - boa qualidade para o dia a dia',
      'comfort': 'Conforto - equilíbrio ideal entre qualidade e preço',
      'advanced': 'Avançada - alta tecnologia para usuários exigentes',
      'top': 'Premium - o melhor disponível no mercado',
    };

    const customerContext = `
- Nome: ${budgetData.customerName || 'Cliente'}
- Uso principal: ${usageMap[budgetData.anamnesisData.primaryUse] || budgetData.anamnesisData.primaryUse}
- Tempo em telas: ${screenHoursMap[budgetData.anamnesisData.screenHours] || budgetData.anamnesisData.screenHours}
- Direção noturna: ${nightDrivingMap[budgetData.anamnesisData.nightDriving] || budgetData.anamnesisData.nightDriving}
- Queixas visuais: ${budgetData.anamnesisData.visualComplaints.map(c => complaintsMap[c] || c).join(', ') || 'nenhuma'}
- Tempo ao ar livre: ${budgetData.anamnesisData.outdoorTime === 'yes' ? 'passa tempo ao ar livre' : 'fica mais em ambientes internos'}
- Prioridade estética: ${budgetData.anamnesisData.aestheticPriority === 'high' ? 'alta' : budgetData.anamnesisData.aestheticPriority === 'medium' ? 'média' : 'baixa'}
`;

    const prescriptionContext = budgetData.prescriptionData ? `
Receita:
- OD: ${budgetData.prescriptionData.rightSphere || 0} esf / ${budgetData.prescriptionData.rightCylinder || 0} cil
- OE: ${budgetData.prescriptionData.leftSphere || 0} esf / ${budgetData.prescriptionData.leftCylinder || 0} cil
${budgetData.prescriptionData.rightAddition ? `- Adição: ${budgetData.prescriptionData.rightAddition}` : ''}
` : '';

    const productContext = `
Produto selecionado:
- Lente: ${budgetData.familyName} (${budgetData.supplier})
- Tipo: ${budgetData.lensCategory === 'PROGRESSIVA' ? 'Progressiva' : budgetData.lensCategory === 'OCUPACIONAL' ? 'Ocupacional' : 'Monofocal'}
- Índice: ${budgetData.selectedIndex}
- Tratamentos: ${budgetData.selectedTreatments.length > 0 ? budgetData.selectedTreatments.join(', ') : 'Básico'}
${budgetData.tierKey ? `- Nível: ${tierLabels[budgetData.tierKey] || budgetData.tierKey}` : ''}
`;

    // Sprint 4: Enhanced context from catalog
    let catalogContext = '';
    
    if (budgetData.knowledgeConsumer) {
      catalogContext += `\nConhecimento para o cliente (do catálogo): "${budgetData.knowledgeConsumer}"\n`;
    }
    
    if (budgetData.salesPills && budgetData.salesPills.length > 0) {
      catalogContext += `\nPílulas de venda do catálogo: ${budgetData.salesPills.join('; ')}\n`;
    }
    
    if (budgetData.narrativeWhyThisLens) {
      catalogContext += `\nJustificativa gerada pelo sistema: "${budgetData.narrativeWhyThisLens}"\n`;
    }
    
    if (budgetData.technologies && budgetData.technologies.length > 0) {
      catalogContext += `\nTecnologias incluídas:\n`;
      budgetData.technologies.forEach(tech => {
        catalogContext += `- ${tech.name}: ${tech.description || 'Tecnologia avançada'}\n`;
        if (tech.benefits && tech.benefits.length > 0) {
          catalogContext += `  Benefícios: ${tech.benefits.join(', ')}\n`;
        }
      });
    }

    const pricingContext = `
Valores:
- Valor das lentes: R$ ${budgetData.basePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
${budgetData.secondPair?.enabled ? `- 2º Par promocional: R$ ${budgetData.secondPair.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
- Forma de pagamento: ${budgetData.paymentMethod}
- Valor final: R$ ${budgetData.finalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
`;

    // Enhanced system prompt with catalog knowledge
    const systemPrompt = `Você é um consultor óptico experiente e atencioso. Sua tarefa é criar um texto de orçamento personalizado e humanizado para o cliente.

IMPORTANTE: Use as informações do catálogo fornecidas (knowledge, sales_pills, tecnologias) como base para seus argumentos. NÃO invente benefícios ou tecnologias que não foram mencionadas.

O texto deve:
1. Ser cordial e profissional
2. Mencionar o nome do cliente
3. Usar o "Conhecimento para o cliente" do catálogo (se fornecido) para explicar os benefícios
4. Incorporar as "Pílulas de venda" como destaques
5. Detalhar as tecnologias mencionadas de forma acessível
6. Conectar as necessidades da anamnese com os benefícios reais do produto
7. Apresentar os valores de forma clara
8. Ter um tom consultivo e não apenas comercial
9. Finalizar com uma mensagem positiva

Informações da empresa: ${budgetData.companyInfo.companyName}
${budgetData.companyInfo.slogan ? `Slogan: ${budgetData.companyInfo.slogan}` : ''}

Use formatação markdown com:
- **negrito** para destacar pontos importantes
- Listas quando apropriado
- Emojis sutis para tornar mais amigável (👓, ✨, 🌟)
`;

    const userMessage = `
Crie um orçamento personalizado para este cliente:

${customerContext}
${prescriptionContext}
${productContext}
${catalogContext}
${pricingContext}

Por favor, crie um texto completo de orçamento que conecte as necessidades do cliente com os benefícios da lente escolhida, usando as informações do catálogo como base.
`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Limite de requisições atingido. Tente novamente em alguns minutos.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Créditos insuficientes. Por favor, adicione créditos à sua conta.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Erro ao gerar texto: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content || '';

    console.log('Budget text generated successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      text: generatedText 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error generating budget text:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});