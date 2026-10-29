/**
 * `jq`, `comm`, `paste` y `diff`: lo que hace falta para cruzar resultados.
 *
 * `jq` es el que más pesa aquí, y es el que hace falta de verdad: casi toda
 * herramienta moderna escupe JSON, y en un script de bash eso no se puede
 * masticar con `cut`. El subconjunto que se soporta es el que se usa al
 * trabajar: acceder a campos, recorrer listas, filtrar con `select` y sacar el
 * texto crudo con `-r`.
 *
 * Un filtro de jq no devuelve un valor sino una LISTA de valores, y ahí está su
 * gracia: `.[]` convierte una lista de diez elementos en diez resultados, y lo
 * que venga detrás de la tubería corre una vez por cada uno.
 */
import { fromLines, ok, parseArgs, readInputs, toLines, type Tool } from "./support.ts";

class JqError extends Error {}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

// ------------------------------------------------------------------- filtros

type Filter = (input: Json) => Json[];

interface JqToken {
  kind: "punct" | "name" | "string" | "number" | "field";
  text: string;
}

function tokenizeJq(source: string): JqToken[] {
  const tokens: JqToken[] = [];
  let i = 0;

  while (i < source.length) {
    const character = source[i]!;

    if (/\s/.test(character)) {
      i++;
      continue;
    }

    if (character === '"') {
      i++;
      let text = "";
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\") {
          text += source[i + 1];
          i += 2;
          continue;
        }
        text += source[i++];
      }
      i++;
      tokens.push({ kind: "string", text });
      continue;
    }

    if (character === "." && /[A-Za-z_]/.test(source[i + 1] ?? "")) {
      const match = /^\.[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i))!;
      tokens.push({ kind: "field", text: match[0].slice(1) });
      i += match[0].length;
      continue;
    }

    if (/[0-9]/.test(character) || (character === "-" && /[0-9]/.test(source[i + 1] ?? ""))) {
      const match = /^-?[0-9]+(\.[0-9]+)?/.exec(source.slice(i))!;
      tokens.push({ kind: "number", text: match[0] });
      i += match[0].length;
      continue;
    }

    if (/[A-Za-z_]/.test(character)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i))!;
      tokens.push({ kind: "name", text: match[0] });
      i += match[0].length;
      continue;
    }

    const twoChar = ["==", "!=", "<=", ">=", "//"].find((candidate) =>
      source.startsWith(candidate, i),
    );
    if (twoChar) {
      tokens.push({ kind: "punct", text: twoChar });
      i += 2;
      continue;
    }

    tokens.push({ kind: "punct", text: character });
    i++;
  }

  return tokens;
}

class JqParser {
  private readonly tokens: JqToken[];
  private index = 0;

  constructor(tokens: JqToken[]) {
    this.tokens = tokens;
  }

  private peek(): JqToken | undefined {
    return this.tokens[this.index];
  }

  private at(text: string): boolean {
    const token = this.peek();
    return token !== undefined && token.text === text && token.kind !== "string";
  }

  private eat(text: string): boolean {
    if (!this.at(text)) return false;
    this.index++;
    return true;
  }

  parse(): Filter {
    const filter = this.parsePipe();
    if (this.index < this.tokens.length) {
      throw new JqError(`syntax error, unexpected ${this.peek()?.text ?? ""}`);
    }
    return filter;
  }

  private parsePipe(): Filter {
    let left = this.parseComma();
    while (this.eat("|")) {
      const right = this.parseComma();
      const previous = left;
      // La tubería corre lo de la derecha una vez por cada valor de la izquierda.
      left = (input) => previous(input).flatMap((value) => right(value));
    }
    return left;
  }

  private parseComma(): Filter {
    let left = this.parseComparison();
    while (this.eat(",")) {
      const right = this.parseComparison();
      const previous = left;
      left = (input) => [...previous(input), ...right(input)];
    }
    return left;
  }

