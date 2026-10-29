import { useEffect, useRef, useState } from "react";
import { CheckCheck, Lightbulb, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CSHARP_STARTER } from "@/data/csharp-challenges";
import type { CSharpExample, CSharpLessonExercise } from "@/data/lesson-types";
import { LessonText } from "@/features/learn/LessonText";
import { CodeEditor } from "@/features/editor/CodeEditor";
import { ConsoleBox, EvaluationOutput, RunOutput, RunnerStatus } from "./CSharpResults.tsx";
import { evaluateCSharp, type CSharpEvaluation } from "./grade.ts";
import type { CSharpRunResult } from "./protocol.ts";
import { csharpRunner } from "./runner.ts";
import { useCSharpRunner } from "./useCSharpRunner.ts";

/** Ignora el resultado de una ejecución si la pantalla ya cambió. */
function useMountedFlag() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}

/**
 * Un programa de la lección, listo para ejecutar y para que lo cambien.
 *
 * Editable a propósito: leer que `7 / 2` da `3` no enseña ni la mitad que
 * cambiarlo a `7.0 / 2` y ver salir `3.5`.
 */
export function CSharpExampleRunner({ example }: { example: CSharpExample }) {
  const [code, setCode] = useState(example.code);
  const [stdin, setStdin] = useState(example.stdin ?? "");
  const [result, setResult] = useState<CSharpRunResult | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useMountedFlag();

  async function execute() {
    if (busy) return;
    setBusy(true);
    const run = await csharpRunner().run(code, stdin);
    if (!mounted.current) return;
    setResult(run);
    setBusy(false);
  }

  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
      <CodeEditor
        value={code}
        onChange={setCode}
        onSubmit={() => void execute()}
        label="Programa de ejemplo"
        minRows={6}
      />

      {example.stdin !== undefined && (
        <label className="grid gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Lo que lee el programa (un dato por línea)
          </span>
          <textarea
            value={stdin}
            onChange={(event) => setStdin(event.target.value)}
            rows={Math.max(1, stdin.split("\n").length)}
            spellCheck={false}
            className="resize-none rounded-md border bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </label>
      )}

      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void execute()}
          disabled={busy}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Ejecutar
        </Button>
      </div>

      {result && <RunOutput result={result} />}

      <p className="text-xs text-muted-foreground">
        <LessonText text={example.note} />
      </p>
    </div>
  );
}

/**
 * El ejercicio de una lección de C#.
 *
 * Igual que en la práctica solo: Ejecutar prueba con la entrada del ejemplo y
 * Comprobar lo pasa por todos los casos. Lo que cambia es que al pasarlos se
 * marca la lección como hecha.
 */
export function CSharpExercise({
  exercise,
  solved,
  onSolved,
}: {
  exercise: CSharpLessonExercise;
  solved: boolean;
  onSolved: () => void;
}) {
  const runnerState = useCSharpRunner();
  const [code, setCode] = useState(exercise.starter ?? CSHARP_STARTER);
  const [busy, setBusy] = useState<"run" | "check" | null>(null);
  const [run, setRun] = useState<CSharpRunResult | null>(null);
  const [evaluation, setEvaluation] = useState<CSharpEvaluation | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const mounted = useMountedFlag();

  const example = exercise.cases[0];
  const compileErrors = evaluation?.compileErrors ?? run?.diagnostics ?? [];
  const errorLines = compileErrors.flatMap((d) => (d.line === undefined ? [] : [d.line]));

  useEffect(() => {
    if (evaluation?.allPassed) onSolved();
  }, [evaluation, onSolved]);

  async function execute() {
    if (busy) return;
    setBusy("run");
    const result = await csharpRunner().run(code, example?.stdin ?? "");
    if (!mounted.current) return;
    setRun(result);
    setEvaluation(null);
    setBusy(null);
  }

  async function check() {
    if (busy) return;
    setBusy("check");
    const result = await evaluateCSharp(code, exercise.cases, csharpRunner());
    if (!mounted.current) return;
    setEvaluation(result);
    setRun(null);
    setBusy(null);
  }

  return (
    <div className="grid gap-4">
      <RunnerStatus state={runnerState} />

      {example && example.stdin.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          <ConsoleBox label="Entrada de ejemplo" text={example.stdin} />
          <ConsoleBox label="Salida esperada" text={example.expected} />
        </div>
      )}

      <CodeEditor
        value={code}
        onChange={setCode}
        onSubmit={() => void check()}
        label="Tu programa en C#"
        errorLines={errorLines}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void execute()}
          disabled={busy !== null}
        >
          {busy === "run" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Play className="size-4" />
          )}
          Ejecutar
        </Button>
        <Button type="button" size="sm" onClick={() => void check()} disabled={busy !== null}>
          {busy === "check" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCheck className="size-4" />
          )}
          Comprobar
        </Button>
        <span className="self-center text-xs text-muted-foreground">Ctrl+Enter comprueba</span>
      </div>

      {run && <RunOutput result={run} />}
      {evaluation && (
        <EvaluationOutput evaluation={evaluation} stdins={exercise.cases.map((c) => c.stdin)} />
      )}

      {solved ? (
        <p
          role="status"
          className="rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success"
        >
          Resuelto. Lección marcada como hecha.
        </p>
      ) : (
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowHint(true)}>
              <Lightbulb className="size-4" />
              Pista
            </Button>
            {showHint && !gaveUp && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setGaveUp(true)}>
                Ver la solución
              </Button>
            )}
          </div>
          {showHint && (
            <p className="text-sm text-muted-foreground">
              <LessonText text={exercise.hint} />
            </p>
          )}
          {gaveUp && (
            <div className="grid gap-2">
              <p className="text-sm">
                Una que funciona. Escríbela tú en el editor en vez de copiarla, y cámbiale algo para
                ver qué se rompe.
              </p>
              <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-sm">
                {exercise.solution}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
