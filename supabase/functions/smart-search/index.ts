import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, lensData, anamnesisData, lensCategory } = await req.json();
    
    console.log('Smart search request:', { query, lensCategory, anamnesisData });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Build context from lens data with V3.6.x schema fields
    const familiesContext = lensData.families
      .filter((f: any) => f.active && f.category === lensCategory)
      .map((f: any) => ({
        id: f.id,
        name: f.name_original,
        supplier: f.supplier,
        tier: f.macro,
        process: f.process || 'SURFACADA', // PRONTA or SURFACADA
        benefits: f.attributes_display_base,
        attributes: f.attributes_base,
        technology_refs: f.technology_refs || [],
      }));

    const addonsContext = lensData.addons
      .filter((a: any) => a.active && a.rules.categories.includes(lensCategory))
      .map((a: any) => ({
        id: a.id,
        name: a.name_common,
        description: a.description_client,
        impact: a.impact,
      }));

    // PROMPT CANÔNICO DE GOVERNANÇA - Motor de Recomendação Ótica V1.0
    const systemPrompt = `Você é um motor de recomendação ótica.

Você NÃO cria produtos, NÃO altera dados e NÃO infere valor.

REGRAS OBRIGATÓRIAS:

1. Use exclusivamente o catálogo JSON fornecido.
2. Tier, preço, tecnologia e textos vêm apenas do catálogo.
3. Exiba no máximo 1 produto por tier (essential, comfort, advanced, top).
4. Nunca compare produtos do mesmo tier.
5. O preço exibido deve ser o menor SKU compatível com a receita.
6. Se não houver SKU compatível, informe indisponibilidade.
7. Explique valor usando knowledge.consumer (do catálogo).
8. Conduza upsell usando knowledge.consultant (do catálogo).
9. Nunca gere estrelas ou notas genéricas.
10. Nunca invente tecnologia ou descrição.

Se alguma regra não puder ser cumprida, o produto NÃO deve ser exibido.

CONTEXTO DO CLIENTE:
- Uso principal: ${anamnesisData?.primaryUse || 'misto'}
- Horas em telas: ${anamnesisData?.screenHours || 'não informado'}
- Dirige à noite: ${anamnesisData?.nightDriving || 'não informado'}
- Queixas visuais: ${anamnesisData?.visualComplaints?.join(', ') || 'nenhuma'}
- Tempo ao ar livre: ${anamnesisData?.outdoorTime || 'não informado'}
- Preferência estética: ${anamnesisData?.aestheticPriority || 'média'}
- Categoria de lente: ${lensCategory === 'PROGRESSIVA' ? 'Progressiva (multifocal)' : lensCategory === 'OCUPACIONAL' ? 'Ocupacional (perto/intermediário)' : lensCategory === 'BIFOCAL' ? 'Bifocal' : 'Monofocal (visão simples)'}

FAMÍLIAS DISPONÍVEIS NO CATÁLOGO (fonte única de verdade):
${JSON.stringify(familiesContext, null, 2)}

COMPLEMENTOS DISPONÍVEIS:
${JSON.stringify(addonsContext, null, 2)}

INSTRUÇÕES DE RESPOSTA:
1. Analise a pergunta do cliente/vendedor
2. Considere o perfil e necessidades identificadas na anamnese
3. Recomende APENAS lentes que existem no catálogo acima
4. Explique benefícios usando knowledge.consumer da família
5. Sugira complementos apenas se permitidos pelas regras do catálogo
6. Use nomes comerciais das lentes (name_original)
7. Retorne um JSON com a estrutura definida

Responda SEMPRE em português brasileiro.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-5-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'recommend_lenses',
              description: 'Retorna recomendações de lentes baseadas na consulta',
              parameters: {
                type: 'object',
                properties: {
                  recommendations: {
                    type: 'array',
                    description: 'Lista de lentes recomendadas',
                    items: {
                      type: 'object',
                      properties: {
                        familyId: { type: 'string', description: 'ID da família de lentes' },
                        reason: { type: 'string', description: 'Razão da recomendação em português' },
                        priority: { type: 'number', description: 'Prioridade de 1 a 5, sendo 5 a maior' },
                      },
                      required: ['familyId', 'reason', 'priority'],
                    },
                  },
                  suggestedAddons: {
                    type: 'array',
                    description: 'IDs dos complementos sugeridos',
                    items: { type: 'string' },
                  },
                  explanation: {
                    type: 'string',
                    description: 'Explicação geral da recomendação para o vendedor',
                  },
                },
                required: ['recommendations', 'explanation'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'recommend_lenses' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes. Entre em contato com o suporte.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(JSON.stringify({ error: 'Erro ao processar consulta' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    console.log('AI response:', JSON.stringify(data, null, 2));

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback to content if no tool call
    const content = data.choices?.[0]?.message?.content;
    return new Response(JSON.stringify({ 
      explanation: content || 'Não foi possível processar a consulta.',
      recommendations: [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Smart search error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
