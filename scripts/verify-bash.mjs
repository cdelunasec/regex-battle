/**
 * Corre cada script en NUESTRO intérprete y en el bash de verdad de la
 * máquina, y falla si no dan exactamente lo mismo.
 *
 * Esta es la red de seguridad de todo el lenguaje. Un intérprete propio tiene
 * una sola manera de salir mal, que es comportarse distinto a bash sin que
 * nadie se entere, y entonces la plataforma enseñaría algo que en una terminal
 * de verdad no pasa. Con esto deja de ser cuestión de confiar.
 *
 *   npm run verify:bash
 *
 * Cada caso se corre en un directorio temporal aparte, sembrado con los mismos
 * archivos que ve el intérprete, y con `LC_ALL=C` para que los formatos y el
 * orden alfabético sean los mismos de los dos lados.
 *
 * Si la máquina no tiene bash, la comparación se salta y se avisa: los casos
 * igual se corren contra el intérprete para ver que no revientan.
 */
import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CORPUS as BASE_CORPUS } from "./bash-corpus.mjs";
import { TOOL_CORPUS } from "./bash-corpus-tools.mjs";
import { runBash } from "../src/features/bash/interp.ts";
import { evaluateBash } from "../src/features/bash/grade.ts";
import { BASH_CHALLENGES, BASH_STARTER } from "../src/data/bash-challenges.ts";
import { BASH_LESSONS } from "../src/data/bash-lessons.ts";

const CORPUS = [...BASE_CORPUS, ...TOOL_CORPUS];

const onlyFilter = process.argv.find((argument) => argument.startsWith("--only="));
const only = onlyFilter ? onlyFilter.slice("--only=".length) : null;
const verbose = process.argv.includes("--verbose");

