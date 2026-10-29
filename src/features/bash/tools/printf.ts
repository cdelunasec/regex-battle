/**
 * El formateo de `printf`, compartido por el builtin y por `awk`.
 *
 * Vive aparte porque los dos lo necesitan y porque `awk` no puede importar de
 * `builtins.ts` sin armar un círculo: los builtins conocen el shell, y las
 * herramientas no deben conocerlo.
 *
 * Importa más de lo que parece para el nivel alto del curso: un reporte en
 * columnas sale de `printf "%-20s %5d\n"`, no de pegar textos con espacios a
 * ojo hasta que cuadre.
 */

/** Los escapes de `echo -e` y del formato de `printf`. */
export function unescape(text: string): string {
  return text.replace(/\\(.)/g, (whole, character: string) => {
    switch (character) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      case "\\":
        return "\\";
      case "0":
        return "\0";
      case "a":
      case "b":
      case "f":
      case "v":
        return "";
      default:
        return whole;
    }
  });
}

/**
 * Aplica el formato a los argumentos.
 *
 * Si sobran argumentos el formato se repite, que es lo que hace el de verdad y
 * lo que permite `printf "%s\n" "${lista[@]}"` para sacar uno por línea.
 */
export function formatPrintf(format: string, args: string[]): string {
  const specifier = /%(-)?(0)?(\d+)?(?:\.(\d+))?([sdifxXoc%])/g;
  let out = "";
  let index = 0;

  const once = (): string =>
    format.replace(
      specifier,
      (
        whole,
        left: string | undefined,
        zero: string | undefined,
        width: string | undefined,
        precision: string | undefined,
        kind: string,
      ) => {
        if (kind === "%") return "%";
        const raw = args[index++] ?? "";
        let value: string;

        switch (kind) {
          case "d":
          case "i":
            value = String(Math.trunc(Number(raw) || 0));
            break;
          case "f":
            value = (Number(raw) || 0).toFixed(precision === undefined ? 6 : Number(precision));
            break;
          case "x":
            value = Math.trunc(Number(raw) || 0).toString(16);
            break;
          case "X":
            value = Math.trunc(Number(raw) || 0)
              .toString(16)
              .toUpperCase();
            break;
          case "o":
            value = Math.trunc(Number(raw) || 0).toString(8);
            break;
          case "c":
            value = raw.slice(0, 1);
            break;
          default:
            value = precision === undefined ? raw : raw.slice(0, Number(precision));
        }

        if (width) {
          const size = Number(width);
          if (value.length < size) {
            value = left
              ? value + " ".repeat(size - value.length)
              : (zero ? "0" : " ").repeat(size - value.length) + value;
          }
        }

        return value;
      },
    );

  out += unescape(once());
  while (index < args.length && /%[^%]/.test(format)) out += unescape(once());

  return out;
}
