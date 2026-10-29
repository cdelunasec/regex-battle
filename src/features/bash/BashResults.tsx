/**
 * Lo que se ve después de correr un script.
 *
 * Un reto de Bash se puede corregir por tres cosas distintas, así que la
 * pantalla tiene que enseñar las tres: lo que imprimió, lo que se quejó por la
 * salida de error, y cómo quedaron los archivos. Esa última es la que más se
 * echa en falta cuando no está: un script que ordena un directorio no imprime
 * nada, y sin ver el resultado en disco uno se queda a ciegas.
 */
import { AlertTriangle, Check, FileText, FolderTree, X } from "lucide-react";
import { describeDifference } from "@/features/editor/output";
import type { BashEvaluation, BashVerdict } from "./grade.ts";
import { explainVerdict } from "./grade.ts";
import type { BashRunResult } from "./protocol.ts";
import type { VfsSeed } from "./vfs.ts";

/** Un bloque de consola, con su etiqueta. */
export function ConsoleBox({
  label,
  text,
  tone = "normal",
}: {
  label: string;
  text: string;
  tone?: "normal" | "error";
}) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <pre
        className={`overflow-x-auto rounded-md border p-3 font-mono text-xs whitespace-pre-wrap ${
          tone === "error" ? "border-destructive/40 bg-destructive/5" : "bg-muted/40"
        }`}
      >
        {text === "" ? <span className="text-muted-foreground">(vacío)</span> : text}
      </pre>
    </div>
  );
}

/**
 * El árbol con el que arranca el reto.
 *
 * Sin esto habría que adivinar qué archivos hay, y el reto se volvería un
 * juego de tanteo en vez de uno de escribir el script.
 *
 * Va plegado salvo que haya un solo archivo, y esa es la diferencia entre
 * ayudar y estorbar: seis archivos desplegados ocupan más que la lección
 * entera, y en cuanto se repiten dejan de leerse. El resumen enseña los
 * nombres, que es lo que hace falta para empezar a escribir; el contenido se
 * abre cuando de verdad se necesita.
 */
export function StartingFiles({ files, title }: { files: VfsSeed; title?: string }) {
  const entries = Object.entries(files)
    .filter(([path]) => !path.endsWith("/"))
    .sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) return null;

  const shortNames = entries.map(([path]) => path.split("/").pop());
  const names =
    shortNames.length > 3
      ? `${shortNames.slice(0, 3).join(", ")} y ${shortNames.length - 3} más`
      : shortNames.join(", ");

  return (
    /*
     * El triángulo del `summary` es lo único que dice que esto se abre, así que
     * no se le pone `flex` encima: eso lo quitaría en varios navegadores y el
     * bloque parecería un título muerto.
     */
    <details open={entries.length === 1} className="rounded-lg border bg-muted/20 px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground marker:text-muted-foreground">
        <span className="inline-flex flex-wrap items-center gap-x-1.5 align-middle">
          <FolderTree className="size-3.5 shrink-0" />
          {title ?? "Con lo que arrancas"}
          <span className="font-mono font-normal opacity-80">{names}</span>
        </span>
      </summary>

      <div className="grid gap-2 pt-3">
        {entries.map(([path, value]) => {
          const seed = typeof value === "string" ? { content: value } : value;
          const content = seed.content ?? "";
          const shown = content.split("\n").slice(0, 8).join("\n");
          const cut = content.split("\n").length > 8;

          return (
            <div key={path} className="rounded-md border">
              <div className="flex items-center gap-1.5 border-b px-3 py-1.5 font-mono text-xs">
                <FileText className="size-3.5 text-muted-foreground" />
                {path}
                {seed.mode !== undefined && (
                  <span className="ml-auto text-muted-foreground">
                    {(seed.mode & 0o7777).toString(8)}
                  </span>
                )}
              </div>
              <pre className="overflow-x-auto px-3 py-2 font-mono text-xs whitespace-pre-wrap">
                {shown || <span className="text-muted-foreground">(vacío)</span>}
                {cut && <span className="text-muted-foreground">{"\n…"}</span>}
              </pre>
            </div>
          );
        })}
      </div>
    </details>
  );
}

