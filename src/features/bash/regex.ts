/**
 * De las expresiones regulares de POSIX a las de JavaScript.
 *
 * Este archivo existe porque es donde más fácil se miente. En la terminal hay
 * tres lenguajes de patrones que se parecen y no son iguales:
 *
 *   - BRE, la de `grep` pelado y `sed`. Ahí `+ ? | ( ) { }` son LITERALES, y
 *     para que sean metacaracteres hay que escribirlos `\+ \? \| \( \) \{ \}`.
 *   - ERE, la de `grep -E`, `sed -E` y `awk`. Ahí es al revés, como uno espera.
 *   - El glob del shell, que no es una expresión regular: `*` es "lo que sea",
 *     no "el anterior repetido".
 *
 * Traducir mal cualquiera de las tres haría que la plataforma enseñe algo que
 * en una terminal de verdad no pasa, que es el peor fallo posible aquí. Por eso
 * `verify:bash` compara cada patrón contra el `grep` real de la máquina.
 *
 * Todo se traduce en ASCII, no en Unicode, porque la verificación corre con
 * `LC_ALL=C` y así las clases POSIX significan exactamente lo mismo de los dos
 * lados.
 */

export class BashRegexError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BashRegexError";
  }
}

export type RegexFlavor = "bre" | "ere";

/** Las clases POSIX, en ASCII. Lo que valen con `LC_ALL=C`. */
const POSIX_CLASSES: Record<string, string> = {
  alpha: "A-Za-z",
  digit: "0-9",
  alnum: "0-9A-Za-z",
  upper: "A-Z",
  lower: "a-z",
  space: " \\t\\n\\r\\f\\v",
  blank: " \\t",
  punct: "!-\\/:-@\\[-`{-~",
  xdigit: "0-9A-Fa-f",
  cntrl: "\\x00-\\x1f\\x7f",
  print: "\\x20-\\x7e",
  graph: "\\x21-\\x7e",
};

/** Lo que hay que escapar para que JavaScript lo lea como un carácter y ya. */
function escapeLiteral(character: string): string {
  return /[.*+?^${}()|[\]\\/]/.test(character) ? "\\" + character : character;
}

/**
 * Traduce un `[...]`, que es igual en BRE y en ERE.
 *
 * Las reglas raras de POSIX que hay que respetar: un `]` pegado al principio
 * es un corchete literal y no cierra la clase, y `[:alpha:]` solo significa
 * algo aquí dentro.
 */
function translateBracket(pattern: string, start: number): { source: string; next: number } {
  let i = start + 1;
  let out = "[";

  if (pattern[i] === "^") {
    out += "^";
    i++;
  }
  // Un `]` en primera posición es literal, no cierra nada.
  if (pattern[i] === "]") {
    out += "\\]";
    i++;
  }

  while (i < pattern.length && pattern[i] !== "]") {
    // [:alpha:] y familia.
    if (pattern.startsWith("[:", i)) {
      const end = pattern.indexOf(":]", i + 2);
      if (end === -1) throw new BashRegexError("falta cerrar una clase de caracteres [:...:]");
      const name = pattern.slice(i + 2, end);
      const expansion = POSIX_CLASSES[name];
      if (!expansion) throw new BashRegexError(`no existe la clase de caracteres [:${name}:]`);
      out += expansion;
      i = end + 2;
      continue;
    }

    // [.x.] y [=x=] son de intercalación, y aquí no hacen falta.
    if (pattern.startsWith("[.", i) || pattern.startsWith("[=", i)) {
      throw new BashRegexError("la plataforma todavía no soporta [. .] ni [= =]");
    }

    const character = pattern[i]!;
    if (character === "\\" || character === "[") out += "\\" + character;
    else out += character;
    i++;
  }

  if (i >= pattern.length) throw new BashRegexError("falta cerrar un corchete");
  return { source: out + "]", next: i + 1 };
}

/**
 * Convierte un patrón de POSIX en la fuente de una expresión de JavaScript.
 *
 * `flavor` decide de qué lado caen los metacaracteres: en BRE el `+` es un
 * signo de más y el `\+` es el cuantificador, y en ERE al revés.
 */
