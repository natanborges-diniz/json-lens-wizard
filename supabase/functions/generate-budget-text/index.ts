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
- Tipo: ${budgetData.lensCategory === 'PROGRESSIVA' ? 'Progressiva' : 'Monofocal'}
- Índice: ${budgetData.selectedIndex}
- Tratamentos: ${budgetData.selectedTreatments.length > 0 ? budgetData.selectedTreatments.join(', ') : 'Básico'}
${budgetData.benefits ? `- Benefícios: ${budgetData.benefits.join(', ')}` : ''}
`;

    const pricingContext = `
Valores:
- Valor das lentes: R$ ${budgetData.basePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
${budgetData.secondPair?.enabled ? `- 2º Par promocional: R$ ${budgetData.secondPair.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
- Forma de pagamento: ${budgetData.paymentMethod}
- Valor final: R$ ${budgetData.finalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
`;

    const systemPrompt = `Você é um consultor óptico experiente e atencioso. Sua tarefa é criar um texto de orçamento personalizado e humanizado para o cliente.

O texto deve:
1. Ser cordial e profissional
2. Mencionar o nome do cliente
3. Explicar POR QUE a lente escolhida é ideal para o perfil do cliente, conectando as necessidades identificadas na anamnese com os benefícios do produto
4. Detalhar os benefícios da lente de forma acessível (evite termos muito técnicos)
5. Apresentar os valores de forma clara
6. Ter um tom consultivo e não apenas comercial
7. Finalizar com uma mensagem positiva sobre a experiência visual que o cliente terá

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
${pricingContext}

Por favor, crie um texto completo de orçamento que conecte as necessidades do cliente com os benefícios da lente escolhida.
`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_completion_tokens: 2000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      
      if (response.status === 429) {
        throw new Error('Limite de requisições atingido. Tente novamente em alguns minutos.');
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