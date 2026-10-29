import { describe, expect, it } from "vitest";
import { findMatches, splitByMatches } from "./matches.ts";

describe("findMatches", () => {
  it("encuentra todas las coincidencias con sus posiciones", () => {
    const { ranges } = findMatches(String.raw`\d+`, "abc123 y 45");
    expect(ranges.map((r) => r.text)).toEqual(["123", "45"]);
    expect(ranges[0]).toMatchObject({ start: 3, end: 6 });
  });

  it("en modo full devuelve el texto entero o nada", () => {
    expect(findMatches("[a-z]+", "gato", "full").ranges.map((r) => r.text)).toEqual(["gato"]);
    expect(findMatches("[a-z]+", "gato1", "full").ranges).toEqual([]);
  });

  it("no se cuelga con un patrón que encaja con vacío", () => {
    const { ranges } = findMatches("a*", "bab");
    expect(ranges.length).toBeLessThan(10);
  });

  it("devuelve el error de sintaxis en vez de lanzarlo", () => {
    const { error } = findMatches("([a-z]", "hola");
    expect(error?.kind).toBe("syntax");
  });

  it("aplica las mismas guardas que el resto del motor", () => {
    const { error } = findMatches("(a+)+", "aaaa");
    expect(error?.code).toBe("nested_quantifier");
  });

  it("no devuelve nada cuando el patrón está vacío", () => {
    expect(findMatches("", "hola").ranges).toEqual([]);
  });
});

describe("splitByMatches", () => {
  it("parte el texto alternando lo capturado y lo que no", () => {
    const input = "abc123 y 45";
    const { ranges } = findMatches(String.raw`\d+`, input);
    expect(splitByMatches(input, ranges)).toEqual([
      { text: "abc", matched: false },
      { text: "123", matched: true },
      { text: " y ", matched: false },
      { text: "45", matched: true },
    ]);
  });

  it("devuelve el texto entero sin marcar cuando no hay coincidencias", () => {
    expect(splitByMatches("hola", [])).toEqual([{ text: "hola", matched: false }]);
  });

  it("reconstruye siempre el texto original", () => {
    const input = "el año 2026 y el 2027";
    const { ranges } = findMatches(String.raw`\d{4}`, input);
    const rebuilt = splitByMatches(input, ranges)
      .map((p) => p.text)
      .join("");
    expect(rebuilt).toBe(input);
  });
});
