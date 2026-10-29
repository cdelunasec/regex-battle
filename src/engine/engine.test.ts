import { describe, expect, it } from "vitest";
import { evaluatePattern } from "./evaluate.ts";
import { BOUNDED_REPEAT_MAX, PATTERN_MAX_LENGTH, guardPattern } from "./guard.ts";
import { jsMatcherEngine } from "./js-matcher.ts";
import type { EvaluableChallenge } from "./types.ts";

const partial: EvaluableChallenge = {
  match_mode: "partial",
  must_match: ["abc123", "x9"],
  must_not_match: ["solo letras"],
};

const full: EvaluableChallenge = {
  match_mode: "full",
  must_match: ["gato", "pato"],
  must_not_match: ["gatos", "el gato"],
};

const run = (pattern: string, challenge: EvaluableChallenge) =>
  evaluatePattern(pattern, challenge, jsMatcherEngine);

describe("evaluatePattern", () => {
  it("passes when every case lands on the expected side", () => {
    const result = run(String.raw`\d+`, partial);
    expect(result.passed).toBe(true);
    expect(result.error).toBeNull();
    expect(result.passedCount).toBe(result.totalCount);
  });

  it("fails when a must_match string is not matched", () => {
    const result = run(String.raw`\d{4}`, partial);
    expect(result.passed).toBe(false);
    expect(result.mustMatch[1]).toMatchObject({ input: "x9", ok: false, actual: false });
  });

  it("fails when a must_not_match string is matched", () => {
    const result = run(String.raw`.*`, partial);
    expect(result.passed).toBe(false);
    expect(result.mustNotMatch[0]).toMatchObject({
      input: "solo letras",
      ok: false,
      actual: true,
    });
  });

  it("anchors the pattern in full mode", () => {
    expect(run("[gp]ato", full).passed).toBe(true);
    // The same pattern would pass in partial mode, where 'gatos' also matches.
    expect(run("[gp]ato", { ...full, match_mode: "partial" }).passed).toBe(false);
  });

  it("keeps group numbering intact when anchoring for full mode", () => {
    const duplicated: EvaluableChallenge = {
      match_mode: "full",
      must_match: ["hola hola"],
      must_not_match: ["hola mundo"],
    };
    expect(run(String.raw`(\w+) \1`, duplicated).passed).toBe(true);
  });

  it("reports a syntax error instead of throwing", () => {
    const result = run("([a-z]", partial);
    expect(result.passed).toBe(false);
    expect(result.error?.kind).toBe("syntax");
    expect(result.error?.code).toBe("invalid_pattern");
  });

  it("reports every case as failed when the pattern is rejected", () => {
    const result = run("(a+)+", partial);
    expect(result.error?.kind).toBe("guard");
    expect(result.mustMatch.every((c) => !c.ok)).toBe(true);
    expect(result.passedCount).toBe(0);
  });
});

describe("guardPattern", () => {
  it("accepts an empty result for safe patterns", () => {
    const safe = [
      String.raw`\d+`,
      String.raw`^[a-z]+$`,
      String.raw`\d{1,3}(\.\d{1,3}){3}`,
      String.raw`(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}`,
      String.raw`\b(\w+) \1\b`,
      String.raw`8(09|29|49)-\d{3}-\d{4}`,
      String.raw`\d{1,3}(,\d{3})*(\.\d+)?`,
      String.raw`(^|\s)//`,
      String.raw`^(?!.*warning).*error`,
      String.raw`[a+]+`,
      String.raw`(a|b)*`,
    ];
    for (const pattern of safe) {
      expect(guardPattern(pattern), pattern).toBeNull();
    }
  });

  it("rejects an empty pattern", () => {
    expect(guardPattern("   ")?.code).toBe("empty_pattern");
  });

  it("rejects an oversized pattern", () => {
    expect(guardPattern("a".repeat(PATTERN_MAX_LENGTH + 1))?.code).toBe("pattern_too_long");
  });

  it("rejects nested unbounded quantifiers", () => {
    const dangerous = ["(a+)+", "(a*)*", "(a+)*", "(.*)+", "(?:\\w+\\s)+", "((a+))+", "(a{1,}b)*"];
    for (const pattern of dangerous) {
      expect(guardPattern(pattern)?.code, pattern).toBe("nested_quantifier");
    }
  });

  it("rejects repeated alternatives under a quantifier", () => {
    expect(guardPattern("(a|a)*")?.code).toBe("ambiguous_alternation");
  });

  it("rejects bounded repetitions with a huge ceiling", () => {
    expect(guardPattern(`a{1,${BOUNDED_REPEAT_MAX + 1}}`)?.code).toBe("repetition_too_large");
    expect(guardPattern(`a{1,${BOUNDED_REPEAT_MAX}}`)).toBeNull();
  });

  it("ignores quantifier characters inside a character class", () => {
    expect(guardPattern("[(+*]")).toBeNull();
  });
});
