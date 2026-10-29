/**
 * `sed`, el editor de flujo.
 *
 * Es un lenguaje diminuto con su propia gramática: una dirección que dice
 * DÓNDE, y un comando que dice QUÉ. `2d` borra la segunda línea,
 * `/ERROR/d` borra las que traigan ERROR, y `1,5s/a/b/` sustituye solo en las
 * cinco primeras.
 *
 * Lo que queda fuera a propósito: el espacio de retención (`h H x g G`), que
 * casi nadie usa y que convertiría esto en el doble de código para ganar dos
 * trucos de concurso.
 */
import { compilePosixRegex } from "../regex.ts";
import { VfsError } from "../vfs.ts";
import { fromLines, parseArgs, readInputs, toLines, type Tool } from "./support.ts";

type Address =
  | { kind: "none" }
  | { kind: "line"; line: number }
  | { kind: "last" }
  | { kind: "regex"; regex: RegExp }
  | { kind: "range"; from: Address; to: Address };

interface Command {
  address: Address;
  /** `!` invierte la dirección: `/ERROR/!d` borra las que NO traen ERROR. */
  negated: boolean;
  name: string;
  /** Para `s` y `y`. */
  pattern?: RegExp;
  replacement?: string;
  global?: boolean;
  /** `s///3`: solo la tercera aparición. */
  occurrence?: number;
  print?: boolean;
  /** Para `a` e `i`. */
  text?: string;
}

class SedError extends Error {}

/** Parte el script en comandos, respetando las barras escapadas. */
function parseScript(script: string, extended: boolean): Command[] {
  const commands: Command[] = [];
  let i = 0;

  const readDelimited = (delimiter: string): string => {
    let out = "";
    while (i < script.length && script[i] !== delimiter) {
      if (script[i] === "\\" && script[i + 1] === delimiter) {
        out += delimiter;
        i += 2;
        continue;
      }
      if (script[i] === "\\") {
        out += script[i]! + (script[i + 1] ?? "");
        i += 2;
        continue;
      }
      out += script[i];
      i++;
    }
    if (i >= script.length) throw new SedError("unterminated address regex");
    i++;
    return out;
  };

  const readAddress = (): Address => {
    if (script[i] === "$") {
      i++;
      return { kind: "last" };
    }
    if (/[0-9]/.test(script[i] ?? "")) {
      let digits = "";
      while (/[0-9]/.test(script[i] ?? "")) digits += script[i++];
      return { kind: "line", line: Number(digits) };
    }
    if (script[i] === "/") {
      i++;
      const source = readDelimited("/");
      return {
        kind: "regex",
        regex: compilePosixRegex(source, { flavor: extended ? "ere" : "bre" }),
      };
    }
    return { kind: "none" };
  };

  while (i < script.length) {
    while (i < script.length && /[\s;]/.test(script[i]!)) i++;
    if (i >= script.length) break;

    if (script[i] === "#") {
      while (i < script.length && script[i] !== "\n") i++;
      continue;
    }

    let address = readAddress();
    if (address.kind !== "none" && script[i] === ",") {
      i++;
      address = { kind: "range", from: address, to: readAddress() };
    }

    let negated = false;
    while (script[i] === "!") {
      negated = true;
      i++;
    }
    while (script[i] === " ") i++;

    const name = script[i];
    if (name === undefined) throw new SedError("missing command");
    i++;

    if (name === "s") {
      const delimiter = script[i];
      if (!delimiter) throw new SedError("unterminated `s' command");
      i++;
      const pattern = readDelimited(delimiter);
      const replacement = readDelimited(delimiter);

      let global = false;
      let print = false;
      let occurrence: number | undefined;
      let ignoreCase = false;
      let digits = "";

      while (i < script.length && /[gpi0-9]/.test(script[i]!)) {
        if (script[i] === "g") global = true;
        else if (script[i] === "p") print = true;
        else if (script[i] === "i") ignoreCase = true;
        else digits += script[i];
        i++;
      }
      if (digits) occurrence = Number(digits);

      commands.push({
        address,
        negated,
        name: "s",
        pattern: compilePosixRegex(pattern, {
          flavor: extended ? "ere" : "bre",
          ignoreCase,
          global: true,
        }),
        replacement,
        global,
        print,
        ...(occurrence !== undefined ? { occurrence } : {}),
      });
      continue;
    }

    if (name === "y") {
      const delimiter = script[i]!;
      i++;
      const from = readDelimited(delimiter);
      const to = readDelimited(delimiter);
      commands.push({ address, negated, name: "y", replacement: from + "\u0000" + to });
      continue;
    }

    if (name === "a" || name === "i") {
      while (script[i] === " " || script[i] === "\\") i++;
      let text = "";
      while (i < script.length && script[i] !== "\n" && script[i] !== ";") text += script[i++];
      commands.push({ address, negated, name, text });
      continue;
    }

    commands.push({ address, negated, name });
  }

  return commands;
}

function matchesAddress(address: Address, line: string, index: number, total: number): boolean {
  switch (address.kind) {
    case "none":
      return true;
    case "line":
      return index + 1 === address.line;
    case "last":
      return index + 1 === total;
    case "regex":
      return address.regex.test(line);
    default:
      return false;
  }
}

