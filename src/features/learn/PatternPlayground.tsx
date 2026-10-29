import { useMemo, useState } from "react";
import { findMatches, splitByMatches } from "@/engine";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LessonText } from "./LessonText.tsx";

/**
 * Un patrón corriendo sobre un texto de muestra, con lo capturado resaltado.
 *
 * Viene con el patrón del ejemplo ya escrito, pero es editable a propósito.
 * Leer que el punto encaja con cualquier cosa no enseña ni la mitad que
 * borrarlo y ver cómo cambia el resaltado.
 */
export function PatternPlayground({
  initialPattern,
  sample,
  note,
}: {
  initialPattern: string;
  sample: string;
  note: string;
}) {
  const [pattern, setPattern] = useState(initialPattern);

  const { parts, count, error } = useMemo(() => {
    const { ranges, error: matchError } = findMatches(pattern, sample);
    return {
      parts: splitByMatches(sample, ranges),
      count: ranges.length,
      error: matchError,
    };
  }, [pattern, sample]);

  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 rounded-md border bg-background px-3 font-mono">
        <span aria-hidden className="text-muted-foreground select-none">
          /
        </span>
        <Input
          value={pattern}
          onChange={(event) => setPattern(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Patrón del ejemplo, se puede editar"
          className="border-0 bg-transparent px-0 font-mono shadow-none focus-visible:ring-0"
        />
        <span aria-hidden className="text-muted-foreground select-none">
          /
        </span>
      </div>

      <p className="rounded-md border bg-background p-3 font-mono text-sm break-all">
        {parts.length === 0 ? (
          <span className="text-muted-foreground italic">texto vacío</span>
        ) : (
          parts.map((part, index) => (
            <span
              key={index}
              className={cn(
                part.matched &&
                  "rounded bg-success/25 text-success underline decoration-success/60",
              )}
            >
              {part.text}
            </span>
          ))
        )}
      </p>

      <p className="text-xs text-muted-foreground">
        {error ? (
          <span className="text-destructive">{error.message}</span>
        ) : (
          <>
            <span className="font-medium text-foreground">
              {count === 0
                ? "No encaja nada"
                : count === 1
                  ? "1 coincidencia"
                  : `${count} coincidencias`}
              .
            </span>{" "}
            <LessonText text={note} />
          </>
        )}
      </p>
    </div>
  );
}
