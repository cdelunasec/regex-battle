/**
 * `awk`, el caballo de batalla del análisis de logs.
 *
 * No es una herramienta con banderas, es un lenguaje, y por eso este archivo
 * tiene léxico, parser e intérprete propios. Un programa de awk es una lista de
 * reglas `patrón { acción }`: para cada línea de entrada se miran todas las
 * reglas en orden y se ejecuta la acción de las que casen. `BEGIN` corre antes
 * de leer nada y `END` después de todo, que es donde se imprimen los totales.
 *
 * Dos rarezas del lenguaje que hay que respetar o el resultado miente:
 *
 *   - La concatenación no tiene operador: dos expresiones pegadas se juntan.
 *     Por eso `print $1 $2` imprime los dos campos sin separación y
 *     `print $1, $2` los separa con OFS.
 *   - Todo valor es texto y número a la vez. `"10" < "9"` compara como texto y
 *     da verdadero, pero `$1 < $2` con campos numéricos compara como números.
 *     La regla es que si los dos lados parecen números, se comparan como tales.
 *
 * Queda fuera a propósito: `getline`, las funciones que define el usuario y
 * redirigir la salida a un archivo desde dentro. Con eso se cubre el análisis
 * de logs, que es para lo que entra en el curso.
 */
import { compilePosixRegex } from "../regex.ts";
import { formatPrintf } from "./printf.ts";
import { parseArgs, readInputs, toLines, type Tool } from "./support.ts";

class AwkError extends Error {}

// ---------------------------------------------------------------------- léxico

type TokenKind = "number" | "string" | "regex" | "name" | "builtin" | "keyword" | "punct" | "end";

interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set([
  "BEGIN",
  "END",
  "if",
  "else",
  "while",
  "for",
  "do",
  "break",
  "continue",
  "next",
  "exit",
  "delete",
  "in",
  "print",
  "printf",
]);

const BUILTINS = new Set([
  "length",
  "substr",
  "index",
  "split",
  "sub",
  "gsub",
  "match",
  "sprintf",
  "toupper",
  "tolower",
  "int",
  "sqrt",
  "exp",
  "log",
  "sin",
  "cos",
  "atan2",
  "system",
]);

const PUNCT = [
  "**=",
  "...",
  "<=",
  ">=",
  "==",
  "!=",
  "&&",
  "||",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "^=",
  "!~",
  ">>",
  "{",
  "}",
  "(",
  ")",
  "[",
  "]",
  ";",
  ",",
  "+",
  "-",
  "*",
  "/",
  "%",
  "^",
  "<",
  ">",
  "=",
  "!",
  "~",
  "?",
  ":",
  "$",
  "|",
];

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  /** Una barra empieza una expresión regular solo donde puede ir un valor. */
  const regexAllowed = (): boolean => {
    const previous = tokens[tokens.length - 1];
    if (!previous) return true;
    if (previous.kind === "number" || previous.kind === "string" || previous.kind === "name") {
      return false;
    }
    if (previous.kind === "punct" && [")", "]", "++", "--"].includes(previous.text)) return false;
    return true;
  };

  while (i < source.length) {
    const character = source[i]!;

    if (character === "#") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (character === "\\" && source[i + 1] === "\n") {
      i += 2;
      continue;
    }
    if (character === "\n") {
      // El salto termina una sentencia, como el punto y coma.
      tokens.push({ kind: "punct", text: ";" });
      i++;
      continue;
    }
    if (/\s/.test(character)) {
      i++;
      continue;
    }

    if (/[0-9]/.test(character) || (character === "." && /[0-9]/.test(source[i + 1] ?? ""))) {
      const match = /^[0-9]*\.?[0-9]+([eE][-+]?[0-9]+)?/.exec(source.slice(i))!;
      tokens.push({ kind: "number", text: match[0] });
      i += match[0].length;
      continue;
    }

    if (/[A-Za-z_]/.test(character)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i))!;
      const text = match[0];
      tokens.push({
        kind: KEYWORDS.has(text) ? "keyword" : BUILTINS.has(text) ? "builtin" : "name",
        text,
      });
      i += text.length;
      continue;
    }

    if (character === '"') {
      i++;
      let text = "";
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\") {
          const next = source[i + 1];
          const escapes: Record<string, string> = {
            n: "\n",
            t: "\t",
            r: "\r",
            "\\": "\\",
            '"': '"',
          };
          text += escapes[next ?? ""] ?? next ?? "";
          i += 2;
          continue;
        }
        text += source[i];
        i++;
      }
      if (i >= source.length) throw new AwkError("newline in string");
      i++;
      tokens.push({ kind: "string", text });
      continue;
    }

    if (character === "/" && regexAllowed()) {
      i++;
      let text = "";
      while (i < source.length && source[i] !== "/") {
        if (source[i] === "\\") {
          text += source[i]! + (source[i + 1] ?? "");
          i += 2;
          continue;
        }
        text += source[i];
        i++;
      }
      if (i >= source.length) throw new AwkError("unterminated regex");
      i++;
      tokens.push({ kind: "regex", text });
      continue;
    }

    const punct = PUNCT.find((candidate) => source.startsWith(candidate, i));
    if (!punct) throw new AwkError(`syntax error at or near ${character}`);
    tokens.push({ kind: "punct", text: punct });
    i += punct.length;
  }

  tokens.push({ kind: "end", text: "" });
  return tokens;
}

