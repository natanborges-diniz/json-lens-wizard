# Prompt para IA Externa - Geração de Catálogo de Lentes

> **Copie este documento inteiro como contexto para a IA que vai gerar o catálogo**

---

## 🎯 Objetivo

Você é um especialista em transformação de dados para catálogo de lentes oftálmicas.
Sua tarefa é processar dados de múltiplas fontes (ERP, catálogos de fabricantes, fichas técnicas) e gerar um JSON compatível com o schema v1.2 do sistema de lentes.

---

## 📥 Fontes de Dados que Você Receberá

O usuário fornecerá uma ou mais das seguintes fontes:

1. **Export do ERP** (CSV ou JSON)
   - Códigos de produto
   - Descrições
   - Preços de compra e venda
   - Categorias brutas

2. **Catálogos de Fabricantes** (PDF ou texto)
   - Nomes de produtos
   - Linhas/famílias
   - Tecnologias incluídas
   - Benefícios

3. **Fichas Técnicas** (PDF ou tabelas)
   - Especificações ópticas
   - Faixas de grau
   - Índices disponíveis
   - Diâmetros

---

## 📋 Schema Resumido

### Estrutura Principal

```json
{
  "meta": { },           // OBRIGATÓRIO - Metadados
  "scales": { },         // OBRIGATÓRIO - Escalas de atributos
  "attribute_defs": [],  // OBRIGATÓRIO - Definições de atributos
  "macros": [],          // OBRIGATÓRIO - Categorias/Tiers
  "families": [],        // OBRIGATÓRIO - Famílias de produtos
  "addons": [],          // OBRIGATÓRIO - Complementos
  "prices": [],          // OBRIGATÓRIO - SKUs com preços
  "technology_library": { },  // Opcional
  "family_matching_engine": { }  // Opcional
}
```

---

## 🏷️ Regras de Negócio Críticas

### 1. Preços são por MEIA-PAR
- Se o ERP tiver preço por PAR, **dividir por 2**
- Campos: `price_purchase_half_pair`, `price_sale_half_pair`

### 2. Código ERP Único
- Cada `erp_code` deve ser único em todo o catálogo
- Formato recomendado: `{FORNECEDOR}-{PRODUTO}-{INDICE}-{TRATAMENTO}`

### 3. Fornecedores Normalizados
- Usar exatamente: `ESSILOR`, `ZEISS`, `HOYA`
- Não usar variações como "Essilor Brasil", "ZEISS Vision", etc.

### 4. Índices Válidos
- Valores aceitos: `"1.50"`, `"1.53"`, `"1.56"`, `"1.59"`, `"1.60"`, `"1.67"`, `"1.74"`
- Sempre como string, com ponto decimal

### 5. Categorias Válidas
- `PROGRESSIVA` - Lentes multifocais
- `MONOFOCAL` - Lentes visão simples
- `OCUPACIONAL` - Lentes para trabalho/escritório

### 6. Integridade Referencial
- Todo `prices[].family_id` **DEVE** existir em `families[].id`
- Todo `families[].macro` **DEVE** existir em `macros[].id`

---

## 📝 Templates de Entidades

### META (sempre incluir)

```json
{
  "meta": {
    "schema_version": "1.2",
    "dataset_name": "[DESCREVER O DATASET]",
    "generated_at": "[YYYY-MM-DD]",
    "counts": {
      "families": [CONTAR],
      "addons": [CONTAR],
      "skus_prices": [CONTAR]
    },
    "notes": ["[NOTAS RELEVANTES]"]
  }
}
```

### MACRO

```json
{
  "id": "[CATEGORIA]_[TIER]",
  "category": "[PROGRESSIVA|MONOFOCAL|OCUPACIONAL]",
  "name_client": "[Nome para Cliente]",
  "description_client": "[Descrição curta]",
  "tier_key": "[essential|comfort|advanced|top]"
}
```

**Macros Padrão:**
- PROG_BASICO, PROG_CONFORTO, PROG_AVANCADO, PROG_TOP
- MONO_BASICO, MONO_ENTRADA, MONO_INTER, MONO_TOP
- OC_BASICO, OC_CONFORTO, OC_AVANCADO

### FAMILY

```json
{
  "id": "[FORNECEDOR]_[NOME_PRODUTO]",
  "supplier": "[ESSILOR|ZEISS|HOYA]",
  "name_original": "[Nome Comercial Exato]",
  "category": "[PROGRESSIVA|MONOFOCAL|OCUPACIONAL]",
  "macro": "[ID_DO_MACRO]",
  "attributes_base": {
    "[ATRIBUTO]": [0-3 ou true/false]
  },
  "attributes_display_base": ["[Texto 1]", "[Texto 2]"],
  "technology_refs": ["[ID_TECH_1]", "[ID_TECH_2]"],
  "active": true
}
```

### PRICE (SKU)

