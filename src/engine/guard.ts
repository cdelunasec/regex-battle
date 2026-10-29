/**
 * Static guards against catastrophic backtracking (ReDoS) and oversized input.
 *
 * The player writes the pattern, so it reaches us as untrusted code for the
 * regex engine. We reject the shapes that are known to blow up before ever
 * handing the pattern to the backend. This runs on both sides: in the browser
 * so the player gets an instant explanation, and in the edge function because
 * that is the one that actually counts.
 */
import type { EvaluationError } from "./types.ts";

export const PATTERN_MAX_LENGTH = 200;
export const BOUNDED_REPEAT_MAX = 100;
export const TEST_STRING_MAX_LENGTH = 200;
export const TEST_CASES_MAX_PER_LIST = 30;

interface Quantifier {
  /** Index just past the quantifier. */
  end: number;
  /** Highest number of repetitions allowed, `Infinity` when unbounded. */
  max: number;
}

/**
 * Reads a quantifier starting at `i`, if there is one. Returns null when the
 * character at `i` does not open a quantifier.
 */
function readQuantifier(pattern: string, i: number): Quantifier | null {
  const c = pattern[i];
  if (c === "*" || c === "+") return { end: i + 1, max: Infinity };
  if (c === "?") return { end: i + 1, max: 1 };
  if (c !== "{") return null;

  const close = pattern.indexOf("}", i);
  if (close === -1) return null;
  const bounded = /^(\d+)(,(\d*))?$/.exec(pattern.slice(i + 1, close));
  if (!bounded) return null;

  const min = Number(bounded[1]);
  let max: number;
  if (bounded[2] === undefined) max = min;
  else if (bounded[3] === undefined || bounded[3] === "") max = Infinity;
  else max = Number(bounded[3]);

  return { end: close + 1, max };
}

/**
 * Maps every `(` to its matching `)`, skipping escapes and character classes
 * so that a literal paren inside brackets is not read as a real group.
 */
function mapGroups(pattern: string): Map<number, number> {
  const pairs = new Map<number, number>();
  const open: number[] = [];
  let inClass = false;

  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }
    if (c === "[") {
      inClass = true;
      continue;
    }
    if (c === "(") {
      open.push(i);
    } else if (c === ")") {
      const start = open.pop();
      if (start !== undefined) pairs.set(start, i);
    }
  }
  return pairs;
}

/** True when the body contains a quantifier that allows unbounded repetition. */
function hasUnboundedQuantifier(body: string): boolean {
  let inClass = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }
    if (c === "[") {
      inClass = true;
      continue;
    }
    const quantifier = readQuantifier(body, i);
    if (quantifier && quantifier.max === Infinity) return true;
  }
  return false;
}

/** Splits a group body on its top level pipes, ignoring nested groups and classes. */
function splitAlternatives(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let inClass = false;
  let start = 0;

  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }
    if (c === "[") inClass = true;
    else if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "|" && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  return parts;
}

/** Strips a leading group modifier, the non capturing and lookaround prefixes. */
function stripGroupPrefix(body: string): string {
  if (!body.startsWith("?")) return body;
  const named = /^\?<[a-zA-Z_$][\w$]*>/.exec(body);
  if (named) return body.slice(named[0].length);
  const modifier = /^\?(<=|<!|:|=|!)/.exec(body);
  if (modifier) return body.slice(modifier[0].length);
  return body;
}

/**
 * Checks a player submitted pattern. Returns null when it is safe to compile,
 * or the reason to reject it.
 */
export function guardPattern(pattern: string): EvaluationError | null {
  if (pattern.trim().length === 0) {
    return {
      kind: "guard",
      code: "empty_pattern",
      message: "Escribe un patrón para empezar.",
    };
  }

  if (pattern.length > PATTERN_MAX_LENGTH) {
    return {
      kind: "guard",
      code: "pattern_too_long",
      message: `El patrón no puede pasar de ${PATTERN_MAX_LENGTH} caracteres.`,
    };
  }

  const groups = mapGroups(pattern);
  let inClass = false;

  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }
    if (c === "[") {
      inClass = true;
      continue;
    }

    // A bounded repetition with a huge ceiling expands into a huge automaton.
    if (c === "{") {
      const quantifier = readQuantifier(pattern, i);
      if (quantifier && quantifier.max !== Infinity && quantifier.max > BOUNDED_REPEAT_MAX) {
        return {
          kind: "guard",
          code: "repetition_too_large",
          message: `Las repeticiones no pueden pasar de ${BOUNDED_REPEAT_MAX}.`,
        };
      }
      continue;
    }

    if (c !== "(") continue;

    const close = groups.get(i);
    if (close === undefined) continue;

    const quantifier = readQuantifier(pattern, close + 1);
    // Only a group that can repeat more than once backtracks explosively.
    if (!quantifier || quantifier.max <= 1) continue;

    const body = stripGroupPrefix(pattern.slice(i + 1, close));

    if (hasUnboundedQuantifier(body)) {
      return {
        kind: "guard",
        code: "nested_quantifier",
        message:
          "Ese patrón tiene un cuantificador dentro de otro que también se repite, algo como (a+)+, y puede colgar el motor. Reescríbelo sin anidarlos.",
      };
    }

    const alternatives = splitAlternatives(body);
    if (alternatives.length > 1) {
      const seen = new Set<string>();
      for (const alternative of alternatives) {
        if (seen.has(alternative)) {
          return {
            kind: "guard",
            code: "ambiguous_alternation",
            message:
              "Ese patrón repite la misma opción dentro de una alternancia que se repite, algo como (a|a)*, y puede colgar el motor.",
          };
        }
        seen.add(alternative);
      }
    }
  }

  return null;
}

/**
 * Sanity check for the test lists. They come from our own database rather than
 * from the player, so this is a tripwire for a bad seed, not a security
 * boundary.
 */
export function guardTestCases(cases: string[]): EvaluationError | null {
  if (cases.length > TEST_CASES_MAX_PER_LIST) {
    return {
      kind: "guard",
      code: "too_many_cases",
      message: "El reto tiene demasiados casos de prueba.",
    };
  }
  for (const value of cases) {
    if (value.length > TEST_STRING_MAX_LENGTH) {
      return {
        kind: "guard",
        code: "case_too_long",
        message: "El reto tiene un caso de prueba demasiado largo.",
      };
    }
  }
  return null;
}
