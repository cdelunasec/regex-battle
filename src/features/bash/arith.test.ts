/**
 * Los valores esperados salieron de correr las mismas expresiones en el bash
 * de la máquina, no de lo que uno supone que hace un entero.
 */
import { describe, expect, it } from "vitest";
import { arithToString, BashArithError, evaluateArith, type ArithHost } from "./arith.ts";

function hostWith(initial: Record<string, string> = {}): ArithHost & { vars: Map<string, string> } {
  const vars = new Map(Object.entries(initial));
  return {
    vars,
    get: (name) => vars.get(name),
    set: (name, value) => void vars.set(name, value),
  };
}

const value = (source: string, initial?: Record<string, string>): string =>
  arithToString(source, hostWith(initial));

describe("los enteros y sus reglas", () => {
  it("divide truncando hacia cero, no redondeando", () => {
    expect(value("7/2")).toBe("3");
    expect(value("-7/2")).toBe("-3");
    expect(value("-7%2")).toBe("-1");
  });

  it("la potencia asocia a la derecha", () => {
    expect(value("2**3**2")).toBe("512");
  });

  it("entiende el octal y el hexadecimal como en C", () => {
    expect(value("010")).toBe("8");
    expect(value("0x10")).toBe("16");
  });

  it("aguanta números grandes sin empezar a mentir", () => {
    expect(value("2**62")).toBe("4611686018427387904");
  });
});

describe("las variables", () => {
  it("van sin dólar, y la que no existe vale cero", () => {
    expect(value("n + 1", { n: "41" })).toBe("42");
    expect(value("noexiste + 1")).toBe("1");
  });

  it("una variable con texto vale cero", () => {
    expect(value("texto", { texto: "hola" })).toBe("0");
  });

  it("resuelve el nombre de dentro cuando una variable apunta a otra", () => {
    expect(value("n", { n: "x", x: "3" })).toBe("3");
  });

  it("tolera el dólar aunque sobre, porque se escribe mucho", () => {
    expect(value("$n + 1", { n: "1" })).toBe("2");
  });
});

describe("incrementar", () => {
  it("el de después devuelve el valor de antes", () => {
    const host = hostWith({ i: "5" });
    expect(evaluateArith("i++", host)).toBe(5n);
    expect(host.vars.get("i")).toBe("6");
  });

  it("el de antes devuelve el ya incrementado", () => {
    const host = hostWith({ j: "5" });
    expect(evaluateArith("++j", host)).toBe(6n);
    expect(host.vars.get("j")).toBe("6");
  });

  it("asigna y deja la variable puesta", () => {
    const host = hostWith();
    evaluateArith("total = 3 * 4", host);
    expect(host.vars.get("total")).toBe("12");
    evaluateArith("total += 8", host);
    expect(host.vars.get("total")).toBe("20");
  });
});

describe("comparar y decidir", () => {
  it("devuelve uno o cero", () => {
    expect(value("1<2")).toBe("1");
    expect(value("2<1")).toBe("0");
    expect(value("1 && 0")).toBe("0");
    expect(value("1 || 0")).toBe("1");
  });

  it("entiende el ternario", () => {
    expect(value("3?7:9")).toBe("7");
    expect(value("0?7:9")).toBe("9");
  });
});

describe("los errores", () => {
  it("avisa de la división por cero con el texto de bash", () => {
    expect(() => value("1/0")).toThrow(BashArithError);
    expect(() => value("1/0")).toThrow("division by 0");
  });

  it("avisa cuando la expresión no se entiende", () => {
    expect(() => value("2 +")).toThrow(BashArithError);
  });
});
