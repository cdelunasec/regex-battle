/**
 * De piezas a árbol.
 *
 * El parser de un shell tiene una rareza que conviene saber antes de leerlo:
 * las palabras reservadas no son símbolos, son palabras corrientes que solo
 * valen como reservadas cuando caen en posición de comando. `if` al principio
 * abre una condición, pero `echo if` imprime la palabra. Por eso aquí no se
 * pregunta por un tipo de token sino por el texto de una palabra que además
 * tiene que venir sin comillas.
 *
 * La otra rareza está en `[[ ]]`: dentro, `<` y `>` comparan textos, pero el
 * léxico ya los leyó como redirecciones porque desde fuera no se puede saber.
 * `parseCond` los devuelve a su sitio, y por eso ahí se mira `redirect`.
 */
import type { Assignment, Command, CondExpr, Redirect, SimpleCommand, Word } from "./ast.ts";
import { BashSyntaxError, BashUnsupportedError, tokenize, type Token } from "./lexer.ts";

/** Palabras que abren o cierran una construcción cuando van en su sitio. */
const RESERVED = new Set([
  "if",
  "then",
  "elif",
  "else",
  "fi",
  "while",
  "until",
  "for",
  "do",
  "done",
  "case",
  "esac",
  "in",
  "function",
  "{",
  "}",
  "!",
]);

const UNARY_TESTS = new Set(["-e", "-f", "-d", "-s", "-r", "-w", "-x", "-z", "-n", "-h", "-L"]);

const BINARY_TESTS = new Set([
  "=",
  "==",
  "!=",
  "=~",
  "<",
  ">",
  "-eq",
  "-ne",
  "-lt",
  "-le",
  "-gt",
  "-ge",
  "-nt",
  "-ot",
]);

