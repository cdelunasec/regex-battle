// GENERATED FILE. Edit src/engine and run `npm run sync:engine`.
/**
 * Dónde encaja un patrón, no solo si encaja.
 *
 * El juego solo necesita un sí o un no, pero enseñar necesita señalar: "esta
 * parte del texto es la que capturó tu patrón". De ahí este módulo.
 *
 * Pasa por las mismas guardas que todo lo demás, así que un patrón peligroso
 * tampoco puede colgar la pantalla de una lección.
 */
import { guardPattern } from "./guard.ts";
import type { EvaluationError, MatchMode } from "./types.ts";

export interface MatchRange {
  start: number;
  /** Índice siguiente al último carácter, como en `slice`. */
  end: number;
  text: string;
}

export interface MatchesResult {
  ranges: MatchRange[];
  error: EvaluationError | null;
}

/** Tope de coincidencias, por si alguien escribe algo que encaja en todo. */
const MAX_MATCHES = 200;

/**
 * Busca todas las coincidencias de `pattern` en `input`.
 *
 * En modo `full` solo hay una respuesta posible, el texto entero o nada, así
 * que devuelve el rango completo o ninguno.
 */
export function findMatches(
  pattern: string,
  input: string,
  mode: MatchMode = "partial",
): MatchesResult {
  const guardError = guardPattern(pattern);
  if (guardError) return { ranges: [], error: guardError };

  let regexp: RegExp;
  try {
    regexp = new RegExp(mode === "full" ? `^(?:${pattern})$` : pattern, "g");
  } catch (cause) {
    return {
      ranges: [],
      error: {
        kind: "syntax",
        code: "invalid_pattern",
        message: cause instanceof Error ? cause.message : "El patrón no es válido.",
      },
    };
  }

  const ranges: MatchRange[] = [];
  let match: RegExpExecArray | null;

  while ((match = regexp.exec(input)) !== null) {
    ranges.push({ start: match.index, end: match.index + match[0].length, text: match[0] });

    // Un patrón que puede encajar con vacío, como `a*`, no avanza solo y
    // dejaría el bucle girando para siempre.
    if (match[0].length === 0) regexp.lastIndex += 1;
    if (ranges.length >= MAX_MATCHES) break;
  }

  return { ranges, error: null };
}

/**
 * Parte el texto en trozos, marcando cuáles capturó el patrón. Es lo que la UI
 * necesita para pintar el resaltado sin hacer cuentas de índices.
 */
export function splitByMatches(
  input: string,
  ranges: MatchRange[],
): Array<{ text: string; matched: boolean }> {
  if (ranges.length === 0) return input.length > 0 ? [{ text: input, matched: false }] : [];

  const parts: Array<{ text: string; matched: boolean }> = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      parts.push({ text: input.slice(cursor, range.start), matched: false });
    }
    if (range.end > range.start) {
      parts.push({ text: input.slice(range.start, range.end), matched: true });
    }
    cursor = Math.max(cursor, range.end);
  }

  if (cursor < input.length) parts.push({ text: input.slice(cursor), matched: false });
  return parts;
}
