/**
 * submit-regex: la única puerta por la que se reparte daño.
 *
 * El cliente valida en local para el feedback en vivo, pero eso no cuenta. El
 * jugador manda su patrón aquí, el servidor lo vuelve a evaluar con el MISMO
 * motor que corre en el navegador, y solo si pasa se intenta reclamar la ronda.
 *
 * Tres cosas nunca se aceptan de lo que manda el cliente:
 *   - quién es. La identidad sale del JWT, no del cuerpo del mensaje.
 *   - si el patrón pasó. Eso lo decide este código, no el navegador.
 *   - cuánto daño hace. Sale del `config` de la sala, dentro de Postgres.
 *
 * La service_role solo existe aquí, como variable de entorno del runtime. Es la
 * única llave que puede llamar a `submit_round_result`.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { evaluateFor } from "../_shared/engine/index.ts";
import type {
  ChallengeLanguage,
  EvaluableChallenge,
  MatchMode,
} from "../_shared/engine/index.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

interface SubmitBody {
  round_id?: unknown;
  pattern?: unknown;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    console.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno");
    return json({ error: "La función no está configurada" }, 500);
  }

  // La identidad sale del token, nunca del cuerpo. Un jugador no puede decir
  // que es otro.
  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Falta la sesión" }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const player = userData?.user;
  if (userError || !player) return json({ error: "Sesión inválida" }, 401);

  let body: SubmitBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: "El cuerpo no es JSON válido" }, 400);
  }

  const roundId = typeof body.round_id === "string" ? body.round_id : "";
  const pattern = typeof body.pattern === "string" ? body.pattern : "";

  if (!UUID.test(roundId)) return json({ error: "round_id inválido" }, 400);
  // El motor topa el patrón en 200 caracteres. Cortar antes evita mover de
  // balde un cuerpo enorme.
  if (pattern.length === 0 || pattern.length > 500) {
    return json({ error: "El patrón está vacío o es demasiado largo" }, 400);
  }

  // La ronda y el reto se leen del servidor. Si vinieran del cliente, mandaría
  // un reto trivial y ganaría con `a`.
  const { data: round, error: roundError } = await admin
    .from("rounds")
    .select("id, room_id, problem_id, winner_id")
    .eq("id", roundId)
    .maybeSingle();

  if (roundError) {
    console.error("Error leyendo la ronda", roundError);
    return json({ error: "No se pudo leer la ronda" }, 500);
  }
  if (!round) return json({ status: "not_found" }, 404);

  const { data: problem, error: problemError } = await admin
    .from("problems")
    .select("language, match_mode, must_match, must_not_match")
    .eq("id", round.problem_id)
    .maybeSingle();

  if (problemError || !problem) {
    console.error("Error leyendo el reto", problemError);
    return json({ error: "No se pudo leer el reto" }, 500);
  }

  const challenge: EvaluableChallenge = {
    match_mode: problem.match_mode as MatchMode,
    must_match: problem.must_match as string[],
    must_not_match: problem.must_not_match as string[],
  };

  // El mismo motor y las mismas guardas que en el navegador, y el corrector
  // del lenguaje del reto. Este es el veredicto que cuenta.
  const result = evaluateFor(problem.language as ChallengeLanguage, pattern, challenge);

  // Se registra el intento aunque falle: `submit_round_result` guarda la
  // submission y de ahí sale el límite de frecuencia.
  const { data: outcome, error: rpcError } = await admin.rpc("submit_round_result", {
    p_round_id: roundId,
    p_player_id: player.id,
    p_regex: pattern,
    p_passed: result.passed,
  });

  if (rpcError) {
    console.error("Error resolviendo la ronda", rpcError);
    return json({ error: "No se pudo registrar el envío" }, 500);
  }

  return json({
    ...(outcome as Record<string, unknown>),
    // Para que el cliente pueda explicar por qué no pasó, sin volver a evaluar.
    evaluation: {
      passed: result.passed,
      error: result.error,
      passedCount: result.passedCount,
      totalCount: result.totalCount,
    },
  });
});