  /**
   * La suma de jq, que también pega textos y junta listas.
   *
   * Hace falta para armar una línea con varios campos:
   * `.info.severity + " " + .host`, que es como se saca un informe legible de
   * un JSON sin salir de jq.
   */
  private parseAdditive(): Filter {
    let left = this.parseUnary();

    for (;;) {
      const plus = this.at("+");
      const minus = this.at("-");
      if (!plus && !minus) return left;
      this.index++;

      const right = this.parseUnary();
      const previous = left;

      left = (input) => {
        const a = previous(input)[0] ?? null;
        const b = right(input)[0] ?? null;

        if (minus) {
          if (typeof a === "number" && typeof b === "number") return [a - b];
          if (Array.isArray(a) && Array.isArray(b)) {
            const remove = new Set(b.map((item) => JSON.stringify(item)));
            return [a.filter((item) => !remove.has(JSON.stringify(item)))];
          }
          throw new JqError("cannot be subtracted");
        }

        if (a === null) return [b];
        if (b === null) return [a];
        if (typeof a === "number" && typeof b === "number") return [a + b];
        if (typeof a === "string" && typeof b === "string") return [a + b];
        if (Array.isArray(a) && Array.isArray(b)) return [[...a, ...b]];
        if (typeof a === "object" && typeof b === "object") return [{ ...a, ...b }];
        throw new JqError(`${typeOf(a)} and ${typeOf(b)} cannot be added`);
      };
    }
  }

  private parseComparison(): Filter {
    const left = this.parseAdditive();
    const token = this.peek();
    const operators = ["==", "!=", "<", "<=", ">", ">="];

    if (token && token.kind === "punct" && operators.includes(token.text)) {
      this.index++;
      const right = this.parseAdditive();
      return (input) => {
        const a = left(input)[0] ?? null;
        const b = right(input)[0] ?? null;
        switch (token.text) {
          case "==":
            return [JSON.stringify(a) === JSON.stringify(b)];
          case "!=":
            return [JSON.stringify(a) !== JSON.stringify(b)];
          case "<":
            return [(a as number) < (b as number)];
          case "<=":
            return [(a as number) <= (b as number)];
          case ">":
            return [(a as number) > (b as number)];
          default:
            return [(a as number) >= (b as number)];
        }
      };
    }

    return left;
  }

  private parseUnary(): Filter {
    const token = this.peek();

    if (token?.kind === "number") {
      this.index++;
      return () => [Number(token.text)];
    }
    if (token?.kind === "string") {
      this.index++;
      return () => [token.text];
    }

    if (token?.kind === "name") {
      this.index++;
      switch (token.text) {
        case "select": {
          const condition = this.parseParens();
          return (input) => (truthyJson(condition(input)[0] ?? null) ? [input] : []);
        }
        case "map": {
          const inner = this.parseParens();
          return (input) => {
            if (!Array.isArray(input)) throw new JqError("Cannot iterate over non-array");
            return [input.flatMap((item) => inner(item))];
          };
        }
        case "has": {
          const inner = this.parseParens();
          return (input) => {
            const key = inner(null)[0];
            if (Array.isArray(input)) return [input[Number(key)] !== undefined];
            if (input && typeof input === "object") return [(key as string) in input];
            return [false];
          };
        }
        case "length":
          return (input) => [lengthOf(input)];
        case "keys":
        case "keys_unsorted":
          return (input) => {
            if (Array.isArray(input)) return [input.map((_, index) => index)];
            if (input && typeof input === "object") {
              const names = Object.keys(input);
              return [token.text === "keys" ? names.sort() : names];
            }
            throw new JqError("has no keys");
          };
        case "type":
          return (input) => [typeOf(input)];
        case "tostring":
          return (input) => [typeof input === "string" ? input : JSON.stringify(input)];
        case "tonumber":
          return (input) => [Number(input)];
        case "not":
          return (input) => [!truthyJson(input)];
        case "empty":
          return () => [];
        case "true":
          return () => [true];
        case "false":
          return () => [false];
        case "null":
          return () => [null];
        case "add":
          return (input) => {
            if (!Array.isArray(input)) throw new JqError("Cannot add non-array");
            if (input.every((item) => typeof item === "number")) {
              return [input.reduce((total: number, item) => total + (item as number), 0)];
            }
            return [input.join("")];
          };
        case "unique":
          return (input) => {
            if (!Array.isArray(input)) throw new JqError("Cannot unique non-array");
            const seen = new Set(input.map((item) => JSON.stringify(item)));
            return [[...seen].map((item) => JSON.parse(item) as Json).sort(compareJson)];
          };
        case "sort":
          return (input) => {
            if (!Array.isArray(input)) throw new JqError("Cannot sort non-array");
            return [[...input].sort(compareJson)];
          };
        case "join": {
          const inner = this.parseParens();
          return (input) => {
            if (!Array.isArray(input)) throw new JqError("Cannot join non-array");
            return [
              input
                .map((item) => (item === null ? "" : String(item)))
                .join(String(inner(null)[0] ?? "")),
            ];
          };
        }
        default:
          throw new JqError(`${token.text}/0 is not defined`);
      }
    }

    return this.parsePath();
  }

