/**
 * Construye el compilador de C# que corre en el navegador y lo deja en
 * public/csharp, que es de donde lo sirve la app.
 *
 * Se corre aquí y el resultado se sube al repo, para que el
 * despliegue no necesite .NET. Hace falta el SDK de .NET 8. No hace falta ningún
 * workload: el SDK de WebAssembly sin Blazor viene con el SDK normal.
 *
 * Solo hay que volver a correrlo si cambia tools/csharp-runner.
 */
import { execFileSync } from "node:child_process";
import { cpSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const project = join(root, "tools", "csharp-runner");
const published = join(project, "bin", "Release", "net8.0", "publish", "wwwroot", "_framework");
const destination = join(root, "public", "csharp", "_framework");

console.log("Publicando el compilador...");
execFileSync("dotnet", ["publish", "-c", "Release"], { cwd: project, stdio: "inherit" });

rmSync(destination, { recursive: true, force: true });
cpSync(published, destination, { recursive: true });

/*
 * El runtime arranca siempre con cultura española, así que de los tres
 * pedazos de datos de globalización solo descarga el EFIGS. Los otros dos no
 * los pide nadie y solo engordan el repo.
 */
for (const unused of ["icudt_CJK.dat", "icudt_no_CJK.dat"]) {
  rmSync(join(destination, unused), { force: true });
}

let bytes = 0;
let files = 0;
const walk = (folder) => {
  for (const entry of readdirSync(folder)) {
    const path = join(folder, entry);
    if (statSync(path).isDirectory()) walk(path);
    else {
      bytes += statSync(path).size;
      files += 1;
    }
  }
};
walk(destination);

console.log(
  `\nListo: ${files} archivos, ${(bytes / 1024 / 1024).toFixed(1)} MB en public/csharp/_framework.`,
);
