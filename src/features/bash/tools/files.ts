/**
 * Las herramientas de archivos.
 *
 * Aquí es donde los permisos dejan de ser adorno: `ls -l`, `stat` y `chmod`
 * leen y escriben el modo de verdad, y sobre eso se apoyan las lecciones de
 * revisar un sistema. El modo se imprime como lo imprime GNU, con la `s` del
 * SUID en su sitio, porque encontrar un `-rwsr-xr-x` donde no debería estar es
 * media clase de seguridad.
 */
import { VfsError, basenameOf, dirnameOf, type FileStat } from "../vfs.ts";
import { fail, fromLines, ok, parseArgs, type Tool } from "./support.ts";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** El modo como lo escribe `ls`: `-rwxr-xr-x`, con SUID y pegajoso. */
export function formatMode(stat: FileStat): string {
  const kind = stat.kind === "dir" ? "d" : "-";
  const bits = stat.mode;

  const triple = (shift: number, special: number, letter: string): string => {
    const read = (bits >> (shift + 2)) & 1 ? "r" : "-";
    const write = (bits >> (shift + 1)) & 1 ? "w" : "-";
    const execute = (bits >> shift) & 1;
    const hasSpecial = (bits & special) !== 0;
    const last = hasSpecial ? (execute ? letter : letter.toUpperCase()) : execute ? "x" : "-";
    return read + write + last;
  };

  return kind + triple(6, 0o4000, "s") + triple(3, 0o2000, "s") + triple(0, 0o1000, "t");
}

