import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { THEME_INIT_SCRIPT } from "@/features/theme/theme.ts";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    console.error("[root error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Code Battle — Aprende a programar peleando" },
      {
        name: "description",
        content:
          "Code Battle: aprende a programar peleando. Curso de expresiones regulares, practica con retos y duelos 1v1. Pronto SQL, Python, JavaScript y mas.",
      },
      {
        name: "keywords",
        content:
          "aprender a programar, expresiones regulares, regex, juego de programacion, aprender regex, duelos de codigo, curso de programacion, SQL, Python, JavaScript, code battle",
      },
      { property: "og:title", content: "Code Battle — Aprende a programar peleando" },
      {
        property: "og:description",
        content:
          "Un juego web para aprender a programar peleando, con lecciones, practica y duelos 1v1. Empieza con expresiones regulares.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Code Battle" },
      { property: "og:locale", content: "es" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "google-site-verification",
        content: "7K1pkf592Sl-cR910TjdfPhXfrIgox_RbwvNed2dyIY",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Code Battle",
          url: "https://regex-battle.pwnotes.workers.dev",
          inLanguage: "es",
          description:
            "Plataforma para aprender a programar peleando: lecciones, practica y duelos 1v1.",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // La app está en español. Con lang="en" los lectores de pantalla la leen con
  // pronunciación inglesa y los buscadores la indexan mal.
  //
  // suppressHydrationWarning porque el script de abajo le pone la clase "dark"
  // al <html> antes de que React hidrate: React ve un atributo que él no puso y
  // se quejaría de un desajuste que en realidad es lo que queremos.
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Antes que nada, incluso antes de la hoja de estilos: si el tema
            guardado es oscuro, hay que saberlo antes del primer pintado o se ve
            un fogonazo blanco en cada carga. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* La cabecera va aquí para que esté en todas las pantallas: es donde
          viven la navegación entre modos y el cerrar sesión. */}
      <AppHeader />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