// ------------------------------------------------------------------------ AST

type Expr =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "regex"; source: string }
  | { type: "var"; name: string }
  | { type: "field"; index: Expr }
  | { type: "index"; name: string; keys: Expr[] }
  | { type: "assign"; target: Expr; op: string; value: Expr }
  | { type: "binary"; op: string; left: Expr; right: Expr }
  | { type: "unary"; op: string; operand: Expr }
  | { type: "post"; op: string; target: Expr }
  | { type: "pre"; op: string; target: Expr }
  | { type: "ternary"; condition: Expr; whenTrue: Expr; whenFalse: Expr }
  | { type: "match"; negated: boolean; left: Expr; right: Expr }
  | { type: "in"; key: Expr; name: string }
  | { type: "call"; name: string; args: Expr[] }
  | { type: "group"; expr: Expr };

type Stmt =
  | { type: "print"; args: Expr[] }
  | { type: "printf"; args: Expr[] }
  | { type: "expr"; expr: Expr }
  | { type: "if"; condition: Expr; then: Stmt; otherwise?: Stmt }
  | { type: "while"; condition: Expr; body: Stmt }
  | { type: "do"; condition: Expr; body: Stmt }
  | { type: "for"; init?: Stmt; condition?: Expr; step?: Stmt; body: Stmt }
  | { type: "forIn"; name: string; array: string; body: Stmt }
  | { type: "block"; body: Stmt[] }
  | { type: "next" }
  | { type: "exit"; code?: Expr }
  | { type: "delete"; name: string; keys: Expr[] };

interface Rule {
  kind: "begin" | "end" | "rule";
  pattern?: Expr;
  action?: Stmt;
}

