/**
 * Las herramientas de texto: el corazón de cualquier script de análisis.
 *
 * Los formatos de salida están copiados de GNU corriendo con `LC_ALL=C`, no
 * inventados, porque `verify:bash` los compara carácter por carácter. Dos que
 * parecen caprichos y no lo son:
 *
 *   - `wc` alinea distinto según lea de un archivo o de una tubería. Con
 *     archivos calcula el ancho del número más grande; con la entrada estándar
 *     usa siete. Y con una sola columna y una sola entrada no alinea nada.
 *   - `uniq -c` siempre usa ancho siete, venga de donde venga.
 *
 * La otra regla que hay que tener presente: `uniq` solo junta líneas PEGADAS,
 * por eso en la vida real siempre va detrás de un `sort`.
 */
import { compilePosixRegex } from "../regex.ts";
import { VfsError } from "../vfs.ts";
import {
  fail,
  fromLines,
  ok,
  parseArgs,
  readInputs,
  toLines,
  usage,
  type Tool,
  type ToolResult,
} from "./support.ts";

export const cat: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "nbA" });
  const { inputs, errors } = readInputs(context, parsed.operands, "cat");

  let out = "";
  let counter = 0;

  for (const input of inputs) {
    if (!parsed.flags.has("n") && !parsed.flags.has("b")) {
      out += input.content;
      continue;
    }
    for (const line of toLines(input.content)) {
      // `-b` solo numera las que tienen algo escrito.
      if (parsed.flags.has("b") && line === "") {
        out += "\n";
        continue;
      }
      counter++;
      out += `${String(counter).padStart(6)}\t${line}\n`;
    }
  }

  return errors.length > 0 ? { stdout: out, stderr: errors.join("\n") + "\n", status: 1 } : ok(out);
};

export const head: Tool = (context) => {
  const parsed = parseArgs(context.args, {
    flags: "qv",
    values: "nc",
    long: { lines: "n", bytes: "c" },
  });
  const count = Number(parsed.values.get("n") ?? parsed.values.get("#") ?? "10");
  const bytes = parsed.values.has("c") ? Number(parsed.values.get("c")) : null;
  const { inputs, errors } = readInputs(context, parsed.operands, "head");

  let out = "";
  const many = inputs.length > 1 && !parsed.flags.has("q");

  inputs.forEach((input, position) => {
    if (many) out += `${position > 0 ? "\n" : ""}==> ${input.name} <==\n`;
    if (bytes !== null) {
      out += input.content.slice(0, bytes);
      return;
    }
    out += fromLines(toLines(input.content).slice(0, count));
  });

  return errors.length > 0 ? { stdout: out, stderr: errors.join("\n") + "\n", status: 1 } : ok(out);
};

export const tail: Tool = (context) => {
  const parsed = parseArgs(context.args, {
    flags: "qv",
    values: "nc",
    long: { lines: "n", bytes: "c" },
  });
  const raw = parsed.values.get("n") ?? parsed.values.get("#") ?? "10";
  // `tail -n +3` empieza en la línea 3 en vez de dar las últimas tres.
  const fromStart = raw.startsWith("+");
  const count = Number(fromStart ? raw.slice(1) : raw);
  const { inputs, errors } = readInputs(context, parsed.operands, "tail");

  let out = "";
  const many = inputs.length > 1 && !parsed.flags.has("q");

  inputs.forEach((input, position) => {
    if (many) out += `${position > 0 ? "\n" : ""}==> ${input.name} <==\n`;
    const lines = toLines(input.content);
    out += fromLines(fromStart ? lines.slice(Math.max(count - 1, 0)) : lines.slice(-count));
  });

  return errors.length > 0 ? { stdout: out, stderr: errors.join("\n") + "\n", status: 1 } : ok(out);
};

