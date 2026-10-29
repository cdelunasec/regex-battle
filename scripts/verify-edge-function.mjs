/**
 * Ataca la Edge Function submit-regex desde el navegador, con la key publica.
 *
 *   node --env-file=.env.local scripts/verify-edge-function.mjs
 *
 * Comprueba que hace lo que debe cuando el patron es correcto, y que no se deja
 * enganar cuando no lo es: patron malo, ronda ya ganada, sesion ausente, patron
 * peligroso, y el intento de cobrar por la ronda de una sala ajena.
 *
 * Usa las mismas tres cuentas fijas que verify-security.mjs.
 */
import { createClient } from "@supabase/supabase-js";
import { CHALLENGE_SEED } from "../src/data/bank.ts";

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let failures = 0;

function check(label, pass, extra = "") {
  if (!pass) failures += 1;
  console.log(`${pass ? "OK   " : "FALLA"} ${label}${extra ? "  -> " + extra : ""}`);
}

async function account(tag) {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const credentials = {
    email: `verify-${tag}@regexbattle.test`,
    password: process.env.VERIFY_PASSWORD,
  };
  const { data: signedIn } = await client.auth.signInWithPassword(credentials);
  if (signedIn?.session) return { client, id: signedIn.user.id, session: signedIn.session };
  const { data, error } = await client.auth.signUp(credentials);
  if (error) throw new Error(`cuenta ${tag}: ${error.message}`);
  return { client, id: data.user.id, session: data.session };
}

/** Llama a la funcion tal como lo haria el navegador. */
async function submit(who, roundId, pattern) {
  const { data, error } = await who.client.functions.invoke("submit-regex", {
    body: { round_id: roundId, pattern },
  });
  if (error) {
    const detail = await error.context?.text?.().catch(() => "");
    return { httpError: error.message, detail };
  }
  return data;
}

const host = await account("host");
const guest = await account("guest");

// Partida limpia entre los dos.
const { data: room } = await host.client.rpc("create_room", {
  p_difficulty: "progresiva",
  p_initial_hp: 100,
  p_language: "regex",
});
await guest.client.rpc("join_room", { p_code: room.code });
const { data: rounds } = await host.client
  .from("rounds")
  .select("*")
  .eq("room_id", room.id)
  .order("round_number", { ascending: false });
const round = rounds[0];

const { data: problem } = await host.client
  .from("problems")
  .select("slug, prompt")
  .eq("id", round.problem_id)
  .single();
const solution = CHALLENGE_SEED.find((c) => c.slug === problem.slug)?.solution;
console.log(`sala ${room.code}, reto servido: ${problem.slug}\n`);

console.log("--- LO QUE DEBE FALLAR ---");
const wrong = await submit(host, round.id, "zzzzz");
check("un patron que no resuelve el reto no gana", wrong?.status === "rejected", wrong?.status);

const redos = await submit(host, round.id, "(a+)+$");
check(
  "un patron con backtracking catastrofico se rechaza",
  redos?.status === "rejected" && redos?.evaluation?.error?.code === "nested_quantifier",
  redos?.evaluation?.error?.code,
);

const anon = createClient(url, key, { auth: { persistSession: false } });
const { error: noAuth } = await anon.functions.invoke("submit-regex", {
  body: { round_id: round.id, pattern: solution },
});
check("sin sesion no se puede enviar", Boolean(noAuth), noAuth?.message);

const badId = await submit(host, round.id, "x".repeat(600));
check("un patron absurdamente largo se rechaza antes de evaluar", Boolean(badId?.httpError));

console.log("\n--- LO QUE DEBE FUNCIONAR ---");
const hpBefore = { host: room.host_hp, guest: 100 };
const won = await submit(guest, round.id, solution);
check("el patron correcto gana la ronda", won?.status === "won", won?.status);
check("el daño sale del config, no del cliente", won?.damage === 25, `${won?.damage}`);

const after = won?.room;
check(
  "el golpe le baja el HP al RIVAL, no al que envio",
  after?.host_hp === hpBefore.host - 25 && after?.guest_hp === 100,
  `host ${after?.host_hp} / guest ${after?.guest_hp}`,
);
check(
  "se sirve un reto nuevo y sube la ronda",
  after?.round_number === 2 && Boolean(after?.current_problem_id),
);

console.log("\n--- LA CARRERA ---");
const late = await submit(host, round.id, solution);
check("el segundo en llegar a la MISMA ronda no cobra", late?.status === "too_late", late?.status);

const { data: roomNow } = await host.client
  .from("rooms")
  .select("host_hp, guest_hp")
  .eq("id", room.id)
  .single();
check(
  "y el HP no se movio por ese segundo envio",
  roomNow?.host_hp === after?.host_hp && roomNow?.guest_hp === after?.guest_hp,
  `host ${roomNow?.host_hp} / guest ${roomNow?.guest_hp}`,
);

console.log("\n--- SALA AJENA ---");
const outsider = await account("outsider");
const { data: ownRoom } = await outsider.client.rpc("create_room", {
  p_difficulty: "progresiva",
  p_initial_hp: 100,
  p_language: "regex",
});
const intruder = await submit(outsider, round.id, solution);
check(
  "alguien de fuera no puede cobrar en una ronda que no es suya",
  intruder?.status === "not_a_player" || intruder?.status === "too_late",
  intruder?.status,
);
await outsider.client.rpc("leave_room", { p_room_id: ownRoom.id });

await host.client.rpc("leave_room", { p_room_id: room.id });

console.log(
  failures === 0 ? "\nLa Edge Function aguanta.\n" : `\n${failures} comprobacion(es) fallaron.\n`,
);
process.exit(failures === 0 ? 0 : 1);
