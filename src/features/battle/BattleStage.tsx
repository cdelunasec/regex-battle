import { useEffect, useState } from "react";
import { Fighter, type FighterState } from "@/features/battle/Fighter";
import { HealthBar } from "@/features/battle/HealthBar";
import type { Hit } from "@/features/battle/useRoom";
import { cn } from "@/lib/utils";

/** Cuánto dura la coreografía del golpe, en sintonía con los keyframes. */
const ANIMATION_MS = 1200;

interface Choreography {
  /** Quién disparó, en coordenadas de pantalla. */
  shooter: "you" | "rival";
  amount: number;
  /** Cambia en cada golpe, para que la animación vuelva a empezar. */
  id: number;
}

/**
 * El escenario del combate: los dos peleadores y sus barras de vida.
 *
 * Tú siempre estás a la izquierda y de azul, mires desde donde mires. Es más
 * fácil de leer que respetar quién creó la sala, y evita que los dos jugadores
 * vean la pelea al revés entre sí.
 *
 * La animación se dispara con el golpe que llega por Realtime, o sea con lo que
 * dice el servidor. Aquí no se decide nada, solo se cuenta.
 */
export function BattleStage({
  youHp,
  rivalHp,
  youLabel,
  rivalLabel,
  hit,
  youAreHost,
  finished = false,
}: {
  youHp: number;
  rivalHp: number;
  youLabel: string;
  rivalLabel: string;
  hit: Hit | null;
  youAreHost: boolean;
  finished?: boolean;
}) {
  const [scene, setScene] = useState<Choreography | null>(null);

  useEffect(() => {
    if (!hit) return;
    // `hit.target` viene en términos de host y guest. Aquí se traduce a quién le
    // pegó a quién desde el punto de vista de este jugador.
    const youWereHit = youAreHost ? hit.target === "host" : hit.target === "guest";
    setScene({ shooter: youWereHit ? "rival" : "you", amount: hit.amount, id: hit.id });

    const timer = window.setTimeout(() => setScene(null), ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [hit, youAreHost]);

  const youState: FighterState =
    youHp === 0 ? "defeated" : scene?.shooter === "you" ? "shooting" : scene ? "hit" : "idle";
  const rivalState: FighterState =
    rivalHp === 0 ? "defeated" : scene?.shooter === "rival" ? "shooting" : scene ? "hit" : "idle";

  const hitLanded = scene !== null;

  return (
    <div className="grid gap-4 overflow-hidden rounded-xl border bg-card p-4 sm:p-6">
      <div className="grid grid-cols-2 gap-4 sm:gap-10">
        <HealthBar label={youLabel} hp={youHp} struck={scene?.shooter === "rival"} />
        <HealthBar
          label={rivalLabel}
          hp={rivalHp}
          align="right"
          struck={scene?.shooter === "you"}
        />
      </div>

      {/* El escenario entero tiembla cuando conecta un golpe. */}
      <div
        key={scene?.id ?? "quieto"}
        className={cn("relative flex items-end justify-between gap-2", hitLanded && "rb-shake")}
      >
        {/* Suelo, para que no floten en el vacío. */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 bottom-1 left-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
        />

        <Fighter side="left" color="azul" state={youState} label={youLabel} hp={youHp} />

        {scene && (
          <>
            {/* El disparo cruzando la pantalla. */}
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-[42%] h-2.5 w-8 rounded-full",
                scene.shooter === "you"
                  ? "rb-shot-to-right bg-[oklch(0.85_0.17_240)] shadow-[0_0_24px_8px] shadow-[oklch(0.7_0.2_240)]/60"
                  : "rb-shot-to-left bg-[oklch(0.8_0.2_25)] shadow-[0_0_24px_8px] shadow-[oklch(0.65_0.24_25)]/60",
              )}
            />

            {/* El destello donde pega. */}
            <span
              aria-hidden
              className={cn(
                "rb-impact pointer-events-none absolute top-[40%] size-16 rounded-full bg-[oklch(0.92_0.19_85)] blur-[3px]",
                scene.shooter === "you" ? "left-[78%]" : "left-[22%]",
              )}
            />

            {/* El número de daño sobre quien lo recibió. */}
            <span
              aria-hidden
              className={cn(
                "rb-damage pointer-events-none absolute top-2 font-mono text-3xl font-black text-[oklch(0.75_0.2_25)] drop-shadow-lg",
                scene.shooter === "you" ? "left-[78%]" : "left-[22%]",
              )}
            >
              -{scene.amount}
            </span>
          </>
        )}

        <Fighter side="right" color="rojo" state={rivalState} label={rivalLabel} hp={rivalHp} />
      </div>

      {/* Lo que pasó, en texto, para quien no vea la animación. */}
      <p role="status" aria-live="polite" className="min-h-5 text-center text-sm">
        {finished ? (
          <span className="text-muted-foreground">La pelea terminó.</span>
        ) : scene ? (
          <span
            className={cn(
              "font-medium",
              scene.shooter === "you" ? "text-success" : "text-destructive",
            )}
          >
            {scene.shooter === "you" ? `Le pegaste ${scene.amount}` : `Te pegaron ${scene.amount}`}
          </span>
        ) : (
          <span className="text-muted-foreground">
            Gana la ronda el primero que resuelva el reto.
          </span>
        )}
      </p>
    </div>
  );
}