class Parser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(offset = 0): Token {
    return this.tokens[this.index + offset] ?? { kind: "end", text: "" };
  }

  private at(text: string): boolean {
    const token = this.peek();
    return (token.kind === "punct" || token.kind === "keyword") && token.text === text;
  }

  private eat(text: string): boolean {
    if (!this.at(text)) return false;
    this.index++;
    return true;
  }

  private expect(text: string): void {
    if (!this.eat(text)) throw new AwkError(`syntax error: expected ${text}`);
  }

  private skipTerminators(): void {
    while (this.at(";")) this.index++;
  }

  parseProgram(): Rule[] {
    const rules: Rule[] = [];
    this.skipTerminators();

    while (this.peek().kind !== "end") {
      if (this.eat("BEGIN")) {
        rules.push({ kind: "begin", action: this.parseBlock() });
      } else if (this.eat("END")) {
        rules.push({ kind: "end", action: this.parseBlock() });
      } else if (this.at("{")) {
        rules.push({ kind: "rule", action: this.parseBlock() });
      } else {
        const pattern = this.parseExpr();
        // Un patrón sin acción imprime la línea entera.
        const action = this.at("{") ? this.parseBlock() : undefined;
        rules.push(action ? { kind: "rule", pattern, action } : { kind: "rule", pattern });
      }
      this.skipTerminators();
    }

    return rules;
  }

  private parseBlock(): Stmt {
    this.expect("{");
    const body: Stmt[] = [];
    this.skipTerminators();

    while (!this.at("}")) {
      if (this.peek().kind === "end") throw new AwkError("unexpected end of program");
      body.push(this.parseStatement());
      this.skipTerminators();
    }

    this.expect("}");
    return { type: "block", body };
  }

  private parseStatement(): Stmt {
    if (this.at("{")) return this.parseBlock();

    if (this.eat("print")) {
      const args = this.at(";") || this.at("}") ? [] : this.parseExprList();
      return { type: "print", args };
    }
    if (this.eat("printf")) {
      return { type: "printf", args: this.parseExprList() };
    }
    if (this.eat("if")) {
      this.expect("(");
      const condition = this.parseExpr();
      this.expect(")");
      this.skipTerminators();
      const then = this.parseStatement();
      this.skipTerminators();
      if (this.eat("else")) {
        this.skipTerminators();
        return { type: "if", condition, then, otherwise: this.parseStatement() };
      }
      return { type: "if", condition, then };
    }
    if (this.eat("while")) {
      this.expect("(");
      const condition = this.parseExpr();
      this.expect(")");
      this.skipTerminators();
      return { type: "while", condition, body: this.parseStatement() };
    }
    if (this.eat("do")) {
      this.skipTerminators();
      const body = this.parseStatement();
      this.skipTerminators();
      this.expect("while");
      this.expect("(");
      const condition = this.parseExpr();
      this.expect(")");
      return { type: "do", condition, body };
    }
    if (this.eat("for")) {
      this.expect("(");

      // `for (clave in arreglo)` recorre las claves, no los índices.
      if (
        this.peek().kind === "name" &&
        this.peek(1).kind === "keyword" &&
        this.peek(1).text === "in"
      ) {
        const name = this.peek().text;
        this.index += 2;
        const array = this.peek().text;
        this.index++;
        this.expect(")");
        this.skipTerminators();
        return { type: "forIn", name, array, body: this.parseStatement() };
      }

      const init = this.at(";") ? undefined : { type: "expr" as const, expr: this.parseExpr() };
      this.expect(";");
      const condition = this.at(";") ? undefined : this.parseExpr();
      this.expect(";");
      const step = this.at(")") ? undefined : { type: "expr" as const, expr: this.parseExpr() };
      this.expect(")");
      this.skipTerminators();
      const body = this.parseStatement();
      return {
        type: "for",
        ...(init ? { init } : {}),
        ...(condition ? { condition } : {}),
        ...(step ? { step } : {}),
        body,
      };
    }
    if (this.eat("next")) return { type: "next" };
    if (this.eat("exit")) {
      return this.at(";") || this.at("}")
        ? { type: "exit" }
        : { type: "exit", code: this.parseExpr() };
    }
    if (this.eat("delete")) {
      const name = this.peek().text;
      this.index++;
      const keys: Expr[] = [];
      if (this.eat("[")) {
        keys.push(this.parseExpr());
        while (this.eat(",")) keys.push(this.parseExpr());
        this.expect("]");
      }
      return { type: "delete", name, keys };
    }

    return { type: "expr", expr: this.parseExpr() };
  }

  private parseExprList(): Expr[] {
    const args: Expr[] = [this.parseExpr()];
    while (this.eat(",")) args.push(this.parseExpr());
    return args;
  }

  parseExpr(): Expr {
    return this.parseAssign();
  }

  private parseAssign(): Expr {
    const left = this.parseTernary();
    const operators = ["=", "+=", "-=", "*=", "/=", "%=", "^="];
    const token = this.peek();

    if (token.kind === "punct" && operators.includes(token.text)) {
      if (left.type !== "var" && left.type !== "field" && left.type !== "index") {
        throw new AwkError("assignment to a value that is not a variable");
      }
      this.index++;
      return { type: "assign", target: left, op: token.text, value: this.parseAssign() };
    }

    return left;
  }

  private parseTernary(): Expr {
    const condition = this.parseOr();
    if (!this.eat("?")) return condition;
    const whenTrue = this.parseAssign();
    this.expect(":");
    return { type: "ternary", condition, whenTrue, whenFalse: this.parseAssign() };
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.eat("||")) left = { type: "binary", op: "||", left, right: this.parseAnd() };
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseIn();
    while (this.eat("&&")) left = { type: "binary", op: "&&", left, right: this.parseIn() };
    return left;
  }

  private parseIn(): Expr {
    let left = this.parseMatch();
    while (this.at("in")) {
      this.index++;
      const name = this.peek().text;
      this.index++;
      left = { type: "in", key: left, name };
    }
    return left;
  }

  private parseMatch(): Expr {
    let left = this.parseCompare();
    for (;;) {
      if (this.eat("~")) {
        left = { type: "match", negated: false, left, right: this.parseCompare() };
        continue;
      }
      if (this.eat("!~")) {
        left = { type: "match", negated: true, left, right: this.parseCompare() };
        continue;
      }
      return left;
    }
  }

  private parseCompare(): Expr {
    const left = this.parseConcat();
    const token = this.peek();
    const operators = ["<", "<=", ">", ">=", "==", "!="];

    if (token.kind === "punct" && operators.includes(token.text)) {
      this.index++;
      return { type: "binary", op: token.text, left, right: this.parseConcat() };
    }

    return left;
  }

  /** La concatenación no tiene símbolo: es lo que pasa al pegar dos cosas. */
  private parseConcat(): Expr {
    let left = this.parseAdditive();

    for (;;) {
      const token = this.peek();
      const starts =
        token.kind === "number" ||
        token.kind === "string" ||
        token.kind === "name" ||
        token.kind === "builtin" ||
        token.kind === "regex" ||
        (token.kind === "punct" &&
          (token.text === "$" || token.text === "(" || token.text === "!"));

      if (!starts) return left;
      // Un `-` o un `+` de aquí ya se los llevó parseAdditive, así que lo que
      // queda pegado es concatenación de verdad.
      left = { type: "binary", op: "concat", left, right: this.parseAdditive() };
    }
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    for (;;) {
      if (this.eat("+"))
        left = { type: "binary", op: "+", left, right: this.parseMultiplicative() };
      else if (this.eat("-"))
        left = { type: "binary", op: "-", left, right: this.parseMultiplicative() };
      else return left;
    }
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    for (;;) {
      if (this.eat("*")) left = { type: "binary", op: "*", left, right: this.parseUnary() };
      else if (this.eat("/")) left = { type: "binary", op: "/", left, right: this.parseUnary() };
      else if (this.eat("%")) left = { type: "binary", op: "%", left, right: this.parseUnary() };
      else return left;
    }
  }

  private parseUnary(): Expr {
    if (this.eat("!")) return { type: "unary", op: "!", operand: this.parseUnary() };
    if (this.eat("-")) return { type: "unary", op: "-", operand: this.parseUnary() };
    if (this.eat("+")) return this.parseUnary();
    return this.parsePower();
  }

  private parsePower(): Expr {
    const base = this.parsePostfix();
    if (this.eat("^")) return { type: "binary", op: "^", left: base, right: this.parseUnary() };
    return base;
  }

  private parsePostfix(): Expr {
    if (this.at("++") || this.at("--")) {
      const op = this.peek().text;
      this.index++;
      return { type: "pre", op, target: this.parsePostfix() };
    }

    let expr = this.parsePrimary();

    while (this.at("++") || this.at("--")) {
      if (expr.type !== "var" && expr.type !== "field" && expr.type !== "index") break;
      const op = this.peek().text;
      this.index++;
      expr = { type: "post", op, target: expr };
    }

    return expr;
  }

  private parsePrimary(): Expr {
    const token = this.peek();

    if (this.eat("$")) return { type: "field", index: this.parsePostfix() };

    if (this.eat("(")) {
      const inner = this.parseExpr();
      this.expect(")");
      return { type: "group", expr: inner };
    }

    if (token.kind === "number") {
      this.index++;
      return { type: "number", value: Number(token.text) };
    }
    if (token.kind === "string") {
      this.index++;
      return { type: "string", value: token.text };
    }
    if (token.kind === "regex") {
      this.index++;
      return { type: "regex", source: token.text };
    }

    if (token.kind === "builtin") {
      this.index++;
      const args: Expr[] = [];
      if (this.eat("(")) {
        if (!this.at(")")) {
          args.push(this.parseExpr());
          while (this.eat(",")) args.push(this.parseExpr());
        }
        this.expect(")");
      }
      return { type: "call", name: token.text, args };
    }

    if (token.kind === "name") {
      this.index++;
      if (this.eat("[")) {
        const keys: Expr[] = [this.parseExpr()];
        while (this.eat(",")) keys.push(this.parseExpr());
        this.expect("]");
        return { type: "index", name: token.text, keys };
      }
      return { type: "var", name: token.text };
    }

    throw new AwkError(`syntax error at or near ${token.text || "end of program"}`);
  }
}

