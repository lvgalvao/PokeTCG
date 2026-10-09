# Supabase

Fichário da família (dois jogadores) e trocas de cartas entre eles.

## Onde está

Projeto **dashboard-jornada** (`urihhfginoiakripiaha`), compartilhado com outras coisas.
Tudo do jogo tem prefixo `poketcg_` e fica isolado:

- As tabelas (`poketcg_family`, `poketcg_players`, `poketcg_collections`, `poketcg_trades`)
  têm RLS ligado e **nenhuma** policy: ninguém lê nem escreve direto nelas.
- O app só chama as funções `poketcg_*` (RPC), e todas, menos `poketcg_status` e
  `poketcg_setup`, exigem o PIN da família. Depois de 10 PINs errados seguidos, trava 15 min.
- Não usa Supabase Auth; nada da configuração de login do projeto foi mexido.

O linter do Supabase avisa que as funções `poketcg_*` são `SECURITY DEFINER` executáveis
por `anon`: é intencional (é a API do jogo, protegida pelo PIN).

## Migrações

- `migrations/0002_poketcg_family.sql` — a que está aplicada (tabelas, funções e permissões).
- `migrations/0001_init.sql` — modelo antigo (um usuário anônimo por aparelho); não é mais usado.

## App

`.env.local` na raiz do repositório (fora do git):

```
VITE_SUPABASE_URL=https://urihhfginoiakripiaha.supabase.co
VITE_SUPABASE_ANON_KEY=<chave publishable do projeto>
```

Na primeira vez, o app pede o nome dos dois jogadores e cria o PIN. Em cada aparelho,
depois, é só escolher quem está jogando e digitar o PIN uma vez.

## Recomeçar do zero

No SQL editor (apaga a família, os fichários e as trocas):

```sql
delete from public.poketcg_trades;
delete from public.poketcg_collections;
delete from public.poketcg_players;
delete from public.poketcg_family;
```
