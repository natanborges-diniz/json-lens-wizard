# Supplier Extraction Schema

## Entidade base
Cada registro extraído deve conter, quando disponível:

- supplier_name
- source_document
- source_page_or_section
- product_family
- product_line
- sku_or_code
- lens_type
- material
- refractive_index
- coating
- treatment
- filter
- color_or_photochromic
- category_clinical
- benefits_explicit
- limitations_explicit
- recommended_use_cases
- contraindications_or_cautions
- commercial_positioning
- price_signal
- upsell_signal
- technical_notes
- extraction_confidence
- extraction_notes
- normalized_status

## Regra
Campos ausentes devem permanecer ausentes. Não preencher por suposição sem marcar inferência.
