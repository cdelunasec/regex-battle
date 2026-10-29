import { useEffect, useState } from "react";
import { csharpRunner, type RunnerState } from "./runner.ts";

/**
 * El estado del compilador de C#, y el arranque en cuanto una pantalla lo va a
 * necesitar.
 *
 * Arranca al montar y no al pulsar Ejecutar: la primera vez son treinta megas,
 * y es mejor que se vayan descargando mientras el jugador lee el enunciado que
 * hacerle esperar con el código ya escrito.
 */
export function useCSharpRunner(): RunnerState {
  const [state, setState] = useState<RunnerState>("idle");

  useEffect(() => {
    const runner = csharpRunner();
    setState(runner.state);
    const unsubscribe = runner.onStateChange(setState);
    // Si falla, el estado queda en "failed" y la pantalla lo cuenta. Nada que
    // hacer aquí con el error.
    runner.start().catch(() => undefined);
    return () => {
      unsubscribe();
    };
  }, []);

  return state;
}
