// GENERATED FILE. Edit src/engine and run `npm run sync:engine`.
/**
 * El corrector de KQL: qué significa que un documento pase el filtro.
 *
 * El caso de prueba de un reto de KQL es un log escrito en JSON, y la consulta
 * decide si entra o no. Eso deja el modelo de datos intacto: `must_match` y
 * `must_not_match` siguen siendo listas de texto, como en regex, solo que aquí
 * ese texto es un documento.
 *
 * Kibana de verdad depende de cómo esté analizado cada campo en el índice, y
 * eso no se puede imitar sin un Elasticsearch detrás. Aquí las reglas se fijan
 * y se documentan, que es lo que hace falta para corregir un reto:
 *
 *   - Las comparaciones de texto no distinguen mayúsculas de minúsculas.
 *   - Un campo con lista encaja si encaja cualquiera de sus elementos.
 *   - `campo:*` pregunta si el campo existe y no es nulo.
 *   - Un término sin campo se busca en todos los valores del documento.
 *   - Los rangos comparan como número cuando los dos lados lo son, y si no,
 *     como texto, que es lo que hace falta para fechas en formato ISO.
 */
import { parseKql, KqlSyntaxError, type KqlNode, type KqlValue } from "./kql-parse.ts";
import type { CompiledPattern, EvaluationError, MatchMode, MatcherEngine } from "./types.ts";

export const KQL_MAX_LENGTH = 300;

/** Caracteres con significado en una expresión regular, que hay que neutralizar. */
const REGEXP_SPECIAL = new Set([
  ".",
  "*",
  "+",
  "?",
  "^",
  "$",
  "{",
  "}",
  "(",
  ")",
  "|",
  "[",
  "]",
  "\\",
  "/",
]);

/** Recorre un documento por una ruta con puntos y devuelve todo lo que encuentra. */
function collect(document: unknown, path: string[]): unknown[] {
  // Al final de la ruta, una lista se abre en sus elementos. Si se devolviera
  // la lista entera, `tags:ssh` compararia contra "ssh,auth" y no encajaria
  // nunca, que es justo lo que hace un campo multivaluado en Elastic.
  if (path.length === 0) {
    return Array.isArray(document) ? document.flatMap((item) => collect(item, [])) : [document];
  }

  const [head, ...rest] = path;
  if (Array.isArray(document)) {
    return document.flatMap((item) => collect(item, path));
  }
  if (document === null || typeof document !== "object") return [];

  const record = document as Record<string, unknown>;
  if (!(head! in record)) return [];
  return collect(record[head!], rest);
}

/** Todos los valores hoja de un documento, para los términos sin campo. */
function leaves(document: unknown): unknown[] {
  if (document === null || document === undefined) return [];
  if (Array.isArray(document)) return document.flatMap(leaves);
  if (typeof document === "object") {
    return Object.values(document as Record<string, unknown>).flatMap(leaves);
  }
  return [document];
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : String(value);
}

function escapeForRegExp(text: string): string {
  let escaped = "";
  for (const character of text) {
    escaped += REGEXP_SPECIAL.has(character) ? "\\" + character : character;
  }
  return escaped;
}

/**
 * Un comodín `*` se traduce a expresión regular.
 *
 * Se parte por el asterisco y se escapa cada trozo por separado, en vez de
 * escapar todo y desandar el asterisco después: así un valor con puntos, que
 * en logs son casi todos, no se lleva sorpresas.
 */
function wildcardToRegExp(pattern: string): RegExp {
  const source = pattern.split("*").map(escapeForRegExp).join(".*");
  return new RegExp("^" + source + "$", "i");
}

