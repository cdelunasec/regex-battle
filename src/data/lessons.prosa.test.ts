import { describe, expect, it } from "vitest";
import { LESSONS } from "./lessons.ts";
import { parseInline } from "@/features/learn/inline.ts";

/**
 * Cómo se escribe una lección.
 *
 * Esto no comprueba que el temario sea correcto, de eso va `lessons.test.ts`.
 * Comprueba cómo está redactado, y existe por un motivo concreto: el curso se
 * escribió deletreando los símbolos con palabras ("el signo de más", "la barra
 * invertida con d") porque el cuerpo de la lección se pintaba como texto plano
 * y no había forma de mostrar un símbolo como símbolo.
 *
 * Al probarlo de corrido, eso resultó ser lo que más confundía: hay que
 * traducir de vuelta a símbolos mientras aprendes. Ahora las lecciones pueden
 * escribir código entre acentos graves, y estas pruebas evitan que la
 * costumbre vuelva por la puerta de atrás.
 */

/** Todo lo que un jugador lee de una lección, con su sitio para el mensaje. */
function prosaDe(lesson: (typeof LESSONS)[number]): { donde: string; texto: string }[] {
  return [
    { donde: "summary", texto: lesson.summary },
    ...lesson.body.map((texto, i) => ({ donde: `body[${i}]`, texto })),
    ...lesson.examples.map((e, i) => ({ donde: `examples[${i}].note`, texto: e.note })),
    { donde: "exercise.prompt", texto: lesson.exercise.prompt },
    { donde: "exercise.hint", texto: lesson.exercise.hint },
  ];
}

/**
 * Deletreos que ya confundieron a un lector de verdad. La lista no pretende ser
 * exhaustiva: son los que aparecían en el curso antes de arreglarlo.
 */
const DELETREOS = [
  "signo de más",
  "signo de mas",
  "signo de pregunta",
  "signo de dólar",
  "signo de dolar",
  "signo de admiración",
  "signo de admiracion",
  "signo de menor",
  "signo de mayor",
  "signo de cerrar",
  "acento circunflejo",
  "barra invertida con",
  "asterisco",
  "dos puntos",
];

/**
 * En C#, "asteriscos" es lo que se dibuja, no la forma de nombrar el símbolo
 * `*`. Un ejercicio que pide una pirámide de asteriscos está bien dicho, y el
 * `*` aparece igual en el código del ejemplo. Lo mismo con los dos puntos.
 */
const PERMITIDO_EN_CSHARP = new Set(["asterisco", "dos puntos"]);

describe.each(LESSONS)("prosa de $slug", (lesson) => {
  it("escribe los símbolos en vez de deletrearlos", () => {
    for (const { donde, texto } of prosaDe(lesson)) {
      const bajo = texto.toLowerCase();
      for (const deletreo of DELETREOS) {
        if (lesson.language === "csharp" && PERMITIDO_EN_CSHARP.has(deletreo)) continue;
        expect(bajo.includes(deletreo), `${lesson.slug} ${donde}: "${deletreo}"`).toBe(false);
      }
    }
  });

  it("la explicación enseña al menos un símbolo escrito", () => {
    const conCodigo = lesson.body.filter((p) => parseInline(p).some((s) => s.code));
    expect(conCodigo.length, `${lesson.slug} explica sin mostrar nada`).toBeGreaterThan(0);
  });

  it("no deja acentos graves sueltos", () => {
    for (const { donde, texto } of prosaDe(lesson)) {
      const cuantos = [...texto].filter((c) => c === "`").length;
      expect(cuantos % 2, `${lesson.slug} ${donde} tiene un acento grave sin pareja`).toBe(0);
    }
  });

  it("no mete código vacío", () => {
    for (const { donde, texto } of prosaDe(lesson)) {
      for (const segmento of parseInline(texto)) {
        if (segmento.code) {
          expect(
            segmento.text.length,
            `${lesson.slug} ${donde} tiene un \`\` vacío`,
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("no encadena párrafos interminables", () => {
    // Un párrafo muy largo es la otra mitad de la queja: no es que no se
    // entienda, es que hay que releerlo. Se parte en dos y ya.
    for (const [i, paragraph] of lesson.body.entries()) {
      expect(paragraph.length, `${lesson.slug} body[${i}] es un ladrillo`).toBeLessThanOrEqual(400);
    }
  });
});
