import { useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCheck, Lightbulb, Loader2, Play, SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CSHARP_CHALLENGES, CSHARP_STARTER, type CSharpChallenge } from "@/data/csharp-challenges";
import { LessonText } from "@/features/learn/LessonText";
import { difficultyLabel } from "@/features/problems/labels";
import { orderProblems } from "@/features/solo/soloRun";
import { SoloScoreboard, SoloShell, SoloSummary } from "@/features/solo/SoloParts";
import { useSoloSession } from "@/features/solo/useSoloSession";
import { CodeEditor } from "@/features/editor/CodeEditor";
import { ConsoleBox, EvaluationOutput, RunOutput, RunnerStatus } from "./CSharpResults.tsx";
import { evaluateCSharp, type CSharpEvaluation } from "./grade.ts";
import type { CSharpRunResult } from "./protocol.ts";
import { csharpRunner } from "./runner.ts";
import { useCSharpRunner } from "./useCSharpRunner.ts";

/** La regla que más tumba a quien viene de clase, dicha antes de que tropiece. */
const OUTPUT_RULE =
  "Imprime solo lo que pide el reto. Nada de mensajes como `Ingresa un número:` antes de leer: el corrector compara la salida entera, y ese texto de más la hace distinta.";

/**
 * La práctica solo de C#.
 *
 * Tiene su pantalla y no reusa la de regex porque se juega distinto. En regex
 * la corrección es instantánea y va con cada tecla. Aquí hay que compilar, así
 * que hay dos botones: Ejecutar, que corre el programa con la entrada del
 * ejemplo y enseña lo que imprime, y Comprobar, que lo pasa por todos los
 * casos. El marcador y el resumen sí son los mismos.
 */
export function CSharpSolo({
  userId,
  picker,
  challenges = CSHARP_CHALLENGES,
  intro,
}: {
  userId: string | null;
  /** El selector de lenguaje. No lo lleva la práctica de fin de sección. */
  picker?: ReactNode;
  /** Por defecto el banco entero; la práctica de una sección pasa los suyos. */
  challenges?: CSharpChallenge[];
  /** Qué decir antes de empezar, cuando no es la tanda del banco completo. */
  intro?: ReactNode;
}) {
  const runnerState = useCSharpRunner();
  const session = useSoloSession<CSharpChallenge>(userId);
  const { state, problem: challenge, load } = session;

  // El banco vive en el repo: se carga de una vez, barajado dentro de cada nivel.
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
                  {state.problems.length} retos de C#, de muy fácil a brutal: entrada y salida,
                  condicionales, bucles, arreglos y texto, y algoritmos. Cada uno es un programa de
                  consola que lee datos e imprime el resultado.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {picker}
            <RunnerStatus state={runnerState} />
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
        El key por slug arranca cada reto de cero: código, resultados y pista.
        Sin él, React reusaría el componente y el código del reto anterior se
        quedaría en el editor del nuevo.
      */}
      <ChallengeCard
        key={challenge.slug}
        challenge={challenge}
        runnerState={runnerState}
        onSolved={session.solve}
        onSkip={session.skip}
        onFinish={session.finish}
      />
    </SoloShell>
  );
}

function ChallengeCard({
  challenge,
  runnerState,
  onSolved,
  onSkip,
  onFinish,
}: {
  challenge: CSharpChallenge;
  runnerState: ReturnType<typeof useCSharpRunner>;
  onSolved: () => void;
  onSkip: () => void;
  onFinish: () => void;
}) {
  const [code, setCode] = useState(CSHARP_STARTER);
  const [busy, setBusy] = useState<"run" | "check" | null>(null);
  const [run, setRun] = useState<CSharpRunResult | null>(null);
  const [evaluation, setEvaluation] = useState<CSharpEvaluation | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);

  // Si el jugador salta de reto con una ejecución en marcha, su resultado no
  // puede aterrizar en el reto siguiente. Al desmontar, se ignora.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const example = challenge.cases[0];
  const solved = evaluation?.allPassed ?? false;
  const compileErrors = evaluation?.compileErrors ?? run?.diagnostics ?? [];
  const errorLines = compileErrors.flatMap((d) => (d.line === undefined ? [] : [d.line]));

  async function execute() {
    if (busy || !example) return;
    setBusy("run");
    const result = await csharpRunner().run(code, example.stdin);
    if (!mounted.current) return;
    setRun(result);
    setEvaluation(null);
    setBusy(null);
  }

  async function check() {
    if (busy) return;
    setBusy("check");
    const result = await evaluateCSharp(code, challenge.cases, csharpRunner());
    if (!mounted.current) return;
    setEvaluation(result);
    setRun(null);
    setBusy(null);
  }

  return (
    <Card>
      <CardHeader className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{difficultyLabel(challenge.difficulty)}</Badge>
          <Badge variant="outline">C#</Badge>
        </div>
        <CardTitle className="text-lg">{challenge.title}</CardTitle>
        <p className="leading-relaxed">
          <LessonText text={challenge.prompt} />
        </p>
        {example && (
          <div className="grid gap-2 sm:grid-cols-2">
            <ConsoleBox label="Entrada de ejemplo" text={example.stdin} />
            <ConsoleBox label="Salida esperada" text={example.expected} />
          </div>
        )}
      </CardHeader>

      <CardContent className="grid gap-4">
        <RunnerStatus state={runnerState} />

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
          <Button type="button" onClick={() => void check()} disabled={busy !== null}>
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
          <EvaluationOutput evaluation={evaluation} stdins={challenge.cases.map((c) => c.stdin)} />
        )}

        {solved ? (
          <div className="grid gap-3">
            <p
              role="status"
              className="rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success"
            >
              Resuelto: tu programa pasó todos los casos.
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
                  Una solución que funciona. Antes de seguir, escríbela tú en el editor y cámbiale
                  algo para ver qué se rompe: copiarla sin más no enseña.
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