function matchesValue(leaf: unknown, value: KqlValue): boolean {
  if (leaf === null || leaf === undefined) return false;

  // Sin comillas, un asterisco es comodín. Entre comillas es un asterisco.
  if (!value.quoted && value.text.includes("*")) {
    if (value.text === "*") return true;
    return wildcardToRegExp(value.text).test(asText(leaf));
  }

  if (typeof leaf === "number") {
    const asNumber = Number(value.text);
    if (!Number.isNaN(asNumber) && value.text.trim() !== "") return leaf === asNumber;
    return false;
  }

  if (typeof leaf === "boolean") {
    return value.text.toLowerCase() === String(leaf);
  }

  return asText(leaf).toLowerCase() === value.text.toLowerCase();
}

type RangeOperator = ">" | ">=" | "<" | "<=";

function compare(leaf: unknown, value: KqlValue, operator: RangeOperator): boolean {
  if (leaf === null || leaf === undefined) return false;

  const leafText = asText(leaf);
  const leafNumber = typeof leaf === "number" ? leaf : Number(leafText);
  const valueNumber = Number(value.text);
  const numeric =
    !Number.isNaN(leafNumber) &&
    !Number.isNaN(valueNumber) &&
    leafText.trim() !== "" &&
    value.text.trim() !== "";

  const left: number | string = numeric ? leafNumber : leafText;
  const right: number | string = numeric ? valueNumber : value.text;

  switch (operator) {
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
  }
}

function evaluateNode(node: KqlNode, document: unknown): boolean {
  switch (node.type) {
    case "and":
      return evaluateNode(node.left, document) && evaluateNode(node.right, document);
    case "or":
      return evaluateNode(node.left, document) || evaluateNode(node.right, document);
    case "not":
      return !evaluateNode(node.node, document);

    case "term": {
      const value = node.value;
      return leaves(document).some((leaf) => matchesValue(leaf, value));
    }

    case "field": {
      const found = collect(document, node.field.split("."));
      const present = found.filter((leaf) => leaf !== null && leaf !== undefined);

      const test = (value: KqlValue): boolean => {
        if (node.operator === ":") {
          // `campo:*` es la pregunta por la existencia, no una comparación.
          if (!value.quoted && value.text === "*") return present.length > 0;
          return present.some((leaf) => matchesValue(leaf, value));
        }
        const operator = node.operator as RangeOperator;
        return present.some((leaf) => compare(leaf, value, operator));
      };

      return node.joiner === "and" ? node.values.every(test) : node.values.some(test);
    }
  }
}

/**
 * Rechaza lo que no vale la pena ni intentar compilar.
 *
 * Es mucho más corto que el de regex porque KQL no tiene retroceso: no hay
 * forma de escribir una consulta que cuelgue el motor, solo una demasiado
 * larga o demasiado anidada, y de lo segundo se encarga el analizador.
 */
export function guardKql(query: string): EvaluationError | null {
  if (query.trim().length === 0) {
    return { kind: "guard", code: "empty_query", message: "Escribe una consulta para empezar." };
  }
  if (query.length > KQL_MAX_LENGTH) {
    return {
      kind: "guard",
      code: "query_too_long",
      message: `La consulta no puede pasar de ${KQL_MAX_LENGTH} caracteres.`,
    };
  }
  return null;
}

/**
 * El caso de prueba tiene que ser un documento JSON. Si no lo es, el reto está
 * mal sembrado, así que se trata como un documento vacío en vez de reventar:
 * el jugador vería un error que no es suyo.
 */
function parseDocument(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return {};
  }
}

export const kqlMatcherEngine: MatcherEngine = {
  guard: guardKql,

  // KQL no tiene modo parcial ni completo: un filtro deja pasar el documento o
  // no. El parámetro se acepta para cumplir la interfaz y se ignora aposta.
  compile(query: string, _mode: MatchMode): CompiledPattern {
    let tree: KqlNode;
    try {
      tree = parseKql(query);
    } catch (cause) {
      if (cause instanceof KqlSyntaxError) throw cause;
      throw new KqlSyntaxError("invalid_query", "La consulta no es válida.");
    }

    return (input: string) => evaluateNode(tree, parseDocument(input));
  },
};
