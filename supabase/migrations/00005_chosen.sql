-- ---------------------------------------------------------------------------
-- Chosen for the week.
--
-- One nullable timestamp, and deliberately not a table.
--
-- The obvious design is a `daily_features` table that the daily route reads to
-- decide what tonight's puzzle is. That design is wrong here, and the reason is
-- architectural rather than aesthetic: `lib/daily/` is the purest deterministic
-- module in the product, it takes a date and returns a puzzle with no I/O in it
-- anywhere, and the moment being chosen can change what the daily serves, every
-- finish pays for a database read on the way to an answer that used to be
-- arithmetic.
--
-- So being chosen is a STAMP on a dungeon and one curated link. It never
-- expires, because "chosen in August" stops being true and stays worth saying.
--
-- ponytail: if a chosen dungeon ever out-plays the house daily for two weeks
-- running, the upgrade is a `daily_features` table read in the ROUTE HANDLER and
-- never inside lib/daily/.
-- ---------------------------------------------------------------------------

alter table dungeons add column if not exists chosen_at timestamptz;

-- Partial, because the answer is almost always "none of them".
create index if not exists dungeons_chosen_idx
  on dungeons (chosen_at desc)
  where chosen_at is not null;
