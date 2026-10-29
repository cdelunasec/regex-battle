/**
 * El intérprete: recorrer el árbol y hacer que pasen cosas.
 *
 * Tres decisiones de fondo, que son las que explican todo lo demás:
 *
 * 1. El control de flujo viaja como excepción. `break`, `continue`, `return` y
 *    `exit` pueden saltar desde dentro de una función metida en un bucle
 *    metido en otro, y devolver un código especial por cada capa se volvería
 *    imposible de seguir.
 *
 * 2. Hay un presupuesto de pasos compartido por el script entero, subshells
 *    incluidos. Un bucle sin fin no se puede parar desde dentro, y en el
 *    navegador tampoco hay a quién pedirle que mate el proceso, así que el
 *    intérprete se mata solo. Va por pasos y no solo por reloj para que el
 *    resultado sea el mismo en una máquina lenta que en una rápida, que es lo
 *    que permite verificar en Node lo que va a pasar en el navegador.
 *
 * 3. `set -e` se desactiva mientras se evalúa una condición. Es la regla que
 *    más confunde de bash: un `grep` que no encuentra nada dentro de un `if`
 *    no corta el script, pero suelto sí. Se lleva con un contador de
 *    profundidad en vez de con una bandera, porque las condiciones se anidan.
 */
import type { Command, CondExpr, Redirect, SimpleCommand } from "./ast.ts";
import { arithToString, BashArithError, evaluateArith } from "./arith.ts";
import { BUILTINS } from "./builtins.ts";
import {
  BashExpansionError,
  expandArithSource,
  expandToPattern,
  expandToSingle,
  expandWords,
  type ExpansionHost,
} from "./expand.ts";
import { BashSyntaxError, BashUnsupportedError } from "./lexer.ts";
import { parse } from "./parser.ts";
import type { BashRunRequest, BashRunResult } from "./protocol.ts";
import { compilePosixRegex, globToRegExp } from "./regex.ts";
import { InputStream, OutputBuffer, OutputLimitError, type Io } from "./runtime.ts";
import { TOOLS } from "./tools/index.ts";
import {
  DEFAULT_HOME,
  DEFAULT_HOST,
  DEV_NULL,
  DEFAULT_NOW,
  DEFAULT_USER,
  Vfs,
  VfsError,
  joinPath,
  normalizePath,
  type VfsSeed,
} from "./vfs.ts";

export class BreakSignal {
  readonly levels: number;

  constructor(levels: number) {
    this.levels = levels;
  }
}

export class ContinueSignal {
  readonly levels: number;

  constructor(levels: number) {
    this.levels = levels;
  }
}

export class ReturnSignal {
  readonly status: number;

  constructor(status: number) {
    this.status = status;
  }
}

export class ExitSignal {
  readonly status: number;

  constructor(status: number) {
    this.status = status;
  }
}

export class BudgetError extends Error {
  constructor() {
    super("el script tardó demasiado o se quedó dando vueltas");
    this.name = "BudgetError";
  }
}

/** El tope compartido por el script y por todo lo que arranque. */
class Budget {
  steps = 0;
  private checkedAt = 0;

  readonly maxSteps: number;
  readonly deadline: number;

  constructor(maxSteps: number, deadline: number) {
    this.maxSteps = maxSteps;
    this.deadline = deadline;
  }

  spend(): void {
    this.steps++;
    if (this.steps > this.maxSteps) throw new BudgetError();
    // El reloj se mira de tanto en tanto: pedirlo en cada paso cuesta más que
    // el paso mismo.
    if (this.steps - this.checkedAt >= 2000) {
      this.checkedAt = this.steps;
      if (Date.now() > this.deadline) throw new BudgetError();
    }
  }
}

export interface ShellOptions {
  errexit: boolean;
  nounset: boolean;
  pipefail: boolean;
}

export interface ShellSetup {
  files?: VfsSeed;
  args?: string[];
  scriptName?: string;
  cwd?: string;
  now?: number;
  maxSteps?: number;
  timeoutMs?: number;
}

