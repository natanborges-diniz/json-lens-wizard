# Multi-Supplier Schema

## Objetivo
Definir o schema canônico inicial para comparar fornecedores de lentes com confiabilidade.

## Princípio central
Cada fornecedor deve manter:
1. nome original do fornecedor
2. valor canônico normalizado
3. nível de confiança
4. origem documental
5. observações de conflito ou inferência

## Campos canônicos obrigatórios
### Identificação
- supplier_name
- source_document
- source_version
- extraction_status

### Produto
- original_family_name
- canonical_brand
- canonical_product_family
- category_clinical
- category_commercial
- intended_use

### Técnica
- original_material_name
- canonical_material_name
- refractive_index
- original_treatment_name
- canonical_treatment_type
- original_filter_name
- canonical_filter_type
- technologies

### Comercial
- benefits_explicit
- limitations_explicit
- commercial_positioning
- price_signal
- upsell_signal
- target_customer_profile

### Governança
- extraction_confidence
- explicit_vs_inferred
- source_page_or_section
- conflict_notes
- review_status

## Regras
- não apagar o nome original do fornecedor
- não forçar equivalência quando a confiança for baixa
- todo campo inferido deve ser marcado
- preços e disponibilidade ficam em camada separada até haver extração consistente
