/**
 * Comparar lo que imprimió un programa con lo que tenía que imprimir.
 *
 * Vive fuera de C# y de Bash porque el problema es el mismo en los dos, y
 * porque señalar DÓNDE falla la salida es lo que hace que el jugador aprenda en
 * vez de quedarse mirando dos bloques de texto casi iguales. Una `L` cambiada
 * por una `l` es invisible a ojo, y buscarla a mano no enseña nada.
 */

/**
 * Deja la salida lista para comparar.
 *
 * Lo que se perdona es lo que no se ve: espacios al final de una línea, saltos
 * de línea al final del todo, y la diferencia entre el salto de Windows y el
 * de los demás. Fallar un reto por un espacio invisible no enseña nada.
 *
 * Lo que NO se perdona es la sangría al principio de la línea, porque en un
 * ejercicio de dibujar una pirámide con asteriscos es justo lo que se evalúa.
 */
export function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}

/** Dónde está la primera diferencia entre lo esperado y lo que salió. */
export interface OutputDifference {
  /** Desde 1, como se cuentan las líneas en el editor. */
  line: number;
  /** Desde 1. */
  column: number;
  /** Ya contado en español, listo para pintar. */
  message: string;
}

/** Cómo se nombra un carácter cuando hay que señalarlo en una frase. */
function nameChar(character: string | undefined): string {
  if (character === undefined) return "nada";
  if (character === " ") return "un espacio";
  if (character === "\t") return "un tabulador";
  return `"${character}"`;
}

/**
 * Encuentra la primera diferencia y la cuenta.
 *
 * Existe porque enseñar las dos salidas una al lado de la otra no alcanza: una
 * `L` cambiada por una `l` es invisible a ojo, y quien la busca no aprende
 * nada buscándola. Esto dice la línea, la posición y qué se esperaba ahí.
 *
 * Compara sobre el texto ya normalizado, el mismo que decide si el caso pasa,
 * para no señalar una diferencia que al corrector le da igual.
 */
export function describeDifference(expected: string, actual: string): OutputDifference | null {
  const esperado = normalizeOutput(expected);
  const salida = normalizeOutput(actual);
  if (esperado === salida) return null;

  const lineasEsperadas = esperado.split("\n");
  const lineasSalida = salida.split("\n");

  for (let index = 0; index < Math.max(lineasEsperadas.length, lineasSalida.length); index++) {
    const linea = index + 1;
    const esperada = lineasEsperadas[index];
    const tuya = lineasSalida[index];
    if (esperada === tuya) continue;

    if (esperada === undefined) {
      return {
        line: linea,
        column: 1,
        message: `Tu programa imprimió una línea de más, la ${linea}. Se esperaban ${lineasEsperadas.length} ${lineasEsperadas.length === 1 ? "línea" : "líneas"} en total.`,
      };
    }
    if (tuya === undefined) {
      return {
        line: linea,
        column: 1,
        message: `Falta la línea ${linea}: se esperaba "${esperada}" y tu programa no imprimió nada ahí.`,
      };
    }

    let columna = 0;
    while (
      columna < esperada.length &&
      columna < tuya.length &&
      esperada[columna] === tuya[columna]
    ) {
      columna++;
    }

    const esperadoChar = esperada[columna];
    const tuyoChar = tuya[columna];
    const donde = `En la línea ${linea}, posición ${columna + 1}`;

    if (tuyoChar === undefined) {
      return {
        line: linea,
        column: columna + 1,
        message: `${donde}: a tu línea le falta el final. Se esperaba ${nameChar(esperadoChar)} y ahí se acabó.`,
      };
    }
    if (esperadoChar === undefined) {
      return {
        line: linea,
        column: columna + 1,
        message: `${donde}: tu línea sigue cuando ya debía terminar. Sobra ${nameChar(tuyoChar)}.`,
      };
    }
    if (esperadoChar.toLowerCase() === tuyoChar.toLowerCase()) {
      const esperaMayuscula = esperadoChar === esperadoChar.toUpperCase();
      return {
        line: linea,
        column: columna + 1,
        message: `${donde}: es la misma letra pero con otra caja. Se esperaba "${esperadoChar}" ${esperaMayuscula ? "en mayúscula" : "en minúscula"} y tu programa imprimió "${tuyoChar}".`,
      };
    }

    return {
      line: linea,
      column: columna + 1,
      message: `${donde}: se esperaba ${nameChar(esperadoChar)} y tu programa imprimió ${nameChar(tuyoChar)}.`,
    };
  }

  return null;
}
