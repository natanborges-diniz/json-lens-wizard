# Price Pipeline

## Objetivo
Separar preços da camada técnica/comercial para evitar contaminar o catálogo principal.

## Regra
Preço deve ser tratado como trilha própria, com vínculo ao documento e à combinação correta.

## Campos mínimos
- supplier
- source_document
- family
- material
- treatment
- filter
- index
- price_value
- currency
- effective_date
- confidence
- notes

## Etapas
1. identificar documento de preço
2. extrair linhas tabulares
3. separar preço por combinação
4. marcar ambiguidade
5. só depois conectar ao catálogo canônico

## Observação
Sem combinação confiável, preço não deve ser usado como verdade comparável.
