# DER do Painel de Entregas — migration + seed fictício

Baseado na proposta de DER da Iota.Hub (27/10/2026), **sem extensões**. Única adaptação: `perfil`/`usuario` não foram criadas, porque o acesso continua com `allowed_users` + Supabase Auth. Os campos de autor viraram `autor_email`/`usuario_email` (FK para `allowed_users.email`).

## Arquivos
- `supabase/migrations/20261127120000_der_painel_frete.sql`: 18 tabelas, enums, constraints, view `vw_regra_efetiva_rua` e RLS via `public.is_allowed_user()`.
- `supabase/seeds/der_ficticio.sql`: dados fictícios (reexecutável: faz `truncate` das tabelas do DER e insere tudo de novo).
- `supabase/seeds/gen_seed.py`: gerador do seed (determinístico). Para mudar volumes ou a história, edite e rode `python3 supabase/seeds/gen_seed.py` a partir da raiz do repo.

## Como aplicar
```bash
npx supabase db push --remote                     # cria as tabelas
psql "$SUPABASE_DB_URL" -f supabase/seeds/der_ficticio.sql   # carrega os dados no remoto
# local: `npx supabase db reset` já roda seed.sql + seeds/*.sql
```
Também dá para colar o seed no SQL Editor do Supabase (são cerca de 450 KB).

Pré-requisitos (já existem na migration de auth): `public.allowed_users` com `email` único e colunas `full_name`, `role` e `active`, e a função `public.is_allowed_user()`. O seed adiciona 3 usuários fictícios **inativos** (`@example.com`) para serem autores das versões.

## O que tem no seed
| Item | Quantidade |
|---|---|
| Estados / cidades / zonas / bairros / ruas | 3 / 3 / 7 / 31 / 348 |
| Clientes / endereços / assinaturas (450 ativas) | 460 / 489 / 524 |
| Pedidos por ciclo (02/11 a 30/11) | 1.508 |
| Publicações v39–v44 / itens / rascunhos / envios | 6 / 23 / 25 / 6 |
| Análises de impacto / assinaturas impactadas | 5 / 210 |
| Sincronizações (carga inicial + diárias às 06:00 + 1 manual) | 32 |

**Geografia:** SP (ativo), RJ (ativo), MG (inativo). São Paulo tem 5 zonas e 21 bairros. Niterói tem 2 regiões e 8 bairros. Guarulhos está inativa.
- Exemplos de cada situação: **Liberado** (Moema, Vila Madalena), **Parcial** (Pinheiros, com 3 ruas inativas), **Fechado** (Butantã, República).
- Ruas com regra própria: Rua Teodoro Sampaio (qua/sex), Rua Cardeal Arcoverde (ter/qui) e uma rua em Moema.

**Histórico de versões:**
- **v39:** configuração inicial (dias por cidade, Vila Madalena e Itaim Bibi).
- **v40:** Pinheiros passa a ter ter/qua/qui/sáb e 3 ruas são inativadas.
- **v41:** primeira tentativa falhou com HTTP 503 (VTEX fora do ar), segunda tentativa OK. Butantã é fechado e a regra antiga de Vila Madalena é encerrada por vigência.
- **v42:** cria as ruas com regra própria.
- **v43:** **ERRO parcial**. São Paulo (Moema) publicou; Niterói falhou por CEPs inválidos no ViaCEP (HTTP 207, detalhes no `response_body`).
- **v44:** `CORRECAO` da v43, em **REVISAO** (é o rascunho atual). Reenvia Icaraí e Santa Rosa, muda Pinheiros para ter/qui/sáb, reativa a Rua Lisboa e o Butantã. São 95 assinaturas impactadas, 52 com aviso pendente.

**Sincronizações:** a automática de 20/11 falhou (timeout da VTEX). A última, de hoje às 06:00, está OK.

Convenção: `dia_semana` ISO (1 = segunda … 7 = domingo). Data de referência: 27/11/2026. A view usa `current_date`, então regras com vigência futura só passam a valer na data.
