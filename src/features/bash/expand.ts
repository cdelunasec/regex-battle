/**
 * Expandir una palabra: de lo que se escribió a lo que recibe el comando.
 *
 * Este es el archivo del que salen la mitad de los bugs de un script real, y
 * por eso la lección de comillas se apoya entera aquí. El orden importa y es
 * este: primero se resuelven las llaves y los dólares, DESPUÉS se parte en
 * palabras lo que no venía entrecomillado, y al final se buscan los archivos
 * que casen. Por eso `rm $archivo` con un nombre que lleva espacios borra dos
 * cosas y `rm "$archivo"` borra una.
 *
 * Para que el glob no se coma un asterisco que el usuario escribió entre
 * comillas, cada campo se construye dos veces en paralelo: el valor de verdad
 * y un patrón donde lo que venía entrecomillado va escapado. Sin eso, un
 * `grep "*" archivo` buscaría los nombres del directorio en vez del asterisco.
 */
import type { Word, WordPart } from "./ast.ts";
import { arithToString, type ArithHost } from "./arith.ts";
import { parseDoubleQuoted } from "./lexer.ts";
import { globToRegExp } from "./regex.ts";
import { joinPath, normalizePath, type Vfs } from "./vfs.ts";

export class BashExpansionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BashExpansionError";
  }
}

export interface ExpansionHost {
  getVariable(name: string): string | string[] | undefined;
  setVariable(name: string, value: string): void;
  /** Los argumentos del script o de la función: `$1`, `$2`... */
  positional: string[];
  /** `$0` */
  scriptName: string;
  /** `$?` */
  lastStatus: number;
  cwd: string;
  home: string;
  vfs: Vfs;
  /** Corre `$(...)` y devuelve lo que imprimió. */
  runSubshell(source: string): string;
  /** `set -u`: una variable sin definir revienta en vez de quedar vacía. */
  nounset: boolean;
  ifs: string;
}

/**
 * Un campo a medio construir.
 *
 * `explicit` existe por un caso incómodo: `echo "$vacia"` tiene que pasar un
 * argumento vacío y `echo $vacia` no tiene que pasar ninguno. Sin la marca,
 * los dos se verían igual al terminar.
 */
interface Field {
  value: string;
  pattern: string;
  explicit: boolean;
}

/** El pid del shell, fijo: no hay procesos y un número al azar rompería los retos. */
const SHELL_PID = "4242";

function escapeGlob(text: string): string {
  return text.replace(/[*?[\]\\]/g, (character) => "\\" + character);
}

function hasGlobMeta(pattern: string): boolean {
  for (let i = 0; i < pattern.length; i++) {
    const character = pattern[i]!;
    if (character === "\\") {
      i++;
      continue;
    }
    if (character === "*" || character === "?" || character === "[") return true;
  }
  return false;
}

function unescapeGlob(pattern: string): string {
  return pattern.replace(/\\(.)/g, "$1");
}

/** El host de la aritmética, que solo sabe de textos. */
function arithHostOf(host: ExpansionHost): ArithHost {
  return {
    get: (name) => {
      const value = host.getVariable(name);
      return Array.isArray(value) ? value[0] : value;
    },
    set: (name, value) => host.setVariable(name, value),
  };
}

class Expander {
  private readonly host: ExpansionHost;
  private fields: Field[] = [{ value: "", pattern: "", explicit: false }];

  constructor(host: ExpansionHost) {
    this.host = host;
  }

  private get last(): Field {
    return this.fields[this.fields.length - 1]!;
  }

  private append(value: string, pattern: string, explicit = false): void {
    const field = this.last;
    field.value += value;
    field.pattern += pattern;
    if (explicit) field.explicit = true;
  }

  /** Cierra el campo actual y abre otro: es lo que hace el corte por IFS. */
  private breakField(): void {
    this.fields.push({ value: "", pattern: "", explicit: false });
  }

