-- Tavern Party, contact messages.
--
-- Written only by app/api/contact/route.ts, with the service role. RLS is on and
-- there is deliberately NO policy of any kind, so the anon and authenticated
-- roles cannot select, insert, update or delete a single row. The service role
-- bypasses RLS, so the route works and a browser can do nothing at all with this
-- table. That is the whole security model and it is one line.

create table if not exists contact_messages (
  id bigserial primary key,
  -- All three are optional: a message with no name and no address is still worth
  -- reading, and demanding an email address on a bug report is how you stop
  -- getting bug reports.
  name text,
  email text,
  subject text,
  message text not null,
  -- Set when it has been dealt with, so the inbox has a bottom.
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

-- The only query anyone runs against this: newest unhandled first.
create index if not exists contact_messages_inbox_idx
  on contact_messages (created_at desc)
  where handled_at is null;

alter table contact_messages enable row level security;
