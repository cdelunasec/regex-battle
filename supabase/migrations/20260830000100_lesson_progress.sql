-- Progreso del modo aprendizaje.
--
-- El temario vive en el repo, en src/data/lessons.ts, porque es prosa con
-- ejemplos y el control de versiones es mejor sitio para eso. Lo que sí es dato
-- de usuario, y por tanto va aquí, es qué lecciones lleva completadas cada
-- quien.
--
-- Aquí no hay nada que proteger de trampas: nadie gana nada marcando una
-- lección como hecha, así que a diferencia de las tablas de combate, el
-- jugador escribe sus propias filas.

create table if not exists public.lesson_progress (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references auth.users (id) on delete cascade,
  -- Referencia al slug del temario del repo. A propósito no es una clave
  -- foránea: las lecciones no son filas.
  lesson_slug  text not null check (char_length(lesson_slug) between 1 and 100),
  -- Se guarda el patrón con el que lo resolvió, que sirve para repasar.
  solution     text check (char_length(solution) <= 200),
  completed_at timestamptz not null default now(),
  unique (player_id, lesson_slug)
);

create index if not exists lesson_progress_player_idx
  on public.lesson_progress (player_id, completed_at desc);

alter table public.lesson_progress enable row level security;

drop policy if exists "cada quien lee su propio progreso" on public.lesson_progress;
create policy "cada quien lee su propio progreso"
  on public.lesson_progress
  for select
  to authenticated
  using (auth.uid() = player_id);

drop policy if exists "cada quien marca su propio progreso" on public.lesson_progress;
create policy "cada quien marca su propio progreso"
  on public.lesson_progress
  for insert
  to authenticated
  with check (auth.uid() = player_id);

drop policy if exists "cada quien actualiza su propio progreso" on public.lesson_progress;
create policy "cada quien actualiza su propio progreso"
  on public.lesson_progress
  for update
  to authenticated
  using (auth.uid() = player_id)
  with check (auth.uid() = player_id);

-- Poder reiniciar el curso es parte de aprender.
drop policy if exists "cada quien borra su propio progreso" on public.lesson_progress;
create policy "cada quien borra su propio progreso"
  on public.lesson_progress
  for delete
  to authenticated
  using (auth.uid() = player_id);

-- Sin estos GRANT la API de datos rechaza las consultas aunque las políticas
-- las permitan.
grant select, insert, update, delete on public.lesson_progress to authenticated;
grant all on public.lesson_progress to service_role;