  /**
   * Mete un valor que NO venía entrecomillado, partiéndolo por IFS.
   *
   * Los espacios, tabuladores y saltos que hay en IFS se comen enteros y no
   * dejan campos vacíos, que es por lo que `echo $(echo "  a   b  ")` imprime
   * dos palabras y no seis.
   */
  private appendSplit(value: string): void {
    const ifs = this.host.ifs;
    if (ifs === "") {
      this.append(value, value);
      return;
    }

    const whitespace = [...ifs].filter((character) => " \t\n".includes(character));
    const others = [...ifs].filter((character) => !" \t\n".includes(character));

    let current = "";
    let first = true;

    const flush = (): void => {
      if (first) {
        this.append(current, current);
        first = false;
      } else {
        this.breakField();
        this.append(current, current);
      }
      current = "";
    };

    let i = 0;
    while (i < value.length) {
      const character = value[i]!;

      if (whitespace.includes(character)) {
        // Se come toda la tanda de espacios de una vez.
        while (i < value.length && whitespace.includes(value[i]!)) i++;
        if (current !== "" || !first) flush();
        continue;
      }

      if (others.includes(character)) {
        flush();
        i++;
        continue;
      }

      current += character;
      i++;
    }

    if (current !== "") flush();
  }

  /** `$@` y `${arr[@]}`: cada elemento es un campo aparte, con o sin comillas. */
  private appendList(items: string[], quoted: boolean): void {
    items.forEach((item, position) => {
      if (position > 0) this.breakField();
      if (quoted) this.append(item, escapeGlob(item), true);
      else this.appendSplit(item);
    });
  }

  expand(word: Word, options: { split: boolean; glob: boolean; keepPattern?: boolean }): string[] {
    for (const [position, part] of word.entries()) {
      this.expandPart(part, position === 0, options.split);
    }

    let fields = this.fields;
    if (!options.split) {
      // Sin corte, todo lo de arriba tenía que caer en un único campo.
      fields = [
        {
          value: fields.map((field) => field.value).join(""),
          pattern: fields.map((field) => field.pattern).join(""),
          explicit: true,
        },
      ];
    }

    const out: string[] = [];
    for (const field of fields) {
      if (field.value === "" && !field.explicit) continue;

      if (options.keepPattern) {
        out.push(field.pattern);
        continue;
      }

      if (options.glob && hasGlobMeta(field.pattern)) {
        const matches = this.glob(field.pattern);
        if (matches.length > 0) {
          out.push(...matches);
          continue;
        }
      }

      out.push(field.value);
    }

    return out;
  }

  private expandPart(part: WordPart, first: boolean, split: boolean): void {
    if (part.kind === "literal") {
      if (part.quoted) {
        this.append(part.text, escapeGlob(part.text), true);
        return;
      }
      const text = first ? this.expandTilde(part.text) : part.text;
      this.append(text, text);
      return;
    }

    if (part.kind === "arith") {
      const value = arithToString(expandArithSource(part.text, this.host), arithHostOf(this.host));
      this.append(value, escapeGlob(value), part.quoted);
      return;
    }

    if (part.kind === "command") {
      // Bash quita TODOS los saltos del final, no solo el último.
      const output = this.host.runSubshell(part.text).replace(/\n+$/, "");
      if (part.quoted || !split) this.append(output, escapeGlob(output), true);
      else this.appendSplit(output);
      return;
    }

    this.expandParam(part, split);
  }

  private expandTilde(text: string): string {
    if (text === "~") return this.host.home;
    if (text.startsWith("~/")) return this.host.home + text.slice(1);
    return text;
  }

  private expandParam(part: WordPart, split: boolean): void {
    const name = part.text;

    // Las listas van aparte porque un solo texto no sabría dónde cortar.
    if (name === "@" || name === "*" || part.index === "@" || part.index === "*") {
      const items = this.listOf(part);

      if (part.op === "length") {
        const count = String(items.length);
        this.append(count, count, part.quoted);
        return;
      }

      if ((name === "*" || part.index === "*") && part.quoted) {
        const joined = items.join(this.host.ifs[0] ?? " ");
        this.append(joined, escapeGlob(joined), true);
        return;
      }

      this.appendList(items, part.quoted || !split);
      return;
    }

    const raw = this.rawValue(part);
    const value = this.applyOperator(part, raw);

    if (value === null) return;
    if (part.quoted || !split) this.append(value, escapeGlob(value), true);
    else this.appendSplit(value);
  }

