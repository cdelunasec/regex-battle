-- Realtime.
--
-- The client subscribes to Postgres Changes on `rooms` and `rounds` instead of
-- listening to broadcast messages. The difference matters for anti-cheat: row
-- changes are emitted by Postgres itself and filtered through the same RLS
-- policies, so a player cannot forge a hit or a match_over by pushing a
-- message into the channel. The events the spec describes are derived on the
-- client by diffing the room state it already receives.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rooms'
  ) then
    alter publication supabase_realtime add table public.rooms;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rounds'
  ) then
    alter publication supabase_realtime add table public.rounds;
  end if;
end
$$;

-- Sending the old row along with the new one lets the client tell exactly how
-- much HP moved, even if it missed the previous update.
alter table public.rooms replica identity full;