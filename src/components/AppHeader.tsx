import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BookOpen, LogOut, Menu, Swords, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/features/theme/ThemeToggle";
import { useSession } from "@/features/auth/useSession";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/aprender", label: "Aprender", icon: BookOpen },
  { to: "/solo", label: "Practicar", icon: Target },
  { to: "/jugar", label: "Pelear", icon: Swords },
] as const;

/**
 * La cabecera de toda la app.
 *
 * Vive en el layout raíz para que esté en cada pantalla. Antes no había
 * ninguna, así que no existía forma de cerrar sesión ni de moverse entre los
 * tres modos sin volver al inicio a mano.
 */
export function AppHeader() {
  const { user, checked } = useSession();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(false);

  async function signOut() {
    setOpenMenu(false);
    await supabase.auth.signOut();
    void navigate({ to: "/", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <Swords aria-hidden className="size-5 text-primary" />
          <span>Code Battle</span>
        </Link>

        {user && (
          <nav aria-label="Secciones" className="ml-4 hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Fuera del bloque de sesión: el tema se cambia con o sin cuenta. */}
          <ThemeToggle />
          {checked && user ? (
            <>
              <span className="hidden max-w-48 truncate text-xs text-muted-foreground md:inline">
                {user.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void signOut()}
                className="hidden sm:inline-flex"
              >
                <LogOut className="size-4" />
                Salir
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden"
                aria-expanded={openMenu}
                aria-label={openMenu ? "Cerrar el menú" : "Abrir el menú"}
                onClick={() => setOpenMenu((current) => !current)}
              >
                {openMenu ? <X className="size-5" /> : <Menu className="size-5" />}
              </Button>
            </>
          ) : (
            checked && (
              <Button size="sm" asChild>
                <Link to="/auth">Entrar</Link>
              </Button>
            )
          )}
        </div>
      </div>

      {/* En el móvil la navegación y el salir se despliegan aquí. */}
      {user && openMenu && (
        <nav
          aria-label="Secciones"
          className="grid gap-1 border-t px-4 py-2 sm:hidden"
          onClick={() => setOpenMenu(false)}
        >
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent"
              activeProps={{ className: "bg-accent" }}
            >
              <item.icon aria-hidden className="size-4 text-muted-foreground" />
              {item.label}
            </Link>
          ))}
          <div className={cn("mt-1 border-t pt-2")}>
            <p className="truncate px-3 pb-1 text-xs text-muted-foreground">{user.email}</p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