export function translateRegex(pattern: string, flavor: RegexFlavor): string {
  const basic = flavor === "bre";
  let out = "";
  let i = 0;

  while (i < pattern.length) {
    const character = pattern[i]!;

    if (character === "[") {
      const bracket = translateBracket(pattern, i);
      out += bracket.source;
      i = bracket.next;
      continue;
    }

    if (character === "\\") {
      const next = pattern[i + 1];
      if (next === undefined) throw new BashRegexError("el patrón termina en una barra suelta");

      // GNU añade estas a las dos variantes.
      if (next === "<" || next === ">") {
        out += "\\b";
        i += 2;
        continue;
      }
      if (
        next === "b" ||
        next === "B" ||
        next === "w" ||
        next === "W" ||
        next === "s" ||
        next === "S"
      ) {
        out += "\\" + next;
        i += 2;
        continue;
      }
      if (next >= "1" && next <= "9") {
        out += "\\" + next;
        i += 2;
        continue;
      }

      // En BRE, la barra es lo que ENCIENDE al metacarácter.
      if (basic && "+?|(){}".includes(next)) {
        out += next === "{" ? "{" : next === "}" ? "}" : next;
        i += 2;
        continue;
      }

      // En ERE, la barra lo APAGA. Y en BRE, apaga los que ya eran metacaracteres.
      out += escapeLiteral(next);
      i += 2;
      continue;
    }

    if (basic) {
      // Sin barra, estos son caracteres corrientes.
      if ("+?|(){}".includes(character)) {
        out += escapeLiteral(character);
        i++;
        continue;
      }
      // Un `*` al principio del patrón o de un grupo tampoco cuantifica nada.
      if (character === "*" && (out === "" || out.endsWith("("))) {
        out += "\\*";
        i++;
        continue;
      }
    }

    if (character === "{") {
      // Una llave que no abre un intervalo válido es un carácter más, como en GNU.
      const closing = pattern.indexOf("}", i);
      const inside = closing === -1 ? "" : pattern.slice(i + 1, closing);
      if (closing === -1 || !/^\d+(,\d*)?$/.test(inside)) {
        out += "\\{";
        i++;
        continue;
      }
    }

    out += character;
    i++;
  }

  return out;
}

export interface RegexOptions {
  flavor?: RegexFlavor;
  ignoreCase?: boolean;
  /** Para `grep -o` y para `awk`, que recorren la línea buscando de nuevo. */
  global?: boolean;
}

export function compilePosixRegex(pattern: string, options: RegexOptions = {}): RegExp {
  const source = translateRegex(pattern, options.flavor ?? "bre");
  let flags = "";
  if (options.ignoreCase) flags += "i";
  if (options.global) flags += "g";

  try {
    return new RegExp(source, flags);
  } catch {
    throw new BashRegexError(`el patrón no es válido: ${pattern}`);
  }
}

/**
 * El glob del shell: `*.log`, `informe-?.txt`, `[abc]*`.
 *
 * No es una expresión regular aunque se le parezca. Las diferencias que
 * importan: `*` es cualquier cosa y no "el anterior repetido", `?` es
 * exactamente un carácter, y un punto al principio del nombre no lo casa
 * ninguno de los dos, que es como se esconden los archivos ocultos.
 */
export function globToRegExp(
  pattern: string,
  options: { anchored?: boolean; segment?: boolean } = {},
): RegExp {
  // `segment` distingue los dos usos del glob, que NO son el mismo. Al buscar
  // archivos, el `*` de `datos/*.conf` no cruza barras porque se resuelve un
  // tramo de ruta a la vez. Al comparar texto, en `case`, en `[[ == ]]` y en
  // `${ruta##*/}`, el `*` sí se come las barras. Confundirlos hace que
  // `${archivo##*/}` devuelva media ruta en vez del nombre.
  const any = options.segment ? "[^/]*" : "[\\s\\S]*";
  const one = options.segment ? "[^/]" : "[\\s\\S]";
  let out = "";
  let i = 0;

  while (i < pattern.length) {
    const character = pattern[i]!;

    if (character === "*") {
      out += any;
      i++;
      continue;
    }
    if (character === "?") {
      out += one;
      i++;
      continue;
    }
    if (character === "[") {
      try {
        const bracket = translateBracket(pattern, i);
        out += bracket.source;
        i = bracket.next;
        continue;
      } catch {
        // Un corchete sin cerrar en un glob es un corchete y ya.
        out += "\\[";
        i++;
        continue;
      }
    }
    if (character === "\\" && i + 1 < pattern.length) {
      out += escapeLiteral(pattern[i + 1]!);
      i += 2;
      continue;
    }

    out += escapeLiteral(character);
    i++;
  }

  return new RegExp(options.anchored === false ? out : `^${out}$`);
}

/** Si un glob puede casar algo oculto. Un `*` no casa un archivo que empieza por punto. */
export function globMatches(pattern: string, name: string): boolean {
  if (name.startsWith(".") && !pattern.startsWith(".")) return false;
  return globToRegExp(pattern, { segment: true }).test(name);
}
