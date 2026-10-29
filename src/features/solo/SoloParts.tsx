import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Flame, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatDuration, type SoloRunState, type Rankable } from "@/features/solo/soloRun";
import { SOLO_LANGUAGES, type SoloLanguage } from "@/features/solo/languages";

/**
 * Las piezas de la pantalla de práctica solo que son iguales en todos los
 * lenguajes. Regex y KQL por un lado, C# por otro, tienen su forma de
 * enseñar y corregir un reto; el marcador y el resumen son los mismos.
 */

export function SoloShell({ children }: { children: ReactNode }) {
  return <div className="mx-auto grid max-w-4xl gap-5 px-4 py-8">{children}</div>;
}

export function Stat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
      <span aria-hidden className="text-muted-foreground">
        {icon}
      </span>
      <div className="leading-tight">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-mono text-sm font-medium tabular-nums">{value}</div>
      </div>
    </div>
  );
}

export function LanguagePicker({
  value,
  onChange,
}: {
  value: SoloLanguage;
  onChange: (language: SoloLanguage) => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">Con qué quieres practicar</span>
      <div className="flex flex-wrap gap-2">
        {SOLO_LANGUAGES.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={option.value === value ? "default" : "outline"}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {SOLO_LANGUAGES.find((option) => option.value === value)?.hint}
      </p>
    </div>
  );
}

/** El marcador de arriba mientras hay una tanda en marcha. */
export function SoloScoreboard<T extends Rankable>({
  state,
  elapsedMs,
}: {
  state: SoloRunState<T>;
  elapsedMs: number;
}) {
  const total = state.problems.length;
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          icon={<Trophy className="size-4" />}
          label="Reto"
          value={`${state.index + 1}/${total}`}
        />
        <Stat icon={<Check className="size-4" />} label="Resueltos" value={state.solved} />
        <Stat icon={<Flame className="size-4" />} label="Racha" value={state.streak} />
        <Stat
          icon={<Timer className="size-4" />}
          label="Tiempo"
          value={formatDuration(elapsedMs)}
        />
      </div>
      <Progress value={(state.index / total) * 100} />
    </div>
  );
}

/** El resumen de una tanda terminada. */
export function SoloSummary<T extends Rankable>({
  state,
  onAgain,
}: {
  state: SoloRunState<T>;
  onAgain: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="size-5" />
          Tanda terminada
        </CardTitle>
        <CardDescription>
          Resolviste {state.solved} de {state.problems.length}
          {state.skipped > 0 && `, saltaste ${state.skipped}`}.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat icon={<Check className="size-4" />} label="Resueltos" value={state.solved} />
          <Stat icon={<Flame className="size-4" />} label="Mejor racha" value={state.bestStreak} />
          <Stat
            icon={<Timer className="size-4" />}
            label="Tiempo"
            value={formatDuration(state.durationMs)}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={onAgain}>Otra vez</Button>
          <Button variant="outline" asChild>
            <Link to="/">Volver</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
