import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { engineFor } from "@/engine";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LessonText } from "./LessonText.tsx";

/** El documento se guarda en una línea, pero se lee mucho mejor indentado. */
function prettyDocument(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/**
 * Una consulta KQL corriendo sobre un documento de log, con su veredicto.
 *
 * El equivalente al laboratorio de regex, pero aquí no hay nada que resaltar:
 * un filtro deja pasar el evento o no lo deja. La consulta viene escrita y es
 * editable a propósito, porque cambiarla y ver quién entra enseña más que
 * leerla.
 */
export function KqlPlayground({
  initialQuery,
  sample,
  note,
}: {
  initialQuery: string;
  sample: string;
  note: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const document = useMemo(() => prettyDocument(sample), [sample]);

  const { passes, error } = useMemo(() => {
    const engine = engineFor("kql");
    const guarded = engine.guard(query);
    if (guarded) return { passes: false, error: guarded.message };
    try {
      return { passes: engine.compile(query, "partial")(sample), error: null };
    } catch (cause) {
      return {
        passes: false,
        error: cause instanceof Error ? cause.message : "La consulta no es válida.",
      };
    }
  }, [query, sample]);

  return (
    <div className="grid gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 rounded-md border bg-background px-3 font-mono">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label="Consulta del ejemplo, se puede editar"
          className="border-0 bg-transparent px-0 font-mono shadow-none focus-visible:ring-0"
        />
      </div>

      <pre className="overflow-x-auto rounded-md border bg-background p-3 font-mono text-xs">
        {document}
      </pre>

      <p className="text-xs text-muted-foreground">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : (
          <>
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                passes ? "text-success" : "text-foreground",
              )}
            >
              {passes ? <Check className="size-3" /> : <X className="size-3" />}
              {passes ? "El evento pasa el filtro." : "El evento se queda fuera."}
            </span>{" "}
            <LessonText text={note} />
          </>
        )}
      </p>
    </div>
  );
}