// ------------------------------------------------------------------ intérprete

class NextSignal {}
class ExitSignal {
  readonly code: number;
  constructor(code: number) {
    this.code = code;
  }
}
class BreakSignal {}
class ContinueSignal {}

/** Un valor de awk es texto y número a la vez; aquí se guarda como vino. */
type Value = string | number;

function toNumber(value: Value): number {
  if (typeof value === "number") return value;
  const match = /^[ \t]*[-+]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][-+]?[0-9]+)?/.exec(value);
  return match ? Number(match[0]) : 0;
}

function toText(value: Value): string {
  if (typeof value === "string") return value;
  if (Number.isInteger(value)) return String(value);
  // awk imprime con OFMT, que por defecto son seis cifras significativas.
  return String(Number(value.toPrecision(6)));
}

function truthy(value: Value): boolean {
  if (typeof value === "number") return value !== 0;
  // Un texto que es un número vale por su número; el resto, por si está vacío.
  if (looksNumeric(value)) return toNumber(value) !== 0;
  return value !== "";
}

function looksNumeric(value: string): boolean {
  return /^[ \t]*[-+]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][-+]?[0-9]+)?[ \t]*$/.test(value);
}

class Interpreter {
  private readonly rules: Rule[];
  private readonly globals = new Map<string, Value>();
  private readonly arrays = new Map<string, Map<string, Value>>();
  private fields: string[] = [];
  private record = "";
  out = "";
  exitCode = 0;