  private parseParens(): Filter {
    if (!this.eat("(")) throw new JqError("expected (");
    const inner = this.parsePipe();
    if (!this.eat(")")) throw new JqError("expected )");
    return inner;
  }

  /** `.`, `.campo`, `.[]`, `.[0]`, y todo lo que se encadene detrás. */
  private parsePath(): Filter {
    if (this.eat("(")) {
      const inner = this.parsePipe();
      if (!this.eat(")")) throw new JqError("expected )");
      return this.parseSuffixes(inner);
    }

    const token = this.peek();
    let filter: Filter;

    if (token?.kind === "field") {
      this.index++;
      filter = (input) => [fieldOf(input, token.text)];
    } else if (this.eat(".")) {
      filter = (input) => [input];
    } else {
      throw new JqError(`syntax error, unexpected ${token?.text ?? "end"}`);
    }

    return this.parseSuffixes(filter);
  }

  private parseSuffixes(base: Filter): Filter {
    let filter = base;

    for (;;) {
      const token = this.peek();

      if (token?.kind === "field") {
        this.index++;
        const previous = filter;
        filter = (input) => previous(input).map((value) => fieldOf(value, token.text));
        continue;
      }

      if (this.at("[")) {
        this.index++;
        const previous = filter;

        if (this.eat("]")) {
          // `.[]` despliega la lista en varios resultados.
          filter = (input) =>
            previous(input).flatMap((value) => {
              if (Array.isArray(value)) return value;
              if (value && typeof value === "object") return Object.values(value);
              throw new JqError(`Cannot iterate over ${typeOf(value)}`);
            });
          continue;
        }

        const inner = this.parsePipe();
        if (!this.eat("]")) throw new JqError("expected ]");
        filter = (input) =>
          previous(input).map((value) => {
            const key = inner(null)[0];
            if (typeof key === "number" && Array.isArray(value)) return value[key] ?? null;
            return fieldOf(value, String(key));
          });
        continue;
      }

      if (this.at(".") && this.tokens[this.index + 1]?.kind === "field") {
        this.index++;
        continue;
      }

      return filter;
    }
  }
}

function fieldOf(value: Json, name: string): Json {
  if (value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new JqError(`Cannot index ${typeOf(value)} with "${name}"`);
  }
  return value[name] ?? null;
}

function typeOf(value: Json): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function lengthOf(value: Json): number {
  if (value === null) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === "string") return value.length;
  if (typeof value === "object") return Object.keys(value).length;
  return Math.abs(value as number);
}

function truthyJson(value: Json): boolean {
  return value !== null && value !== false;
}

