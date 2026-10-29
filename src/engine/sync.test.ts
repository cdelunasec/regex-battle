import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The edge function cannot import code from outside its own folder once it is
 * deployed, so `supabase/functions/_shared/engine` is a copy of `src/engine`
 * kept in sync by `npm run sync:engine`.
 *
 * A copy that silently drifts would mean the browser and the server disagree
 * on who won a round, which is the one bug this project cannot afford. This
 * test is the tripwire.
 */
const SOURCE = join(process.cwd(), "src", "engine");
const TARGET = join(process.cwd(), "supabase", "functions", "_shared", "engine");
const BANNER = "// GENERATED FILE. Edit src/engine and run `npm run sync:engine`.\n";

const engineFiles = readdirSync(SOURCE).filter(
  (name) => name.endsWith(".ts") && !name.endsWith(".test.ts"),
);

describe("shared engine copy", () => {
  it("mirrors every engine module", () => {
    const copied = readdirSync(TARGET).filter((name) => name.endsWith(".ts"));
    expect(copied.sort()).toEqual(engineFiles.sort());
  });

  it.each(engineFiles)("%s is identical on both sides", (name) => {
    const source = BANNER + readFileSync(join(SOURCE, name), "utf8");
    const copy = readFileSync(join(TARGET, name), "utf8");
    expect(copy, `${name} está desincronizado, corre npm run sync:engine`).toBe(source);
  });
});
