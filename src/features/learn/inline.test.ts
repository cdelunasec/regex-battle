import { describe, expect, it } from "vitest";
import { parseInline } from "./inline.ts";

/** El acento grave suelto, para no pelearse con las plantillas de TypeScript. */
const T = "`";

describe("parseInline", () => {
  it("deja pasar el texto sin código de una pieza", () => {
    expect(parseInline("solo prosa")).toEqual([{ text: "solo prosa", code: false }]);
  });

  it("separa el código de lo que lo rodea", () => {
    const texto = "El patrón " + T + String.raw`\d+` + T + " captura números.";
    expect(parseInline(texto)).toEqual([
      { text: "El patrón ", code: false },
      { text: String.raw`\d+`, code: true },
      { text: " captura números.", code: false },
    ]);
  });

  it("aguanta varios trozos de código en el mismo párrafo", () => {
    const texto = `${T}+${T} y ${T}*${T} y ${T}?${T}`;
    expect(parseInline(texto).filter((s) => s.code)).toEqual([
      { text: "+", code: true },
      { text: "*", code: true },
      { text: "?", code: true },
    ]);
  });

  it("un acento grave suelto se queda como texto", () => {
    const texto = "esto " + T + " no cierra";
    expect(parseInline(texto)).toEqual([{ text: texto, code: false }]);
  });

  it("no pierde ni un carácter por el camino", () => {
    const casos = [
      `${T}a${T}`,
      `x${T}a${T}y`,
      `${T}${T}`,
      "sin nada",
      `${T}al principio${T} y al final ${T}así${T}`,
      `raro ${T} y ${T}luego${T} esto`,
    ];
    for (const texto of casos) {
      const rearmado = parseInline(texto)
        .map((s) => (s.code ? T + s.text + T : s.text))
        .join("");
      expect(rearmado).toBe(texto);
    }
  });
});
