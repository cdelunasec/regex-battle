// GENERATED FILE. Edit src/engine and run `npm run sync:engine`.
/**
 * The evaluation core.
 *
 * A pattern passes a challenge only when it matches every string in
 * `must_match` and no string in `must_not_match`. Deterministic, fast and the
 * same rule on both sides of the wire.
 *
 * This module never imports a concrete regex backend, it receives one. That is
 * what keeps the client, the edge function and any future language plugging
 * into the exact same logic.
 */
import { guardTestCases } from "./guard.ts";
import type {
  CaseResult,
  EvaluableChallenge,
  EvaluationError,
  EvaluationResult,
  MatcherEngine,
} from "./types.ts";

function buildFailedResult(
  challenge: EvaluableChallenge,
  error: EvaluationError,
): EvaluationResult {
  const unresolved = (input: string, expected: boolean): CaseResult => ({
    input,
    expected,
    actual: false,
    ok: false,
  });

  return {
    passed: false,
    error,
    mustMatch: challenge.must_match.map((input) => unresolved(input, true)),
    mustNotMatch: challenge.must_not_match.map((input) => unresolved(input, false)),
    passedCount: 0,
    totalCount: challenge.must_match.length + challenge.must_not_match.length,
  };
}

/**
 * Runs `pattern` against a challenge. Never throws: an invalid pattern or a
 * rejected one comes back as `error` so the caller can render it.
 */
export function evaluatePattern(
  pattern: string,
  challenge: EvaluableChallenge,
  engine: MatcherEngine,
): EvaluationResult {
  // El guardia lo pone el motor: el de regex no sabe nada de KQL, ni al revés.
  const guardError =
    engine.guard(pattern) ??
    guardTestCases(challenge.must_match) ??
    guardTestCases(challenge.must_not_match);

  if (guardError) return buildFailedResult(challenge, guardError);

  let compiled;
  try {
    compiled = engine.compile(pattern, challenge.match_mode);
  } catch (cause) {
    return buildFailedResult(challenge, {
      kind: "syntax",
      code: "invalid_pattern",
      message: cause instanceof Error ? cause.message : "El patrón no es válido.",
    });
  }

  const run = (input: string, expected: boolean): CaseResult => {
    const actual = compiled(input);
    return { input, expected, actual, ok: actual === expected };
  };

  const mustMatch = challenge.must_match.map((input) => run(input, true));
  const mustNotMatch = challenge.must_not_match.map((input) => run(input, false));
  const all = [...mustMatch, ...mustNotMatch];
  const passedCount = all.filter((result) => result.ok).length;

  return {
    passed: all.length > 0 && passedCount === all.length,
    error: null,
    mustMatch,
    mustNotMatch,
    passedCount,
    totalCount: all.length,
  };
}
