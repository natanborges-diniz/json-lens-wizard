# Essilor Ago 2025 — Extração Inicial

## Documento
- arquivo: `essilor-ago-2025.pdf`
- fornecedor: Essilor
- status: extração inicial concluída

## Leitura executiva
O documento é rico, mas heterogêneo. Ele mistura:
- linhas de produto
- materiais e índices
- tratamentos
- tecnologias
- argumentos comerciais
- tabelas de preço
- disponibilidade por combinação
- promoções e notas operacionais

Isso confirma que o catálogo precisa ser tratado como **sistema documental versionado**, não apenas como lista de SKUs.

## Estruturas principais identificadas
### Linhas / famílias
- Varilux XR Pro
- Varilux XR Track
- Varilux XR Design
- Varilux Physio Extensee
- Varilux Comfort / Liberty / Digitime / Roadpilot / Sport / Activities
- Eyezen Boost / Start / Kids
- Kodak Unique / Precise / Single / City
- Stellest / Stellest Sun
- Transitions Gen S
- Crizal Sapphire HR / Rock / EasyPro / Prevencia

### Materiais / índices
- Orma 1.50
- Airwear Poly
- Stylis 1.67
- Stylis 1.74

### Camadas de dado presentes
1. produto
2. material
3. tratamento
4. filtro/fotocromático
5. tecnologia
6. preço
7. disponibilidade
8. benefício declarado
9. limitação/nota
10. promoção

## Riscos identificados
- nomenclatura inconsistente entre famílias e versões
- preços em matriz complexa
- disponibilidade dependente de combinações
- abreviações e símbolos exigem legenda própria
- claims promocionais não podem ser tratados como dado técnico bruto sem contexto
- OCR de tabelas e ícones pode falhar

## Tese confirmada
Antes de confiar no catálogo final, precisamos de pipeline assim:
1. documento bruto
2. extração por evidência
3. estrutura canônica
4. revisão de conflito
5. normalização
6. só então catálogo operacional

## Próximos passos recomendados
1. criar base de extração por fornecedor
2. quebrar o documento em entidades repetíveis
3. capturar preços separadamente de claims e tecnologias
4. criar glossário de siglas, símbolos e tecnologias da Essilor
5. revisar com foco em confiabilidade antes de alimentar o motor
