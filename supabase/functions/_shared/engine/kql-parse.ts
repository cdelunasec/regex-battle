// GENERATED FILE. Edit src/engine and run `npm run sync:engine`.
/**
 * Analizador de KQL, el lenguaje de la barra de búsqueda de Kibana.
 *
 * Este módulo se copia tal cual a la Edge Function, así que no puede tocar
 * ninguna API que solo exista en el navegador o solo en Deno.
 *
 * Ojo con el nombre: KQL aquí es el de Kibana (Elastic), no el Kusto de
 * Microsoft Sentinel, que también se abrevia KQL y es un lenguaje distinto.
 * Este es un lenguaje de FILTRO: no transforma ni agrega, solo decide si un
 * documento entra o no. Por eso encaja en el motor sin rehacerlo: un regex
 * responde sí o no sobre un texto, y una consulta KQL responde sí o no sobre
 * un documento.
 *
 * Gramática soportada, de menor a mayor precedencia:
 *
 *   or      := and (OR and)*
 *   and     := not (AND not)*
 *   not     := NOT not | primary
 *   primary := '(' or ')' | campo | término suelto
 *   campo   := nombre ':' valor | nombre ('>=' | '<=' | '>' | '<') átomo
 *   valor   := '(' átomo ((AND|OR) átomo)* ')' | átomo
 *
 * Lo que queda fuera a propósito, por si alguien lo busca: comodines en el
 * NOMBRE del campo, consultas anidadas de Elastic y el operador `:` con rangos
 * entre llaves.
 */

export type KqlOperator = ":" | ">" | ">=" | "<" | "<=";

export interface KqlValue {
  text: string;
  /** Entre comillas se compara literal: ni comodines ni palabra clave. */
  quoted: boolean;
}

export type KqlNode =
  | { type: "and"; left: KqlNode; right: KqlNode }
  | { type: "or"; left: KqlNode; right: KqlNode }
  | { type: "not"; node: KqlNode }
  | {
      type: "field";
      field: string;
      operator: KqlOperator;
      values: KqlValue[];
      /** Cómo se combinan los valores de una lista `campo:(a or b)`. */
      joiner: "and" | "or";
    }
  /** Un término sin campo busca en cualquier parte del documento. */
  | { type: "term"; value: KqlValue };

export class KqlSyntaxError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "KqlSyntaxError";
    this.code = code;
  }
}

type TokenType =
  | "lparen"
  | "rparen"
  | "colon"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "and"
  | "or"
  | "not"
  | "quoted"
  | "word"
  | "end";

interface Token {
  type: TokenType;
  text: string;
}

/** Lo que corta una palabra. Todo lo demás vale dentro de un nombre o un valor. */
const DELIMITERS = new Set([" ", "\t", "\n", "\r", "(", ")", ":", "<", ">", '"']);

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const c = input[i]!;

    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i++;
      continue;
    }

    if (c === "(") {
      tokens.push({ type: "lparen", text: c });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "rparen", text: c });
      i++;
      continue;
    }
    if (c === ":") {
      tokens.push({ type: "colon", text: c });
      i++;
      continue;
    }
    if (c === ">" || c === "<") {
      const twoChar = input[i + 1] === "=";
      const type: TokenType = c === ">" ? (twoChar ? "gte" : "gt") : twoChar ? "lte" : "lt";
      tokens.push({ type, text: twoChar ? c + "=" : c });
      i += twoChar ? 2 : 1;
      continue;
    }

    if (c === '"') {
      let text = "";
      i++;
      while (i < input.length && input[i] !== '"') {
        // La barra invertida escapa la comilla y a sí misma, nada más.
        if (input[i] === "\\" && (input[i + 1] === '"' || input[i + 1] === "\\")) {
          text += input[i + 1];
          i += 2;
          continue;
        }
        text += input[i];
        i++;
      }
      if (i >= input.length) {
        throw new KqlSyntaxError(
          "unclosed_quote",
          "Hay unas comillas que se abren y no se cierran.",
        );
      }
      i++;
      tokens.push({ type: "quoted", text });
      continue;
    }

    let word = "";
    while (i < input.length && !DELIMITERS.has(input[i]!)) {
      word += input[i];
      i++;
    }

    const lowered = word.toLowerCase();
    if (lowered === "and") tokens.push({ type: "and", text: word });
    else if (lowered === "or") tokens.push({ type: "or", text: word });
    else if (lowered === "not") tokens.push({ type: "not", text: word });
    else tokens.push({ type: "word", text: word });
  }

  tokens.push({ type: "end", text: "" });
  return tokens;
}

