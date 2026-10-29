/**
 * El sistema de archivos de mentira donde corren los scripts.
 *
 * Vive en memoria y se arma de cero en cada caso de prueba. Eso no es por
 * comodidad: en C# se aprendió que si el estado sobrevive de un caso al
 * siguiente, un contador arrastra lo del caso anterior y el reto se corrige
 * mal. Aquí pasaría igual con un archivo que un caso deja escrito.
 *
 * Los permisos se guardan como DATO, no como candado. `mode`, `owner` y
 * `group` están de verdad y por eso `ls -l`, `stat`, `chmod` y
 * `find -perm -4000` funcionan sobre ellos, que es justo lo que se revisa en
 * seguridad. Lo que NO se aplica es la lectura ni la escritura: el jugador es
 * `analista` y media práctica mira archivos de `root`, así que aplicarlo de
 * verdad convertiría el curso entero en pelear con `sudo`, que aquí no existe.
 *
 * La única excepción es el bit de ejecución, y es a propósito: la lección de
 * "tu primer script" enseña `chmod +x`, y sin aplicarlo esa lección no enseña
 * nada.
 *
 * Fuera de alcance a propósito: enlaces simbólicos, dispositivos y todo lo que
 * no sea un archivo de texto o un directorio.
 */
import type { FileSnapshot } from "./protocol.ts";

export const DEFAULT_USER = "analista";
export const DEFAULT_GROUP = "analista";
export const DEFAULT_HOME = "/home/analista";
export const DEFAULT_HOST = "estacion";

/**
 * El agujero negro de siempre.
 *
 * Existe como archivo para que `[ -f /dev/null ]` y `cat /dev/null` se porten
 * como se espera, pero escribir ahí no guarda nada: lo trata aparte quien
 * vuelca las redirecciones. Sin esto, un `2>/dev/null`, que aparece en
 * cualquier script, fallaría por no encontrar el directorio.
 */
export const DEV_NULL = "/dev/null";

/**
 * El reloj de la práctica, fijo.
 *
 * Un `ls -l` imprime fechas y un `find -mtime` las compara, así que con el
 * reloj de verdad el mismo script daría distinto mañana y el reto fallaría
 * solo. Los retos que van de tiempo siembran sus fechas contra esta.
 */
export const DEFAULT_NOW = Date.UTC(2026, 2, 14, 10, 0, 0);

export type VfsErrorCode = "ENOENT" | "EISDIR" | "ENOTDIR" | "EEXIST" | "ENOTEMPTY" | "EACCES";

/** Los textos son los de GNU, en inglés, porque se comparan contra bash real. */
const MESSAGES: Record<VfsErrorCode, string> = {
  ENOENT: "No such file or directory",
  EISDIR: "Is a directory",
  ENOTDIR: "Not a directory",
  EEXIST: "File exists",
  ENOTEMPTY: "Directory not empty",
  EACCES: "Permission denied",
};

export class VfsError extends Error {
  readonly code: VfsErrorCode;
  readonly path: string;
  /** El motivo solo, sin ruta, para poder escribirlo con el nombre de verdad. */
  readonly reason: string;

  constructor(code: VfsErrorCode, path: string) {
    super(`${path}: ${MESSAGES[code]}`);
    this.name = "VfsError";
    this.code = code;
    this.path = path;
    this.reason = MESSAGES[code];
  }

  /** Como lo escribe una herramienta de GNU: `cat: /nope: No such file...`. */
  describe(tool: string): string {
    return `${tool}: ${this.path}: ${MESSAGES[this.code]}`;
  }
}

export type NodeKind = "file" | "dir";

interface BaseNode {
  mode: number;
  owner: string;
  group: string;
  mtime: number;
}

interface FileNode extends BaseNode {
  kind: "file";
  content: string;
}

interface DirNode extends BaseNode {
  kind: "dir";
  children: Map<string, VfsNode>;
}

type VfsNode = FileNode | DirNode;

export interface FileStat {
  path: string;
  name: string;
  kind: NodeKind;
  mode: number;
  owner: string;
  group: string;
  /** En bytes, como lo cuenta `wc -c` y lo imprime `ls -l`. */
  size: number;
  mtime: number;
}

/** Cómo se siembra un archivo en un reto o en una lección. */
export interface FileSeed {
  content?: string;
  mode?: number;
  owner?: string;
  group?: string;
  /** Epoch en ms, o una fecha ISO. Por defecto, el reloj de la corrida. */
  mtime?: number | string;
}

/**
 * El árbol de partida.
 *
 * Una ruta que termina en `/` es un directorio. Un valor de texto es el
 * contenido del archivo, que es el caso corriente y se escribe corto:
 *
 *   { "/var/log/auth.log": "...", "/opt/backup.sh": { content: "...", mode: 0o755 } }
 */
export type VfsSeed = Record<string, string | FileSeed>;

const encoder = new TextEncoder();

export function byteLength(text: string): number {
  return encoder.encode(text).length;
}