/** El reemplazo de `s`, con `&` y `\1` como los entiende sed. */
function applyReplacement(match: RegExpExecArray, replacement: string): string {
  let out = "";
  for (let i = 0; i < replacement.length; i++) {
    const character = replacement[i]!;
    if (character === "\\") {
      const next = replacement[i + 1];
      if (next && /[1-9]/.test(next)) {
        out += match[Number(next)] ?? "";
        i++;
        continue;
      }
      if (next === "n") {
        out += "\n";
        i++;
        continue;
      }
      if (next === "t") {
        out += "\t";
        i++;
        continue;
      }
      if (next !== undefined) {
        out += next;
        i++;
        continue;
      }
      continue;
    }
    // Un `&` suelto es todo lo que casó.
    if (character === "&") {
      out += match[0];
      continue;
    }
    out += character;
  }
  return out;
}

function substitute(line: string, command: Command): { text: string; changed: boolean } {
  const regex = command.pattern!;
  regex.lastIndex = 0;

  let out = "";
  let last = 0;
  let count = 0;
  let changed = false;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    count++;
    const wanted = command.occurrence ?? 1;
    const replaceThis = command.global ? count >= wanted : count === wanted;

    if (replaceThis) {
      out += line.slice(last, match.index) + applyReplacement(match, command.replacement ?? "");
      last = match.index + match[0].length;
      changed = true;
    }

    if (match[0] === "") regex.lastIndex++;
    if (!command.global && count >= wanted) break;
  }

  return { text: out + line.slice(last), changed };
}

export const sed: Tool = (context) => {
  const parsed = parseArgs(context.args, {
    flags: "nEri",
    values: "e",
    long: { quiet: "n", "regexp-extended": "E", expression: "e", "in-place": "i" },
  });

  const operands = [...parsed.operands];
  const script = parsed.values.get("e") ?? operands.shift();
  if (script === undefined) {
    return { stdout: "", stderr: "usage: sed [-n] script [file ...]\n", status: 1 };
  }

  let commands: Command[];
  try {
    commands = parseScript(script, parsed.flags.has("E") || parsed.flags.has("r"));
  } catch (error) {
    return {
      stdout: "",
      stderr: `sed: -e expression #1, char ${script.length}: ${error instanceof Error ? error.message : "bad script"}\n`,
      status: 1,
    };
  }

  const quiet = parsed.flags.has("n");
  const inPlace = parsed.flags.has("i");
  const { inputs, errors } = readInputs(context, operands, "sed");

  let stdout = "";
  let quit = false;

  for (const input of inputs) {
    const lines = toLines(input.content);
    const out: string[] = [];
    // Cada rango abierto recuerda si ya empezó, porque `/a/,/b/` cierra en la
    // primera línea que case con el final DESPUÉS de haber empezado.
    const openRanges = new Map<number, boolean>();

    for (const [index, original] of lines.entries()) {
      if (quit) break;

      let line = original;
      let deleted = false;
      let printed = false;

      for (const [position, command] of commands.entries()) {
        let selected: boolean;

        if (command.address.kind === "range") {
          const open = openRanges.get(position) ?? false;
          if (!open) {
            selected = matchesAddress(command.address.from, line, index, lines.length);
            if (selected) openRanges.set(position, true);
          } else {
            selected = true;
            if (matchesAddress(command.address.to, line, index, lines.length)) {
              openRanges.set(position, false);
            }
          }
        } else {
          selected = matchesAddress(command.address, line, index, lines.length);
        }

        if (command.negated) selected = !selected;
        if (!selected) continue;

        switch (command.name) {
          case "s": {
            const result = substitute(line, command);
            line = result.text;
            if (result.changed && command.print) {
              out.push(line);
              printed = true;
            }
            break;
          }
          case "d":
            deleted = true;
            break;
          case "p":
            out.push(line);
            printed = true;
            break;
          case "q":
            quit = true;
            break;
          case "=":
            out.push(String(index + 1));
            break;
          case "a":
            // El texto va DESPUÉS, así que se apunta y se suelta al final.
            out.push(line);
            out.push(command.text ?? "");
            deleted = true;
            printed = true;
            break;
          case "i":
            out.push(command.text ?? "");
            break;
          case "y": {
            const [from = "", to = ""] = (command.replacement ?? "").split("\u0000");
            line = [...line]
              .map((character) => {
                const at = from.indexOf(character);
                return at === -1 ? character : (to[at] ?? character);
              })
              .join("");
            break;
          }
          default:
            return {
              stdout,
              stderr: `sed: -e expression #1: unknown command: \`${command.name}'\n`,
              status: 1,
            };
        }

        if (deleted) break;
      }

      if (!deleted && !quiet && !printed) out.push(line);
      if (quit && !deleted && quiet && !printed) break;
    }

    const text = fromLines(out);

    if (inPlace && input.name !== "-") {
      try {
        context.shell.vfs.writeFile(context.shell.resolve(input.name), text);
      } catch (error) {
        if (error instanceof VfsError) errors.push(`sed: ${input.name}: ${error.reason}`);
        else throw error;
      }
      continue;
    }

    stdout += text;
  }

  return errors.length > 0
    ? { stdout, stderr: errors.join("\n") + "\n", status: 1 }
    : { stdout, stderr: "", status: 0 };
};
