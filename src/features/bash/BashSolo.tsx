/**
 * La práctica solo de Bash.
 *
 * Se parece a la de C# porque se juega igual: se escribe un script, se ejecuta
 * para ver qué hace, y se comprueba contra todos los casos. La diferencia es
 * que aquí no hay que esperar a ningún compilador, así que corre al instante y
 * no hace falta el estado de "arrancando" que C# sí necesita.
 *
 * Lo que sí hay que enseñar y C# no tiene: con qué archivos arranca el reto.
 * Sin verlos, resolverlos sería adivinar.
 */
import { useState, type ReactNode } from "react";
import { CheckCheck, Lightbulb, Play, SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BASH_CHALLENGES, BASH_STARTER, type BashChallenge } from "@/data/bash-challenges";
import { CodeEditor } from "@/features/editor/CodeEditor";
import { LessonText } from "@/features/learn/LessonText";
import { difficultyLabel } from "@/features/problems/labels";
import { orderProblems } from "@/features/solo/soloRun";
import { SoloScoreboard, SoloShell, SoloSummary } from "@/features/solo/SoloParts";
import { useSoloSession } from "@/features/solo/useSoloSession";
import { ConsoleBox, EvaluationOutput, RunOutput, StartingFiles } from "./BashResults.tsx";
import { evaluateBash, type BashEvaluation } from "./grade.ts";
import { runBash } from "./interp.ts";
import type { BashRunResult } from "./protocol.ts";
import { useEffect } from "react";

/** Lo que más tumba al principio, dicho antes de que tropiece. */
const OUTPUT_RULE =
  'Imprime solo lo que pide el reto. Un `echo` de más, como `Buscando...`, hace que la salida ya no sea la esperada. Y entrecomilla las variables: `"$archivo"`, no `$archivo`.';

