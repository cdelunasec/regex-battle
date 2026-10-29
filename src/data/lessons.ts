/**
 * Los cursos de la plataforma.
 *
 * El contenido de cada lenguaje vive en su archivo, porque una lección de
 * regex y una de KQL no se parecen al leerlas. Lo que comparten es la forma,
 * `Lesson`, y las pantallas que las pintan.
 *
 * Este módulo es el índice: junta los cursos y responde las preguntas que hace
 * la interfaz, siempre sin saltar de un lenguaje a otro.
 */
import type { Course, CourseLanguage, Lesson, Section } from "./lesson-types.ts";
import { REGEX_LESSONS, REGEX_SECTIONS } from "./regex-lessons.ts";
import { KQL_LESSONS, KQL_SECTIONS } from "./kql-lessons.ts";
import { CSHARP_LESSONS, CSHARP_SECTIONS } from "./csharp-lessons.ts";
import { BASH_LESSONS, BASH_SECTIONS } from "./bash-lessons.ts";

export type {
  BashLesson,
  Course,
  CourseLanguage,
  CSharpLesson,
  CSharpLessonExercise,
  Lesson,
  LessonExample,
  LessonExercise,
  PatternLesson,
  Section,
} from "./lesson-types.ts";

export const COURSES: Course[] = [
  {
    language: "regex",
    title: "Expresiones regulares",
    summary:
      "De cero hasta los retos difíciles del juego. Cada lección explica una pieza, la enseña funcionando sobre un texto que puedes editar, y termina con un ejercicio.",
    sections: REGEX_SECTIONS,
    lessons: REGEX_LESSONS,
  },
  {
    language: "kql",
    title: "KQL de Kibana",
    summary:
      "El lenguaje con el que se busca en logs para investigar un incidente. Cada lección trae un documento de verdad y una consulta que puedes cambiar para ver quién entra y quién no.",
    sections: KQL_SECTIONS,
    lessons: KQL_LESSONS,
  },
  {
    language: "bash",
    title: "Bash de Linux",
    summary:
      "La terminal como herramienta de trabajo: buscar en registros, encadenar comandos, revisar permisos y automatizar un reconocimiento. Cada lección trae scripts que puedes correr y cambiar ahí mismo.",
    sections: BASH_SECTIONS,
    lessons: BASH_LESSONS,
  },
  {
    language: "csharp",
    title: "C#",
    summary:
      "Programar de cero: guardar datos, decidir, repetir y organizar. Cada lección trae programas que puedes ejecutar y cambiar ahí mismo, y termina en un ejercicio que se compila de verdad.",
    sections: CSHARP_SECTIONS,
    lessons: CSHARP_LESSONS,
  },
];

export const SECTIONS: Section[] = COURSES.flatMap((course) => course.sections);
export const LESSONS: Lesson[] = COURSES.flatMap((course) => course.lessons);

export function findCourse(language: CourseLanguage): Course | undefined {
  return COURSES.find((course) => course.language === language);
}

/** El curso al que pertenece una lección o una sección. */
export function courseOfLesson(lesson: Lesson): Course | undefined {
  return findCourse(lesson.language);
}

/** Las lecciones de una sección, en orden. */
export function lessonsOfSection(sectionSlug: string): Lesson[] {
  return LESSONS.filter((lesson) => lesson.sectionSlug === sectionSlug);
}

export function findSection(sectionSlug: string): Section | undefined {
  return SECTIONS.find((section) => section.slug === sectionSlug);
}

/** El orden plano de cada curso, que es como se avanza. */
export const LESSON_ORDER: string[] = LESSONS.map((lesson) => lesson.slug);

export function findLesson(slug: string): Lesson | undefined {
  return LESSONS.find((lesson) => lesson.slug === slug);
}

/**
 * La siguiente lección del MISMO curso, o null si esta era la última.
 *
 * Que no salte de lenguaje es lo importante: terminar el último capítulo de
 * regex no puede dejarte de golpe en la primera lección de KQL.
 */
export function nextLesson(slug: string): Lesson | null {
  const lesson = findLesson(slug);
  if (!lesson) return null;
  const course = findCourse(lesson.language);
  if (!course) return null;

  const index = course.lessons.findIndex((candidate) => candidate.slug === slug);
  if (index === -1 || index === course.lessons.length - 1) return null;
  return course.lessons[index + 1] ?? null;
}
