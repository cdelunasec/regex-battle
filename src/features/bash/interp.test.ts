/**
 * Lo que `verify:bash` no puede comprobar.
 *
 * Aquel compara contra el bash de la máquina, así que sirve para la fidelidad
 * pero no para lo que es propio de esta plataforma: que un bucle sin fin se
 * corte solo, que un script que imprime sin parar no se lleve la memoria, que
 * los permisos de mentira se apliquen donde tienen que aplicarse, y que el
 * corrector pueda mirar los archivos que quedaron escritos.
 */
import { describe, expect, it } from "vitest";
import { runBash } from "./interp.ts";
import type { VfsSeed } from "./vfs.ts";

const run = (source: string, options: { files?: VfsSeed; stdin?: string; args?: string[] } = {}) =>
  runBash(
    { source, stdin: options.stdin ?? "", args: options.args ?? [] },
    { files: options.files ?? {} },
  );

describe("lo básico", () => {
  it("imprime y termina bien", () => {
    const result = run("echo hola");
    expect(result.status).toBe("ok");
    expect(result.stdout).toBe("hola\n");
    expect(result.exitCode).toBe(0);
  });

  it("devuelve el código que se le pide", () => {
    expect(run("exit 3").exitCode).toBe(3);
    expect(run("echo a; false").exitCode).toBe(1);
  });

  it("separa la salida de los errores", () => {
    const result = run("echo bien; echo mal >&2");
    expect(result.stdout).toBe("bien\n");
    expect(result.stderr).toBe("mal\n");
  });
});

describe("los topes, que es lo que hace esto seguro en un navegador", () => {
  it("corta un bucle sin fin en vez de colgarse", () => {
    const result = run("while true; do :; done");
    expect(result.status).toBe("timeout");
    expect(result.diagnostic?.message).toContain("dando vueltas");
  });

  it("corta también el bucle sin fin de dentro de una sustitución", () => {
    // Aquí salta antes el tope de salida que el de pasos, porque el bucle
    // imprime. Lo que importa es que corte y no que corte por un motivo u otro.
    expect(["timeout", "output_limit"]).toContain(run("x=$(while true; do echo y; done)").status);
  });

  it("corta cuando el script imprime sin parar", () => {
    const result = run(
      'for ((i = 0; i < 500000; i++)); do echo "una línea larga de relleno"; done',
    );
    expect(["output_limit", "timeout"]).toContain(result.status);
  });

  it("cuenta los pasos que gastó", () => {
    expect(run("echo a; echo b").steps).toBeGreaterThan(0);
  });
});

describe("los errores", () => {
  it("avisa del error de sintaxis con su línea", () => {
    const result = run("echo uno\necho dos\nif true; then\n");
    expect(result.status).toBe("syntax_error");
    expect(result.diagnostic?.line).toBeGreaterThanOrEqual(3);
  });

  it("da 127 cuando el comando no existe", () => {
    const result = run("comando_que_no_existe");
    expect(result.exitCode).toBe(127);
    expect(result.stderr).toContain("command not found");
  });

  it("no se rompe con una comilla sin cerrar", () => {
    expect(run('echo "sin cerrar').status).toBe("syntax_error");
  });
});

describe("los archivos que quedan escritos", () => {
  it("deja ver el resultado sin obligar a imprimirlo", () => {
    const result = run('echo "linea" > informe.txt', {
      files: { "/home/analista/": {} },
    });
    expect(result.files["/home/analista/informe.txt"]?.content).toBe("linea\n");
  });

  it("cada corrida arranca del árbol de partida, sin arrastres", () => {
    const files = { "/home/analista/contador.txt": "0\n" };
    run("echo 1 >> contador.txt", { files });
    const second = run("cat contador.txt", { files });
    expect(second.stdout).toBe("0\n");
  });
});

describe("los permisos, que aquí son datos salvo el de ejecución", () => {
  it("no deja correr un script sin el bit de ejecución", () => {
    const result = run("./tarea.sh", {
      files: { "/home/analista/tarea.sh": { content: "echo hola\n", mode: 0o644 } },
    });
    expect(result.exitCode).toBe(126);
    expect(result.stderr).toContain("Permission denied");
  });

  it("lo deja correr en cuanto se lo dan", () => {
    const result = run("chmod +x tarea.sh\n./tarea.sh", {
      files: { "/home/analista/tarea.sh": { content: "echo hola\n", mode: 0o644 } },
    });
    expect(result.stdout).toBe("hola\n");
  });

  it("enseña el SUID donde hay que verlo", () => {
    const result = run("ls -l sospechoso | cut -d' ' -f1", {
      files: { "/home/analista/sospechoso": { content: "", mode: 0o4755 } },
    });
    expect(result.stdout).toBe("-rwsr-xr-x\n");
  });

  it("encuentra por permiso lo que se busca en una revisión", () => {
    const result = run("stat -c '%a %n' abierto.conf", {
      files: { "/home/analista/abierto.conf": { content: "x\n", mode: 0o666 } },
    });
    expect(result.stdout).toBe("666 abierto.conf\n");
  });
});

