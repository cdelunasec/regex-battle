import { useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_LANGUAGE } from "@/features/battle/matchSettings";
import { BashSolo } from "@/features/bash/BashSolo";
import { CSharpSolo } from "@/features/csharp/CSharpSolo";
import { RegexEditor } from "@/features/editor/RegexEditor";
import { useLiveEvaluation } from "@/features/editor/useLiveEvaluation";
import { difficultyLabel, MATCH_MODE_LABEL } from "@/features/problems/labels";
import type { SoloLanguage } from "@/features/solo/languages";
import { LanguagePicker, SoloScoreboard, SoloShell, SoloSummary } from "@/features/solo/SoloParts";
import { useSoloRun } from "@/features/solo/useSoloRun";
import type { ChallengeLanguage } from "@/engine";

export const Route = createFileRoute("/_authenticated/solo")({
  head: () => ({
    meta: [
      { title: "Modo solo — Code Battle" },
      {
        name: "description",
        content: "Practica expresiones regulares, KQL, C# o Bash contra el reloj, sin rival.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Solo,
});

function Solo() {
  const { user } = Route.useRouteContext();
  const [language, setLanguage] = useState<SoloLanguage>(DEFAULT_LANGUAGE);
  const picker = <LanguagePicker value={language} onChange={setLanguage} />;

  // Cambiar de lenguaje monta la otra pantalla desde cero, que es lo que tiene
  // que pasar: los retos son otros y la racha de la tanda anterior no cuenta.
  if (language === "csharp") {
    return <CSharpSolo userId={user.id} picker={picker} />;
  }
  if (language === "bash") {
    return <BashSolo userId={user.id} picker={picker} />;
  }
  return <PatternSolo userId={user.id} language={language} picker={picker} />;
}

/**
 * La práctica de los lenguajes que se corrigen al vuelo, regex y KQL: el
 * resultado se ve con cada tecla y los retos vienen de la base.
 */
function PatternSolo({
  userId,
  language,
  picker,
}: {
  userId: string;
  language: ChallengeLanguage;
  picker: ReactNode;
}) {
  const run = useSoloRun(userId, language);
  const { state, problem } = run;

  const [pattern, setPattern] = useState("");
  const result = useLiveEvaluation(pattern, problem, problem?.language);
  const solved = result?.passed ?? false;

  // Cada reto empieza con el campo en blanco. Se ajusta durante el render y no
  // en un efecto, porque un efecto corre DESPUÉS de pintar, y en ese hueco se
  // llegaba a evaluar el patrón del reto anterior contra el reto nuevo.
  const [shownProblemId, setShownProblemId] = useState(problem?.id);
  if (problem?.id !== shownProblemId) {
    setShownProblemId(problem?.id);
    setPattern("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (solved) run.solve();
  }

  if (run.loadError) {
    return (
      <SoloShell>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">No se pudo cargar el banco de retos</CardTitle>
            <CardDescription>{run.loadError}</CardDescription>
          </CardHeader>
        </Card>
      </SoloShell>
    );
  }

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
              {state.problems.length === 0
                ? "La base todavía no tiene retos. Cuando las migraciones estén aplicadas aparecen aquí."
                : `${state.problems.length} retos, de muy fácil a brutal. El reloj corre desde que empiezas, pero nadie te está apurando.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {picker}
            <div className="flex gap-2">
              <Button onClick={run.start} disabled={state.problems.length === 0}>
                Empezar
              </Button>
              <Button variant="outline" asChild>
                <Link to="/">Volver</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </SoloShell>
    );
  }

  if (state.status === "finished") {
    return (
      <SoloShell>
        <SoloSummary state={state} onAgain={run.reset} />
      </SoloShell>
    );
  }

  if (!problem) return null;

  return (
    <SoloShell>
      <SoloScoreboard state={state} elapsedMs={run.elapsedMs} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{difficultyLabel(problem.difficulty)}</Badge>
            <Badge variant="outline">{MATCH_MODE_LABEL[problem.match_mode]}</Badge>
          </div>
          <CardTitle className="text-lg leading-snug">{problem.prompt}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <RegexEditor
              value={pattern}
              onChange={setPattern}
              result={result}
              matchMode={problem.match_mode}
              language={problem.language}
              focusKey={problem.id}
              autoFocus
            />

            {solved && (
              <p
                role="status"
                className="rounded-md border border-success/40 bg-success/10 p-3 text-sm text-success"
              >
                Resuelto. Dale a Enter o al botón para seguir.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!solved}>
                Siguiente reto
              </Button>
              <Button type="button" variant="outline" onClick={run.skip}>
                <SkipForward className="size-4" />
                Saltar
              </Button>
              <Button type="button" variant="ghost" onClick={run.finish} className="ml-auto">
                Terminar tanda
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </SoloShell>
  );
}
