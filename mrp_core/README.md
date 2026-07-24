# MRP I Core

Este pacote traduz a planilha `22.07.26 - Planejamento Mestre.xlsx` para regras digitais.

Fluxo implementado:

1. `LEADTIME`: PN e tempos em dias uteis. O motor converte para dias corridos e semanas de compra.
2. `PREVISAO MRP II`: no app, passa a vir do resultado calculado no MRP II, usando a data final real projetada da O.S.
3. `ESTOQUE ATUAL`: saldo livre, empenhado e disponivel. Hoje pode vir de upload; depois entra pelo ModuloEstoque/Supabase.
4. `COMPRAS`: pedidos ativos em transito, agrupados por PN e semana de entrega. Status concluidos/cancelados nao entram.
5. `NECESSIDADE`: consumo por PN. Quando ha vinculo com O.S, a semana vem do MRP II; quando nao ha, cai na semana atual.
6. `ANALISE`: projeta estoque por semana e gera sugestao de compra antecipada pelo lead time.

Variaveis esperadas para a integracao online:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MODULO_ESTOQUE_URL`
- `MODULO_SUPRIMENTOS_URL`

O pacote nao depende do frontend. Isso permite subir uma API Python no Render e usar as mesmas funcoes no painel web.
