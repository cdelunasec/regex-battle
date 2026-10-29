import { supabase } from "@/integrations/supabase/client";
import type { EvaluationError } from "@/engine";

/** Los desenlaces que puede devolver el servidor para un envío. */
export type SubmitStatus =
  | "won"
  | "too_late"
  | "rejected"
  | "rate_limited"
  | "match_over"
  | "not_a_player"
  | "not_found"
  | "error";

export interface SubmitOutcome {
  status: SubmitStatus;
  damage?: number;
  evaluation?: {
    passed: boolean;
    error: EvaluationError | null;
  };
  /** Mensaje listo para enseñar cuando algo salió mal. */
  message?: string | undefined;
}

const MESSAGES: Partial<Record<SubmitStatus, string>> = {
  too_late: "Tu rival llegó primero a esta ronda.",
  rejected: "El servidor no dio por bueno ese patrón.",
  rate_limited: "Vas muy rápido enviando. Espera un segundo.",
  match_over: "La partida ya terminó.",
  not_a_player: "No estás jugando en esa sala.",
  not_found: "Esa ronda ya no existe.",
  error: "No se pudo enviar. Revisa la conexión e inténtalo otra vez.",
};

/**
 * Manda el patrón al servidor, que es quien decide.
 *
 * El cliente ya validó en local para el feedback en vivo, pero eso no reparte
 * daño. Aquí la Edge Function vuelve a evaluar con el mismo motor y el
 * veredicto que vuelve es el que cuenta.
 */
export async function submitRegex(roundId: string, pattern: string): Promise<SubmitOutcome> {
  const { data, error } = await supabase.functions.invoke("submit-regex", {
    body: { round_id: roundId, pattern },
  });

  if (error) {
    return { status: "error", message: MESSAGES.error };
  }

  const outcome = data as SubmitOutcome;
  return { ...outcome, message: MESSAGES[outcome.status] };
}
