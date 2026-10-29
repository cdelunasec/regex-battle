/**
 * Los lenguajes de la plataforma.
 *
 * Esto no es decoración de la página de inicio, es la hoja de ruta escrita
 * donde se puede leer. La plataforma no es de expresiones regulares: se empezó
 * por ahí porque es el único lenguaje que se valida sin ejecutar código, así
 * que se podía comprobar que el juego entero funcionaba antes de meterse con
 * sandboxes.
 *
 * `validation` es el campo importante. Dice cómo se comprobaría que la
 * respuesta de alguien está bien en ese lenguaje, y de ahí sale cuánto trabajo
 * falta. El motor ya está preparado: `src/engine/evaluate.ts` no importa
 * ningún validador, recibe uno, así que sumar un lenguaje es escribir su
 * adaptador y su banco de retos, no rehacer el juego.
 */
export type TrackStatus = "disponible" | "planeado";

export interface Track {
  slug: string;
  name: string;
  /** Qué se aprende, en una línea. */
  tagline: string;
  status: TrackStatus;
  /** Cómo se validarían las respuestas. Es lo que decide la dificultad real. */
  validation: string;
  /** Color de acento, en oklch para que case con el tema. */
  accent: string;
}

export const TRACKS: Track[] = [
  {
    slug: "regex",
    name: "Expresiones regulares",
    tagline: "Buscar patrones dentro de texto. El primero que está listo.",
    status: "disponible",
    validation: "Listas de casos que deben pasar y casos que no. Sin ejecutar código.",
    accent: "oklch(0.65 0.2 265)",
  },
  {
    slug: "sql",
    name: "SQL",
    tagline: "Consultar y cruzar datos.",
    status: "planeado",
    validation: "Correr la consulta contra una base de prueba y comparar el resultado.",
    accent: "oklch(0.65 0.16 200)",
  },
  {
    slug: "python",
    name: "Python",
    tagline: "Lógica, estructuras de datos y algoritmos.",
    status: "planeado",
    validation: "Ejecutar la función con entradas conocidas. Necesita un entorno aislado.",
    accent: "oklch(0.7 0.15 95)",
  },
  {
    slug: "javascript",
    name: "JavaScript",
    tagline: "Lo mismo, pero en el lenguaje del navegador.",
    status: "planeado",
    validation: "Ejecutar en un worker aislado, con tiempo y memoria topados.",
    accent: "oklch(0.78 0.16 90)",
  },
  {
    slug: "html-css",
    name: "HTML y CSS",
    tagline: "Maquetar y darle forma a una página.",
    status: "planeado",
    validation: "Comparar la estructura y los estilos que resultan contra los esperados.",
    accent: "oklch(0.65 0.19 35)",
  },
  {
    slug: "kql",
    name: "KQL de Kibana",
    tagline: "Buscar en logs, lo que se usa para investigar incidentes.",
    status: "disponible",
    validation:
      "El caso de prueba es un log en JSON y la consulta decide si entra. Sin ejecutar código.",
    accent: "oklch(0.66 0.15 160)",
  },
  {
    slug: "bash",
    name: "Bash de Linux",
    tagline: "La terminal: procesar registros, revisar permisos y automatizar trabajo.",
    status: "disponible",
    validation:
      "Se interpreta en el navegador, con un sistema de archivos de mentira. El caso de prueba son unos archivos y unos argumentos, y el script tiene que imprimir lo que se espera o dejar escrito lo que se le pidió. Como C#, todavía no se pelea: en el 1v1 el que corrige es el servidor.",
    accent: "oklch(0.72 0.14 135)",
  },
  {
    slug: "csharp",
    name: "C#",
    tagline: "Programas de consola: lo que se da en Programación.",
    status: "disponible",
    validation:
      "Se compila y se ejecuta en el navegador con Roslyn en WebAssembly. El caso de prueba es una entrada y la salida que el programa tiene que imprimir. Por eso se aprende y se practica, pero todavía no se pelea: en el 1v1 el que corrige es el servidor.",
    accent: "oklch(0.58 0.2 305)",
  },
  {
    slug: "cpp",
    name: "C++",
    tagline: "Programación de sistemas, memoria y rendimiento.",
    status: "planeado",
    validation: "Compilar y ejecutar fuera del navegador. Es el más pesado de los siete.",
    accent: "oklch(0.6 0.17 285)",
  },
];

export const AVAILABLE_TRACKS = TRACKS.filter((track) => track.status === "disponible");
export const PLANNED_TRACKS = TRACKS.filter((track) => track.status === "planeado");