export const wc: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "lwcm" });
  const { inputs, errors } = readInputs(context, parsed.operands, "wc");

  const wantsLines = parsed.flags.has("l");
  const wantsWords = parsed.flags.has("w");
  const wantsBytes = parsed.flags.has("c") || parsed.flags.has("m");
  const nothingAsked = !wantsLines && !wantsWords && !wantsBytes;

  const columns = nothingAsked ? 3 : [wantsLines, wantsWords, wantsBytes].filter(Boolean).length;
  const fromFiles = parsed.operands.some((operand) => operand !== "-");

  interface Counts {
    lines: number;
    words: number;
    bytes: number;
    name: string;
  }

  const encoder = new TextEncoder();
  const counted: Counts[] = inputs.map((input) => ({
    // Cuenta saltos de línea, no líneas: un archivo sin salto final da cero.
    lines: (input.content.match(/\n/g) ?? []).length,
    words: input.content.split(/\s+/).filter((word) => word !== "").length,
    bytes: encoder.encode(input.content).length,
    name: input.name === "-" ? "" : input.name,
  }));

  const rows = [...counted];
  if (counted.length > 1) {
    rows.push({
      lines: counted.reduce((total, row) => total + row.lines, 0),
      words: counted.reduce((total, row) => total + row.words, 0),
      bytes: counted.reduce((total, row) => total + row.bytes, 0),
      name: "total",
    });
  }

  const numbersOf = (row: Counts): number[] => {
    if (nothingAsked) return [row.lines, row.words, row.bytes];
    const out: number[] = [];
    if (wantsLines) out.push(row.lines);
    if (wantsWords) out.push(row.words);
    if (wantsBytes) out.push(row.bytes);
    return out;
  };

  const widest = Math.max(
    1,
    ...rows.flatMap((row) => numbersOf(row).map((value) => String(value).length)),
  );
  const width = columns === 1 && rows.length === 1 ? 0 : fromFiles ? widest : 7;

  const out = rows
    .map((row) => {
      const numbers = numbersOf(row)
        .map((value) => String(value).padStart(width))
        .join(" ");
      return row.name ? `${numbers} ${row.name}` : numbers;
    })
    .join("\n");

  const text = out === "" ? "" : out + "\n";
  return errors.length > 0
    ? { stdout: text, stderr: errors.join("\n") + "\n", status: 1 }
    : ok(text);
};

/** Los campos que pide `-f`, que admite listas y rangos: `1,3`, `2-4`, `2-`. */
function parseRanges(spec: string): { from: number; to: number }[] {
  const ranges: { from: number; to: number }[] = [];

  for (const piece of spec.split(",")) {
    if (piece === "") continue;
    const dash = piece.indexOf("-");
    if (dash === -1) {
      const value = Number(piece);
      ranges.push({ from: value, to: value });
      continue;
    }
    const from = piece.slice(0, dash);
    const to = piece.slice(dash + 1);
    ranges.push({
      from: from === "" ? 1 : Number(from),
      to: to === "" ? Number.MAX_SAFE_INTEGER : Number(to),
    });
  }

  return ranges;
}

export const cut: Tool = (context) => {
  const parsed = parseArgs(context.args, {
    flags: "s",
    values: "dfc",
    long: { delimiter: "d", fields: "f" },
  });
  const delimiter = parsed.values.get("d") ?? "\t";
  const fieldSpec = parsed.values.get("f");
  const charSpec = parsed.values.get("c");

  if (!fieldSpec && !charSpec) {
    return usage("cut", "you must specify a list of bytes, characters, or fields");
  }

  const ranges = parseRanges(fieldSpec ?? charSpec!);
  const { inputs, errors } = readInputs(context, parsed.operands, "cut");
  const inRange = (position: number): boolean =>
    ranges.some((range) => position >= range.from && position <= range.to);

  let out = "";

  for (const input of inputs) {
    for (const line of toLines(input.content)) {
      if (charSpec) {
        out += [...line].filter((_character, index) => inRange(index + 1)).join("") + "\n";
        continue;
      }

      // Sin el delimitador, la línea sale entera, salvo que pidan `-s`.
      if (!line.includes(delimiter)) {
        if (!parsed.flags.has("s")) out += line + "\n";
        continue;
      }

      const fields = line.split(delimiter);
      out += fields.filter((_field, index) => inRange(index + 1)).join(delimiter) + "\n";
    }
  }

  return errors.length > 0 ? { stdout: out, stderr: errors.join("\n") + "\n", status: 1 } : ok(out);
};

