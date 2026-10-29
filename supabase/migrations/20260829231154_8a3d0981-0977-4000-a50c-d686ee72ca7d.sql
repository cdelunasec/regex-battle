-- Row level security.
--
-- The rule of the game is that the client never writes anything that decides a
-- match. Rooms, rounds and submissions are read-only from the browser, and the
-- only way to change them is through the security definer functions in
-- 0003_rpc.sql or through the edge function running as service_role.
--
-- service_role bypasses RLS entirely, which is exactly why it never leaves the
-- server.

alter table public.problems    enable row level security;
alter table public.rooms       enable row level security;
alter table public.rounds      enable row level security;
alter table public.submissions enable row level security;
alter table public.solo_runs   enable row level security;

-- ---------------------------------------------------------------------------
-- problems
-- ---------------------------------------------------------------------------
-- The test lists are visible on purpose: they are the hints of the challenge,
-- the same way regexcrossword shows you the grid.
drop policy if exists "problems are readable by signed in players" on public.problems;
create policy "problems are readable by signed in players"
  on public.problems
  for select
  to authenticated
  using (is_active);

-- No insert, update or delete policy. Content is managed by migrations.

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
-- Only the two players in the room can read it. There is deliberately no
-- policy that exposes waiting rooms, otherwise anyone could list the open
-- codes and jump into a stranger's match. Joining goes through join_room().
drop policy if exists "players read their own rooms" on public.rooms;
create policy "players read their own rooms"
  on public.rooms
  for select
  to authenticated
  using (auth.uid() = host_id or auth.uid() = guest_id);

-- No write policies at all. HP, status and the current challenge are decided
-- by the server.

-- ---------------------------------------------------------------------------
-- rounds
-- ---------------------------------------------------------------------------
drop policy if exists "players read the rounds of their rooms" on public.rounds;
create policy "players read the rounds of their rooms"
  on public.rounds
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.rooms as room
      where room.id = rounds.room_id
        and (auth.uid() = room.host_id or auth.uid() = room.guest_id)
    )
  );

-- ---------------------------------------------------------------------------
-- submissions
-- ---------------------------------------------------------------------------
-- A player can review their own attempts, and nobody can write one from the
-- browser, because `passed` is the field that hands out damage.
drop policy if exists "players read their own submissions" on public.submissions;
create policy "players read their own submissions"
  on public.submissions
  for select
  to authenticated
  using (auth.uid() = player_id);

-- ---------------------------------------------------------------------------
-- solo_runs
-- ---------------------------------------------------------------------------
-- Practice mode has no opponent to cheat, so the client owns its own rows.
drop policy if exists "players read their own solo runs" on public.solo_runs;
create policy "players read their own solo runs"
  on public.solo_runs
  for select
  to authenticated
  using (auth.uid() = player_id);

drop policy if exists "players create their own solo runs" on public.solo_runs;
create policy "players create their own solo runs"
  on public.solo_runs
  for insert
  to authenticated
  with check (auth.uid() = player_id);

drop policy if exists "players update their own solo runs" on public.solo_runs;
create policy "players update their own solo runs"
  on public.solo_runs
  for update
  to authenticated
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);