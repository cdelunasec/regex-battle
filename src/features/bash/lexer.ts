/**
 * De texto a piezas: palabras, operadores y redirecciones.
 *
 * El léxico de un shell no se parece al de un lenguaje normal. Aquí el mismo
 * carácter significa cosas distintas según dónde caiga, no hay una tabla de
 * símbolos y una palabra puede llevar dentro un script entero, como en
 * `echo "hay $(ls | wc -l) archivos"`. Por eso esto no devuelve textos sueltos
 * sino palabras ya partidas en pedazos, cada uno sabiendo si venía
 * entrecomillado.
 *
 * Lo que NO se hace aquí: expandir. Un `$(...)` se guarda como código sin
 * correr y una variable como nombre sin resolver. Expandir es cosa de
 * `expand.ts`, y tiene que pasar en el momento de ejecutar, no al leer, porque
 * el valor de una variable cambia entre una vuelta del bucle y la siguiente.
 */
import type { ParamOp, Redirect, RedirectOp, Word, WordPart } from "./ast.ts";

export class BashSyntaxError extends Error {
  /** Desde 1, como se cuentan en el editor. */
  readonly line: number;
  readonly column: number;

  constructor(message: string, line: number, column: number) {
    super(message);
    this.name = "BashSyntaxError";
    this.line = line;
    this.column = column;
  }
}

/** Lo que la plataforma reconoce pero todavía no implementa. */
export class BashUnsupportedError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, line: number, column: number) {
    super(message);
    this.name = "BashUnsupportedError";
    this.line = line;
    this.column = column;
  }
}

export type TokenType =
  "word" | "redirect" | "operator" | "newline" | "condStart" | "condEnd" | "arith" | "eof";

export interface Token {
  type: TokenType;
  /** Para los operadores, el símbolo. Para `arith`, el código de dentro. */
  text: string;
  word?: Word;
  redirect?: Redirect;
  line: number;
  column: number;
}

const OPERATORS = ["&&", "||", ";;", "|", "&", ";", "(", ")"];
/** Lo que corta una palabra cuando no está entrecomillado. */
const WORD_BREAK = new Set([" ", "\t", "\n", "|", "&", ";", "(", ")", "<", ">"]);
/** Tras una de estas, lo que sigue vuelve a ser el principio de un comando. */
const COMMAND_STARTERS = new Set([
  "if",
  "then",
  "elif",
  "else",
  "do",
  "while",
  "until",
  "for",
  "function",
  "case",
  "in",
  "{",
  "!",
]);

interface PendingHeredoc {
  redirect: Redirect;
  tag: string;
  /** `<<'EOF'` no expande nada de dentro. */
  literal: boolean;
  /** `<<-` come las tabulaciones del principio de cada línea. */
  stripTabs: boolean;
}

class Lexer {
  private readonly source: string;
  private index = 0;
  private line = 1;
  private column = 1;
  private readonly tokens: Token[] = [];
  private readonly pendingHeredocs: PendingHeredoc[] = [];

  constructor(source: string) {
    this.source = source;
  }

  private get rest(): string {
    return this.source.slice(this.index);
  }

  /** Hasta dónde llegó. Lo usa `parseDoubleQuoted`, que lee con un lexer aparte. */
  get position(): number {
    return this.index;
  }

  private peek(offset = 0): string | undefined {
    return this.source[this.index + offset];
  }