/** Despliega los rangos y las clases de un conjunto de `tr`. */
function expandSet(spec: string): string[] {
  const out: string[] = [];
  let i = 0;

  while (i < spec.length) {
    if (spec.startsWith("[:", i)) {
      const end = spec.indexOf(":]", i);
      if (end !== -1) {
        const name = spec.slice(i + 2, end);
        const ranges: Record<string, [number, number][]> = {
          alpha: [
            [65, 90],
            [97, 122],
          ],
          digit: [[48, 57]],
          alnum: [
            [48, 57],
            [65, 90],
            [97, 122],
          ],
          upper: [[65, 90]],
          lower: [[97, 122]],
          space: [
            [9, 13],
            [32, 32],
          ],
          punct: [
            [33, 47],
            [58, 64],
            [91, 96],
            [123, 126],
          ],
        };
        for (const [from, to] of ranges[name] ?? []) {
          for (let code = from; code <= to; code++) out.push(String.fromCharCode(code));
        }
        i = end + 2;
        continue;
      }
    }

    if (spec[i] === "\\" && i + 1 < spec.length) {
      const escapes: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\" };
      out.push(escapes[spec[i + 1]!] ?? spec[i + 1]!);
      i += 2;
      continue;
    }

    if (spec[i + 1] === "-" && i + 2 < spec.length && spec[i + 2] !== "]") {
      for (let code = spec.charCodeAt(i); code <= spec.charCodeAt(i + 2); code++) {
        out.push(String.fromCharCode(code));
      }
      i += 3;
      continue;
    }

    out.push(spec[i]!);
    i++;
  }

  return out;
}

export const tr: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "dsc" });
  const [first, second] = parsed.operands;

  if (first === undefined) return usage("tr", "missing operand");

  let source = expandSet(first);
  const target = second === undefined ? [] : expandSet(second);
  const text = context.stdin.readAll();

  if (parsed.flags.has("c")) {
    const inSource = new Set(source);
    const complement: string[] = [];
    for (let code = 0; code < 128; code++) {
      const character = String.fromCharCode(code);
      if (!inSource.has(character)) complement.push(character);
    }
    source = complement;
  }

  if (parsed.flags.has("d")) {
    const remove = new Set(source);
    let out = [...text].filter((character) => !remove.has(character)).join("");
    if (parsed.flags.has("s") && target.length > 0) out = squeeze(out, new Set(target));
    return ok(out);
  }

  if (target.length === 0) {
    return parsed.flags.has("s") ? ok(squeeze(text, new Set(source))) : ok(text);
  }

  const map = new Map<string, string>();
  source.forEach((character, index) => {
    // Si el destino es más corto, se repite su último carácter.
    map.set(character, target[index] ?? target[target.length - 1]!);
  });

  const translated = [...text].map((character) => map.get(character) ?? character).join("");
  return ok(parsed.flags.has("s") ? squeeze(translated, new Set(target)) : translated);
};

function squeeze(text: string, characters: Set<string>): string {
  let out = "";
  let previous = "";
  for (const character of text) {
    if (character === previous && characters.has(character)) continue;
    out += character;
    previous = character;
  }
  return out;
}