/** Tope de anidamiento, para que una consulta con mil paréntesis no reviente la pila. */
const MAX_DEPTH = 20;

class Parser {
  private position = 0;
  private depth = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.position]!;
  }

  private next(): Token {
    return this.tokens[this.position++]!;
  }

  private expect(type: TokenType, code: string, message: string): Token {
    if (this.peek().type !== type) throw new KqlSyntaxError(code, message);
    return this.next();
  }

  parse(): KqlNode {
    const node = this.parseOr();
    if (this.peek().type !== "end") {
      throw new KqlSyntaxError(
        "unexpected_token",
        `Sobra algo al final de la consulta: "${this.peek().text}".`,
      );
    }
    return node;
  }

  private parseOr(): KqlNode {
    let left = this.parseAnd();
    while (this.peek().type === "or") {
      this.next();
      left = { type: "or", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): KqlNode {
    let left = this.parseNot();
    while (this.peek().type === "and") {
      this.next();
      left = { type: "and", left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): KqlNode {
    if (this.peek().type === "not") {
      this.next();
      return { type: "not", node: this.parseNot() };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): KqlNode {
    const token = this.peek();

    if (token.type === "lparen") {
      this.enter();
      this.next();
      const node = this.parseOr();
      this.expect("rparen", "unclosed_paren", "Falta cerrar un paréntesis.");
      this.leave();
      return node;
    }

    if (token.type === "word" || token.type === "quoted") {
      const head = this.next();
      const after = this.peek();

      if (after.type === "colon") {
        this.next();
        return this.parseFieldValue(head.text, ":");
      }
      if (
        after.type === "gt" ||
        after.type === "gte" ||
        after.type === "lt" ||
        after.type === "lte"
      ) {
        this.next();
        const operator: KqlOperator =
          after.type === "gt"
            ? ">"
            : after.type === "gte"
              ? ">="
              : after.type === "lt"
                ? "<"
                : "<=";
        const value = this.parseAtom();
        return { type: "field", field: head.text, operator, values: [value], joiner: "or" };
      }

      return { type: "term", value: { text: head.text, quoted: head.type === "quoted" } };
    }

    if (token.type === "end") {
      throw new KqlSyntaxError("empty_query", "La consulta se queda a medias.");
    }

    throw new KqlSyntaxError(
      "unexpected_token",
      `No se esperaba "${token.text}" en ese sitio de la consulta.`,
    );
  }

  /** El lado derecho de `campo:`, que puede ser un átomo o una lista entre paréntesis. */
  private parseFieldValue(field: string, operator: KqlOperator): KqlNode {
    if (this.peek().type !== "lparen") {
      return { type: "field", field, operator, values: [this.parseAtom()], joiner: "or" };
    }

    this.enter();
    this.next();
    const values: KqlValue[] = [this.parseAtom()];
    let joiner: "and" | "or" = "or";

    while (this.peek().type === "and" || this.peek().type === "or") {
      joiner = this.next().type === "and" ? "and" : "or";
      values.push(this.parseAtom());
    }

    this.expect("rparen", "unclosed_paren", "Falta cerrar el paréntesis de la lista de valores.");
    this.leave();
    return { type: "field", field, operator, values, joiner };
  }

  private parseAtom(): KqlValue {
    const token = this.peek();
    // Una palabra clave en posición de valor es un valor, no un operador: en
    // `estado:not` lo que se busca es el texto "not".
    if (
      token.type === "word" ||
      token.type === "and" ||
      token.type === "or" ||
      token.type === "not"
    ) {
      this.next();
      return { text: token.text, quoted: false };
    }
    if (token.type === "quoted") {
      this.next();
      return { text: token.text, quoted: true };
    }
    throw new KqlSyntaxError(
      "missing_value",
      "Falta el valor que va después de los dos puntos o de la comparación.",
    );
  }

  private enter(): void {
    this.depth++;
    if (this.depth > MAX_DEPTH) {
      throw new KqlSyntaxError("too_deep", "La consulta tiene demasiados paréntesis anidados.");
    }
  }

  private leave(): void {
    this.depth--;
  }
}

/** Convierte una consulta en su árbol, o lanza `KqlSyntaxError`. */
export function parseKql(query: string): KqlNode {
  if (query.trim().length === 0) {
    throw new KqlSyntaxError("empty_query", "Escribe una consulta para empezar.");
  }
  return new Parser(tokenize(query)).parse();
}
