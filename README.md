# Code Battle

Plataforma para aprender a programar peleando. Dos jugadores entran a una sala por código,
reciben el mismo reto al mismo tiempo, y el primero que lo resuelve le baja vida al otro.
Hay también un modo solo para practicar y un curso por cada lenguaje.

No es una plataforma de expresiones regulares: se empezó por ahí porque es lo único que se
corrige sin ejecutar código, así que se podía comprobar que el juego entero funcionaba
antes de meterse con lenguajes que hay que correr. El nombre todavía es provisional, y el
repo conserva el suyo de entonces.

Stack: TanStack Start con TanStack Router, React, TypeScript, Tailwind y shadcn/ui, sobre
Supabase para datos, auth y tiempo real, con Edge Functions en Deno para la lógica de
servidor.

## Los lenguajes

| | Se pelea | Se practica | Tiene curso | Cómo se corrige |
|---|---|---|---|---|
| Expresiones regulares | sí | sí | 15 lecciones | listas de casos que deben pasar y casos que no |
| KQL de Kibana | sí | sí | 12 lecciones | un log en JSON y una consulta que decide si entra |
| C# | no | 50 retos | 15 lecciones | se compila y se ejecuta en el navegador, con Roslyn en WebAssembly |
| Bash de Linux | no | 60 retos | 18 lecciones | se interpreta en el navegador, sobre un sistema de archivos de mentira |

Los dos que no se pelean es porque se corrigen en el navegador de quien practica, y en el
1v1 el que corrige tiene que ser el servidor para que nadie se reparta golpes solo.

El de Bash va orientado a ciberseguridad: procesar registros, revisar permisos, parsear lo
que escupen las herramientas y automatizar un reconocimiento. Las herramientas que tocan
red están simuladas con salida guardada del formato real, no tocan nada, y respetan un
archivo de alcance.

## Estado

- Modelo de datos, RLS y banco de retos en la base. Listo.
- Modo solo con validación en el cliente. Listo.
- 1v1 con salas por código, Realtime y Edge Function. Listo.
- UI de combate con sus personajes. Lista.
- Módulo de aprendizaje, cuatro cursos con práctica por sección. Listo.

## Desarrollo local

```bash
npm install
cp .env.example .env
npm run dev
```

Las variables de entorno van en `.env` (ver `.env.example`). Todas las que hay ahí son
públicas por diseño, la key del navegador está hecha para viajar en el bundle y lo que
protege los datos es el RLS. La `service_role` no aparece en ningún archivo del repo, vive
solo como secreto del entorno donde corre la Edge Function.

## Base de datos

Es un proyecto de Supabase. El flujo es:

1. El SQL se escribe en `supabase/migrations`.
2. El código de las Edge Functions se escribe en `supabase/functions`.
3. Se aplican con el CLI: `npx supabase db push` y `npx supabase functions deploy`.

La app se publica en Cloudflare Workers con `npm run deploy`.

Dos reglas que no se rompen: **una migración aplicada no se edita nunca**, si algo tiene
que cambiar se escribe una nueva que la supersede, y **todas son re-ejecutables**, porque
así se pueden correr de nuevo sin miedo.

El porqué del esquema, del modelo de RLS y del anti-trampa está en
[`supabase/README.md`](supabase/README.md).

Para comprobar qué llegó de verdad a la base, la app tiene la ruta `/diagnostico`, que
lista los retos leyendo `problems` con la key pública y pasando por las políticas de RLS.

## Banco de retos

Hay dos bancos y la diferencia es de dónde viene la corrección. Los de regex y KQL viven
en la base porque alimentan el 1v1. Los de C# y Bash viven en el repo, en
[`src/data/csharp-challenges.ts`](src/data/csharp-challenges.ts) y
[`src/data/bash-challenges.ts`](src/data/bash-challenges.ts), porque esos no se pelean y
no hay nada que proteger; sumar uno no necesita migración.

Lo que sigue es del banco de la base.

El banco es data-driven, los retos son filas en `problems`. La fuente de verdad está en
[`src/data/challenges.ts`](src/data/challenges.ts), donde cada reto lleva además una
solución de referencia que los tests corren contra sus propias listas, así un reto
imposible rompe los tests en vez de aparecer en medio de una partida.

Para agregar o cambiar retos, edita ese archivo y regenera la migración del seed:

```bash
bun run seed:sql
```

Solo escribe una migración nueva si el banco cambió de verdad, así que correrlo de más no
ensucia nada. El seed hace upsert por `slug`, o sea que aplicarlo otra vez actualiza el
banco en lugar de duplicarlo.

## El motor de validación

`src/engine` es el corazón. Un patrón pasa un reto solo si captura todos los strings de
`must_match` y ninguno de `must_not_match`.

