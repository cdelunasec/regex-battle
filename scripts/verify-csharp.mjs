/**
 * Compila y ejecuta la solución de cada reto de C# contra sus casos.
 *
 * Usa el MISMO compilador que el navegador, el de public/csharp, corriendo en
 * Node: WebAssembly funciona igual en los dos. Así lo que se comprueba aquí es
 * exactamente lo que va a ver el jugador, consola de mentira incluida.
 *
 * No va en `npm run test` porque arrancar .NET tarda unos segundos y compilar
 * cincuenta programas otros tantos. Se corre al tocar el banco:
 *
 *   npm run verify:csharp
 *
 * Por cada reto comprueba tres cosas:
 *   1. Que la solución de referencia pasa todos los casos.
 *   2. Que el programa vacío con el que arranca el editor NO pasa.
 *   3. Que imprimir a mano la salida del ejemplo NO pasa, o sea que los casos
 *      ocultos de verdad comprueban algo que el ejemplo no enseña.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CSHARP_CHALLENGES, CSHARP_STARTER } from "../src/data/csharp-challenges.ts";
import { CSHARP_LESSONS } from "../src/data/csharp-lessons.ts";
import { evaluateCSharp } from "../src/features/csharp/grade.ts";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(root, "public", "csharp");

if (!fs.existsSync(path.join(publicDir, "_framework", "dotnet.js"))) {
  console.error("No está el compilador en public/csharp. Corre `npm run build:csharp` primero.");
  process.exit(1);
}

/*
 * El compilador descarga sus librerías de referencia por HTTP, como en el
 * navegador. En Node un file:// no sirve para eso, así que se levanta un
 * servidor mínimo sobre public/csharp mientras dura la verificación.
 */
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? "/", "http://local").pathname);
  const file = path.join(publicDir, pathname);
  if (!file.startsWith(publicDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200);
  fs.createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = /** @type {import("node:net").AddressInfo} */ (server.address());

const started = Date.now();
const { dotnet } = await import(
  pathToFileURL(path.join(publicDir, "_framework", "dotnet.js")).href
);
const runtime = await dotnet
  .withApplicationCulture("es")
  .withConfig({ loadAllSatelliteResources: true })
  .create();
const exports = await runtime.getAssemblyExports(runtime.getConfig().mainAssemblyName);
const init = JSON.parse(await exports.Runner.Initialize(`http://127.0.0.1:${port}/_framework/`));

if (init.missing.length > 0 || init.warmupStatus !== "ok") {
  console.error("El compilador no arrancó bien:", init);
  process.exit(1);
}
console.log(`Compilador listo en ${Date.now() - started} ms.\n`);

/** Lo mismo que CSharpRunner, sin worker: en Node no hace falta aislar la pestaña. */
const executor = {
  run: async (source, stdin) => JSON.parse(await exports.Runner.Run(source, stdin)),
};

/** Un programa que imprime tal cual un texto, para ver si con eso basta. */
const printLiterally = (text) =>
  `class Program { static void Main() { System.Console.Write(@"${text.replaceAll('"', '""')}"); } }`;

let failures = 0;
const fail = (slug, reason) => {
  failures++;
  console.log(`FALLO ${slug}: ${reason}`);
};

for (const challenge of CSHARP_CHALLENGES) {
  const reference = await evaluateCSharp(challenge.solution, challenge.cases, executor);
  if (!reference.allPassed) {
    const detail = reference.compileErrors
      ? reference.compileErrors.map((e) => `línea ${e.line}: ${e.message}`).join("; ")
      : reference.verdicts
          .map((verdict, index) => ({ verdict, index }))
          .filter(({ verdict }) => verdict.kind !== "pass")
          .map(({ verdict, index }) =>
            verdict.kind === "wrong_output"
              ? `caso ${index + 1}: esperaba ${JSON.stringify(verdict.expected)}, dio ${JSON.stringify(verdict.actual)}`
              : `caso ${index + 1}: ${verdict.kind}`,
          )
          .join("; ");
    fail(challenge.slug, `la solución no pasa. ${detail}`);
    continue;
  }

  const empty = await evaluateCSharp(CSHARP_STARTER, challenge.cases, executor);
  if (empty.allPassed) fail(challenge.slug, "el programa vacío pasa, los casos no piden nada");

  const example = challenge.cases[0];
  const cheat = await evaluateCSharp(printLiterally(example.expected), challenge.cases, executor);
  if (cheat.allPassed) {
    fail(challenge.slug, "imprimir a mano la salida del ejemplo pasa todos los casos");
  }

  if (reference.allPassed && !empty.allPassed && !cheat.allPassed) {
    console.log(`OK    ${challenge.slug}  (${challenge.cases.length} casos)`);
  }
}

console.log("\n--- EL CURSO ---");

for (const lesson of CSHARP_LESSONS) {
  // Los programas de ejemplo tienen que correr: son lo primero que toca quien
  // abre la leccion, y si uno no compila, la leccion enseña un error.
  for (const [index, example] of lesson.examples.entries()) {
    const run = await executor.run(example.code, example.stdin ?? "");
    if (run.status !== "ok") {
      const detalle =
        run.status === "compile_error"
          ? run.diagnostics.map((d) => `linea ${d.line}: ${d.message}`).join("; ")
          : (run.exception?.type ?? run.status);
      fail(lesson.slug, `el ejemplo ${index + 1} no corre: ${detalle}`);
    }
  }

  const reference = await evaluateCSharp(lesson.exercise.solution, lesson.exercise.cases, executor);
  if (!reference.allPassed) {
    const detalle = reference.compileErrors
      ? reference.compileErrors.map((e) => `linea ${e.line}: ${e.message}`).join("; ")
      : reference.verdicts
          .map((verdict, index) => ({ verdict, index }))
          .filter(({ verdict }) => verdict.kind !== "pass")
          .map(({ verdict, index }) =>
            verdict.kind === "wrong_output"
              ? `caso ${index + 1}: esperaba ${JSON.stringify(verdict.expected)}, dio ${JSON.stringify(verdict.actual)}`
              : `caso ${index + 1}: ${verdict.kind}`,
          )
          .join("; ");
    fail(lesson.slug, `la solucion del ejercicio no pasa. ${detalle}`);
    continue;
  }

  const empty = await evaluateCSharp(
    lesson.exercise.starter ?? CSHARP_STARTER,
    lesson.exercise.cases,
    executor,
  );
  if (empty.allPassed) fail(lesson.slug, "el programa vacio pasa el ejercicio");
  else console.log(`OK    ${lesson.slug}  (${lesson.examples.length} ejemplos)`);
}

server.close();
console.log(
  failures === 0
    ? `\nBien: ${CSHARP_CHALLENGES.length} retos del banco y ${CSHARP_LESSONS.length} lecciones del curso.`
    : `\n${failures} problema(s) en C#.`,
);
process.exit(failures === 0 ? 0 : 1);
