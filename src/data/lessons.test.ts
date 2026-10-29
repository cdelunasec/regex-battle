import { describe, expect, it } from "vitest";
import { CHALLENGE_SEED } from "./bank.ts";
import { COURSES, LESSONS, SECTIONS, lessonsOfSection, nextLesson } from "./lessons.ts";
import { engineFor, evaluateFor, findMatches } from "@/engine";
import type { Lesson, PatternLesson } from "./lessons.ts";
import { BASH_CHALLENGES } from "./bash-challenges.ts";
import { CSHARP_CHALLENGES } from "./csharp-challenges.ts";

/**
 * Un ejemplo se comprueba con el corrector de su lenguaje: en regex se mira si
 * resalta algo, y en KQL si el documento pasa el filtro.
 */
function exampleMatches(lesson: PatternLesson, pattern: string, sample: string): boolean {
  if (lesson.language === "regex") return findMatches(pattern, sample).ranges.length > 0;
  return engineFor("kql").compile(pattern, "partial")(sample);
}

/**
 * Las lecciones de C# y de Bash no se comprueban aquí: haría falta ejecutar, y
 * de eso se encargan `npm run verify:csharp` y `npm run verify:bash`, que
 * corren cada solución de referencia con el compilador y con el intérprete de
 * verdad. Lo que sí se mira aquí es la forma.
 */
function isPattern(lesson: Lesson): lesson is PatternLesson {
  return lesson.language !== "csharp" && lesson.language !== "bash";
}

/** Lo que pasaría todo sin enseñar nada, en cada lenguaje. */
const COMODIN: Record<string, string> = { regex: ".*", kql: "*" };

describe("temario", () => {
  it("cada lección pertenece a una sección que existe", () => {
    const slugs = new Set(SECTIONS.map((s) => s.slug));
    for (const lesson of LESSONS) {
      expect(slugs.has(lesson.sectionSlug), lesson.slug).toBe(true);
    }
  });

  it("no hay secciones vacías", () => {
    for (const section of SECTIONS) {
      expect(lessonsOfSection(section.slug).length, section.slug).toBeGreaterThan(0);
    }
  });

  it("usa slugs únicos", () => {
    const slugs = new Set(LESSONS.map((l) => l.slug));
    expect(slugs.size).toBe(LESSONS.length);
  });

  it("las lecciones van agrupadas por sección, sin saltar de una a otra y volver", () => {
    const visto = new Set<string>();
    let anterior = "";
    for (const lesson of COURSES.flatMap((course) => course.lessons)) {
      if (lesson.sectionSlug !== anterior) {
        expect(visto.has(lesson.sectionSlug), `${lesson.sectionSlug} aparece en dos bloques`).toBe(
          false,
        );
        visto.add(lesson.sectionSlug);
        anterior = lesson.sectionSlug;
      }
    }
  });

  it("encadena las lecciones hasta la última de cada curso, sin saltar de lenguaje", () => {
    for (const course of COURSES) {
      const last = course.lessons[course.lessons.length - 1];
      expect(nextLesson(last!.slug), course.language).toBeNull();
      expect(nextLesson(course.lessons[0]!.slug)?.slug).toBe(course.lessons[1]!.slug);
    }
  });

  it("cada sección y cada lección declara el lenguaje de su curso", () => {
    for (const course of COURSES) {
      for (const section of course.sections) expect(section.language).toBe(course.language);
      for (const lesson of course.lessons) expect(lesson.language).toBe(course.language);
    }
  });

  it("la práctica de cada sección apunta a retos que existen", () => {
    // Cada lenguaje tiene su banco: regex y KQL en la base, porque alimentan el
    // 1v1, y C# en el repo, porque se corrige en el navegador.
    const enLaBase = new Set(CHALLENGE_SEED.map((c) => c.slug));
    const enElRepo: Record<string, Set<string>> = {
      csharp: new Set(CSHARP_CHALLENGES.map((c) => c.slug)),
      bash: new Set(BASH_CHALLENGES.map((c) => c.slug)),
    };

    for (const section of SECTIONS) {
      const banco = enElRepo[section.language] ?? enLaBase;
      for (const slug of section.practiceSlugs) {
        expect(banco.has(slug), `${section.slug} -> ${slug}`).toBe(true);
      }
    }
  });

  /*
   * Antes esto exigia que el banco entero se practicara.
   *
   * Con 18 retos tenia sentido: cada uno caia en la practica de alguna
   * seccion y sobrar era señal de olvido. Al ampliarlo a 66 para que el 1v1
   * no repita, la exigencia se volvio la equivocada. El banco alimenta el
   * duelo, y la practica del curso es una seleccion de lo que se puede
   * resolver con lo aprendido hasta ese punto.
   *
   * Lo que sigue importando es que ninguna seccion se quede corta.
   */
  it("cada sección practica lo suficiente para asentar lo aprendido", () => {
    for (const section of SECTIONS) {
      expect(section.practiceSlugs.length, section.slug).toBeGreaterThanOrEqual(4);
    }
  });

  it("la práctica sale del banco y no lo agota", () => {
    const practicados = new Set(
      SECTIONS.filter((s) => s.language === "regex" || s.language === "kql").flatMap(
        (s) => s.practiceSlugs,
      ),
    );
    expect(practicados.size).toBeLessThan(CHALLENGE_SEED.length);
  });

  it("ningún reto se practica en dos secciones", () => {
    const todos = SECTIONS.flatMap((s) => s.practiceSlugs);
    expect(new Set(todos).size).toBe(todos.length);
  });
});

