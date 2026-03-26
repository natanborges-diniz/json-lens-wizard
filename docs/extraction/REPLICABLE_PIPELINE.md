# Replicable Supplier Pipeline

## Objetivo
Criar um pipeline replicável para transformar documentos de fornecedores em base confiável.

## Etapas
### Etapa 1 — Ingestão
- receber documento
- salvar em `docs/suppliers/`
- registrar fornecedor, versão e data

### Etapa 2 — Extração narrativa
- ler documento
- identificar entidades principais
- mapear riscos, conflitos e estrutura repetitiva

### Etapa 3 — Estruturação inicial
- criar JSON inicial por fornecedor em `data/suppliers/`
- separar famílias, materiais, tratamentos, filtros, tecnologias, claims e sinais comerciais

### Etapa 4 — Glossário
- criar glossário de siglas, tecnologias, símbolos e termos próprios do fornecedor

### Etapa 5 — Normalização canônica
- transformar entidades para schema comum em `data/normalized/`
- marcar confiança e pendências

### Etapa 6 — Revisão
- revisar conflitos
- separar dado explícito de inferência
- autorizar uso em catálogo apenas após revisão

## Saída mínima por fornecedor
- PDF/documento salvo
- extração narrativa
- JSON estruturado inicial
- glossário
- base canônica inicial

## Regra principal
Nenhum fornecedor entra como catálogo operacional sem passar por esse pipeline.
