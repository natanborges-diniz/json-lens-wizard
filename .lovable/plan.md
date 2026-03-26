

# Plano: Execucao do Bloco Original — Populacao Completa + Comparativo

O usuario confirma que o plano ja estava definido no prompt inicial. Mantemos exatamente os blocos originais.

## Estado Atual
- Bloco 1 (Fundamento de Dados): FEITO — tabelas criadas, schema definido
- Bloco 2 (Comparativo Funcional): PARCIAL — UI criada, mas com apenas 21 familias seed

## Proximo Passo Imediato: Completar Bloco 2

### 1. Popular banco com TODOS os dados dos JSONs
- Ler os 3 arquivos estruturados (`data/suppliers/essilor-ago-2025-structured.json`, `hoya-abr-2025-structured.json`, `zeiss-abr-2025-structured.json`)
- Inserir via migracao SQL todas as ~58 familias, ~24 materiais, ~19 tratamentos, ~33 tecnologias, ~16 beneficios
- Mapear categorias clinicas e tiers conforme mapeamento ja definido
- Marcar tudo como `confidence: 'extracted'`, `review_status: 'draft'`

### 2. Atualizar ComparisonHub com todas as categorias
- Adicionar filtros: OCUPACIONAL, CONTROLE_MIOPIA, ESPECIALIDADE, FOTOCROMATICA
- Mostrar tecnologias e beneficios vinculados nos cards de familia

### 3. Verificar sugestoes ocupacionais/solares
- Confirmar que familias ocupacionais aparecem no comparativo
- Validar que a escada de valor tem os 4 tiers populados

## Blocos Seguintes (conforme prompt original)
- **Bloco 3**: Camada visual (campo visual, espessura, tratamentos, fotocromia)
- **Bloco 4**: Interface comercial (modo balcao, cards com argumento, upsell)
- **Bloco 5**: Governanca (confianca, explicito vs inferido, bloqueio de dados nao revisados)

## Arquivos Afetados
- `supabase/migrations/` — nova migracao com INSERT de todos os dados
- `src/pages/ComparisonHub.tsx` — novos filtros clinicos
- `src/components/comparison/FamilyComparison.tsx` — tecnologias + beneficios nos cards

