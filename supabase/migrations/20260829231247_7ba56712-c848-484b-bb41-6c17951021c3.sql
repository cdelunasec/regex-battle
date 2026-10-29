-- Server side game logic.
--
-- Everything that decides a match lives here, inside security definer
-- functions, so the browser can only ask for a transition and never perform
-- one. The anti-cheat rules of the spec map to concrete mechanics:
--
--   * a round is claimed with a conditional update, so two submissions landing
--     in the same millisecond cannot both score,
--   * submissions are rate limited per player,
--   * damage is computed from `config`, never from anything the client sends.

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

-- Picks the next challenge for a room, skipping the ones already served and
-- easing the difficulty upward as the match goes on.
create or replace function public.pick_next_problem(p_used uuid[], p_round_number int)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select problem.id
  from public.problems as problem
  where problem.is_active
    and problem.language = 'regex'
    and not (problem.id = any (p_used))
  order by
    abs(problem.difficulty - least(1 + ((greatest(p_round_number, 1) - 1) / 2), 5)),
    random()
  limit 1;
$$;

-- Six characters from an alphabet with no I, O, 0 or 1.
create or replace function public.generate_room_code()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  for attempt in 1..20 loop
    candidate := '';
    for slot in 1..6 loop
      candidate := candidate
        || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where code = candidate);
    candidate := null;
  end loop;

  if candidate is null then
    raise exception 'No se pudo generar un código de sala, intenta de nuevo';
  end if;

  return candidate;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_room: called by the host
-- ---------------------------------------------------------------------------
create or replace function public.create_room()
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player uuid := auth.uid();
  v_room public.rooms;
begin
  if v_player is null then
    raise exception 'Tienes que iniciar sesión para crear una sala';
  end if;

  -- Close whatever this player left hanging, so old codes stop being valid.
  update public.rooms
     set status = 'finished', finished_at = now()
   where host_id = v_player
     and status = 'waiting';

  insert into public.rooms (code, host_id)
  values (public.generate_room_code(), v_player)
  returning * into v_room;

  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_room: called by the guest, and it also starts the match
-- ---------------------------------------------------------------------------
-- Joining by code goes through this function instead of a plain select so the
-- room table never has to expose open codes to the world.
create or replace function public.join_room(p_code text)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player uuid := auth.uid();
  v_room public.rooms;
  v_problem uuid;
  v_initial_hp int;
begin
  if v_player is null then
    raise exception 'Tienes que iniciar sesión para entrar a una sala';
  end if;

  select * into v_room
  from public.rooms
  where code = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'No existe una sala con ese código';
  end if;

  -- Reconnecting to a match already in progress is not an error.
  if v_room.guest_id = v_player or v_room.host_id = v_player then
    return v_room;
  end if;

  if v_room.status <> 'waiting' or v_room.guest_id is not null then
    raise exception 'Esa sala ya está llena o la partida terminó';
  end if;

  v_problem := public.pick_next_problem('{}'::uuid[], 1);
  if v_problem is null then
    raise exception 'No hay retos disponibles en el banco';
  end if;

  v_initial_hp := coalesce((v_room.config ->> 'initial_hp')::int, 100);

  update public.rooms
     set guest_id           = v_player,
         status             = 'in_progress',
         round_number       = 1,
         current_problem_id = v_problem,
         used_problem_ids   = array[v_problem],
         host_hp            = v_initial_hp,
         guest_hp           = v_initial_hp
   where id = v_room.id
     and guest_id is null
     and status = 'waiting'
  returning * into v_room;

  if not found then
    raise exception 'Esa sala ya está llena';
  end if;

  insert into public.rounds (room_id, problem_id, round_number)
  values (v_room.id, v_problem, 1);

  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- leave_room: quitting hands the match to the other player
