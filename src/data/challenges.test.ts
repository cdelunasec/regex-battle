import { describe, expect, it } from "vitest";
import { CHALLENGE_SEED, challengesOf } from "./bank.ts";
import { engineFor, evaluateFor, type ChallengeLanguage } from "@/engine";

/** Los lenguajes que ya tienen banco propio. */
const LANGUAGES: ChallengeLanguage[] = ["regex", "kql"];

/**
 * El comodín de cada lenguaje: lo que escribiría alguien que quiere pasar el
 * reto sin resolverlo. Si esto pasa, el reto no discrimina y no enseña nada.
 *
 * En regex es `.*`, que encaja con cualquier texto. En KQL es `*`, que es un
 * término suelto y encaja con cualquier documento que traiga algún valor.
 */
const CATCH_ALL: Record<ChallengeLanguage, string> = {
  regex: ".*",
  kql: "*",
};

describe("challenge seed", () => {
  it("has a bank big enough that a match does not repeat itself", () => {
    expect(CHALLENGE_SEED.length).toBeGreaterThanOrEqual(100);
  });

  it("uses unique slugs", () => {
    const slugs = new Set(CHALLENGE_SEED.map((challenge) => challenge.slug));
    expect(slugs.size).toBe(CHALLENGE_SEED.length);
  });

  describe.each(LANGUAGES)("banco de %s", (language) => {
    /*
     * El minimo por escalon no es decoracion. Una partida gasta hasta siete
     * retos, y la sala se queda en una sola banda de dificultad: si una banda
     * tuviera cuatro retos, dos partidas seguidas en ese nivel servirian casi
     * los mismos. Ese fue justo el reclamo que trajo esta regla.
     */
    it("cubre los cinco niveles con fondo suficiente", () => {
      for (const difficulty of [1, 2, 3, 4, 5]) {
        const count = challengesOf(language).filter((c) => c.difficulty === difficulty).length;
        expect(count, `${language} nivel ${difficulty}`).toBeGreaterThanOrEqual(10);
      }
    });
  });

  it.each(CHALLENGE_SEED)("$slug is well formed", (challenge) => {
    expect(challenge.prompt.length).toBeGreaterThan(20);
    expect(challenge.difficulty).toBeGreaterThanOrEqual(1);
    expect(challenge.difficulty).toBeLessThanOrEqual(5);
    expect(challenge.must_match.length).toBeGreaterThanOrEqual(3);
    expect(challenge.must_not_match.length).toBeGreaterThanOrEqual(3);
    // Duplicated strings across the two lists would make the challenge impossible.
    const overlap = challenge.must_match.filter((value) =>
      challenge.must_not_match.includes(value),
    );
    expect(overlap).toEqual([]);
  });

  it.each(CHALLENGE_SEED)("$slug is solvable by its reference solution", (challenge) => {
    expect(engineFor(challenge.language).guard(challenge.solution)).toBeNull();
    const result = evaluateFor(challenge.language, challenge.solution, challenge);
    expect(result.error).toBeNull();
    expect(result.passed).toBe(true);
  });

  it.each(CHALLENGE_SEED)("$slug is not passed by a catch all", (challenge) => {
    // A challenge whose negatives do not discriminate teaches nothing.
    const result = evaluateFor(challenge.language, CATCH_ALL[challenge.language], challenge);
    expect(result.passed).toBe(false);
  });
});

describe("banco de KQL", () => {
  it("sus casos de prueba son documentos JSON de verdad", () => {
    for (const challenge of challengesOf("kql")) {
      for (const value of [...challenge.must_match, ...challenge.must_not_match]) {
        // Un caso que no sea JSON se evaluaria contra un documento vacio y el
        // reto pasaria a ser una trampa silenciosa.
        expect(() => JSON.parse(value), `${challenge.slug}: ${value}`).not.toThrow();
        expect(typeof JSON.parse(value), challenge.slug).toBe("object");
      }
    }
  });
});
