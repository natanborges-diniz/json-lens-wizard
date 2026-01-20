# Governança do Catálogo - Zero Criação de Produto

> **Versão:** 1.0  
> **Data:** 2026-01-20

---

## 🎯 Objetivo

O sistema **NÃO pode criar nenhum dado de produto/catálogo automaticamente**. Ele apenas:
- Consome o JSON importado
- Valida e audita
- Aplica regras de negócio
- Permite edição manual (com registro)
- Gera relatórios

---

## 1. Princípio Central (Obrigatório)

O catálogo (`lenses.json`) é a **única fonte de verdade**.

### ❌ O sistema NUNCA deve inventar/gerar:
- `families` novas
- `prices` (SKUs) novos
- `addons` novos
- `macros` novos
- `technology_library` nova
- Quaisquer IDs novos de produto (ex.: `*_OC_BASICO`, `*_OC_CONFORTO`)

### ✅ O sistema PODE somente:
- Ler e exibir dados do catálogo
- Validar estrutura e integridade referencial
- Auditar e sugerir correções
- Permitir edição manual de campos existentes (com registro)
- Aplicar ações administrativas (ativar/desativar, editar atributos)
- Gerar relatórios de integridade

---

## 2. Regras de Importação

### Modo REPLACE (Substituir)
- Substitui **integralmente** o catálogo pelo JSON importado
- Seções obrigatórias devem existir, caso contrário **bloquear**
- Seções obrigatórias: `meta`, `scales`, `attribute_defs`, `macros`, `families`, `addons`, `prices`

### Modo INCREMENT (Incrementar)
Só pode alterar as seções **explicitamente permitidas**:

| Permitido em INCREMENT | Proibido em INCREMENT |
|------------------------|----------------------|
| `technology_library` | `prices` novos |
| `quote_explainer` | `macros` novos |
| `benefit_rules` | `attribute_defs` novos |
| `index_display` | `scales` novos |
| `families` (edição de campos) | `families` novos |

> **Nota:** Em INCREMENT, edição de `families` só pode modificar campos de famílias **já existentes**, nunca adicionar novas.

---

## 3. Política de "Zero Auto-Criação"

Em **qualquer parte do sistema** (Admin, auditoria, sugestão, orçamento):

### ❌ Proibido:
- "auto-criar famílias ocupacionais"
- "auto-criar variações por tier"
- "auto-criar famílias por palavras-chave"
- "auto-criar SKUs por inferência"
- "auto-migrar SKUs para novas famílias criadas"
- Qualquer geração automática de IDs de produto

### ✅ Permitido:
- **Reclassificar** uma família existente (apenas editando `category` e `macro`) se e somente se:
  - Feito por usuário no Admin
  - Registrado em log com `who`, `when`, `what_changed`
- **Desativar** família sem SKU (ação pós-auditoria, com confirmação)
- **Ajustar** textos/tecnologias (production safe)
- **Marcar** inconsistências e gerar relatório

---

## 4. Auditoria e Validação

Antes de publicar qualquer alteração, o sistema deve executar as regras definidas em `validation_rules.json`:

### Erros Bloqueantes (impedem publicar)
- `REQUIRED_SECTIONS` - Seções obrigatórias ausentes
- `FAMILY_MACRO_INTEGRITY` - Família referencia macro inexistente
- `PRICE_FAMILY_INTEGRITY` - SKU referencia família inexistente
- `PRICE_REQUIRED_FIELDS` - SKU sem código ERP ou sem preço

### Alertas (geram relatório)
- `FAMILY_WITHOUT_SKU` - Família ativa sem nenhum SKU
- `SKU_WITHOUT_INDEX_DISPLAY` - SKU com índice não mapeado
- `FAMILY_WITHOUT_TECHNOLOGY_REFS` - Família sem tecnologias

### Ações Pós-Import
Ações como `AUTO_DISABLE_FAMILIES_WITHOUT_SKU` **requerem confirmação explícita** do usuário antes de serem aplicadas.

---

## 5. Edição Administrativa

Edição manual só é permitida se:
1. Registrar: `who`, `when`, `what_changed`, `reason`
2. Manter histórico de versões
3. Permitir rollback

