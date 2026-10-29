-- Dificultad y largo de partida, elegidos por quien crea la sala.
--
-- Antes la dificultad la decidia solo el numero de ronda: toda partida
-- empezaba en nivel 1 y subia un escalon cada dos rondas, jugara quien jugara.
-- Asi que dos jugadores que quisieran pelear en dificil no tenian como pedirlo,
-- y el banco de 18 retos servia casi los mismos cada vez.
--
-- El banco ya paso a 66 en la migracion de seed. Esto es la otra mitad: que la
-- sala pueda decir en que nivel se pelea y cuanto dura la pelea.
--
-- Todo lo nuevo vive en `rooms.config`, que ya existia declarado como el knob
-- ajustable por sala. No hace falta tocar el esquema:
--
--   config.difficulty        progresiva | facil | media | dificil | experta
--   config.initial_hp        con cuanta vida arranca cada quien
--   config.damage_per_round  lo que cuesta perder una ronda
--
-- Ninguna funcion aplicada se edita ni se borra. Las nuevas llevan firma
-- distinta y conviven con las viejas; a las viejas se les retira EXECUTE por
-- NOMBRE DE ROL, que es lo unico que de verdad las cierra: revocar del
-- pseudo-rol PUBLIC no retira la concesion nominal que Supabase le da a `anon`
-- y `authenticated`.
--
-- Re-ejecutable de principio a fin.

-- ---------------------------------------------------------------------------
-- El repartidor de retos, ahora enterado del nivel de la sala
-- ---------------------------------------------------------------------------
-- Firma nueva de tres argumentos. La de dos sigue existiendo sin que nadie la
-- llame, porque borrarla obligaria a recrear en cascada y la regla es no tocar
-- lo aplicado.
create or replace function public.pick_next_problem(
  p_used         uuid[],
  p_round_number int,
  p_difficulty   text
)
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
    -- El nivel pedido primero. Si esa banda se agota a media partida, los
    -- vecinos entran antes que dejar la sala sin reto que servir.
    abs(
      problem.difficulty
      - case lower(coalesce(p_difficulty, 'progresiva'))
          when 'facil'   then 1
          when 'media'   then 3
          when 'dificil' then 4
          when 'experta' then 5
          -- Progresiva es lo de siempre: empieza suave y sube cada dos rondas.
          else least(1 + ((greatest(p_round_number, 1) - 1) / 2), 5)
        end
    ),
    random()
  limit 1;
$$;

revoke all on function public.pick_next_problem(uuid[], int, text)
  from public, anon, authenticated;
grant execute on function public.pick_next_problem(uuid[], int, text) to service_role;

-- ---------------------------------------------------------------------------
-- create_room con ajustes
-- ---------------------------------------------------------------------------
create or replace function public.create_room(
  p_difficulty text,
  p_initial_hp int
)
returns public.rooms
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_player uuid := auth.uid();
  v_room public.rooms;
  v_difficulty text;
  v_hp int;
begin
  if v_player is null then
    raise exception 'Tienes que iniciar sesión para crear una sala';
  end if;

  -- Lo que manda el navegador no se guarda tal cual. Se compara contra la
  -- lista, y lo que no este en ella cae en el valor por defecto en vez de
  -- meterse en el config y desconcertar al repartidor.
  v_difficulty := case lower(coalesce(p_difficulty, ''))
                    when 'facil'   then 'facil'
                    when 'media'   then 'media'
                    when 'dificil' then 'dificil'
                    when 'experta' then 'experta'
                    else 'progresiva'
                  end;

  -- La vida decide cuantas rondas dura: a 25 de dano por ronda, 75 son tres
  -- golpes y 150 son seis. Se topa y se cuadra al multiplo para que nadie
  -- pida una partida eterna ni una que termine a medio golpe.
  v_hp := least(greatest(coalesce(p_initial_hp, 100), 50), 200);
  v_hp := v_hp - (v_hp % 25);

  -- Cierra lo que este jugador dejo colgando, para que los codigos viejos
  -- dejen de valer.
  update public.rooms
     set status = 'finished', finished_at = now()
   where host_id = v_player
     and status = 'waiting';

  insert into public.rooms (code, host_id, host_hp, guest_hp, config)
  values (
    public.generate_room_code(),
    v_player,
    v_hp,
    v_hp,
    jsonb_build_object(
      'initial_hp', v_hp,
      'damage_per_round', 25,
      'difficulty', v_difficulty
    )
  )
  returning * into v_room;

  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_room: misma logica de antes, pero le pasa el nivel al repartidor
-- ---------------------------------------------------------------------------
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

  -- Volver a conectarse a una partida en curso no es un error.
  if v_room.guest_id = v_player or v_room.host_id = v_player then
    return v_room;
  end if;

  if v_room.status <> 'waiting' or v_room.guest_id is not null then
    raise exception 'Esa sala ya está llena o la partida terminó';
  end if;

  -- Las salas creadas antes de esta migracion no tienen `difficulty` en el
  -- config, y ahi `->>` devuelve null, que el repartidor lee como progresiva.
  v_problem := public.pick_next_problem(
    '{}'::uuid[],
    1,
    v_room.config ->> 'difficulty'
  );
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
-- submit_round_result: identica a la de 20260829235043, con el nivel añadido
-- ---------------------------------------------------------------------------
-- Se reescribe entera, con su guardia de service_role dentro, porque lo unico
-- que cambia es la llamada al repartidor y editar la migracion vieja esta
-- prohibido.
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
      v_room.round_number + 1,
      v_room.config ->> 'difficulty'
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

-- ---------------------------------------------------------------------------
-- Permisos, siempre por nombre de rol
-- ---------------------------------------------------------------------------
-- La sala ya no se crea sin ajustes: la version de cero argumentos sale del
-- alcance del navegador para que no se cuele una sala a medio configurar.
revoke all on function public.create_room() from public, anon, authenticated;

grant execute on function public.create_room(text, int) to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

-- El repartidor de golpes sigue siendo solo del servidor.
revoke all on function public.submit_round_result(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.submit_round_result(uuid, uuid, text, boolean)
  to service_role;