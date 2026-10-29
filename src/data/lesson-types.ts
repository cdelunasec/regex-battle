/**
 * La forma de una lección, compartida por todos los cursos.
 *
 * Vive aparte del contenido porque ya hay tres cursos, y los tres se pintan
 * con las mismas pantallas. Lo que cambia entre ellos es el corrector, y eso lo
 * dice `language`.
 *
 * Una lección de C# no tiene la misma forma que una de regex o KQL, y por eso
 * `Lesson` es una unión y no un solo tipo con campos opcionales. En regex y KQL
 * un ejercicio es un patrón que tiene que encajar con unos textos y no con
 * otros. En C# es un programa que, con cada entrada, tiene que imprimir lo que
 * se espera. Forzar las dos cosas en la misma forma obligaría a comprobar en
 * cada sitio si el campo que toca está o no.
 */
import type { ChallengeLanguage, MatchMode } from "@/engine";
import type { BashCase } from "@/features/bash/grade";
import type { VfsSeed } from "@/features/bash/vfs";
import type { CSharpCase } from "@/features/csharp/grade";

/**
 * Los lenguajes que tienen curso.
 *
 * C# y Bash no están en `ChallengeLanguage` porque sus correctores no son del
 * motor: el de regex y KQL decide si un patrón encaja, y estos dos ejecutan.
 */
export type CourseLanguage = ChallengeLanguage | "csharp" | "bash";

export interface LessonExample {
  /** El patrón o la consulta que se muestra funcionando. */
  pattern: string;
  /** El texto de muestra, o el documento de log en KQL. */
  sample: string;
  /** Qué hay que fijarse. */
  note: string;
  /** Cuando el ejemplo enseña justamente que NO encaja nada. */
  expectsNoMatch?: boolean;
}

export interface LessonExercise {
  prompt: string;
  match_mode: MatchMode;
  must_match: string[];
  must_not_match: string[];
  hint: string;
  /** Referencia para los tests. Solo se le enseña al jugador si se rinde. */
  solution: string;
}

/** Un programa de ejemplo que se puede correr y editar ahí mismo. */
export interface CSharpExample {
  code: string;
  /** Lo que el programa lee, si lee algo. */
  stdin?: string;
  note: string;
}

export interface CSharpLessonExercise {
  prompt: string;
  /** El primero se enseña como ejemplo; el resto se comprueba sin enseñarlo. */
  cases: CSharpCase[];
  hint: string;
  /** Referencia, verificada por `npm run verify:csharp`. */
  solution: string;
  /** Con qué código arranca el editor. Por defecto, la plantilla de siempre. */
  starter?: string;
}

/** Un script de ejemplo, listo para correr y para que lo cambien. */
export interface BashExample {
  script: string;
  /** El árbol con el que arranca, si el ejemplo lee archivos. */
  files?: VfsSeed;
  /** Lo que lee por la entrada estándar. */
  stdin?: string;
  /** Con qué argumentos se llama. */
  args?: string[];
  /** Qué hay que fijarse. */
  note: string;
}

export interface BashLessonExercise {
  prompt: string;
  /** El primero se enseña como ejemplo; el resto se comprueba sin enseñarlo. */
  cases: BashCase[];
  hint: string;
  /** Referencia, verificada por `npm run verify:bash`. */
  solution: string;
  /** Con qué código arranca el editor. Por defecto, el shebang y ya. */
  starter?: string;
}

interface LessonBase {
  slug: string;
  sectionSlug: string;
  title: string;
  /** Una línea para el índice. */
  summary: string;
  /** La explicación, en párrafos. */
  body: string[];
}

export interface PatternLesson extends LessonBase {
  language: ChallengeLanguage;
  examples: LessonExample[];
  exercise: LessonExercise;
}

export interface CSharpLesson extends LessonBase {
  language: "csharp";
  examples: CSharpExample[];
  exercise: CSharpLessonExercise;
}

export interface BashLesson extends LessonBase {
  language: "bash";
  examples: BashExample[];
  exercise: BashLessonExercise;
}

export type Lesson = PatternLesson | CSharpLesson | BashLesson;

export interface Section {
  slug: string;
  language: CourseLanguage;
  title: string;
  summary: string;
  /**
   * Retos que ya se pueden resolver al terminar la sección, con lo aprendido
   * hasta aquí. En regex y KQL salen del banco de la base, el mismo que
   * alimenta el 1v1. En C# y en Bash salen de su archivo del repo, porque esos
   * dos no se pelean.
   */
  practiceSlugs: string[];
}

/** Un curso completo: sus secciones y sus lecciones, en orden. */
export interface Course {
  language: CourseLanguage;
  title: string;
  summary: string;
  sections: Section[];
  lessons: Lesson[];
}
