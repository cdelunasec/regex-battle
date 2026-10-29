/**
 * El catálogo de herramientas: lo que el shell encuentra cuando busca un
 * comando que no es builtin ni función.
 *
 * Que sea una tabla y no un `switch` es a propósito: sumar una herramienta es
 * escribir su función y agregarla aquí, y el corrector puede preguntar qué
 * existe para avisar con nombre propio cuando alguien usa algo que todavía no
 * está, en vez de soltar un "command not found" que no explica nada.
 */
import { awk } from "./awk.ts";
import { comm, diff, jq, paste } from "./data.ts";
import { basename, chmod, chown, cp, dirname, ls, mkdir, mv, rm, stat, touch } from "./files.ts";
import { find, xargs } from "./find.ts";
import { grep } from "./grep.ts";
import { base64, md5sum, sha256sum } from "./hash.ts";
import { date, env, hostname, id, seq, sleep, uname, whoami, yes } from "./misc.ts";
import { curl, dig, ffuf, gobuster, nmap, nuclei, ping, subfinder, whois } from "./recon.ts";
import { sed } from "./sed.ts";
import type { Tool } from "./support.ts";
import { cat, cut, head, nl, rev, sortTool, tail, tee, tr, uniq, wc } from "./text.ts";

export type { Tool, ToolContext, ToolResult } from "./support.ts";

export const TOOLS: Record<string, Tool> = {
  // Texto
  cat,
  head,
  tail,
  wc,
  cut,
  tr,
  sort: sortTool,
  uniq,
  tee,
  nl,
  rev,
  grep,
  egrep: (context) => grep({ ...context, args: ["-E", ...context.args] }),
  fgrep: (context) => grep({ ...context, args: ["-F", ...context.args] }),
  sed,
  awk,
  gawk: awk,

  // Archivos
  ls,
  mkdir,
  rm,
  cp,
  mv,
  touch,
  chmod,
  chown,
  stat,
  basename,
  dirname,
  find,
  xargs,

  // Datos y huellas
  jq,
  comm,
  paste,
  diff,
  sha256sum,
  md5sum,
  base64,

  // Lo demás
  seq,
  date,
  whoami,
  id,
  hostname,
  uname,
  sleep,
  env,
  yes,

  /*
   * Las de red. No tocan nada: su salida está guardada y avisan de que lo
   * están. Ver la cabecera de `recon.ts` para las tres reglas que cumplen,
   * empezando por negarse a mirar lo que no esté en el alcance.
   */
  nmap,
  dig,
  whois,
  curl,
  gobuster,
  ffuf,
  subfinder,
  nuclei,
  ping,
};

/** Lo que existe, para poder explicar qué falta en vez de decir solo que no. */
export function toolNames(): string[] {
  return Object.keys(TOOLS).sort();
}
