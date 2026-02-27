
# Plan 5: Governanca de Classificacao com Bloqueio Absoluto de Publicacao

## Resumo

Implementar uma camada formal de governanca que audita consistencia de familias/SKUs (ProductKind, clinical_type, supplier, tecnologia), persiste historico de validacoes, e bloqueia absolutamente a publicacao quando conflitos criticos existem. Inclui nova tabela de mapeamento ERP-Familia e UI dedicada na pagina /audit.

---

## Arquitetura Atual

- **Publicacao**: `saveCatalogToCloud()` no lensStore.ts ja tem um "Publication Gate" que verifica grades faltantes via `catalog-grade-matrix/missing`. Bloqueia se variantes sem grade existem.
- **Validacao**: `catalogValidationEngine.ts` executa regras declarativas de `validation_rules.json` (structure, reference, field_presence, aggregation, enum_validation). Retorna blocking/warning.
- **Integridade Clinica**: `catalogIntegrityAnalyzer.ts` classifica SKUs em COMPLETO/LEGACY/PARCIAL/DEFAULTED.
- **Classificacao**: `skuClassificationEngine.ts` reclassifica SKUs para familias existentes.
- **Store**: Zustand com `rawLensData`, `saveCatalogToCloud`, `loadCatalogFromCloud`.
- **UI**: CatalogAudit.tsx com ~10 tabs (families, macros, suppliers, technologies, matching, integrity, clinical, logs, erp-import, commercial).

---

## Mudancas de Banco de Dados

### Tabela 1: `supplier_family_map`
```sql
CREATE TABLE public.supplier_family_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT NOT NULL,
  erp_family_name TEXT NOT NULL,
  catalog_family_id TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'manual' CHECK (rule_type IN ('exact','regex','manual')),
  confidence TEXT NOT NULL DEFAULT 'manual' CHECK (confidence IN ('auto','manual','reviewed')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(supplier, erp_family_name)
);
-- RLS: admin/manager can manage, sellers can view
```

### Tabela 2: `catalog_validation_runs`
```sql
CREATE TABLE public.catalog_validation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_conflicts INTEGER NOT NULL DEFAULT 0,
  critical_conflicts INTEGER NOT NULL DEFAULT 0,
  warning_conflicts INTEGER NOT NULL DEFAULT 0,
  conflicts_detail JSONB DEFAULT '[]',
  user_id UUID,
  catalog_version_id UUID,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Constraint: published=true implica critical_conflicts=0 (enforced by trigger)
-- RLS: admin/manager can manage, sellers can view
```

### Trigger de validacao
```sql
CREATE OR REPLACE FUNCTION validate_publication_gate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.published = true AND NEW.critical_conflicts > 0 THEN
    RAISE EXCEPTION 'Cannot publish with critical conflicts (found %)', NEW.critical_conflicts;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_publication
  BEFORE INSERT OR UPDATE ON catalog_validation_runs
  FOR EACH ROW EXECUTE FUNCTION validate_publication_gate();
```

---

## Novo Modulo: Auditor de Consistencia

### Arquivo: `src/lib/catalogConsistencyAuditor.ts`

Funcao principal `auditFamilyConsistency(families, prices, technologyLibrary)` que retorna:

```typescript
interface ConsistencyAuditResult {
  critical: ConsistencyConflict[];
  warnings: ConsistencyConflict[];
  summary: {
    totalCritical: number;
    totalWarnings: number;
    canPublish: boolean; // totalCritical === 0
  };
}

interface ConsistencyConflict {
  type: string; // ex: 'SKU_WITHOUT_FAMILY', 'MIXED_PRODUCT_KIND', etc.
  familyId?: string;
  details: string;
  affectedSkus?: string[];
}
```

**Conflitos criticos verificados:**
1. `SKU_WITHOUT_FAMILY` - SKU sem family_id valido
2. `MIXED_PRODUCT_KIND` - Familia com SKUs de clinical_types incompativeis (ex: MONOFOCAL + PROGRESSIVA na mesma familia)
3. `CLINICAL_TYPE_MISMATCH` - >20% dos SKUs divergem do clinical_type da familia
4. `FAMILY_WITHOUT_ACTIVE_SKU` - Familia ativa sem nenhum SKU ativo
5. `INCOMPATIBLE_TECHNOLOGY` - Tecnologia associada a familia com ProductKind incompativel
6. `MIXED_SUPPLIER_FAMILY` - Familia com SKUs de fornecedores diferentes
7. `FAMILY_WITHOUT_SUPPLIER` - Familia sem supplier definido
8. `SKU_NULL_CLINICAL_TYPE` - SKU com clinical_type null/undefined
9. `SKU_MISSING_ESSENTIAL_RANGE` - SKU ativo sem range minimo de esfera/cilindro

**Correcoes automaticas permitidas (safe):**
- Ajustar `family.clinical_type` se >=85% dos SKUs convergem
- Ajustar `product_kind` se 100% dos SKUs convergem
- Remover tecnologia incompativel com ProductKind