type RedirectTarget =
  { kind: "parentOut" } | { kind: "parentErr" } | { kind: "file"; path: string; append: boolean };

export class Shell {
  readonly vfs: Vfs;
  cwd: string;
  positional: string[];
  scriptName: string;
  status = 0;
  readonly options: ShellOptions = { errexit: false, nounset: false, pipefail: false };

  private readonly globals = new Map<string, string | string[]>();
  /** Una capa por llamada a función, para que `local` tape sin borrar. */
  private readonly scopes: Map<string, string | string[]>[] = [];
  private readonly exported = new Set<string>();
  readonly functions = new Map<string, Command>();
  readonly traps = new Map<string, string>();
  private readonly budget: Budget;
  /** Mientras es mayor que cero, `set -e` no corta. Ver la cabecera. */
  private conditionDepth = 0;

  /** Pasos consumidos, para poder contarlos en el resultado. */
  get stepsUsed(): number {
    return this.budget.steps;
  }

  constructor(setup: ShellSetup = {}, budget?: Budget, vfs?: Vfs) {
    this.vfs = vfs ?? new Vfs(setup.files ?? {}, setup.now ?? DEFAULT_NOW);
    this.cwd = setup.cwd ?? DEFAULT_HOME;
    this.positional = setup.args ?? [];
    this.scriptName = setup.scriptName ?? "script.sh";
    this.budget =
      budget ?? new Budget(setup.maxSteps ?? 2_000_000, Date.now() + (setup.timeoutMs ?? 2000));

    if (!vfs) {
      if (!this.vfs.exists(DEFAULT_HOME)) this.vfs.mkdir(DEFAULT_HOME, { parents: true });
      if (!this.vfs.exists(this.cwd)) this.vfs.mkdir(this.cwd, { parents: true });
      if (!this.vfs.exists(DEV_NULL)) {
        this.vfs.mkdir("/dev", { parents: true });
        this.vfs.writeFile(DEV_NULL, "");
      }
    }

    this.globals.set("HOME", DEFAULT_HOME);
    this.globals.set("USER", DEFAULT_USER);
    this.globals.set("HOSTNAME", DEFAULT_HOST);
    this.globals.set("PWD", this.cwd);
    this.globals.set("IFS", " \t\n");
    this.globals.set("PATH", "/usr/local/bin:/usr/bin:/bin");
    this.globals.set("SHELL", "/bin/bash");
  }

  // ---------------------------------------------------------------- variables