describe("la lección de las comillas, comprobada por su efecto", () => {
  const files = {
    "/home/analista/dos palabras.txt": "contenido\n",
    "/home/analista/dos": "otro\n",
  };

  it("sin comillas, la variable se parte y se lleva lo que no era", () => {
    const result = run('archivo="dos palabras.txt"\nrm $archivo', { files });
    // Se comió el archivo llamado `dos`, que no era el que le pidieron.
    expect(result.files["/home/analista/dos"]).toBeUndefined();
    expect(result.files["/home/analista/dos palabras.txt"]).toBeDefined();
  });

  it("con comillas, borra justo lo que se le dijo", () => {
    const result = run('archivo="dos palabras.txt"\nrm "$archivo"', { files });
    expect(result.files["/home/analista/dos"]).toBeDefined();
    expect(result.files["/home/analista/dos palabras.txt"]).toBeUndefined();
  });
});

describe("el shell y sus rincones", () => {
  it("un subshell no le mueve el directorio al padre", () => {
    const result = run("mkdir -p sub\n(cd sub; pwd)\npwd", {
      files: { "/home/analista/": {} },
    });
    expect(result.stdout).toBe("/home/analista/sub\n/home/analista\n");
  });

  it("lee de la entrada estándar línea por línea", () => {
    const result = run('while read -r linea; do echo "[$linea]"; done', {
      stdin: "uno\ndos\n",
    });
    expect(result.stdout).toBe("[uno]\n[dos]\n");
  });

  it("corre el trap de salida al terminar", () => {
    const result = run("trap 'echo limpiando' EXIT\necho trabajando");
    expect(result.stdout).toBe("trabajando\nlimpiando\n");
  });

  it("corre el trap de salida aunque se salga a medias", () => {
    const result = run("trap 'echo limpiando' EXIT\necho antes\nexit 2\necho nunca");
    expect(result.stdout).toBe("antes\nlimpiando\n");
    expect(result.exitCode).toBe(2);
  });

  it("un glob que no casa nada se queda como está", () => {
    expect(run("echo *.noexiste").stdout).toBe("*.noexiste\n");
  });

  it("set -u corta cuando falta una variable", () => {
    const result = run('set -u\necho "antes"\necho "$noexiste"\necho "después"');
    expect(result.stdout).toBe("antes\n");
    expect(result.stderr).toContain("unbound variable");
  });
});

describe("las herramientas que todavía no están", () => {
  it("avisan con su nombre en vez de fallar en silencio", () => {
    const result = run("tcpdump -i eth0");
    expect(result.exitCode).toBe(127);
    expect(result.stderr).toContain("tcpdump");
  });

  it("no hay comandos infinitos, y se dice", () => {
    const result = run("yes | head -2");
    expect(result.stderr).toContain("no tiene comandos infinitos");
  });
});

describe("las de red, que no tocan red", () => {
  it("avisan de que su salida está guardada", () => {
    const result = run("nmap 10.10.10.5");
    expect(result.stdout).toContain("Nmap scan report for web01.example.test");
    expect(result.stderr).toContain("esta plataforma no tiene red");
  });

  it("se niegan con un objetivo que no es del laboratorio", () => {
    const result = run("nmap 203.0.113.9");
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("no es del laboratorio");
  });

  it("respetan el alcance cuando hay un scope.txt", () => {
    const files = { "/home/analista/scope.txt": "10.10.10.5\n" };
    expect(run("nmap 10.10.10.5", { files }).exitCode).toBe(0);

    const outside = run("nmap 10.10.10.40", { files });
    expect(outside.exitCode).toBe(2);
    expect(outside.stderr).toContain("no está en scope.txt");
  });

  it("el agujero negro se traga lo que le echen", () => {
    const result = run("echo ruido > /dev/null\necho visible");
    expect(result.stdout).toBe("visible\n");
    expect(result.files["/dev/null"]).toBeUndefined();
  });
});
