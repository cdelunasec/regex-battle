import { CheckCircle2, CircleSlash, Loader2, TriangleAlert, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  describeDifference,
  explainException,
  type CSharpEvaluation,
  type CSharpVerdict,
} from "./grade.ts";
import type { CSharpDiagnostic, CSharpRunResult } from "./protocol.ts";
import type { RunnerState } from "./runner.ts";

/** Lo que se dice cuando el programa no llegó a terminar bien. */
const STOPPED: Record<"timeout" | "crashed" | "output_limit", string> = {
  timeout:
    "Tu programa no terminó en 5 segundos. Casi siempre es un bucle cuya condición nunca se vuelve falsa: revisa que la variable que decide cuándo parar de verdad cambie en cada vuelta.",
  crashed:
    "Tu programa se fue de las manos y tumbó el compilador. Las dos causas típicas son un método que se llama a sí mismo sin un caso que lo detenga, y un bucle sin fin que se come la memoria. Ya se está levantando otro compilador: arréglalo y vuelve a intentarlo.",
  output_limit:
    "Tu programa imprimió muchísimo, más de lo que cualquier reto pide, y se cortó. Suele ser un bucle que imprime y nunca para.",
};

/** El estado del compilador en una línea, para que la espera de la primera vez no parezca un cuelgue. */
export function RunnerStatus({ state }: { state: RunnerState }) {
  if (state === "ready") {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="size-3.5 text-success" />
        Compilador de C# listo.
      </p>
    );
  }
  if (state === "failed") {
    return (
      <p className="flex items-center gap-2 text-xs text-destructive">
        <TriangleAlert className="size-3.5" />
        El compilador de C# no pudo arrancar. Recarga la página para intentarlo otra vez.
      </p>
    );
  }
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" />
      Preparando el compilador de C#. La primera vez tarda un poco porque se descarga; después queda
      guardado.
    </p>
  );
}

export function ConsoleBox({
  text,
  label,
  mark,
}: {
  text: string;
  label: string;
  /** Línea y columna, desde 1, del carácter que hay que señalar. */
  mark?: { line: number; column: number } | undefined;
}) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");

  return (
    <div className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-sm whitespace-pre">
        {text.length === 0 ? (
          <span className="text-muted-foreground italic">(nada)</span>
        ) : (
          lines.map((line, index) => {
            if (!mark || mark.line !== index + 1) {
              return <span key={index}>{line + "\n"}</span>;
            }

            // El carácter señalado se pinta aparte. Cuando la diferencia es que
            // la línea se acabó antes de tiempo, no hay carácter que marcar y se
            // marca el hueco con un espacio, para que se vea dónde faltaba algo.
            const at = Math.max(0, mark.column - 1);
            const character = line.slice(at, at + 1);
            return (
              <span key={index}>
                {line.slice(0, at)}
                <span className="rounded-sm bg-destructive/40 outline outline-destructive/60">
                  {character.length > 0 ? character : " "}
                </span>
                {line.slice(at + 1) + "\n"}
              </span>
            );
          })
        )}
      </pre>
    </div>
  );
}

