import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  courseOfLesson,
  findLesson,
  findSection,
  nextLesson,
  type BashLesson,
  type CSharpLesson,
  type Lesson,
  type PatternLesson,
} from "@/data/lessons";
import { BashExampleRunner, BashExercise } from "@/features/bash/BashLessonBlocks";
import { StartingFiles } from "@/features/bash/BashResults";
import { mergeFiles } from "@/features/bash/vfs";
import { CSharpExampleRunner, CSharpExercise } from "@/features/csharp/CSharpLessonBlocks";
import { RegexEditor } from "@/features/editor/RegexEditor";
import { useLiveEvaluation } from "@/features/editor/useLiveEvaluation";
import { LessonText } from "@/features/learn/LessonText";
import { KqlPlayground } from "@/features/learn/KqlPlayground";
import { PatternPlayground } from "@/features/learn/PatternPlayground";
import { useProgress } from "@/features/learn/useProgress";

export const Route = createFileRoute("/_authenticated/aprender/$slug")({
  head: () => ({
    meta: [
      { title: "Lección — Code Battle" },
      { name: "description", content: "Una pieza del lenguaje, explicada y funcionando." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Leccion,
});

function Leccion() {
  const { slug } = Route.useParams();
  const { user } = Route.useRouteContext();
  const lesson = findLesson(slug);

  if (!lesson) {
    return (
      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
        <p className="text-sm text-muted-foreground">Esa lección no existe.</p>
        <div>
          <Button variant="outline" asChild>
            <Link to="/aprender">Ver el temario</Link>
          </Button>
        </div>
      </div>
    );
  }

  /*
   * El `key` con el slug no es decoración, arregla un bug real.
   *
   * Sin él, React reutiliza los mismos componentes al pasar de una lección a
   * otra, y cada campo de ejemplo se quedaba con el patrón que el jugador
   * había dejado escrito en la lección anterior. El texto de muestra y la nota
   * sí cambiaban, así que el ejemplo enseñaba una cosa y explicaba otra, que
   * es justo lo peor que puede pasar en un curso.
   *
   * Con el key, cambiar de lección monta todo de cero: el patrón de cada
   * ejemplo vuelve al del temario, y el ejercicio arranca en blanco.
   */
  return <Contenido key={lesson.slug} lesson={lesson} userId={user.id} />;
}

function Contenido({ lesson, userId }: { lesson: Lesson; userId: string }) {
  const navigate = useNavigate();
  const { completed, complete } = useProgress(userId);
  const [solved, setSolved] = useState(false);

  /**
   * Al resolverlo se marca solo. Pedirle además que pulse "hecho" sería
   * pedirle que confirme algo que ya se ve en pantalla.
   *
   * La solución se guarda para poder repasarla, pero solo en los lenguajes de
   * patrones: un programa de C# no cabe en esa columna, que está topada en 200
   * caracteres.
   */
  const markSolved = useCallback(
    (solution?: string) => {
      setSolved(true);
      void complete(lesson.slug, solution);
    },
    [complete, lesson.slug],
  );

  const section = findSection(lesson.sectionSlug);
  const course = courseOfLesson(lesson);
  const courseLessons = course?.lessons ?? [];
  const position = courseLessons.findIndex((l) => l.slug === lesson.slug) + 1;
  const following = nextLesson(lesson.slug);
  const alreadyDone = completed.has(lesson.slug);

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Link to="/aprender" className="underline underline-offset-4">
            Temario
          </Link>
          <span aria-hidden>/</span>
          <span>{course?.title}</span>
          <span aria-hidden>/</span>
          <span>{section?.title}</span>
          <Badge variant="outline" className="ml-auto">
            {position} de {courseLessons.length}
          </Badge>
        </div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          {lesson.title}
          {alreadyDone && <Check className="size-5 text-success" aria-label="completada" />}
        </h1>
        <p className="text-muted-foreground">
          <LessonText text={lesson.summary} />
        </p>
      </header>

      <div className="grid gap-4">
        {lesson.body.map((paragraph, index) => (
          <p key={index} className="leading-relaxed">
            <LessonText text={paragraph} />
          </p>
        ))}
      </div>

      {lesson.language === "csharp" ? (
        <CSharpLessonWork lesson={lesson} solved={solved} onSolved={markSolved} />
      ) : lesson.language === "bash" ? (
        <BashLessonWork lesson={lesson} solved={solved} onSolved={markSolved} />
      ) : (
        <PatternLessonWork lesson={lesson} solved={solved} onSolved={markSolved} />
      )}

      <div className="flex flex-wrap gap-2">
        {following ? (
          <Button
            onClick={() =>
              void navigate({ to: "/aprender/$slug", params: { slug: following.slug } })
            }
            disabled={!solved && !alreadyDone}
          >
            Siguiente: {following.title}
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button asChild disabled={!solved && !alreadyDone}>
            <Link to="/aprender/practica/$section" params={{ section: lesson.sectionSlug }}>
              A la práctica final
            </Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to="/aprender">Temario</Link>
        </Button>
      </div>
    </div>
  );
}

/** Ejemplos y ejercicio de una lección de regex o KQL: se corrige con cada tecla. */
function PatternLessonWork({
  lesson,
  solved,
  onSolved,
}: {
  lesson: PatternLesson;
  solved: boolean;
  onSolved: (solution?: string) => void;
}) {
  const [pattern, setPattern] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);

  const result = useLiveEvaluation(pattern, lesson.exercise, lesson.language);
  const passed = result?.passed ?? false;
  const isRegex = lesson.language === "regex";

  useEffect(() => {
    if (passed) onSolved(pattern);
  }, [passed, pattern, onSolved]);

  return (
    <>
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Míralo funcionando
        </h2>
        <p className="text-sm text-muted-foreground">
          {isRegex
            ? "Los patrones se pueden editar. Cámbialos y mira cómo se mueve el resaltado, que es donde de verdad se aprende."
            : "Las consultas se pueden editar. Cámbialas y mira si el evento sigue entrando, que es donde de verdad se aprende."}
        </p>
        {lesson.examples.map((example, index) =>
          isRegex ? (
            <PatternPlayground
              key={`${lesson.slug}-${index}`}
              initialPattern={example.pattern}
              sample={example.sample}
              note={example.note}
            />
          ) : (
            <KqlPlayground
              key={`${lesson.slug}-${index}`}
              initialQuery={example.pattern}
              sample={example.sample}
              note={example.note}
            />
          ),
        )}
      </section>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Te toca</CardTitle>
          <CardDescription>
            <LessonText text={lesson.exercise.prompt} />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event: FormEvent) => event.preventDefault()} className="grid gap-5">
            <RegexEditor
              value={pattern}
              onChange={setPattern}
              result={result}
              matchMode={lesson.exercise.match_mode}
              language={lesson.language}
              focusKey={lesson.slug}
            />

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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHint(true)}
                  >
                    <Lightbulb className="size-4" />
                    Pista
                  </Button>
                  {showHint && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setGaveUp(true)}>
                      Ver la solución
                    </Button>
                  )}
                </div>
                {showHint && (
                  <p className="text-sm text-muted-foreground">
                    <LessonText text={lesson.exercise.hint} />
                  </p>
                )}
                {gaveUp && (
                  <p className="text-sm">
                    Una que funciona:{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                      {lesson.exercise.solution}
                    </code>
                    . Cópiala, pero antes de seguir cámbiale algo y mira qué se rompe.
                  </p>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </>
  );
}

/** Ejemplos y ejercicio de una lección de C#: hay que compilar, así que van por botón. */
function CSharpLessonWork({
  lesson,
  solved,
  onSolved,
}: {
  lesson: CSharpLesson;
  solved: boolean;
  onSolved: (solution?: string) => void;
}) {
  // El progreso de C# se guarda sin solución: un programa no cabe en la
  // columna, que está topada en 200 caracteres.
  const markSolved = useCallback(() => onSolved(), [onSolved]);

  return (
    <>
      <section className="grid gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Míralo funcionando
        </h2>
        <p className="text-sm text-muted-foreground">
          Los programas se pueden ejecutar y cambiar aquí mismo. Dale a Ejecutar, después cámbiales
          algo y vuelve a darle: ahí es donde de verdad se aprende.
        </p>
        {lesson.examples.map((example, index) => (
          <CSharpExampleRunner key={`${lesson.slug}-${index}`} example={example} />
        ))}
      </section>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Te toca</CardTitle>
          <CardDescription>
            <LessonText text={lesson.exercise.prompt} />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CSharpExercise exercise={lesson.exercise} solved={solved} onSolved={markSolved} />
        </CardContent>
      </Card>
    </>
  );
}

/** Ejemplos y ejercicio de una lección de Bash: se ejecutan al instante. */
function BashLessonWork({
  lesson,
  solved,
  onSolved,
}: {
  lesson: BashLesson;
  solved: boolean;
  onSolved: (solution?: string) => void;
}) {
  // Igual que en C#: el progreso se guarda sin solución, porque un script no
  // cabe en la columna.
  const markSolved = useCallback(() => onSolved(), [onSolved]);

  /*
   * El árbol de archivos se pinta UNA vez para toda la lección.
   *
   * Los ejemplos de una lección comparten casi siempre el mismo escenario, así
   * que antes se repetía en cada uno y otra vez en el ejercicio: cuatro veces
   * seis archivos, que tapaban el texto que había que leer.
   */
  const files = useMemo(
    () =>
      mergeFiles(
        ...lesson.examples.map((example) => example.files),
        lesson.exercise.cases[0]?.files,
      ),
    [lesson],
  );

  return (
    <>
      {Object.keys(files).length > 0 && (
        <StartingFiles files={files} title="Los archivos de esta lección" />
      )}

      <section className="grid gap-3">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Míralo funcionando
        </h2>
        <p className="text-sm text-muted-foreground">
          Los scripts se pueden ejecutar y cambiar aquí mismo. Dale a Ejecutar, después cámbiales
          algo y vuelve a darle: ahí es donde de verdad se aprende.
        </p>
        {lesson.examples.map((example, index) => (
          <BashExampleRunner key={`${lesson.slug}-${index}`} example={example} />
        ))}
      </section>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Te toca</CardTitle>
          <CardDescription>
            <LessonText text={lesson.exercise.prompt} />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BashExercise exercise={lesson.exercise} solved={solved} onSolved={markSolved} />
        </CardContent>
      </Card>
    </>
  );
}
