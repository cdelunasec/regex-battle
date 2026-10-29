/**
 * Huellas y codificación: `sha256sum`, `md5sum` y `base64`.
 *
 * Están escritos a mano y no con la API del navegador porque esa es asíncrona
 * y aquí todo es síncrono, y porque tienen que dar exactamente lo mismo en
 * Node, en el navegador y en Deno. Se verifican contra el `sha256sum` de la
 * máquina como todo lo demás.
 *
 * Para qué sirven en el curso: comparar el estado de un sistema contra una
 * línea base. Si el hash de un binario cambió entre ayer y hoy y nadie
 * actualizó nada, eso es justo lo que hay que mirar.
 */
import { fromLines, ok, parseArgs, readInputs, type Tool } from "./support.ts";

const encoder = new TextEncoder();

// ------------------------------------------------------------------- SHA-256

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

export function sha256(text: string): string {
  const bytes = encoder.encode(text);
  const length = bytes.length;
  // Relleno: un uno, ceros, y la longitud en bits al final, en 64 bits.
  const withPadding = new Uint8Array(((length + 9 + 63) >> 6) << 6);
  withPadding.set(bytes);
  withPadding[length] = 0x80;

  const bits = length * 8;
  const view = new DataView(withPadding.buffer);
  view.setUint32(withPadding.length - 4, bits >>> 0, false);
  view.setUint32(withPadding.length - 8, Math.floor(bits / 4294967296), false);

  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let chunk = 0; chunk < withPadding.length; chunk += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(chunk + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash as unknown as number[];

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e!, 6) ^ rotr(e!, 11) ^ rotr(e!, 25);
      const ch = (e! & f!) ^ (~e! & g!);
      const temp1 = (h! + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a!, 2) ^ rotr(a!, 13) ^ rotr(a!, 22);
      const maj = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d! + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    const round = [a!, b!, c!, d!, e!, f!, g!, h!];
    for (let i = 0; i < 8; i++) hash[i] = (hash[i]! + round[i]!) >>> 0;
  }

  return [...hash].map((value) => value.toString(16).padStart(8, "0")).join("");
}

// ----------------------------------------------------------------------- MD5

const MD5_S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_K = new Uint32Array(
  Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296)),
);

export function md5(text: string): string {
  const bytes = encoder.encode(text);
  const length = bytes.length;
  const withPadding = new Uint8Array(((length + 9 + 63) >> 6) << 6);
  withPadding.set(bytes);
  withPadding[length] = 0x80;

  const view = new DataView(withPadding.buffer);
  const bits = length * 8;
  // MD5 guarda la longitud al revés que SHA, en little endian.
  view.setUint32(withPadding.length - 8, bits >>> 0, true);
  view.setUint32(withPadding.length - 4, Math.floor(bits / 4294967296), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  for (let chunk = 0; chunk < withPadding.length; chunk += 64) {
    const m: number[] = [];
    for (let i = 0; i < 16; i++) m.push(view.getUint32(chunk + i * 4, true));

    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;

    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;

      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }

      const temp = d;
      d = c;
      c = b;
      const sum = (a + f + MD5_K[i]! + m[g]!) >>> 0;
      const shift = MD5_S[i]!;
      b = (b + ((sum << shift) | (sum >>> (32 - shift)))) >>> 0;
      a = temp;
    }

    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const little = (value: number): string =>
    [0, 8, 16, 24]
      .map((shift) => ((value >>> shift) & 0xff).toString(16).padStart(2, "0"))
      .join("");

  return little(a0) + little(b0) + little(c0) + little(d0);
}

// -------------------------------------------------------------- herramientas

function sumTool(name: string, digest: (text: string) => string): Tool {
  return (context) => {
    const parsed = parseArgs(context.args, { flags: "bc" });
    const { inputs, errors } = readInputs(context, parsed.operands, name);

    const lines = inputs.map(
      // Dos espacios entre la huella y el nombre, como GNU. El segundo marca
      // que se leyó en modo texto.
      (input) => `${digest(input.content)}  ${input.name === "-" ? "-" : input.name}`,
    );

    return errors.length > 0
      ? { stdout: fromLines(lines), stderr: errors.join("\n") + "\n", status: 1 }
      : ok(fromLines(lines));
  };
}

export const sha256sum = sumTool("sha256sum", sha256);
export const md5sum = sumTool("md5sum", md5);

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export const base64: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "di", long: { decode: "d" } });
  const { inputs, errors } = readInputs(context, parsed.operands, "base64");
  const text = inputs.map((input) => input.content).join("");

  if (parsed.flags.has("d")) {
    const clean = text.replace(/[^A-Za-z0-9+/=]/g, "");
    let bits = 0;
    let accumulator = 0;
    let out = "";

    for (const character of clean) {
      if (character === "=") break;
      const value = ALPHABET.indexOf(character);
      if (value === -1) continue;
      accumulator = (accumulator << 6) | value;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out += String.fromCharCode((accumulator >> bits) & 0xff);
      }
    }

    return errors.length > 0
      ? { stdout: out, stderr: errors.join("\n") + "\n", status: 1 }
      : ok(out);
  }

  const bytes = encoder.encode(text);
  let out = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    out += ALPHABET[a >> 2];
    out += ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out += b === undefined ? "=" : ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : ALPHABET[c & 63];
  }

  // GNU corta a 76 columnas salvo que le digan lo contrario.
  const wrapped = out.match(/.{1,76}/g) ?? [];
  return errors.length > 0
    ? { stdout: fromLines(wrapped), stderr: errors.join("\n") + "\n", status: 1 }
    : ok(fromLines(wrapped));
};

/** Para que el corrector pueda sembrar huellas sin repetir el algoritmo. */
export function digestOf(text: string): { sha256: string; md5: string } {
  return { sha256: sha256(text), md5: md5(text) };
}
