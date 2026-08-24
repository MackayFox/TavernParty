-- Tavern Party, initial schema.
--
-- Two halves. `tables` is live game state: one JSONB blob per table with
-- optimistic concurrency on `version`, deleted once nobody is at it. Everything
-- else is the permanent record, and only exists for players who have an account.
--
-- Guests are first-class: they play, they keep streaks in localStorage, and they
-- write nothing here. That is why the whole site works before any of this exists.

-- ---------------------------------------------------------------- live tables

create table if not exists tables (
  code text primary key,
  state jsonb not null,
  version integer not null default 0,
  visibility text not null default 'public',
  phase text not null default 'WAITING',
  players integer not null default 0,
  max_players integer not null default 5,
  name text not null default 'The back room',
  acts integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The lobby browser: public tables still waiting, newest first.
create index if not exists tables_browser_idx
  on tables (updated_at desc)
  where visibility = 'public' and phase = 'WAITING';

-- The reaper: anything untouched for half an hour.
create index if not exists tables_stale_idx on tables (updated_at);

-- Live state is reached only through the service role, never from a browser.
alter table tables enable row level security;

-- ------------------------------------------------------------------- accounts

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

create policy profiles_read_all on profiles for select using (true);

-- ------------------------------------------------------- the permanent record

create table if not exists runs (
  id bigserial primary key,
  code text not null,
  acts integer not null,
  players integer not null,
  dread integer not null default 0,
  finished_at timestamptz not null default now()
);

create table if not exists run_players (
  id bigserial primary key,
  run_id bigint not null references runs (id) on delete cascade,
  user_id uuid references profiles (id) on delete set null,
  name text not null,
  calling_id text,
  blood_id text,
  hook_id text,
  renown integer not null default 0,
  kept_scars integer not null default 0,
  laurels integer not null default 0,
  total integer not null default 0,
  placement integer not null default 1,
  hoard boolean not null default false
);

create index if not exists run_players_user_idx on run_players (user_id);
create index if not exists run_players_run_idx on run_players (run_id);

alter table runs enable row level security;
alter table run_players enable row level security;

create policy runs_read_all on runs for select using (true);
create policy run_players_read_all on run_players for select using (true);

-- --------------------------------------------------------------- daily record

create table if not exists daily_results (
  id bigserial primary key,
  user_id uuid not null references profiles (id) on delete cascade,
  game text not null,
  day date not null,
  score integer not null,
  par integer,
  created_at timestamptz not null default now(),
  unique (user_id, game, day)
);

create index if not exists daily_results_user_idx on daily_results (user_id, game, day desc);

alter table daily_results enable row level security;

create policy daily_results_read_all on daily_results for select using (true);

-- ---------------------------------------------------------------- rate limits

create table if not exists rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null default now()
);

alter table rate_limits enable row level security;

-- Atomic hit-and-count, so two simultaneous requests cannot both pass a limit.
-- search_path is pinned because a SECURITY DEFINER function without it is a
-- privilege-escalation waiting to happen.
create or replace function rate_limit_hit(p_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_start timestamptz;
begin
  insert into rate_limits (key, count, window_start)
    values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then 1
          else rate_limits.count + 1
        end,
        window_start = case
          when rate_limits.window_start < now() - make_interval(secs => p_window_seconds)
            then now()
          else rate_limits.window_start
        end
  returning count, window_start into v_count, v_start;

  return v_count <= p_limit;
end;
$$;

create or replace function rate_limit_gc()
returns void
language sql
security definer
set search_path = public
as $$
  delete from rate_limits where window_start < now() - interval '1 day';
$$;