```json
{
  "family_id": "[ID_DA_FAMILIA]",
  "erp_code": "[CODIGO_UNICO]",
  "description": "[DESCRIÇÃO ORIGINAL DO ERP]",
  "supplier": "[ESSILOR|ZEISS|HOYA]",
  "lens_category_raw": "[CATEGORIA_BRUTA]",
  "manufacturing_type": "[LS|SF|PRONTA]",
  "index": "[1.50|1.53|1.56|1.59|1.60|1.67|1.74]",
  "price_purchase_half_pair": [NÚMERO],
  "price_sale_half_pair": [NÚMERO],
  "active": true,
  "blocked": false,
  "specs": {
    "diameter_min_mm": [NÚMERO],
    "diameter_max_mm": [NÚMERO],
    "altura_min_mm": [NÚMERO],
    "altura_max_mm": [NÚMERO],
    "sphere_min": [NÚMERO],
    "sphere_max": [NÚMERO],
    "cyl_min": [NÚMERO],
    "cyl_max": [NÚMERO],
    "add_min": [NÚMERO],
    "add_max": [NÚMERO]
  },
  "treatments_raw": {
    "antirreflexo": "[NOME_AR]"
  },
  "addons_detected": [],
  "flags": {
    "photochromic": [true|false],
    "polarized": [true|false]
  }
}
```

---

## 🔍 Extração de Dados

### Extrair Índice da Descrição

Padrões comuns:
- "... 1.67 ..." → `"1.67"`
- "... MR-10 ..." → `"1.67"`
- "... ORMA ..." → `"1.50"`
- "... POLI ..." ou "... PC ..." → `"1.59"`
- "... STYLIS ..." → `"1.67"`
- "... LINEIS ..." → `"1.74"`

### Identificar Categoria

Padrões:
- "PROG", "MULT", "VARILUX", "SMARTLIFE", "PROGRESSIVE" → `PROGRESSIVA`
- "VS", "SV", "SINGLE", "MONOFOCAL" → `MONOFOCAL`
- "OFFICE", "OCUPACIONAL", "EYEZEN", "SYNC", "WORKSTYLE" → `OCUPACIONAL`

### Identificar Família

Mapear descrição para família conhecida:
- "VARILUX COMFORT" → `ESSILOR_VARILUX_COMFORT`
- "VARILUX PHYSIO" → `ESSILOR_VARILUX_PHYSIO`
- "SMARTLIFE" → `ZEISS_SMARTLIFE`
- "SENSITY" → `HOYA_SENSITY`

---

## ✅ Checklist de Validação

Antes de finalizar o JSON:

- [ ] `schema_version` = "1.2"
- [ ] Todas as 7 seções obrigatórias presentes
- [ ] `counts` reflete quantidades reais
- [ ] Todo `family_id` em prices existe em families
- [ ] Todo `macro` em families existe em macros
- [ ] Todo `erp_code` é único
- [ ] Preços são por MEIA-PAR
- [ ] Nenhum valor NaN ou Infinity
- [ ] Fornecedores normalizados
- [ ] Índices válidos

---

## 📤 Formato de Saída

Gere o JSON completo e válido, seguindo exatamente o schema.

**Se houver dados insuficientes:**
- Preencha `specs` com valores padrão razoáveis
- Marque `active: false` se houver dúvida
- Adicione nota em `meta.notes` explicando limitações

**Se houver conflitos:**
- Priorize dados do ERP para preços
- Priorize catálogo do fabricante para nomes/categorias
- Documente decisões em `meta.notes`

---

## 🔧 Exemplo de Transformação

### Input (ERP CSV):
```
COD;DESC;FORN;COMPRA;VENDA
001;VARILUX COMFORT MAX 1.67 CRIZAL SAPPHIRE;ESSILOR;280;650
```

### Output (JSON):
```json
{
  "family_id": "ESSILOR_VARILUX_COMFORT",
  "erp_code": "001",
  "description": "VARILUX COMFORT MAX 1.67 CRIZAL SAPPHIRE",
  "supplier": "ESSILOR",
  "lens_category_raw": "PROG",
  "manufacturing_type": "SF",
  "index": "1.67",
  "price_purchase_half_pair": 280,
  "price_sale_half_pair": 650,
  "active": true,
  "blocked": false,
  "specs": {
    "sphere_min": -8,
    "sphere_max": 6,
    "cyl_min": -4,
    "cyl_max": 0,
    "add_min": 0.75,
    "add_max": 3.50
  },
  "treatments_raw": {
    "antirreflexo": "CRIZAL SAPPHIRE"
  },
  "flags": {
    "photochromic": false,
    "polarized": false
  }
}
```

---

## 📚 Recursos Adicionais

- Schema completo: `catalog-schema.json`
- Guia detalhado: `catalog-generation-guide.md`
- Exemplo anotado: `catalog-example.json`

---

*Prompt v1.2 - Sistema de Catálogo de Lentes*
