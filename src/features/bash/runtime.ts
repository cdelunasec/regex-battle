/**
 * La entrada y la salida de un comando.
 *
 * Aquí no hay flujos de verdad: un comando recibe su entrada entera y devuelve
 * su salida entera. Es una simplificación con una consecuencia que conviene
 * tener clara, porque decide qué se puede enseñar: un comando infinito como
 * `yes` o un `tail -f` no tienen sentido en esta plataforma, así que no
 * existen. Todo lo demás de un script de análisis funciona igual, porque
 * procesa archivos que terminan.
 *
 * Lo que sí hace falta modelar con cuidado es el cursor de la entrada. En
 * `while read -r linea; do ...; done < archivo` la redirección es del bucle
 * entero, pero cada vuelta consume UNA línea, así que la entrada tiene que
 * recordar por dónde iba. Sin eso, el bucle leería siempre la primera.
 */

/** Se lanza cuando un script imprime más de lo que tiene sentido sostener. */
export class OutputLimitError extends Error {
  constructor() {
    super("el script imprimió demasiado");
    this.name = "OutputLimitError";
  }
}

/** Un mega es de sobra para cualquier reto, y corta un bucle que escupe sin fin. */
export const OUTPUT_LIMIT = 1_000_000;

export class InputStream {
  private readonly text: string;
  private position = 0;

  constructor(text: string) {
    this.text = text;
  }

  /** Una línea sin su salto, o null si ya no queda nada. */
  readLine(): string | null {
    if (this.position >= this.text.length) return null;
    const newline = this.text.indexOf("\n", this.position);
    if (newline === -1) {
      const rest = this.text.slice(this.position);
      this.position = this.text.length;
      return rest;
    }
    const line = this.text.slice(this.position, newline);
    this.position = newline + 1;
    return line;
  }

  /** Todo lo que quede, que es lo que hace un `cat` o un `grep`. */
  readAll(): string {
    const rest = this.text.slice(this.position);
    this.position = this.text.length;
    return rest;
  }

  get exhausted(): boolean {
    return this.position >= this.text.length;
  }
}

export class OutputBuffer {
  private chunks: string[] = [];
  private size = 0;

  write(text: string): void {
    if (text === "") return;
    this.size += text.length;
    if (this.size > OUTPUT_LIMIT) throw new OutputLimitError();
    this.chunks.push(text);
  }

  toString(): string {
    if (this.chunks.length > 1) this.chunks = [this.chunks.join("")];
    return this.chunks[0] ?? "";
  }
}

/** Los tres cabos de un comando. */
export interface Io {
  input: InputStream;
  out: OutputBuffer;
  err: OutputBuffer;
}

export function makeIo(stdin = ""): Io {
  return { input: new InputStream(stdin), out: new OutputBuffer(), err: new OutputBuffer() };
}
