-- ---------------------------------------------------------------------------
-- The Hall: playing somebody else's, saying it was good, and a person deciding
-- what goes on the shelf out front.
--
-- Two tables. `dungeon_runs` is what actually happened, which is the honest half
-- of a rating and the half nobody can fake. `dungeon_marks` is somebody saying
-- it was worth their time, which is the half that needs guarding.
--
-- A mark REQUIRES a finished run, enforced by a foreign key rather than by a
-- check in a route: you cannot say a dungeon was good if you never got to the
-- bottom of it, and the database is the only place that rule cannot be gone
-- around.
-- ---------------------------------------------------------------------------

create table if not exists dungeon_runs (
  id           bigserial primary key,
  code         text not null references dungeons (code) on delete cascade,
  -- An account uuid or a signed guest id. Same shape as dungeons.owner_key.
  player_key   text not null,
  score        integer not null,
  par          integer not null,
  -- Reached the bottom and came back up. The thing a mark hangs off.
  finished     boolean not null default false,
  depth        integer not null default 0,
  -- Which floor stopped them, so an author can see where their dungeon bites.
  -- Null when they got out.
  stopped_on   integer,
  created_at   timestamptz not null default now(),
  -- One recorded run per person per dungeon: the FIRST one, because that is the
  -- one played blind and the only one comparable to anybody else's.
  unique (code, player_key)
);

create index if not exists dungeon_runs_code_idx on dungeon_runs (code);

alter table dungeon_runs enable row level security;
create policy dungeon_runs_read on dungeon_runs for select using (true);

create table if not exists dungeon_marks (
  code         text not null references dungeons (code) on delete cascade,
  player_key   text not null,
  created_at   timestamptz not null default now(),
  primary key (code, player_key),
  -- The rule, in the schema: a mark is only possible where a finished run is.
  foreign key (code, player_key)
    references dungeon_runs (code, player_key) on delete cascade
);

create index if not exists dungeon_marks_code_idx on dungeon_marks (code);

alter table dungeon_marks enable row level security;
create policy dungeon_marks_read on dungeon_marks for select using (true);

-- ---------------------------------------------------------------------------
-- Ranking.
--
-- Wilson lower bound on marks per FINISHER, not marks per play and not a raw
-- count. Three reasons, in order of how badly the alternative fails:
--
--   * Marks per play punishes a hard dungeon for being hard, because everybody
--     who died counts against it. Marks per finisher asks the only people
--     qualified to answer.
--   * A raw count is a popularity ratchet: the first dungeon to get seen wins
--     forever, and nothing new can ever reach the top.
--   * A plain average lets one mark out of one finisher sit above forty out of
--     fifty. The lower bound of the interval is what stops that, and it is why
--     this is a Wilson score rather than a division.
--
-- Floored at MIN_FINISHERS so a brand new dungeon cannot top the Hall on a
-- single friendly vote. Below the floor it is still listed, under New.
-- ---------------------------------------------------------------------------

create or replace function dungeon_standing(p_code text)
returns table (finishers integer, marks integer, wilson double precision)
language sql
stable
security definer
set search_path = public
as $$
  with counts as (
    select
      (select count(*) from dungeon_runs r where r.code = p_code and r.finished)::integer as f,
      (select count(*) from dungeon_marks m where m.code = p_code)::integer as m
  )
  select
    f,
    m,
    case when f = 0 then 0::double precision
    else
      -- Wilson lower bound, z = 1.96.
      ((m::double precision / f) + 1.9208 / (2 * f)
        - 1.96 * sqrt(((m::double precision / f) * (1 - m::double precision / f) + 0.9604 / (4 * f)) / f))
      / (1 + 3.8416 / f)
    end
  from counts;
$$;