/** La fecha como la escribe `ls -l` con LC_ALL=C. */
function formatDate(mtime: number, now: number): string {
  const date = new Date(mtime);
  const month = MONTHS[date.getUTCMonth()]!;
  const day = String(date.getUTCDate()).padStart(2, " ");
  const sixMonths = 182 * 24 * 60 * 60 * 1000;

  // Lo viejo lleva año en vez de hora, que es la maña de ls de toda la vida.
  if (Math.abs(now - mtime) > sixMonths) {
    return `${month} ${day}  ${date.getUTCFullYear()}`;
  }

  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${month} ${day} ${hours}:${minutes}`;
}

export const ls: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "lahtrRS1d", long: { all: "a", long: "l" } });
  const paths = parsed.operands.length > 0 ? parsed.operands : ["."];
  const errors: string[] = [];
  const blocks: string[] = [];
  const showHeaders = paths.length > 1;

  for (const path of paths) {
    const full = context.shell.resolve(path);

    if (!context.shell.vfs.exists(full)) {
      errors.push(`ls: cannot access '${path}': No such file or directory`);
      continue;
    }

    const isDirectory = context.shell.vfs.isDir(full) && !parsed.flags.has("d");
    let entries: FileStat[] = isDirectory
      ? context.shell.vfs.readdir(full)
      : [context.shell.vfs.stat(full)];

    if (isDirectory && !parsed.flags.has("a")) {
      entries = entries.filter((entry) => !entry.name.startsWith("."));
    }

    if (parsed.flags.has("t")) entries.sort((left, right) => right.mtime - left.mtime);
    else if (parsed.flags.has("S")) entries.sort((left, right) => right.size - left.size);
    if (parsed.flags.has("r")) entries.reverse();

    const lines: string[] = [];

    if (parsed.flags.has("l")) {
      const widestSize = Math.max(1, ...entries.map((entry) => String(entry.size).length));
      const widestOwner = Math.max(1, ...entries.map((entry) => entry.owner.length));
      const widestGroup = Math.max(1, ...entries.map((entry) => entry.group.length));

      if (isDirectory) {
        const total = entries.reduce(
          (sum, entry) => sum + (entry.kind === "dir" ? 4 : Math.ceil(entry.size / 4096) * 4),
          0,
        );
        lines.push(`total ${total}`);
      }

      for (const entry of entries) {
        lines.push(
          [
            formatMode(entry),
            "1",
            entry.owner.padEnd(widestOwner),
            entry.group.padEnd(widestGroup),
            String(entry.size).padStart(widestSize),
            formatDate(entry.mtime, context.shell.vfs.now),
            isDirectory ? entry.name : path,
          ].join(" "),
        );
      }
    } else {
      for (const entry of entries) lines.push(isDirectory ? entry.name : path);
    }

    blocks.push((showHeaders && isDirectory ? `${path}:\n` : "") + fromLines(lines));
  }

  const stdout = blocks.join(showHeaders ? "\n" : "");
  return errors.length > 0 ? { stdout, stderr: errors.join("\n") + "\n", status: 2 } : ok(stdout);
};

export const mkdir: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "p", long: { parents: "p" } });
  const errors: string[] = [];

  for (const path of parsed.operands) {
    try {
      context.shell.vfs.mkdir(context.shell.resolve(path), { parents: parsed.flags.has("p") });
    } catch (error) {
      if (error instanceof VfsError) {
        errors.push(`mkdir: cannot create directory '${path}': ${error.message.split(": ").pop()}`);
      } else throw error;
    }
  }

  return errors.length > 0 ? fail(errors.join("\n") + "\n") : ok();
};

export const rm: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "rRfd", long: { recursive: "r", force: "f" } });
  const recursive = parsed.flags.has("r") || parsed.flags.has("R");
  const force = parsed.flags.has("f");
  const errors: string[] = [];

  for (const path of parsed.operands) {
    const full = context.shell.resolve(path);

    if (!context.shell.vfs.exists(full)) {
      if (!force) errors.push(`rm: cannot remove '${path}': No such file or directory`);
      continue;
    }
    if (context.shell.vfs.isDir(full) && !recursive && !parsed.flags.has("d")) {
      errors.push(`rm: cannot remove '${path}': Is a directory`);
      continue;
    }

    try {
      context.shell.vfs.remove(full, { recursive });
    } catch (error) {
      if (error instanceof VfsError) errors.push(`rm: cannot remove '${path}': ${error.code}`);
      else throw error;
    }
  }

  return errors.length > 0 ? fail(errors.join("\n") + "\n") : ok();
};

export const touch: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "c" });
  const errors: string[] = [];

  for (const path of parsed.operands) {
    try {
      context.shell.vfs.touch(context.shell.resolve(path));
    } catch (error) {
      if (error instanceof VfsError) errors.push(error.describe("touch"));
      else throw error;
    }
  }

  return errors.length > 0 ? fail(errors.join("\n") + "\n") : ok();
};

export const cp: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "rRpf", long: { recursive: "r" } });
  const recursive = parsed.flags.has("r") || parsed.flags.has("R");
  const sources = parsed.operands.slice(0, -1);
  const destination = parsed.operands[parsed.operands.length - 1];

  if (!destination || sources.length === 0) {
    return { stdout: "", stderr: "cp: missing file operand\n", status: 1 };
  }

  const vfs = context.shell.vfs;
  const target = context.shell.resolve(destination);
  const intoDirectory = vfs.isDir(target);
  const errors: string[] = [];

  const copyOne = (from: string, to: string): void => {
    if (vfs.isDir(from)) {
      if (!recursive) {
        errors.push(`cp: -r not specified; omitting directory '${from}'`);
        return;
      }
      vfs.mkdir(to, { parents: true });
      for (const entry of vfs.readdir(from)) copyOne(entry.path, `${to}/${entry.name}`);
      return;
    }
    const stat = vfs.stat(from);
    vfs.writeFile(to, vfs.readFile(from), { mode: stat.mode });
  };

  for (const source of sources) {
    const from = context.shell.resolve(source);
    if (!vfs.exists(from)) {
      errors.push(`cp: cannot stat '${source}': No such file or directory`);
      continue;
    }
    copyOne(from, intoDirectory ? `${target}/${basenameOf(from)}` : target);
  }

  return errors.length > 0 ? fail(errors.join("\n") + "\n") : ok();
};

export const mv: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "f" });
  const sources = parsed.operands.slice(0, -1);
  const destination = parsed.operands[parsed.operands.length - 1];

  if (!destination || sources.length === 0) {
    return { stdout: "", stderr: "mv: missing file operand\n", status: 1 };
  }

  const vfs = context.shell.vfs;
  const target = context.shell.resolve(destination);
  const intoDirectory = vfs.isDir(target);
  const errors: string[] = [];

  for (const source of sources) {
    const from = context.shell.resolve(source);
    if (!vfs.exists(from)) {
      errors.push(`mv: cannot stat '${source}': No such file or directory`);
      continue;
    }

    const to = intoDirectory ? `${target}/${basenameOf(from)}` : target;
    const stat = vfs.stat(from);

    if (stat.kind === "dir") {
      vfs.mkdir(to, { parents: true });
      for (const entry of vfs.walk(from)) {
        if (entry.kind !== "file") continue;
        const relative = entry.path.slice(from.length);
        vfs.writeFile(to + relative, vfs.readFile(entry.path), { mode: entry.mode });
      }
      vfs.remove(from, { recursive: true });
      continue;
    }

    vfs.writeFile(to, vfs.readFile(from), { mode: stat.mode });
    vfs.chown(to, stat.owner, stat.group);
    vfs.remove(from);
  }

  return errors.length > 0 ? fail(errors.join("\n") + "\n") : ok();
};

/** `chmod 755`, `chmod +x`, `chmod u+w`, `chmod go-rwx`. */
function applySymbolicMode(current: number, spec: string): number {
  let mode = current;

  for (const clause of spec.split(",")) {
    const match = /^([ugoa]*)([+\-=])([rwxst]*)$/.exec(clause);
    if (!match) continue;

    const who = match[1] === "" || match[1] === "a" ? "ugo" : match[1]!;
    const operation = match[2]!;
    const letters = match[3]!;

    let bits = 0;
    for (const target of who) {
      const shift = target === "u" ? 6 : target === "g" ? 3 : 0;
      if (letters.includes("r")) bits |= 4 << shift;
      if (letters.includes("w")) bits |= 2 << shift;
      if (letters.includes("x")) bits |= 1 << shift;
    }
    if (letters.includes("s")) {
      if (who.includes("u")) bits |= 0o4000;
      if (who.includes("g")) bits |= 0o2000;
    }
    if (letters.includes("t")) bits |= 0o1000;

    if (operation === "+") mode |= bits;
    else if (operation === "-") mode &= ~bits;
    else {
      let mask = 0;
      for (const target of who) {
        const shift = target === "u" ? 6 : target === "g" ? 3 : 0;
        mask |= 7 << shift;
      }
      mode = (mode & ~mask) | bits;
    }
  }

  return mode;
}

export const chmod: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "Rv", long: { recursive: "R" } });
  const [spec, ...paths] = parsed.operands;

  if (!spec || paths.length === 0) {
    return { stdout: "", stderr: "chmod: missing operand\n", status: 1 };
  }

  const errors: string[] = [];

  for (const path of paths) {
    const full = context.shell.resolve(path);
    if (!context.shell.vfs.exists(full)) {
      errors.push(`chmod: cannot access '${path}': No such file or directory`);
      continue;
    }

    const targets = parsed.flags.has("R")
      ? context.shell.vfs.walk(full).map((entry) => entry.path)
      : [full];

    for (const target of targets) {
      const mode = /^[0-7]+$/.test(spec)
        ? parseInt(spec, 8)
        : applySymbolicMode(context.shell.vfs.stat(target).mode, spec);
      context.shell.vfs.chmod(target, mode);
    }
  }

  return errors.length > 0 ? fail(errors.join("\n") + "\n") : ok();
};

export const chown: Tool = (context) => {
  const parsed = parseArgs(context.args, { flags: "R" });
  const [spec, ...paths] = parsed.operands;
  if (!spec) return { stdout: "", stderr: "chown: missing operand\n", status: 1 };

  const [owner, group] = spec.split(":");
  const errors: string[] = [];

  for (const path of paths) {
    const full = context.shell.resolve(path);
    if (!context.shell.vfs.exists(full)) {
      errors.push(`chown: cannot access '${path}': No such file or directory`);
      continue;
    }
    const targets = parsed.flags.has("R")
      ? context.shell.vfs.walk(full).map((entry) => entry.path)
      : [full];
    for (const target of targets) {
      context.shell.vfs.chown(target, owner || context.shell.vfs.stat(target).owner, group);
    }
  }

  return errors.length > 0 ? fail(errors.join("\n") + "\n") : ok();
};

export const stat: Tool = (context) => {
  const parsed = parseArgs(context.args, { values: "c", long: { format: "c" } });
  const format = parsed.values.get("c");
  const errors: string[] = [];
  const lines: string[] = [];

  for (const path of parsed.operands) {
    const full = context.shell.resolve(path);
    if (!context.shell.vfs.exists(full)) {
      errors.push(`stat: cannot statx '${path}': No such file or directory`);
      continue;
    }

    const entry = context.shell.vfs.stat(full);

    if (!format) {
      lines.push(`  File: ${path}`);
      lines.push(`  Size: ${entry.size}\t${entry.kind === "dir" ? "directory" : "regular file"}`);
      lines.push(
        `Access: (${(entry.mode & 0o7777).toString(8).padStart(4, "0")}/${formatMode(entry)})  Uid: ( ${entry.owner})   Gid: ( ${entry.group})`,
      );
      continue;
    }

    lines.push(
      format.replace(/%(.)/g, (whole, letter: string) => {
        switch (letter) {
          case "a":
            return (entry.mode & 0o7777).toString(8);
          case "A":
            return formatMode(entry);
          case "U":
            return entry.owner;
          case "G":
            return entry.group;
          case "s":
            return String(entry.size);
          case "n":
            return path;
          case "F":
            return entry.kind === "dir" ? "directory" : "regular file";
          case "y":
            return new Date(entry.mtime).toISOString().replace("T", " ").slice(0, 19);
          default:
            return whole;
        }
      }),
    );
  }

  return errors.length > 0
    ? { stdout: fromLines(lines), stderr: errors.join("\n") + "\n", status: 1 }
    : ok(fromLines(lines));
};

export const basename: Tool = (context) => {
  const parsed = parseArgs(context.args, {});
  const [path, suffix] = parsed.operands;
  if (!path) return { stdout: "", stderr: "basename: missing operand\n", status: 1 };

  let name = basenameOf(path);
  if (suffix && name.endsWith(suffix) && name !== suffix) name = name.slice(0, -suffix.length);
  return ok(name + "\n");
};

export const dirname: Tool = (context) => {
  const parsed = parseArgs(context.args, {});
  const [path] = parsed.operands;
  if (!path) return { stdout: "", stderr: "dirname: missing operand\n", status: 1 };
  return ok(dirnameOf(path) + "\n");
};