function compareJson(left: Json, right: Json): number {
  const a = typeof left === "number" ? left : String(left);
  const b = typeof right === "number" ? right : String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Como lo imprime jq: con sangría de dos, o de una línea con `-c`. */
function renderJson(value: Json, compact: boolean, indent = 0): string {
  if (compact) return JSON.stringify(value);

  const pad = "  ".repeat(indent + 1);
  const closePad = "  ".repeat(indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[\n${value.map((item) => pad + renderJson(item, false, indent + 1)).join(",\n")}\n${closePad}]`;
  }

  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    return `{\n${keys
      .map((key) => `${pad}${JSON.stringify(key)}: ${renderJson(value[key]!, false, indent + 1)}`)
      .join(",\n")}\n${closePad}}`;
  }

  return JSON.stringify(value);
}

/** Varios documentos pegados, que es como llegan los JSONL de las herramientas. */
function parseJsonStream(text: string): Json[] {
  const out: Json[] = [];
  let i = 0;

  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i]!)) i++;
    if (i >= text.length) break;

    let depth = 0;
    let inString = false;
    const start = i;

    for (; i < text.length; i++) {
      const character = text[i]!;
      if (inString) {
        if (character === "\\") i++;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === "{" || character === "[") depth++;
      else if (character === "}" || character === "]") depth--;
      else if (depth === 0 && /\s/.test(character)) break;
      if (depth === 0 && (character === "}" || character === "]")) {
        i++;
        break;
      }
    }

    const piece = text.slice(start, i).trim();
    if (piece === "") continue;
    out.push(JSON.parse(piece) as Json);
  }

  return out;
}

export const jq: Tool = (context) => {
  const parsed = parseArgs(context.args, {
    flags: "rcens",
    long: { raw_output: "r", compact_output: "c" },
  });
  const operands = [...parsed.operands];
  const program = operands.shift();

  if (program === undefined) {
    return { stdout: "", stderr: "usage: jq [-r] [-c] filter [file ...]\n", status: 2 };
  }

  let filter: Filter;
  try {
    filter = new JqParser(tokenizeJq(program)).parse();
  } catch (error) {
    return {
      stdout: "",
      stderr: `jq: error: ${error instanceof Error ? error.message : "bad filter"}\n`,
      status: 3,
    };
  }

  const { inputs, errors } = readInputs(context, operands, "jq");
  const text = inputs.map((input) => input.content).join("");

  let documents: Json[];
  try {
    documents = parseJsonStream(text);
  } catch {
    return { stdout: "", stderr: "jq: error: entrada JSON mal formada\n", status: 2 };
  }

  const out: string[] = [];

  try {
    for (const document of documents) {
      for (const value of filter(document)) {
        // `-r` saca el texto sin comillas, que es lo que se encadena con grep.
        out.push(
          parsed.flags.has("r") && typeof value === "string"
            ? value
            : renderJson(value, parsed.flags.has("c")),
        );
      }
    }
  } catch (error) {
    return {
      stdout: fromLines(out),
      stderr: `jq: error: ${error instanceof Error ? error.message : "error"}\n`,
      status: 5,
    };
  }

  return errors.length > 0
    ? { stdout: fromLines(out), stderr: errors.join("\n") + "\n", status: 2 }
    : ok(fromLines(out));
};

export const comm: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "123" });
  const [first, second] = parsed.operands;

  if (!first || !second) {
    return { stdout: "", stderr: "comm: missing operand\n", status: 1 };
  }

  const { inputs, errors } = readInputs(context, [first, second], "comm");
  if (errors.length > 0) return { stdout: "", stderr: errors.join("\n") + "\n", status: 1 };

  const left = toLines(inputs[0]?.content ?? "");
  const right = toLines(inputs[1]?.content ?? "");
  const hide1 = parsed.flags.has("1");
  const hide2 = parsed.flags.has("2");
  const hide3 = parsed.flags.has("3");

  const out: string[] = [];
  let i = 0;
  let j = 0;

  // Las tres columnas: solo en el primero, solo en el segundo, en los dos.
  const column1 = hide1 ? "" : "";
  const column2 = hide1 ? "" : "\t";
  const column3 = (hide1 ? "" : "\t") + (hide2 ? "" : "\t");

  while (i < left.length || j < right.length) {
    const a = left[i];
    const b = right[j];

    if (a !== undefined && (b === undefined || a < b)) {
      if (!hide1) out.push(column1 + a);
      i++;
    } else if (b !== undefined && (a === undefined || b < a)) {
      if (!hide2) out.push(column2 + b);
      j++;
    } else {
      if (!hide3) out.push(column3 + a!);
      i++;
      j++;
    }
  }

  return ok(fromLines(out));
};

export const paste: Tool = (context) => {
  const parsed = parseArgs(context.args, { values: "d", flags: "s" });
  const delimiter = parsed.values.get("d") ?? "\t";
  const { inputs, errors } = readInputs(context, parsed.operands, "paste");

  if (parsed.flags.has("s")) {
    const lines = inputs.map((input) => toLines(input.content).join(delimiter));
    return ok(fromLines(lines));
  }

  const columns = inputs.map((input) => toLines(input.content));
  const height = Math.max(0, ...columns.map((column) => column.length));
  const out: string[] = [];

  for (let row = 0; row < height; row++) {
    out.push(columns.map((column) => column[row] ?? "").join(delimiter));
  }

  return errors.length > 0
    ? { stdout: fromLines(out), stderr: errors.join("\n") + "\n", status: 1 }
    : ok(fromLines(out));
};

/**
 * `diff` en su formato de siempre, el que no lleva banderas.
 *
 * Se apoya en la subsecuencia común más larga, que es lo que hace GNU para
 * archivos de este tamaño. Sirve para lo que se usa en el curso: comparar el
 * estado de ayer contra el de hoy.
 */
export const diff: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "q" });
  const [first, second] = parsed.operands;

  if (!first || !second) {
    return { stdout: "", stderr: "diff: missing operand\n", status: 2 };
  }

  const { inputs, errors } = readInputs(context, [first, second], "diff");
  if (errors.length > 0) return { stdout: "", stderr: errors.join("\n") + "\n", status: 2 };

  const left = toLines(inputs[0]?.content ?? "");
  const right = toLines(inputs[1]?.content ?? "");

  // Tabla de la subsecuencia común más larga.
  const table: number[][] = Array.from({ length: left.length + 1 }, () =>
    new Array<number>(right.length + 1).fill(0),
  );

  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      table[i]![j] =
        left[i] === right[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }

  interface Chunk {
    kind: "add" | "remove";
    line: string;
    leftAt: number;
    rightAt: number;
  }

  const chunks: Chunk[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i++;
      j++;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      chunks.push({ kind: "remove", line: left[i]!, leftAt: i, rightAt: j });
      i++;
    } else {
      chunks.push({ kind: "add", line: right[j]!, leftAt: i, rightAt: j });
      j++;
    }
  }
  while (i < left.length) chunks.push({ kind: "remove", line: left[i]!, leftAt: i++, rightAt: j });
  while (j < right.length) chunks.push({ kind: "add", line: right[j]!, leftAt: i, rightAt: j++ });

  if (chunks.length === 0) return ok();
  if (parsed.flags.has("q")) {
    return { stdout: `Files ${first} and ${second} differ\n`, stderr: "", status: 1 };
  }

  // Los cambios pegados se juntan en un solo bloque, como hace diff.
  const out: string[] = [];
  let index = 0;

  while (index < chunks.length) {
    const removed: string[] = [];
    const added: string[] = [];
    const startLeft = chunks[index]!.leftAt;
    const startRight = chunks[index]!.rightAt;

    while (
      index < chunks.length &&
      chunks[index]!.kind === "remove" &&
      chunks[index]!.leftAt === startLeft + removed.length
    ) {
      removed.push(chunks[index]!.line);
      index++;
    }

    /*
     * Los añadidos solo entran en este bloque si caen JUSTO donde terminaron
     * los borrados. Si caen más adelante son otro cambio: borrar la línea 2 y
     * añadir algo en la 3 se escribe `2d1` y `3a3`, no `2c2`, aunque los dos
     * cambios vayan seguidos.
     */
    const leftAfter = startLeft + removed.length;
    while (
      index < chunks.length &&
      chunks[index]!.kind === "add" &&
      chunks[index]!.leftAt === leftAfter &&
      chunks[index]!.rightAt === startRight + added.length
    ) {
      added.push(chunks[index]!.line);
      index++;
    }

    if (removed.length === 0 && added.length === 0) {
      // Nada encajó en este bloque: se toma el chunk suelto y se sigue.
      const lonely = chunks[index]!;
      if (lonely.kind === "remove") removed.push(lonely.line);
      else added.push(lonely.line);
      index++;
    }

    const range = (start: number, count: number): string =>
      count === 0
        ? String(start)
        : count === 1
          ? String(start + 1)
          : `${start + 1},${start + count}`;

    const leftRange = range(startLeft, removed.length);
    const rightRange = range(startRight, added.length);

    if (removed.length > 0 && added.length > 0) out.push(`${leftRange}c${rightRange}`);
    else if (removed.length > 0) out.push(`${leftRange}d${startRight}`);
    else out.push(`${startLeft}a${rightRange}`);

    for (const line of removed) out.push(`< ${line}`);
    if (removed.length > 0 && added.length > 0) out.push("---");
    for (const line of added) out.push(`> ${line}`);
  }

  return { stdout: fromLines(out), stderr: "", status: 1 };
};
