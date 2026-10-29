/**
 * La aritmética de `$(( ))`, de `(( ))` y del `for` de tres partes.
 *
 * Es un lenguaje aparte dentro del shell, con sus propias reglas: aquí las
 * variables se escriben sin el dólar, todo es entero, y la división trunca
 * hacia cero en vez de redondear. Un `$((7/2))` da 3, no 3.5 ni 4, y eso hay
 * que respetarlo porque es lo que enseña la lección de contar.
 *
 * Los enteros van en `BigInt` y se recortan a 64 bits al final. Con el número
 * corriente de JavaScript, un `$((2**62))` empezaría a mentir por arriba, y un
 * contador de bytes de un log llega a esos tamaños sin esfuerzo.
 */

export class BashArithError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BashArithError";
  }
}

/** De dónde salen y a dónde van las variables de la expresión. */
export interface ArithHost {
  get(name: string): string | undefined;
  set(name: string, value: string): void;
}

type TokenKind = "number" | "name" | "operator" | "end";

interface Token {
  kind: TokenKind;
  text: string;
}

/** De más largos a más cortos, porque `<<=` tiene que ganarle a `<<` y a `<`. */
const OPERATORS = [
  "<<=",
  ">>=",
  "**=",
  "&&",
  "||",
  "==",
  "!=",
  "<=",
  ">=",
  "<<",
  ">>",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "**",
  "+",
  "-",
  "*",
  "/",
  "%",
  "<",
  ">",
  "!",
  "~",
  "&",
  "|",
  "^",
  "?",
  ":",
  "(",
  ")",
  ",",
  "=",
];

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < source.length) {
    const character = source[i]!;

    if (/\s/.test(character)) {
      i++;
      continue;
    }

    if (/[0-9]/.test(character)) {
      const hex = /^0[xX][0-9a-fA-F]+/.exec(source.slice(i));
      if (hex) {
        tokens.push({ kind: "number", text: hex[0] });
        i += hex[0].length;
        continue;
      }
      const digits = /^[0-9]+/.exec(source.slice(i))!;
      tokens.push({ kind: "number", text: digits[0] });
      i += digits[0].length;
      continue;
    }

    if (/[A-Za-z_]/.test(character)) {
      const name = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i))!;
      tokens.push({ kind: "name", text: name[0] });
      i += name[0].length;
      continue;
    }

    // Un `$` aquí es de más, pero se escribe tanto que no vale la pena pelear.
    if (character === "$") {
      i++;
      continue;
    }

    const operator = OPERATORS.find((candidate) => source.startsWith(candidate, i));
    if (!operator) throw new BashArithError(`no se entiende ${character} en la aritmética`);
    tokens.push({ kind: "operator", text: operator });
    i += operator.length;
  }

  tokens.push({ kind: "end", text: "" });
  return tokens;
}

/** Recorta a 64 bits con signo, que es hasta donde cuenta bash. */
function wrap(value: bigint): bigint {
  const bits = BigInt.asIntN(64, value);
  return bits;
}

class ArithParser {
  private readonly tokens: Token[];
  private index = 0;
  private readonly host: ArithHost;

  constructor(tokens: Token[], host: ArithHost) {
    this.tokens = tokens;
    this.host = host;
  }

  private peek(): Token {
    return this.tokens[this.index]!;
  }

  private at(text: string): boolean {
    const token = this.tokens[this.index]!;
    return token.kind === "operator" && token.text === text;
  }

  private eat(text: string): boolean {
    if (!this.at(text)) return false;
    this.index++;
    return true;
  }

  private expect(text: string): void {
    if (!this.eat(text)) throw new BashArithError(`falta ${text} en la aritmética`);
  }

