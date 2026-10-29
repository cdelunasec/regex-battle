-- KQL entra como segundo lenguaje del banco.
--
-- KQL aquí es el de Kibana (Elastic), no el Kusto de Microsoft, que se abrevia
-- igual y es otro lenguaje. Es un lenguaje de FILTRO, así que un reto se
-- corrige igual que uno de regex: la consulta tiene que dejar pasar unos casos
-- y dejar fuera otros. La única diferencia es que cada caso es un documento
-- JSON en vez de una línea de texto, y eso cabe en `must_match` tal como está.
-- Por eso no hay columnas nuevas ni tablas nuevas: solo se ensancha el check.
--
-- De paso, el repartidor de retos pasa a recibir el `config` entero de la sala
-- en vez de un parámetro suelto por ajuste. La migración anterior le añadió la
-- dificultad y esta le tendría que añadir el lenguaje; con el jsonb completo,
-- el próximo ajuste no cambia ninguna firma.
--
-- Ninguna función aplicada se edita ni se borra: las nuevas llevan firma
-- distinta y conviven. Los permisos se retiran por NOMBRE DE ROL.
--
-- Re-ejecutable de principio a fin.

-- ---------------------------------------------------------------------------
-- El banco acepta otro lenguaje
-- ---------------------------------------------------------------------------
-- Se borra y se vuelve a crear porque `add constraint` sin más falla al
-- reaplicar, y estas migraciones tienen que poder correr dos veces.
alter table public.problems drop constraint if exists problems_language_check;
alter table public.problems
  add constraint problems_language_check check (language in ('regex', 'kql'));

-- ---------------------------------------------------------------------------
-- El repartidor, ahora enterado del lenguaje y la dificultad de la sala
-- ---------------------------------------------------------------------------
create or replace function public.pick_next_problem(
  p_used         uuid[],
  p_round_number int,
  p_config       jsonb
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
    -- Una sala se juega en un solo lenguaje. Las de antes de esta migración no
    -- traen `language` en el config, y ahí `->>` da null: se cae en regex, que
    -- es lo que estaban jugando.
    and problem.language = coalesce(p_config ->> 'language', 'regex')
    and not (problem.id = any (p_used))
  order by
    -- El nivel pedido primero. Si esa banda se agota a media partida, los
    -- vecinos entran antes que dejar la sala sin reto que servir.
    abs(
      problem.difficulty
      - case lower(coalesce(p_config ->> 'difficulty', 'progresiva'))
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

revoke all on function public.pick_next_problem(uuid[], int, jsonb)
  from public, anon, authenticated;
grant execute on function public.pick_next_problem(uuid[], int, jsonb) to service_role;

-- ---------------------------------------------------------------------------
-- create_room: dificultad, duración y ahora lenguaje
-- ---------------------------------------------------------------------------
create or replace function public.create_room(
  p_difficulty text,
  p_initial_hp int,
  p_language   text
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
  v_language text;
  v_hp int;
begin
  if v_player is null then
    raise exception 'Tienes que iniciar sesión para crear una sala';
  end if;

  -- Nada de lo que manda el navegador se guarda tal cual: se compara contra la
  -- lista, y lo que no esté en ella cae en el valor por defecto.
  v_difficulty := case lower(coalesce(p_difficulty, ''))
                    when 'facil'   then 'facil'
                    when 'media'   then 'media'
                    when 'dificil' then 'dificil'
                    when 'experta' then 'experta'
                    else 'progresiva'
                  end;

  v_language := case lower(coalesce(p_language, ''))
                  when 'kql' then 'kql'
                  else 'regex'
                end;

  -- La vida decide cuántas rondas dura: a 25 de daño por ronda, 75 son tres
  -- golpes y 150 son seis.
  v_hp := least(greatest(coalesce(p_initial_hp, 100), 50), 200);
  v_hp := v_hp - (v_hp % 25);

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
      'difficulty', v_difficulty,
      'language', v_language
    )
  )
  returning * into v_room;

  return v_room;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_room, con el config entero para el repartidor
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

  v_problem := public.pick_next_problem('{}'::uuid[], 1, v_room.config);
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
-- submit_round_result: igual que antes, con el guardia de service_role dentro
-- ---------------------------------------------------------------------------
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
      v_room.config
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
-- Las versiones anteriores de create_room salen del alcance del navegador para
-- que no se cuele una sala sin lenguaje.
revoke all on function public.create_room() from public, anon, authenticated;
revoke all on function public.create_room(text, int) from public, anon, authenticated;

grant execute on function public.create_room(text, int, text) to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.leave_room(uuid) to authenticated;

revoke all on function public.submit_round_result(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.submit_round_result(uuid, uuid, text, boolean)
  to service_role;