  constructor(rules: Rule[]) {
    this.rules = rules;
    this.globals.set("FS", " ");
    this.globals.set("OFS", " ");
    this.globals.set("ORS", "\n");
    this.globals.set("NR", 0);
    this.globals.set("NF", 0);
    this.globals.set("RSTART", 0);
    this.globals.set("RLENGTH", -1);
    this.globals.set("SUBSEP", "\u001c");
    this.globals.set("FILENAME", "");
  }

  setVariable(name: string, value: Value): void {
    this.globals.set(name, value);
  }

  private arrayOf(name: string): Map<string, Value> {
    let array = this.arrays.get(name);
    if (!array) {
      array = new Map();
      this.arrays.set(name, array);
    }
    return array;
  }

  /** Parte la línea en campos, según FS. */
  private splitRecord(line: string): void {
    this.record = line;
    const fs = toText(this.globals.get("FS") ?? " ");

    if (fs === " ") {
      // El separador por defecto recorta los extremos y junta los espacios.
      this.fields = line.trim() === "" ? [] : line.trim().split(/[ \t\n]+/);
    } else if (fs.length === 1) {
      // Un separador de UN carácter va literal aunque sea un metacarácter. Por
      // eso `awk -F.` parte por puntos y no por cualquier cosa.
      this.fields = line === "" ? [] : line.split(fs);
    } else {
      this.fields =
        line === "" ? [] : line.split(compilePosixRegex(fs, { flavor: "ere", global: true }));
    }

    this.globals.set("NF", this.fields.length);
  }

  private rebuildRecord(): void {
    this.record = this.fields.join(toText(this.globals.get("OFS") ?? " "));
  }

  private getField(index: number): Value {
    if (index === 0) return this.record;
    const value = this.fields[index - 1];
    if (value === undefined) return "";
    return looksNumeric(value) ? value : value;
  }

  private setField(index: number, value: Value): void {
    if (index === 0) {
      this.splitRecord(toText(value));
      return;
    }
    while (this.fields.length < index) this.fields.push("");
    this.fields[index - 1] = toText(value);
    this.globals.set("NF", this.fields.length);
    this.rebuildRecord();
  }

  private regexOf(expr: Expr): RegExp {
    if (expr.type === "regex") return compilePosixRegex(expr.source, { flavor: "ere" });
    return compilePosixRegex(toText(this.evaluate(expr)), { flavor: "ere" });
  }

