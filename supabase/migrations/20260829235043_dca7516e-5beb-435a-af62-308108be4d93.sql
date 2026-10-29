-- Cierra el agujero por el que un jugador podia repartirse dano solo.
--
-- 0003 hacia `revoke all on function ... from public`, y eso no basta. Supabase
-- concede EXECUTE de forma nominal a los roles `anon` y `authenticated` sobre
-- las funciones de `public` mediante privilegios por defecto, y revocar del
-- pseudo-rol PUBLIC no retira una concesion hecha a un rol concreto.
--
-- El resultado era que cualquiera con la anon key podia llamar a
-- `submit_round_result` pasando `p_passed => true` con un patron invalido y
-- bajarle 25 de HP al rival. Verificado contra la base: el HP del rival bajaba
-- de 100 a 75.
--
-- Se arregla en dos capas, porque una sola es fragil.

-- ---------------------------------------------------------------------------
-- Capa 1: retirar EXECUTE a los roles del navegador, por nombre.
-- ---------------------------------------------------------------------------
revoke all on function public.submit_round_result(uuid, uuid, text, boolean)
  from anon, authenticated;
revoke all on function public.pick_next_problem(uuid[], int)
  from anon, authenticated;
revoke all on function public.generate_room_code()
  from anon, authenticated;

grant execute on function public.submit_round_result(uuid, uuid, text, boolean)
  to service_role;

-- Estas tres siguen siendo del navegador a proposito: cada una comprueba la
-- sesion por dentro con auth.uid() y no decide ningun golpe.
grant execute on function public.create_room() to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Capa 2: la funcion se niega a correr si no la llama el servidor.
-- ---------------------------------------------------------------------------
create or replace function public.assert_service_role()
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Esta funcion solo puede llamarse desde el servidor'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.assert_service_role() from public, anon, authenticated;
grant execute on function public.assert_service_role() to service_role;

-- La definicion completa se reescribe aqui con el guardia dentro.
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
  -- Capa 2: aunque alguien vuelva a conceder EXECUTE, la llamada muere aqui.
  perform public.assert_service_role();

  select * into v_round from public.rounds where id = p_round_id;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

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

revoke all on function public.submit_round_result(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.submit_round_result(uuid, uuid, text, boolean)
  to service_role;