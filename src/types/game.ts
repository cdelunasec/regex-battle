/**
 * Game row types, narrowed from the generated ones.
 *
 * `src/integrations/supabase/types.ts` is generated from the live schema and
 * is the source of truth for shape. It is necessarily wider than reality
 * though: a CHECK constraint does not survive into TypeScript, so
 * `match_mode` and `language` come out as `string`, and a `jsonb` column comes
 * out as `Json` even when the database only ever stores an array of strings.
 *
 * Postgres does enforce all of that, in `0001_init.sql`. This module restates
 * it for the compiler, and checks it once at the point where rows enter the
 * app, so a bad row gets dropped instead of blowing up mid run.
 */
import type { MatchMode } from "@/engine";
import type { Json, Tables } from "@/integrations/supabase/types";

export type Problem = Omit<
  Tables<"problems">,
  "language" | "match_mode" | "must_match" | "must_not_match"
> & {
  language: "regex";
  match_mode: MatchMode;
  must_match: string[];
  must_not_match: string[];
};

export type Room = Tables<"rooms">;
export type Round = Tables<"rounds">;
export type Submission = Tables<"submissions">;
export type SoloRun = Tables<"solo_runs">;

function isStringArray(value: Json): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Narrows a generated row into a `Problem`, or returns null when the row does
 * not honour the constraints the schema promises.
 */
export function toProblem(row: Tables<"problems">): Problem | null {
  if (row.language !== "regex") return null;
  if (row.match_mode !== "partial" && row.match_mode !== "full") return null;
  if (!isStringArray(row.must_match) || !isStringArray(row.must_not_match)) return null;

  return {
    ...row,
    language: row.language,
    match_mode: row.match_mode,
    must_match: row.must_match,
    must_not_match: row.must_not_match,
  };
}

/** Narrows a list of rows, dropping any that do not fit the contract. */
export function toProblems(rows: Tables<"problems">[]): Problem[] {
  return rows.map(toProblem).filter((problem): problem is Problem => problem !== null);
}