/**
 * Lo que dejó una corrida suelta, la del botón de Ejecutar.
 *
 * De los archivos solo se enseñan los que CAMBIARON. Antes salían todos los
 * del directorio, así que tras cada ejecución se repintaba el escenario entero
 * y había que buscar a ojo qué había hecho el script. Lo que interesa es la
 * diferencia, y para saberla hay que pasarle con qué se empezó.
 */
export function RunOutput({
  result,
  before,
}: {
  result: BashRunResult;
  before?: VfsSeed | undefined;
}) {
  const written = Object.entries(result.files).filter(([path, file]) => {
    if (!path.startsWith("/home/")) return false;
    if (!before) return true;

    const original = before[path];
    if (original === undefined) return true;
    const content = typeof original === "string" ? original : (original.content ?? "");
    return content !== file.content;
  });

  return (
    <div className="grid gap-3">
      <ConsoleBox label="Salida" text={result.stdout} />
      {result.stderr !== "" && (
        <ConsoleBox label="Salida de error" text={result.stderr} tone="error" />
      )}
      {result.diagnostic && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span>
            {result.diagnostic.line !== undefined && (
              <span className="font-medium">Línea {result.diagnostic.line}: </span>
            )}
            {result.diagnostic.message}
          </span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Terminó con código {result.exitCode}
        {result.exitCode === 0 ? " (todo bien)" : ""}.
      </p>
      {written.length > 0 && (
        <div className="grid gap-2">
          <span className="text-xs font-medium text-muted-foreground">Lo que cambió tu script</span>
          {written.map(([path, file]) => (
            <div key={path} className="rounded-md border">
              <div className="border-b px-3 py-1.5 font-mono text-xs">{path}</div>
              <pre className="overflow-x-auto px-3 py-2 font-mono text-xs whitespace-pre-wrap">
                {file.content || <span className="text-muted-foreground">(vacío)</span>}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VerdictRow({ verdict, position }: { verdict: BashVerdict; position: number }) {
  const passed = verdict.kind === "pass";

  return (
    <div
      className={`grid gap-2 rounded-md border p-3 text-sm ${
        passed ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"
      }`}
    >
      <div className="flex items-center gap-2 font-medium">
        {passed ? (
          <Check className="size-4 text-success" />
        ) : (
          <X className="size-4 text-destructive" />
        )}
        Caso {position + 1}
        {position === 0 && <span className="text-xs text-muted-foreground">(el del ejemplo)</span>}
      </div>

      {!passed && <p className="text-muted-foreground">{explainVerdict(verdict)}</p>}

      {verdict.kind === "wrong_output" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <ConsoleBox label="Se esperaba" text={verdict.expected} />
          <ConsoleBox label="Tu salida" text={verdict.actual} />
          {verdict.stderr !== "" && (
            <div className="sm:col-span-2">
              <ConsoleBox label="Salida de error" text={verdict.stderr} tone="error" />
            </div>
          )}
        </div>
      )}

      {verdict.kind === "wrong_file" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <ConsoleBox label={`Se esperaba en ${verdict.path}`} text={verdict.expected} />
          <ConsoleBox label="Lo que quedó" text={verdict.actual ?? ""} />
        </div>
      )}
    </div>
  );
}

export function EvaluationOutput({ evaluation }: { evaluation: BashEvaluation }) {
  const first = evaluation.verdicts.find((verdict) => verdict.kind !== "pass");
  const difference =
    first?.kind === "wrong_output" ? describeDifference(first.expected, first.actual) : null;

  return (
    <div className="grid gap-3">
      <p className="text-sm">
        Pasaron {evaluation.passedCount} de {evaluation.totalCount} casos.
      </p>
      {difference && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm">{difference.message}</p>
      )}
      <div className="grid gap-2">
        {evaluation.verdicts.map((verdict, position) => (
          <VerdictRow key={position} verdict={verdict} position={position} />
        ))}
      </div>
    </div>
  );
}
