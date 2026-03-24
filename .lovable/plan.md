
# Plano: Dados Qualitativos + Busca Avulsa de Produtos

## Status: Em Execução

### ✅ Etapa 1 — Gate `no_grade` no skuEligibility
- SKUs com `sphere_min === 0 && sphere_max === 0` rejeitados com `failedGate: 'no_grade'`
- Funnel counter `passedNoGrade` adicionado
- SKUs rejeitados continuam visíveis na busca avulsa

### ✅ Etapa 2 — Classificar Tiers (infraestrutura)
- Modo `classify-tiers` adicionado à edge function `audit-catalog`
- Aceita POST com `{ tier_map: { family_id: tier } }`
- Atualiza `tier_target` e `tier_confidence` no catálogo JSON
- **Pendente**: Chamar a função com o mapa real de tiers das 138 famílias

### ✅ Etapa 3 — Technology Library (infraestrutura)
- Modo `inject-technologies` adicionado à edge function
- Aceita POST com `{ technologies: {...}, tech_refs: { family_id: [tech_ids] } }`
- Faz merge no `technology_library.items` e vincula `technology_refs` nas famílias
- **Pendente**: Chamar a função com os dados reais de tecnologias

### ✅ Etapa 4 — Dicionário ZEISS expandido
- De 5 para 35 regras de matching
- Cobre todas as 43 famílias ZEISS do catálogo

### ✅ Etapa 5 — Busca Avulsa de Produtos
- Nova rota `/products` com acesso para admin, manager e seller
- Filtros: fornecedor, tipo clínico, tier, índice, faixa de preço, grade técnica
- Cards compactos com dot de tier, badge de índice e fornecedor
- Drawer de detalhes com preços, códigos, disponibilidade técnica e tratamentos
- Badge "Sem grade" para SKUs com dados zerados
- Limitado a 100 resultados com mensagem de refinamento

## Próximos Passos (dados)

1. Chamar `classify-tiers` com o mapa real de tiers (requer curadoria humana)
2. Chamar `inject-technologies` com ~30-40 tecnologias reais
3. Refazer sync ERP da ZEISS com o dicionário expandido
