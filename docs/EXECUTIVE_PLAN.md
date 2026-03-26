# json-lens-wizard — Executive Plan

## Objetivo central
Transformar tabelas e catálogos heterogêneos de fornecedores de lentes em uma ferramenta de venda de balcão clara, comparável, visual e comercialmente útil.

## Tese do projeto
O produto não começa no motor de recomendação.
O produto começa em uma base documental confiável, estruturada e comparável.

## Estado atual
### Já construído
- pipeline documental por fornecedor
- extração inicial de Essilor
- extração inicial de Hoya
- extração inicial de Zeiss
- camada canônica inicial de materiais
- camada canônica inicial de tratamentos
- glossário unificado
- tabela inicial comparável de famílias
- tabela inicial de benefícios por família
- pipeline separado de preços

### Fornecedores já incorporados
- Essilor
- Hoya
- Zeiss

## Diagnóstico principal
### O problema real
- catálogos não confiáveis como base direta
- nomes proprietários dificultam comparação
- preço, marketing, tecnologia e disponibilidade vêm misturados
- recomendação sem base confiável gera ruído

### Consequência
Antes de sofisticar recomendação, é preciso consolidar:
1. base documental
2. normalização por fornecedor
3. camada canônica multi-fornecedor
4. comparação comercial utilizável

## Arquitetura recomendada
### Camada 1 — Documental
- PDF fonte
- versão
- origem
- evidência

### Camada 2 — Estruturada por fornecedor
- famílias
- materiais
- tratamentos
- tecnologias
- claims
- sinais comerciais

### Camada 3 — Canônica multi-fornecedor
- materiais padronizados
- tratamentos por função
- famílias por categoria clínica/comercial
- benefícios comparáveis

### Camada 4 — Preço
- pipeline separado
- só entra quando houver chave de combinação confiável

### Camada 5 — Interface comercial
- comparativo por família
- comparativo por tecnologia
- comparativo por material/tratamento
- apoio ao upsell

## Novo requisito central: camada visual comparativa
A interface deve usar comparação visual, não só texto.

### O que precisa existir
- ilustração de campo visual
- comparação de amplitude de visão
- representação visual de tratamentos
- representação visual de fotocromia
- apoio visual para blue/UV
- ilustrações para tecnologias e ganhos percebidos
- visual de diferenciação entre famílias premium / intermediárias / entrada

### Objetivo dessa camada
- acelerar entendimento no balcão
- facilitar argumento comercial
- tornar a comparação intuitiva
- apoiar upsell com clareza
- reduzir dependência de texto técnico

## Prioridades corretas agora
### Prioridade 1
Consolidar a base multi-fornecedor

### Prioridade 2
Fechar os mapas canônicos

### Prioridade 3
Montar primeira estrutura visual comparativa

### Prioridade 4
Só depois evoluir motor de recomendação e lógica de venda assistida

## Próxima sequência prática
1. consolidar Zeiss na camada comparativa
2. atualizar tabelas multi-fornecedor
3. criar mapa canônico inicial da Zeiss
4. criar backlog da interface comparativa visual
5. montar prompt/plano de execução no Lovable

## Regra executiva
Toda próxima evolução do projeto deve informar:
- o que já está sólido
- o que ainda é inferência
- o que depende de revisão
- o que ainda não pode entrar no motor final