  evaluate(expr: Expr): Value {
    switch (expr.type) {
      case "number":
        return expr.value;
      case "string":
        return expr.value;
      case "regex":
        // Una expresión regular suelta se compara contra la línea entera.
        return compilePosixRegex(expr.source, { flavor: "ere" }).test(this.record) ? 1 : 0;
      case "group":
        return this.evaluate(expr.expr);
      case "var":
        return this.globals.get(expr.name) ?? "";
      case "field":
        return this.getField(Math.trunc(toNumber(this.evaluate(expr.index))));
      case "index": {
        const key = expr.keys.map((part) => toText(this.evaluate(part))).join("\u001c");
        return this.arrayOf(expr.name).get(key) ?? "";
      }
      case "in": {
        const key = toText(this.evaluate(expr.key));
        return this.arrayOf(expr.name).has(key) ? 1 : 0;
      }
      case "assign":
        return this.assign(expr.target, expr.op, expr.value);
      case "ternary":
        return truthy(this.evaluate(expr.condition))
          ? this.evaluate(expr.whenTrue)
          : this.evaluate(expr.whenFalse);
      case "unary":
        if (expr.op === "!") return truthy(this.evaluate(expr.operand)) ? 0 : 1;
        return -toNumber(this.evaluate(expr.operand));
      case "pre": {
        const value = toNumber(this.read(expr.target)) + (expr.op === "++" ? 1 : -1);
        this.write(expr.target, value);
        return value;
      }
      case "post": {
        const before = toNumber(this.read(expr.target));
        this.write(expr.target, before + (expr.op === "++" ? 1 : -1));
        return before;
      }
      case "match": {
        const text = toText(this.evaluate(expr.left));
        const matched = this.regexOf(expr.right).test(text);
        return (expr.negated ? !matched : matched) ? 1 : 0;
      }
      case "call":
        return this.callBuiltin(expr.name, expr.args);
      case "binary":
        return this.binary(expr.op, expr.left, expr.right);
      default:
        return "";
    }
  }

  private read(target: Expr): Value {
    return this.evaluate(target);
  }

  private write(target: Expr, value: Value): void {
    if (target.type === "var") {
      this.globals.set(target.name, value);
      return;
    }
    if (target.type === "field") {
      this.setField(Math.trunc(toNumber(this.evaluate(target.index))), value);
      return;
    }
    if (target.type === "index") {
      const key = target.keys.map((part) => toText(this.evaluate(part))).join("\u001c");
      this.arrayOf(target.name).set(key, value);
    }
  }

  private assign(target: Expr, op: string, valueExpr: Expr): Value {
    const value = this.evaluate(valueExpr);
    if (op === "=") {
      this.write(target, value);
      return value;
    }

    const current = toNumber(this.read(target));
    const operand = toNumber(value);
    const result =
      op === "+="
        ? current + operand
        : op === "-="
          ? current - operand
          : op === "*="
            ? current * operand
            : op === "/="
              ? current / operand
              : op === "%="
                ? current % operand
                : current ** operand;

    this.write(target, result);
    return result;
  }

