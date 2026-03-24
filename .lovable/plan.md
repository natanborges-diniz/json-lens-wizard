

# Plano: Dados Qualitativos + Busca Avulsa de Produtos

## Contexto

SKUs sem grade de dioptria (~90% com sphere min/max = 0) nao devem ser tratados como "sem restricao". Em vez disso, serao **excluidos do motor de recomendacao** mas permanecerao **disponiveis para consulta manual** via uma nova funcionalidade de busca avulsa.

## Estrategia

### Etapa 1 — Excluir SKUs sem grade do motor de recomendacao

No `skuEligibility.ts`, o gate `no_specs` ja rejeita SKUs sem specs. Precisamos garantir que SKUs com `sphere_min === 0 && sphere_max === 0` tambem sejam rejeitados (tratando zeros como "sem dados reais"):

- **Arquivo**: `src/lib/recommendationEngine/skuEligibility.ts`
- **Mudanca**: No gate `no_specs`, adicionar condicao: se `sphereMin === 0 && sphereMax === 0`, rejeitar com `failedGate: 'no_grade'`
- SKUs rejeitados por `no_grade` continuam visiveis no catalogo e na busca

### Etapa 2 — Classificar Tiers das 138 Familias

Sem mudanca em relacao ao plano anterior — atualizar `tier_target` no `catalog-default.json` baseado no posicionamento real de mercado. Implementar via script na edge function `audit-catalog` (modo `classify-tiers`).

```text
FORNECEDOR   ESSENTIAL         COMFORT           ADVANCED          TOP
─────────────────────────────────────────────────────────────────────────
ESSILOR      Orma, Airwear     Varilux Comfort   Varilux X/E      Varilux XR Pro
HOYA         Hilux, Nulux      Lifestyle 4       Balansis, Dayn.   MySelf, MyStyle
ZEISS        Cosmolite, SPH    SmartLife Pure     SmartLife Sup.    SmartLife Indiv.
```

### Etapa 3 — Popular Technology Library + Vincular Refs

Injetar ~30-40 tecnologias reais (Crizal, Transitions, Sensity, BlueGuard, etc.) no `technology_library` do catalogo JSON e vincular `technology_refs` nas familias. Isso desbloqueia narrativas consultivas e sales pills.

### Etapa 4 — Expandir Dicionario ZEISS

De 5 para ~15 regras de matching (SmartLife, Cosmolite, Individual, etc.).

### Etapa 5 — Busca Avulsa de Produtos (nova funcionalidade)

Nova pagina/componente que permite consultar **todo o catalogo** sem necessidade de receita:

- **Rota**: `/products` ou integrar como aba no CatalogHub (para admin) + botao no SellerFlow (para vendedor)
- **Funcionalidade**:
  - Campo de busca por texto (nome, fornecedor, familia, indice, tratamento)
  - Filtros laterais: fornecedor, tipo clinico, tier, faixa de preco, indice
  - Resultados em cards compactos mostrando: nome comercial, fornecedor, tier, preco, indice, tratamentos, status da grade (com/sem dados tecnicos)
  - Ao clicar: drawer com detalhes completos do SKU (especificacoes, disponibilidade, familia, tecnologias)
  - Badge visual indicando "Sem grade tecnica" para SKUs com dados zerados
  - Botao "Adicionar ao orcamento" quando acessado dentro do fluxo de venda (sem validacao clinica — o vendedor assume a responsabilidade)

- **Diferenca do SmartSearch atual**: O SmartSearch existente funciona dentro do contexto de recomendacao (exige anamnese, lensCategory, filtra por elegibilidade). A busca avulsa e independente — nao exige receita, mostra tudo, e permite selecao manual.

## Arquivos Afetados

**Modificados:**
- `src/lib/recommendationEngine/skuEligibility.ts` — novo gate `no_grade` para zeros
- `supabase/functions/audit-catalog/index.ts` — modos `classify-tiers`, `inject-technologies`
- `src/App.tsx` — nova rota `/products`
- Catalogo JSON no Storage — tiers, technology_library, technology_refs

**Novos:**
- `src/pages/ProductSearch.tsx` — pagina de busca avulsa
- `src/components/search/ProductSearchFilters.tsx` — filtros laterais
- `src/components/search/ProductDetailDrawer.tsx` — detalhes do produto

**Banco:**
- `supplier_profiles` — expandir `family_dictionary` da ZEISS

## Ordem de Execucao

1. Gate `no_grade` no skuEligibility (protege o motor imediatamente)
2. Classificar tiers (desbloqueia escada de valor)
3. Technology library + refs (desbloqueia narrativas)
4. Busca avulsa de produtos (nova funcionalidade)
5. Expandir dicionario ZEISS

## Resultado

- Motor de recomendacao so usa SKUs com dados tecnicos reais
- SKUs sem grade permanecem consultaveis via busca avulsa
- Vendedor pode buscar e selecionar qualquer produto manualmente, assumindo responsabilidade clinica
- Escada de valor funcional com 4 tiers
- Narrativas consultivas ativas
- Cobertura ZEISS expandida

