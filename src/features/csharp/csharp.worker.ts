/**
 * El trabajador donde vive el compilador de C#.
 *
 * Todo lo de .NET corre aquí y no en la página, por dos razones. Compilar
 * ocupa el hilo un rato, y en la página eso congelaría la interfaz. Y un
 * `while (true) {}` del jugador no se puede interrumpir desde dentro, porque
 * WebAssembly en .NET 8 tiene un solo hilo: la única salida es que la página
 * mate este trabajador entero y arranque otro.
 *
 * El runtime y el compilador se sirven como archivos estáticos desde
 * public/csharp, que genera `npm run build:csharp`.
 */
import type { CSharpInitInfo, WorkerResponse, WorkerRunRequest } from "./protocol.ts";

/** Lo mínimo del ámbito de un worker que se usa aquí. */
interface WorkerScope {
  location: { origin: string };
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: MessageEvent<WorkerRunRequest>) => void) | null;
}

/** Las funciones que exporta tools/csharp-runner con [JSExport]. */
interface RunnerExports {
  Runner: {
    Initialize(frameworkUrl: string): Promise<string>;
    Run(source: string, stdin: string): Promise<string>;
  };
}

interface DotnetRuntime {
  getAssemblyExports(assemblyName: string): Promise<unknown>;
  getConfig(): { mainAssemblyName: string };
}

interface DotnetBuilder {
  withApplicationCulture(culture: string): DotnetBuilder;
  withConfig(config: Record<string, unknown>): DotnetBuilder;
  create(): Promise<DotnetRuntime>;
}

const scope = self as unknown as WorkerScope;

async function boot(): Promise<RunnerExports> {
  const started = performance.now();
  const frameworkUrl = new URL("/csharp/_framework/", scope.location.origin).href;

  // Se importa por URL en tiempo de ejecución: es un archivo servido tal cual
  // desde public, y el empaquetador no tiene que meterse con él.
  const { dotnet } = (await import(/* @vite-ignore */ `${frameworkUrl}dotnet.js`)) as {
    dotnet: DotnetBuilder;
  };

  const runtime = await dotnet
    // La cultura española es la que hace que los errores del compilador
    // salgan en español. `loadAllSatelliteResources` es imprescindible: sin él
    // el runtime no carga los textos traducidos aunque la cultura sea la buena.
    .withApplicationCulture("es")
    .withConfig({ loadAllSatelliteResources: true })
    .create();

  const exports = (await runtime.getAssemblyExports(
    runtime.getConfig().mainAssemblyName,
  )) as RunnerExports;

  const init = JSON.parse(await exports.Runner.Initialize(frameworkUrl)) as CSharpInitInfo;
  scope.postMessage({ type: "ready", init, bootMs: Math.round(performance.now() - started) });
  return exports;
}

const ready = boot().catch((cause: unknown) => {
  scope.postMessage({
    type: "failed",
    message: cause instanceof Error ? cause.message : String(cause),
  });
  return null;
});

scope.onmessage = (event) => {
  const request = event.data;
  void ready.then(async (exports) => {
    if (!exports) return;
    try {
      const raw = await exports.Runner.Run(request.source, request.stdin);
      scope.postMessage({ type: "result", id: request.id, result: JSON.parse(raw) });
    } catch {
      // Si el runtime aborta, esta promesa se rechaza y el error NO llega al
      // onerror de la página. Sin avisar aquí, la página solo se enteraría al
      // agotarse el tope de tiempo, y le diría "no terminó" a algo que se cayó.
      scope.postMessage({ type: "crashed", id: request.id });
    }
  });
};
