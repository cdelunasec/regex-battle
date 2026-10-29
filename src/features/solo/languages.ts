/**
 * Con qué se puede practicar solo.
 *
 * Es una lista aparte de la del 1v1 a propósito. C# y Bash se practican aquí
 * pero no se pelean: en el 1v1 el servidor tiene que corregir para que nadie
 * haga trampa, y los dos se corrigen en el navegador. Si estuvieran en la
 * lista del 1v1, alguien podría crear una sala que el servidor no sabe
 * arbitrar.
 */
import type { ChallengeLanguage } from "@/engine";
import { LANGUAGES } from "@/features/battle/matchSettings";

export type SoloLanguage = ChallengeLanguage | "csharp" | "bash";

export interface SoloLanguageOption {
  value: SoloLanguage;
  label: string;
  hint: string;
}

export const SOLO_LANGUAGES: SoloLanguageOption[] = [
  ...LANGUAGES,
  {
    value: "csharp",
    label: "C#",
    hint: "Programas de consola de verdad, compilados en tu navegador. Lo de la materia de Programación.",
  },
  {
    value: "bash",
    label: "Bash",
    hint: "La terminal de Linux: procesar registros, revisar permisos y automatizar un reconocimiento.",
  },
];
