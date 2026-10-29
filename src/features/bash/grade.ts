/**
 * Cómo se corrige un script de Bash.
 *
 * Aquí no se ejecuta nada: se recibe quién ejecuta, igual que el motor de regex
 * recibe su validador y el de C# su compilador. Así esto se prueba en Node sin
 * navegador, y el día que el ejecutor cambie no hay que tocar la corrección.
 *
 * Un reto de Bash no se corrige solo por lo que imprime. Hay tres cosas que
 * puede pedir, y las tres importan:
 *
 *   - lo que sale por pantalla, que es el caso corriente,
 *   - los archivos que deja escritos, porque un script que ordena un directorio
 *     no tiene por qué imprimir nada, y obligarlo a hacerlo enseñaría a
 *     programar al revés,
 *   - el código de salida, que es como un script le habla al que lo llamó.
 */
import { describeDifference, normalizeOutput } from "../editor/output.ts";
import type { BashRunRequest, BashRunResult } from "./protocol.ts";
import type { ShellSetup } from "./interp.ts";
import type { VfsSeed } from "./vfs.ts";

export interface BashCase {
  /** El árbol de archivos con el que arranca. */
  files?: VfsSeed;
  /** Lo que el script lee por la entrada estándar. */
  stdin?: string;
  /** Los argumentos: `$1`, `$2`... */
  args?: string[];
  /** Lo que tiene que imprimir. */
  expected: string;
  /** Archivos que tienen que quedar así al terminar. */
  expectedFiles?: Record<string, string>;
  /** El código de salida, cuando el reto va justamente de eso. */
  expectedExit?: number;
}

export type BashVerdict =
  | { kind: "pass"; actual: string }
  | { kind: "wrong_output"; expected: string; actual: string; stderr: string }
  | { kind: "wrong_file"; path: string; expected: string; actual: string | null }
  | { kind: "wrong_exit"; expected: number; actual: number }
  | { kind: "syntax_error"; message: string; line?: number; column?: number }
  | { kind: "unsupported"; message: string; line?: number }
  | { kind: "timeout" }
  | { kind: "output_limit" }
  | { kind: "internal_error"; message: string }
  /** No se llegó a correr porque uno anterior reventó. */
  | { kind: "skipped" };

/** Quien de verdad ejecuta. La firma es la de `runBash`. */
export type BashExecutor = (request: BashRunRequest, setup: ShellSetup) => BashRunResult;

/** Decide qué pasó con un caso, a partir de lo que devolvió la ejecución. */
export function judgeBash(result: BashRunResult, testCase: BashCase): BashVerdict {
  switch (result.status) {
    case "syntax_error":
      return {
        kind: "syntax_error",
        message: result.diagnostic?.message ?? "el script no se entiende",
        ...(result.diagnostic?.line !== undefined ? { line: result.diagnostic.line } : {}),
        ...(result.diagnostic?.column !== undefined ? { column: result.diagnostic.column } : {}),
      };
    case "unsupported":
      return {
        kind: "unsupported",
        message: result.diagnostic?.message ?? "eso todavía no está soportado",
        ...(result.diagnostic?.line !== undefined ? { line: result.diagnostic.line } : {}),
      };
    case "timeout":
      return { kind: "timeout" };
    case "output_limit":
      return { kind: "output_limit" };
    case "internal_error":
      return {
        kind: "internal_error",
        message: result.diagnostic?.message ?? "falló el intérprete",
      };
  }

  // El código de salida se mira primero: si el reto pedía uno concreto, es lo
  // que se estaba evaluando y lo demás sobra.
  if (testCase.expectedExit !== undefined && result.exitCode !== testCase.expectedExit) {
    return { kind: "wrong_exit", expected: testCase.expectedExit, actual: result.exitCode };
  }

  for (const [path, content] of Object.entries(testCase.expectedFiles ?? {})) {
    const written = result.files[path];
    if (!written || normalizeOutput(written.content) !== normalizeOutput(content)) {
      return {
        kind: "wrong_file",
        path,
        expected: content,
        actual: written ? written.content : null,
      };
    }
  }

  if (normalizeOutput(result.stdout) !== normalizeOutput(testCase.expected)) {
    return {
      kind: "wrong_output",
      expected: testCase.expected,
      actual: result.stdout,
      stderr: result.stderr,
    };
  }

  return { kind: "pass", actual: result.stdout };
}

export interface BashEvaluation {
  verdicts: BashVerdict[];
  passed: boolean;
  passedCount: number;
  totalCount: number;
}

/**
 * Corre el script contra todos los casos.
 *
 * Si uno revienta por sintaxis o por algo no soportado, los siguientes se
 * marcan como no corridos: el error va a ser el mismo en todos y repetirlo
 * cuatro veces no le dice nada nuevo a nadie.
 */
export function evaluateBash(
  source: string,
  cases: BashCase[],
  execute: BashExecutor,
): BashEvaluation {
  const verdicts: BashVerdict[] = [];
  let broken = false;

  for (const testCase of cases) {
    if (broken) {
      verdicts.push({ kind: "skipped" });
      continue;
    }

    const result = execute(
      {
        source,
        stdin: testCase.stdin ?? "",
        args: testCase.args ?? [],
      },
      { files: testCase.files ?? {} },
    );

    const verdict = judgeBash(result, testCase);
    if (["syntax_error", "unsupported", "internal_error"].includes(verdict.kind)) broken = true;
    verdicts.push(verdict);
  }

  const passedCount = verdicts.filter((verdict) => verdict.kind === "pass").length;

  return {
    verdicts,
    passed: verdicts.length > 0 && passedCount === verdicts.length,
    passedCount,
    totalCount: verdicts.length,
  };
}

/** El texto que se le enseña al jugador cuando un caso no pasa. */
export function explainVerdict(verdict: BashVerdict): string {
  switch (verdict.kind) {
    case "pass":
      return "Pasó.";
    case "wrong_output": {
      const difference = describeDifference(verdict.expected, verdict.actual);
      if (difference) return difference.message;
      return "La salida no es la que se esperaba.";
    }
    case "wrong_file":
      return verdict.actual === null
        ? `Falta el archivo ${verdict.path}: el script no lo creó.`
        : `El archivo ${verdict.path} no quedó como se esperaba.`;
    case "wrong_exit":
      return `Se esperaba que el script terminara con código ${verdict.expected} y terminó con ${verdict.actual}. El código de salida se pone con \`exit\`, y cero significa que todo fue bien.`;
    case "syntax_error":
      return verdict.line
        ? `En la línea ${verdict.line}: ${verdict.message}.`
        : `${verdict.message}.`;
    case "unsupported":
      return `${verdict.message}. Esto es un límite de la plataforma, no un error tuyo: prueba con otra manera de hacerlo.`;
    case "timeout":
      return "El script se quedó dando vueltas y hubo que cortarlo. Casi siempre es un bucle al que le falta avanzar o cuya condición nunca deja de ser cierta.";
    case "output_limit":
      return "El script imprimió sin parar. Revisa si hay un bucle que nunca termina.";
    case "internal_error":
      return `Se rompió el intérprete: ${verdict.message}. Esto es un fallo nuestro, no tuyo.`;
    case "skipped":
      return "No se llegó a correr porque un caso anterior falló antes.";
  }
}