  private binary(op: string, leftExpr: Expr, rightExpr: Expr): Value {
    if (op === "&&") {
      return truthy(this.evaluate(leftExpr)) && truthy(this.evaluate(rightExpr)) ? 1 : 0;
    }
    if (op === "||") {
      return truthy(this.evaluate(leftExpr)) || truthy(this.evaluate(rightExpr)) ? 1 : 0;
    }

    const left = this.evaluate(leftExpr);
    const right = this.evaluate(rightExpr);

    if (op === "concat") return toText(left) + toText(right);

    if (["<", "<=", ">", ">=", "==", "!="].includes(op)) {
      // Si los dos lados parecen números, se comparan como números. Si no,
      // como texto. Es la regla que hace que `"10" < "9"` sea verdadero.
      const numeric =
        (typeof left === "number" || looksNumeric(left)) &&
        (typeof right === "number" || looksNumeric(right));

      const a: Value = numeric ? toNumber(left) : toText(left);
      const b: Value = numeric ? toNumber(right) : toText(right);

      switch (op) {
        case "<":
          return a < b ? 1 : 0;
        case "<=":
          return a <= b ? 1 : 0;
        case ">":
          return a > b ? 1 : 0;
        case ">=":
          return a >= b ? 1 : 0;
        case "==":
          return a === b ? 1 : 0;
        default:
          return a !== b ? 1 : 0;
      }
    }

    const a = toNumber(left);
    const b = toNumber(right);
    switch (op) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        if (b === 0) throw new AwkError("division by zero");
        return a / b;
      case "%":
        if (b === 0) throw new AwkError("division by zero");
        return a % b;
      case "^":
        return a ** b;
      default:
        return "";
    }
  }

  private callBuiltin(name: string, args: Expr[]): Value {
    const value = (position: number): Value =>
      args[position] === undefined ? "" : this.evaluate(args[position]!);
    const text = (position: number): string => toText(value(position));
    const number = (position: number): number => toNumber(value(position));

    switch (name) {
      case "length":
        return args.length === 0 ? this.record.length : text(0).length;
      case "substr": {
        const source = text(0);
        const from = Math.trunc(number(1));
        const start = Math.max(from - 1, 0);
        if (args.length < 3) return source.slice(start);
        return source.slice(start, start + Math.trunc(number(2)));
      }
      case "index":
        return text(0).indexOf(text(1)) + 1;
      case "toupper":
        return text(0).toUpperCase();
      case "tolower":
        return text(0).toLowerCase();
      case "int":
        return Math.trunc(number(0));
      case "sqrt":
        return Math.sqrt(number(0));
      case "exp":
        return Math.exp(number(0));
      case "log":
        return Math.log(number(0));
      case "sin":
        return Math.sin(number(0));
      case "cos":
        return Math.cos(number(0));
      case "atan2":
        return Math.atan2(number(0), number(1));
      case "sprintf":
        return formatPrintf(
          text(0),
          args.slice(1).map((_, position) => text(position + 1)),
        );
      case "system":
        // No hay procesos que lanzar, y fingir que sí sería mentir.
        throw new AwkError("system() no existe en esta plataforma: no hay procesos");
      case "split": {
        const source = text(0);
        const arrayExpr = args[1];
        if (!arrayExpr || arrayExpr.type !== "var") throw new AwkError("split: second argument");
        const separator = args.length > 2 ? text(2) : toText(this.globals.get("FS") ?? " ");

        const pieces =
          separator === " "
            ? source.trim() === ""
              ? []
              : source.trim().split(/[ \t\n]+/)
            : source === ""
              ? []
              : source.split(
                  separator.length === 1
                    ? separator
                    : compilePosixRegex(separator, { flavor: "ere", global: true }),
                );

        const array = this.arrayOf(arrayExpr.name);
        array.clear();
        pieces.forEach((piece, position) => array.set(String(position + 1), piece));
        return pieces.length;
      }
      case "match": {
        const source = text(0);
        const regex = this.regexOf(args[1]!);
        const found = regex.exec(source);
        this.globals.set("RSTART", found ? found.index + 1 : 0);
        this.globals.set("RLENGTH", found ? found[0].length : -1);
        return found ? found.index + 1 : 0;
      }
      case "sub":
      case "gsub": {
        const regex = compilePosixRegex(
          args[0]!.type === "regex" ? args[0]!.source : toText(this.evaluate(args[0]!)),
          { flavor: "ere", global: name === "gsub" },
        );
        const replacement = text(1);
        const target: Expr = args[2] ?? { type: "field", index: { type: "number", value: 0 } };
        const source = toText(this.read(target));

        let count = 0;
        const replaced = source.replace(regex, (whole: string) => {
          count++;
          // En awk, un `&` en el reemplazo es lo que casó.
          return replacement.replace(/\\?&/g, (token) => (token === "&" ? whole : "&"));
        });

        if (count > 0) this.write(target, replaced);
        return count;
      }
      default:
        throw new AwkError(`calling undefined function ${name}`);
    }
  }

  private print(args: Expr[]): void {
    const ofs = toText(this.globals.get("OFS") ?? " ");
    const ors = toText(this.globals.get("ORS") ?? "\n");
    const text =
      args.length === 0 ? this.record : args.map((arg) => toText(this.evaluate(arg))).join(ofs);
    this.out += text + ors;
  }

  execute(statement: Stmt): void {
    switch (statement.type) {
      case "block":
        for (const inner of statement.body) this.execute(inner);
        return;
      case "print":
        this.print(statement.args);
        return;
      case "printf": {
        const format = toText(this.evaluate(statement.args[0]!));
        const rest = statement.args.slice(1).map((arg) => toText(this.evaluate(arg)));
        this.out += formatPrintf(format, rest);
        return;
      }
      case "expr":
        this.evaluate(statement.expr);
        return;
      case "if":
        if (truthy(this.evaluate(statement.condition))) this.execute(statement.then);
        else if (statement.otherwise) this.execute(statement.otherwise);
        return;
      case "while":
        while (truthy(this.evaluate(statement.condition))) {
          try {
            this.execute(statement.body);
          } catch (signal) {
            if (signal instanceof BreakSignal) break;
            if (!(signal instanceof ContinueSignal)) throw signal;
          }
        }
        return;
      case "do":
        do {
          try {
            this.execute(statement.body);
          } catch (signal) {
            if (signal instanceof BreakSignal) break;
            if (!(signal instanceof ContinueSignal)) throw signal;
          }
        } while (truthy(this.evaluate(statement.condition)));
        return;
      case "for": {
        if (statement.init) this.execute(statement.init);
        while (statement.condition === undefined || truthy(this.evaluate(statement.condition))) {
          try {
            this.execute(statement.body);
          } catch (signal) {
            if (signal instanceof BreakSignal) break;
            if (!(signal instanceof ContinueSignal)) throw signal;
          }
          if (statement.step) this.execute(statement.step);
        }
        return;
      }
      case "forIn": {
        for (const key of [...this.arrayOf(statement.array).keys()]) {
          this.globals.set(statement.name, key);
          try {
            this.execute(statement.body);
          } catch (signal) {
            if (signal instanceof BreakSignal) break;
            if (!(signal instanceof ContinueSignal)) throw signal;
          }
        }
        return;
      }
      case "delete": {
        const array = this.arrayOf(statement.name);
        if (statement.keys.length === 0) array.clear();
        else array.delete(statement.keys.map((key) => toText(this.evaluate(key))).join("\u001c"));
        return;
      }
      case "next":
        throw new NextSignal();
      case "exit":
        throw new ExitSignal(
          statement.code ? Math.trunc(toNumber(this.evaluate(statement.code))) : 0,
        );
    }
  }

  run(lines: string[], filename: string): void {
    this.globals.set("FILENAME", filename);
    let stopped = false;

    try {
      for (const rule of this.rules) {
        if (rule.kind === "begin" && rule.action) this.execute(rule.action);
      }

      for (const line of lines) {
        this.globals.set("NR", toNumber(this.globals.get("NR") ?? 0) + 1);
        this.splitRecord(line);

        try {
          for (const rule of this.rules) {
            if (rule.kind !== "rule") continue;
            if (rule.pattern && !truthy(this.evaluate(rule.pattern))) continue;
            if (rule.action) this.execute(rule.action);
            else this.print([]);
          }
        } catch (signal) {
          if (!(signal instanceof NextSignal)) throw signal;
        }
      }
    } catch (signal) {
      if (signal instanceof ExitSignal) {
        this.exitCode = signal.code;
        stopped = true;
      } else {
        throw signal;
      }
    }

    // Los END corren igual, incluso después de un `exit`.
    try {
      for (const rule of this.rules) {
        if (rule.kind === "end" && rule.action) this.execute(rule.action);
      }
    } catch (signal) {
      if (signal instanceof ExitSignal) this.exitCode = signal.code;
      else if (!stopped) throw signal;
    }
  }
}

