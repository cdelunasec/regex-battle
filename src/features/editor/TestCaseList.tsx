import { Check, X } from "lucide-react";
import type { CaseResult } from "@/engine";
import { cn } from "@/lib/utils";

/**
 * The two visible test lists.
 *
 * They are shown on purpose. The strings a pattern has to catch and the ones
 * it has to leave alone are the hint of the challenge, the same way the grid
 * is the hint in a regex crossword.
 */
export function TestCaseList({
  title,
  description,
  cases,
  idle,
}: {
  title: string;
  description: string;
  cases: CaseResult[];
  /** True before the player has typed anything, so nothing reads as failed. */
  idle: boolean;
}) {
  return (
    <div className="grid gap-2">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <ul className="grid gap-1.5">
        {cases.map((result) => (
          <li
            key={result.input}
            className={cn(
              "flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-sm transition-colors",
              idle && "border-border bg-muted/40 text-muted-foreground",
              !idle && result.ok && "border-success/40 bg-success/10 text-success",
              !idle && !result.ok && "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            <span aria-hidden className="shrink-0">
              {idle ? (
                <span className="inline-block size-4" />
              ) : result.ok ? (
                <Check className="size-4" />
              ) : (
                <X className="size-4" />
              )}
            </span>
            <span className="min-w-0 flex-1 break-all">
              {result.input === "" ? (
                <span className="italic opacity-60">texto vacío</span>
              ) : (
                result.input
              )}
            </span>
            {/* The icon is decorative, so the state is also written out. */}
            <span className="sr-only">
              {idle ? "sin evaluar" : result.ok ? "correcto" : "incorrecto"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