  private valueOf(name: string): bigint {
    const raw = this.host.get(name);
    if (raw === undefined || raw.trim() === "") return 0n;
    // Una variable con texto que no es número vale cero, como en bash.
    const parsed = /^\s*-?\d+\s*$/.test(raw) ? BigInt(raw.trim()) : null;
    if (parsed === null) {
      const nested = /^[A-Za-z_][A-Za-z0-9_]*$/.test(raw.trim());
      // Bash resuelve el nombre de dentro; sin eso, `n=x; x=3; $((n))` mentiría.
      if (nested) return this.valueOf(raw.trim());
      return 0n;
    }
    return parsed;
  }

  private assign(name: string, value: bigint): bigint {
    const wrapped = wrap(value);
    this.host.set(name, wrapped.toString());
    return wrapped;
  }

  parse(): bigint {
    const value = this.parseComma();
    if (this.peek().kind !== "end") {
      throw new BashArithError(`sobra ${this.peek().text} en la aritmética`);
    }
    return value;
  }

  private parseComma(): bigint {
    let value = this.parseAssignment();
    while (this.eat(",")) value = this.parseAssignment();
    return value;
  }

  private parseAssignment(): bigint {
    const start = this.index;
    const token = this.peek();

    if (token.kind === "name") {
      const next = this.tokens[this.index + 1];
      const compound: Record<string, (a: bigint, b: bigint) => bigint> = {
        "+=": (a, b) => a + b,
        "-=": (a, b) => a - b,
        "*=": (a, b) => a * b,
        "/=": (a, b) => this.divide(a, b),
        "%=": (a, b) => this.modulo(a, b),
        "<<=": (a, b) => a << b,
        ">>=": (a, b) => a >> b,
        "&=": (a, b) => a & b,
        "|=": (a, b) => a | b,
        "^=": (a, b) => a ^ b,
      };

      if (next?.kind === "operator" && next.text === "=") {
        this.index += 2;
        return this.assign(token.text, this.parseAssignment());
      }
      if (next?.kind === "operator" && compound[next.text]) {
        const apply = compound[next.text]!;
        this.index += 2;
        return this.assign(token.text, apply(this.valueOf(token.text), this.parseAssignment()));
      }
    }

    this.index = start;
    return this.parseTernary();
  }

  private parseTernary(): bigint {
    const condition = this.parseOr();
    if (!this.eat("?")) return condition;
    const whenTrue = this.parseAssignment();
    this.expect(":");
    const whenFalse = this.parseAssignment();
    return condition !== 0n ? whenTrue : whenFalse;
  }

  private parseOr(): bigint {
    let left = this.parseAnd();
    while (this.eat("||")) {
      const right = this.parseAnd();
      left = left !== 0n || right !== 0n ? 1n : 0n;
    }
    return left;
  }

  private parseAnd(): bigint {
    let left = this.parseBitOr();
    while (this.eat("&&")) {
      const right = this.parseBitOr();
      left = left !== 0n && right !== 0n ? 1n : 0n;
    }
    return left;
  }

  private parseBitOr(): bigint {
    let left = this.parseBitXor();
    while (this.at("|") && !this.at("||")) {
      this.index++;
      left = left | this.parseBitXor();
    }
    return left;
  }

  private parseBitXor(): bigint {
    let left = this.parseBitAnd();
    while (this.eat("^")) left = left ^ this.parseBitAnd();
    return left;
  }

  private parseBitAnd(): bigint {
    let left = this.parseEquality();
    while (this.at("&") && !this.at("&&")) {
      this.index++;
      left = left & this.parseEquality();
    }
    return left;
  }

  private parseEquality(): bigint {
    let left = this.parseComparison();
    for (;;) {
      if (this.eat("==")) left = left === this.parseComparison() ? 1n : 0n;
      else if (this.eat("!=")) left = left !== this.parseComparison() ? 1n : 0n;
      else return left;
    }
  }

  private parseComparison(): bigint {
    let left = this.parseShift();
    for (;;) {
      if (this.eat("<=")) left = left <= this.parseShift() ? 1n : 0n;
      else if (this.eat(">=")) left = left >= this.parseShift() ? 1n : 0n;
      else if (this.eat("<")) left = left < this.parseShift() ? 1n : 0n;
      else if (this.eat(">")) left = left > this.parseShift() ? 1n : 0n;
      else return left;
    }
  }

