import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Check, Clock, Swords, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AVAILABLE_TRACKS, PLANNED_TRACKS, type Track } from "@/data/tracks";
import { useSession } from "@/features/auth/useSession";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Code Battle — Aprende a programar peleando" },
      {
        name: "description",
        content:
          "Plataforma para aprender a programar peleando. Dos jugadores reciben el mismo reto y el primero que lo resuelve le baja vida al otro. Curso de expresiones regulares desde cero, practica con rachas y duelos 1v1. En camino: SQL, Python, JavaScript y mas.",
      },
      { property: "og:title", content: "Code Battle — Aprende a programar peleando" },
      {
        property: "og:description",
        content:
          "Aprende a programar peleando. Lecciones de expresiones regulares, practica con retos y duelos 1v1, con un motor pensado para varios lenguajes.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://regex-battle.pwnotes.workers.dev/" },
      { property: "og:image", content: "https://regex-battle.pwnotes.workers.dev/og-image.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      {
        property: "og:image:alt",
        content: "Dos peleadores pixel-art lanzandose rayos de codigo en Code Battle",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://regex-battle.pwnotes.workers.dev/og-image.png" },
    ],
    links: [{ rel: "canonical", href: "https://regex-battle.pwnotes.workers.dev/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Code Battle",
          url: "https://regex-battle.pwnotes.workers.dev",
          applicationCategory: "EducationalApplication",
          inLanguage: "es",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description:
            "Juego web para aprender a programar peleando: curso de expresiones regulares, practica con retos y duelos 1v1.",
        }),
      },
    ],
  }),
  component: Index,
});

const MODES = [
  {
    to: "/aprender",
    icon: BookOpen,
    title: "Aprender",
    description:
      "El curso, de cero. Cada lección explica una pieza y la enseña funcionando sobre un texto que puedes editar.",
    cta: "Empezar el curso",
  },
  {
    to: "/solo",
    icon: Target,
    title: "Practicar",
    description:
      "Retos uno detrás de otro, sin rival y sin prisa. Llevas racha y reloj para medirte contra ti mismo.",
    cta: "Practicar",
  },
  {
    to: "/jugar",
    icon: Swords,
    title: "Pelear",
    description:
      "1v1 por código de sala. El mismo reto para los dos y gana quien lo resuelva primero, a 25 de daño por ronda.",
    cta: "Buscar pelea",
  },
] as const;

function TrackCard({ track }: { track: Track }) {
  const available = track.status === "disponible";

  return (
    <div
      className="grid gap-1.5 rounded-lg border p-3"
      style={{ borderLeftWidth: 3, borderLeftColor: track.accent }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{track.name}</span>
        {available ? (
          <Badge className="gap-1">
            <Check className="size-3" />
            Ya se puede
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <Clock className="size-3" />
            En camino
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{track.tagline}</p>
      <p className="text-xs text-muted-foreground/80">
        <span className="font-medium">Cómo se corrige:</span> {track.validation}
      </p>
    </div>
  );
}

function Index() {
  const { user, checked } = useSession();

  return (
    <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10">
      <section className="grid gap-4">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Aprende a programar peleando
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Dos jugadores reciben el mismo reto al mismo tiempo. El primero que lo resuelve le baja
          vida al otro. Y antes de pelear, un curso que te enseña desde cero lo que hace falta para
          ganar.
        </p>
        {checked && !user && (
          <div className="flex flex-wrap gap-2">
            <Button size="lg" asChild>
              <Link to="/auth">Crear cuenta gratis</Link>
            </Button>
          </div>
        )}
      </section>

      <section className="grid gap-4">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Tres formas de usarlo
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {MODES.map((mode) => (
            <Card key={mode.to} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <mode.icon aria-hidden className="size-4" />
                  {mode.title}
                </CardTitle>
                <CardDescription>{mode.description}</CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <Button variant={mode.to === "/aprender" ? "default" : "secondary"} asChild>
                  <Link to={user ? mode.to : "/auth"}>{mode.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <div className="grid gap-1">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Los lenguajes
          </h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Esto no es una plataforma de expresiones regulares. Se empezó por ahí porque es el único
            que se corrige sin ejecutar código, así que se podía comprobar que el juego entero
            funcionaba antes de meterse con entornos aislados. El motor de validación no sabe de
            regex, recibe el corrector que le pongan, así que sumar un lenguaje es escribir su
            corrector y su banco de retos, no rehacer el juego.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {AVAILABLE_TRACKS.map((track) => (
            <TrackCard key={track.slug} track={track} />
          ))}
          {PLANNED_TRACKS.map((track) => (
            <TrackCard key={track.slug} track={track} />
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          El orden no está cerrado. Si te sirve más uno que otro, ese sube.
        </p>
      </section>

      {user && (
        <p className="text-xs text-muted-foreground">
          <Link to="/diagnostico" className="underline underline-offset-4">
            Ver el banco de retos
          </Link>{" "}
          para comprobar qué hay cargado en la base.
        </p>
      )}
    </div>
  );
}
