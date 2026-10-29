import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Progreso del curso.
 *
 * A diferencia de las tablas de combate, aquí el jugador sí escribe sus propias
 * filas. No hay nada que ganar marcando una lección como hecha, así que no hay
 * nada que proteger más allá de que cada quien solo toque lo suyo, y de eso se
 * encarga el RLS.
 */
export function useProgress(userId: string | null) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  /** Verdadero cuando la base no responde, para poder avisar en vez de mentir. */
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("lesson_progress")
      .select("lesson_slug")
      .eq("player_id", userId);

    if (error) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    setCompleted(new Set((data ?? []).map((row) => row.lesson_slug)));
    setUnavailable(false);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Marca una lección como hecha. Es idempotente: repetirla actualiza la fila
   * en vez de fallar por la clave única de jugador y lección.
   */
  const complete = useCallback(
    async (lessonSlug: string, solution?: string) => {
      // Optimista: quien acaba de resolver el ejercicio ya sabe que lo resolvió,
      // no tiene por qué esperar a la red para verlo marcado.
      setCompleted((current) => new Set(current).add(lessonSlug));
      if (!userId) return;

      const { error } = await supabase.from("lesson_progress").upsert(
        {
          player_id: userId,
          lesson_slug: lessonSlug,
          // Se guarda para poder repasarla, topada por el límite de la columna.
          // En C# no se guarda ninguna: un programa entero no cabe ahí.
          solution: solution ? solution.slice(0, 200) : null,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "player_id,lesson_slug" },
      );
      if (error) setUnavailable(true);
    },
    [userId],
  );

  /** Poder empezar de nuevo es parte de aprender. */
  const reset = useCallback(async () => {
    setCompleted(new Set());
    if (!userId) return;
    await supabase.from("lesson_progress").delete().eq("player_id", userId);
  }, [userId]);

  return { completed, loading, unavailable, complete, reset, reload: load };
}
