/**
 * El que habla con el trabajador de C#.
 *
 * Solo existe en el navegador. Lleva la cuenta de tres cosas que el
 * trabajador no puede llevar por sí mismo: la cola, porque tiene un solo hilo
 * y las ejecuciones van de una en una; el tope de tiempo, porque un bucle
 * infinito no avisa; y el reinicio, porque la única forma de parar ese bucle
 * es matar el trabajador y levantar otro.
 */
import type {
  CSharpInitInfo,
  CSharpRunResult,
  WorkerResponse,
  WorkerRunRequest,
} from "./protocol.ts";

/**
 * Tope por ejecución. Compilar ya caliente tarda de 30 a 300 ms, y un
 * programa de curso termina en milésimas: cinco segundos solo se agotan si
 * algo no va a terminar nunca.
 */
export const RUN_TIMEOUT_MS = 5_000;

/**
 * Tope para arrancar. La primera vez se descargan unos treinta megas, y en
 * una conexión lenta eso puede ir para largo. Después queda en caché.
 */
const BOOT_TIMEOUT_MS = 180_000;

/** Lo que necesita quien corrige: poder ejecutar. Así en los tests se cambia por uno falso. */
export interface CSharpExecutor {
  run(source: string, stdin: string): Promise<CSharpRunResult>;
}

export type RunnerState = "idle" | "starting" | "ready" | "failed";

export class CSharpRunner implements CSharpExecutor {
  private worker: Worker | null = null;
  private booting: Promise<CSharpInitInfo> | null = null;
  private readonly pending = new Map<number, (result: CSharpRunResult) => void>();
  private nextId = 1;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<(state: RunnerState) => void>();
  private currentState: RunnerState = "idle";

  get state(): RunnerState {
    return this.currentState;
  }

  onStateChange(listener: (state: RunnerState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Arranca el compilador si no lo está. Llamarlo varias veces no arranca varios. */
  start(): Promise<CSharpInitInfo> {
    this.booting ??= this.spawn();
    return this.booting;
  }

  /**
   * Ejecuta un programa con una entrada. Nunca rechaza: lo que salga mal
   * vuelve como estado del resultado, para que quien lo pinta no tenga que
   * distinguir entre un error del jugador y uno de aquí.
   */
  run(source: string, stdin: string): Promise<CSharpRunResult> {
    const job = this.queue.then(() => this.runNow(source, stdin));
    this.queue = job.catch(() => undefined);
    return job;
  }

  private async runNow(source: string, stdin: string): Promise<CSharpRunResult> {
    try {
      await this.start();
    } catch {
      return { status: "crashed" };
    }

    const worker = this.worker;
    if (!worker) return { status: "crashed" };

    const id = this.nextId++;

    return new Promise<CSharpRunResult>((resolve) => {
      // El reloj empieza aquí, con el compilador ya arrancado: la descarga de
      // la primera vez no le cuenta al programa del jugador.
      const timer = setTimeout(() => {
        this.pending.delete(id);
        // Matar el trabajador es la única forma de parar un bucle infinito.
        this.reset("idle");
        resolve({ status: "timeout" });
      }, RUN_TIMEOUT_MS);

      this.pending.set(id, (result) => {
        clearTimeout(timer);
        resolve(result);
      });

      const request: WorkerRunRequest = { type: "run", id, source, stdin };
      worker.postMessage(request);
    });
  }

  private spawn(): Promise<CSharpInitInfo> {
    this.setState("starting");

    return new Promise<CSharpInitInfo>((resolve, reject) => {
      const worker = new Worker(new URL("./csharp.worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker = worker;

      const bootTimer = setTimeout(() => {
        this.reset("failed");
        reject(new Error("El compilador de C# tardó demasiado en arrancar."));
      }, BOOT_TIMEOUT_MS);

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data;
        switch (message.type) {
          case "ready":
            clearTimeout(bootTimer);
            this.setState("ready");
            resolve(message.init);
            break;
          case "failed":
            clearTimeout(bootTimer);
            this.reset("failed");
            reject(new Error(message.message));
            break;
          case "result":
            this.pending.get(message.id)?.(message.result);
            this.pending.delete(message.id);
            break;
          case "crashed":
            // El runtime de ese trabajador ya no sirve. Resetear da por caído lo
            // que estaba en marcha, y la próxima ejecución levanta uno nuevo.
            this.reset("idle");
            break;
        }
      };

      // Un desbordamiento de pila en el programa del jugador tumba el runtime
      // entero, y eso llega aquí. Lo que estuviera en marcha se da por caído y
      // la próxima ejecución arranca un trabajador nuevo.
      worker.onerror = (event) => {
        event.preventDefault();
        clearTimeout(bootTimer);
        const wasReady = this.currentState === "ready";
        this.reset(wasReady ? "idle" : "failed");
        if (!wasReady) reject(new Error(event.message || "El compilador de C# no pudo arrancar."));
      };
    });
  }

  private reset(state: RunnerState): void {
    this.worker?.terminate();
    this.worker = null;
    this.booting = null;

    for (const settle of this.pending.values()) settle({ status: "crashed" });
    this.pending.clear();

    this.setState(state);
  }

  private setState(state: RunnerState): void {
    this.currentState = state;
    for (const listener of this.listeners) listener(state);
  }
}

let shared: CSharpRunner | null = null;

/**
 * El compilador compartido de la pestaña. Uno solo, porque arrancarlo cuesta:
 * pasar de una lección a otra no debería volver a cargarlo.
 */
export function csharpRunner(): CSharpRunner {
  if (typeof window === "undefined") {
    throw new Error("El compilador de C# solo existe en el navegador.");
  }
  shared ??= new CSharpRunner();
  return shared;
}
