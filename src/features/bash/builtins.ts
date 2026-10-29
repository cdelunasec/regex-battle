/**
 * Los comandos que vienen dentro del shell.
 *
 * La diferencia con una herramienta de `tools/` no es de importancia sino de
 * poder: un builtin puede cambiar el shell que lo llamó. `cd` mueve el
 * directorio, `read` deja una variable puesta y `exit` termina el script, y
 * nada de eso lo podría hacer un programa aparte, que solo recibe texto y
 * devuelve texto. Por eso `cd` es un builtin en bash de verdad también.
 *
 * Los mensajes de error van en inglés y con el formato de bash, porque
 * `verify:bash` los compara contra el bash de la máquina.
 */
import { arithToString, BashArithError, evaluateArith } from "./arith.ts";
import { expandToSingle } from "./expand.ts";
import type { Shell } from "./interp.ts";
import { BreakSignal, ContinueSignal, ExitSignal, ReturnSignal } from "./interp.ts";
import { parse } from "./parser.ts";
import { formatPrintf, unescape } from "./tools/printf.ts";
import type { Io } from "./runtime.ts";
import { VfsError, basenameOf } from "./vfs.ts";

export type Builtin = (shell: Shell, args: string[], io: Io) => number;

/** El `test` de toda la vida, que es el mismo que `[ ]`. */
function evaluateTest(shell: Shell, args: string[]): boolean {
  if (args.length === 0) return false;
  if (args.length === 1) return args[0] !== "";

  if (args[0] === "!") return !evaluateTest(shell, args.slice(1));

  if (args.length === 2) {
    return shell.testUnary(args[0]!, args[1]!);
  }

  // Los enlaces con -a y -o van antes que la comparación.
  const andAt = args.indexOf("-a");
  if (andAt > 0) {
    return evaluateTest(shell, args.slice(0, andAt)) && evaluateTest(shell, args.slice(andAt + 1));
  }
  const orAt = args.indexOf("-o");
  if (orAt > 0) {
    return evaluateTest(shell, args.slice(0, orAt)) || evaluateTest(shell, args.slice(orAt + 1));
  }

  if (args.length === 3) {
    const [left, operator, right] = args as [string, string, string];
    switch (operator) {
      case "=":
      case "==":
        return left === right;
      case "!=":
        return left !== right;
      case "<":
        return left < right;
      case ">":
        return left > right;
      case "-eq":
      case "-ne":
      case "-lt":
      case "-le":
      case "-gt":
      case "-ge": {
        const a = Number(left) || 0;
        const b = Number(right) || 0;
        if (operator === "-eq") return a === b;
        if (operator === "-ne") return a !== b;
        if (operator === "-lt") return a < b;
        if (operator === "-le") return a <= b;
        if (operator === "-gt") return a > b;
        return a >= b;
      }
      case "-nt":
      case "-ot": {
        const leftPath = shell.resolve(left);
        const rightPath = shell.resolve(right);
        const leftTime = shell.vfs.exists(leftPath) ? shell.vfs.stat(leftPath).mtime : -1;
        const rightTime = shell.vfs.exists(rightPath) ? shell.vfs.stat(rightPath).mtime : -1;
        return operator === "-nt" ? leftTime > rightTime : leftTime < rightTime;
      }
      default:
        return false;
    }
  }

  return false;
}

/** Parte una línea como lo haría el shell, para `read`. */
function splitByIfs(line: string, ifs: string, limit: number): string[] {
  if (ifs === "") return [line];
  const whitespace = [...ifs].filter((character) => " \t\n".includes(character));
  const others = [...ifs].filter((character) => !" \t\n".includes(character));

  const fields: string[] = [];
  let current = "";
  let i = 0;

  const trimStart = (): void => {
    while (i < line.length && whitespace.includes(line[i]!)) i++;
  };

  trimStart();

  while (i < line.length) {
    // A la última variable le toca el resto entero, espacios de dentro incluidos.
    if (limit > 0 && fields.length === limit - 1) {
      let rest = line.slice(i);
      while (rest.length > 0 && whitespace.includes(rest[rest.length - 1]!))
        rest = rest.slice(0, -1);
      fields.push(rest);
      return fields;
    }

    const character = line[i]!;
    if (whitespace.includes(character)) {
      fields.push(current);
      current = "";
      trimStart();
      continue;
    }
    if (others.includes(character)) {
      fields.push(current);
      current = "";
      i++;
      continue;
    }

    current += character;
    i++;
  }

  if (current !== "") fields.push(current);
  return fields;
}

