import { cn } from "@/lib/utils";

export type FighterState = "idle" | "shooting" | "hit" | "defeated";
export type FighterColor = "azul" | "rojo";

/**
 * Cada estado tiene su pose dibujada, en `public/fighters`.
 *
 * Falta `rojo-golpe`. Mientras no exista, el rojo recibiendo usa la pose de
 * mareado, que es la que más se le parece. En cuanto aparezca el archivo, basta
 * con cambiar esta línea.
 */
const POSES: Record<FighterColor, Record<FighterState, string>> = {
  azul: {
    idle: "/fighters/azul-guardia.png",
    shooting: "/fighters/azul-disparo.png",
    hit: "/fighters/azul-golpe.png",
    defeated: "/fighters/azul-ko.png",
  },
  rojo: {
    idle: "/fighters/rojo-guardia.png",
    shooting: "/fighters/rojo-disparo.png",
    hit: "/fighters/rojo-ko.png",
    defeated: "/fighters/rojo-ko.png",
  },
};

const ANIMATION: Record<FighterState, string> = {
  idle: "rb-idle",
  shooting: "rb-shoot",
  hit: "rb-hit",
  defeated: "rb-ko",
};

const ESTADO: Record<FighterState, string> = {
  idle: "en guardia",
  shooting: "disparando",
  hit: "recibiendo un golpe",
  defeated: "derrotado",
};

/**
 * Uno de los dos peleadores.
 *
 * Las cuatro poses se montan siempre, todas a la vez, y solo cambia cuál está
 * visible. Así el navegador ya tiene la imagen descargada cuando llega el
 * golpe, en vez de pedirla justo en ese momento y dejar un hueco en blanco
 * durante la animación.
 *
 * El volteo del de la derecha va en el elemento de fuera y la animación en el
 * de dentro. Si estuvieran juntos, animar pisaría el `scaleX(-1)` y el
 * personaje se daría la vuelta a media pelea.
 */
export function Fighter({
  side,
  color,
  state,
  label,
  hp,
}: {
  side: "left" | "right";
  color: FighterColor;
  state: FighterState;
  label: string;
  hp: number;
}) {
  const poses = POSES[color];

  return (
    <div
      className={cn("relative h-36 w-32 shrink-0 sm:h-52 sm:w-44", side === "right" && "rb-mirror")}
    >
      <div className={cn("relative size-full origin-bottom", ANIMATION[state])}>
        {(Object.keys(poses) as FighterState[]).map((pose) => (
          <img
            key={pose}
            src={poses[pose]}
            alt=""
            aria-hidden
            draggable={false}
            // La pose activa se ve, las demás esperan cargadas y quietas.
            className={cn(
              "absolute inset-0 size-full object-contain object-bottom transition-opacity duration-150 select-none",
              pose === state ? "opacity-100" : "opacity-0",
            )}
          />
        ))}

        {/* Fogonazo en la punta del cañón, solo al disparar. */}
        {state === "shooting" && (
          <span
            aria-hidden
            className="rb-muzzle pointer-events-none absolute top-[38%] left-[88%] size-10 rounded-full bg-[oklch(0.92_0.19_85)] blur-[2px]"
          />
        )}
      </div>

      {/* El dibujo es decorativo, el estado va escrito. */}
      <span className="sr-only">
        {label}, {hp} de vida, {ESTADO[state]}
      </span>
    </div>
  );
}
