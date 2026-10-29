/**
 * Los ajustes que elige quien crea la sala.
 *
 * Los valores tienen que cuadrar con lo que acepta `create_room` en la
 * migración `20260830143000_match_settings.sql`. Ahí cualquier cosa que no
 * esté en la lista cae en el valor por defecto, así que un desajuste no rompe
 * nada, solo hace que la sala salga en progresiva sin avisar. Por eso vale la
 * pena que la lista viva en un solo sitio de este lado.
 *
 * Los ajustes viajan dentro de `rooms.config`, que ya estaba declarado como el
 * knob por sala. No hay columnas nuevas.
 */
import type { ChallengeLanguage } from "@/engine";
import type { Room } from "@/types/game";

export type DifficultyValue = "progresiva" | "facil" | "media" | "dificil" | "experta";

export interface DifficultyOption {
  value: DifficultyValue;
  label: string;
  hint: string;
}

export const DIFFICULTIES: DifficultyOption[] = [
  {
    value: "progresiva",
    label: "Progresiva",
    hint: "Arranca suave y sube un escalón cada dos rondas.",
  },
  { value: "facil", label: "Fácil", hint: "Lo del principio del curso: clases y cuantificadores." },
  { value: "media", label: "Media", hint: "Grupos, alternancia y clases negadas." },
  { value: "dificil", label: "Difícil", hint: "Lookaheads, referencias y formatos con trampa." },
  { value: "experta", label: "Experta", hint: "Lo más duro del banco, sin piedad." },
];

export interface LengthOption {
  /** Vida inicial. A 25 de daño por ronda, decide cuántos golpes aguanta cada quien. */
  value: number;
  label: string;
  hint: string;
}

export const LENGTHS: LengthOption[] = [
  { value: 75, label: "Corta", hint: "Tres golpes y se acabó." },
  { value: 100, label: "Normal", hint: "Cuatro golpes." },
  { value: 150, label: "Larga", hint: "Seis golpes, para remontar." },
];

export interface LanguageOption {
  value: ChallengeLanguage;
  label: string;
  hint: string;
}

/**
 * Los lenguajes que ya tienen banco. La hoja de ruta completa vive en
 * `src/data/tracks.ts`; aquí solo están los que se pueden jugar hoy.
 */
export const LANGUAGES: LanguageOption[] = [
  {
    value: "regex",
    label: "Expresiones regulares",
    hint: "Buscar patrones dentro de texto.",
  },
  {
    value: "kql",
    label: "KQL de Kibana",
    hint: "Filtrar logs, lo que se usa para investigar incidentes.",
  },
];

export const DEFAULT_LANGUAGE: ChallengeLanguage = "regex";

export function languageLabel(value: string | null | undefined): string {
  return LANGUAGES.find((option) => option.value === value)?.label ?? "Expresiones regulares";
}

export const DEFAULT_DIFFICULTY: DifficultyValue = "progresiva";
export const DEFAULT_HP = 100;

/** El daño por ronda es fijo del lado del servidor; aquí solo se muestra. */
export const DAMAGE_PER_ROUND = 25;

export function matchDifficultyLabel(value: string | null | undefined): string {
  return DIFFICULTIES.find((option) => option.value === value)?.label ?? "Progresiva";
}

/**
 * Lee los ajustes de una sala ya creada.
 *
 * Las salas de antes de la migración no traen `difficulty` en el config, así
 * que aquí se cae en los valores por defecto igual que hace el servidor.
 */
export function readMatchSettings(room: Room): {
  difficulty: string;
  language: string;
  hp: number;
  rounds: number;
} {
  const config = (room.config ?? {}) as Record<string, unknown>;
  const rawHp = Number(config["initial_hp"]);
  const hp = Number.isFinite(rawHp) && rawHp > 0 ? rawHp : DEFAULT_HP;
  const rawDamage = Number(config["damage_per_round"]);
  const damage = Number.isFinite(rawDamage) && rawDamage > 0 ? rawDamage : DAMAGE_PER_ROUND;

  return {
    difficulty:
      typeof config["difficulty"] === "string" ? config["difficulty"] : DEFAULT_DIFFICULTY,
    // Las salas de antes de que existiera KQL no traen lenguaje, y estaban
    // jugando regex.
    language: typeof config["language"] === "string" ? config["language"] : DEFAULT_LANGUAGE,
    hp,
    rounds: Math.ceil(hp / damage),
  };
}
