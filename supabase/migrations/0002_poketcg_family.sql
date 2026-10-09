-- 0002_poketcg_family.sql
-- Dois jogadores (ex.: Papai e filho), um PIN da família e trocas de cartas.
--
-- Isolado num projeto compartilhado: tudo tem prefixo poketcg_, as tabelas têm RLS sem
-- nenhuma policy (ninguém lê/escreve direto) e o app só usa as funções abaixo, que exigem
-- o PIN. Não depende de Supabase Auth.

create extension if not exists pgcrypto with schema extensions;

-- ── Tabelas ──────────────────────────────────────────────────────────────────

create table if not exists public.poketcg_family (
  id              int primary key default 1 check (id = 1),
  pin_hash        text not null,
  failed_attempts int not null default 0,
  last_failed_at  timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists public.poketcg_players (
  id    text primary key check (id in ('p1', 'p2')),
  name  text not null check (char_length(name) between 1 and 24)
);

create table if not exists public.poketcg_collections (
  player_id  text primary key references public.poketcg_players on delete cascade,
  data       jsonb not null default '{"schemaVersion":2,"entries":{},"bySet":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.poketcg_trades (
  id          bigint generated always as identity primary key,
  from_player text not null references public.poketcg_players,
  to_player   text not null references public.poketcg_players,
  offer       text[] not null default '{}',
  request     text[] not null default '{}',
  status      text not null default 'pending'
              check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'failed')),
  note        text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  check (from_player <> to_player),
  check (cardinality(offer) + cardinality(request) > 0)
);

create index if not exists poketcg_trades_status_idx on public.poketcg_trades (status, created_at desc);

alter table public.poketcg_family      enable row level security;
alter table public.poketcg_players     enable row level security;
alter table public.poketcg_collections enable row level security;
alter table public.poketcg_trades      enable row level security;

-- ── Auxiliares (não expostas) ────────────────────────────────────────────────

-- Confere o PIN e devolve a mensagem de erro (null se ok). Não levanta exceção: assim o
-- contador de erros é gravado. Depois de 10 erros seguidos, trava por 15 minutos.
create or replace function public.poketcg_pin_error(p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  fam public.poketcg_family;
begin
  select * into fam from public.poketcg_family where id = 1 for update;
  if not found then
    return 'família ainda não configurada';
  end if;
  if fam.failed_attempts >= 10 and fam.last_failed_at > now() - interval '15 minutes' then
    return 'muitas tentativas, espere 15 minutos';
  end if;
  if fam.pin_hash <> extensions.crypt(coalesce(p_pin, ''), fam.pin_hash) then
    update public.poketcg_family
       set failed_attempts = failed_attempts + 1, last_failed_at = now()
     where id = 1;
    return 'PIN errado';
  end if;
  if fam.failed_attempts > 0 then
    update public.poketcg_family set failed_attempts = 0 where id = 1;
  end if;
  return null;
end;
$$;

create or replace function public.poketcg_assert_player(p_player text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.poketcg_players where id = p_player) then
    raise exception 'poketcg: jogador desconhecido' using errcode = 'P0001';
  end if;
end;
$$;

-- Soma `delta` cópias de cada id (ids podem repetir) na coleção do jogador; falha se
-- alguma contagem ficaria negativa.
create or replace function public.poketcg_apply(p_player text, p_ids text[], p_delta int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entries jsonb;
  id text;
  n int;
begin
  select data -> 'entries' into entries
    from public.poketcg_collections where player_id = p_player for update;
  entries := coalesce(entries, '{}'::jsonb);
  foreach id in array coalesce(p_ids, '{}') loop
    n := coalesce((entries ->> id)::int, 0) + p_delta;
    if n < 0 then
      raise exception 'poketcg: carta % não está mais no fichário', id using errcode = 'P0001';
    elsif n = 0 then
      entries := entries - id;
    else
      entries := jsonb_set(entries, array[id], to_jsonb(n));
    end if;
  end loop;
  update public.poketcg_collections
     set data = jsonb_set(data, '{entries}', entries), updated_at = now()
   where player_id = p_player;
end;
$$;

-- ── API pública (anon) ───────────────────────────────────────────────────────

-- Sem PIN: só diz se já existe família e os nomes, para a tela "Quem está jogando?".
create or replace function public.poketcg_status()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'configured', exists (select 1 from public.poketcg_family),
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by id)
                           from public.poketcg_players), '[]'::jsonb)
  );
