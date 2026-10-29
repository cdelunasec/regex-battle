import { useCallback, useEffect, useReducer, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  currentProblem,
  initialSoloState,
  soloReducer,
  type Rankable,
} from "@/features/solo/soloRun";

/**
 * Una tanda de práctica solo, sin importar de dónde salen los retos.
 *
 * El reloj y el guardado de la tanda terminada son iguales para todos los
 * lenguajes. Lo que cambia es la carga: los retos de regex y KQL vienen de la
 * base, los de C# del repo. Por eso la carga queda fuera, y quien use esto le
 * pasa los retos con `load`.
 */
export function useSoloSession<T extends Rankable>(userId: string | null) {
  const [state, dispatch] = useReducer(soloReducer<T>, initialSoloState);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [saved, setSaved] = useState(false);

  // El reloj corre solo mientras hay una tanda en marcha.
  useEffect(() => {
    if (state.status !== "running" || state.startedAt === null) return;
    const startedAt = state.startedAt;

    setElapsedMs(Date.now() - startedAt);
    const timer = window.setInterval(() => setElapsedMs(Date.now() - startedAt), 500);
    return () => window.clearInterval(timer);
  }, [state.status, state.startedAt]);

  // Una tanda terminada se guarda, pero si la escritura falla la pantalla de
  // resumen no se rompe: el resultado ya lo tiene el jugador delante.
  useEffect(() => {
    if (state.status !== "finished" || saved || !userId) return;
    setSaved(true);

    void supabase.from("solo_runs").insert({
      player_id: userId,
      solved_count: state.solved,
      best_streak: state.bestStreak,
      duration_ms: state.durationMs,
      finished_at: new Date().toISOString(),
    });
  }, [state.status, state.solved, state.bestStreak, state.durationMs, saved, userId]);

  const load = useCallback((problems: T[]) => dispatch({ type: "loaded", problems }), []);

  const start = useCallback(() => {
    setSaved(false);
    setElapsedMs(0);
    dispatch({ type: "start", at: Date.now() });
  }, []);

  const solve = useCallback(() => dispatch({ type: "solved", at: Date.now() }), []);
  const skip = useCallback(() => dispatch({ type: "skip", at: Date.now() }), []);
  const finish = useCallback(() => dispatch({ type: "finish", at: Date.now() }), []);
  const reset = useCallback(() => {
    setSaved(false);
    setElapsedMs(0);
    dispatch({ type: "reset" });
  }, []);

  return {
    state,
    problem: currentProblem(state),
    elapsedMs: state.status === "finished" ? state.durationMs : elapsedMs,
    load,
    start,
    solve,
    skip,
    finish,
    reset,
  };
}
