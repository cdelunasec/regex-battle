/**
 * Lo que viaja entre la página y el trabajador que compila C#.
 *
 * Los resultados son un espejo de `RunResult` en tools/csharp-runner, con dos
 * estados más que no puede poner C#, porque cuando pasan ya no está vivo para
 * contarlo: `timeout`, cuando el programa no terminó a tiempo y hubo que matar
 * el trabajador, y `crashed`, cuando el runtime entero se cayó.
 */

export type CSharpRunStatus =
  | "ok"
  | "compile_error"
  | "runtime_error"
  | "output_limit"
  | "no_entry_point"
  | "internal_error"
  | "not_ready"
  | "timeout"
  | "crashed";

export interface CSharpDiagnostic {
  /** El código del compilador, como CS1002. */
  id: string;
  /** En español: el compilador carga sus mensajes traducidos. */
  message: string;
  /** Desde 1. Ausente cuando el error no es del código del jugador. */
  line?: number;
  column?: number;
}

export interface CSharpException {
  /** El nombre corto del tipo, como FormatException. */
  type: string;
  /** En inglés: los mensajes de .NET no vienen traducidos. */
  message: string;
}

export interface CSharpRunResult {
  status: CSharpRunStatus;
  stdout?: string;
  diagnostics?: CSharpDiagnostic[];
  exception?: CSharpException;
  compileMs?: number;
  runMs?: number;
}

export interface CSharpInitInfo {
  references: number;
  missing: string[];
  messagesInSpanish: boolean;
  warmupStatus: string;
  milliseconds: number;
}

export interface WorkerRunRequest {
  type: "run";
  id: number;
  source: string;
  stdin: string;
}

export type WorkerResponse =
  | { type: "ready"; init: CSharpInitInfo; bootMs: number }
  | { type: "result"; id: number; result: CSharpRunResult }
  | { type: "failed"; message: string }
  /**
   * El runtime se murió en medio de una ejecución. Lo típico es una recursión
   * sin fin: desborda la pila y .NET aborta entero.
   */
  | { type: "crashed"; id: number };
