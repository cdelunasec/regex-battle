/**
 * The default matcher backend, built on the platform `RegExp`.
 *
 * Available identically in the browser and in Deno, which is why the client
 * preview and the server ruling can never disagree on a verdict.
 */
import { guardPattern } from "./guard.ts";
import type { CompiledPattern, MatchMode, MatcherEngine } from "./types.ts";

/**
 * In `full` mode the pattern has to consume the whole string. Wrapping it in a
 * non capturing group keeps the player's own group numbering intact, so
 * backreferences still work.
 */
function toSource(pattern: string, mode: MatchMode): string {
  return mode === "full" ? `^(?:${pattern})$` : pattern;
}

export const jsMatcherEngine: MatcherEngine = {
  guard: guardPattern,

  compile(pattern: string, mode: MatchMode): CompiledPattern {
    // No global flag, so there is no lastIndex to reset between calls.
    const regexp = new RegExp(toSource(pattern, mode));
    return (input: string) => regexp.test(input);
  },
};
