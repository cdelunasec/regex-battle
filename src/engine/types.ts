/**
 * Core types for the challenge engine.
 *
 * This module is shared verbatim between the browser client and the Deno edge
 * function, so it must not import anything outside of `src/engine`.
 */

/** How a candidate pattern is compared against a test string. */
export type MatchMode = "partial" | "full";

/** Cada lenguaje entra como un `MatcherEngine` nuevo, sin tocar el evaluador. */
export type ChallengeLanguage = "regex" | "kql";

/** A challenge as stored in the `problems` table. */
export interface Challenge {
  id: string;
  language: ChallengeLanguage;
  prompt: string;
  difficulty: number;
  match_mode: MatchMode;
  must_match: string[];
  must_not_match: string[];
}

/** The subset of a challenge the engine actually needs to evaluate. */
export type EvaluableChallenge = Pick<Challenge, "match_mode" | "must_match" | "must_not_match">;

/** Result of running one test string through the candidate pattern. */
export interface CaseResult {
  input: string;
  /** Whether the pattern is supposed to match this string. */
  expected: boolean;
  /** Whether it actually did. */
  actual: boolean;
  /** `expected === actual`. */
  ok: boolean;
}

export type EvaluationErrorKind = "syntax" | "guard";

export interface EvaluationError {
  kind: EvaluationErrorKind;
  /** Stable machine readable code, e.g. 'nested_quantifier'. */
  code: string;
  /** Human readable message, in Spanish, safe to show to the player. */
  message: string;
}

export interface EvaluationResult {
  /** True only when every single case is `ok` and there is no error. */
  passed: boolean;
  error: EvaluationError | null;
  mustMatch: CaseResult[];
  mustNotMatch: CaseResult[];
  /** How many cases came back `ok`, across both lists. */
  passedCount: number;
  /** Total number of cases. */
  totalCount: number;
}

/** A compiled pattern, reduced to the one question the engine asks. */
export type CompiledPattern = (input: string) => boolean;

/**
 * Pluggable regex backend. The evaluation core never imports a concrete
 * engine, which is what lets the same code run on `RegExp` in the browser and
 * on something else (RE2, a Python sandbox) on the server later on.
 */
export interface MatcherEngine {
  /**
   * Rechaza un patrón antes de compilarlo, o devuelve null si es seguro.
   *
   * Vive aquí y no en el evaluador porque cada lenguaje tiene sus peligros: en
   * regex son los cuantificadores anidados, que cuelgan el motor con retroceso;
   * en KQL no hay retroceso y lo único que se vigila es el tamaño.
   */
  guard(pattern: string): EvaluationError | null;
  /** Compiles a pattern, or throws when the syntax is invalid. */
  compile(pattern: string, mode: MatchMode): CompiledPattern;
}