describe.each(LESSONS)("lección $slug", (lesson) => {
  it("tiene explicación y al menos un ejemplo", () => {
    expect(lesson.title.length).toBeGreaterThan(3);
    expect(lesson.summary.length).toBeGreaterThan(15);
    expect(lesson.body.length).toBeGreaterThanOrEqual(2);
    expect(lesson.examples.length).toBeGreaterThanOrEqual(1);
    expect(lesson.exercise.hint.length).toBeGreaterThan(15);
    expect(lesson.exercise.prompt.length).toBeGreaterThan(15);
  });
});

describe.each(LESSONS.filter(isPattern))("lección de patrones $slug", (lesson) => {
  it("tiene al menos dos ejemplos", () => {
    expect(lesson.examples.length).toBeGreaterThanOrEqual(2);
  });

  it("sus ejemplos hacen lo que el texto promete", () => {
    for (const example of lesson.examples) {
      expect(
        engineFor(lesson.language).guard(example.pattern),
        `${example.pattern} no pasa la guardia`,
      ).toBeNull();

      const encaja = exampleMatches(lesson, example.pattern, example.sample);
      if (example.expectsNoMatch) {
        expect(encaja, `${example.pattern} debería no encajar en ${example.sample}`).toBe(false);
      } else {
        expect(encaja, `${example.pattern} no encuentra nada en ${example.sample}`).toBe(true);
      }
      expect(example.note.length).toBeGreaterThan(10);
    }
  });

  it("su ejercicio se resuelve con la solución de referencia", () => {
    const { exercise } = lesson;
    expect(engineFor(lesson.language).guard(exercise.solution)).toBeNull();

    const result = evaluateFor(lesson.language, exercise.solution, exercise);
    expect(result.error).toBeNull();
    expect(result.passed, `no pasa: ${exercise.solution}`).toBe(true);
  });

  it("su ejercicio discrimina de verdad", () => {
    const { exercise } = lesson;
    expect(exercise.must_match.length).toBeGreaterThanOrEqual(3);
    expect(exercise.must_not_match.length).toBeGreaterThanOrEqual(3);
    // Un comodín no puede pasar, si no el ejercicio no enseña nada.
    expect(evaluateFor(lesson.language, COMODIN[lesson.language]!, exercise).passed).toBe(false);
  });
});

describe.each(LESSONS.filter((lesson) => lesson.language === "csharp"))(
  "lección de C# $slug",
  (lesson) => {
    if (lesson.language !== "csharp") return;

    it("sus ejemplos son programas con algo que mirar", () => {
      for (const example of lesson.examples) {
        expect(example.code).toContain("static void Main");
        expect(example.note.length).toBeGreaterThan(10);
      }
    });

    it("su ejercicio trae casos y una solución con la estructura de siempre", () => {
      const { exercise } = lesson;
      expect(exercise.cases.length).toBeGreaterThanOrEqual(1);
      expect(exercise.solution).toContain("static void Main");
      for (const caso of exercise.cases) {
        expect(typeof caso.stdin).toBe("string");
        expect(typeof caso.expected).toBe("string");
      }
    });

    it("si lee datos, todos sus casos traen entrada", () => {
      // Con la entrada vacía, Console.ReadLine devuelve null y el jugador se
      // encontraría un NullReferenceException que no es culpa suya.
      const lee = lesson.exercise.solution.includes("Console.ReadLine");
      for (const caso of lesson.exercise.cases) {
        if (lee) expect(caso.stdin.length, JSON.stringify(caso)).toBeGreaterThan(0);
      }
    });
  },
);

describe.each(LESSONS.filter((lesson) => lesson.language === "bash"))(
  "lección de Bash $slug",
  (lesson) => {
    if (lesson.language !== "bash") return;

    it("sus ejemplos son scripts con algo que mirar", () => {
      for (const example of lesson.examples) {
        expect(example.script.trim().length).toBeGreaterThan(0);
        expect(example.note.length).toBeGreaterThan(10);
      }
    });

    it("su ejercicio trae casos y una solución con shebang", () => {
      const { exercise } = lesson;
      expect(exercise.cases.length).toBeGreaterThanOrEqual(1);
      expect(exercise.solution.startsWith("#!/bin/bash")).toBe(true);
      for (const caso of exercise.cases) {
        expect(typeof caso.expected).toBe("string");
      }
    });

    it("no enseña objetivos que existan de verdad", () => {
      // La misma regla que vigila el banco: todo lo que se publica apunta a
      // rangos privados o a los que la RFC reserva para ejemplos.
      const texto = [
        ...lesson.body,
        ...lesson.examples.map((e) => e.script + e.note),
        lesson.exercise.prompt,
        lesson.exercise.solution,
      ].join("\n");

      for (const ip of new Set(texto.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) ?? [])) {
        const [a, b] = ip.split(".").map(Number) as [number, number];
        const laboratorio =
          a === 10 ||
          a === 127 ||
          (a === 192 && (b === 168 || b === 0)) ||
          (a === 172 && b >= 16 && b <= 31) ||
          (a === 198 && b === 51) ||
          (a === 203 && b === 0);
        expect(laboratorio, `${lesson.slug} menciona ${ip}`).toBe(true);
      }
    });
  },
);
