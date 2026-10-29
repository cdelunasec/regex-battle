/**
 * `find` y `xargs`, que es la pareja con la que se revisa un sistema entero.
 *
 * `find` no tiene banderas sino una expresión: una lista de pruebas que se van
 * encadenando con y griega implícita, y al final una acción. Por eso
 * `find /opt -type f -perm -4000 -print` se lee como una frase, y por eso el
 * parser de aquí abajo procesa argumentos en orden en vez de clasificarlos.
 *
 * `-perm` tiene tres formas y la diferencia importa para lo que se busca en
 * seguridad:
 *
 *   -perm 644    exactamente ese modo
 *   -perm -4000  que tenga AL MENOS esos bits, o sea todos los SUID
 *   -perm /022   que tenga ALGUNO, o sea lo que cualquiera puede escribir
 */
import { globToRegExp } from "../regex.ts";
import type { FileStat } from "../vfs.ts";
import { fromLines, ok, type Tool, type ToolContext } from "./support.ts";

type Test = (entry: FileStat, context: ToolContext) => boolean;

interface Expression {
  test: Test;
  /** Qué hacer con lo que pase la prueba. */
  action: "print" | "print0" | "exec" | "execPlus" | "delete";
  command?: string[];
}

class FindError extends Error {}

function permissionTest(spec: string): Test {
  if (spec.startsWith("-")) {
    const wanted = parseInt(spec.slice(1), 8);
    return (entry) => (entry.mode & wanted) === wanted;
  }
  if (spec.startsWith("/") || spec.startsWith("+")) {
    const wanted = parseInt(spec.slice(1), 8);
    return (entry) => (entry.mode & wanted) !== 0;
  }
  const exact = parseInt(spec, 8);
  return (entry) => (entry.mode & 0o7777) === exact;
}

function sizeTest(spec: string): Test {
  const match = /^([-+]?)(\d+)([ckMG]?)$/.exec(spec);
  if (!match) throw new FindError(`invalid -size argument \`${spec}'`);
  const sign = match[1];
  const amount = Number(match[2]);
  const unit = match[3] || "b";
  const multiplier =
    unit === "c"
      ? 1
      : unit === "k"
        ? 1024
        : unit === "M"
          ? 1048576
          : unit === "G"
            ? 1073741824
            : 512;
  const bytes = amount * multiplier;

  return (entry) => {
    if (sign === "+") return entry.size > bytes;
    if (sign === "-") return entry.size < bytes;
    // Sin signo, `find` redondea hacia arriba a unidades enteras.
    return Math.ceil(entry.size / multiplier) === amount;
  };
}

function timeTest(spec: string, now: number): Test {
  const match = /^([-+]?)(\d+)$/.exec(spec);
  if (!match) throw new FindError(`invalid -mtime argument \`${spec}'`);
  const sign = match[1];
  const days = Number(match[2]);
  const day = 24 * 60 * 60 * 1000;

  return (entry) => {
    const age = Math.floor((now - entry.mtime) / day);
    if (sign === "+") return age > days;
    if (sign === "-") return age < days;
    return age === days;
  };
}

function parseExpression(args: string[], context: ToolContext): Expression {
  const tests: { test: Test; negated: boolean; or: boolean }[] = [];
  let action: Expression["action"] = "print";
  let command: string[] | undefined;
  let negateNext = false;
  let orNext = false;
  let i = 0;

  const push = (test: Test): void => {
    tests.push({ test, negated: negateNext, or: orNext });
    negateNext = false;
    orNext = false;
  };

  while (i < args.length) {
    const argument = args[i]!;
    const next = (): string => {
      const value = args[++i];
      if (value === undefined) throw new FindError(`missing argument to \`${argument}'`);
      return value;
    };

    switch (argument) {
      case "!":
      case "-not":
        negateNext = true;
        break;
      case "-o":
      case "-or":
        orNext = true;
        break;
      case "-a":
      case "-and":
        break;
      case "-name": {
        const pattern = next();
        push((entry) => globToRegExp(pattern, { segment: true }).test(entry.name));
        break;
      }
      case "-iname": {
        const pattern = next().toLowerCase();
        push((entry) => globToRegExp(pattern, { segment: true }).test(entry.name.toLowerCase()));
        break;
      }
      case "-path": {
        const pattern = next();
        push((entry) => globToRegExp(pattern).test(entry.path));
        break;
      }
      case "-type": {
        const kind = next();
        push((entry) => (kind === "d" ? entry.kind === "dir" : entry.kind === "file"));
        break;
      }
      case "-perm":
        push(permissionTest(next()));
        break;
      case "-size":
        push(sizeTest(next()));
        break;
      case "-mtime":
        push(timeTest(next(), context.shell.vfs.now));
        break;
      case "-newer": {
        const other = context.shell.resolve(next());
        const when = context.shell.vfs.exists(other) ? context.shell.vfs.stat(other).mtime : 0;
        push((entry) => entry.mtime > when);
        break;
      }
      case "-user": {
        const owner = next();
        push((entry) => entry.owner === owner);
        break;
      }
      case "-group": {
        const group = next();
        push((entry) => entry.group === group);
        break;
      }
      case "-empty":
        push((entry) => entry.size === 0 || (entry.kind === "dir" && entry.size === 4096));
        break;
      case "-print":
        action = "print";
        break;
      case "-print0":
        action = "print0";
        break;
      case "-delete":
        action = "delete";
        break;
      case "-exec": {
        command = [];
        i++;
        while (i < args.length && args[i] !== ";" && args[i] !== "+") command.push(args[i++]!);
        action = args[i] === "+" ? "execPlus" : "exec";
        break;
      }
      default:
        if (argument.startsWith("-")) throw new FindError(`unknown predicate \`${argument}'`);
    }

    i++;
  }

  const test: Test = (entry, toolContext) => {
    let result: boolean | null = null;

    for (const item of tests) {
      const value = item.negated ? !item.test(entry, toolContext) : item.test(entry, toolContext);
      if (result === null) result = value;
      else if (item.or) result = result || value;
      else result = result && value;
    }

    return result ?? true;
  };

  return command ? { test, action, command } : { test, action };
}

