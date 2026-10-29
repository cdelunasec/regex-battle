/**
 * `grep`, que es la herramienta con la que más se trabaja en seguridad.
 *
 * Lo delicado no son las banderas sino el sabor de la expresión: `grep` pelado
 * usa BRE y `grep -E` usa ERE, y las dos se traducen en `regex.ts`. Escribir
 * `grep '[0-9]\{1,3\}'` y `grep -E '[0-9]{1,3}'` tiene que dar lo mismo, y eso
 * es justo lo que confunde a todo el mundo la primera vez.
 *
 * Los códigos de salida son parte de la herramienta y no un detalle: 0 si
 * encontró algo, 1 si no encontró nada, 2 si hubo un error. Media lección de
 * condicionales se apoya en esa diferencia.
 */
import { compilePosixRegex, type RegexFlavor } from "../regex.ts";
import { VfsError } from "../vfs.ts";
import { fromLines, parseArgs, toLines, type NamedInput, type Tool } from "./support.ts";

export const grep: Tool = (context) => {
  const parsed = parseArgs(context.args, {
    flags: "ivcnlLoqEFwxrRhs",
    values: "emABC",
    long: {
      "invert-match": "v",
      "ignore-case": "i",
      count: "c",
      "line-number": "n",
      recursive: "r",
      "extended-regexp": "E",
      "fixed-strings": "F",
      "only-matching": "o",
      quiet: "q",
      regexp: "e",
    },
  });

  const operands = [...parsed.operands];
  const patterns: string[] = [];

  if (parsed.values.has("e")) patterns.push(parsed.values.get("e")!);
  else if (operands.length > 0) patterns.push(operands.shift()!);

  if (patterns.length === 0) {
    return { stdout: "", stderr: "usage: grep [OPTION]... PATTERNS [FILE]...\n", status: 2 };
  }

  const flavor: RegexFlavor = parsed.flags.has("E") ? "ere" : "bre";
  const ignoreCase = parsed.flags.has("i");
  const invert = parsed.flags.has("v");
  const recursive = parsed.flags.has("r") || parsed.flags.has("R");

  let matchers: RegExp[];
  try {
    matchers = patterns.map((pattern) => {
      // `-F` busca el texto tal cual, sin que los símbolos signifiquen nada.
      const source = parsed.flags.has("F")
        ? pattern.replace(/[.[\]*+?^$\\(){}|]/g, "\\$&")
        : pattern;
      /*
       * Al envolver el patrón para `-x` y `-w` hay que agrupar con la sintaxis
       * del sabor que toque: en ERE el grupo es `(...)`, pero en BRE esos
       * paréntesis son caracteres corrientes y el grupo se escribe `\(...\)`.
       * Usar los de ERE en BRE hacía que `grep -qx 10.0.0.7` buscara un texto
       * con paréntesis dentro y no encontrara nunca nada.
       */
      const basic = !parsed.flags.has("E") && !parsed.flags.has("F");
      const open = basic ? "\\(" : "(";
      const close = basic ? "\\)" : ")";
      const wrapped = parsed.flags.has("x")
        ? `^${open}${source}${close}$`
        : parsed.flags.has("w")
          ? `\\b${open}${source}${close}\\b`
          : source;
      return compilePosixRegex(wrapped, {
        flavor: parsed.flags.has("F") ? "ere" : flavor,
        ignoreCase,
        global: parsed.flags.has("o"),
      });
    });
  } catch (error) {
    return {
      stdout: "",
      stderr: `grep: ${error instanceof Error ? error.message : "patrón inválido"}\n`,
      status: 2,
    };
  }

  // Los archivos a mirar, con el recorrido de `-r` ya desplegado.
  const inputs: NamedInput[] = [];
  const errors: string[] = [];

  if (operands.length === 0) {
    inputs.push({ name: "(standard input)", content: context.stdin.readAll() });
  } else {
    for (const operand of operands) {
      if (operand === "-") {
        inputs.push({ name: "(standard input)", content: context.stdin.readAll() });
        continue;
      }

      const full = context.shell.resolve(operand);

      if (context.shell.vfs.isDir(full)) {
        if (!recursive) {
          if (!parsed.flags.has("s")) errors.push(`grep: ${operand}: Is a directory`);
          continue;
        }
        for (const entry of context.shell.vfs.walk(full)) {
          if (entry.kind !== "file") continue;
          // El nombre que se imprime es el que escribió el usuario, no el absoluto.
          const shown = operand.endsWith("/")
            ? operand + entry.path.slice(full.length + 1)
            : operand + entry.path.slice(full.length);
          inputs.push({ name: shown, content: context.shell.vfs.readFile(entry.path) });
        }
        continue;
      }

      try {
        inputs.push({ name: operand, content: context.shell.vfs.readFile(full) });
      } catch (error) {
        if (error instanceof VfsError) {
          if (!parsed.flags.has("s")) errors.push(`grep: ${operand}: ${error.reason}`);
        } else throw error;
      }
    }
  }

  const showNames = inputs.length > 1 && !parsed.flags.has("h");
  const maxCount = parsed.values.has("m") ? Number(parsed.values.get("m")) : Infinity;
  const before = Number(parsed.values.get("B") ?? parsed.values.get("C") ?? "0");
  const after = Number(parsed.values.get("A") ?? parsed.values.get("C") ?? "0");

  const out: string[] = [];
  let total = 0;

  for (const input of inputs) {
    const lines = toLines(input.content);
    const hits: number[] = [];

    lines.forEach((line, index) => {
      if (hits.length >= maxCount) return;
      const matched = matchers.some((matcher) => {
        matcher.lastIndex = 0;
        return matcher.test(line);
      });
      if (matched !== invert) hits.push(index);
    });

    total += hits.length;

    if (parsed.flags.has("q")) continue;

    if (parsed.flags.has("l")) {
      if (hits.length > 0) out.push(input.name);
      continue;
    }
    if (parsed.flags.has("L")) {
      if (hits.length === 0) out.push(input.name);
      continue;
    }
    if (parsed.flags.has("c")) {
      out.push(showNames ? `${input.name}:${hits.length}` : String(hits.length));
      continue;
    }

    const prefix = (index: number, separator: string): string =>
      (showNames ? `${input.name}${separator}` : "") +
      (parsed.flags.has("n") ? `${index + 1}${separator}` : "");

    const printed = new Set<number>();

    for (const hit of hits) {
      for (let index = Math.max(hit - before, 0); index < hit; index++) {
        if (printed.has(index)) continue;
        printed.add(index);
        out.push(prefix(index, "-") + lines[index]!);
      }

      if (!printed.has(hit)) {
        printed.add(hit);
        if (parsed.flags.has("o")) {
          for (const matcher of matchers) {
            matcher.lastIndex = 0;
            const line = lines[hit]!;
            let match: RegExpExecArray | null;
            while ((match = matcher.exec(line)) !== null) {
              out.push(prefix(hit, ":") + match[0]);
              if (match[0] === "") matcher.lastIndex++;
              if (!matcher.global) break;
            }
          }
        } else {
          out.push(prefix(hit, ":") + lines[hit]!);
        }
      }

      for (let index = hit + 1; index <= Math.min(hit + after, lines.length - 1); index++) {
        if (printed.has(index)) continue;
        printed.add(index);
        out.push(prefix(index, "-") + lines[index]!);
      }
    }
  }

  const stderr = errors.length > 0 ? errors.join("\n") + "\n" : "";
  const status = errors.length > 0 && total === 0 ? 2 : total > 0 ? 0 : 1;

  return {
    stdout: parsed.flags.has("q") ? "" : fromLines(out),
    stderr,
    status,
  };
};