/** Resuelve los `.` y los `..` de una ruta, sin tocar el árbol. */
export function normalizePath(path: string): string {
  const absolute = path.startsWith("/");
  const parts: string[] = [];

  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      // En una ruta relativa un `..` de más se guarda, porque todavía no se
      // sabe desde dónde se va a resolver.
      if (parts.length > 0 && parts[parts.length - 1] !== "..") parts.pop();
      else if (!absolute) parts.push("..");
      continue;
    }
    parts.push(segment);
  }

  if (absolute) return "/" + parts.join("/");
  return parts.join("/") || ".";
}

export function dirnameOf(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  const index = normalized.lastIndexOf("/");
  if (index < 0) return ".";
  if (index === 0) return "/";
  return normalized.slice(0, index);
}

export function basenameOf(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") return "/";
  const index = normalized.lastIndexOf("/");
  return index < 0 ? normalized : normalized.slice(index + 1);
}

export function joinPath(base: string, relative: string): string {
  if (relative.startsWith("/")) return normalizePath(relative);
  return normalizePath(base + "/" + relative);
}

export class Vfs {
  private readonly root: DirNode;
  /** El reloj de esta corrida, para lo que se crea o se toca mientras corre. */
  now: number;

  constructor(seed: VfsSeed = {}, now: number = DEFAULT_NOW) {
    this.now = now;
    this.root = {
      kind: "dir",
      children: new Map(),
      mode: 0o755,
      owner: "root",
      group: "root",
      mtime: now,
    };

    for (const [path, value] of Object.entries(seed)) this.seedOne(path, value);
  }

  private seedOne(path: string, value: string | FileSeed): void {
    const isDir = path.endsWith("/");
    const normalized = normalizePath(path);
    if (normalized === "/") return;

    const seed: FileSeed = typeof value === "string" ? { content: value } : value;
    const mtime =
      typeof seed.mtime === "string" ? Date.parse(seed.mtime) : (seed.mtime ?? this.now);

    const parent = this.makeDirs(dirnameOf(normalized));
    const name = basenameOf(normalized);

    if (isDir) {
      const node = this.makeDirs(normalized);
      node.mode = seed.mode ?? 0o755;
      node.owner = seed.owner ?? "root";
      node.group = seed.group ?? seed.owner ?? "root";
      node.mtime = mtime;
      return;
    }

    parent.children.set(name, {
      kind: "file",
      content: seed.content ?? "",
      mode: seed.mode ?? 0o644,
      owner: seed.owner ?? "root",
      group: seed.group ?? seed.owner ?? "root",
      mtime,
    });
  }

  /** Crea el camino entero si falta, como `mkdir -p`. */
  private makeDirs(path: string): DirNode {
    let node: DirNode = this.root;
    const normalized = normalizePath(path);
    if (normalized === "/" || normalized === ".") return node;

    for (const segment of normalized.split("/")) {
      if (segment === "") continue;
      const existing = node.children.get(segment);
      if (existing?.kind === "dir") {
        node = existing;
        continue;
      }
      if (existing) throw new VfsError("ENOTDIR", path);
      const created: DirNode = {
        kind: "dir",
        children: new Map(),
        mode: 0o755,
        owner: "root",
        group: "root",
        mtime: this.now,
      };
      node.children.set(segment, created);
      node = created;
    }
    return node;
  }

  private find(path: string): VfsNode | null {
    const normalized = normalizePath(path);
    if (normalized === "/") return this.root;

    let node: VfsNode = this.root;
    for (const segment of normalized.split("/")) {
      if (segment === "") continue;
      if (node.kind !== "dir") return null;
      const next = node.children.get(segment);
      if (!next) return null;
      node = next;
    }
    return node;
  }

  private mustFind(path: string): VfsNode {
    const node = this.find(path);
    if (!node) throw new VfsError("ENOENT", path);
    return node;
  }

  exists(path: string): boolean {
    return this.find(path) !== null;
  }

  isDir(path: string): boolean {
    return this.find(path)?.kind === "dir";
  }

  isFile(path: string): boolean {
    return this.find(path)?.kind === "file";
  }

  /** Si el dueño, el grupo o el resto pueden ejecutarlo. Ver la cabecera. */
  isExecutable(path: string): boolean {
    const node = this.find(path);
    return node !== null && (node.mode & 0o111) !== 0;
  }

  stat(path: string): FileStat {
    const node = this.mustFind(path);
    const normalized = normalizePath(path);
    return {
      path: normalized,
      name: basenameOf(normalized),
      kind: node.kind,
      mode: node.mode,
      owner: node.owner,
      group: node.group,
      size: node.kind === "file" ? byteLength(node.content) : 4096,
      mtime: node.mtime,
    };
  }

  readFile(path: string): string {
    const node = this.mustFind(path);
    if (node.kind === "dir") throw new VfsError("EISDIR", path);
    return node.content;
  }

