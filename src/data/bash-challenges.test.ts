/**
 * La forma del banco de Bash.
 *
 * Esto no ejecuta nada: que cada solución pase sus casos lo comprueba
 * `npm run verify:bash`, que además la corre en el bash de verdad de la
 * máquina. Aquí va lo que se puede mirar sin ejecutar, y que corre en cada
 * `npm run test`.
 *
 * El último bloque vigila la línea que se acordó para el contenido: ningún
 * objetivo que exista de verdad. Es un test y no una buena intención porque el
 * contenido se publica, y a un descuido se le escapa una IP real.
 */
import { describe, expect, it } from "vitest";
import { normalizeOutput } from "@/features/editor/output";
import { BASH_CHALLENGES, BASH_STARTER } from "./bash-challenges.ts";

describe("banco de Bash", () => {
  it("tiene diez retos en cada uno de los seis niveles", () => {
    for (const difficulty of [1, 2, 3, 4, 5, 6]) {
      const count = BASH_CHALLENGES.filter((c) => c.difficulty === difficulty).length;
      expect(count, `nivel ${difficulty}`).toBe(10);
    }
    expect(BASH_CHALLENGES).toHaveLength(60);
  });

  it("usa slugs únicos y con su prefijo", () => {
    const slugs = BASH_CHALLENGES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug.startsWith("bash-"), slug).toBe(true);
  });

  it("va en orden de dificultad, que es el orden en que se practica", () => {
    const difficulties = BASH_CHALLENGES.map((c) => c.difficulty);
    expect(difficulties).toEqual([...difficulties].sort((a, b) => a - b));
  });

  it("el script de arranque no resuelve nada", () => {
    expect(BASH_STARTER.trim()).toBe("#!/bin/bash");
  });
});

describe.each(BASH_CHALLENGES)("reto $slug", (challenge) => {
  it("tiene enunciado, pista y al menos dos casos", () => {
    expect(challenge.title.length).toBeGreaterThan(3);
    expect(challenge.prompt.length).toBeGreaterThan(20);
    expect(challenge.hint.length).toBeGreaterThan(15);
    expect(challenge.cases.length).toBeGreaterThanOrEqual(2);
  });

  it("no se aprueba copiando la salida del ejemplo", () => {
    /*
     * Si todos los casos esperan lo mismo por pantalla, imprimir eso a mano
     * pasaría el reto. Vale como excepción que se corrija por los archivos que
     * deja escritos o por el código de salida, porque eso ya no se copia.
     */
    const outputs = new Set(challenge.cases.map((c) => normalizeOutput(c.expected)));
    const checksFiles = challenge.cases.some(
      (c) => c.expectedFiles && Object.keys(c.expectedFiles).length > 0,
    );
    const checksExit = challenge.cases.some((c) => c.expectedExit !== undefined);
    expect(outputs.size > 1 || checksFiles || checksExit).toBe(true);
  });

  it("su solución es un script con shebang", () => {
    expect(challenge.solution.startsWith("#!/bin/bash")).toBe(true);
  });

  it("no repite un caso", () => {
    const keys = challenge.cases.map((c) =>
      JSON.stringify([c.args ?? [], c.stdin ?? "", c.files ?? {}]),
    );
    expect(new Set(keys).size).toBe(keys.length);
  });
});

/**
 * Todo lo que se escribe en el banco, junto, para poder registrarlo de una vez.
 */
const TODO_EL_TEXTO = BASH_CHALLENGES.map((challenge) =>
  [
    challenge.prompt,
    challenge.hint,
    challenge.solution,
    ...challenge.cases.map((c) =>
      JSON.stringify([c.expected, c.files ?? {}, c.args ?? [], c.stdin ?? ""]),
    ),
  ].join("\n"),
).join("\n");

describe("la línea del contenido", () => {
  it("no menciona ninguna IP que exista de verdad", () => {
    const found = TODO_EL_TEXTO.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) ?? [];

    for (const ip of new Set(found)) {
      const [a, b] = ip.split(".").map(Number) as [number, number, number, number];
      const privada =
        a === 10 ||
        a === 127 ||
        (a === 192 && b === 168) ||
        (a === 172 && b >= 16 && b <= 31) ||
        // Los rangos que la RFC 5737 reserva justo para ejemplos.
        (a === 192 && b === 0) ||
        (a === 198 && b === 51) ||
        (a === 203 && b === 0);
      expect(privada, `${ip} no es una dirección de laboratorio`).toBe(true);
    }
  });

  it("no menciona ningún dominio que exista de verdad", () => {
    const found = TODO_EL_TEXTO.match(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/gi) ?? [];
    const sospechosos = found.filter((name) => /\.(com|net|org|io|dev|es|do|gov|edu)$/i.test(name));
    // `nmap.org` sale en el encabezado que imprime la herramienta simulada, que
    // es texto copiado de la de verdad y no un objetivo.
    expect(sospechosos.filter((name) => name !== "nmap.org")).toEqual([]);
  });

  it("no trae recetas de ataque, solo de análisis y automatización", () => {
    // Lo que se acordó dejar fuera: nada de fuerza bruta lista para apuntar,
    // ni shells de vuelta, ni borrado de rastro.
    const prohibido = [
      /hydra\s/i,
      /medusa\s/i,
      /reverse shell/i,
      /bash -i >&/,
      /nc -e/i,
      /\/dev\/tcp\//,
      /msfconsole/i,
      /shred\s+-/i,
      /history -c/i,
    ];

    for (const patron of prohibido) {
      expect(patron.test(TODO_EL_TEXTO), `aparece ${patron}`).toBe(false);
    }
  });
});
