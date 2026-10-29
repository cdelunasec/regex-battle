/**
 * Los bloques de una lección de Bash: el ejemplo que se corre y el ejercicio.
 *
 * El ejemplo es editable a propósito, igual que en C#. Leer que `sed 's/-/+/'`
 * cambia una sola vez por línea no enseña ni la mitad que añadirle la `g` y ver
 * la diferencia en la salida.
 *
 * Aquí no hay compilador que esperar, así que no hace falta el estado de
 * "arrancando" ni los botones deshabilitados mientras tanto: se ejecuta y se
 * ve.
 */
import { useEffect, useState } from "react";
import { CheckCheck, Lightbulb, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BashExample, BashLessonExercise } from "@/data/lesson-types";
import { BASH_STARTER } from "@/data/bash-challenges";
import { CodeEditor } from "@/features/editor/CodeEditor";
import { LessonText } from "@/features/learn/LessonText";
import { ConsoleBox, EvaluationOutput, RunOutput } from "./BashResults.tsx";
import { evaluateBash, type BashEvaluation } from "./grade.ts";
import { runBash } from "./interp.ts";
import type { BashRunResult } from "./protocol.ts";

/** Un script de la lección, listo para ejecutar y para que lo cambien. */
export function BashExampleRunner({ example }: { example: BashExample }) {
  const [script, setScript] = useState(example.script);
  const [result, setResult] = useState<BashRunResult | null>(null);

  function execute() {
    setResult(
      runBash(
        { source: script, stdin: example.stdin ?? "", args: example.args ?? [] },
        { files: example.files ?? {} },
      ),
    );
  }

  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
      {/*
        Aquí no va el árbol de archivos: lo pinta la lección una sola vez, y
        antes se repetía en cada ejemplo hasta tapar el texto.
      */}
      <CodeEditor
        value={script}
        onChange={setScript}
        onSubmit={execute}
        label="Script de ejemplo"
        minRows={4}
      />

      {example.args && example.args.length > 0 && (
        <ConsoleBox label="Se llama con" text={`./script.sh ${example.args.join(" ")}`} />
      )}
      {example.stdin && <ConsoleBox label="Lo que lee" text={example.stdin} />}

      <div>
        <Button type="button" size="sm" variant="outline" onClick={execute}>
          <Play className="size-4" />
          Ejecutar
        </Button>
      </div>

      {result && <RunOutput result={result} before={example.files} />}

      <p className="text-xs text-muted-foreground">
        <LessonText text={example.note} />
      </p>
    </div>
  );
}

/**
 * El ejercicio de una lección.
 *
 * Igual que en la práctica solo, con una diferencia: al pasar todos los casos
 * se marca la lección como hecha.
 */
export function BashExercise({
  exercise,
  solved,
  onSolved,
}: {
  exercise: BashLessonExercise;
  solved: boolean;
  onSolved: () => void;
}) {
  const [code, setCode] = useState(exercise.starter ?? BASH_STARTER);
  const [run, setRun] = useState<BashRunResult | null>(null);
  const [evaluation, setEvaluation] = useState<BashEvaluation | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);

  const example = exercise.cases[0];
  const errorLine = run?.diagnostic?.line;

  useEffect(() => {
    if (evaluation?.passed) onSolved();
  }, [evaluation, onSolved]);

  function execute() {
    if (!example) return;
    setRun(
      runBash(
        { source: code, stdin: example.stdin ?? "", args: example.args ?? [] },
        { files: example.files ?? {} },
      ),
    );
    setEvaluation(null);
  }

  function check() {
    setEvaluation(evaluateBash(code, exercise.cases, (request, setup) => runBash(request, setup)));
    setRun(null);
  }

  return (
    <div className="grid gap-4">
      {example && (
        <div className="grid gap-2 sm:grid-cols-2">
          {example.args && example.args.length > 0 && (
            <ConsoleBox label="Se llama con" text={`./script.sh ${example.args.join(" ")}`} />
          )}
          {example.stdin && <ConsoleBox label="Entrada de ejemplo" text={example.stdin} />}
          <ConsoleBox label="Salida esperada" text={example.expected} />
        </div>
      )}

      <CodeEditor
        value={code}
        onChange={setCode}
        onSubmit={check}
        label="Tu script"
        errorLines={errorLine === undefined ? [] : [errorLine]}
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={execute}>
          <Play className="size-4" />
          Ejecutar
        </Button>
        <Button type="button" size="sm" onClick={check}>
          <CheckCheck className="size-4" />
          Comprobar
        </Button>
        <span className="self-center text-xs text-muted-foreground">Ctrl+Enter comprueba</span>
      </div>

      {run && <RunOutput result={run} before={example?.files} />}
      {evaluation && <EvaluationOutput evaluation={evaluation} />}

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