export const BUILTINS: Record<string, Builtin> = {
  ":": () => 0,
  true: () => 0,
  false: () => 1,

  echo: (_shell, args, io) => {
    let newline = true;
    let escapes = false;
    let index = 0;

    while (index < args.length && /^-[neE]+$/.test(args[index]!)) {
      const flags = args[index]!.slice(1);
      if (flags.includes("n")) newline = false;
      if (flags.includes("e")) escapes = true;
      if (flags.includes("E")) escapes = false;
      index++;
    }

    const text = args.slice(index).join(" ");
    io.out.write((escapes ? unescape(text) : text) + (newline ? "\n" : ""));
    return 0;
  },

  printf: (_shell, args, io) => {
    if (args.length === 0) return 0;
    io.out.write(formatPrintf(args[0]!, args.slice(1)));
    return 0;
  },

  pwd: (shell, _args, io) => {
    io.out.write(shell.cwd + "\n");
    return 0;
  },

  cd: (shell, args, io) => {
    const previous = shell.cwd;
    const target =
      args[0] === "-" ? (shell.getVariable("OLDPWD") as string) : (args[0] ?? shell.home);
    const path = shell.resolve(target);

    if (!shell.vfs.exists(path)) {
      io.err.write(`cd: ${target}: No such file or directory\n`);
      return 1;
    }
    if (!shell.vfs.isDir(path)) {
      io.err.write(`cd: ${target}: Not a directory\n`);
      return 1;
    }

    shell.cwd = path;
    shell.setVariable("OLDPWD", previous);
    shell.setVariable("PWD", path);
    return 0;
  },

  export: (shell, args) => {
    for (const argument of args) {
      const equals = argument.indexOf("=");
      if (equals === -1) {
        shell.markExported(argument);
        continue;
      }
      const name = argument.slice(0, equals);
      shell.setVariable(name, argument.slice(equals + 1));
      shell.markExported(name);
    }
    return 0;
  },

  unset: (shell, args) => {
    for (const name of args) shell.unsetVariable(name);
    return 0;
  },

  local: (shell, args, io) => {
    if (!shell.inFunction) {
      io.err.write("local: can only be used in a function\n");
      return 1;
    }
    for (const argument of args) {
      const equals = argument.indexOf("=");
      if (equals === -1) {
        shell.declareLocal(argument, "");
        continue;
      }
      shell.declareLocal(argument.slice(0, equals), argument.slice(equals + 1));
    }
    return 0;
  },

  declare: (shell, args) => {
    // Lo justo para que `declare -a` y `declare -A` no revienten un script.
    for (const argument of args) {
      if (argument.startsWith("-")) continue;
      const equals = argument.indexOf("=");
      if (equals === -1) {
        if (shell.getVariable(argument) === undefined) shell.setVariable(argument, "");
        continue;
      }
      shell.setVariable(argument.slice(0, equals), argument.slice(equals + 1));
    }
    return 0;
  },

  read: (shell, args, io) => {
    let raw = false;
    let arrayName: string | null = null;
    const names: string[] = [];
    let index = 0;

    while (index < args.length) {
      const argument = args[index]!;
      if (argument === "-r") {
        raw = true;
        index++;
        continue;
      }
      if (argument === "-a") {
        arrayName = args[index + 1] ?? "REPLY";
        index += 2;
        continue;
      }
      if (argument === "-p") {
        io.err.write(args[index + 1] ?? "");
        index += 2;
        continue;
      }
      if (argument.startsWith("-")) {
        index++;
        continue;
      }
      names.push(argument);
      index++;
    }

    const line = io.input.readLine();
    if (line === null) return 1;
    const text = raw ? line : line.replace(/\\(.)/g, "$1");

    if (arrayName) {
      shell.setVariable(arrayName, splitByIfs(text, shell.ifs, 0));
      return 0;
    }

    if (names.length === 0) {
      shell.setVariable("REPLY", text);
      return 0;
    }

    const fields = splitByIfs(text, shell.ifs, names.length);
    names.forEach((name, position) => shell.setVariable(name, fields[position] ?? ""));
    return 0;
  },

  shift: (shell, args) => {
    const count = args[0] ? Number(args[0]) : 1;
    if (count > shell.positional.length) return 1;
    shell.positional = shell.positional.slice(count);
    return 0;
  },

  test: (shell, args) => (evaluateTest(shell, args) ? 0 : 1),

  "[": (shell, args, io) => {
    if (args[args.length - 1] !== "]") {
      io.err.write("[: missing `]'\n");
      return 2;
    }
    return evaluateTest(shell, args.slice(0, -1)) ? 0 : 1;
  },

  exit: (shell, args) => {
    throw new ExitSignal(args[0] ? Number(args[0]) : shell.status);
  },

  return: (shell, args) => {
    throw new ReturnSignal(args[0] ? Number(args[0]) : shell.status);
  },

  break: (_shell, args) => {
    throw new BreakSignal(args[0] ? Number(args[0]) : 1);
  },

  continue: (_shell, args) => {
    throw new ContinueSignal(args[0] ? Number(args[0]) : 1);
  },

  set: (shell, args) => {
    let index = 0;

    while (index < args.length) {
      const argument = args[index]!;

      if (argument === "--") {
        shell.positional = args.slice(index + 1);
        return 0;
      }

      if (argument === "-o" || argument === "+o") {
        const name = args[index + 1];
        const value = argument === "-o";
        if (name === "pipefail") shell.options.pipefail = value;
        if (name === "errexit") shell.options.errexit = value;
        if (name === "nounset") shell.options.nounset = value;
        index += 2;
        continue;
      }

      if (argument.startsWith("-") || argument.startsWith("+")) {
        const value = argument.startsWith("-");
        for (const flag of argument.slice(1)) {
          if (flag === "e") shell.options.errexit = value;
          if (flag === "u") shell.options.nounset = value;
          if (flag === "x") {
            // `set -x` se acepta y no hace nada: sin terminal de verdad, la
            // traza confundiría más de lo que ayuda.
          }
        }
        index++;
        continue;
      }

      shell.positional = args.slice(index);
      return 0;
    }

    return 0;
  },

  trap: (shell, args) => {
    const handler = args[0];
    const signals = args.slice(1);
    if (handler === undefined) return 0;

    for (const signal of signals) {
      if (handler === "-" || handler === "") shell.traps.delete(signal);
      else shell.traps.set(signal, handler);
    }
    return 0;
  },

  eval: (shell, args, io) => {
    const source = args.join(" ");
    if (source.trim() === "") return 0;
    return shell.exec(parse(source), io);
  },

  source: (shell, args, io) => sourceFile(shell, args, io),
  ".": (shell, args, io) => sourceFile(shell, args, io),

  let: (shell, args, io) => {
    let last = 0n;
    try {
      for (const expression of args) {
        last = evaluateArith(expression, {
          get: (name) => {
            const value = shell.getVariable(name);
            return Array.isArray(value) ? value[0] : value;
          },
          set: (name, value) => shell.setVariable(name, value),
        });
      }
    } catch (error) {
      if (error instanceof BashArithError) {
        io.err.write(`let: ${error.message}\n`);
        return 1;
      }
      throw error;
    }
    return last === 0n ? 1 : 0;
  },

  getopts: (shell, args, io) => {
    const optstring = args[0] ?? "";
    const name = args[1] ?? "opt";
    const silent = optstring.startsWith(":");
    const spec = silent ? optstring.slice(1) : optstring;
    const argv = args.length > 2 ? args.slice(2) : shell.positional;

    let optind = Number(shell.getVariable("OPTIND") ?? "1");
    let charIndex = Number(shell.getVariable("__OPTCHAR") ?? "1");

    const current = argv[optind - 1];
    if (current === undefined || !current.startsWith("-") || current === "-") {
      shell.setVariable("OPTIND", String(optind));
      shell.setVariable("__OPTCHAR", "1");
      return 1;
    }
    if (current === "--") {
      shell.setVariable("OPTIND", String(optind + 1));
      return 1;
    }

    const letter = current[charIndex];
    if (letter === undefined) {
      shell.setVariable("OPTIND", String(optind + 1));
      shell.setVariable("__OPTCHAR", "1");
      return BUILTINS["getopts"]!(shell, args, io);
    }

    const position = spec.indexOf(letter);
    if (position === -1) {
      shell.setVariable(name, "?");
      shell.setVariable("OPTARG", silent ? letter : "");
      if (!silent) io.err.write(`${shell.scriptName}: illegal option -- ${letter}\n`);
      charIndex++;
      if (charIndex >= current.length) {
        optind++;
        charIndex = 1;
      }
      shell.setVariable("OPTIND", String(optind));
      shell.setVariable("__OPTCHAR", String(charIndex));
      return 0;
    }

    const wantsValue = spec[position + 1] === ":";
    charIndex++;

    if (wantsValue) {
      let value: string;
      if (charIndex < current.length) {
        value = current.slice(charIndex);
        optind++;
      } else {
        value = argv[optind] ?? "";
        optind += 2;
        if (value === "") {
          shell.setVariable(name, silent ? ":" : "?");
          shell.setVariable("OPTARG", letter);
          if (!silent) {
            io.err.write(`${shell.scriptName}: option requires an argument -- ${letter}\n`);
          }
          shell.setVariable("OPTIND", String(optind));
          shell.setVariable("__OPTCHAR", "1");
          return 0;
        }
      }
      shell.setVariable(name, letter);
      shell.setVariable("OPTARG", value);
      shell.setVariable("OPTIND", String(optind));
      shell.setVariable("__OPTCHAR", "1");
      return 0;
    }

    shell.setVariable(name, letter);
    shell.setVariable("OPTARG", "");
    if (charIndex >= current.length) {
      optind++;
      charIndex = 1;
    }
    shell.setVariable("OPTIND", String(optind));
    shell.setVariable("__OPTCHAR", String(charIndex));
    return 0;
  },
};

function sourceFile(shell: Shell, args: string[], io: Io): number {
  const path = args[0];
  if (!path) {
    io.err.write("source: filename argument required\n");
    return 2;
  }

  const full = shell.resolve(path);
  try {
    const source = shell.vfs.readFile(full);
    const saved = shell.positional;
    if (args.length > 1) shell.positional = args.slice(1);
    try {
      return shell.exec(parse(source), io);
    } finally {
      shell.positional = saved;
    }
  } catch (error) {
    if (error instanceof VfsError) {
      io.err.write(`source: ${basenameOf(path)}: No such file or directory\n`);
      return 1;
    }
    if (error instanceof ReturnSignal) return error.status;
    throw error;
  }
}
