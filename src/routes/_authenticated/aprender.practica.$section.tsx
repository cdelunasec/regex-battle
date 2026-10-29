import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Dumbbell, Loader2, SkipForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BASH_CHALLENGES } from "@/data/bash-challenges";
import { CSHARP_CHALLENGES } from "@/data/csharp-challenges";
import { SECTIONS } from "@/data/lessons";
import { BashSolo } from "@/features/bash/BashSolo";
import { CSharpSolo } from "@/features/csharp/CSharpSolo";
import { RegexEditor } from "@/features/editor/RegexEditor";
import { useLiveEvaluation } from "@/features/editor/useLiveEvaluation";
import { difficultyLabel, MATCH_MODE_LABEL } from "@/features/problems/labels";
import { supabase } from "@/integrations/supabase/client";
import { toProblems, type Problem } from "@/types/game";

export const Route = createFileRoute("/_authenticated/aprender/practica/$section")({
  head: () => ({
    meta: [
      { title: "Práctica — Code Battle" },
      { name: "description", content: "Aplica lo aprendido con retos reales del banco." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Practica,
});

function Practica() {
  const { section: sectionSlug } = Route.useParams();
  const { user } = Route.useRouteContext();
  const section = useMemo(() => SECTIONS.find((s) => s.slug === sectionSlug), [sectionSlug]);

  // Los retos de C# y de Bash no están en la base, así que esta práctica se
  // juega con la misma pantalla de la práctica solo, pero solo con los de la
  // sección.
  const csharpChallenges = useMemo(
    () =>
      section?.language === "csharp"
        ? CSHARP_CHALLENGES.filter((challenge) => section.practiceSlugs.includes(challenge.slug))
        : [],
    [section],
  );

  const bashChallenges = useMemo(
    () =>
      section?.language === "bash"
        ? BASH_CHALLENGES.filter((challenge) => section.practiceSlugs.includes(challenge.slug))
        : [],
    [section],
  );

  const [problems, setProblems] = useState<Problem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [solvedCount, setSolvedCount] = useState(0);
  const [pattern, setPattern] = useState("");

  const problem = problems?.[index] ?? null;
  const result = useLiveEvaluation(pattern, problem, problem?.language);
  const solved = result?.passed ?? false;

  // Los retos son los mismos del 1v1, leídos de la base con RLS. La práctica no
  // tiene banco aparte a propósito: lo que practicas aquí es lo que te va a
  // salir peleando.
  useEffect(() => {
    if (!section) return;
    let active = true;

    void supabase
      .from("problems")
      .select("*")
      .in("slug", section.practiceSlugs)
      .then(({ data }) => {
        if (!active) return;
        const loaded = toProblems(data ?? []);
        // Se respeta el orden del temario, no el que devuelva la base.
        loaded.sort(
          (a, b) => section.practiceSlugs.indexOf(a.slug) - section.practiceSlugs.indexOf(b.slug),
        );
        setProblems(loaded);
      });

    return () => {
      active = false;
    };
  }, [section]);

  // Se ajusta durante el render y no en un efecto, para que no quede un hueco
  // en el que se evalúa el patrón del reto anterior contra el reto nuevo.
  const [shownProblemId, setShownProblemId] = useState(problem?.id);
  if (problem?.id !== shownProblemId) {
    setShownProblemId(problem?.id);
    setPattern("");
  }

  if (!section) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Esa práctica no existe.</p>
        <div>
          <Button variant="outline" asChild>
            <Link to="/aprender">Temario</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  if (section.language === "csharp") {
    return (
      <CSharpSolo
        userId={user.id}
        challenges={csharpChallenges}
        intro={`${csharpChallenges.length} retos para asentar lo de ${section.title}. Son los mismos que salen en la práctica solo, elegidos para lo que acabas de aprender.`}
      />
    );
  }

  if (section.language === "bash") {
    return (
      <BashSolo
        userId={user.id}
        challenges={bashChallenges}
        intro={`${bashChallenges.length} retos para asentar lo de ${section.title}. Son los mismos que salen en la práctica solo, elegidos para lo que acabas de aprender.`}
      />
    );
  }

  if (problems === null) {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Cargando los retos...
        </p>
      </Shell>
    );
  }

  const finished = index >= problems.length;

  if (finished) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="size-5 text-success" />
              Práctica terminada
            </CardTitle>
            <CardDescription>
              Resolviste {solvedCount} de {problems.length} en {section.title}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setIndex(0);
                setSolvedCount(0);
              }}
            >
              Otra vez
            </Button>
            <Button variant="outline" asChild>
              <Link to="/aprender">Volver al temario</Link>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (!problem) {
    return (
      <Shell>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sin retos todavía</CardTitle>
            <CardDescription>
              La base no devolvió los retos de esta sección. Puede que falten las migraciones.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  function advance(wasSolved: boolean) {
    if (wasSolved) setSolvedCount((current) => current + 1);
    setIndex((current) => current + 1);
  }

  return (
    <Shell>
      <header className="grid gap-2">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Dumbbell className="size-5" />
          Práctica: {section.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          Retos reales del banco, los mismos que salen en el 1v1. Aquí sin reloj y sin nadie
          disparándote.
        </p>
        <div className="flex items-center gap-3">
          <Progress value={(index / problems.length) * 100} className="flex-1" />
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {index + 1}/{problems.length}
          </span>
        </div>
      </header>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{difficultyLabel(problem.difficulty)}</Badge>
            <Badge variant="outline">{MATCH_MODE_LABEL[problem.match_mode]}</Badge>
          </div>
          <CardTitle className="text-lg leading-snug">{problem.prompt}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              if (solved) advance(true);
            }}
            className="grid gap-5"
          >
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
                Resuelto. Dale a Enter para el siguiente.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!solved}>
                Siguiente
              </Button>
              <Button type="button" variant="outline" onClick={() => advance(false)}>
                <SkipForward className="size-4" />
                Saltar
              </Button>
              <Button variant="ghost" asChild className="ml-auto">
                <Link to="/aprender">Salir</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto grid max-w-3xl gap-5 px-4 py-8">{children}</div>;
}