export const find: Tool = (context) => {
  const args = [...context.args];
  const roots: string[] = [];
  let maxDepth = Infinity;
  let minDepth = 0;

  while (args.length > 0 && !args[0]!.startsWith("-") && args[0] !== "!") {
    roots.push(args.shift()!);
  }
  if (roots.length === 0) roots.push(".");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-maxdepth") {
      maxDepth = Number(args[i + 1]);
      args.splice(i, 2);
      i--;
    } else if (args[i] === "-mindepth") {
      minDepth = Number(args[i + 1]);
      args.splice(i, 2);
      i--;
    }
  }

  let expression: Expression;
  try {
    expression = parseExpression(args, context);
  } catch (error) {
    return {
      stdout: "",
      stderr: `find: ${error instanceof Error ? error.message : "bad expression"}\n`,
      status: 2,
    };
  }

  const out: string[] = [];
  const errors: string[] = [];
  const matched: string[] = [];

  for (const root of roots) {
    const full = context.shell.resolve(root);
    if (!context.shell.vfs.exists(full)) {
      errors.push(`find: '${root}': No such file or directory`);
      continue;
    }

    for (const entry of context.shell.vfs.walk(full)) {
      // La ruta se imprime tal como se pidió, no absoluta: `find . -name x`
      // devuelve `./x`, que es lo que espera quien encadena con xargs.
      const relative =
        entry.path === full ? root : root.replace(/\/$/, "") + entry.path.slice(full.length);
      const depth = relative === root ? 0 : relative.slice(root.length).split("/").length - 1;

      if (depth > maxDepth || depth < minDepth) continue;
      if (!expression.test(entry, context)) continue;

      matched.push(relative);

      if (expression.action === "print") out.push(relative);
      else if (expression.action === "print0") out.push(relative);
      else if (expression.action === "delete") {
        try {
          context.shell.vfs.remove(entry.path, { recursive: true });
        } catch {
          errors.push(`find: cannot delete '${relative}'`);
        }
      }
    }
  }

  if (expression.action === "exec" && expression.command) {
    let stdout = "";
    for (const path of matched) {
      const argv = expression.command.map((piece) => (piece === "{}" ? path : piece));
      const result = context.shell.runCommand(argv, "");
      stdout += result.stdout;
      if (result.stderr) errors.push(result.stderr.replace(/\n$/, ""));
    }
    return { stdout, stderr: errors.length > 0 ? errors.join("\n") + "\n" : "", status: 0 };
  }

  if (expression.action === "execPlus" && expression.command) {
    const argv = expression.command.filter((piece) => piece !== "{}").concat(matched);
    const result = context.shell.runCommand(argv, "");
    return { stdout: result.stdout, stderr: result.stderr, status: result.status };
  }

  const text =
    expression.action === "print0" ? out.map((line) => line + "\0").join("") : fromLines(out);

  return {
    stdout: text,
    stderr: errors.length > 0 ? errors.join("\n") + "\n" : "",
    status: errors.length > 0 ? 1 : 0,
  };
};

export const xargs: Tool = (context) => {
  const args = [...context.args];
  let maxArgs = Infinity;
  let replace: string | null = null;
  let nullSeparated = false;
  let parallel = 1;

  while (args.length > 0 && args[0]!.startsWith("-")) {
    const flag = args.shift()!;
    if (flag === "-0" || flag === "--null") nullSeparated = true;
    else if (flag === "-n") maxArgs = Number(args.shift());
    else if (flag.startsWith("-n")) maxArgs = Number(flag.slice(2));
    else if (flag === "-I") replace = args.shift() ?? "{}";
    else if (flag.startsWith("-I")) replace = flag.slice(2);
    else if (flag === "-P") parallel = Number(args.shift());
    else if (flag.startsWith("-P")) parallel = Number(flag.slice(2));
    else if (flag === "-r" || flag === "--no-run-if-empty") continue;
    else break;
  }

  const command = args.length > 0 ? args : ["echo"];
  const input = context.stdin.readAll();
  const items = nullSeparated
    ? input.split("\0").filter((item) => item !== "")
    : input.split(/\s+/).filter((item) => item !== "");

  if (items.length === 0) return ok();

  // `-P` se acepta y se corre igual en orden: aquí no hay procesos de verdad,
  // así que lo único que cambiaría sería el orden de la salida, y eso haría
  // que un reto no se pudiera corregir.
  void parallel;

  let stdout = "";
  let stderr = "";
  let status = 0;

  const runWith = (batch: string[]): void => {
    const argv = replace
      ? command.map((piece) => piece.split(replace!).join(batch[0] ?? ""))
      : [...command, ...batch];
    const result = context.shell.runCommand(argv, "");
    stdout += result.stdout;
    stderr += result.stderr;
    if (result.status !== 0) status = result.status;
  };

  if (replace) {
    for (const item of items) runWith([item]);
  } else if (maxArgs === Infinity) {
    runWith(items);
  } else {
    for (let i = 0; i < items.length; i += maxArgs) runWith(items.slice(i, i + maxArgs));
  }

  return { stdout, stderr, status };
};