export function CompileErrors({ diagnostics }: { diagnostics: CSharpDiagnostic[] }) {
  return (
    <div className="grid gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
      <p className="text-sm font-medium text-destructive">No compila</p>
      <ul className="grid gap-1.5 text-sm">
        {diagnostics.map((diagnostic, index) => (
          <li key={index} className="grid gap-0.5">
            <span>
              {diagnostic.line !== undefined && (
                <span className="font-mono font-medium">
                  Línea {diagnostic.line}
                  {diagnostic.column !== undefined && `, col ${diagnostic.column}`}:{" "}
                </span>
              )}
              {diagnostic.message}
            </span>
            <span className="font-mono text-xs text-muted-foreground">{diagnostic.id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stopped({ kind }: { kind: keyof typeof STOPPED }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
      {STOPPED[kind]}
    </p>
  );
}

/** Lo que salió al pulsar Ejecutar: la consola, o por qué no la hubo. */
export function RunOutput({ result }: { result: CSharpRunResult }) {
  switch (result.status) {
    case "ok":
      return <ConsoleBox label="Lo que imprimió tu programa" text={result.stdout ?? ""} />;
    case "compile_error":
      return <CompileErrors diagnostics={result.diagnostics ?? []} />;
    case "runtime_error": {
      const exception = result.exception ?? { type: "Exception", message: "" };
      return (
        <div className="grid gap-3">
          <div className="grid gap-1 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <p className="font-medium text-destructive">Se detuvo con {exception.type}</p>
            <p>{explainException(exception.type)}</p>
            <p className="font-mono text-xs text-muted-foreground">{exception.message}</p>
          </div>
          {(result.stdout ?? "").length > 0 && (
            <ConsoleBox label="Lo que alcanzó a imprimir antes" text={result.stdout ?? ""} />
          )}
        </div>
      );
    }
    case "timeout":
    case "crashed":
    case "output_limit":
      return <Stopped kind={result.status} />;
    default:
      return <Stopped kind="crashed" />;
  }
}

function verdictIcon(verdict: CSharpVerdict) {
  if (verdict.kind === "pass") return <CheckCircle2 className="size-4 text-success" />;
  if (verdict.kind === "skipped") return <CircleSlash className="size-4 text-muted-foreground" />;
  return <XCircle className="size-4 text-destructive" />;
}

function verdictLabel(verdict: CSharpVerdict): string {
  switch (verdict.kind) {
    case "pass":
      return "pasó";
    case "wrong_output":
      return "salida distinta";
    case "runtime_error":
      return `se detuvo con ${verdict.exception.type}`;
    case "timeout":
      return "no terminó";
    case "crashed":
      return "tumbó el compilador";
    case "output_limit":
      return "imprimió de más";
    case "skipped":
      return "no se llegó a probar";
    default:
      return "no se pudo comprobar";
  }
}

/**
 * Las dos salidas, con la primera diferencia señalada.
 *
 * Enseñarlas una al lado de la otra no alcanza: una `L` cambiada por una `l` es
 * invisible a ojo, y buscarla no enseña nada. Así que se dice en qué línea y en
 * qué posición está, y se marca el carácter en las dos.
 */
function WrongOutput({
  stdin,
  expected,
  actual,
}: {
  stdin: string;
  expected: string;
  actual: string;
}) {
  const difference = describeDifference(expected, actual);
  const mark = difference ? { line: difference.line, column: difference.column } : undefined;

  return (
    <div className="grid gap-2">
      {difference && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm">
          {difference.message}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        <ConsoleBox label="Entrada" text={stdin} />
        <ConsoleBox label="Se esperaba" text={expected} mark={mark} />
        <ConsoleBox label="Tu programa imprimió" text={actual} mark={mark} />
      </div>
    </div>
  );
}

/** El resultado de Comprobar: cuántos casos pasaron, y qué falló en los que no. */
export function EvaluationOutput({
  evaluation,
  stdins,
}: {
  evaluation: CSharpEvaluation;
  /** Las entradas de cada caso, para enseñarlas junto a lo que falló. */
  stdins: string[];
}) {
  if (evaluation.compileErrors) {
    return <CompileErrors diagnostics={evaluation.compileErrors} />;
  }

  const stopped = evaluation.verdicts.find(
    (verdict) =>
      verdict.kind === "timeout" || verdict.kind === "crashed" || verdict.kind === "output_limit",
  );

  return (
    <div className="grid gap-3">
      <p
        className={cn(
          "text-sm font-medium",
          evaluation.allPassed ? "text-success" : "text-foreground",
        )}
      >
        Pasaron {evaluation.passed} de {evaluation.total} casos.
      </p>

      {stopped && <Stopped kind={stopped.kind as keyof typeof STOPPED} />}

      <ul className="grid gap-2">
        {evaluation.verdicts.map((verdict, index) => (
          <li key={index} className="grid gap-2 rounded-md border p-3">
            <div className="flex items-center gap-2 text-sm">
              {verdictIcon(verdict)}
              <span className="font-medium">{index === 0 ? "Ejemplo" : `Caso ${index + 1}`}</span>
              <span className="text-muted-foreground">{verdictLabel(verdict)}</span>
            </div>

            {verdict.kind === "wrong_output" && (
              <WrongOutput
                stdin={stdins[index] ?? ""}
                expected={verdict.expected}
                actual={verdict.actual}
              />
            )}

            {verdict.kind === "runtime_error" && (
              <div className="grid gap-2">
                <p className="text-sm">{verdict.explanation}</p>
                <ConsoleBox label="Entrada" text={stdins[index] ?? ""} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