  /** Los elementos detrás de `$@`, `$*` o `${arr[@]}`. */
  private listOf(part: WordPart): string[] {
    if (part.text === "@" || part.text === "*") return [...this.host.positional];
    const value = this.host.getVariable(part.text);
    if (value === undefined) return [];
    return Array.isArray(value) ? [...value] : [value];
  }

  /** El valor sin modificar, o undefined si la variable no está puesta. */
  private rawValue(part: WordPart): string | undefined {
    const name = part.text;

    if (name === "?") return String(this.host.lastStatus);
    if (name === "#") return String(this.host.positional.length);
    if (name === "$") return SHELL_PID;
    if (name === "!") return "";
    if (name === "0") return this.host.scriptName;
    if (/^[1-9][0-9]*$/.test(name)) return this.host.positional[Number(name) - 1];

    const value = this.host.getVariable(name);

    if (part.index !== undefined) {
      const items = Array.isArray(value) ? value : value === undefined ? [] : [value];
      const index = Number(arithToString(part.index, arithHostOf(this.host)));
      return items[index < 0 ? items.length + index : index];
    }

    if (Array.isArray(value)) return value[0];
    return value;
  }

  /** Devuelve null cuando el modificador manda no aportar nada. */
  private applyOperator(part: WordPart, raw: string | undefined): string | null {
    const empty = raw === undefined || (part.colon === true && raw === "");
    const argument = (position: number): string =>
      part.args?.[position] ? expandToSingle(part.args[position]!, this.host) : "";

    switch (part.op) {
      case undefined:
        if (raw === undefined) {
          if (this.host.nounset && !["?", "#", "$", "!"].includes(part.text)) {
            throw new BashExpansionError(`${part.text}: unbound variable`);
          }
          return "";
        }
        return raw;

      case "length":
        return String((raw ?? "").length);

      case "default":
        return empty ? argument(0) : (raw ?? "");

      case "assign": {
        if (!empty) return raw ?? "";
        const value = argument(0);
        this.host.setVariable(part.text, value);
        return value;
      }

      case "error":
        if (empty) {
          const message = argument(0);
          throw new BashExpansionError(`${part.text}: ${message || "parameter null or not set"}`);
        }
        return raw ?? "";

      case "alternative":
        return empty ? "" : argument(0);

      case "trimStart":
        return trim(raw ?? "", argument(0), part.greedy === true, "start");

      case "trimEnd":
        return trim(raw ?? "", argument(0), part.greedy === true, "end");

      case "replace":
        return replace(raw ?? "", argument(0), argument(1), part.greedy === true);

      case "substring": {
        const text = raw ?? "";
        const from = Number(arithToString(argument(0) || "0", arithHostOf(this.host)));
        const start = from < 0 ? Math.max(text.length + from, 0) : from;
        if (part.args && part.args.length > 1) {
          const length = Number(arithToString(argument(1) || "0", arithHostOf(this.host)));
          if (length < 0) return text.slice(start, text.length + length);
          return text.slice(start, start + length);
        }
        return text.slice(start);
      }

      default:
        return raw ?? "";
    }
  }

  /**
   * Busca los archivos que casen con el patrón, un tramo de ruta a la vez.
   *
   * Se llevan dos rutas en paralelo: la que se va a imprimir, que conserva la
   * forma relativa que escribió quien programó, y la absoluta con la que se le
   * pregunta al disco. Sin la segunda, un `datos/*.conf` buscaría "datos"
   * colgando de la raíz en vez de del directorio actual y no encontraría nada.
   */
  private glob(pattern: string): string[] {
    const absolute = pattern.startsWith("/");
    const segments = pattern.split("/").filter((segment) => segment !== "");
    let current = [{ display: "", full: absolute ? "/" : this.host.cwd }];

    const descend = (base: { display: string; full: string }, name: string) => ({
      display: base.display === "" ? (absolute ? "/" + name : name) : `${base.display}/${name}`,
      full: joinPath(base.full, name),
    });

    for (const segment of segments) {
      const next: { display: string; full: string }[] = [];

      for (const base of current) {
        if (!hasGlobMeta(segment)) {
          const candidate = descend(base, unescapeGlob(segment));
          if (this.host.vfs.exists(candidate.full)) next.push(candidate);
          continue;
        }

        let entries;
        try {
          entries = this.host.vfs.readdir(base.full);
        } catch {
          continue;
        }

        const regex = globToRegExp(segment, { segment: true });
        for (const entry of entries) {
          // Un glob no descubre los ocultos salvo que el patrón empiece por punto.
          if (entry.name.startsWith(".") && !segment.startsWith(".")) continue;
          if (!regex.test(entry.name)) continue;
          next.push(descend(base, entry.name));
        }
      }

      current = next;
      if (current.length === 0) return [];
    }

    return current.map((entry) => entry.display).sort();
  }
}