### Campos Editáveis (sem REPLACE)
| Campo | Escopo |
|-------|--------|
| `families.active` | Ativar/desativar família |
| `families.category` | Reclassificar categoria |
| `families.macro` | Alterar tier |
| `families.attributes_base` | Ajustar atributos |
| `families.technology_refs` | Associar tecnologias |
| `families.name_client` | Textos de exibição |
| `addons.active` | Ativar/desativar addon |
| `index_display` | Adicionar valores quando aparecerem em `prices.index` |

### Edição Proibida (sem REPLACE)
- Criar IDs novos de qualquer entidade
- Criar estruturas novas de produto
- Adicionar `families[]` novas
- Adicionar `prices[]` novos
- Adicionar `macros[]` novos

---

## 6. Categoria OCUPACIONAL

A categoria `OCUPACIONAL` deve ser tratada assim:

### ✅ Se quiser OC, o sistema apenas:
- Mostra OC como categoria **se existirem famílias já importadas** com `category="OCUPACIONAL"`
- Nunca cria `*_OC_*` automaticamente

### Se o catálogo importado não tiver famílias OC:
- A categoria OC pode não aparecer no menu
- Ou aparecer vazia (conforme configuração)
- **MAS SEM CRIAR NADA**

### Para adicionar produtos ocupacionais:
1. Gerar novo `lenses.json` externamente (usando o prompt de geração)
2. Incluir famílias OC com `category: "OCUPACIONAL"` e macros corretos
3. Importar via modo REPLACE
4. Sistema exibe as famílias importadas

---

## 7. Resultado Esperado

Após aplicar esta governança:

| Garantia | Status |
|----------|--------|
| Nenhuma família "fantasma" será criada | ✅ |
| Nenhum SKU novo será inventado | ✅ |
| Nenhuma duplicação por tier ocorrerá | ✅ |
| Sistema 100% previsível | ✅ |
| Sistema 100% auditável | ✅ |
| Histórico de versões completo | ✅ |
| Rollback disponível | ✅ |

---

## 8. Implementação Técnica

### Arquivos Removidos
- `src/lib/occupationalClassifier.ts` - Gerava famílias OC automaticamente
- `src/components/audit/AddFamilyDialog.tsx` - Permitia criar famílias no admin

### Arquivos Modificados
- `src/pages/CatalogAudit.tsx` - Removido botão "Nova Família"
- `src/lib/catalogValidationEngine.ts` - Ações pós-import requerem confirmação
- `src/lib/skuClassificationEngine.ts` - Apenas reclassifica SKUs existentes para famílias existentes

### Regras Preservadas
- Motor de matching: apenas mapeia SKUs para famílias **existentes**
- Validação declarativa: lê regras de `validation_rules.json`
- Versionamento: registra todas as alterações

---

## 9. Fluxo de Trabalho Correto

```
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO DE CATÁLOGO                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [EXTERNO]                                                  │
│     │                                                       │
│     ▼                                                       │
│  ┌────────────────────┐                                     │
│  │ Gerar lenses.json  │ ◄── IA externa com prompt          │
│  │ (única fonte)      │                                     │
│  └─────────┬──────────┘                                     │
│            │                                                │
│            ▼                                                │
│  ┌────────────────────┐                                     │
│  │ Importar (REPLACE) │                                     │
│  └─────────┬──────────┘                                     │
│            │                                                │
│            ▼                                                │
│  ┌────────────────────┐     ┌────────────────────┐          │
│  │ Validar            │────►│ Bloquear se erros  │          │
│  │ (validation_rules) │     └────────────────────┘          │
│  └─────────┬──────────┘                                     │
│            │                                                │
│            ▼                                                │
│  ┌────────────────────┐                                     │
│  │ Auditar            │────► Relatório de problemas         │
│  └─────────┬──────────┘                                     │
│            │                                                │
│            ▼                                                │
│  ┌────────────────────┐                                     │
│  │ Editar Manual      │◄─── Admin confirma cada ação        │
│  │ (com log)          │                                     │
│  └─────────┬──────────┘                                     │
│            │                                                │
│            ▼                                                │
│  ┌────────────────────┐                                     │
│  │ Publicar           │                                     │
│  │ (salvar na nuvem)  │                                     │
│  └────────────────────┘                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

*Documento de Governança v1.0 - Sistema de Catálogo de Lentes*
