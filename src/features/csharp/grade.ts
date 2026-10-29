/**
 * Cómo se corrige un programa de C#.
 *
 * Un reto de C# no se parece a uno de regex: no hay textos que encajen o no.
 * Hay casos de prueba, cada uno con lo que el programa lee y lo que tiene que
 * imprimir. El programa pasa si con cada entrada imprime lo esperado.
 *
 * Aquí no se ejecuta nada. Se recibe quién ejecuta, igual que el motor de
 * regex recibe su validador, y así esto se prueba sin navegador.
 */
import type { CSharpDiagnostic, CSharpException, CSharpRunResult } from "./protocol.ts";
import type { CSharpExecutor } from "./runner.ts";

export interface CSharpCase {
  /** Lo que el programa lee con Console.ReadLine, una línea por dato. */
  stdin: string;
  /** Lo que tiene que imprimir. */
  expected: string;
}

export type CSharpVerdict =
  | { kind: "pass"; actual: string }
  | { kind: "wrong_output"; expected: string; actual: string }
  | { kind: "compile_error"; diagnostics: CSharpDiagnostic[] }
  | { kind: "runtime_error"; exception: CSharpException; explanation: string; actual: string }
  | { kind: "timeout" }
  | { kind: "output_limit" }
  | { kind: "crashed" }
  | { kind: "internal_error" }
  /** No se llegó a correr, porque un caso anterior tumbó el compilador. */
  | { kind: "skipped" };

/*
 * La comparación de salidas vive en `features/editor/output.ts`, porque es la
 * misma para C# y para Bash. Se reexporta desde aquí para no romper a quien ya
 * la importaba de este módulo.
 */
import { describeDifference, normalizeOutput, type OutputDifference } from "../editor/output.ts";

export { describeDifference, normalizeOutput, type OutputDifference };

/**
 * Qué significa cada excepción, dicho para quien está empezando.
 *
 * Los mensajes de .NET llegan en inglés, porque la librería base no viene
 * traducida. Estos no traducen el mensaje: explican qué suele haberlo causado.
 */
const EXCEPTION_EXPLANATIONS: Record<string, string> = {
  FormatException:
    "Intentaste convertir a número un texto que no lo es. Pasa mucho con int.Parse cuando la entrada trae letras, espacios o viene vacía.",
  DivideByZeroException: "Dividiste un número entero entre cero.",
  IndexOutOfRangeException:
    "Pediste una posición que el arreglo no tiene. Las posiciones empiezan en 0, así que la última es Length - 1.",
  ArgumentOutOfRangeException:
    "Pediste una posición fuera de la lista o del texto. En una List la última es Count - 1, y en un string es Length - 1.",
  NullReferenceException:
    "Usaste algo que vale null. Suele pasar al leer con Console.ReadLine cuando ya no quedan líneas por leer.",
  InvalidCastException: "Convertiste un valor a un tipo que no le corresponde.",
  OverflowException: "El número no cabe en el tipo que elegiste. Un int llega hasta 2147483647.",
  KeyNotFoundException: "Buscaste en un diccionario una clave que no tiene.",
  InvalidOperationException:
    "Hiciste algo que ese objeto no permite en ese momento, como pedir el primero de una lista vacía o cambiar una lista mientras la recorres con foreach.",
  ArgumentNullException: "Le pasaste null a algo que necesita un valor de verdad.",
  ArgumentException: "Le pasaste a un método un valor que no acepta.",
  PlatformNotSupportedException:
    "Usaste algo que no existe en el navegador. Casi siempre es una función de la consola o del sistema que aquí no está disponible.",
  NotImplementedException:
    "Llamaste a un método que todavía tiene el throw new NotImplementedException() dentro.",
};

export function explainException(type: string): string {
  return EXCEPTION_EXPLANATIONS[type] ?? `Tu programa lanzó ${type} y se detuvo ahí.`;
}

/** Decide qué pasó con un caso a partir de lo que devolvió la ejecución. */
export function judge(result: CSharpRunResult, expected: string): CSharpVerdict {
  switch (result.status) {
    case "ok": {
      const actual = result.stdout ?? "";
      return normalizeOutput(actual) === normalizeOutput(expected)
        ? { kind: "pass", actual }
        : { kind: "wrong_output", expected, actual };
    }
    case "compile_error":
      return { kind: "compile_error", diagnostics: result.diagnostics ?? [] };
    case "runtime_error": {
      const exception = result.exception ?? { type: "Exception", message: "" };
      return {
        kind: "runtime_error",
        exception,
        explanation: explainException(exception.type),
        actual: result.stdout ?? "",
      };
    }
    case "timeout":
      return { kind: "timeout" };
    case "output_limit":
      return { kind: "output_limit" };
    case "crashed":
      return { kind: "crashed" };
    default:
      return { kind: "internal_error" };
  }
}

export interface CSharpEvaluation {
  verdicts: CSharpVerdict[];
  passed: number;
  total: number;
  allPassed: boolean;
  /**
   * Los errores de compilación van aparte y una sola vez. Son los mismos para
   * todos los casos, y repetirlos por caso llenaría la pantalla del mismo error.
   */
  compileErrors: CSharpDiagnostic[] | null;
}

/**
 * Corre el programa con cada caso, en orden.
 *
 * Se para antes de tiempo en dos situaciones. Si no compila, el resto de
 * casos daría el mismo error. Y si un caso se colgó o tumbó el runtime, seguir
 * obligaría a arrancar el compilador otra vez por cada caso restante, que son
 * segundos cada vez, para enterarse de lo que ya se sabe.
 */
export async function evaluateCSharp(
  source: string,
  cases: CSharpCase[],
  executor: CSharpExecutor,
): Promise<CSharpEvaluation> {
  const verdicts: CSharpVerdict[] = [];
  let compileErrors: CSharpDiagnostic[] | null = null;

  for (const [index, testCase] of cases.entries()) {
    const verdict = judge(await executor.run(source, testCase.stdin), testCase.expected);
    verdicts.push(verdict);

    if (verdict.kind === "compile_error") {
      compileErrors = verdict.diagnostics;
      for (let rest = index + 1; rest < cases.length; rest++) verdicts.push(verdict);
      break;
    }

    if (verdict.kind === "timeout" || verdict.kind === "crashed") {
      for (let rest = index + 1; rest < cases.length; rest++) verdicts.push({ kind: "skipped" });
      break;
    }
  }

  const passed = verdicts.filter((verdict) => verdict.kind === "pass").length;
  return {
    verdicts,
    passed,
    total: cases.length,
    allPassed: cases.length > 0 && passed === cases.length,
    compileErrors,
  };
}
