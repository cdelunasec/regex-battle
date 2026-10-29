-- Regex Battle, base schema.
--
-- Five tables: the data-driven challenge bank, the 1v1 rooms with their rounds
-- and submissions, and the solo practice log. Row level security lives in
-- 0002_rls.sql and the server side logic in 0003_rpc.sql.

create extension if not exists pgcrypto;

-- Keeps `updated_at` honest without the client having to set it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- A check constraint cannot hold a subquery, so the shape validation for the
-- test lists is wrapped in an immutable function.
create or replace function public.is_valid_case_list(value jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(value) = 'array'
     and jsonb_array_length(value) between 1 and 30
     and not exists (
       select 1
       from jsonb_array_elements(value) as element
       where jsonb_typeof(element) <> 'string'
          or char_length(element #>> '{}') > 200
     );
$$;

-- ---------------------------------------------------------------------------
-- problems: the challenge bank. Adding content means inserting rows.
-- ---------------------------------------------------------------------------
create table if not exists public.problems (
  id             uuid primary key default gen_random_uuid(),
  -- Natural key so the seed migration can upsert instead of duplicating.
  slug           text not null unique,
  language       text not null default 'regex' check (language in ('regex')),
  prompt         text not null check (char_length(prompt) between 10 and 500),
  difficulty     int not null check (difficulty between 1 and 5),
  -- 'partial' means the pattern only has to be found inside the string,
  -- 'full' means it has to consume the whole string.
  match_mode     text not null default 'partial' check (match_mode in ('partial', 'full')),
  must_match     jsonb not null check (public.is_valid_case_list(must_match)),
  must_not_match jsonb not null check (public.is_valid_case_list(must_not_match)),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists problems_active_difficulty_idx
  on public.problems (language, difficulty)
  where is_active;

-- ---------------------------------------------------------------------------
-- rooms: one 1v1 match. The server is the only writer.
-- ---------------------------------------------------------------------------
create table if not exists public.rooms (
  id                 uuid primary key default gen_random_uuid(),
  -- Six characters from an alphabet with no I, O, 0 or 1, so a code read out
  -- loud cannot be mistyped.
  code               text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  status             text not null default 'waiting'
                       check (status in ('waiting', 'in_progress', 'finished')),
  host_id            uuid not null references auth.users (id) on delete cascade,
  guest_id           uuid references auth.users (id) on delete set null,
  host_hp            int not null default 100 check (host_hp >= 0),
  guest_hp           int not null default 100 check (guest_hp >= 0),
  current_problem_id uuid references public.problems (id) on delete set null,
  round_number       int not null default 0 check (round_number >= 0),
  -- Keeps a match from serving the same challenge twice.
  used_problem_ids   uuid[] not null default '{}',
  winner_id          uuid references auth.users (id) on delete set null,
  -- Tunable per room without touching code, as the spec asks.
  config             jsonb not null
                       default '{"initial_hp": 100, "damage_per_round": 25}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  finished_at        timestamptz,
  constraint rooms_guest_is_not_host check (guest_id is null or guest_id <> host_id)
);

create index if not exists rooms_host_idx on public.rooms (host_id);
create index if not exists rooms_guest_idx on public.rooms (guest_id);
create index if not exists rooms_open_code_idx on public.rooms (code) where status = 'waiting';

drop trigger if exists rooms_touch_updated_at on public.rooms;
create trigger rooms_touch_updated_at
  before update on public.rooms
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- rounds: one challenge served to both players. `winner_id` is claimed once.
-- ---------------------------------------------------------------------------
create table if not exists public.rounds (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms (id) on delete cascade,
  problem_id   uuid not null references public.problems (id),
  round_number int not null check (round_number > 0),
  winner_id    uuid references auth.users (id) on delete set null,
  started_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  unique (room_id, round_number)
);

create index if not exists rounds_room_idx on public.rounds (room_id, round_number desc);

-- ---------------------------------------------------------------------------
-- submissions: audit trail and rate limiting source. Written by the server
-- only, because a client that could write `passed` would just write true.
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid references public.rooms (id) on delete cascade,
  round_id   uuid references public.rounds (id) on delete cascade,
  player_id  uuid not null references auth.users (id) on delete cascade,
  regex      text not null check (char_length(regex) <= 200),
  passed     boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists submissions_player_recent_idx
  on public.submissions (player_id, created_at desc);
create index if not exists submissions_round_idx on public.submissions (round_id);

-- ---------------------------------------------------------------------------
-- solo_runs: practice history. Optional per the spec, cheap enough to keep.
-- ---------------------------------------------------------------------------
create table if not exists public.solo_runs (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references auth.users (id) on delete cascade,
  solved_count  int not null default 0 check (solved_count >= 0),
  best_streak   int not null default 0 check (best_streak >= 0),
  duration_ms   int not null default 0 check (duration_ms >= 0),
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists solo_runs_player_idx on public.solo_runs (player_id, created_at desc);