  getVariable(name: string): string | string[] | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const scope = this.scopes[i]!;
      if (scope.has(name)) return scope.get(name);
    }
    return this.globals.get(name);
  }

  setVariable(name: string, value: string | string[]): void {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const scope = this.scopes[i]!;
      if (scope.has(name)) {
        scope.set(name, value);
        return;
      }
    }
    this.globals.set(name, value);
    if (name === "PWD" && typeof value === "string") this.cwd = value;
  }

  /** `local`: declara en la capa de la función, aunque exista por fuera. */
  declareLocal(name: string, value: string | string[]): void {
    const scope = this.scopes[this.scopes.length - 1];
    if (!scope) {
      this.globals.set(name, value);
      return;
    }
    scope.set(name, value);
  }

  unsetVariable(name: string): void {
    for (let i = this.scopes.length - 1; i >= 0; i--) this.scopes[i]!.delete(name);
    this.globals.delete(name);
  }

  markExported(name: string): void {
    this.exported.add(name);
  }

  get exportedNames(): string[] {
    return [...this.exported].sort();
  }

  get inFunction(): boolean {
    return this.scopes.length > 0;
  }

  get ifs(): string {
    const value = this.getVariable("IFS");
    return typeof value === "string" ? value : " \t\n";
  }

  get home(): string {
    const value = this.getVariable("HOME");
    return typeof value === "string" ? value : DEFAULT_HOME;
  }

  resolve(path: string): string {
    return path.startsWith("/") ? normalizePath(path) : joinPath(this.cwd, path);
  }

  // -------------------------------------------------------------- expansiones

  expansionHost(): ExpansionHost {
    return {
      getVariable: (name) => this.getVariable(name),
      setVariable: (name, value) => this.setVariable(name, value),
      positional: this.positional,
      scriptName: this.scriptName,
      lastStatus: this.status,
      cwd: this.cwd,
      home: this.home,
      vfs: this.vfs,
      runSubshell: (source) => this.runSubshell(source),
      nounset: this.options.nounset,
      ifs: this.ifs,
    };
  }

  /** Lo que imprime un `$(...)`, corrido en un shell aparte. */
  runSubshell(source: string): string {
    const child = this.fork();
    const io: Io = {
      input: new InputStream(""),
      out: new OutputBuffer(),
      err: new OutputBuffer(),
    };

    try {
      child.exec(parse(source), io);
    } catch (error) {
      if (error instanceof ExitSignal) {
        this.status = error.status;
      } else if (error instanceof ReturnSignal) {
        this.status = error.status;
      } else {
        throw error;
      }
    }

    // El subshell escribe sus quejas en la salida de error del padre.
    const errors = io.err.toString();
    if (errors) this.pendingErrors.push(errors);
    return io.out.toString();
  }

  /** Lo que un subshell mandó a la salida de error mientras se expandía. */
  private pendingErrors: string[] = [];

  private drainPendingErrors(io: Io): void {
    for (const text of this.pendingErrors) io.err.write(text);
    this.pendingErrors = [];
  }

  /** Un shell hijo: copia el estado, comparte los archivos y el presupuesto. */
  private fork(): Shell {
    const child = new Shell({}, this.budget, this.vfs);
    child.cwd = this.cwd;
    child.positional = [...this.positional];
    child.scriptName = this.scriptName;
    child.status = this.status;
    Object.assign(child.options, this.options);
    for (const [name, value] of this.globals) child.globals.set(name, value);
    // Las variables locales del padre se aplanan sobre las globales del hijo:
    // dentro del subshell se ven, pero ya no hay función de la que ser local.
    for (const scope of this.scopes) {
      for (const [name, value] of scope) child.globals.set(name, value);
    }
    for (const [name, body] of this.functions) child.functions.set(name, body);
    for (const name of this.exported) child.exported.add(name);
    return child;
  }

  // ------------------------------------------------------------- la ejecución

  /**
   * Corre un comando y deja su código en `$?`.
   *
   * Guardar el estado aquí y no solo en los comandos simples es lo que hace que
   * `false | true; echo $?` con `pipefail` diga lo que tiene que decir: el
   * código de una tubería es de la tubería, no del último programa que corrió
   * dentro.
   */
  exec(command: Command, io: Io): number {
    this.budget.spend();
    const status = this.execNode(command, io);
    this.status = status;
    return status;
  }

  private execNode(command: Command, io: Io): number {
    switch (command.type) {
      case "simple":
        return this.execSimple(command, io);
      case "list": {
        let status = 0;
        for (const item of command.commands) status = this.exec(item, io);
        return status;
      }
      case "pipeline":
        return this.execPipeline(command.commands, command.negated, io);
      case "andOr": {
        const left = this.inCondition(() => this.exec(command.left, io));
        this.status = left;
        if (command.op === "&&" && left !== 0) return left;
        if (command.op === "||" && left === 0) return left;
        return this.exec(command.right, io);
      }
      case "if":
        return this.withRedirects(command.redirects, io, (scoped) => {
          for (const clause of command.clauses) {
            const condition = this.inCondition(() => this.exec(clause.condition, scoped));
            if (condition === 0) return this.exec(clause.body, scoped);
          }
          return command.otherwise ? this.exec(command.otherwise, scoped) : 0;
        });
      case "while":
        return this.withRedirects(command.redirects, io, (scoped) =>
          this.execLoop(command.condition, command.body, command.until, scoped),
        );
      case "for":
        return this.withRedirects(command.redirects, io, (scoped) => {
          const items = command.items
            ? expandWords(command.items, this.expansionHost())
            : [...this.positional];
          return this.iterate(items, command.name, command.body, scoped);
        });
      case "forArith":
        return this.withRedirects(command.redirects, io, (scoped) =>
          this.execForArith(command.init, command.condition, command.step, command.body, scoped),
        );
      case "case":
        return this.withRedirects(command.redirects, io, (scoped) =>
          this.execCase(command, scoped),
        );
      case "group":
        return this.withRedirects(command.redirects, io, (scoped) =>
          this.exec(command.body, scoped),
        );
      case "subshell":
        return this.withRedirects(command.redirects, io, (scoped) => {
          const child = this.fork();
          const status = child.exec(command.body, scoped);
          return status;
        });
      case "function":
        this.functions.set(command.name, command.body);
        return 0;
      case "cond":
        return this.withRedirects(command.redirects, io, (scoped) => {
          const value = this.evalCond(command.expr, scoped);
          return value ? 0 : 1;
        });
      case "arithCommand":
        return this.withRedirects(command.redirects, io, () => {
          const value = evaluateArith(
            expandArithSource(command.source, this.expansionHost()),
            this.arithHost(),
          );
          // `(( ))` vale cero cuando la cuenta da distinto de cero. Al revés.
          return value === 0n ? 1 : 0;
        });
      default:
        return 0;
    }
  }

  private arithHost() {
    return {
      get: (name: string) => {
        const value = this.getVariable(name);
        return Array.isArray(value) ? value[0] : value;
      },
      set: (name: string, value: string) => this.setVariable(name, value),
    };
  }

  private inCondition<T>(body: () => T): T {
    this.conditionDepth++;
    try {
      return body();
    } finally {
      this.conditionDepth--;
    }
  }

  private execLoop(condition: Command, body: Command, until: boolean, io: Io): number {
    let status = 0;

    for (;;) {
      this.budget.spend();
      const test = this.inCondition(() => this.exec(condition, io));
      const enter = until ? test !== 0 : test === 0;
      if (!enter) break;

      try {
        status = this.exec(body, io);
      } catch (signal) {
        if (signal instanceof BreakSignal) {
          if (signal.levels > 1) throw new BreakSignal(signal.levels - 1);
          break;
        }
        if (signal instanceof ContinueSignal) {
          if (signal.levels > 1) throw new ContinueSignal(signal.levels - 1);
          continue;
        }
        throw signal;
      }
    }

    return status;
  }

  private iterate(items: string[], name: string, body: Command, io: Io): number {
    let status = 0;

    for (const item of items) {
      this.budget.spend();
      this.setVariable(name, item);
      try {
        status = this.exec(body, io);
      } catch (signal) {
        if (signal instanceof BreakSignal) {
          if (signal.levels > 1) throw new BreakSignal(signal.levels - 1);
          break;
        }
        if (signal instanceof ContinueSignal) {
          if (signal.levels > 1) throw new ContinueSignal(signal.levels - 1);
          continue;
        }
        throw signal;
      }
    }

    return status;
  }

  private execForArith(
    init: string,
    condition: string,
    step: string,
    body: Command,
    io: Io,
  ): number {
    let status = 0;
    const expanded = (source: string): string => expandArithSource(source, this.expansionHost());

    evaluateArith(expanded(init), this.arithHost());

    for (;;) {
      this.budget.spend();
      if (condition.trim() !== "" && evaluateArith(expanded(condition), this.arithHost()) === 0n) {
        break;
      }

      try {
        status = this.exec(body, io);
      } catch (signal) {
        if (signal instanceof BreakSignal) {
          if (signal.levels > 1) throw new BreakSignal(signal.levels - 1);
          break;
        }
        if (signal instanceof ContinueSignal) {
          if (signal.levels > 1) throw new ContinueSignal(signal.levels - 1);
        } else {
          throw signal;
        }
      }

      evaluateArith(expanded(step), this.arithHost());
    }

    return status;
  }

  private execCase(command: Extract<Command, { type: "case" }>, io: Io): number {
    const subject = expandToSingle(command.subject, this.expansionHost());

    for (const branch of command.branches) {
      for (const patternWord of branch.patterns) {
        const pattern = expandToPattern(patternWord, this.expansionHost());
        if (!globToRegExp(pattern).test(subject)) continue;
        return branch.body ? this.exec(branch.body, io) : 0;
      }
    }

    return 0;
  }

  private execPipeline(commands: Command[], negated: boolean, io: Io): number {
    let input = io.input;
    let status = 0;
    const statuses: number[] = [];

    for (const [position, command] of commands.entries()) {
      const last = position === commands.length - 1;
      const out = last ? io.out : new OutputBuffer();
      status = this.exec(command, { input, out, err: io.err });
      statuses.push(status);
      if (!last) input = new InputStream(out.toString());
    }

    if (this.options.pipefail) {
      status = statuses.find((code) => code !== 0) ?? status;
    }

    return negated ? (status === 0 ? 1 : 0) : status;
  }

  // ------------------------------------------------------------ redirecciones

  /**
   * Prepara la salida de un comando y la vuelca a donde toque al terminar.
   *
   * Se procesan en orden y por eso `cmd > f 2>&1` y `cmd 2>&1 > f` no hacen lo
   * mismo: el `2>&1` copia a dónde apunta la salida EN ESE MOMENTO, no a dónde
   * acabará apuntando.
   */
  private withRedirects(redirects: Redirect[], io: Io, body: (scoped: Io) => number): number {
    if (redirects.length === 0) {
      const status = body(io);
      this.drainPendingErrors(io);
      return status;
    }

    let outTarget: RedirectTarget = { kind: "parentOut" };
    let errTarget: RedirectTarget = { kind: "parentErr" };
    let input = io.input;

    for (const redirect of redirects) {
      const host = this.expansionHost();

      if (redirect.op === "<") {
        const path = this.resolve(expandToSingle(redirect.target!, host));
        try {
          input = new InputStream(this.vfs.readFile(path));
        } catch (error) {
          if (error instanceof VfsError) {
            io.err.write(`${this.scriptName}: ${error.message}\n`);
            return 1;
          }
          throw error;
        }
        continue;
      }

      if (redirect.op === "here-string") {
        input = new InputStream(expandToSingle(redirect.target!, host) + "\n");
        continue;
      }

      if (redirect.op === "heredoc") {
        input = new InputStream(redirect.here ? expandToSingle(redirect.here, host) : "");
        continue;
      }

      if (redirect.op === ">&" || redirect.op === "<&") {
        const text = expandToSingle(redirect.target!, host);
        const source: RedirectTarget | null =
          text === "1" ? outTarget : text === "2" ? errTarget : null;
        if (!source) {
          io.err.write(`${this.scriptName}: ${text}: Bad file descriptor\n`);
          return 1;
        }
        if ((redirect.fd ?? 1) === 2) errTarget = source;
        else outTarget = source;
        continue;
      }

      const path = this.resolve(expandToSingle(redirect.target!, host));
      const target: RedirectTarget = { kind: "file", path, append: redirect.op === ">>" };
      if ((redirect.fd ?? 1) === 2) errTarget = target;
      else outTarget = target;

      // Abrir para escribir vacía el archivo aunque el comando no imprima nada.
      if (redirect.op === ">" && path !== DEV_NULL) {
        try {
          this.vfs.writeFile(path, "");
        } catch (error) {
          if (error instanceof VfsError) {
            io.err.write(`${this.scriptName}: ${error.message}\n`);
            return 1;
          }
          throw error;
        }
      }
    }

    const out = new OutputBuffer();
    const err = new OutputBuffer();
    let status = 0;

    try {
      status = body({ input, out, err });
    } finally {
      const written = new Set<string>();
      this.flush(out.toString(), outTarget, io, written);
      this.flush(err.toString(), errTarget, io, written);
      this.drainPendingErrors(io);
    }

    return status;
  }

  private flush(text: string, target: RedirectTarget, io: Io, written: Set<string>): void {
    if (target.kind === "parentOut") {
      io.out.write(text);
      return;
    }
    if (target.kind === "parentErr") {
      io.err.write(text);
      return;
    }
    // Lo que va al agujero negro no se guarda en ningún sitio.
    if (target.path === DEV_NULL) return;

    try {
      // Cuando los dos descriptores acabaron en el mismo archivo, que es lo que
      // hace `> todo.txt 2>&1`, el segundo se añade en vez de pisar al primero.
      if (target.append || written.has(target.path)) this.vfs.appendFile(target.path, text);
      else this.vfs.writeFile(target.path, text);
      written.add(target.path);
    } catch (error) {
      if (error instanceof VfsError) io.err.write(`${this.scriptName}: ${error.message}\n`);
      else throw error;
    }
  }

  // ------------------------------------------------------------ comando suelto

  private execSimple(command: SimpleCommand, io: Io): number {
    const host = this.expansionHost();

    if (command.words.length === 0) {
      // Solo asignaciones: quedan puestas.
      for (const assignment of command.assignments) this.applyAssignment(assignment, false);
      this.drainPendingErrors(io);
      return this.finishStatus(0, io);
    }

    const argv = expandWords(command.words, host);
    this.drainPendingErrors(io);
    if (argv.length === 0) {
      for (const assignment of command.assignments) this.applyAssignment(assignment, false);
      return this.finishStatus(0, io);
    }

    // Con comando delante, las asignaciones valen solo para él.
    const saved = new Map<string, string | string[] | undefined>();
    for (const assignment of command.assignments) {
      saved.set(assignment.name, this.getVariable(assignment.name));
      this.applyAssignment(assignment, true);
    }

    try {
      return this.withRedirects(command.redirects, io, (scoped) => this.dispatch(argv, scoped));
    } finally {
      for (const [name, value] of saved) {
        if (value === undefined) this.unsetVariable(name);
        else this.setVariable(name, value);
      }
    }
  }

  private applyAssignment(
    assignment: {
      name: string;
      value: import("./ast.ts").Word;
      array?: import("./ast.ts").Word[];
      index?: import("./ast.ts").Word;
      append?: boolean;
    },
    temporary: boolean,
  ): void {
    const host = this.expansionHost();

    if (assignment.array) {
      this.setVariable(assignment.name, expandWords(assignment.array, host));
      return;
    }

    const value = expandToSingle(assignment.value, host);

    if (assignment.index) {
      const current = this.getVariable(assignment.name);
      const items = Array.isArray(current) ? [...current] : current === undefined ? [] : [current];
      const index = Number(arithToString(expandToSingle(assignment.index, host), this.arithHost()));
      items[index] = value;
      for (let i = 0; i < items.length; i++) if (items[i] === undefined) items[i] = "";
      this.setVariable(assignment.name, items);
      return;
    }

    if (assignment.append) {
      const current = this.getVariable(assignment.name);
      if (Array.isArray(current)) {
        this.setVariable(assignment.name, [...current, value]);
        return;
      }
      this.setVariable(assignment.name, (current ?? "") + value);
      return;
    }

    if (temporary) this.markExported(assignment.name);
    this.setVariable(assignment.name, value);
  }

  /** Funciones primero, luego builtins, luego herramientas. Como bash. */
  private dispatch(argv: string[], io: Io): number {
    const name = argv[0]!;

    const fn = this.functions.get(name);
    if (fn) return this.finishStatus(this.callFunction(fn, argv.slice(1), io), io);

    const builtin = BUILTINS[name];
    if (builtin) return this.finishStatus(builtin(this, argv.slice(1), io), io);

    const tool = TOOLS[name];
    if (tool) {
      const result = tool({ args: argv.slice(1), stdin: io.input, shell: this });
      io.out.write(result.stdout);
      io.err.write(result.stderr);
      return this.finishStatus(result.status, io);
    }

    // Un script del propio árbol: `./recon.sh`.
    if (name.includes("/"))
      return this.finishStatus(this.runScriptFile(name, argv.slice(1), io), io);

    io.err.write(`${this.scriptName}: ${name}: command not found\n`);
    return this.finishStatus(127, io);
  }

  /**
   * Corre un comando suelto y devuelve lo que imprimió.
   *
   * Lo usan `find -exec` y `xargs`, que son herramientas cuyo trabajo es
   * lanzar otras. Va sin redirecciones ni tuberías, solo el despacho, y con
   * `set -e` desactivado: que un `find -exec grep` no encuentre nada no es
   * motivo para tumbar el script de quien lo llamó.
   */
  runCommand(argv: string[], stdin: string): { stdout: string; stderr: string; status: number } {
    const io: Io = {
      input: new InputStream(stdin),
      out: new OutputBuffer(),
      err: new OutputBuffer(),
    };
    const status = this.inCondition(() => this.dispatch(argv, io));
    return { stdout: io.out.toString(), stderr: io.err.toString(), status };
  }

  private runScriptFile(path: string, args: string[], io: Io): number {
    const full = this.resolve(path);

    if (!this.vfs.exists(full)) {
      io.err.write(`${this.scriptName}: ${path}: No such file or directory\n`);
      return 127;
    }
    // El único permiso que sí se aplica, porque hay una lección que va de esto.
    if (!this.vfs.isExecutable(full)) {
      io.err.write(`${this.scriptName}: ${path}: Permission denied\n`);
      return 126;
    }

    const child = this.fork();
    child.positional = args;
    child.scriptName = path;

    try {
      return child.exec(parse(this.vfs.readFile(full)), io);
    } catch (signal) {
      if (signal instanceof ExitSignal) return signal.status;
      throw signal;
    }
  }

  callFunction(body: Command, args: string[], io: Io): number {
    const savedPositional = this.positional;
    this.positional = args;
    this.scopes.push(new Map());

    try {
      return this.exec(body, io);
    } catch (signal) {
      if (signal instanceof ReturnSignal) return signal.status;
      throw signal;
    } finally {
      this.scopes.pop();
      this.positional = savedPositional;
    }
  }

  /** Guarda el estado y, si toca, corta el script por `set -e`. */
  private finishStatus(status: number, io: Io): number {
    this.status = status;
    if (status !== 0 && this.options.errexit && this.conditionDepth === 0) {
      this.runTrap("ERR", io);
      throw new ExitSignal(status);
    }
    return status;
  }

  runTrap(name: string, io: Io): void {
    const handler = this.traps.get(name);
    if (!handler) return;
    this.traps.delete(name);
    try {
      this.exec(parse(handler), io);
    } catch (signal) {
      if (!(signal instanceof ExitSignal)) throw signal;
    }
  }

  // ------------------------------------------------------- condiciones de [[ ]]

  evalCond(expr: CondExpr, io: Io): boolean {
    const host = this.expansionHost();

    switch (expr.type) {
      case "and":
        return this.evalCond(expr.left, io) && this.evalCond(expr.right, io);
      case "or":
        return this.evalCond(expr.left, io) || this.evalCond(expr.right, io);
      case "not":
        return !this.evalCond(expr.expr, io);
      case "word":
        return expandToSingle(expr.word, host) !== "";
      case "unary": {
        const value = expandToSingle(expr.word, host);
        return this.testUnary(expr.op, value);
      }
      case "binary": {
        const left = expandToSingle(expr.left, host);

        if (expr.op === "=~") {
          const pattern = expandToPattern(expr.right, host);
          const regex = compilePosixRegex(pattern, { flavor: "ere" });
          const found = regex.exec(left);
          // BASH_REMATCH es medio desconocido y resuelve el parseo sin cortar.
          this.setVariable("BASH_REMATCH", found ? [...found] : []);
          return found !== null;
        }

        if (expr.op === "==" || expr.op === "=" || expr.op === "!=") {
          const pattern = expandToPattern(expr.right, host);
          const matched = globToRegExp(pattern).test(left);
          return expr.op === "!=" ? !matched : matched;
        }

        const right = expandToSingle(expr.right, host);

        if (expr.op === "<") return left < right;
        if (expr.op === ">") return left > right;

        if (expr.op === "-nt" || expr.op === "-ot") {
          const leftTime = this.vfs.exists(this.resolve(left))
            ? this.vfs.stat(this.resolve(left)).mtime
            : -1;
          const rightTime = this.vfs.exists(this.resolve(right))
            ? this.vfs.stat(this.resolve(right)).mtime
            : -1;
          return expr.op === "-nt" ? leftTime > rightTime : leftTime < rightTime;
        }

        const a = Number(evaluateArith(left || "0", this.arithHost()));
        const b = Number(evaluateArith(right || "0", this.arithHost()));
        switch (expr.op) {
          case "-eq":
            return a === b;
          case "-ne":
            return a !== b;
          case "-lt":
            return a < b;
          case "-le":
            return a <= b;
          case "-gt":
            return a > b;
          case "-ge":
            return a >= b;
          default:
            return false;
        }
      }
      default:
        return false;
    }
  }

  testUnary(op: string, value: string): boolean {
    const path = this.resolve(value);

    switch (op) {
      case "-z":
        return value === "";
      case "-n":
        return value !== "";
      case "-e":
        return this.vfs.exists(path);
      case "-f":
        return this.vfs.isFile(path);
      case "-d":
        return this.vfs.isDir(path);
      case "-s":
        return this.vfs.isFile(path) && this.vfs.stat(path).size > 0;
      case "-r":
      case "-w":
        // Ver la cabecera de vfs.ts: leer y escribir no se aplican.
        return this.vfs.exists(path);
      case "-x":
        return this.vfs.exists(path) && this.vfs.isExecutable(path);
      case "-h":
      case "-L":
        return false;
      default:
        return false;
    }
  }
}

