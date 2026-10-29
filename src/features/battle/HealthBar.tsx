import { cn } from "@/lib/utils";

/**
 * Barra de vida.
 *
 * El color cambia con el daño, pero el número también está ahí escrito: quien
 * no distinga bien los colores tiene que poder leer cómo va la pelea.
 */
export function HealthBar({
  label,
  hp,
  max = 100,
  align = "left",
  struck = false,
}: {
  label: string;
  hp: number;
  max?: number;
  align?: "left" | "right";
  struck?: boolean;
}) {
  const ratio = Math.max(0, Math.min(1, hp / max));
  const tone =
    ratio > 0.6 ? "bg-success" : ratio > 0.25 ? "bg-[oklch(0.75_0.16_85)]" : "bg-destructive";

  return (
    <div className="grid gap-1.5">
      <div
        className={cn(
          "flex items-baseline gap-2",
          align === "right" ? "flex-row-reverse" : "flex-row",
        )}
      >
        <span className="truncate text-sm font-medium">{label}</span>
        <span
          className={cn(
            "ml-auto font-mono text-sm tabular-nums transition-colors duration-300",
            align === "right" && "ml-0 mr-auto",
            struck && "text-destructive",
          )}
        >
          {hp}
        </span>
      </div>

      <div
        className={cn(
          "h-3 w-full overflow-hidden rounded-full border bg-muted transition-shadow duration-200",
          struck && "ring-2 ring-destructive/60",
        )}
        role="meter"
        aria-valuenow={hp}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`Vida de ${label}`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width,background-color] duration-500 ease-out",
            tone,
            align === "right" && "ml-auto",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}
