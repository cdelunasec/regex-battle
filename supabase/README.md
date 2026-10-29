# La base de datos de Regex Battle

Este archivo explica **por qué** el esquema es como es. Las migraciones en
`migrations/` explican el qué.

## Cómo se trabaja aquí

Hay una sola carpeta de migraciones, con marca de tiempo en el nombre. Al
principio también había copias numeradas (`0001_init.sql` y compañía), así que
cada cambio existía dos veces. Eso no es solo ruido, es un pie de plomo: se
llega a editar la copia numerada creyendo que es la versión viva cuando la
aplicada es la otra.

Reglas, entonces:

- **Una migración aplicada no se edita nunca.** Si algo tiene que cambiar, se
  escribe una nueva que la supersede. Así se arregló el agujero de permisos que
  se describe abajo, con `0006` redefiniendo la función completa en vez de
  tocar la migración original.
- Para un cambio nuevo, se escribe un archivo en `migrations/` y se aplica con
  `npx supabase db push`.
- Todas son re-ejecutables. Se pueden correr de nuevo sin miedo, así
  que `create table if not exists`, `drop policy if exists` antes de cada
  `create policy`, y el seed hace upsert por `slug`.

## Las cinco tablas

**`problems`** es el banco de retos. El contenido es data-driven: agregar un
reto es insertar una fila, no tocar código. La fuente de verdad está en
`src/data/challenges.ts` y de ahí sale la migración del seed con
`bun run seed:sql`.

Dos columnas merecen explicación. `match_mode` decide si el patrón solo tiene
que aparecer dentro del texto o si tiene que consumirlo entero, y eso cambia
por completo qué retos se pueden plantear. `must_match` y `must_not_match` son
listas de strings, y un patrón pasa el reto solo si acierta las dos completas.
Es determinista, rápido y justo, y de paso las listas visibles funcionan como
la pista del reto, igual que la rejilla en un crucigrama de regex.

La validación de forma de esas dos listas vive en la función
`is_valid_case_list`, porque una restricción `check` no puede llevar una
subconsulta dentro pero sí puede llamar a una función.

**`rooms`** es una partida. El código son seis caracteres de un alfabeto sin I,
O, 0 ni 1, para que un código dictado en voz alta no se pueda teclear mal. El
`config` lleva el HP inicial y el daño por ronda como datos, no como constantes
en el código, para poder balancear sin desplegar. `used_problem_ids` evita que
una partida sirva el mismo reto dos veces.

**`rounds`** es un reto servido a los dos a la vez. Su `winner_id` se reclama
una sola vez, y ahí está toda la carrera.

**`submissions`** es auditoría y la fuente del límite de frecuencia. La escribe
solo el servidor, porque un cliente que pudiera escribir la columna `passed`
simplemente escribiría `true`.

**`solo_runs`** es el historial de práctica. El modo solo no tiene rival al que
hacerle trampa, así que aquí sí el jugador es dueño de sus propias filas.

## El modelo de RLS

La regla es una sola: **el navegador no escribe nada que decida una partida.**

- `problems`: lectura para quien tenga sesión. Las listas de prueba se ven a
  propósito, son la pista del reto.
- `rooms` y `rounds`: los ve solo quien juega en esa sala. **Cero políticas de
  escritura.** El HP, el estado y el reto en curso los decide el servidor.
- `submissions`: cada quien ve las suyas, nadie escribe ninguna.
- `solo_runs`: cada quien lee y escribe las suyas.

No hay ninguna política que exponga las salas en espera. Si la hubiera,
cualquiera podría listar los códigos abiertos y meterse en la partida de un
desconocido. Por eso entrar por código pasa por `join_room`, que es
`security definer` y busca la sala sin enseñar el listado.

## El anti-trampa

**El golpe lo confirma siempre el servidor.** El cliente valida en local solo
para el feedback en vivo mientras el jugador escribe. Lo que reparte daño es
`submit_round_result`, y la llama únicamente la Edge Function.

**Dos envíos casi simultáneos no pueden cobrar los dos.** La ronda se reclama
con un update condicionado:

```sql
update rounds set winner_id = ..., resolved_at = now()
where id = ... and winner_id is null
```

Si devuelve cero filas, alguien llegó primero y el segundo envío no aplica
daño. Es atómico, no hay ventana entre comprobar y escribir.

**Hay límite de frecuencia**, cinco envíos por jugador cada tres segundos,
contado dentro de la misma función.

### La lección que costó un agujero

`0003` revocaba el permiso de ejecución así:

```sql
revoke all on function public.submit_round_result(...) from public;
```

Parece correcto y no lo es. Supabase concede `EXECUTE` de forma **nominal** a
los roles `anon` y `authenticated` sobre las funciones de `public` mediante
privilegios por defecto, y revocar del pseudo-rol `PUBLIC` no retira una
concesión hecha a un rol concreto. El resultado: cualquiera con la key pública
podía llamar a `submit_round_result` pasando `p_passed => true` con un patrón
inválido y bajarle 25 de HP al rival. Se comprobó contra la base real, el HP
pasaba de 100 a 75.

`0006` lo cierra en dos capas, porque una sola es frágil. Se retira `EXECUTE` a
`anon` y `authenticated` **por nombre**, y además la función aborta si quien la
llama no es el rol de servicio, de modo que una reconcesión accidental no
reabra el hueco en silencio.

De ahí sale la regla que gobierna `scripts/verify-security.mjs`: **para lo
prohibido nunca basta con que la llamada devuelva error.** Con RLS un `update`
sin política afecta cero filas y devuelve éxito, así que hay que comprobar el
efecto, que el dato no cambió. El primer intento de verificación daba todo por
bueno justamente por eso.

Ese script se conecta al proyecto real con la key pública, o sea con los mismos
permisos que tiene cualquiera que abra la consola del navegador, e intenta
hacer trampa de nueve maneras distintas:

```bash
bun run verify:security
```

## Tiempo real

El cliente se suscribe a los cambios de fila de `rooms` y `rounds`, no a
mensajes de broadcast. La diferencia es de anti-trampa: los cambios de fila los
emite Postgres y pasan por las mismas políticas de RLS, así que un jugador no
puede falsificar un golpe ni un fin de partida inyectando un mensaje en el
canal. Los eventos que describe la spec se derivan en el cliente comparando el
estado nuevo con el anterior.
