/**
 * Solo practice run: pure state, no React and no network.
 *
 * Keeping the rules here means the streak, the ordering and the end condition
 * are unit tested instead of being inferred from clicking around the UI.
 */
import type { Problem } from "@/types/game";

export type SoloStatus = "loading" | "ready" | "running" | "finished";

/**
 * Lo único que la tanda necesita saber de un reto: su dificultad, para
 * ordenarlos. Así sirve igual para los retos de la base (regex y KQL) que para
 * los de C#, que viven en el repo y tienen otra forma.
 */
export interface Rankable {
  difficulty: number;
}

export interface SoloRunState<T extends Rankable = Problem> {
  status: SoloStatus;
  problems: T[];
  index: number;
  solved: number;
  skipped: number;
  streak: number;
  bestStreak: number;
  startedAt: number | null;
  durationMs: number;
}

export type SoloAction<T extends Rankable = Problem> =
  | { type: "loaded"; problems: T[] }
  | { type: "start"; at: number }
  | { type: "solved"; at: number }
  | { type: "skip"; at: number }
  | { type: "finish"; at: number }
  | { type: "reset" };

export const initialSoloState: SoloRunState<never> = {
  status: "loading",
  problems: [],
  index: 0,
  solved: 0,
  skipped: 0,
  streak: 0,
  bestStreak: 0,
  startedAt: null,
  durationMs: 0,
};

/** The challenge on screen, or null when the run is over. */
export function currentProblem<T extends Rankable>(state: SoloRunState<T>): T | null {
  return state.problems[state.index] ?? null;
}

/**
 * Easiest first, shuffled among equals so a second run is not the same run.
 * `random` is injectable to keep the ordering testable.
 */
export function orderProblems<T extends Rankable>(
  problems: T[],
  random: () => number = Math.random,
): T[] {
  return problems
    .map((problem) => ({ problem, key: random() }))
    .sort((a, b) => {
      const byDifficulty = a.problem.difficulty - b.problem.difficulty;
      return byDifficulty !== 0 ? byDifficulty : a.key - b.key;
    })
    .map((entry) => entry.problem);
}

/** Advances past the current challenge, ending the run at the last one. */
function advance<T extends Rankable>(state: SoloRunState<T>, at: number): SoloRunState<T> {
  const index = state.index + 1;
  if (index >= state.problems.length) {
    return {
      ...state,
      index,
      status: "finished",
      durationMs: state.startedAt === null ? state.durationMs : at - state.startedAt,
    };
  }
  return { ...state, index };
}

export function soloReducer<T extends Rankable>(
  state: SoloRunState<T>,
  action: SoloAction<T>,
): SoloRunState<T> {
  switch (action.type) {
    case "loaded":
      return { ...state, problems: action.problems, status: "ready" };

    case "start":
      if (state.problems.length === 0) return state;
      return {
        ...initialSoloState,
        problems: state.problems,
        status: "running",
        startedAt: action.at,
      };

    case "solved": {
      if (state.status !== "running") return state;
      const streak = state.streak + 1;
      return advance(
        {
          ...state,
          solved: state.solved + 1,
          streak,
          bestStreak: Math.max(state.bestStreak, streak),
        },
        action.at,
      );
    }

    case "skip":
      if (state.status !== "running") return state;
      return advance({ ...state, skipped: state.skipped + 1, streak: 0 }, action.at);

    case "finish":
      if (state.status !== "running") return state;
      return {
        ...state,
        status: "finished",
        durationMs: state.startedAt === null ? 0 : action.at - state.startedAt,
      };

    case "reset":
      return { ...initialSoloState, problems: state.problems, status: "ready" };

    default:
      return state;
  }
}

/** Formats milliseconds as m:ss for the on screen clock. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
