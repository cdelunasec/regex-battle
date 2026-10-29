/**
 * Las que cuentan quién eres, qué hora es y poco más.
 *
 * `sleep` no duerme: no hay concurrencia que esperar y dormir de verdad solo
 * gastaría el tope de tiempo del reto. `date` tampoco mira el reloj de la
 * máquina, mira el de la práctica, que es fijo. Las dos cosas son para que el
 * mismo script dé lo mismo hoy y dentro de un año.
 */
import { DEFAULT_HOST, DEFAULT_USER } from "../vfs.ts";
import { fromLines, ok, parseArgs, type Tool } from "./support.ts";

export const seq: Tool = (context) => {
  const numbers = context.args.filter((argument) => !argument.startsWith("-")).map(Number);
  let from = 1;
  let step = 1;
  let to = 0;

  if (numbers.length === 1) to = numbers[0]!;
  else if (numbers.length === 2) [from, to] = numbers as [number, number];
  else if (numbers.length >= 3) [from, step, to] = numbers as [number, number, number];
  else return { stdout: "", stderr: "seq: missing operand\n", status: 1 };

  if (step === 0) return { stdout: "", stderr: "seq: invalid Zero increment value\n", status: 1 };

  const out: string[] = [];
  for (let value = from; step > 0 ? value <= to : value >= to; value += step) {
    out.push(String(value));
    if (out.length > 100000) break;
  }

  return ok(fromLines(out));
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const date: Tool = (context) => {
  const parsed = parseArgs(context.args, { values: "d" });
  const when = new Date(context.shell.vfs.now);

  const pad = (value: number, size = 2): string => String(value).padStart(size, "0");
  const format = parsed.operands.find((operand) => operand.startsWith("+"));

  if (!format) {
    return ok(
      `${DAYS[when.getUTCDay()]} ${MONTHS[when.getUTCMonth()]} ${pad(when.getUTCDate())} ` +
        `${pad(when.getUTCHours())}:${pad(when.getUTCMinutes())}:${pad(when.getUTCSeconds())} UTC ` +
        `${when.getUTCFullYear()}\n`,
    );
  }

  const text = format.slice(1).replace(/%(.)/g, (whole, letter: string) => {
    switch (letter) {
      case "Y":
        return String(when.getUTCFullYear());
      case "m":
        return pad(when.getUTCMonth() + 1);
      case "d":
        return pad(when.getUTCDate());
      case "H":
        return pad(when.getUTCHours());
      case "M":
        return pad(when.getUTCMinutes());
      case "S":
        return pad(when.getUTCSeconds());
      case "F":
        return `${when.getUTCFullYear()}-${pad(when.getUTCMonth() + 1)}-${pad(when.getUTCDate())}`;
      case "T":
        return `${pad(when.getUTCHours())}:${pad(when.getUTCMinutes())}:${pad(when.getUTCSeconds())}`;
      case "s":
        return String(Math.floor(context.shell.vfs.now / 1000));
      case "%":
        return "%";
      default:
        return whole;
    }
  });

  return ok(text + "\n");
};

export const whoami: Tool = () => ok(DEFAULT_USER + "\n");

export const id: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "un" });
  if (parsed.flags.has("u") && parsed.flags.has("n")) return ok(DEFAULT_USER + "\n");
  if (parsed.flags.has("u")) return ok("1000\n");
  return ok(`uid=1000(${DEFAULT_USER}) gid=1000(${DEFAULT_USER}) groups=1000(${DEFAULT_USER})\n`);
};

export const hostname: Tool = () => ok(DEFAULT_HOST + "\n");

export const uname: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "asnrmv" });
  if (parsed.flags.has("a")) {
    return ok(`Linux ${DEFAULT_HOST} 6.1.0 #1 SMP x86_64 GNU/Linux\n`);
  }
  if (parsed.flags.has("n")) return ok(DEFAULT_HOST + "\n");
  if (parsed.flags.has("m")) return ok("x86_64\n");
  if (parsed.flags.has("r")) return ok("6.1.0\n");
  return ok("Linux\n");
};

/** No duerme. Ver la cabecera del archivo. */
export const sleep: Tool = () => ok();

export const env: Tool = (context) => {
  const lines = context.shell.exportedNames.map((name) => {
    const value = context.shell.getVariable(name);
    return `${name}=${Array.isArray(value) ? (value[0] ?? "") : (value ?? "")}`;
  });
  return ok(fromLines(lines));
};

export const yes: Tool = () => ({
  stdout: "",
  // Aquí no hay flujos: `yes` llenaría la memoria antes de que nadie lo corte.
  stderr: "yes: la plataforma no tiene comandos infinitos, no hay tuberías de verdad\n",
  status: 2,
});
