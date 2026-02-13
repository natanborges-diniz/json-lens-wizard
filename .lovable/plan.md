

# Plano: Relatório de Integridade Clínica Real para /audit

## Contexto Atual
O sistema de integridade atual (`CatalogAudit.tsx`, linhas 808-821) conta apenas:
- Famílias ativas sem preços
- Preços órfãos
- Macros inválidos
- **Total: 3 tipos de problemas**

O relatório não analisa a qualidade técnica dos SKUs (availability/specs) e marca como "0 problemas" mesmo quando 90% dos SKUs usam safe defaults.

## Problemas a Resolver

### 1. **Classificação Insuficiente de SKUs**
- Atual: Apenas "ativo" vs "inativo"
- Necessário: 4 categorias clínicas:
  - **COMPLETO**: Tem `availability` V3.6.x com todos os campos (sphere/cylinder/addition min/max presentes)
  - **LEGACY**: Tem `specs` legacy completo com `sphere_min/max, cyl_min/max, add_min/max`
  - **PARCIAL**: Specs/availability existe mas faltam campos (ex: só tem sphere, não tem cylinder)
  - **DEFAULTED**: Usa safe defaults (sem `availability` nem `specs` completos)

### 2. **Falso Positivo de Integridade**
- Atualmente: Se não há "famílias sem preços" + "preços órfãos" + "macros inválidos", mostra "Catálogo íntegro"
- **Problema**: 6250 SKUs podem ter 90% em DEFAULTED, mas a página continua exibindo ✓ "0 problemas"
- **Solução**: DEFAULTED e PARCIAL devem ser contados como "problemas"

### 3. **Quebras de Análise Faltando**
- Atual: Apenas distribuição de famílias por clinical_type
- Necessário adicionar:
  - Contabilização de SKUs por classificação (COMPLETO / LEGACY / PARCIAL / DEFAULTED)
  - Breakdown por supplier (qual fornecedor tem mais DEFAULTED)
  - Breakdown por clinical_type (qual tipo clínico tem mais PARCIAL)
  - Top 20 famílias com mais SKUs DEFAULTED
  - Top 20 fornecedores com mais SKUs DEFAULTED

## Arquitetura da Solução

### A. Nova Função: `calculateSKUIntegrityMetrics()`
**Localização**: `src/lib/catalogIntegrityAnalyzer.ts` (novo arquivo)

Responsabilidades:
- Iterar os 6250 SKUs
- Para cada SKU, classificar como COMPLETO / LEGACY / PARCIAL / DEFAULTED
- Usar a mesma lógica de `enrichAvailability()` em `catalogEnricher.ts` (linhas 173-232)
- Retornar estrutura:

```typescript
interface SKUIntegrityMetric {
  erp_code: string;
  family_id: string;
  supplier: string;
  clinical_type: ClinicalType;
  classification: 'COMPLETO' | 'LEGACY' | 'PARCIAL' | 'DEFAULTED';
  issues?: string[]; // ['missing_cylinder', 'missing_addition']
}

interface IntegrityReport {
  total_skus: number;
  classifications: {
    COMPLETO: number;
    LEGACY: number;
    PARCIAL: number;
    DEFAULTED: number;
  };
  by_supplier: Record<string, IntegrityMetric>;
  by_clinical_type: Record<ClinicalType, IntegrityMetric>;
  families_with_most_defaulted: Array<{
    family_id: string;
    supplier: string;
    clinical_type: ClinicalType;
    defaulted_count: number;
    total_skus: number;
  }>;
  suppliers_with_most_defaulted: Array<{
    supplier: string;
    defaulted_count: number;
    total_skus: number;
  }>;
  problem_count: number; // PARCIAL + DEFAULTED
}
```

### B. Integração no CatalogAudit.tsx
**Localização**: `src/pages/CatalogAudit.tsx`

Mudanças:
1. Adicionar nova aba no TabsList: `"integrity-clinical"` (entre "integrity" e "logs-do-motor")
2. Remover ou desabilitar a seção "Distribuição por Tipo Clínico" da aba "Integridade"
3. Mover a exibição "Distribuição por Tipo Clínico" para a aba "Integridade Clínica"
4. Na aba "Integridade Clínica", exibir:
   - Painel de resumo geral (COMPLETO % / LEGACY % / PARCIAL % / DEFAULTED %)
   - Cards de breakdown por supplier
   - Cards de breakdown por clinical_type
   - Tabela: Top 20 famílias com mais SKUs DEFAULTED
   - Tabela: Top 20 fornecedores com mais SKUs DEFAULTED
5. **Crítico**: Atualizar a lógica de `integrityIssues` (linha 808) para incluir:
   - `problem_count` da análise clínica (PARCIAL + DEFAULTED)
   - Não retornar "0 problemas" se `problem_count > 0`

### C. Refactoring do Relatório de Integridade Existente
**Aba "Integridade"** (atual) continuará com:
- Data Source Diagnostic
- Families without prices (famílias ativas sem preços)
- Invalid macros
- Orphaned prices
- **Sem a "Distribuição por Tipo Clínico"** (move para aba nova)

### D. Hook: `useClinicalIntegrityReport()`
**Localização**: `src/hooks/useClinicalIntegrityReport.ts` (novo)

Responsabilidades:
- Memoizar o cálculo pesado de 6250 SKUs
- Retornar `IntegrityReport`
- Usar `useCatalogEnricher()` para acessar dados enriquecidos (flags availability_defaulted, etc.)

## Sequência de Implementação

1. **Criar `catalogIntegrityAnalyzer.ts`** com função `calculateSKUIntegrityMetrics()`
   - Implementar classificação: COMPLETO / LEGACY / PARCIAL / DEFAULTED
   - Implementar cálculos de quebra por supplier e clinical_type
   - Implementar ranking Top 20

2. **Criar `useClinicalIntegrityReport.ts`** hook com memoização

3. **Atualizar `CatalogAudit.tsx`**
   - Adicionar nova aba TabsContent "integrity-clinical"
   - Usar o hook `useClinicalIntegrityReport()`
   - Renderizar cards de resumo, breakdowns e tabelas
   - Atualizar `integrityIssues` para contar problemas clínicos

4. **Mover "Distribuição por Tipo Clínico"** para a aba nova (apenas move o JSX existente, sem recodificar)

5. **Testar end-to-end**
   - Executar fluxo de venda com SKU DEFAULTED
   - Verificar que /audit > Integridade Clínica mostra % correto
   - Verificar que integrityIssues.total agora inclui problemas clínicos

## Notas Técnicas

- **Reuso de Lógica**: O `enrichAvailability()` já existe em `catalogEnricher.ts`. Vamos replicar sua lógica na análise ofline.
- **Performance**: 6250 SKUs em memoização useMemo não deve ser problema (ativo apenas na aba de integridade).
- **Integridade de Dados**: Não altera o catálogo, apenas analisa e exibe.
- **Motor Intacto**: Nenhuma mudança no `recommendationEngine`, apenas auditoria.