  writeFile(path: string, content: string, options: { mode?: number } = {}): void {
    const normalized = normalizePath(path);
    const parentPath = dirnameOf(normalized);
    const parent = this.find(parentPath);
    if (!parent) throw new VfsError("ENOENT", path);
    if (parent.kind !== "dir") throw new VfsError("ENOTDIR", parentPath);

    const name = basenameOf(normalized);
    const existing = parent.children.get(name);
    if (existing?.kind === "dir") throw new VfsError("EISDIR", path);

    if (existing) {
      existing.content = content;
      existing.mtime = this.now;
      if (options.mode !== undefined) existing.mode = options.mode;
      return;
    }

    parent.children.set(name, {
      kind: "file",
      content,
      mode: options.mode ?? 0o644,
      owner: DEFAULT_USER,
      group: DEFAULT_GROUP,
      mtime: this.now,
    });
  }

  appendFile(path: string, content: string): void {
    const existing = this.find(path);
    if (existing?.kind === "file") {
      existing.content += content;
      existing.mtime = this.now;
      return;
    }
    this.writeFile(path, content);
  }

  mkdir(path: string, options: { parents?: boolean } = {}): void {
    const normalized = normalizePath(path);
    if (options.parents) {
      this.makeDirs(normalized);
      return;
    }
    if (this.exists(normalized)) throw new VfsError("EEXIST", path);
    const parent = this.find(dirnameOf(normalized));
    if (!parent) throw new VfsError("ENOENT", path);
    if (parent.kind !== "dir") throw new VfsError("ENOTDIR", path);
    parent.children.set(basenameOf(normalized), {
      kind: "dir",
      children: new Map(),
      mode: 0o755,
      owner: DEFAULT_USER,
      group: DEFAULT_GROUP,
      mtime: this.now,
    });
  }

  readdir(path: string): FileStat[] {
    const node = this.mustFind(path);
    if (node.kind !== "dir") throw new VfsError("ENOTDIR", path);
    const base = normalizePath(path);
    return [...node.children.keys()]
      .sort()
      .map((name) => this.stat(base === "/" ? "/" + name : base + "/" + name));
  }

  remove(path: string, options: { recursive?: boolean } = {}): void {
    const normalized = normalizePath(path);
    if (normalized === "/") throw new VfsError("EACCES", path);
    const node = this.mustFind(normalized);
    if (node.kind === "dir" && node.children.size > 0 && !options.recursive) {
      throw new VfsError("ENOTEMPTY", path);
    }
    const parent = this.find(dirnameOf(normalized));
    if (parent?.kind !== "dir") throw new VfsError("ENOENT", path);
    parent.children.delete(basenameOf(normalized));
  }

  chmod(path: string, mode: number): void {
    this.mustFind(path).mode = mode;
  }

  chown(path: string, owner: string, group?: string): void {
    const node = this.mustFind(path);
    node.owner = owner;
    if (group !== undefined) node.group = group;
  }

  touch(path: string): void {
    const node = this.find(path);
    if (node) {
      node.mtime = this.now;
      return;
    }
    this.writeFile(path, "");
  }

  /** Todas las rutas del árbol, en orden, para `find` y para el glob. */
  walk(from = "/"): FileStat[] {
    const out: FileStat[] = [];
    const start = normalizePath(from);
    if (!this.exists(start)) return out;

    const visit = (path: string): void => {
      out.push(this.stat(path));
      const current = this.find(path);
      if (current?.kind !== "dir") return;
      for (const name of [...current.children.keys()].sort()) {
        visit(path === "/" ? "/" + name : path + "/" + name);
      }
    };

    visit(start);
    return out;
  }

  /** Cómo quedaron los archivos, para que el corrector pueda mirarlos. */
  snapshot(): Record<string, FileSnapshot> {
    const out: Record<string, FileSnapshot> = {};
    for (const stat of this.walk("/")) {
      if (stat.kind !== "file") continue;
      // El agujero negro no es un archivo del jugador: el corrector no tiene
      // por qué verlo entre lo que dejó escrito.
      if (stat.path === DEV_NULL) continue;
      out[stat.path] = {
        content: this.readFile(stat.path),
        mode: stat.mode,
        owner: stat.owner,
        group: stat.group,
      };
    }
    return out;
  }
}

/**
 * Junta los archivos de varios sitios, sin repetir.
 *
 * Una lección enseña el árbol UNA vez arriba en vez de por cada ejemplo. Los
 * ejemplos de una misma lección suelen compartir el escenario, así que antes se
 * pintaba cuatro veces lo mismo y no había quien leyera la lección.
 *
 * Cuando dos sitios definen la misma ruta, gana el primero, que es el que el
 * lector ve antes.
 */
export function mergeFiles(...sources: (VfsSeed | undefined)[]): VfsSeed {
  const merged: VfsSeed = {};
  for (const source of sources) {
    for (const [path, value] of Object.entries(source ?? {})) {
      if (!(path in merged)) merged[path] = value;
    }
  }
  return merged;
}
