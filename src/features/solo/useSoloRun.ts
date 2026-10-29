import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { orderProblems } from "@/features/solo/soloRun";
import { useSoloSession } from "@/features/solo/useSoloSession";
import { toProblems, type Problem } from "@/types/game";
import type { ChallengeLanguage } from "@/engine";

/**
 * Wires the pure solo run state to Supabase and to the clock.
 *
 * The challenge bank is read with the anon key under RLS, exactly like any
 * other player would. Nothing here decides anything a server would care about:
 * solo mode has no opponent, so the client owns its own score.
 */
export function useSoloRun(userId: string | null, language: ChallengeLanguage = "regex") {
  const session = useSoloSession<Problem>(userId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { load, reset } = session;

  useEffect(() => {
    let active = true;

    async function fetchBank() {
      const { data, error } = await supabase.from("problems").select("*").eq("language", language);

      if (!active) return;
      if (error) {
        setLoadError(error.message);
        return;
      }
      load(orderProblems(toProblems(data ?? [])));
    }

    // Cambiar de lenguaje empieza una tanda nueva: los retos son otros y la
    // racha de la anterior no cuenta.
    reset();
    setLoadError(null);
    void fetchBank();
    return () => {
      active = false;
    };
  }, [language, load, reset]);

  return { ...session, loadError };
}
