# Plan – Integrações

## Diagnóstico de Dívidas Técnicas

### CRÍTICO

| # | Item | Evidência |
|---|------|-----------|
| I1 | **Trigger `handle_new_user` sem trigger associado** | Função existe mas sem `CREATE TRIGGER` vinculado a `auth.users`. Signup pode não criar profile/role. |

### IMPORTANTE

| # | Item | Evidência |
|---|------|-----------|
| I2 | **Arquitetura Cloud-Only com fallback local morto** | `AdminDashboard` referencia `/data/lenses.json` como fallback, arquivo inexistente. Código morto que pode confundir manutenção. |
| I3 | **Edge functions usam modelo legado no label** | `generate-budget-text` referencia "Premium" no mapa de tiers, desalinhado com o padrão "Top" do frontend. |
| I4 | **Supabase Storage bucket `catalogs` é público** | Catálogo inteiro acessível sem autenticação. Pode expor dados comerciais (preços, margens) a concorrentes. |

### DESEJÁVEL

| # | Item | Evidência |
|---|------|-----------|
| I5 | **Sem webhook ou notificação de importação de catálogo** | Importação é silenciosa. Outros admins não são notificados quando o catálogo muda. |
| I6 | **WhatsApp sharing é via URL scheme, sem API oficial** | Envio de orçamento usa `wa.me` link. Sem rastreamento de entrega ou leitura. |