  private parseShift(): bigint {
    let left = this.parseAdditive();
    for (;;) {
      if (this.eat("<<")) left = wrap(left << this.parseAdditive());
      else if (this.eat(">>")) left = left >> this.parseAdditive();
      else return left;
    }
  }

  private parseAdditive(): bigint {
    let left = this.parseMultiplicative();
    for (;;) {
      if (this.eat("+")) left = wrap(left + this.parseMultiplicative());
      else if (this.eat("-")) left = wrap(left - this.parseMultiplicative());
      else return left;
    }
  }

  private parseMultiplicative(): bigint {
    let left = this.parsePower();
    for (;;) {
      if (this.eat("*")) left = wrap(left * this.parsePower());
      else if (this.eat("/")) left = this.divide(left, this.parsePower());
      else if (this.eat("%")) left = this.modulo(left, this.parsePower());
      else return left;
    }
  }

  private divide(left: bigint, right: bigint): bigint {
    if (right === 0n) throw new BashArithError("division by 0");
    return wrap(left / right);
  }

  private modulo(left: bigint, right: bigint): bigint {
    if (right === 0n) throw new BashArithError("division by 0");
    return wrap(left % right);
  }

  private parsePower(): bigint {
    const base = this.parseUnary();
    // La potencia asocia a la derecha: 2**3**2 es 2**(3**2).
    if (this.eat("**")) return wrap(base ** this.parsePower());
    return base;
  }

  private parseUnary(): bigint {
    if (this.eat("-")) return wrap(-this.parseUnary());
    if (this.eat("+")) return this.parseUnary();
    if (this.eat("!")) return this.parseUnary() === 0n ? 1n : 0n;
    if (this.eat("~")) return wrap(~this.parseUnary());

    if (this.at("++") || this.at("--")) {
      const delta = this.peek().text === "++" ? 1n : -1n;
      this.index++;
      const token = this.peek();
      if (token.kind !== "name") throw new BashArithError("falta la variable que incrementar");
      this.index++;
      return this.assign(token.text, this.valueOf(token.text) + delta);
    }

    return this.parsePostfix();
  }

  private parsePostfix(): bigint {
    const token = this.peek();

    if (token.kind === "name") {
      const next = this.tokens[this.index + 1];
      if (next?.kind === "operator" && (next.text === "++" || next.text === "--")) {
        this.index += 2;
        const before = this.valueOf(token.text);
        this.assign(token.text, before + (next.text === "++" ? 1n : -1n));
        // El de después devuelve el valor de ANTES, que es toda su gracia.
        return before;
      }
    }

    return this.parsePrimary();
  }

  private parsePrimary(): bigint {
    const token = this.peek();

    if (this.eat("(")) {
      const value = this.parseComma();
      this.expect(")");
      return value;
    }

    if (token.kind === "number") {
      this.index++;
      if (/^0[xX]/.test(token.text)) return BigInt(token.text);
      // Un cero delante significa octal, como en C.
      if (/^0[0-7]+$/.test(token.text)) return BigInt(parseInt(token.text, 8));
      return BigInt(token.text);
    }

    if (token.kind === "name") {
      this.index++;
      return this.valueOf(token.text);
    }

    throw new BashArithError(
      `falta un valor en la aritmética${token.text ? `, cerca de ${token.text}` : ""}`,
    );
  }
}

export function evaluateArith(source: string, host: ArithHost): bigint {
  if (source.trim() === "") return 0n;
  return new ArithParser(tokenize(source), host).parse();
}

/** Lo que imprime `$(( ))`, que siempre es un entero en texto. */
export function arithToString(source: string, host: ArithHost): string {
  return evaluateArith(source, host).toString();
}
