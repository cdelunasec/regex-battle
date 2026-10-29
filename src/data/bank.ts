/**
 * El banco entero, de todos los lenguajes.
 *
 * Cada lenguaje tiene su archivo, porque un reto de regex y uno de KQL no se
 * parecen en nada al leerlos: uno lleva patrones y textos, el otro consultas y
 * documentos. Lo que sí comparten es la forma, `SeedChallenge`, y el motor que
 * los corrige, que recibe el corrector en vez de importarlo.
 *
 * Esto es lo que se siembra y lo que verifican los tests. `npm run seed:sql`
 * lee de aquí.
 */
import { REGEX_CHALLENGES, type SeedChallenge } from "./challenges.ts";
import { KQL_CHALLENGES } from "./kql-challenges.ts";

export type { SeedChallenge };

export const CHALLENGE_SEED: SeedChallenge[] = [...REGEX_CHALLENGES, ...KQL_CHALLENGES];

/** Los retos de un lenguaje, para las pruebas que miran un banco a la vez. */
export function challengesOf(language: SeedChallenge["language"]): SeedChallenge[] {
  return CHALLENGE_SEED.filter((challenge) => challenge.language === language);
}
