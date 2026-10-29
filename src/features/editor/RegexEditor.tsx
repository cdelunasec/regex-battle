import { useEffect, useRef } from "react";
import { TriangleAlert } from "lucide-react";
import type { ChallengeLanguage, EvaluationResult, MatchMode } from "@/engine";
import { TestCaseList } from "@/features/editor/TestCaseList";
import { MATCH_MODE_HINT } from "@/features/problems/labels";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * El campo donde se escribe la respuesta, con su corrección en vivo.
 *
 * Deliberately dumb: it renders a result it is handed and reports typing back
 * up. Solo mode and the 1v1 both mount this same component, they just do
 * different things when the result comes back passing.
 *
 * Lo único que sabe del lenguaje es cómo llamarlo y cómo enmarcarlo: las
 * barras de `/patron/` son de regex y en una consulta KQL sobran.
 */
export function RegexEditor({
  value,
  onChange,
  result,
  matchMode,
  language = "regex",
  disabled = false,
  autoFocus = false,
  /** Bumping this refocuses and reselects the input, for a new round. */
  focusKey,
}: {
  value: string;
  onChange: (value: string) => void;
  result: EvaluationResult | null;
  matchMode: MatchMode;
  language?: ChallengeLanguage;
  disabled?: boolean;
  autoFocus?: boolean;
  focusKey?: string | number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusKey === undefined || disabled) return;
    inputRef.current?.focus();
  }, [focusKey, disabled]);

  const isRegex = language === "regex";
  const idle = value.trim().length === 0;
  const error = result?.error ?? null;
  // An empty input is not a mistake, it is just the starting point.
  const showError = error !== null && error.code !== "empty_pattern";

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="pattern">{isRegex ? "Tu expresión regular" : "Tu consulta KQL"}</Label>
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border bg-background px-3 font-mono",
            showError && "border-destructive/60",
            result?.passed && "border-success/60",
          )}
        >
          {isRegex && (
            <span aria-hidden className="text-muted-foreground select-none">
              /
            </span>
          )}
          <Input
            id="pattern"
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            autoFocus={autoFocus}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={isRegex ? "escribe tu patrón" : "escribe tu consulta"}
            aria-describedby="pattern-hint"
            className="border-0 bg-transparent px-0 font-mono text-base shadow-none focus-visible:ring-0"
          />
          {isRegex && (
            <span aria-hidden className="text-muted-foreground select-none">
              /
            </span>
          )}
        </div>
        <p id="pattern-hint" className="text-xs text-muted-foreground">
          {MATCH_MODE_HINT[matchMode]}
        </p>
      </div>

      {showError && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{error.message}</span>
        </p>
      )}

      {result && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TestCaseList
            title="Tiene que capturar"
            description="Todos estos deben pasar."
            cases={result.mustMatch}
            idle={idle}
          />
          <TestCaseList
            title="No puede capturar"
            description="Ninguno de estos debe pasar."
            cases={result.mustNotMatch}
            idle={idle}
          />
        </div>
      )}
    </div>
  );
}