Retorna `autoFixes: AutoFix[]` separadamente para confirmacao do usuario.

---

## Integracao com Publicacao (Bloqueio Absoluto)

### Modificar `saveCatalogToCloud()` no `lensStore.ts`

Antes de salvar, executar `auditFamilyConsistency()`:

```text
saveCatalogToCloud():
  1. [existente] Check grade gate (catalog-grade-matrix/missing)
  2. [NOVO] Run auditFamilyConsistency()
     - Se critical > 0: BLOQUEAR, set syncStatus='error', retornar mensagem
     - Se critical === 0: prosseguir
  3. [NOVO] Persistir resultado em catalog_validation_runs (via supabase insert)
  4. [existente] Upload catalog-default.json
  5. [NOVO] Marcar validation_run como published=true
```

**Nao ha override manual. Nao ha excecao administrativa.**

### Status do Catalogo (runtime-only, nao persistido no JSON)

Derivar do estado atual:
- `draft` = ha pendingChanges OU conflitos criticos > 0
- `ready_for_publish` = conflitos criticos === 0 E sem pendingChanges
- `published` = apos saveCatalogToCloud com sucesso

Adicionar ao lensStore: `catalogStatus: 'draft' | 'ready_for_publish' | 'published'`

---

## UI no /audit

### Banner fixo superior (abaixo do header, acima das tabs)

```text
+------------------------------------------------------------------+
| [icon] Status: DRAFT | Conflitos Criticos: 3 | [Publicar: disabled] |
| Motivo: 2 familias com ProductKind misto, 1 SKU sem familia       |
+------------------------------------------------------------------+
```

- Cor vermelha se criticos > 0
- Cor verde se ready_for_publish
- Botao "Publicar" desabilitado se criticos > 0, com tooltip listando motivos

### Nova tab: "Classificacao"

Adicionar tab `classification` no TabsList existente com tabela mostrando:

| Supplier | ERP Family Name | SKUs | Familia Mapeada | Status |
|----------|----------------|------|-----------------|--------|
| ESSILOR  | VARILUX LIBERTY | 45   | ESSILOR_VARILUX_LIBERTY | OK |
| HOYA     | HOYALUX ID     | 32   | -               | Sem Mapping |

Acoes por linha: Mapear (abre select de familias existentes), Revisar.

Dados lidos da tabela `supplier_family_map` + cruzamento com catalogo em memoria.

### Painel de conflitos

Dentro da tab "Classificacao" ou como sub-secao da tab "Integridade":
- Lista de todos conflitos criticos com tipo, familia afetada, e SKUs envolvidos
- Botao "Aplicar correcoes automaticas" (apenas para as safe fixes: convergencia >=85%)
- Cada correcao mostra preview antes de aplicar

---

## Sequencia de Implementacao

1. **Migracao DB**: Criar tabelas `supplier_family_map` e `catalog_validation_runs` com RLS e trigger
2. **catalogConsistencyAuditor.ts**: Funcao pura de auditoria (9 checks criticos + auto-fixes)
3. **Integrar no lensStore**: Adicionar `catalogStatus`, modificar `saveCatalogToCloud` com gate de consistencia
4. **Persistencia**: Inserir resultado da validacao em `catalog_validation_runs` apos cada auditoria
5. **UI - Banner de status**: Componente `CatalogStatusBanner` fixo no topo do /audit
6. **UI - Tab Classificacao**: Nova tab com tabela de mapeamentos e painel de conflitos
7. **Integracao ERP**: Atualizar `supplier_family_map` durante importacao ERP (apos sync)

---

## Arquivos Afetados

**Novos:**
- `src/lib/catalogConsistencyAuditor.ts` (auditor com 9 checks + auto-fixes)
- `src/components/audit/CatalogStatusBanner.tsx` (banner fixo de status)
- `src/components/audit/ClassificationTab.tsx` (nova tab de classificacao/mapeamento)

**Modificados:**
- `src/store/lensStore.ts` (catalogStatus + gate de consistencia no saveCatalogToCloud)
- `src/pages/CatalogAudit.tsx` (banner + nova tab)

**Migracoes DB:**
- `supplier_family_map` (tabela + RLS)
- `catalog_validation_runs` (tabela + RLS + trigger de validacao)

**Nao alterados (Zero Criacao mantido):**
- Catalogo JSON (nenhum dado inventado)
- Motor de recomendacao (Fase 4 preservada)
- Edge functions existentes

---

## Garantias

| Garantia | Mecanismo |
|----------|-----------|
| Publicacao impossivel com conflitos | Gate no saveCatalogToCloud + trigger DB |
| Todo SKU com family_id valido | Check SKU_WITHOUT_FAMILY |
| Nenhuma familia mistura ProductKind | Check MIXED_PRODUCT_KIND |
| Clinical_type consistente | Check CLINICAL_TYPE_MISMATCH (>20%) |
| Logs persistidos | catalog_validation_runs com detail |
| UI reflete bloqueio | Banner + botao desabilitado |
| Zero Criacao | Auditor apenas valida e sugere, nunca cria |
