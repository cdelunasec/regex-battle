import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./useTheme.ts";
import { cn } from "@/lib/utils";

/**
 * El interruptor de tema.
 *
 * Los dos iconos se pintan siempre y es el CSS el que esconde uno. Así el botón
 * ya sale correcto en el HTML del servidor, que no sabe qué tema toca, y se ve
 * el icono de lo que va a pasar al pulsar: la luna cuando estás en claro, el sol
 * cuando estás en oscuro.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { toggle } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      title="Cambiar entre modo claro y oscuro"
      aria-label="Cambiar entre modo claro y oscuro"
      className={cn(className)}
    >
      <Moon aria-hidden className="size-4 dark:hidden" />
      <Sun aria-hidden className="hidden size-4 dark:block" />
    </Button>
  );
}
