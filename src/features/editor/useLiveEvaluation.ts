import { useMemo } from "react";
import {
  evaluateFor,
  type ChallengeLanguage,
  type EvaluableChallenge,
  type EvaluationResult,
} from "@/engine";

/**
 * Runs the challenge engine on every keystroke.
 *
 * No debounce on purpose. The guard rejects the patterns that could actually
 * take time before anything is compiled, and the test strings are capped at
 * 200 characters, so a full evaluation is microseconds. Feedback that lags
 * behind the cursor is worse than useless in a race.
 *
 * This is the client side half of the double validation: instant, and it does
 * not decide anything. In a 1v1 the server runs this exact same engine again
 * and that verdict is the one that lands the hit.
 *
 * El lenguaje decide el corrector. Si aquí se corrigiera siempre con el de
 * regex, un reto de KQL daría un veredicto distinto al del servidor, que es lo
 * peor que puede pasar en una pelea: verías "resuelto" y no pegaría el golpe.
 */
export function useLiveEvaluation(
  pattern: string,
  challenge: EvaluableChallenge | null,
  language: ChallengeLanguage = "regex",
): EvaluationResult | null {
  return useMemo(() => {
    if (!challenge) return null;
    return evaluateFor(language, pattern, challenge);
  }, [pattern, challenge, language]);
}
