/**
 * Comprobación puntual de que la tanda de KQL llegó a la base real.
 *
 * Mira tres cosas que solo se pueden saber contra la base:
 *   1. Que el banco tenga los dos lenguajes y con fondo en cada nivel.
 *   2. Que `create_room` con ajustes exista y guarde lo que se le pide.
 *   3. Que la versión vieja sin argumentos ya no esté al alcance del navegador.
 *
 * Es de usar y tirar, pero se queda en el repo porque la próxima migración de
 * permisos va a querer la misma comprobación.
 */
import { createClient } from "@supabase/supabase-js";
import { KQL_CHALLENGES } from "../src/data/kql-challenges.ts";

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Faltan VITE_SUPABASE_URL y la llave pública en .env.local");
  process.exit(1);
}

const PASSWORD = process.env.VERIFY_PASSWORD;
if (!PASSWORD) {
  console.error("Falta VERIFY_PASSWORD en .env.local");
  process.exit(1);
}

/** Las mismas cuentas fijas que usan los otros dos verificadores. */
async function account(tag) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const credentials = { email: `verify-${tag}@regexbattle.test`, password: PASSWORD };
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error) throw new Error(`no se pudo entrar como ${tag}: ${error.message}`);
  return { client, id: data.user.id };
}

const host = await account("host");
const guest = await account("guest");
const client = host.client;

let fallos = 0;
const ok = (label, extra = "") => console.log(`OK    ${label}${extra ? `  -> ${extra}` : ""}`);
const fail = (label, extra = "") => {
  fallos++;
  console.log(`FALLO ${label}${extra ? `  -> ${extra}` : ""}`);
};

console.log("\n--- EL BANCO ---");

const { data: problems, error: problemsError } = await client
  .from("problems")
  .select("slug, language, difficulty")
  .eq("is_active", true);

if (problemsError) {
  fail("leer el banco", problemsError.message);
} else {
  const porLenguaje = {};
  for (const problem of problems) {
    porLenguaje[problem.language] ??= {};
    porLenguaje[problem.language][problem.difficulty] =
      (porLenguaje[problem.language][problem.difficulty] ?? 0) + 1;
  }

  console.log(`      ${problems.length} retos activos en total`);
  for (const [language, niveles] of Object.entries(porLenguaje)) {
    const detalle = [1, 2, 3, 4, 5].map((n) => `n${n}:${niveles[n] ?? 0}`).join(" ");
    const total = Object.values(niveles).reduce((a, b) => a + b, 0);
    const flojo = [1, 2, 3, 4, 5].some((n) => (niveles[n] ?? 0) < 10);
    if (flojo) fail(`${language} tiene niveles flojos`, detalle);
    else ok(`${language}: ${total} retos`, detalle);
  }

  if (!porLenguaje.kql) fail("KQL no llegó al banco");
}

console.log("\n--- CREAR SALA CON AJUSTES ---");

const { data: room, error: createError } = await client.rpc("create_room", {
  p_difficulty: "experta",
  p_initial_hp: 75,
  p_language: "kql",
});

if (createError || !room) {
  fail("create_room con ajustes", createError?.message ?? "sin sala");
} else {
  ok("create_room con ajustes", room.code);
  const config = room.config ?? {};
  if (config.language === "kql") ok("guarda el lenguaje", config.language);
  else fail("guarda el lenguaje", JSON.stringify(config));
  if (config.difficulty === "experta") ok("guarda la dificultad", config.difficulty);
  else fail("guarda la dificultad", JSON.stringify(config));
  if (room.host_hp === 75) ok("guarda la duración", `${room.host_hp} de vida`);
  else fail("guarda la duración", String(room.host_hp));
}

console.log("\n--- LA VERSIÓN VIEJA YA NO DEBE ESTAR AL ALCANCE ---");

const { error: legacyError } = await client.rpc("create_room");
if (legacyError) ok("create_room sin argumentos está cerrada", legacyError.message);
else fail("create_room sin argumentos SIGUE ABIERTA: se puede crear una sala sin configurar");

const { error: legacyTwoError } = await client.rpc("create_room", {
  p_difficulty: "facil",
  p_initial_hp: 100,
});
if (legacyTwoError) ok("create_room de dos argumentos está cerrada", legacyTwoError.message);
else fail("create_room de dos argumentos SIGUE ABIERTA");

console.log("\n--- UN DUELO DE KQL, DE PUNTA A PUNTA ---");

/*
 * Esta es la parte que de verdad importa, y la que ningun otro verificador
 * cubre. El navegador corrige con el motor de KQL, y la Edge Function tiene
 * que corregir con el mismo. Si la funcion desplegada es la vieja, evalua la
 * consulta como si fuera una expresion regular contra un JSON, no encaja, y el
 * jugador resuelve el reto sin que le pegue el golpe a nadie.
 *
 * Es el peor fallo posible en una pelea: silencioso y del lado que manda.
 */
const { data: duel, error: duelError } = await client.rpc("create_room", {
  p_difficulty: "facil",
  p_initial_hp: 100,
  p_language: "kql",
});

if (duelError || !duel) {
  fail("crear la sala de KQL", duelError?.message);
} else {
  const { error: joinError } = await guest.client.rpc("join_room", { p_code: duel.code });
  if (joinError) {
    fail("el rival entra a la sala", joinError.message);
  } else {
    const { data: rounds } = await client
      .from("rounds")
      .select("*")
      .eq("room_id", duel.id)
      .order("round_number", { ascending: false });
    const round = rounds?.[0];

    const { data: problem } = await client
      .from("problems")
      .select("slug, language")
      .eq("id", round.problem_id)
      .single();

    if (problem?.language !== "kql") {
      fail("la sala de KQL sirve un reto de KQL", problem?.language);
    } else {
      ok("la sala de KQL sirve un reto de KQL", problem.slug);

      const solution = KQL_CHALLENGES.find((c) => c.slug === problem.slug)?.solution;
      const { data: outcome, error: invokeError } = await client.functions.invoke("submit-regex", {
        body: { round_id: round.id, pattern: solution },
      });

      if (invokeError) {
        fail("la Edge Function responde", invokeError.message);
      } else if (outcome?.status === "won") {
        ok("la consulta correcta gana la ronda", `${solution}`);
      } else {
        fail(
          "la consulta correcta gana la ronda",
          `respondio "${outcome?.status}" a ${solution}. La Edge Function desplegada todavia ` +
            "corrige con el motor de regex.",
        );
      }
    }
  }
}

await client.auth.signOut();
await guest.client.auth.signOut();

console.log(fallos === 0 ? "\nTodo en orden." : `\n${fallos} cosa(s) sin cuadrar.`);
process.exit(fallos === 0 ? 0 : 1);
