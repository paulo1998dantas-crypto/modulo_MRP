# MRP JI Montadora

MRP I e MRP II para planejamento de materiais, capacidade e cenários da JI Montadora.

## Acesso

O MRP usa a mesma base de usuários do ERP. Somente usuários ativos que possuam o papel `PCP` ou `ADMIN` podem entrar. A validação ocorre no servidor e os dados operacionais não são enviados ao navegador antes da autenticação.

## Fontes de dados

- Estoque disponível e movimentações: módulo Estoque.
- Pedidos de compra em trânsito: módulo Suprimentos.
- Necessidades e B.O.M.: Cadastro e O.S. abertas.
- WIP, sequência e etapas: MES.
- Cenários simulados: armazenamento local do navegador; eles não criam O.S., pedidos, empenhos ou movimentações.

O MRP é de leitura operacional: ele não altera saldo, pedido de compra, O.S., B.O.M. nem apontamento produtivo.

## Execução local

1. Copie `.env.example` para `.env.local`.
2. Preencha `SUPABASE_URL`, uma chave de serviço do Supabase e `MRP_SESSION_SECRET` com valor aleatório de pelo menos 32 caracteres.
3. Execute `npm install` e `npm run dev`.

Em um teste local de build de produção por HTTP, use temporariamente `MRP_SESSION_COOKIE_SECURE=0`. Não leve essa variável ao Render.

Para gerar o executável Windows já existente, use `pnpm run desktop:build`.

## Render

O arquivo `render.yaml` descreve o Web Service. Configure somente no ambiente do serviço:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MRP_SESSION_SECRET`

Nunca adicione chaves reais ao repositório. O serviço deve ser publicado no plano `free`, salvo mudança explícita de plano pela JI Montadora.

## Validação recomendada

1. Usuário PCP entra e consulta MRP I e MRP II.
2. Usuário ADMIN entra e consulta os mesmos dados.
3. Usuário sem PCP/ADMIN recebe bloqueio de acesso.
4. Sem sessão, `/api/mrp-i` e `/api/wip` respondem `401`.
5. Após encerrar a sessão, os endpoints permanecem bloqueados.
