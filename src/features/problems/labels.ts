import type { MatchMode } from "@/engine";

export const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Muy fácil",
  2: "Fácil",
  3: "Media",
  4: "Difícil",
  5: "Brutal",
};

export const MATCH_MODE_LABEL: Record<MatchMode, string> = {
  partial: "Busca dentro del texto",
  full: "Tiene que calzar completo",
};

export const MATCH_MODE_HINT: Record<MatchMode, string> = {
  partial: "Basta con que el patrón aparezca en alguna parte del texto.",
  full: "El patrón tiene que consumir el texto entero, de principio a fin.",
};

export function difficultyLabel(difficulty: number): string {
  return DIFFICULTY_LABEL[difficulty] ?? `Nivel ${difficulty}`;
}
