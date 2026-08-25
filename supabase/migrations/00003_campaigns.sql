-- ---------------------------------------------------------------------------
-- The campaign builder.
--
-- Two tables and no more. `dungeons` is the thing with a link, `pool_rooms` is
-- the shared shelf that makes the first publish a pick rather than an evening's
-- writing. Everything about a dungeon that a page needs lives on its row,
-- including its frozen report, so a browse card never pays for a solve.
--
-- RLS on both, and the policies are deliberately narrow: the service role does
-- every write through a route that has already run the gate. There is no path
-- from the anon key to an INSERT, because the gate is the product and a row that
-- got in around it would be a dungeon nobody checked.
-- ---------------------------------------------------------------------------

create table if not exists dungeons (
  code           text primary key,
  -- Who owns it: an account uuid, or a signed guest cookie id. NOT the display
  -- name, and not author_id, because author_id is a foreign key into auth.users
  -- and a guest has no row there. Ownership compared against a display name meant
  -- a guest could open a draft and never edit it.
  owner_key      text not null,
  -- Null for a guest. A guest may write and share; only an account may list.
  author_id      uuid references auth.users (id) on delete set null,
  author_name    text not null,
  title          text not null default '',
  intro          text not null default '',
  -- The rooms, in order. Validated against the gate before anything is written.
  rooms          jsonb not null default '[]'::jsonb,
  calling_ids    text[] not null default '{}',
  kit_ids        text[] not null default '{}',
  base_vigour    integer not null default 9,
  visibility     text not null default 'unlisted'
                   check (visibility in ('unlisted', 'submitted', 'listed', 'banned')),
  -- Null until it has passed the gate once. Frozen at publish: par cannot change
  -- for a dungeon whose dice are pinned to its code, so recomputing it on a cold
  -- instance would burn a search for a number that is already known.
  par            integer,
  difficulty     text,
  report         jsonb,
  published_at   timestamptz,
  plays          integer not null default 0,
  finishes       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- The Hall, newest first. Partial, because only listed rows are ever browsed.
create index if not exists dungeons_listed_idx
  on dungeons (published_at desc)
  where visibility = 'listed';

-- An author's own desk.
create index if not exists dungeons_owner_idx on dungeons (owner_key, updated_at desc);

alter table dungeons enable row level security;

-- Anybody may read a dungeon they have the code for, or one that is listed. A
-- banned row stays readable so its author can see what happened to it; nothing
-- links to it.
create policy dungeons_read on dungeons for select using (true);

create table if not exists pool_rooms (
  id           text primary key,
  author_id    uuid references auth.users (id) on delete set null,
  author_name  text not null,
  room         jsonb not null,
  -- Defaulted on, and stated at the top of the form rather than buried. Handing
  -- somebody's room to a stranger with no opt-out would annoy exactly the people
  -- this feature is courting.
  shared       boolean not null default true,
  pickups      integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists pool_rooms_shared_idx
  on pool_rooms (created_at desc)
  where shared = true;

alter table pool_rooms enable row level security;
create policy pool_rooms_read on pool_rooms for select using (true);

-- ---------------------------------------------------------------------------
-- Counters. Incremented from the play route, which is the one place that knows
-- a run actually finished, and done in the database so two instances cannot
-- read-modify-write over each other.
-- ---------------------------------------------------------------------------

create or replace function dungeon_played(p_code text, p_finished boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update dungeons
     set plays = plays + 1,
         finishes = finishes + case when p_finished then 1 else 0 end
   where code = p_code;
$$;

create or replace function pool_room_picked(p_ids text[])
returns void
language sql
security definer
set search_path = public
as $$
  update pool_rooms set pickups = pickups + 1 where id = any(p_ids);
$$;