-- ---------------------------------------------------------------------------
create or replace function public.leave_room(p_room_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player uuid := auth.uid();
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id for update;

  if not found then
    raise exception 'Esa sala no existe';
  end if;

  if v_player is distinct from v_room.host_id
     and v_player is distinct from v_room.guest_id then
    raise exception 'No estás en esa sala';
  end if;

  if v_room.status = 'finished' then
    return v_room;
  end if;

  update public.rooms
     set status      = 'finished',
         finished_at = now(),
         winner_id   = case
                         when v_room.status = 'waiting' then null
                         when v_player = v_room.host_id then v_room.guest_id
                         else v_room.host_id
                       end,
         current_problem_id = null
   where id = v_room.id
  returning * into v_room;

  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_round_result: the only path that moves HP
-- ---------------------------------------------------------------------------
-- Called exclusively by the submit-regex edge function, which has already
-- re-validated the pattern with the shared engine. `p_passed` is the server's
-- own verdict, never the client's.
--
-- Returns one of: not_found, not_a_player, match_over, rate_limited, rejected,
-- too_late, won.
create or replace function public.submit_round_result(
  p_round_id  uuid,
  p_player_id uuid,
  p_regex     text,
  p_passed    boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_round public.rounds;
  v_room public.rooms;
  v_recent int;
  v_damage int;
  v_host_hp int;
  v_guest_hp int;
  v_next_problem uuid;
  v_finished boolean := false;
  v_winner uuid;
begin
  select * into v_round from public.rounds where id = p_round_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Locking the room serialises two players resolving the same round.
  select * into v_room from public.rooms where id = v_round.room_id for update;

  if p_player_id is distinct from v_room.host_id
     and p_player_id is distinct from v_room.guest_id then
    return jsonb_build_object('status', 'not_a_player');
  end if;

  if v_room.status <> 'in_progress' then
    return jsonb_build_object('status', 'match_over');
  end if;

  select count(*) into v_recent
  from public.submissions
  where player_id = p_player_id
    and created_at > now() - interval '3 seconds';

  if v_recent >= 5 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.submissions (room_id, round_id, player_id, regex, passed)
  values (v_room.id, v_round.id, p_player_id, left(p_regex, 200), p_passed);

  if not p_passed then
    return jsonb_build_object('status', 'rejected');
  end if;

  -- The whole race comes down to this one conditional update.
  update public.rounds
     set winner_id = p_player_id, resolved_at = now()
   where id = p_round_id
     and winner_id is null
  returning * into v_round;

  if not found then
    return jsonb_build_object('status', 'too_late');
  end if;

  v_damage  := coalesce((v_room.config ->> 'damage_per_round')::int, 25);
  v_host_hp := v_room.host_hp;
  v_guest_hp := v_room.guest_hp;

  if p_player_id = v_room.host_id then
    v_guest_hp := greatest(0, v_guest_hp - v_damage);
  else
    v_host_hp := greatest(0, v_host_hp - v_damage);
  end if;

  v_finished := v_host_hp = 0 or v_guest_hp = 0;

  if not v_finished then
    v_next_problem := public.pick_next_problem(
      v_room.used_problem_ids,
      v_room.round_number + 1
    );
    -- Running out of challenges ends the match on points rather than hanging.
    v_finished := v_next_problem is null;
  end if;

  if v_finished then
    v_winner := case
                  when v_host_hp > v_guest_hp then v_room.host_id
                  when v_guest_hp > v_host_hp then v_room.guest_id
                  else p_player_id
                end;

    update public.rooms
       set host_hp            = v_host_hp,
           guest_hp           = v_guest_hp,
           status             = 'finished',
           winner_id          = v_winner,
           finished_at        = now(),
           current_problem_id = null
     where id = v_room.id
    returning * into v_room;
  else
    update public.rooms
       set host_hp            = v_host_hp,
           guest_hp           = v_guest_hp,
           round_number       = v_room.round_number + 1,
           current_problem_id = v_next_problem,
           used_problem_ids   = v_room.used_problem_ids || v_next_problem
     where id = v_room.id
    returning * into v_room;

    insert into public.rounds (room_id, problem_id, round_number)
    values (v_room.id, v_next_problem, v_room.round_number);
  end if;

  return jsonb_build_object(
    'status', 'won',
    'damage', v_damage,
    'round_number', v_round.round_number,
    'room', to_jsonb(v_room)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Postgres grants EXECUTE to PUBLIC by default, so every function has to be
-- locked down explicitly before handing it to the right role.

revoke all on function public.pick_next_problem(uuid[], int) from public;
revoke all on function public.generate_room_code() from public;
revoke all on function public.create_room() from public;
revoke all on function public.join_room(text) from public;
revoke all on function public.leave_room(uuid) from public;
revoke all on function public.submit_round_result(uuid, uuid, text, boolean) from public;

grant execute on function public.create_room() to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

-- Only the edge function, running as service_role, can move HP.
grant execute on function public.submit_round_result(uuid, uuid, text, boolean)
  to service_role;