/** Quita del principio o del final lo que case con el patrón. */
function trim(text: string, pattern: string, greedy: boolean, side: "start" | "end"): string {
  if (pattern === "") return text;

  const positions =
    side === "start"
      ? range(text.length, 0, greedy)
      : range(text.length, 0, greedy).map((length) => text.length - length);

  for (const cut of positions) {
    const piece = side === "start" ? text.slice(0, cut) : text.slice(cut);
    if (globToRegExp(pattern).test(piece)) {
      return side === "start" ? text.slice(cut) : text.slice(0, cut);
    }
  }

  return text;
}

/** Los cortes a probar: el más largo primero si es la forma doble. */
function range(length: number, from: number, greedy: boolean): number[] {
  const lengths = [];
  for (let i = from; i <= length; i++) lengths.push(i);
  return greedy ? lengths.reverse() : lengths;
}

function replace(text: string, pattern: string, replacement: string, all: boolean): string {
  if (pattern === "") return text;

  // El patrón es un glob, no una expresión regular, así que se busca el trozo
  // más largo que case en cada posición.
  let out = "";
  let i = 0;
  let done = false;

  while (i < text.length) {
    let matched = -1;
    if (!done || all) {
      for (let end = text.length; end > i; end--) {
        if (globToRegExp(pattern).test(text.slice(i, end))) {
          matched = end;
          break;
        }
      }
    }

    if (matched === -1) {
      out += text[i];
      i++;
      continue;
    }

    out += replacement;
    i = matched;
    done = true;
    if (!all) {
      out += text.slice(i);
      return out;
    }
  }

  return out;
}

/**
 * Resuelve las variables de dentro de una aritmética antes de evaluarla.
 *
 * Hace falta porque `$1` y `$(cmd)` valen dentro de `$(( ))` y de `(( ))`, y el
 * evaluador solo entiende nombres sin dólar. Sin este paso, un
 * `(( $1 % 2 == 0 ))` leería el uno literal en vez del primer argumento, y la
 * función diría que todo es impar.
 */
export function expandArithSource(source: string, host: ExpansionHost): string {
  return expandToSingle(parseDoubleQuoted(source, 1, 1), host);
}

/** Para los argumentos de un comando: se parte y se busca en el disco. */
export function expandWords(words: Word[], host: ExpansionHost): string[] {
  const out: string[] = [];
  for (const word of words) {
    out.push(...new Expander(host).expand(word, { split: true, glob: true }));
  }
  return out;
}

/** Para una asignación o el archivo de una redirección: ni se parte ni globea. */
export function expandToSingle(word: Word, host: ExpansionHost): string {
  const fields = new Expander(host).expand(word, { split: false, glob: false });
  return fields[0] ?? "";
}

/**
 * Para `case` y para el lado derecho de `==` dentro de `[[ ]]`.
 *
 * Devuelve el patrón con lo entrecomillado ya escapado, porque ahí un `*` sin
 * comillas comodinea y con comillas es un asterisco.
 */
export function expandToPattern(word: Word, host: ExpansionHost): string {
  const fields = new Expander(host).expand(word, {
    split: false,
    glob: false,
    keepPattern: true,
  });
  return fields[0] ?? "";
}

/** La ruta de un archivo, ya resuelta contra el directorio actual. */
export function resolvePath(host: ExpansionHost, path: string): string {
  return path.startsWith("/") ? normalizePath(path) : joinPath(host.cwd, path);
}