  private advance(count = 1): string {
    const taken = this.source.slice(this.index, this.index + count);
    for (const character of taken) {
      if (character === "\n") {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
    }
    this.index += count;
    return taken;
  }

  private fail(message: string): never {
    throw new BashSyntaxError(message, this.line, this.column);
  }

  private unsupported(message: string): never {
    throw new BashUnsupportedError(message, this.line, this.column);
  }

  private push(token: Omit<Token, "line" | "column">, line: number, column: number): void {
    this.tokens.push({ ...token, line, column });
  }

  tokenize(): Token[] {
    while (this.index < this.source.length) {
      const character = this.peek()!;

      // Una barra al final de la línea la une con la siguiente.
      if (character === "\\" && this.peek(1) === "\n") {
        this.advance(2);
        continue;
      }

      if (character === " " || character === "\t" || character === "\r") {
        this.advance();
        continue;
      }

      if (character === "#" && this.atWordStart()) {
        while (this.index < this.source.length && this.peek() !== "\n") this.advance();
        continue;
      }

      if (character === "\n") {
        const { line, column } = this;
        this.advance();
        this.push({ type: "newline", text: "\n" }, line, column);
        this.consumeHeredocBodies();
        continue;
      }

      // `[[` y `((` en posición de comando son construcciones propias, y
      // reconocerlas aquí evita confundirlas con un corchete o un subshell.
      if (this.rest.startsWith("[[") && this.atCommandPosition()) {
        const { line, column } = this;
        this.advance(2);
        this.push({ type: "condStart", text: "[[" }, line, column);
        continue;
      }
      if (this.rest.startsWith("]]")) {
        const { line, column } = this;
        this.advance(2);
        this.push({ type: "condEnd", text: "]]" }, line, column);
        continue;
      }
      if (this.rest.startsWith("((") && this.atCommandPosition()) {
        const { line, column } = this;
        this.advance(2);
        const source = this.readBalanced("(", ")", 2);
        this.push({ type: "arith", text: source }, line, column);
        continue;
      }

      // Una redirección: los dígitos de delante son el descriptor.
      const redirect = /^(\d*)(>>|>&|<&|<<-|<<<|<<|>|<)/.exec(this.rest);
      if (redirect) {
        this.readRedirect(redirect[1]!, redirect[2]!);
        continue;
      }

      const operator = OPERATORS.find((candidate) => this.rest.startsWith(candidate));
      if (operator) {
        const { line, column } = this;
        this.advance(operator.length);
        this.push({ type: "operator", text: operator }, line, column);
        continue;
      }

      const { line, column } = this;
      const word = this.readWord();
      if (word.length === 0) this.fail(`no se entiende el carácter ${character}`);
      this.push({ type: "word", text: "", word }, line, column);
    }

    this.push({ type: "eof", text: "" }, this.line, this.column);
    return this.tokens;
  }

  /** Si el `#` empieza un comentario o es parte de una palabra, como en `a#b`. */
  private atWordStart(): boolean {
    const previous = this.source[this.index - 1];
    return previous === undefined || " \t\n;|&()".includes(previous);
  }

  /**
   * Si lo que viene puede ser el principio de un comando.
   *
   * Hace falta para distinguir el `((` de la aritmética del `(` de un
   * subshell, y el `[[` de una condición del corchete de un glob. Cuenta como
   * principio de comando lo que va tras un salto, tras un operador, o tras una
   * palabra reservada, que es el caso de `if [[ ... ]]` y de `for ((...))`.
   */
  private atCommandPosition(): boolean {
    const token = this.tokens[this.tokens.length - 1];
    if (!token) return true;
    if (token.type === "newline" || token.type === "operator") return true;
    if (token.type !== "word" || !token.word) return false;
    const text = token.word.every((part) => part.kind === "literal" && !part.quoted)
      ? token.word.map((part) => part.text).join("")
      : "";
    return COMMAND_STARTERS.has(text);
  }

  private readRedirect(fdText: string, operator: string): void {
    const { line, column } = this;
    this.advance(fdText.length + operator.length);

    const heredoc = operator === "<<" || operator === "<<-";
    const op: RedirectOp = heredoc
      ? "heredoc"
      : operator === "<<<"
        ? "here-string"
        : (operator as RedirectOp);

    const redirect: Redirect = { op };
    if (fdText) redirect.fd = Number(fdText);

    while (this.peek() === " " || this.peek() === "\t") this.advance();

    if (heredoc) {
      const tagWord = this.readWord();
      const literal = tagWord.some((part) => part.quoted);
      const tag = tagWord.map((part) => part.text).join("");
      if (!tag) this.fail("falta la etiqueta del bloque de texto");
      this.pendingHeredocs.push({
        redirect,
        tag,
        literal,
        stripTabs: operator === "<<-",
      });
      this.push({ type: "redirect", text: operator, redirect }, line, column);
      return;
    }

    const target = this.readWord();
    if (target.length === 0) this.fail(`falta el archivo después de ${operator}`);
    redirect.target = target;
    this.push({ type: "redirect", text: operator, redirect }, line, column);
  }

  /**
   * El cuerpo de los heredocs de la línea que acaba de terminar.
   *
   * Van después del salto de línea y no pegados al operador, así que hay que
   * volver a por ellos. Si hay dos en la misma línea, se llenan en orden.
   */
  private consumeHeredocBodies(): void {
    while (this.pendingHeredocs.length > 0) {
      const pending = this.pendingHeredocs.shift()!;
      const lines: string[] = [];

      for (;;) {
        if (this.index >= this.source.length) {
          this.fail(`el bloque de texto nunca cierra con ${pending.tag}`);
        }
        const newline = this.source.indexOf("\n", this.index);
        const raw = newline === -1 ? this.rest : this.source.slice(this.index, newline);
        this.advance(raw.length + (newline === -1 ? 0 : 1));

        const text = pending.stripTabs ? raw.replace(/^\t+/, "") : raw;
        if (text === pending.tag) break;
        lines.push(text);
      }

      const body = lines.length > 0 ? lines.join("\n") + "\n" : "";
      pending.redirect.here = pending.literal
        ? [{ kind: "literal", quoted: true, text: body }]
        : parseDoubleQuoted(body, this.line, this.column);
    }
  }

  /** Lee hasta cerrar el paréntesis o la llave, respetando las comillas. */
  private readBalanced(open: string, close: string, alreadyOpen: number): string {
    let depth = alreadyOpen;
    let out = "";

    while (this.index < this.source.length) {
      const character = this.peek()!;

      if (character === "'" || character === '"') {
        const quote = character;
        out += this.advance();
        while (this.index < this.source.length && this.peek() !== quote) {
          if (this.peek() === "\\" && quote === '"') out += this.advance();
          out += this.advance();
        }
        if (this.index >= this.source.length) this.fail("falta cerrar una comilla");
        out += this.advance();
        continue;
      }

      if (character === "\\") {
        out += this.advance(2);
        continue;
      }

      if (character === open) depth++;
      if (character === close) {
        depth--;
        if (depth === 0) {
          this.advance();
          return out;
        }
        // En `$((...))` los dos cierres van juntos.
        if (depth === 1 && open === "(" && alreadyOpen === 2 && this.peek(1) === close) {
          this.advance(2);
          return out;
        }
      }

      out += this.advance();
    }

    this.fail(`falta cerrar con ${close}`);
  }

  private readWord(): Word {
    const parts: WordPart[] = [];
    let literal = "";
    const flush = (): void => {
      if (literal) {
        parts.push({ kind: "literal", quoted: false, text: literal });
        literal = "";
      }
    };

    while (this.index < this.source.length) {
      const character = this.peek()!;

      if (character === "\\") {
        if (this.peek(1) === "\n") {
          this.advance(2);
          continue;
        }
        // Hay que cerrar el pedazo que se venía acumulando ANTES de meter el
        // carácter escapado, o sale en el orden equivocado: sin esto,
        // `^[0-9]+\.[0-9]+` quedaba como el punto primero y el resto detrás.
        flush();
        this.advance();
        const escaped = this.advance();
        parts.push({ kind: "literal", quoted: true, text: escaped });
        continue;
      }

      if (WORD_BREAK.has(character)) break;

      if (character === "'") {
        flush();
        this.advance();
        let text = "";
        while (this.index < this.source.length && this.peek() !== "'") text += this.advance();
        if (this.index >= this.source.length) this.fail("falta cerrar una comilla simple");
        this.advance();
        parts.push({ kind: "literal", quoted: true, text });
        continue;
      }

      if (character === '"') {
        flush();
        this.advance();
        let raw = "";
        while (this.index < this.source.length && this.peek() !== '"') {
          /*
           * Dentro de `$( )` las comillas empiezan a contar de cero, así que
           * un `"` de ahí dentro NO cierra las de fuera. El bloque se copia
           * entero sin mirarle las comillas, y ya lo leerá quien toque.
           * Sin esto, `echo "hay $(wc -l < "$archivo") lineas"` se partía en
           * la tercera comilla y el script no se entendía.
           */
          if (this.peek() === "$" && this.peek(1) === "(") {
            this.advance(2);
            raw += "$(" + this.readBalanced("(", ")", 1) + ")";
            continue;
          }
          if (this.peek() === "\\") raw += this.advance();
          raw += this.advance();
        }
        if (this.index >= this.source.length) this.fail("falta cerrar una comilla doble");
        this.advance();
        parts.push(...parseDoubleQuoted(raw, this.line, this.column));
        continue;
      }

      if (character === "$") {
        // `$'...'` con sus escapes, que aparece en cuanto alguien necesita un salto.
        if (this.peek(1) === "'") {
          flush();
          this.advance(2);
          let text = "";
          while (this.index < this.source.length && this.peek() !== "'") {
            if (this.peek() === "\\") {
              this.advance();
              text += unescapeAnsiC(this.advance());
              continue;
            }
            text += this.advance();
          }
          this.advance();
          parts.push({ kind: "literal", quoted: true, text });
          continue;
        }

        const part = this.readDollarPart(false);
        if (part) {
          flush();
          parts.push(part);
          continue;
        }
      }

      if (character === "`") {
        flush();
        this.advance();
        let text = "";
        while (this.index < this.source.length && this.peek() !== "`") {
          if (this.peek() === "\\") this.advance();
          text += this.advance();
        }
        if (this.index >= this.source.length) this.fail("falta cerrar un acento grave");
        this.advance();
        parts.push({ kind: "command", quoted: false, text });
        continue;
      }

      literal += this.advance();
    }

    flush();
    return parts;
  }

  /** Un `$` con lo que venga detrás. Devuelve null si era un dólar suelto. */
  readDollarPart(quoted: boolean): WordPart | null {
    const next = this.peek(1);

    if (next === "(") {
      // `$((...))` es aritmética, `$(...)` es un comando.
      if (this.peek(2) === "(") {
        this.advance(3);
        const source = this.readBalanced("(", ")", 2);
        return { kind: "arith", quoted, text: source };
      }
      this.advance(2);
      const source = this.readBalanced("(", ")", 1);
      return { kind: "command", quoted, text: source };
    }

    if (next === "{") {
      this.advance(2);
      const inner = this.readBalanced("{", "}", 1);
      return parseBraceParam(inner, quoted, this.line, this.column);
    }

    if (next && /[A-Za-z_]/.test(next)) {
      this.advance();
      let name = "";
      while (this.index < this.source.length && /[A-Za-z0-9_]/.test(this.peek()!)) {
        name += this.advance();
      }
      // `$arr[0]` no es un índice en bash, hace falta `${arr[0]}`.
      return { kind: "param", quoted, text: name };
    }

    if (next && "@*#?$!0123456789-".includes(next)) {
      this.advance(2);
      return { kind: "param", quoted, text: next };
    }

    return null;
  }
}

/** Los escapes de `$'...'`. */
function unescapeAnsiC(character: string): string {
  switch (character) {
    case "n":
      return "\n";
    case "t":
      return "\t";
    case "r":
      return "\r";
    case "0":
      return "\0";
    case "\\":
      return "\\";
    case "'":
      return "'";
    default:
      return character;
  }
}

/**
 * El contenido de unas comillas dobles.
 *
 * Dentro siguen valiendo `$var` y `$(...)`, pero ya nada de lo que salga se
 * parte en palabras. Por eso cada pedazo se marca como entrecomillado: esa
 * marca es la que hace que `"$@"` y `$@` no sean lo mismo.
 */
export function parseDoubleQuoted(raw: string, line: number, column: number): Word {
  const parts: WordPart[] = [];
  let literal = "";
  let i = 0;

  const flush = (): void => {
    if (literal) {
      parts.push({ kind: "literal", quoted: true, text: literal });
      literal = "";
    }
  };

  while (i < raw.length) {
    const character = raw[i]!;

    if (character === "\\") {
      const next = raw[i + 1];
      // Dentro de comillas dobles la barra solo escapa a estos cuatro.
      if (next !== undefined && '"\\$`'.includes(next)) {
        literal += next;
        i += 2;
        continue;
      }
      if (next === "\n") {
        i += 2;
        continue;
      }
      literal += character;
      i++;
      continue;
    }

    if (character === "`") {
      const backtick = readBacktick(raw, i, line, column);
      flush();
      parts.push(backtick.part);
      i = backtick.next;
      continue;
    }

    if (character === "$") {
      // Se lee con un lexer aparte sobre lo que queda, porque un `$(...)` de
      // aquí dentro puede traer comillas y paréntesis que hay que balancear.
      const sub = new Lexer(raw.slice(i));
      const part = sub.readDollarPart(true);
      if (part) {
        flush();
        parts.push(part);
        i += sub.position;
        continue;
      }
    }

    literal += character;
    i++;
  }

  flush();
  return parts;
}

function readBacktick(
  raw: string,
  start: number,
  line: number,
  column: number,
): { part: WordPart; next: number } {
  let i = start + 1;
  let text = "";
  while (i < raw.length && raw[i] !== "`") {
    if (raw[i] === "\\") i++;
    text += raw[i];
    i++;
  }
  if (i >= raw.length) throw new BashSyntaxError("falta cerrar un acento grave", line, column);
  return { part: { kind: "command", quoted: true, text }, next: i + 1 };
}

/**
 * Lo de dentro de `${...}`.
 *
 * Aquí viven los modificadores que más se usan en un script serio: el valor de
 * respaldo de `${1:-}`, el recorte de `${archivo%.log}` y el reemplazo de
 * `${linea//,/ }`. El orden de las comprobaciones importa, porque `##` tiene
 * que mirarse antes que `#`.
 */
export function parseBraceParam(
  inner: string,
  quoted: boolean,
  line: number,
  column: number,
): WordPart {
  if (inner.length === 0) throw new BashSyntaxError("hay un ${} vacío", line, column);

  if (inner.startsWith("#") && inner.length > 1) {
    const name = inner.slice(1);
    const bracket = /^([A-Za-z_][A-Za-z0-9_]*)\[(.+)\]$/.exec(name);
    if (bracket) {
      return {
        kind: "param",
        quoted,
        text: bracket[1]!,
        op: "length",
        index: bracket[2]!,
      };
    }
    return { kind: "param", quoted, text: name, op: "length" };
  }

  /*
   * El nombre es un identificador, un posicional de uno o más dígitos, o UN
   * solo carácter especial. Tomar los especiales en grupo era codicioso: en
   * `${1##*.}` se llevaba también las dos almohadillas, y el recorte dejaba de
   * reconocerse como tal.
   */
  const head = /^([A-Za-z_][A-Za-z0-9_]*|[0-9]+|[@*#?$!-])(\[[^\]]*\])?/.exec(inner);
  if (!head) throw new BashSyntaxError(`no se entiende \${${inner}}`, line, column);

  const name = head[1]!;
  // Se guarda como objeto y se esparce, porque con exactOptionalPropertyTypes
  // una clave puesta en undefined no es lo mismo que una clave ausente.
  const indexPart = head[2] ? { index: head[2].slice(1, -1) } : {};
  const rest = inner.slice(head[0].length);

  if (rest === "") return { kind: "param", quoted, text: name, ...indexPart };

  const wordOf = (text: string): Word => parseDoubleQuoted(text, line, column);

  const simple = (op: ParamOp, colon: boolean, greedy: boolean, arg: string): WordPart => ({
    kind: "param",
    quoted,
    text: name,
    ...indexPart,
    op,
    colon,
    greedy,
    args: [wordOf(arg)],
  });

  if (rest.startsWith(":-")) return simple("default", true, false, rest.slice(2));
  if (rest.startsWith("-")) return simple("default", false, false, rest.slice(1));
  if (rest.startsWith(":=")) return simple("assign", true, false, rest.slice(2));
  if (rest.startsWith("=")) return simple("assign", false, false, rest.slice(1));
  if (rest.startsWith(":?")) return simple("error", true, false, rest.slice(2));
  if (rest.startsWith("?")) return simple("error", false, false, rest.slice(1));
  if (rest.startsWith(":+")) return simple("alternative", true, false, rest.slice(2));
  if (rest.startsWith("+")) return simple("alternative", false, false, rest.slice(1));
  if (rest.startsWith("##")) return simple("trimStart", false, true, rest.slice(2));
  if (rest.startsWith("#")) return simple("trimStart", false, false, rest.slice(1));
  if (rest.startsWith("%%")) return simple("trimEnd", false, true, rest.slice(2));
  if (rest.startsWith("%")) return simple("trimEnd", false, false, rest.slice(1));

  if (rest.startsWith("//") || rest.startsWith("/")) {
    const greedy = rest.startsWith("//");
    const body = rest.slice(greedy ? 2 : 1);
    const separator = findUnescaped(body, "/");
    const pattern = separator === -1 ? body : body.slice(0, separator);
    const replacement = separator === -1 ? "" : body.slice(separator + 1);
    return {
      kind: "param",
      quoted,
      text: name,
      ...indexPart,
      op: "replace",
      greedy,
      args: [wordOf(pattern), wordOf(replacement)],
    };
  }

  if (rest.startsWith(":")) {
    const body = rest.slice(1);
    const separator = body.indexOf(":");
    const from = separator === -1 ? body : body.slice(0, separator);
    const length = separator === -1 ? undefined : body.slice(separator + 1);
    return {
      kind: "param",
      quoted,
      text: name,
      ...indexPart,
      op: "substring",
      args: length === undefined ? [wordOf(from)] : [wordOf(from), wordOf(length)],
    };
  }

  throw new BashUnsupportedError(`la plataforma todavía no soporta \${${inner}}`, line, column);
}

function findUnescaped(text: string, target: string): number {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] === target) return i;
  }
  return -1;
}

export function tokenize(source: string): Token[] {
  return new Lexer(source).tokenize();
}