/** Corre un script entero y devuelve lo que salió, listo para corregir. */
export function runBash(request: BashRunRequest, setup: ShellSetup = {}): BashRunResult {
  const started = Date.now();
  const shell = new Shell({
    ...setup,
    ...(request.args ? { args: request.args } : {}),
  });

  const io: Io = {
    input: new InputStream(request.stdin ?? ""),
    out: new OutputBuffer(),
    err: new OutputBuffer(),
  };

  const finish = (
    status: BashRunResult["status"],
    exitCode: number,
    diagnostic?: BashRunResult["diagnostic"],
  ): BashRunResult => ({
    status,
    stdout: io.out.toString(),
    stderr: io.err.toString(),
    exitCode,
    ...(diagnostic ? { diagnostic } : {}),
    files: shell.vfs.snapshot(),
    steps: shell.stepsUsed,
    milliseconds: Date.now() - started,
  });

  let tree;
  try {
    tree = parse(request.source);
  } catch (error) {
    if (error instanceof BashUnsupportedError) {
      return finish("unsupported", 2, {
        message: error.message,
        line: error.line,
        column: error.column,
      });
    }
    if (error instanceof BashSyntaxError) {
      return finish("syntax_error", 2, {
        message: error.message,
        line: error.line,
        column: error.column,
      });
    }
    throw error;
  }

  let exitCode = 0;

  try {
    exitCode = shell.exec(tree, io);
    shell.runTrap("EXIT", io);
  } catch (error) {
    if (error instanceof ExitSignal) {
      exitCode = error.status;
      try {
        shell.runTrap("EXIT", io);
      } catch {
        // Si el propio trap revienta, se acabó igual.
      }
    } else if (error instanceof ReturnSignal) {
      exitCode = error.status;
    } else if (error instanceof BudgetError) {
      return finish("timeout", 124, { message: error.message });
    } else if (error instanceof OutputLimitError) {
      return finish("output_limit", 1, { message: error.message });
    } else if (error instanceof BashUnsupportedError) {
      return finish("unsupported", 2, {
        message: error.message,
        line: error.line,
        column: error.column,
      });
    } else if (error instanceof BashSyntaxError) {
      return finish("syntax_error", 2, {
        message: error.message,
        line: error.line,
        column: error.column,
      });
    } else if (error instanceof BashExpansionError || error instanceof BashArithError) {
      io.err.write(`${shell.scriptName}: ${error.message}\n`);
      return finish("ok", 1);
    } else {
      return finish("internal_error", 1, {
        message: error instanceof Error ? error.message : "falló el intérprete",
      });
    }
  }

  return finish("ok", exitCode);
}
