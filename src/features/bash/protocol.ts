/**
 * Lo que sale de correr un script, y lo que viaja si algún día esto se mete en
 * un trabajador o en una Edge Function.
 *
 * Todo lo de aquí tiene que ser serializable. El corrector no recibe el
 * intérprete, recibe un resultado, igual que en C#: así se prueba en Node sin
 * navegador y mañana se puede cambiar quién ejecuta sin tocar nada más.
 *
 * Sobre el idioma, que no es un descuido: lo que escriben las herramientas en
 * `stderr` va en INGLÉS y copiado de GNU, porque es lo que imprime una terminal
 * de verdad y porque `verify:bash` compara esta salida contra el bash real de
 * la máquina. Lo que habla la plataforma (que algo no está soportado, el tope
 * de tiempo, la corrección) va en español.
 */

export type BashRunStatus =
  /** El script terminó, con el código de salida que sea. */
  | "ok"
  /** No se pudo ni leer: un `fi` que falta, una comilla sin cerrar. */
  | "syntax_error"
  /** Sintaxis o herramienta que la plataforma todavía no implementa. */
  | "unsupported"
  /** Se agotó el presupuesto de pasos o de tiempo: casi siempre un bucle sin fin. */
  | "timeout"
  /** Imprimió más de lo que se puede sostener en memoria. */
  | "output_limit"
  /** Se rompió el intérprete. Es un bug nuestro, no del script. */
  | "internal_error";

export interface BashDiagnostic {
  /** En español: lo dice la plataforma, no una herramienta. */
  message: string;
  /** Desde 1, como se cuentan las líneas en el editor. */
  line?: number;
  column?: number;
}

/** Un archivo al terminar la corrida, para los retos que piden escribir algo. */
export interface FileSnapshot {
  content: string;
  mode: number;
  owner: string;
  group: string;
}

export interface BashRunResult {
  status: BashRunStatus;
  stdout: string;
  stderr: string;
  /** El código de salida del script, o sea el `$?` del final. */
  exitCode: number;
  /** Solo cuando el estado no es `ok`. */
  diagnostic?: BashDiagnostic;
  /**
   * Cómo quedaron los archivos. Hay retos que no se corrigen por lo que
   * imprimen sino por lo que dejan escrito, y sin esto habría que hacerles
   * imprimir el archivo al final, que es una pista falsa de cómo se trabaja.
   */
  files: Record<string, FileSnapshot>;
  /** Pasos consumidos. Es lo que hace determinista el tope de los bucles. */
  steps: number;
  milliseconds: number;
}

/** Con qué arranca una corrida. */
export interface BashRunRequest {
  /** El script del jugador. */
  source: string;
  /** Lo que el script lee por la entrada estándar, si lee algo. */
  stdin?: string;
  /** Los argumentos, o sea `$1`, `$2`... */
  args?: string[];
}
