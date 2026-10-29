/**
 * Ataca la base como lo haria un tramposo, y comprueba que no lo consigue.
 *
 * Esto no es un test unitario, corre contra el proyecto real de Supabase con
 * la key publica, o sea exactamente con los mismos permisos que tiene
 * cualquiera que abra la consola del navegador. Por eso vive aparte de
 * `npm run test` y se lanza a mano:
 *
 *   node --env-file=.env.local scripts/verify-security.mjs
 *
 * Existe porque las politicas de RLS y los permisos de las funciones no se
 * pueden verificar leyendo el SQL. Ya paso una vez: `revoke ... from public`
 * parecia correcto y dejaba `submit_round_result` abierta a cualquier jugador,
 * que podia repartirse dano solo. Se vio ejecutando esto, no leyendo.
 *
 * Regla del archivo: para lo prohibido nunca basta con que la llamada devuelva
 * error. Con RLS un UPDATE sin politica afecta cero filas y devuelve exito, asi
 * que lo que se comprueba es el EFECTO, que el dato no haya cambiado.
 *
 * Usa tres cuentas fijas con correos @regexbattle.test. Son siempre las mismas,
 * se crean la primera vez y despues solo se inicia sesion, de modo que correrlo
 * mil veces no llena la tabla de usuarios. Borrarlas necesitaria la
 * service_role, que no vive aqui ni debe.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error(
    "Faltan VITE_SUPABASE_URL y la key publica.\n" +
      "Corre: node --env-file=.env.local scripts/verify-security.mjs",
  );
  process.exit(1);
}

const stamp = Date.now();
let failures = 0;

function check(label, pass, extra = "") {
  if (!pass) failures += 1;
  console.log(`${pass ? "OK   " : "FALLA"} ${label}${extra ? "  -> " + extra : ""}`);
}

/**
 * Entra con una de las cuentas fijas, y la crea si es la primera vez.
 * La contrasena es un valor de prueba conocido: estas cuentas viven en una
 * base de desarrollo y no protegen nada.
 */
async function account(tag) {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const credentials = {
    email: `verify-${tag}@regexbattle.test`,
    password: process.env.VERIFY_PASSWORD,
  };

  const { data: signedIn } = await client.auth.signInWithPassword(credentials);
  if (signedIn?.session) return { client, id: signedIn.user.id };

  const { data, error } = await client.auth.signUp(credentials);
  if (error) throw new Error(`no se pudo preparar la cuenta ${tag}: ${error.message}`);
  if (!data.session) {
    throw new Error(`la cuenta ${tag} quedo sin sesion. Apaga "Confirm email" en Authentication.`);
  }
  return { client, id: data.user.id };
}

const host = await account("host");
const guest = await account("guest");
const outsider = await account("outsider");

console.log("--- LECTURA ---");
const { data: problems } = await host.client.from("problems").select("id");
check("un jugador con sesion lee el banco", problems?.length > 0, `${problems?.length} retos`);

console.log("\n--- ESCRITURA QUE DEBE ESTAR PROHIBIDA ---");
const { error: insertProblem } = await host.client.from("problems").insert({
  slug: `hack-${stamp}`,
  language: "regex",
  prompt: "x".repeat(20),
  difficulty: 1,
  must_match: ["a"],
  must_not_match: ["b"],
});
check("no puede insertar un reto", Boolean(insertProblem));

const { error: insertSubmission } = await host.client
  .from("submissions")
  .insert({ player_id: host.id, regex: "a", passed: true });
check("no puede fabricar una submission ganadora", Boolean(insertSubmission));

console.log("\n--- SALAS ---");
// create_room ya no existe sin argumentos: la sala se crea con sus ajustes.
const { data: room, error: createError } = await host.client.rpc("create_room", {
  p_difficulty: "progresiva",
  p_initial_hp: 100,
  p_language: "regex",
});
check("el host crea sala", !createError && Boolean(room?.code), createError?.message);

const { error: badCode } = await guest.client.rpc("join_room", { p_code: "ZZZZZZ" });
check("un codigo inexistente falla", Boolean(badCode));