El núcleo, `evaluate.ts`, no importa ningún motor de regex, recibe uno inyectado. Por eso
el mismo código corre en el navegador y en la Edge Function sin cambios, y para soportar
otro lenguaje más adelante solo hay que escribir otro adaptador.

`guard.ts` rechaza los patrones que pueden colgar el motor por backtracking catastrófico,
cuantificadores anidados tipo `(a+)+`, alternancias ambiguas tipo `(a|a)*`, repeticiones
con techo enorme y patrones demasiado largos.

La Edge Function no puede importar código de fuera de su carpeta cuando se despliega, así
que el motor se escribe una sola vez en `src/engine` y se copia:

```bash
bun run sync:engine
```

Hay un test que falla si las dos copias se desincronizan, así que el olvido se detecta sin
tener que acordarse de correr nada a mano.

## Comandos

| Comando | Qué hace |
|---|---|
| `bun run dev` | Levanta la app |
| `bun run test` | Tests del motor, del banco de retos y del modo solo |
| `bun run build` | Build de producción |
| `bun run lint` | ESLint |
| `bun run seed:sql` | Regenera la migración del seed |
| `bun run sync:engine` | Copia el motor a la Edge Function |
| `bun run build:csharp` | Reconstruye el compilador de C# (necesita el SDK de .NET 8) |
| `bun run verify:security` | Ataca la base real y comprueba que el anti-trampa aguanta |
| `bun run verify:edge` | Ataca la Edge Function submit-regex |
| `bun run verify:csharp` | Compila y corre las soluciones del banco y del curso de C# |
| `bun run verify:bash` | Corre todo lo de Bash y lo compara con el bash de la máquina |

## La UI de combate

Los dos peleadores son PNG con transparencia en `public/fighters`, con una pose dibujada
para cada estado: en guardia, disparando, recibiendo y derrotado. Las cuatro se montan
siempre y solo cambia cuál está visible, para que el navegador ya tenga la imagen cuando
llega el golpe en vez de pedirla justo en ese momento y dejar un hueco en blanco.

Los originales vienen de un generador de imágenes y no se pueden usar tal cual: pesan más
de dos megas cada uno, miden casi tres mil píxeles y traen fondo gris.
[`scripts/prepare-sprites.mjs`](scripts/prepare-sprites.mjs) les quita el fondo, los
recorta y los reduce, de quince megas a medio mega en total.

```bash
node scripts/prepare-sprites.mjs <carpeta-con-los-originales>
```

El fondo se borra por inundación desde los bordes, no borrando todo lo que se parezca al
gris. Esa distinción importa: las armas son gris oscuro y los ojos casi blancos, y un
borrado por color se los comería.

El movimiento son diez keyframes en `src/styles.css`, sin librería de animación. No imitan
la pose, que ya la hace el dibujo, le dan peso al momento: el retroceso al disparar, el
empujón al recibir, el temblor de todo el escenario al conectar.

El volteo del de la derecha va en un elemento de fuera y la animación en uno de dentro. Así
un mismo keyframe sirve para los dos, porque mover en X negativo es hacia atrás para cada
uno desde su punto de vista. Con las dos cosas juntas, animar pisaría el volteo y el
personaje se daría la vuelta a media pelea.

Tú siempre estás a la izquierda y de azul. Respetar quién creó la sala haría que los dos
jugadores vieran la pelea al revés entre sí.

La animación la dispara el golpe que llega por Realtime, o sea lo que dice el servidor. El
escenario no decide nada, solo lo cuenta.

Todo el estado del combate se puede leer sin ver el dibujo: cada peleador lleva su estado
en texto para lectores de pantalla, las barras llevan el número escrito además del color, y
quien tenga activado `prefers-reduced-motion` recibe el resultado sin el viaje.

## Anti-trampa

El golpe siempre lo confirma el servidor. El cliente valida en local nada más para el
feedback en vivo mientras escribes, pero el que reparte daño es `submit_round_result`, una
función `security definer` que reclama la ronda con un update condicionado, de manera que
dos envíos casi simultáneos no puedan cobrar los dos. Las tablas `rooms`, `rounds` y
`submissions` no tienen ninguna política de escritura desde el navegador.

Eso no se verifica leyendo el SQL. `scripts/verify-security.mjs` se conecta al
proyecto real con la key pública, o sea con los mismos permisos que tiene
cualquiera que abra la consola del navegador, e intenta hacer trampa de nueve
maneras distintas. Para lo prohibido comprueba el efecto y no el error, porque
con RLS un UPDATE sin política afecta cero filas y devuelve éxito.

```bash
bun run verify:security
```

Existe porque ya hizo falta: un `revoke ... from public` que parecía correcto
dejaba `submit_round_result` abierta a cualquier jugador, que podía bajarle 25
de HP al rival desde la consola. Se vio ejecutando esto, no leyendo el SQL.