export const sortTool: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "nrufbV", values: "kt" });
  const { inputs, errors } = readInputs(context, parsed.operands, "sort");
  const lines = inputs.flatMap((input) => toLines(input.content));

  const separator = parsed.values.get("t");
  const keySpec = parsed.values.get("k");

  const keyOf = (line: string): string => {
    if (!keySpec) return line;
    const fields = separator ? line.split(separator) : line.trim().split(/\s+/);
    const [fromText, toText] = keySpec.split(",");
    const from = Number((fromText ?? "1").replace(/[^0-9].*$/, "")) - 1;
    const to = toText ? Number(toText.replace(/[^0-9].*$/, "")) : from + 1;
    return fields.slice(from, to).join(separator ?? " ");
  };

  const numeric = parsed.flags.has("n");
  const fold = parsed.flags.has("f");

  const compare = (left: string, right: string): number => {
    let a = keyOf(left);
    let b = keyOf(right);

    if (numeric) {
      const na = Number.parseFloat(a.trim());
      const nb = Number.parseFloat(b.trim());
      const va = Number.isNaN(na) ? 0 : na;
      const vb = Number.isNaN(nb) ? 0 : nb;
      if (va !== vb) return va - vb;
      // Con la clave empatada, GNU desempata con la línea entera.
      return left < right ? -1 : left > right ? 1 : 0;
    }

    if (fold) {
      a = a.toLowerCase();
      b = b.toLowerCase();
    }

    if (a !== b) return a < b ? -1 : 1;
    return left < right ? -1 : left > right ? 1 : 0;
  };

  let sorted = [...lines].sort(compare);
  if (parsed.flags.has("r")) sorted.reverse();

  if (parsed.flags.has("u")) {
    const seen = new Set<string>();
    sorted = sorted.filter((line) => {
      const key = keyOf(line);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return errors.length > 0
    ? { stdout: fromLines(sorted), stderr: errors.join("\n") + "\n", status: 1 }
    : ok(fromLines(sorted));
};

export const uniq: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "cdui" });
  const { inputs, errors } = readInputs(context, parsed.operands, "uniq");
  const lines = inputs.flatMap((input) => toLines(input.content));

  const same = (left: string, right: string): boolean =>
    parsed.flags.has("i") ? left.toLowerCase() === right.toLowerCase() : left === right;

  const groups: { line: string; count: number }[] = [];
  for (const line of lines) {
    const last = groups[groups.length - 1];
    if (last && same(last.line, line)) last.count++;
    else groups.push({ line, count: 1 });
  }

  const wanted = groups.filter((group) => {
    if (parsed.flags.has("d")) return group.count > 1;
    if (parsed.flags.has("u")) return group.count === 1;
    return true;
  });

  const out = wanted.map((group) =>
    // Ancho siete siempre, lea de donde lea. Es así en GNU.
    parsed.flags.has("c") ? `${String(group.count).padStart(7)} ${group.line}` : group.line,
  );

  return errors.length > 0
    ? { stdout: fromLines(out), stderr: errors.join("\n") + "\n", status: 1 }
    : ok(fromLines(out));
};

export const tee: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "a" });
  const text = context.stdin.readAll();
  const errors: string[] = [];

  for (const path of parsed.operands) {
    const full = context.shell.resolve(path);
    try {
      if (parsed.flags.has("a")) context.shell.vfs.appendFile(full, text);
      else context.shell.vfs.writeFile(full, text);
    } catch (error) {
      if (error instanceof VfsError) errors.push(error.describe("tee"));
      else throw error;
    }
  }

  return errors.length > 0
    ? { stdout: text, stderr: errors.join("\n") + "\n", status: 1 }
    : ok(text);
};

export const nl: Tool = (context) => {
  const { inputs, errors } = readInputs(context, parseArgs(context.args).operands, "nl");
  let counter = 0;
  let out = "";

  for (const input of inputs) {
    for (const line of toLines(input.content)) {
      if (line === "") {
        out += "\n";
        continue;
      }
      counter++;
      out += `${String(counter).padStart(6)}\t${line}\n`;
    }
  }

  return errors.length > 0 ? { stdout: out, stderr: errors.join("\n") + "\n", status: 1 } : ok(out);
};

export const rev: Tool = (context) => {
  const { inputs } = readInputs(context, parseArgs(context.args).operands, "rev");
  const lines = inputs.flatMap((input) => toLines(input.content));
  return ok(fromLines(lines.map((line) => [...line].reverse().join(""))));
};

/** `grep -o` necesita buscar de nuevo desde donde terminó la vez anterior. */
export function findAll(line: string, regex: RegExp): string[] {
  const global = new RegExp(
    regex.source,
    regex.flags.includes("g") ? regex.flags : regex.flags + "g",
  );
  const out: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = global.exec(line)) !== null) {
    out.push(match[0]);
    // Un patrón que casa vacío avanzaría para siempre en el mismo sitio.
    if (match[0] === "") global.lastIndex++;
  }

  return out;
}