class Parser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * El token en el que estamos.
   *
   * Es un método y no un getter a propósito: con un getter, TypeScript se
   * queda con el tipo estrechado de la comprobación anterior y deja de ver que
   * `advance()` movió el cursor, así que marca como imposibles comparaciones
   * que sí pueden pasar.
   */
  private peek(): Token {
    return this.tokens[this.index]!;
  }

  private advance(): Token {
    return this.tokens[this.index++]!;
  }

  private fail(message: string): never {
    throw new BashSyntaxError(message, this.peek().line, this.peek().column);
  }

  /** El texto de una palabra, solo si es literal y sin comillas. */
  private textOf(token: Token): string | null {
    if (token.type !== "word" || !token.word) return null;
    let out = "";
    for (const part of token.word) {
      if (part.kind !== "literal" || part.quoted) return null;
      out += part.text;
    }
    return out;
  }

  private atWord(...names: string[]): boolean {
    const text = this.textOf(this.peek());
    return text !== null && names.includes(text);
  }

  private atOperator(...symbols: string[]): boolean {
    return this.peek().type === "operator" && symbols.includes(this.peek().text);
  }

  private expectWord(name: string): void {
    if (!this.atWord(name)) this.fail(`falta ${name}`);
    this.advance();
  }

  private skipNewlines(): void {
    while (this.peek().type === "newline") this.advance();
  }

  private skipSeparators(): void {
    while (this.peek().type === "newline" || this.atOperator(";")) this.advance();
  }

  parseProgram(): Command {
    const command = this.parseList([]);
    if (this.peek().type !== "eof") {
      this.fail(`sobra ${this.textOf(this.peek()) ?? this.peek().text}`);
    }
    return command;
  }

  /** Comandos separados por `;`, `&` o salto, hasta una palabra de parada. */
  private parseList(stop: string[]): Command {
    const commands: Command[] = [];

    for (;;) {
      this.skipSeparators();
      if (this.peek().type === "eof") break;
      if (stop.length > 0 && this.atWord(...stop)) break;
      if (stop.includes(";;") && this.atOperator(";;")) break;

      commands.push(this.parseAndOr());

      if (this.peek().type === "newline" || this.atOperator(";", "&")) {
        // `&` sin trabajos de fondo: aquí se corre igual, en orden. Es una
        // simplificación honesta, no hay nada que poner en segundo plano.
        this.advance();
        continue;
      }
      break;
    }

    if (commands.length === 0) this.fail("falta un comando");
    return commands.length === 1 ? commands[0]! : { type: "list", commands };
  }

  private parseAndOr(): Command {
    let left = this.parsePipeline();

    while (this.atOperator("&&", "||")) {
      const op = this.advance().text as "&&" | "||";
      this.skipNewlines();
      const right = this.parsePipeline();
      left = { type: "andOr", left, op, right };
    }

    return left;
  }

  private parsePipeline(): Command {
    let negated = false;
    if (this.atWord("!")) {
      this.advance();
      negated = true;
    }

    const commands: Command[] = [this.parseCommand()];
    while (this.atOperator("|")) {
      this.advance();
      this.skipNewlines();
      commands.push(this.parseCommand());
    }

    if (commands.length === 1 && !negated) return commands[0]!;
    return { type: "pipeline", commands, negated };
  }

  private parseCommand(): Command {
    if (this.atWord("if")) return this.parseIf();
    if (this.atWord("while") || this.atWord("until")) return this.parseLoop();
    if (this.atWord("for")) return this.parseFor();
    if (this.atWord("case")) return this.parseCase();
    if (this.atWord("{")) return this.parseGroup();
    if (this.atWord("function")) return this.parseFunction();
    if (this.atOperator("(")) return this.parseSubshell();
    if (this.peek().type === "condStart") return this.parseCond();
    if (this.peek().type === "arith") {
      const token = this.advance();
      return { type: "arithCommand", source: token.text, redirects: this.parseRedirects() };
    }

    // `nombre() { ... }`, que es como se declara casi siempre.
    const name = this.textOf(this.peek());
    if (
      name &&
      !RESERVED.has(name) &&
      this.tokens[this.index + 1]?.type === "operator" &&
      this.tokens[this.index + 1]?.text === "(" &&
      this.tokens[this.index + 2]?.type === "operator" &&
      this.tokens[this.index + 2]?.text === ")"
    ) {
      this.advance();
      this.advance();
      this.advance();
      this.skipNewlines();
      return { type: "function", name, body: this.parseFunctionBody() };
    }

    return this.parseSimple();
  }

  private parseFunctionBody(): Command {
    if (this.atWord("{")) return this.parseGroup();
    if (this.atOperator("(")) return this.parseSubshell();
    this.fail("el cuerpo de una función va entre llaves");
  }

  private parseFunction(): Command {
    this.advance();
    const name = this.textOf(this.peek());
    if (!name) this.fail("falta el nombre de la función");
    this.advance();
    if (this.atOperator("(")) {
      this.advance();
      if (!this.atOperator(")")) this.fail("falta cerrar el paréntesis de la función");
      this.advance();
    }
    this.skipNewlines();
    return { type: "function", name, body: this.parseFunctionBody() };
  }

  private parseIf(): Command {
    this.advance();
    const clauses: { condition: Command; body: Command }[] = [];

    const condition = this.parseList(["then"]);
    this.expectWord("then");
    const body = this.parseList(["elif", "else", "fi"]);
    clauses.push({ condition, body });

    let otherwise: Command | undefined;
    for (;;) {
      if (this.atWord("elif")) {
        this.advance();
        const elifCondition = this.parseList(["then"]);
        this.expectWord("then");
        clauses.push({
          condition: elifCondition,
          body: this.parseList(["elif", "else", "fi"]),
        });
        continue;
      }
      if (this.atWord("else")) {
        this.advance();
        otherwise = this.parseList(["fi"]);
      }
      break;
    }

    this.expectWord("fi");
    const redirects = this.parseRedirects();
    return otherwise
      ? { type: "if", clauses, otherwise, redirects }
      : { type: "if", clauses, redirects };
  }

  private parseLoop(): Command {
    const until = this.atWord("until");
    this.advance();
    const condition = this.parseList(["do"]);
    this.expectWord("do");
    const body = this.parseList(["done"]);
    this.expectWord("done");
    return { type: "while", condition, body, until, redirects: this.parseRedirects() };
  }

  private parseFor(): Command {
    this.advance();

    // `for ((i=0; i<10; i++))`: el léxico ya lo trajo entero.
    if (this.peek().type === "arith") {
      const source = this.advance().text;
      const pieces = splitTopLevel(source, ";");
      if (pieces.length !== 3) this.fail("un for aritmético lleva tres partes separadas por ;");
      this.skipSeparators();
      this.expectWord("do");
      const body = this.parseList(["done"]);
      this.expectWord("done");
      return {
        type: "forArith",
        init: pieces[0]!,
        condition: pieces[1]!,
        step: pieces[2]!,
        body,
        redirects: this.parseRedirects(),
      };
    }

    const name = this.textOf(this.peek());
    if (!name) this.fail("falta la variable del for");
    this.advance();

    let items: Word[] | null = null;
    if (this.atWord("in")) {
      this.advance();
      items = [];
      while (this.peek().type === "word" && !this.atWord("do")) {
        items.push(this.advance().word!);
      }
    }

    this.skipSeparators();
    this.expectWord("do");
    const body = this.parseList(["done"]);
    this.expectWord("done");
    return { type: "for", name, items, body, redirects: this.parseRedirects() };
  }

  private parseCase(): Command {
    this.advance();
    if (this.peek().type !== "word") this.fail("falta qué mirar en el case");
    const subject = this.advance().word!;
    this.skipNewlines();
    this.expectWord("in");
    this.skipNewlines();

    const branches: { patterns: Word[]; body: Command | null }[] = [];

    while (!this.atWord("esac")) {
      if (this.peek().type === "eof") this.fail("falta esac");

      if (this.atOperator("(")) this.advance();

      const patterns: Word[] = [];
      for (;;) {
        if (this.peek().type !== "word") this.fail("falta el patrón de una rama del case");
        patterns.push(this.advance().word!);
        if (this.atOperator("|")) {
          this.advance();
          continue;
        }
        break;
      }

      if (!this.atOperator(")")) this.fail("falta el paréntesis que cierra el patrón");
      this.advance();
      this.skipNewlines();

      const body =
        this.atOperator(";;") || this.atWord("esac") ? null : this.parseList([";;", "esac"]);

      if (this.atOperator(";;")) this.advance();
      this.skipNewlines();
      branches.push({ patterns, body });
    }

    this.expectWord("esac");
    return { type: "case", subject, branches, redirects: this.parseRedirects() };
  }

  private parseGroup(): Command {
    this.advance();
    const body = this.parseList(["}"]);
    this.expectWord("}");
    return { type: "group", body, redirects: this.parseRedirects() };
  }

  private parseSubshell(): Command {
    this.advance();
    this.skipNewlines();
    const body = this.parseList([]);
    if (!this.atOperator(")")) this.fail("falta cerrar el paréntesis");
    this.advance();
    return { type: "subshell", body, redirects: this.parseRedirects() };
  }

  /**
   * Lo de dentro de `[[ ]]`.
   *
   * No es un comando corriente: aquí no se parten las palabras ni se expanden
   * globs, `&&` y `||` son de la condición y no del shell, y `=~` compara con
   * una expresión regular. Por eso tiene su propia gramática en vez de pasar
   * por el builtin `test`.
   */
  private parseCond(): Command {
    this.advance();
    const expr = this.parseCondOr();
    if (this.peek().type !== "condEnd") this.fail("falta cerrar con ]]");
    this.advance();
    return { type: "cond", expr, redirects: this.parseRedirects() };
  }

  private parseCondOr(): CondExpr {
    let left = this.parseCondAnd();
    while (this.atOperator("||")) {
      this.advance();
      this.skipNewlines();
      left = { type: "or", left, right: this.parseCondAnd() };
    }
    return left;
  }

  private parseCondAnd(): CondExpr {
    let left = this.parseCondUnary();
    while (this.atOperator("&&")) {
      this.advance();
      this.skipNewlines();
      left = { type: "and", left, right: this.parseCondUnary() };
    }
    return left;
  }

  private parseCondUnary(): CondExpr {
    if (this.atWord("!")) {
      this.advance();
      return { type: "not", expr: this.parseCondUnary() };
    }

    if (this.atOperator("(")) {
      this.advance();
      const inner = this.parseCondOr();
      if (!this.atOperator(")")) this.fail("falta cerrar el paréntesis de la condición");
      this.advance();
      return inner;
    }

    const text = this.textOf(this.peek());
    if (text && UNARY_TESTS.has(text)) {
      this.advance();
      if (this.peek().type !== "word") this.fail(`falta qué mirar después de ${text}`);
      return { type: "unary", op: text, word: this.advance().word! };
    }

    if (this.peek().type !== "word") this.fail("falta una condición");
    const left = this.advance().word!;

    // El léxico leyó `<` y `>` como redirecciones; aquí comparan.
    if (this.peek().type === "redirect") {
      const redirect = this.peek().redirect!;
      if ((redirect.op === "<" || redirect.op === ">") && redirect.target) {
        this.advance();
        return { type: "binary", op: redirect.op, left, right: redirect.target };
      }
    }

    const operator = this.textOf(this.peek());
    if (operator && BINARY_TESTS.has(operator)) {
      this.advance();
      if (this.peek().type !== "word") this.fail(`falta el otro lado de ${operator}`);
      return { type: "binary", op: operator, left, right: this.advance().word! };
    }

    return { type: "word", word: left };
  }

  private parseRedirects(): Redirect[] {
    const redirects: Redirect[] = [];
    while (this.peek().type === "redirect") redirects.push(this.advance().redirect!);
    return redirects;
  }

  private parseSimple(): Command {
    const assignments: Assignment[] = [];
    const words: Word[] = [];
    const redirects: Redirect[] = [];

    for (;;) {
      if (this.peek().type === "redirect") {
        redirects.push(this.advance().redirect!);
        continue;
      }

      if (this.peek().type !== "word") break;

      const text = this.textOf(this.peek());
      if (text !== null && RESERVED.has(text) && words.length === 0) break;

      // Las asignaciones solo cuentan mientras no haya empezado el comando.
      if (words.length === 0) {
        const assignment = this.readAssignment();
        if (assignment) {
          assignments.push(assignment);
          continue;
        }
      }

      words.push(this.advance().word!);
    }

    if (assignments.length === 0 && words.length === 0 && redirects.length === 0) {
      this.fail("falta un comando");
    }

    const command: SimpleCommand = { type: "simple", assignments, words, redirects };
    return command;
  }

  /** `nombre=valor`, `nombre+=valor`, `arr=(uno dos)` y `arr[2]=x`. */
  private readAssignment(): Assignment | null {
    const token = this.peek();
    if (token.type !== "word" || !token.word) return null;

    const first = token.word[0];
    if (!first || first.kind !== "literal" || first.quoted) return null;

    const match = /^([A-Za-z_][A-Za-z0-9_]*)(\[[^\]]*\])?(\+?)=/.exec(first.text);
    if (!match) return null;

    this.advance();
    const name = match[1]!;
    const indexText = match[2];
    const append = match[3] === "+";

    const rest = first.text.slice(match[0].length);
    const value: Word = rest ? [{ kind: "literal", quoted: false, text: rest }] : [];
    value.push(...token.word.slice(1));

    const assignment: Assignment = { name, value, append };
    if (indexText) {
      assignment.index = [{ kind: "literal", quoted: false, text: indexText.slice(1, -1) }];
    }

    // `arr=(uno dos)`: el paréntesis llega como operador aparte.
    if (value.length === 0 && this.atOperator("(")) {
      this.advance();
      const items: Word[] = [];
      this.skipNewlines();
      while (!this.atOperator(")")) {
        if (this.peek().type === "eof") this.fail("falta cerrar el paréntesis del arreglo");
        if (this.peek().type === "newline") {
          this.advance();
          continue;
        }
        if (this.peek().type !== "word") this.fail("solo van palabras dentro de un arreglo");
        items.push(this.advance().word!);
      }
      this.advance();
      assignment.array = items;
    }

    return assignment;
  }
}

/** Parte por un separador sin meterse dentro de los paréntesis. */
function splitTopLevel(source: string, separator: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";

  for (const character of source) {
    if (character === "(") depth++;
    if (character === ")") depth--;
    if (character === separator && depth === 0) {
      out.push(current);
      current = "";
      continue;
    }
    current += character;
  }

  out.push(current);
  return out;
}

export function parse(source: string): Command {
  return new Parser(tokenize(source)).parseProgram();
}

export { BashSyntaxError, BashUnsupportedError };
