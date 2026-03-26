# Extraction Strategy

## Nova direção validada
Antes de confiar no motor de recomendação, precisamos construir uma base documental confiável dos fornecedores.

## Objetivo
Pegar os documentos dos fornecedores, salvar em base organizada e destrinchar todas as informações úteis para criar um catálogo confiável e comercialmente utilizável.

## Fluxo recomendado
1. reunir documentos por fornecedor
2. armazenar em base organizada
3. extrair dados brutos
4. estruturar em schema canônico
5. marcar nível de confiança por campo
6. revisar inconsistências
7. só então alimentar classificação comercial e recomendação

## O que extrair
- fornecedor
- linha/família
- material
- índice
- tratamentos
- filtros
- benefícios declarados
- limitações
- público sugerido
- posicionamento de preço
- argumentos comerciais
- observações técnicas
- origem do dado
- confiança da extração

## Regras
- não inventar informação ausente
- separar dado explícito de inferência
- manter referência ao documento de origem
- registrar conflito entre fontes
- tratar catálogo como sistema de evidência, não só lista de SKUs

## Próximo passo
Receber os documentos dos fornecedores e iniciar a base documental.
