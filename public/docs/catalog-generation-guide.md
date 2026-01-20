# Guia de Geração de Catálogo de Lentes v1.2

> **Documento de Referência para IA Externa**
> 
> Este documento serve como contexto/prompt para sistemas de IA que precisam gerar JSONs de catálogo compatíveis com o sistema de lentes oftálmicas.

---

## 📋 Índice

1. [Visão Geral do Schema](#1-visão-geral-do-schema)
2. [Seções Obrigatórias](#2-seções-obrigatórias)
3. [Seções Opcionais](#3-seções-opcionais)
4. [Templates de Entidades](#4-templates-de-entidades)
5. [Regras de Validação](#5-regras-de-validação)
6. [Guia de Mapeamento de Fontes](#6-guia-de-mapeamento-de-fontes)
7. [Motor de Classificação](#7-motor-de-classificação)
8. [Checklist Final](#8-checklist-final)

---

## 1. Visão Geral do Schema

### Versão Atual: 1.2

O catálogo de lentes é um arquivo JSON estruturado que define produtos, preços e relacionamentos para um sistema de vendas de lentes oftálmicas.

### Hierarquia de Dados

```
MACRO (Tier/Categoria)
  └── FAMÍLIA (Linha de Produto)
       └── SKU/PREÇO (Item Vendável)
            └── TECNOLOGIAS (Características)
```

### Categorias Suportadas

| Categoria | Código | Descrição |
|-----------|--------|-----------|
| Progressiva | `PROGRESSIVA` | Lentes multifocais |
| Monofocal | `MONOFOCAL` | Lentes de visão simples |
| Ocupacional | `OCUPACIONAL` | Lentes para trabalho/escritório |

### Tiers de Produto

| Tier | Código | Descrição |
|------|--------|-----------|
| Essencial | `essential` | Entrada, básico |
| Conforto | `comfort` | Intermediário |
| Avançado | `advanced` | Premium |
| Premium | `top` | Topo de linha |

---

## 2. Seções Obrigatórias

O JSON **DEVE** conter todas estas seções para ser válido:

### 2.1 meta (Metadados)

```json
{
  "meta": {
    "schema_version": "1.2",
    "dataset_name": "Nome do Dataset",
    "generated_at": "2026-01-20",
    "counts": {
      "families": 36,
      "addons": 8,
      "skus_prices": 250,
      "technologies": 25
    },
    "notes": ["Atualização de preços Janeiro 2026"]
  }
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `schema_version` | string | ✅ | Deve ser "1.2" |
| `dataset_name` | string | ✅ | Nome identificador |
| `generated_at` | string | ✅ | Data ISO (YYYY-MM-DD) |
| `counts` | object | ✅ | Contadores de entidades |
| `notes` | array | ❌ | Notas de versão |

### 2.2 scales (Escalas de Atributos)

```json
{
  "scales": {
    "SCALE_0_3": {
      "0": "Básico",
      "1": "Bom",
      "2": "Muito Bom",
      "3": "Excelente"
    },
    "SCALE_BOOL": {
      "true": "Sim",
      "false": "Não"
    }
  }
}
```

### 2.3 attribute_defs (Definições de Atributos)

```json
{
  "attribute_defs": [
    {
      "id": "PROG_ADAPT",
      "group": "PROGRESSIVA",
      "name_common": "Adaptação",
      "scale": "SCALE_0_3"
    },
    {
      "id": "PROG_CAMPO",
      "group": "PROGRESSIVA",
      "name_common": "Campo de Visão",
      "scale": "SCALE_0_3"
    }
  ]
}
```

#### Atributos Padrão por Categoria

**PROGRESSIVA:**
- `PROG_ADAPT` - Facilidade de adaptação (0-3)
- `PROG_CAMPO` - Amplitude do campo visual (0-3)
- `PROG_DIGITAL` - Otimização para telas (0-3)
- `PROG_PERSON` - Nível de personalização (0-3)

**MONOFOCAL:**
- `MONO_NITIDEZ` - Nitidez visual (0-3)
- `MONO_CONFORTO` - Conforto prolongado (0-3)
- `MONO_DIGITAL` - Proteção digital (0-3)
- `MONO_ESTETICA` - Estética da lente (0-3)

**OCUPACIONAL:**
- `OC_CAMPO_PERTO` - Campo para perto (0-3)
- `OC_CAMPO_INTER` - Campo intermediário (0-3)
- `OC_DIGITAL` - Otimização para telas (0-3)

**COMUNS:**
- `AR_QUALIDADE` - Qualidade do antirreflexo (0-3)
- `BLUE` - Proteção luz azul (0-3)
- `DURABILIDADE` - Resistência a riscos (0-3)
- `UV` - Proteção UV (boolean)

### 2.4 macros (Categorias/Tiers)

```json
{
  "macros": [
    {
      "id": "PROG_CONFORTO",
      "category": "PROGRESSIVA",
      "name_client": "Conforto",
      "description_client": "Adaptação facilitada e campos visuais amplos",
      "tier_key": "comfort",
      "display": {
        "icon": "Smile",
        "color_class": "text-blue-600",
        "bg_header_class": "bg-gradient-to-r from-blue-50 to-indigo-100",
        "border_class": "border-blue-200",
        "dot_color_class": "bg-blue-500"
      }
    }
  ]
}
```

#### Macros Padrão

| ID | Categoria | Tier |
|----|-----------|------|
| `PROG_BASICO` | PROGRESSIVA | essential |
| `PROG_CONFORTO` | PROGRESSIVA | comfort |
| `PROG_AVANCADO` | PROGRESSIVA | advanced |
| `PROG_TOP` | PROGRESSIVA | top |
| `MONO_BASICO` | MONOFOCAL | essential |
| `MONO_ENTRADA` | MONOFOCAL | comfort |
| `MONO_INTER` | MONOFOCAL | advanced |
| `MONO_TOP` | MONOFOCAL | top |
| `OC_BASICO` | OCUPACIONAL | essential |
| `OC_CONFORTO` | OCUPACIONAL | comfort |
| `OC_AVANCADO` | OCUPACIONAL | advanced |

### 2.5 families (Famílias de Produtos)

```json
{
  "families": [
    {
      "id": "ESSILOR_VARILUX_COMFORT",
      "supplier": "ESSILOR",
      "name_original": "Varilux Comfort Max",
      "category": "PROGRESSIVA",
      "macro": "PROG_CONFORTO",
      "attributes_base": {
        "PROG_ADAPT": 2,
        "PROG_CAMPO": 2,
        "PROG_DIGITAL": 1,
        "PROG_PERSON": 1,
        "AR_QUALIDADE": 2,
        "BLUE": 1,
        "DURABILIDADE": 2,
        "UV": true
      },
      "attributes_display_base": ["Crizal Sapphire", "Proteção UV"],
      "technology_refs": ["ESSILOR_CRIZAL_SAPPHIRE", "ESSILOR_EYEPROTECT"],
      "active": true
    }
  ]
}
```

#### Regras de ID de Família

- Formato: `{FORNECEDOR}_{NOME_PRODUTO}`
- Exemplos: `ZEISS_SMARTLIFE`, `HOYA_SENSITY_DARK`
- Sem espaços, usar underscore
- Uppercase

### 2.6 addons (Complementos)

```json
{
  "addons": [
    {
      "id": "FOTOSSENSIVEL",
      "name_common": "Fotossensível",
      "description_client": "Lente que escurece automaticamente ao sol",
      "impact": {
        "UV": 1,
        "DURABILIDADE": 1
      },
      "name_commercial": {
        "ESSILOR": "Transitions",
        "ZEISS": "PhotoFusion",
        "HOYA": "Sensity"
      },
      "rules": {
        "categories": ["PROGRESSIVA", "MONOFOCAL", "OCUPACIONAL"]
      },
      "active": true
    }
  ]
}
```

### 2.7 prices (SKUs/Preços) ⚠️ CRÍTICO

```json
{
  "prices": [
    {
      "family_id": "ESSILOR_VARILUX_COMFORT",
      "erp_code": "ESS-VAR-COMF-167-CS",
      "description": "VARILUX COMFORT MAX 1.67 CRIZAL SAPPHIRE",
      "supplier": "ESSILOR",
      "lens_category_raw": "PROG",
      "manufacturing_type": "SF",
      "index": "1.67",
      "price_purchase_half_pair": 280.00,
      "price_sale_half_pair": 650.00,
      "active": true,
      "blocked": false,
      "specs": {
        "diameter_min_mm": 65,
        "diameter_max_mm": 75,
        "altura_min_mm": 14,
        "altura_max_mm": 22,
        "sphere_min": -8.00,
        "sphere_max": 6.00,
        "cyl_min": -4.00,
        "cyl_max": 0,
        "add_min": 0.75,
        "add_max": 3.50
      },
      "treatments_raw": {
        "antirreflexo": "CRIZAL SAPPHIRE"
      },
      "addons_detected": [],
      "attribute_overrides": {},
      "flags": {
        "photochromic": false,
        "polarized": false
      }
    }
  ]
}
```

#### ⚠️ Regras Críticas de Preços

1. **Preços são por MEIA-PAR** (half_pair) - multiplicar por 2 para par completo
2. **erp_code DEVE ser único** em todo o catálogo
3. **family_id DEVE existir** em `families[]`
4. **Valores numéricos nunca podem ser NaN ou Infinity**

#### Índices Válidos

| Índice | Nome Comum |
|--------|------------|
| `1.50` | CR-39 / Orma |
| `1.53` | Trivex |
| `1.56` | Mid-index |
| `1.59` | Policarbonato |
| `1.60` | MR-8 |
| `1.67` | MR-10 |
| `1.74` | Alto índice |

#### Tipos de Fabricação

| Código | Descrição |
|--------|-----------|
| `LS` | Laboratório (surfaçagem externa) |
| `SF` | Surfaçagem (freeform) |
| `PRONTA` | Lente pronta (stock) |

---

## 3. Seções Opcionais

### 3.1 technology_library (Biblioteca de Tecnologias)

```json
{
  "technology_library": {
    "items": {
      "ESSILOR_CRIZAL_SAPPHIRE": {
        "id": "ESSILOR_CRIZAL_SAPPHIRE",
        "name_common": "Antirreflexo Premium",
        "name_commercial": {
          "ESSILOR": "Crizal Sapphire HR"
        },
        "description_short": "Antirreflexo de alta resistência",
        "description_long": "Tecnologia multicamadas com proteção UV e resistência a riscos",
        "benefits": [
          "99% de transparência",
          "Resistência a riscos",
          "Fácil limpeza"
        ],
        "icon": "Sparkles"
      }
    }
  }
}
```

### 3.2 index_display (Configuração de Índices)

```json
{
  "index_display": [
    {
      "value": "1.50",
      "name": "Orma / CR-39",
      "description": "Índice padrão, ideal para graus baixos",
      "aesthetic_score": 1
    },
    {
      "value": "1.74",
      "name": "Alto Índice",
      "description": "Lente mais fina disponível para graus altos",
      "aesthetic_score": 4
    }
  ]
}
```

### 3.3 family_matching_engine (Motor de Classificação)

Ver seção 7.

---

## 4. Templates de Entidades

### 4.1 Template Completo - Atualização de Preços (INCREMENT)

Use quando precisar apenas atualizar preços/SKUs:

```json
{
  "meta": {
    "schema_version": "1.2",
    "dataset_name": "Atualização Preços - [MÊS] [ANO]",
    "generated_at": "[YYYY-MM-DD]",
    "counts": {
      "families": 0,
      "addons": 0,
      "skus_prices": [QUANTIDADE]
    },
    "notes": ["Atualização de tabela de preços"]
  },
  "prices": [
    // ... SKUs aqui
  ]
}
```

### 4.2 Template Completo - Nova Família (INCREMENT)

Use quando adicionar nova linha de produto:

```json
{
  "meta": {
    "schema_version": "1.2",
    "dataset_name": "Nova Família - [NOME]",
    "generated_at": "[YYYY-MM-DD]",
    "counts": {
      "families": 1,
      "addons": 0,
      "skus_prices": [QUANTIDADE]
    }
  },
  "families": [
    {
      "id": "[FORNECEDOR]_[NOME]",
      "supplier": "[FORNECEDOR]",
      "name_original": "[NOME_COMERCIAL]",
      "category": "[CATEGORIA]",
      "macro": "[MACRO_ID]",
      "attributes_base": {},
      "attributes_display_base": [],
      "technology_refs": [],
      "active": true
    }
  ],
  "prices": [
    // ... SKUs desta família
  ]
}
```

### 4.3 Template Completo - Nova Tecnologia (INCREMENT)

```json
{
  "meta": {
    "schema_version": "1.2",
    "dataset_name": "Nova Tecnologia - [NOME]",
    "generated_at": "[YYYY-MM-DD]",
    "counts": {
      "technologies": 1
    }
  },
  "technology_library": {
    "items": {
      "[ID_TECNOLOGIA]": {
        "id": "[ID_TECNOLOGIA]",
        "name_common": "[NOME]",
        "description_short": "[DESCRIÇÃO]",
        "benefits": []
      }
    }
  }
}
```

---

## 5. Regras de Validação

### 5.1 Regras Bloqueantes (Import Falha)

| Código | Descrição | Verificação |
|--------|-----------|-------------|
| `REQUIRED_SECTIONS` | Seções obrigatórias ausentes | Todas as 7 seções devem existir |
| `FAMILY_MACRO_INTEGRITY` | Macro inválido | `families[].macro` ∈ `macros[].id` |
| `PRICE_FAMILY_INTEGRITY` | Família inválida | `prices[].family_id` ∈ `families[].id` |
| `PRICE_REQUIRED_FIELDS` | Campos obrigatórios | `erp_code`, `price_sale_half_pair` |

### 5.2 Regras de Alerta (Import Funciona com Aviso)

| Código | Descrição | Ação Automática |
|--------|-----------|-----------------|
| `FAMILY_WITHOUT_SKU` | Família sem preços | Família desativada |
| `SKU_WITHOUT_INDEX_DISPLAY` | Índice não listado | Apenas aviso |
| `FAMILY_WITHOUT_TECHNOLOGY_REFS` | Sem tecnologias | Apenas aviso |

---

## 6. Guia de Mapeamento de Fontes

### 6.1 Do ERP para prices[]

| Campo ERP | Campo JSON | Transformação |
|-----------|------------|---------------|
| Código do Produto | `erp_code` | Direto, manter único |
| Descrição | `description` | Direto, uppercase |
| Fornecedor | `supplier` | Normalizar: ESSILOR/ZEISS/HOYA |
| Preço Compra | `price_purchase_half_pair` | Dividir por 2 se for par |
| Preço Venda | `price_sale_half_pair` | Dividir por 2 se for par |
| Categoria | `lens_category_raw` | Manter original |
| Índice de Refração | `index` | Extrair se não explícito |

### 6.2 Extração de Índice da Descrição

Padrões comuns:
- "... 1.67 ..." → `"1.67"`
- "... MR-10 ..." → `"1.67"`
- "... ORMA ..." → `"1.50"`
- "... POLI ..." → `"1.59"`

### 6.3 Do Catálogo de Fabricante para families[]

| Fonte | Campo JSON |
|-------|------------|
| Nome comercial | `name_original` |
| Linha/Tier | `macro` (mapear) |
| Características | `technology_refs` |
| Benefícios | `attributes_display_base` |

### 6.4 De Fichas Técnicas para specs{}

| Dado Técnico | Campo JSON | Unidade |
|--------------|------------|---------|
| Diâmetro mínimo | `diameter_min_mm` | mm |
| Diâmetro máximo | `diameter_max_mm` | mm |
| Altura mínima | `altura_min_mm` | mm |
| Altura máxima | `altura_max_mm` | mm |
| Esférico de | `sphere_min` | dioptrias |
| Esférico até | `sphere_max` | dioptrias |
| Cilíndrico de | `cyl_min` | dioptrias (negativo) |
| Cilíndrico até | `cyl_max` | dioptrias |
| Adição de | `add_min` | dioptrias |
| Adição até | `add_max` | dioptrias |

---

## 7. Motor de Classificação

O motor de classificação automatiza a vinculação de SKUs a famílias baseado em regras de matching.

### 7.1 Estrutura do Engine

```json
{
  "family_matching_engine": {
    "version": "1.0",
    "fallback_family_id": "GENERICA_VS_BASICO",
    "normalization_rules": [
      { "type": "trim" },
      { "type": "uppercase" },
      { "type": "replace", "pattern": "\\s+", "replacement": " " }
    ],
    "matching_rules": []
  }
}
```

### 7.2 Estrutura de Regra

```json
{
  "id": "rule_unique_id",
  "name": "Nome Descritivo",
  "priority": 10,
  "match_type": "all",
  "conditions": [],
  "target_family_id": "FAMILIA_DESTINO",
  "enabled": true
}
```

### 7.3 Tipos de Condição

| Operador | Descrição | Exemplo |
|----------|-----------|---------|
| `contains` | Contém texto | `"VARILUX COMFORT"` |
| `starts_with` | Inicia com | `"ESS-"` |
| `ends_with` | Termina com | `"-UV"` |
| `equals` | Igual exato | `"ESSILOR"` |
| `regex` | Expressão regular | `"VARILUX.*COMFORT"` |

### 7.4 Campos Disponíveis

| Campo | Descrição |
|-------|-----------|
| `description` | Descrição normalizada do SKU |
| `supplier` | Fornecedor |
| `lens_category_raw` | Categoria bruta |
| `index` | Índice de refração |

### 7.5 Exemplo de Regras

```json
{
  "matching_rules": [
    {
      "id": "varilux_comfort",
      "name": "Varilux Comfort Max",
      "priority": 10,
      "match_type": "all",
      "conditions": [
        { "field": "description", "operator": "contains", "value": "VARILUX COMFORT" },
        { "field": "supplier", "operator": "equals", "value": "ESSILOR" }
      ],
      "target_family_id": "ESSILOR_VARILUX_COMFORT",
      "enabled": true
    },
    {
      "id": "smartlife_plus",
      "name": "SmartLife Plus",
      "priority": 15,
      "match_type": "all",
      "conditions": [
        { "field": "description", "operator": "regex", "value": "SMARTLIFE.*PLUS" }
      ],
      "target_family_id": "ZEISS_SMARTLIFE_PLUS",
      "enabled": true
    }
  ]
}
```

---

## 8. Checklist Final

Antes de submeter o JSON para importação:

### Estrutura
- [ ] `meta.schema_version` = "1.2"
- [ ] Todas as 7 seções obrigatórias presentes
- [ ] `meta.counts` reflete quantidades reais

### Integridade Referencial
- [ ] Todo `families[].macro` existe em `macros[].id`
- [ ] Todo `prices[].family_id` existe em `families[].id`
- [ ] Todo `families[].technology_refs[]` existe em `technology_library.items`

### Preços
- [ ] Todo `prices[].erp_code` é único
- [ ] Valores são por MEIA-PAR
- [ ] Nenhum valor `NaN`, `Infinity` ou `undefined`
- [ ] `price_sale_half_pair` > 0

### Consistência
- [ ] Fornecedores normalizados: ESSILOR, ZEISS, HOYA
- [ ] Índices válidos: 1.50, 1.53, 1.56, 1.59, 1.60, 1.67, 1.74
- [ ] Categorias válidas: PROGRESSIVA, MONOFOCAL, OCUPACIONAL

---

## 📝 Notas de Versão

| Versão | Data | Mudanças |
|--------|------|----------|
| 1.2 | 2026-01-20 | Adição de lentes ocupacionais |
| 1.1 | 2025-12-01 | Technology library e quote explainer |
| 1.0 | 2025-10-15 | Versão inicial |

---

*Documento gerado automaticamente pelo Sistema de Catálogo de Lentes*
*Última atualização: {DATA_ATUAL}*
