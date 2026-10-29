/**
 * Lo que se comprueba aquí salió de correr el `grep` de verdad y anotar lo que
 * contestó, no de lo que uno cree recordar de BRE. Cada caso de abajo se
 * verificó con `LC_ALL=C grep` antes de escribirlo.
 *
 * `verify:bash` vuelve a hacer esa comparación contra la máquina, pero estos
 * casos viven en `npm run test` porque son los que se rompen al tocar el
 * traductor y tienen que fallar en el acto.
 */
import { describe, expect, it } from "vitest";
import { BashRegexError, compilePosixRegex, globMatches, translateRegex } from "./regex.ts";

const matches = (pattern: string, flavor: "bre" | "ere", text: string): boolean =>
  compilePosixRegex(pattern, { flavor }).test(text);

describe("BRE, la de grep pelado y sed", () => {
  it("trata el más como un carácter cualquiera", () => {
    expect(matches("a+", "bre", "a+")).toBe(true);
    expect(matches("a+", "bre", "aa")).toBe(false);
  });

  it("con barra, el más sí cuantifica", () => {
    expect(matches("a\\+", "bre", "aa")).toBe(true);
    expect(matches("a\\+", "bre", "a")).toBe(true);
  });

  it("trata las llaves como caracteres hasta que llevan barra", () => {
    expect(matches("a{2}", "bre", "a{2}")).toBe(true);
    expect(matches("a{2}", "bre", "aa")).toBe(false);
    expect(matches("a\\{2\\}", "bre", "aa")).toBe(true);
    expect(matches("a\\{2\\}", "bre", "ab")).toBe(false);
  });

  it("trata los paréntesis como caracteres hasta que llevan barra", () => {
    expect(matches("(a)", "bre", "(a)")).toBe(true);
    expect(matches("\\(ab\\)\\1", "bre", "abab")).toBe(true);
    expect(matches("\\(ab\\)\\1", "bre", "abcd")).toBe(false);
  });

  it("no cuantifica con un asterisco al principio", () => {
    expect(matches("*hola", "bre", "*hola")).toBe(true);
    expect(matches("*hola", "bre", "hola")).toBe(false);
  });

  it("entiende los límites de palabra de GNU", () => {
    expect(matches("\\<casa\\>", "bre", "casa")).toBe(true);
    expect(matches("\\<casa\\>", "bre", "casas")).toBe(false);
  });
});

describe("ERE, la de grep -E y awk", () => {
  it("cuantifica sin barra", () => {
    expect(matches("a+", "ere", "aa")).toBe(true);
    expect(matches("(a|b)+c", "ere", "abac")).toBe(true);
  });

  it("con barra, el más es literal", () => {
    expect(matches("a\\+", "ere", "a+")).toBe(true);
    expect(matches("a\\+", "ere", "aa")).toBe(false);
  });

  it("acepta intervalos sin escapar", () => {
    expect(matches("[0-9]{4}", "ere", "2026")).toBe(true);
    expect(matches("[0-9]{4}", "ere", "26")).toBe(false);
  });
});

describe("las clases de POSIX", () => {
  it("valen lo mismo que con LC_ALL=C", () => {
    expect(matches("[[:digit:]]\\{4\\}", "bre", "2026-03-14")).toBe(true);
    expect(matches("[[:digit:]]\\{4\\}", "bre", "26-3-14")).toBe(false);
    expect(matches("[[:upper:]]", "bre", "hola")).toBe(false);
    expect(matches("[[:upper:]]", "bre", "Hola")).toBe(true);
    expect(matches("[[:space:]]", "bre", "a b")).toBe(true);
  });

  it("avisa cuando la clase no existe", () => {
    expect(() => compilePosixRegex("[[:letra:]]", { flavor: "bre" })).toThrow(BashRegexError);
  });
});

describe("los corchetes con sus rarezas", () => {
  it("un corchete de cierre pegado al principio es literal", () => {
    expect(matches("[]]", "bre", "]x")).toBe(true);
    expect(matches("[]]", "bre", "ab")).toBe(false);
    expect(matches("[^]]", "bre", "ab")).toBe(true);
  });

  it("no deja a medias un corchete sin cerrar", () => {
    expect(() => compilePosixRegex("[abc", { flavor: "ere" })).toThrow(BashRegexError);
  });
});

describe("la extracción de IPs, que es el patrón del curso", () => {
  const ipv4 = "[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}";

  it("saca la dirección de una línea de log", () => {
    const found = "Failed password for root from 10.0.0.7 port 22".match(
      compilePosixRegex(ipv4, { flavor: "ere", global: true }),
    );
    expect(found).toEqual(["10.0.0.7"]);
  });
});

describe("el glob del shell, que no es una expresión regular", () => {
  it("el asterisco es cualquier cosa y no el anterior repetido", () => {
    expect(globMatches("*.log", "auth.log")).toBe(true);
    expect(globMatches("*.log", "auth.txt")).toBe(false);
    expect(globMatches("informe-?.txt", "informe-1.txt")).toBe(true);
    expect(globMatches("informe-?.txt", "informe-12.txt")).toBe(false);
  });

  it("no descubre los ocultos salvo que se lo pidan con el punto", () => {
    expect(globMatches("*", ".bashrc")).toBe(false);
    expect(globMatches(".*", ".bashrc")).toBe(true);
  });

  it("deja pasar los corchetes", () => {
    expect(globMatches("[ab]*.sh", "backup.sh")).toBe(true);
    expect(globMatches("[ab]*.sh", "recon.sh")).toBe(false);
  });
});

describe("la traducción cruda", () => {
  it("no deja metacaracteres de JavaScript sueltos", () => {
    // Un punto de BRE es el comodín; una barra invertida y un punto, el punto.
    expect(translateRegex("a.b", "bre")).toBe("a.b");
    expect(translateRegex("a\\.b", "bre")).toBe("a\\.b");
  });
});