/** Dónde está el bash de verdad, si es que hay alguno. */
function findBash() {
  const candidates = [
    process.env.BASH_PATH,
    "C:/Program Files/Git/bin/bash.exe",
    "C:/Program Files/Git/usr/bin/bash.exe",
    "/bin/bash",
    "/usr/bin/bash",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  try {
    const found = execSync('bash -c "command -v bash"', { encoding: "utf8" }).trim();
    return found || null;
  } catch {
    return null;
  }
}

const bash = findBash();

/** Sirve los archivos del caso en un directorio temporal de verdad. */
function seedDirectory(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bash-verify-"));

  for (const [name, value] of Object.entries(files ?? {})) {
    const seed = typeof value === "string" ? { content: value } : value;
    // Las rutas del caso son absolutas dentro del mundo de mentira; aquí se
    // cuelgan del temporal para que el bash real vea el mismo árbol.
    const target = path.join(root, name.replace(/^\//, ""));

    if (name.endsWith("/")) {
      fs.mkdirSync(target, { recursive: true });
      continue;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, seed.content ?? "");
    if (seed.mode !== undefined) {
      try {
        fs.chmodSync(target, seed.mode & 0o777);
      } catch {
        // En Windows el modo es decorativo; los casos que dependen de él se
        // marcan con `interpreterOnly`.
      }
    }
  }

  return root;
}

function runInRealBash(testCase) {
  const root = seedDirectory(testCase.files);
  const cwd = path.join(root, (testCase.cwd ?? "/home/analista").replace(/^\//, ""));
  fs.mkdirSync(cwd, { recursive: true });

  try {
    const stdout = execFileSync(bash, ["--noprofile", "--norc", "-s", ...(testCase.args ?? [])], {
      cwd,
      input: testCase.source,
      encoding: "utf8",
      env: { ...process.env, LC_ALL: "C", LANG: "C", PS1: "", BASH_ENV: "" },
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });
    return { stdout, status: 0 };
  } catch (error) {
    if (error.stdout === undefined) throw error;
    return { stdout: error.stdout, status: error.status ?? 1 };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

let passed = 0;
let skipped = 0;
const failures = [];

for (const testCase of CORPUS) {
  if (only && !testCase.name.includes(only)) continue;

  const mine = runBash(
    {
      source: testCase.source,
      stdin: testCase.stdin ?? "",
      args: testCase.args ?? [],
    },
    {
      files: testCase.files ?? {},
      ...(testCase.cwd ? { cwd: testCase.cwd } : {}),
    },
  );

  if (mine.status === "internal_error") {
    failures.push({
      name: testCase.name,
      reason: `el intérprete se rompió: ${mine.diagnostic?.message ?? ""}`,
    });
    continue;
  }

  // Lo que se espera a mano gana sobre la comparación, para los casos que el
  // bash real no puede reproducir.
  if (testCase.expect !== undefined) {
    if (mine.stdout !== testCase.expect) {
      failures.push({
        name: testCase.name,
        reason: "no coincide con lo esperado a mano",
        expected: testCase.expect,
        actual: mine.stdout,
      });
      continue;
    }
    passed++;
    if (!testCase.alsoCompare) continue;
  }

  if (!bash || testCase.interpreterOnly) {
    skipped++;
    continue;
  }

  const real = runInRealBash(testCase);

  /*
   * Una diferencia que es del verificador y no del intérprete: el
   * `sha256sum` de Windows lee en binario por defecto y marca el nombre con un
   * asterisco, donde el de Linux pone dos espacios. La plataforma simula
   * Linux, así que se normaliza la marca y se sigue comparando lo que importa,
   * que es la huella.
   */
  if (bash.toLowerCase().endsWith(".exe")) {
    real.stdout = real.stdout.replace(/^([0-9a-f]{32,64}) \*/gm, "$1  ");
  }

  if (real.stdout !== mine.stdout) {
    failures.push({
      name: testCase.name,
      reason: "la salida no es la de bash",
      expected: real.stdout,
      actual: mine.stdout,
      source: testCase.source,
    });
    continue;
  }

  if (!testCase.ignoreStatus && real.status !== mine.exitCode) {
    failures.push({
      name: testCase.name,
      reason: `el código de salida no es el de bash: ${real.status} contra ${mine.exitCode}`,
      source: testCase.source,
    });
    continue;
  }

  passed++;
}

/*
 * El banco de retos.
 *
 * Por cada uno se comprueban tres cosas, las mismas que en C#: que la solución
 * de referencia pasa, que el script con el que arranca el editor NO pasa, y que
 * imprimir a pelo la salida del ejemplo tampoco. Esa tercera es la que
 * garantiza que los casos ocultos comprueban algo que el ejemplo no enseña.
 */
const bankFailures = [];
let bankPassed = 0;

const gradeWith = (source, challenge) =>
  evaluateBash(source, challenge.cases, (request, setup) => runBash(request, setup));

for (const challenge of BASH_CHALLENGES) {
  if (only && !challenge.slug.includes(only)) continue;

  const reference = gradeWith(challenge.solution, challenge);
  if (!reference.passed) {
    const failed = reference.verdicts.find((verdict) => verdict.kind !== "pass");
    bankFailures.push({
      name: challenge.slug,
      reason: `la solución de referencia no pasa (${failed?.kind ?? "?"})`,
      ...(failed && "expected" in failed ? { expected: failed.expected } : {}),
      ...(failed && "actual" in failed ? { actual: failed.actual ?? "" } : {}),
    });
    continue;
  }

  if (gradeWith(BASH_STARTER, challenge).passed) {
    bankFailures.push({ name: challenge.slug, reason: "el script vacío pasa el reto" });
    continue;
  }

  const copied = `#!/bin/bash\ncat <<'FIN_DE_LA_COPIA'\n${challenge.cases[0].expected}FIN_DE_LA_COPIA\n`;
  if (gradeWith(copied, challenge).passed) {
    bankFailures.push({
      name: challenge.slug,
      reason: "copiar a mano la salida del ejemplo pasa el reto: hace falta otro caso",
    });
    continue;
  }

  bankPassed++;
}


/*
 * El curso.
 *
 * Los ejemplos de una leccion se ejecutan delante del jugador, asi que uno que
 * reviente se ve en pantalla. Y el ejercicio se corrige igual que un reto, con
 * las mismas dos comprobaciones: la solucion pasa y el script de arranque no.
 */
let lessonsPassed = 0;

for (const lesson of BASH_LESSONS) {
  if (only && !lesson.slug.includes(only)) continue;
  let broken = false;

  for (const [position, example] of lesson.examples.entries()) {
    const result = runBash(
      { source: example.script, stdin: example.stdin ?? "", args: example.args ?? [] },
      { files: example.files ?? {} },
    );

    if (["syntax_error", "unsupported", "internal_error", "timeout"].includes(result.status)) {
      bankFailures.push({
        name: `${lesson.slug} ejemplo ${position + 1}`,
        reason: `el ejemplo no corre (${result.status}): ${result.diagnostic?.message ?? ""}`,
      });
      broken = true;
    }
  }

  const exercise = {
    slug: lesson.slug,
    cases: lesson.exercise.cases,
    solution: lesson.exercise.solution,
  };

  const reference = gradeWith(exercise.solution, exercise);
  if (!reference.passed) {
    const failed = reference.verdicts.find((verdict) => verdict.kind !== "pass");
    bankFailures.push({
      name: `${lesson.slug} ejercicio`,
      reason: `la solucion de referencia no pasa (${failed?.kind ?? "?"})`,
      ...(failed && "expected" in failed ? { expected: failed.expected } : {}),
      ...(failed && "actual" in failed ? { actual: failed.actual ?? "" } : {}),
    });
    broken = true;
  } else if (gradeWith(lesson.exercise.starter ?? BASH_STARTER, exercise).passed) {
    bankFailures.push({
      name: `${lesson.slug} ejercicio`,
      reason: "el script de arranque ya lo pasa",
    });
    broken = true;
  }

  if (!broken) lessonsPassed++;
}

const show = (text) =>
  text === "" ? "(vacío)" : JSON.stringify(text).replace(/\\n/g, "\\n\n      ");

if (failures.length > 0) {
  console.error(`\n${failures.length} de ${CORPUS.length} no coinciden:\n`);
  for (const failure of failures) {
    console.error(`  ${failure.name}: ${failure.reason}`);
    if (failure.source && verbose) console.error(`    script:   ${failure.source.trim()}`);
    if (failure.expected !== undefined) {
      console.error(`    bash:     ${show(failure.expected)}`);
      console.error(`    nosotros: ${show(failure.actual)}`);
    }
    console.error("");
  }
}

if (bankFailures.length > 0) {
  console.error(`
${bankFailures.length} retos del banco tienen problemas:
`);
  for (const failure of bankFailures) {
    console.error(`  ${failure.name}: ${failure.reason}`);
    if (failure.expected !== undefined) {
      console.error(`    esperado: ${show(failure.expected)}`);
      console.error(`    dio:      ${show(failure.actual ?? "")}`);
    }
    console.error("");
  }
}

const skippedNote = skipped > 0 ? `, ${skipped} sin comparar` : "";
if (!bash) {
  console.log("No hay bash en esta máquina: no se pudo comparar contra el de verdad.");
}
console.log(`${passed} de ${CORPUS.length} casos iguales a bash${skippedNote}.`);
console.log(`${bankPassed} de ${BASH_CHALLENGES.length} retos del banco verificados.`);
console.log(`${lessonsPassed} de ${BASH_LESSONS.length} lecciones verificadas.`);

process.exit(failures.length > 0 || bankFailures.length > 0 ? 1 : 0);