const { data: joined } = await guest.client.rpc("join_room", { p_code: room.code });
check("la partida arranca al entrar el segundo", joined?.status === "in_progress");
check("ambos con el HP inicial", joined?.host_hp === 100 && joined?.guest_hp === 100);
check("reto servido en la ronda 1", Boolean(joined?.current_problem_id));

const { data: rounds } = await host.client.from("rounds").select("*").eq("room_id", room.id);
check("la ronda existe y nadie la ha ganado", rounds?.length === 1 && rounds[0].winner_id === null);

console.log("\n--- ANTI TRAMPA, se comprueba el EFECTO ---");
await guest.client.from("rooms").update({ host_hp: 0 }).eq("id", room.id);
const { data: hp } = await guest.client.from("rooms").select("host_hp").eq("id", room.id).single();
check("NO puede bajarle el HP al otro", hp?.host_hp === 100, `quedo en ${hp?.host_hp}`);

await guest.client.from("rounds").update({ winner_id: guest.id }).eq("id", rounds[0].id);
const { data: won } = await guest.client
  .from("rounds")
  .select("winner_id")
  .eq("id", rounds[0].id)
  .single();
check("NO puede declararse ganador de la ronda", won?.winner_id === null);

await guest.client
  .from("rooms")
  .update({ status: "finished", winner_id: guest.id })
  .eq("id", room.id);
const { data: ended } = await guest.client
  .from("rooms")
  .select("status, winner_id")
  .eq("id", room.id)
  .single();
check(
  "NO puede terminar la partida a su favor",
  ended?.status === "in_progress" && ended?.winner_id === null,
);

const { data: peekRoom } = await outsider.client.from("rooms").select("*").eq("id", room.id);
check("alguien de fuera no ve la sala", peekRoom?.length === 0);

const { data: peekRounds } = await outsider.client
  .from("rounds")
  .select("*")
  .eq("room_id", room.id);
check("alguien de fuera no ve las rondas", peekRounds?.length === 0);

// El corazon del anti-trampa: la unica funcion que mueve HP.
const hpBefore = joined.host_hp;
const { error: rogue } = await guest.client.rpc("submit_round_result", {
  p_round_id: rounds[0].id,
  p_player_id: guest.id,
  p_regex: "trampa",
  p_passed: true,
});
const { data: hpAfter } = await guest.client
  .from("rooms")
  .select("host_hp")
  .eq("id", room.id)
  .single();
check(
  "NO puede repartirse dano llamando a submit_round_result",
  Boolean(rogue) && hpAfter?.host_hp === hpBefore,
  rogue ? rogue.message.slice(0, 50) : `el HP paso a ${hpAfter?.host_hp}`,
);

for (const [fn, args] of [
  ["pick_next_problem", { p_used: [], p_round_number: 1 }],
  ["generate_room_code", {}],
]) {
  const { error } = await host.client.rpc(fn, args);
  check(`${fn} no es llamable desde el navegador`, Boolean(error));
}

console.log("\n--- LO QUE SI DEBE FUNCIONAR ---");
const { data: left } = await host.client.rpc("leave_room", { p_room_id: room.id });
check(
  "abandonar entrega la partida al otro",
  left?.status === "finished" && left?.winner_id === guest.id,
);

const { error: ownRun } = await host.client.from("solo_runs").insert({
  player_id: host.id,
  solved_count: 3,
  best_streak: 2,
  duration_ms: 45000,
  finished_at: new Date().toISOString(),
});
check("puede guardar su propia tanda del modo solo", !ownRun, ownRun?.message);

const { error: foreignRun } = await host.client
  .from("solo_runs")
  .insert({ player_id: guest.id, solved_count: 99, best_streak: 99, duration_ms: 1 });
check("no puede guardar una tanda a nombre de otro", Boolean(foreignRun));

console.log(
  failures === 0
    ? "\nTodo en orden, la base aguanta.\n"
    : `\n${failures} comprobacion(es) fallaron. NO es jugable asi.\n`,
);
process.exit(failures === 0 ? 0 : 1);