$$;

-- Primeira configuração: só funciona enquanto não há família.
create or replace function public.poketcg_setup(p_pin text, p_name1 text, p_name2 text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'poketcg: o PIN precisa ter de 4 a 8 números' using errcode = 'P0001';
  end if;
  insert into public.poketcg_family (id, pin_hash)
  values (1, extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (id) do nothing;
  if not found then
    raise exception 'poketcg: família já configurada' using errcode = 'P0001';
  end if;
  insert into public.poketcg_players (id, name) values ('p1', trim(p_name1)), ('p2', trim(p_name2));
  insert into public.poketcg_collections (player_id) values ('p1'), ('p2');
end;
$$;

create or replace function public.poketcg_check_pin(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  err text;
begin
  err := public.poketcg_pin_error(p_pin);
  if err is not null then
    return jsonb_build_object('error', err);
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Coleção de um jogador (a própria ou a do outro, para escolher o que pedir na troca).
create or replace function public.poketcg_load(p_pin text, p_player text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  err text;
begin
  err := public.poketcg_pin_error(p_pin);
  if err is not null then
    return jsonb_build_object('error', err);
  end if;
  perform public.poketcg_assert_player(p_player);
  return (select data from public.poketcg_collections where player_id = p_player);
end;
$$;

-- Guarda as cartas de um pacote aberto e conta o pacote no set.
create or replace function public.poketcg_add_cards(p_pin text, p_player text, p_ids text[], p_set text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  err text;
  stats jsonb;
begin
  err := public.poketcg_pin_error(p_pin);
  if err is not null then
    return jsonb_build_object('error', err);
  end if;
  perform public.poketcg_assert_player(p_player);
  if cardinality(p_ids) > 20 then
    raise exception 'poketcg: pacote grande demais' using errcode = 'P0001';
  end if;
  perform public.poketcg_apply(p_player, p_ids, 1);
  select coalesce(data -> 'bySet' -> p_set, '{"boostersOpened":0,"cardsOpened":0}'::jsonb)
    into stats from public.poketcg_collections where player_id = p_player;
  update public.poketcg_collections
     set data = jsonb_set(
           jsonb_set(data, '{bySet}', coalesce(data -> 'bySet', '{}'::jsonb)),
           array['bySet', p_set],
           jsonb_build_object(
             'boostersOpened', (stats ->> 'boostersOpened')::int + 1,
             'cardsOpened', (stats ->> 'cardsOpened')::int + cardinality(p_ids)))
   where player_id = p_player;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.poketcg_clear(p_pin text, p_player text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  err text;
begin
  err := public.poketcg_pin_error(p_pin);
  if err is not null then
    return jsonb_build_object('error', err);
  end if;
  perform public.poketcg_assert_player(p_player);
  update public.poketcg_collections
     set data = '{"schemaVersion":2,"entries":{},"bySet":{}}'::jsonb, updated_at = now()
   where player_id = p_player;
  return jsonb_build_object('ok', true);
end;
$$;

-- Propõe uma troca: `p_offer` sai do fichário de quem propõe, `p_request` do outro.
create or replace function public.poketcg_propose(p_pin text, p_from text, p_offer text[], p_request text[])
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  err text;
  other text;
  new_id bigint;
begin
  err := public.poketcg_pin_error(p_pin);
  if err is not null then
    return jsonb_build_object('error', err);
  end if;
  perform public.poketcg_assert_player(p_from);
  select id into other from public.poketcg_players where id <> p_from;
  if cardinality(p_offer) + cardinality(p_request) = 0 then
    raise exception 'poketcg: escolha ao menos uma carta' using errcode = 'P0001';
  end if;
  if cardinality(p_offer) > 60 or cardinality(p_request) > 60 then
    raise exception 'poketcg: cartas demais numa troca' using errcode = 'P0001';
  end if;
  insert into public.poketcg_trades (from_player, to_player, offer, request)
  values (p_from, other, coalesce(p_offer, '{}'), coalesce(p_request, '{}'))
  returning id into new_id;
  return jsonb_build_object('id', new_id);
end;
$$;

-- Trocas pendentes e as 20 mais recentes resolvidas.
create or replace function public.poketcg_trades_list(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  err text;
begin
  err := public.poketcg_pin_error(p_pin);
  if err is not null then
    return jsonb_build_object('error', err);
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(t) order by t.status <> 'pending', t.created_at desc)
      from (
        (select * from public.poketcg_trades where status = 'pending')
        union all
        (select * from public.poketcg_trades where status <> 'pending'
          order by resolved_at desc nulls last limit 20)
      ) t
  ), '[]'::jsonb);
end;
$$;

-- Quem recebeu aceita ou recusa. Aceitar move tudo de uma vez ou nada (se alguém não
-- tem mais alguma carta, a troca falha e nada muda).
create or replace function public.poketcg_respond(p_pin text, p_player text, p_trade bigint, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  err text;
  t public.poketcg_trades;
begin
  err := public.poketcg_pin_error(p_pin);
  if err is not null then
    return jsonb_build_object('error', err);
  end if;
  select * into t from public.poketcg_trades where id = p_trade for update;
  if not found or t.status <> 'pending' then
    raise exception 'poketcg: essa troca não está mais pendente' using errcode = 'P0001';
  end if;
  if t.to_player <> p_player then
    raise exception 'poketcg: só quem recebeu pode responder' using errcode = 'P0001';
  end if;
  if not p_accept then
    update public.poketcg_trades set status = 'rejected', resolved_at = now() where id = p_trade;
    return jsonb_build_object('status', 'rejected');
  end if;
  begin
    -- Trava as duas coleções sempre na mesma ordem (p1, p2) para não dar deadlock.
    perform 1 from public.poketcg_collections order by player_id for update;
    perform public.poketcg_apply(t.from_player, t.offer, -1);
    perform public.poketcg_apply(t.to_player, t.request, -1);
    perform public.poketcg_apply(t.to_player, t.offer, 1);
    perform public.poketcg_apply(t.from_player, t.request, 1);
  exception when sqlstate 'P0001' then
    update public.poketcg_trades
       set status = 'failed', note = sqlerrm, resolved_at = now() where id = p_trade;
    return jsonb_build_object('status', 'failed', 'note', sqlerrm);
  end;
  update public.poketcg_trades set status = 'accepted', resolved_at = now() where id = p_trade;
  return jsonb_build_object('status', 'accepted');
end;
$$;

create or replace function public.poketcg_cancel(p_pin text, p_player text, p_trade bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  err text;
begin
  err := public.poketcg_pin_error(p_pin);
  if err is not null then
    return jsonb_build_object('error', err);
  end if;
  update public.poketcg_trades
     set status = 'cancelled', resolved_at = now()
   where id = p_trade and from_player = p_player and status = 'pending';
  if not found then
    raise exception 'poketcg: essa troca não está mais pendente' using errcode = 'P0001';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── Permissões ───────────────────────────────────────────────────────────────

revoke all on public.poketcg_family, public.poketcg_players, public.poketcg_collections,
  public.poketcg_trades from anon, authenticated;

revoke execute on function
  public.poketcg_pin_error(text), public.poketcg_assert_player(text),
  public.poketcg_apply(text, text[], int)
  from public, anon, authenticated;

revoke execute on function
  public.poketcg_status(), public.poketcg_setup(text, text, text), public.poketcg_check_pin(text),
  public.poketcg_load(text, text), public.poketcg_add_cards(text, text, text[], text),
  public.poketcg_clear(text, text), public.poketcg_propose(text, text, text[], text[]),
  public.poketcg_trades_list(text), public.poketcg_respond(text, text, bigint, boolean),
  public.poketcg_cancel(text, text, bigint)
  from public;

grant execute on function
  public.poketcg_status(), public.poketcg_setup(text, text, text), public.poketcg_check_pin(text),
  public.poketcg_load(text, text), public.poketcg_add_cards(text, text, text[], text),
  public.poketcg_clear(text, text), public.poketcg_propose(text, text, text[], text[]),
  public.poketcg_trades_list(text), public.poketcg_respond(text, text, bigint, boolean),
  public.poketcg_cancel(text, text, bigint)
  to anon, authenticated;
