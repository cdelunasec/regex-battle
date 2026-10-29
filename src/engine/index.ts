/**
 * Public surface of the challenge engine.
 *
 * Everything under `src/engine` is copied verbatim into
 * `supabase/functions/_shared/engine` by `npm run sync:engine`, so keep this
 * folder free of browser only and Deno only APIs.
 */
export * from "./types.ts";
export * from "./guard.ts";
export * from "./evaluate.ts";
export * from "./js-matcher.ts";
export * from "./kql-parse.ts";
export * from "./kql-matcher.ts";
export * from "./matches.ts";

import { evaluatePattern } from "./evaluate.ts";
import { jsMatcherEngine } from "./js-matcher.ts";
import { kqlMatcherEngine } from "./kql-matcher.ts";
import type {
  ChallengeLanguage,
  EvaluableChallenge,
  EvaluationResult,
  MatcherEngine,
} from "./types.ts";

/** Convenience wrapper over `evaluatePattern` using the default backend. */
export function evaluateWithJs(pattern: string, challenge: EvaluableChallenge): EvaluationResult {
  return evaluatePattern(pattern, challenge, jsMatcherEngine);
}

/** El corrector de cada lenguaje. Sumar uno nuevo es añadir una entrada aquí. */
export const ENGINES: Record<ChallengeLanguage, MatcherEngine> = {
  regex: jsMatcherEngine,
  kql: kqlMatcherEngine,
};

export function engineFor(language: ChallengeLanguage): MatcherEngine {
  return ENGINES[language] ?? jsMatcherEngine;
}

/** Corrige con el motor del lenguaje del reto. */
export function evaluateFor(
  language: ChallengeLanguage,
  pattern: string,
  challenge: EvaluableChallenge,
): EvaluationResult {
  return evaluatePattern(pattern, challenge, engineFor(language));
}
