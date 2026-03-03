

# Plano: Redesenho da Arquitetura de Gestao de Catalogo

## Diagnostico da Situacao Atual

### Mapa de Paginas e Duplicidades

```text
ROTA              PAGINA                FUNCAO                          STATUS
─────────────────────────────────────────────────────────────────────────────
/admin            AdminDashboard.tsx    Importacao JSON, Patch ERP,     DUPLICADA
                  (1296 linhas)         Prioridades, Familias,
                                       Add-ons, Historico versao

/audit            CatalogAudit.tsx      Familias, Macros, Fornecedores, PRINCIPAL
                  (1824 linhas)         Tecnologias, Regras Match,      (muito sobrecarregada)
                                       Integridade (2x), Logs Motor,
                                       Importacao ERP, Comercial,
                                       Classificacao (11 abas!)

/catalog-audit    → redirect /audit     Legacy redirect                 EM DESUSO

CatalogAuditPage  CatalogAuditPage.tsx  Auditoria familias vendaveis    ORFAO (657 linhas)
                  (657 linhas)          SEM ROTA no App.tsx!
```

### Problemas Identificados

1. **3 paginas fazendo coisas parecidas**: AdminDashboard, CatalogAudit e CatalogAuditPage
2. **CatalogAuditPage.tsx e orfao** - 657 linhas de codigo morto sem rota
3. **AdminDashboard duplica funcionalidades do CatalogAudit**: listagem de familias (toggle ativo), import JSON, historico de versoes
4. **CatalogAudit tem 11 abas** - impossivel descobrir funcionalidades
5. **AdminDashboard mistura importacao com visualizacao** - Patch ERP redireciona para /audit
6. **Botoes "Edicao Manual" e "Auditoria" no header do Admin apontam para o mesmo lugar** (/audit)
7. **Prioridades de fornecedor no Admin** duplica logica que poderia viver em /audit
8. **Familias no Admin** e uma versao simplificada (toggle only) do que /audit ja faz com mais poder

### O que esta em desuso

| Item | Motivo |
|------|--------|
| `CatalogAuditPage.tsx` | Pagina orfao, sem rota, codigo morto |
| Aba "Familias" no AdminDashboard | Duplica /audit com menos funcionalidade |
| Aba "Add-ons" no AdminDashboard | Funcionalidade basica sem equivalente rico |
| Aba "Prioridades" no AdminDashboard | Funcionalidade unica mas escondida |
| Redirect `/catalog-audit` | Legacy, pode ser removido apos consolidacao |
| Botoes duplicados no header Admin ("Edicao Manual" + "Auditoria") | Mesmo destino |

---

## Proposta: Hub de Catalogo Unificado

### Nova Arquitetura de Navegacao

```text
/dashboard        Dashboard operacional (vendas, metricas)
  │
  └─ /catalog     ← NOVA ROTA: Hub de Catalogo (substitui /admin + /audit)
       │
       ├─ Aba "Visao Geral"      Stats + Integridade + Banner de governanca
       ├─ Aba "Familias"         Edicao completa (do CatalogAudit atual)
       ├─ Aba "Macros"           Macros (do CatalogAudit atual)
       ├─ Aba "Fornecedores"     Fornecedores + Prioridades (merge)
       ├─ Aba "Tecnologias"      Tecnologias (do CatalogAudit atual)
       ├─ Aba "Importacao"       JSON import + ERP XLSX (unificado)
       ├─ Aba "Qualidade"        Integridade + Clinica + Classificacao (merge 3 abas)
       └─ Aba "Historico"        Versoes + Logs do Motor + Comercial
```

### Reducao: de 11 abas para 7, com agrupamentos logicos

| Grupo | Abas atuais consolidadas | Nova aba |
|-------|--------------------------|----------|
| Dados | Familias | Familias |
| Dados | Macros | Macros |
| Dados | Fornecedores + Prioridades (do Admin) | Fornecedores |
| Dados | Tecnologias + Regras Match | Tecnologias |
| Fluxo | Import JSON (Admin) + Importacao ERP (/audit) | Importacao |
| Diagnostico | Integridade + Int. Clinica + Classificacao | Qualidade |
| Historico | Logs Motor + Comercial + Versoes | Historico |

---

## Entregaveis

### E1: Criar pagina `CatalogHub.tsx` (nova rota `/catalog`)

- Sidebar compacta a esquerda com icones + labels para as 7 seccoes
- Header com: stats rapidos, badge de versao, CloudSync, botao Salvar/Descartar
- Banner de governanca (CatalogStatusBanner) sempre visivel no topo
- Toda a logica de estado local (localFamilies, pendingChanges, save/discard) migrada do CatalogAudit

### E2: Aba "Visao Geral" (nova)

- Cards de metricas (do CatalogAudit: familias, ativas, com precos, SKUs, problemas)
- Distribuicao por clinical_type (tabela resumo)
- Acesso rapido: botoes grandes para cada seccao com contagem e status
- DataSourceDiagnostic integrado

### E3: Aba "Importacao" (unificada)

- Sub-seccoes com cards clicaveis: "Catalogo JSON" e "Planilha ERP (XLSX)"
- JSON: textarea + validacao + preview (migrado do AdminDashboard)
- ERP: wizard completo (ErpImportTab ja existente)
- Exportar JSON integrado

### E4: Aba "Fornecedores" com Prioridades

- SupplierCard list (do CatalogAudit)
- Seccao "Prioridades Comerciais" abaixo (migrada do AdminDashboard)

### E5: Aba "Qualidade" (merge de 3 abas)

- Sub-tabs: "Estrutural", "Clinica", "Classificacao"
- Conteudo: IntegrityExportButton, clinicalReport, ClassificationTab
- AutoFix integrado

### E6: Aba "Historico"

- CatalogVersionHistory
- RecommendationLogsTab
- CommercialAuditTab

### E7: Limpeza

- Deletar `CatalogAuditPage.tsx` (orfao)
- AdminDashboard: reduzir para apenas um redirect ou painel de links rapidos para /catalog
- Rota `/audit` redireciona para `/catalog`
- Rota `/admin` redireciona para `/catalog` (ou manter como painel admin leve se houver funcionalidades nao-catalogo)
- Remover redirect legacy `/catalog-audit`

### E8: Navegacao no Dashboard

- Adicionar card/botao "Gestao de Catalogo" no Dashboard que leva a `/catalog`
- Sidebar ou breadcrumbs para contexto de navegacao

---

## Arquivos Afetados

**Novos:**
- `src/pages/CatalogHub.tsx` - Hub unificado

**Modificados:**
- `src/App.tsx` - Nova rota `/catalog`, redirects
- `src/pages/Dashboard.tsx` - Link para /catalog
- `src/pages/AdminDashboard.tsx` - Simplificar drasticamente (redirect ou links)

**Deletados:**
- `src/pages/CatalogAuditPage.tsx` - Codigo morto

**Mantidos sem alteracao:**
- Todos os componentes de `/components/audit/*` - Reutilizados no Hub
- `ErpImportTab`, `CommercialAuditTab`, `ClassificationTab`, etc.

---

## Resultado Esperado

- 1 unico ponto de entrada para tudo relacionado a catalogo
- De 3 paginas confusas para 1 hub claro com 7 seccoes logicas
- Eliminacao de ~2000 linhas de codigo duplicado/morto
- Funcionalidades antes escondidas (prioridades, diagnostico, qualidade clinica) ganham visibilidade

