import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Check, Dumbbell, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COURSES, lessonsOfSection, type Course } from "@/data/lessons";
import { LessonText } from "@/features/learn/LessonText";
import { useProgress } from "@/features/learn/useProgress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/aprender/")({
  head: () => ({
    meta: [
      { title: "Aprender — Code Battle" },
      {
        name: "description",
        content:
          "Cursos de expresiones regulares y de KQL, de cero, con ejemplos que puedes tocar.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Aprender,
});

function Aprender() {
  const { user } = Route.useRouteContext();
  const { completed, loading, unavailable, reset } = useProgress(user.id);

  return (
    <div className="mx-auto grid max-w-3xl gap-6 px-4 py-8">
      <header className="grid gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <BookOpen className="size-6" />
          Aprender
        </h1>
        <p className="text-muted-foreground">
          Dos cursos, cada uno de cero. Se aprende lo mismo que después sale en la práctica y en el
          1v1, porque los retos salen del mismo banco.
        </p>
      </header>

      {unavailable && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          El progreso no se está guardando. Falta aplicar la migración de{" "}
          <code className="font-mono">lesson_progress</code> en la base.
        </p>
      )}

      <Tabs defaultValue={COURSES[0]!.language}>
        <TabsList>
          {COURSES.map((course) => (
            <TabsTrigger key={course.language} value={course.language}>
              {course.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {COURSES.map((course) => (
          <TabsContent key={course.language} value={course.language} className="grid gap-6">
            <CourseView
              course={course}
              completed={completed}
              loading={loading}
              onReset={() => void reset()}
            />
          </TabsContent>
        ))}
      </Tabs>

      <div>
        <Button variant="outline" asChild>
          <Link to="/">Volver</Link>
        </Button>
      </div>
    </div>
  );
}

function CourseView({
  course,
  completed,
  loading,
  onReset,
}: {
  course: Course;
  completed: Set<string>;
  loading: boolean;
  onReset: () => void;
}) {
  const done = course.lessons.filter((lesson) => completed.has(lesson.slug)).length;
  const percent = (done / course.lessons.length) * 100;

  return (
    <div className="grid gap-6 pt-4">
      <p className="text-sm text-muted-foreground">{course.summary}</p>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">
            {done} de {course.lessons.length} lecciones
          </span>
          {done > 0 && (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={onReset}>
              Reiniciar el progreso
            </Button>
          )}
        </div>
        <Progress value={percent} />
      </div>

      {course.sections.map((section, sectionIndex) => {
        const lessons = lessonsOfSection(section.slug);
        const sectionDone = lessons.every((lesson) => completed.has(lesson.slug));
        // Se abre la siguiente sección cuando la anterior está terminada, pero
        // la primera siempre está abierta y nada impide saltar dentro de una.
        const previous = course.sections[sectionIndex - 1];
        const locked =
          sectionIndex > 0 &&
          !loading &&
          previous !== undefined &&
          !lessonsOfSection(previous.slug).every((lesson) => completed.has(lesson.slug));

        return (
          <Card key={section.slug} className={cn(locked && "opacity-70")}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant={sectionDone ? "default" : "secondary"}>{sectionIndex + 1}</Badge>
                <CardTitle className="text-base">{section.title}</CardTitle>
                {sectionDone && <Check className="size-4 text-success" />}
                {locked && <Lock className="size-4 text-muted-foreground" />}
              </div>
              <CardDescription>{section.summary}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-1.5">
              {lessons.map((lesson) => {
                const isDone = completed.has(lesson.slug);
                return (
                  <Link
                    key={lesson.slug}
                    to="/aprender/$slug"
                    params={{ slug: lesson.slug }}
                    className="flex items-center gap-3 rounded-md border px-3 py-2 transition-colors hover:bg-accent"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border text-xs",
                        isDone && "border-success bg-success/20 text-success",
                      )}
                    >
                      {isDone ? <Check className="size-3" /> : ""}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{lesson.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        <LessonText text={lesson.summary} />
                      </span>
                    </span>
                    <span className="sr-only">{isDone ? "completada" : "pendiente"}</span>
                  </Link>
                );
              })}

              <Link
                to="/aprender/practica/$section"
                params={{ section: section.slug }}
                className="mt-1 flex items-center gap-3 rounded-md border border-dashed px-3 py-2 transition-colors hover:bg-accent"
              >
                <Dumbbell aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Práctica de la sección</span>
                  <span className="block text-xs text-muted-foreground">
                    {section.practiceSlugs.length}{" "}
                    {section.practiceSlugs.length === 1 ? "reto" : "retos"} de verdad del banco, los
                    mismos que salen en el 1v1.
                  </span>
                </span>
              </Link>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
