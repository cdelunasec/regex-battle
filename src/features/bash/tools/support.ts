/**
 * Lo que comparten todas las herramientas.
 *
 * Una herramienta aquí es una función de texto a texto: recibe argumentos y la
 * entrada, devuelve salida, errores y código. No puede tocar el shell, igual
 * que un programa de verdad no puede cambiarle el directorio al que lo llamó.
 * Lo único que comparte es el sistema de archivos.
 */
import type { Shell } from "../interp.ts";
import type { InputStream } from "../runtime.ts";
import { VfsError } from "../vfs.ts";

export interface ToolContext {
  args: string[];
  stdin: InputStream;
  shell: Shell;
}

export interface ToolResult {
  stdout: string;
  stderr: string;
  status: number;
}

export type Tool = (context: ToolContext) => ToolResult;

export function ok(stdout = ""): ToolResult {
  return { stdout, stderr: "", status: 0 };
}

export function fail(stderr: string, status = 1, stdout = ""): ToolResult {
  return { stdout, stderr, status };
}

/**
 * Separa banderas de operandos.
 *
 * `flags` son las letras sueltas y `values` las que llevan valor pegado o
 * detrás, como la `-d` de `cut`. Se aceptan agrupadas (`-in`) porque es como
 * se escriben de verdad, y `--` termina las opciones.
 */
export interface ParsedArgs {
  flags: Set<string>;
  values: Map<string, string>;
  operands: string[];
  /** La opción que no se reconoció, para poder quejarse como GNU. */
  unknown?: string;
}

export function parseArgs(
  args: string[],
  spec: { flags?: string; values?: string; long?: Record<string, string> } = {},
): ParsedArgs {
  const flagLetters = new Set(spec.flags ?? "");
  const valueLetters = new Set(spec.values ?? "");
  const long = spec.long ?? {};

  const flags = new Set<string>();
  const values = new Map<string, string>();
  const operands: string[] = [];
  let unknown: string | undefined;
  let index = 0;

  while (index < args.length) {
    const argument = args[index]!;

    if (argument === "--") {
      operands.push(...args.slice(index + 1));
      break;
    }

    if (argument.startsWith("--")) {
      const equals = argument.indexOf("=");
      const name = equals === -1 ? argument.slice(2) : argument.slice(2, equals);
      const mapped = long[name];
      if (!mapped) {
        unknown ??= argument;
        index++;
        continue;
      }
      if (valueLetters.has(mapped)) {
        values.set(mapped, equals === -1 ? (args[++index] ?? "") : argument.slice(equals + 1));
      } else {
        flags.add(mapped);
      }
      index++;
      continue;
    }

    // Un guion solo es un operando: significa la entrada estándar.
    if (argument.startsWith("-") && argument.length > 1) {
      const letters = argument.slice(1);
      for (let position = 0; position < letters.length; position++) {
        const letter = letters[position]!;

        if (valueLetters.has(letter)) {
          const rest = letters.slice(position + 1);
          values.set(letter, rest !== "" ? rest : (args[++index] ?? ""));
          break;
        }

        if (flagLetters.has(letter)) {
          flags.add(letter);
          continue;
        }

        // Un número pegado al guion es el argumento de `head -5` y `tail -3`.
        if (/[0-9]/.test(letter)) {
          values.set("#", letters.slice(position));
          break;
        }

        unknown ??= `-${letter}`;
      }
      index++;
      continue;
    }

    operands.push(argument);
    index++;
  }

  return unknown === undefined ? { flags, values, operands } : { flags, values, operands, unknown };
}

export interface NamedInput {
  /** Cómo se llama al imprimirlo, que para la entrada estándar es `-`. */
  name: string;
  content: string;
}

/**
 * Lee los archivos que le pasaron, o la entrada estándar si no le pasaron
 * ninguno. Es el comportamiento de `cat`, `grep`, `wc` y compañía.
 */
export function readInputs(
  context: ToolContext,
  paths: string[],
  tool: string,
): { inputs: NamedInput[]; errors: string[] } {
  const inputs: NamedInput[] = [];
  const errors: string[] = [];

  if (paths.length === 0) {
    inputs.push({ name: "-", content: context.stdin.readAll() });
    return { inputs, errors };
  }

  for (const path of paths) {
    if (path === "-") {
      inputs.push({ name: "-", content: context.stdin.readAll() });
      continue;
    }

    const full = context.shell.resolve(path);
    try {
      if (context.shell.vfs.isDir(full)) {
        errors.push(`${tool}: ${path}: Is a directory`);
        continue;
      }
      inputs.push({ name: path, content: context.shell.vfs.readFile(full) });
    } catch (error) {
      // Con el nombre tal como lo escribieron: GNU no imprime la ruta absoluta.
      if (error instanceof VfsError) errors.push(`${tool}: ${path}: ${error.reason}`);
      else throw error;
    }
  }

  return { inputs, errors };
}

/**
 * Parte un texto en líneas como lo hacen las herramientas de Unix.
 *
 * La última línea sin salto cuenta como línea igual, pero un texto que termina
 * en salto NO deja una línea vacía al final. Confundir esto descuadra cualquier
 * conteo.
 */
export function toLines(text: string): string[] {
  if (text === "") return [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Vuelve a juntar líneas, siempre con salto al final. */
export function fromLines(lines: string[]): string {
  return lines.length === 0 ? "" : lines.join("\n") + "\n";
}

/** Lo que hay que escribir cuando el error es del propio uso. */
export function usage(tool: string, message: string): ToolResult {
  return fail(`${tool}: ${message}\n`, 2);
}
