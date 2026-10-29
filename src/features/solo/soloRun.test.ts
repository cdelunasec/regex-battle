import { describe, expect, it } from "vitest";
import {
  currentProblem,
  formatDuration,
  initialSoloState,
  orderProblems,
  soloReducer,
  type SoloRunState,
} from "./soloRun.ts";
import type { Problem } from "@/types/game";

function problem(id: string, difficulty: number): Problem {
  return {
    id,
    slug: id,
    language: "regex",
    prompt: `Reto ${id}`,
    difficulty,
    match_mode: "partial",
    must_match: ["a"],
    must_not_match: ["b"],
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
  };
}

const bank = [problem("a", 1), problem("b", 2), problem("c", 3)];

function started(): SoloRunState {
  const loaded = soloReducer(initialSoloState, { type: "loaded", problems: bank });
  return soloReducer(loaded, { type: "start", at: 1000 });
}

describe("orderProblems", () => {
  it("sorts by difficulty ascending", () => {
    const shuffledBank = [problem("c", 3), problem("a", 1), problem("b", 2)];
    expect(orderProblems(shuffledBank, () => 0.5).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps every problem exactly once", () => {
    const ordered = orderProblems(bank);
    expect(ordered).toHaveLength(bank.length);
    expect(new Set(ordered.map((p) => p.id)).size).toBe(bank.length);
  });
});

describe("soloReducer", () => {
  it("is not runnable before problems load", () => {
    const state = soloReducer(initialSoloState, { type: "start", at: 0 });
    expect(state.status).toBe("loading");
  });

  it("starts on the easiest problem", () => {
    const state = started();
    expect(state.status).toBe("running");
    expect(currentProblem(state)?.id).toBe("a");
  });

  it("counts solved problems and grows the streak", () => {
    let state = started();
    state = soloReducer(state, { type: "solved", at: 2000 });
    state = soloReducer(state, { type: "solved", at: 3000 });
    expect(state.solved).toBe(2);
    expect(state.streak).toBe(2);
    expect(state.bestStreak).toBe(2);
    expect(currentProblem(state)?.id).toBe("c");
  });

  it("breaks the streak on a skip but remembers the best one", () => {
    let state = started();
    state = soloReducer(state, { type: "solved", at: 2000 });
    state = soloReducer(state, { type: "skip", at: 3000 });
    expect(state.streak).toBe(0);
    expect(state.bestStreak).toBe(1);
    expect(state.skipped).toBe(1);
  });

  it("finishes after the last problem and records the duration", () => {
    let state = started();
    state = soloReducer(state, { type: "solved", at: 2000 });
    state = soloReducer(state, { type: "solved", at: 3000 });
    state = soloReducer(state, { type: "solved", at: 5000 });
    expect(state.status).toBe("finished");
    expect(state.durationMs).toBe(4000);
    expect(currentProblem(state)).toBeNull();
  });

  it("ignores progress once the run is over", () => {
    let state = started();
    state = soloReducer(state, { type: "finish", at: 4000 });
    const after = soloReducer(state, { type: "solved", at: 9000 });
    expect(after).toBe(state);
  });

  it("resets back to the same bank, ready to run again", () => {
    let state = started();
    state = soloReducer(state, { type: "solved", at: 2000 });
    state = soloReducer(state, { type: "reset" });
    expect(state.status).toBe("ready");
    expect(state.solved).toBe(0);
    expect(state.problems).toHaveLength(bank.length);
  });
});

describe("formatDuration", () => {
  it("formats as minutes and seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(9000)).toBe("0:09");
    expect(formatDuration(65000)).toBe("1:05");
    expect(formatDuration(-500)).toBe("0:00");
  });
});
