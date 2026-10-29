/**
 * Turns `src/data/challenges.ts` into a seed migration.
 *
 * Content is data-driven by design, so the bank lives in one typed file that
 * the test suite can verify, and this script projects it into SQL. To change
 * the bank, edit the TypeScript file and re-run `bun run seed:sql`.
 *
 * A migration that has been applied is never edited, so every change produces
 * a NEW timestamped migration. To keep the folder from filling up with
 * identical files, the checksum of the last generated seed is tracked in
 * `supabase/.seed-checksum`: running this with nothing changed does nothing.
 *
 * The insert upserts on `slug`, so applying it again updates the bank in place
 * instead of duplicating it.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(new URL(".", import.meta.url)));
const migrationsDir = join(root, "supabase", "migrations");
const checksumPath = join(root, "supabase", ".seed-checksum");

const { CHALLENGE_SEED } = await import(new URL("../src/data/bank.ts", import.meta.url).href);

/** Quotes a value as a SQL string literal. */
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
/** Quotes a JSON array as a jsonb literal. */
const jsonb = (value) => `${quote(JSON.stringify(value))}::jsonb`;

const rows = CHALLENGE_SEED.map(
  (challenge) =>
    "  (" +
    [
      quote(challenge.slug),
      quote(challenge.language),
      quote(challenge.prompt),
      challenge.difficulty,
      quote(challenge.match_mode),
      jsonb(challenge.must_match),
      jsonb(challenge.must_not_match),
    ].join(", ") +
    ")",
).join(",\n");

const body = `insert into public.problems
  (slug, language, prompt, difficulty, match_mode, must_match, must_not_match)
values
${rows}
on conflict (slug) do update set
  language       = excluded.language,
  prompt         = excluded.prompt,
  difficulty     = excluded.difficulty,
  match_mode     = excluded.match_mode,
  must_match     = excluded.must_match,
  must_not_match = excluded.must_not_match,
  is_active      = true;
`;

const checksum = createHash("sha256").update(body).digest("hex").slice(0, 16);
const previous = await readFile(checksumPath, "utf8").catch(() => "");

if (previous.trim() === checksum) {
  console.log(
    `El banco no ha cambiado (${CHALLENGE_SEED.length} retos). No hace falta una migración nueva.`,
  );
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const destination = join(migrationsDir, `${stamp}_seed_problems.sql`);

const sql = `-- GENERATED FILE. Edit src/data/challenges.ts and run \`bun run seed:sql\`.
--
-- Banco de retos: ${CHALLENGE_SEED.length} retos.
-- Hace upsert por slug, así que aplicarla otra vez actualiza el banco en lugar
-- de duplicarlo.
--
-- seed-checksum: ${checksum}

${body}`;

await writeFile(destination, sql, "utf8");
await writeFile(checksumPath, checksum + "\n", "utf8");

console.log(
  `Escritos ${CHALLENGE_SEED.length} retos en ${destination}.\n` +
    "Aplícala con npx supabase db push.",
);