export const awk: Tool = (context) => {
  const parsed = parseArgs(context.args, { values: "Fv", flags: "" });
  const operands = [...parsed.operands];
  const program = operands.shift();

  if (program === undefined) {
    return {
      stdout: "",
      stderr: "usage: awk [-F fs] [-v var=value] 'program' [file ...]\n",
      status: 2,
    };
  }

  let rules: Rule[];
  try {
    rules = new Parser(tokenize(program)).parseProgram();
  } catch (error) {
    return {
      stdout: "",
      stderr: `awk: ${error instanceof Error ? error.message : "syntax error"}\n`,
      status: 2,
    };
  }

  const interpreter = new Interpreter(rules);
  if (parsed.values.has("F")) {
    const separator = parsed.values.get("F")!;
    // `-F'\t'` llega con la barra literal y hay que traducirla.
    interpreter.setVariable("FS", separator === "\\t" ? "\t" : separator);
  }
  for (const assignment of parsed.values.has("v") ? [parsed.values.get("v")!] : []) {
    const equals = assignment.indexOf("=");
    if (equals > 0)
      interpreter.setVariable(assignment.slice(0, equals), assignment.slice(equals + 1));
  }

  const { inputs, errors } = readInputs(context, operands, "awk");
  const lines = inputs.flatMap((input) => toLines(input.content));

  try {
    interpreter.run(lines, inputs[0]?.name === "-" ? "" : (inputs[0]?.name ?? ""));
  } catch (error) {
    return {
      stdout: interpreter.out,
      stderr: `awk: ${error instanceof Error ? error.message : "error"}\n`,
      status: 2,
    };
  }

  return {
    stdout: interpreter.out,
    stderr: errors.length > 0 ? errors.join("\n") + "\n" : "",
    status: errors.length > 0 ? 2 : interpreter.exitCode,
  };
};
