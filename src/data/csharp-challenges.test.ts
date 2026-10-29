import { describe, expect, it } from "vitest";
import { normalizeOutput } from "@/features/csharp/grade";
import { parseInline } from "@/features/learn/inline";
import { CSHARP_CHALLENGES } from "./csharp-challenges.ts";

/**
 * La forma del banco de C#.
 *
 * Esto no compila nada: que cada solución pase sus casos lo comprueba
 * `npm run verify:csharp` con el compilador de verdad. Aquí va lo que se puede
 * mirar sin ejecutar, y que corre en cada `npm run test`.
 */
describe("banco de C#", () => {
  it("tiene fondo en cada nivel, como los otros lenguajes", () => {
    for (const difficulty of [1, 2, 3, 4, 5]) {
      const count = CSHARP_CHALLENGES.filter((c) => c.difficulty === difficulty).length;
      expect(count, `nivel ${difficulty}`).toBeGreaterThanOrEqual(10);
    }
  });

  it("usa slugs únicos y con su prefijo, que no choquen con los de la base", () => {
    const slugs = CSHARP_CHALLENGES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug.startsWith("cs-"), slug).toBe(true);
  });

  it("va en orden de dificultad, que es el orden en que se practica", () => {
    const difficulties = CSHARP_CHALLENGES.map((c) => c.difficulty);
    expect(difficulties).toEqual([...difficulties].sort((a, b) => a - b));
  });
});

describe.each(CSHARP_CHALLENGES)("reto $slug", (challenge) => {
  it("tiene enunciado, pista y al menos tres casos", () => {
    expect(challenge.title.length).toBeGreaterThan(3);
    expect(challenge.prompt.length).toBeGreaterThan(20);
    expect(challenge.hint.length).toBeGreaterThan(15);
    expect(challenge.cases.length).toBeGreaterThanOrEqual(3);
  });

  it("todos sus casos traen entrada", () => {
    // Con la entrada vacía, Console.ReadLine devuelve null, y el jugador
    // vería un NullReferenceException que no tiene nada que ver con el reto.
    for (const testCase of challenge.cases) {
      expect(testCase.stdin.length, JSON.stringify(testCase)).toBeGreaterThan(0);
    }
  });

  it("sus casos no dan todos la misma salida", () => {
    // Si todos esperan lo mismo, imprimir esa salida a mano aprobaría el reto.
    const outputs = new Set(challenge.cases.map((c) => normalizeOutput(c.expected)));
    expect(outputs.size).toBeGreaterThan(1);
  });

  it("no repite un caso", () => {
    const inputs = challenge.cases.map((c) => c.stdin);
    expect(new Set(inputs).size).toBe(inputs.length);
  });

  it("su solución tiene la estructura que se ve en clase", () => {
    expect(challenge.solution).toContain("static void Main");
    expect(challenge.solution).toContain("class Program");
  });

  it("no deja acentos graves sueltos en lo que se lee", () => {
    for (const text of [challenge.prompt, challenge.hint]) {
      const ticks = [...text].filter((c) => c === "`").length;
      expect(ticks % 2, text).toBe(0);
      expect(parseInline(text).length).toBeGreaterThan(0);
    }
  });
});