export function BashSolo({
  userId,
  picker,
  challenges = BASH_CHALLENGES,
  intro,
}: {
  userId: string | null;
  /** El selector de lenguaje. No lo lleva la práctica de fin de sección. */
  picker?: ReactNode;
  /** Por defecto el banco entero; la práctica de una sección pasa los suyos. */
  challenges?: BashChallenge[];
  /** Qué decir antes de empezar, cuando no es la tanda del banco completo. */
  intro?: ReactNode;
}) {
  const session = useSoloSession<BashChallenge>(userId);
  const { state, problem: challenge, load } = session;

  useEffect(() => {
    load(orderProblems(challenges));
  }, [load, challenges]);

  if (state.status === "loading") {
    return (
      <SoloShell>
        <p className="text-sm text-muted-foreground">Cargando retos…</p>
      </SoloShell>
    );
  }

  if (state.status === "ready") {
    return (
      <SoloShell>
        <Card>
          <CardHeader>
            <CardTitle>Modo solo</CardTitle>
            <CardDescription>
              {intro ?? (
                <>
                  {state.problems.length} retos de Bash, de mirar un archivo a automatizar un
                  reconocimiento entero: buscar, encadenar tuberías, decidir, analizar registros,
                  revisar permisos y armar tu propia herramienta.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {picker}
            <p className="rounded-md border bg-muted/40 p-3 text-sm">
              <LessonText text={OUTPUT_RULE} />
            </p>
            <div>
              <Button onClick={session.start}>Empezar</Button>
            </div>
          </CardContent>
        </Card>
      </SoloShell>
    );
  }

  if (state.status === "finished") {
    return (
      <SoloShell>
        <SoloSummary state={state} onAgain={session.reset} />
      </SoloShell>
    );
  }

  if (!challenge) return null;

  return (
    <SoloShell>
      <SoloScoreboard state={state} elapsedMs={session.elapsedMs} />
      {/*
        El key por slug arranca cada reto de cero. Sin él, React reusaría el
        componente y el script del reto anterior se quedaría en el editor.
      */}
      <ChallengeCard
        key={challenge.slug}
        challenge={challenge}
        onSolved={session.solve}
        onSkip={session.skip}
        onFinish={session.finish}
      />
    </SoloShell>
  );
}

function ChallengeCard({
  challenge,
  onSolved,
  onSkip,
  onFinish,
}: {
  challenge: BashChallenge;
  onSolved: () => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const [code, setCode] = useState(BASH_STARTER);
  const [run, setRun] = useState<BashRunResult | null>(null);
  const [evaluation, setEvaluation] = useState<BashEvaluation | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);

  const example = challenge.cases[0];
  const solved = evaluation?.passed ?? false;
  const errorLine = run?.diagnostic?.line ?? evaluation?.verdicts.find(hasLine)?.line;

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
    setEvaluation(evaluateBash(code, challenge.cases, (request, setup) => runBash(request, setup)));
    setRun(null);
  }

  return (
    <Card>
      <CardHeader className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{difficultyLabel(challenge.difficulty)}</Badge>
          <Badge variant="outline">Bash</Badge>
        </div>
        <CardTitle className="text-lg">{challenge.title}</CardTitle>
        <p className="leading-relaxed">
          <LessonText text={challenge.prompt} />
        </p>

        {example?.files && <StartingFiles files={example.files} />}

        {example && (
          <div className="grid gap-2 sm:grid-cols-2">
            {example.args && example.args.length > 0 && (
              <ConsoleBox
                label="Se llama con"
                text={`./script.sh ${example.args.map(quoteIfNeeded).join(" ")}`}
              />
            )}
            {example.stdin && <ConsoleBox label="Entrada de ejemplo" text={example.stdin} />}
            <ConsoleBox label="Salida esperada" text={example.expected} />
            {example.expectedExit !== undefined && example.expectedExit !== 0 && (
              <ConsoleBox label="Código de salida esperado" text={String(example.expectedExit)} />
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="grid gap-4">
        <CodeEditor
          value={code}
          onChange={setCode}
          onSubmit={check}
          label="Tu script"
          errorLines={errorLine === undefined ? [] : [errorLine]}
        />

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={execute}>
            <Play className="size-4" />
            Ejecutar
          </Button>
          <Button type="button" onClick={check}>
            <CheckCheck className="size-4" />
            Comprobar
          </Button>
          <span className="self-center text-xs text-muted-foreground">Ctrl+Enter comprueba</span>
        </div>

        {run && <RunOutput result={run} before={example?.files} />}
        {evaluation && <EvaluationOutput evaluation={evaluation} />}

        {solved ? (
          <div className="grid gap-3">
            <p
              role="status"
              className="rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success"
            >
              Resuelto: tu script pasó todos los casos.
            </p>
            <div>
              <Button onClick={onSolved}>Siguiente reto</Button>
            </div>
          </div>
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
              <Button type="button" variant="outline" size="sm" onClick={onSkip}>
                <SkipForward className="size-4" />
                Saltar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onFinish}
                className="ml-auto"
              >
                Terminar tanda
              </Button>
            </div>
            {showHint && (
              <p className="text-sm text-muted-foreground">
                <LessonText text={challenge.hint} />
              </p>
            )}
            {gaveUp && (
              <div className="grid gap-2">
                <p className="text-sm">
                  Una solución que funciona. Antes de seguir, escríbela tú y cámbiale algo para ver
                  qué se rompe: copiarla sin más no enseña.
                </p>
                <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-sm">
                  {challenge.solution}
                </pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Un argumento con espacios se enseña entrecomillado, que es como se escribe. */
function quoteIfNeeded(argument: string): string {
  return /\s/.test(argument) ? `"${argument}"` : argument;
}

function hasLine(
  verdict: BashEvaluation["verdicts"][number],
): verdict is Extract<BashEvaluation["verdicts"][number], { line?: number }> {
  return verdict.kind === "syntax_error" || verdict.kind === "unsupported";
}
