/**
 * Banco de retos de Bash para la práctica solo.
 *
 * Vive en el repo y no en la base, igual que el de C#. Esos alimentan el 1v1,
 * donde el servidor corrige para que nadie se reparta golpes solo; Bash se
 * corrige en el navegador de quien practica, así que no hay nada que proteger y
 * sumar un reto no necesita migración.
 *
 * Un reto trae los archivos con los que arranca, lo que el script recibe y lo
 * que tiene que dar. El primer caso se enseña como ejemplo; los demás se
 * comprueban sin enseñarlos, para que no se pueda escribir la respuesta a mano.
 *
 * `npm run verify:bash` corre la solución de cada uno y comprueba tres cosas:
 * que pasa, que el script vacío NO pasa, y que imprimir a pelo la salida del
 * ejemplo tampoco.
 *
 * Los seis niveles son el orden en que se aprende a trabajar en una terminal:
 * mirar, automatizar, decidir, analizar, empaquetar en una herramienta, y
 * encadenarlo todo en un flujo de reconocimiento.
 */
import type { BashCase } from "@/features/bash/grade";

export interface BashChallenge {
  slug: string;
  difficulty: number;
  title: string;
  /** El enunciado. El código va entre acentos graves y se pinta como código. */
  prompt: string;
  cases: BashCase[];
  hint: string;
  /** Referencia, verificada por verify:bash. Solo se enseña si el jugador se rinde. */
  solution: string;
}

export const BASH_STARTER = "#!/bin/bash\n\n";

// --------------------------------------------------------------- los datos

const AUTH_LOG =
  [
    "Mar 14 09:58:01 estacion sshd[2011]: Failed password for root from 10.0.0.7 port 51520 ssh2",
    "Mar 14 09:58:03 estacion sshd[2012]: Failed password for admin from 10.0.0.7 port 51522 ssh2",
    "Mar 14 09:58:09 estacion sshd[2013]: Accepted password for analista from 10.0.0.15 port 51530 ssh2",
    "Mar 14 09:59:11 estacion sshd[2020]: Failed password for root from 10.0.0.99 port 51540 ssh2",
    "Mar 14 09:59:12 estacion sshd[2021]: Failed password for root from 10.0.0.7 port 51541 ssh2",
    "Mar 14 10:01:40 estacion sshd[2044]: Accepted password for respaldo from 10.0.0.15 port 51560 ssh2",
  ].join("\n") + "\n";

const AUTH_LOG_CORTO =
  [
    "Mar 15 11:00:01 estacion sshd[3001]: Failed password for admin from 10.0.0.31 port 60001 ssh2",
    "Mar 15 11:00:05 estacion sshd[3002]: Accepted password for analista from 10.0.0.15 port 60002 ssh2",
  ].join("\n") + "\n";

const ACCESS_LOG =
  [
    '10.0.0.7 - - [14/Mar/2026:09:58:01 +0000] "GET /index.html HTTP/1.1" 200 1820',
    '10.0.0.15 - - [14/Mar/2026:09:58:20 +0000] "GET /admin HTTP/1.1" 403 199',
    '10.0.0.7 - - [14/Mar/2026:10:01:02 +0000] "POST /login HTTP/1.1" 200 640',
    '10.0.0.99 - - [14/Mar/2026:10:02:44 +0000] "GET /admin HTTP/1.1" 403 199',
    '10.0.0.7 - - [14/Mar/2026:10:05:10 +0000] "GET /index.html HTTP/1.1" 200 1820',
    '10.0.0.15 - - [14/Mar/2026:10:06:00 +0000] "GET /index.html HTTP/1.1" 200 1820',
  ].join("\n") + "\n";

const PASSWD =
  [
    "root:x:0:0:root:/root:/bin/bash",
    "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin",
    "analista:x:1000:1000:Analista:/home/analista:/bin/bash",
    "respaldo:x:1001:1001:Respaldo:/opt/respaldo:/bin/sh",
    "invitado:x:1002:1002:Invitado:/home/invitado:/usr/sbin/nologin",
  ].join("\n") + "\n";

const CONFIG_CON_COMENTARIOS =
  [
    "# Configuracion del servicio",
    "puerto=8080",
    "",
    "# El host no se toca",
    "host=10.10.10.5",
    "",
    "modo=produccion",
  ].join("\n") + "\n";

const NMAP_GUARDADO =
  [
    "# Nmap 7.94 scan initiated",
    "Host: 10.10.10.5 (web01.example.test)\tStatus: Up",
    "Host: 10.10.10.5 (web01.example.test)\tPorts: 22/open/tcp//ssh///, 80/open/tcp//http///",
    "Host: 10.10.10.12 (db01.example.test)\tStatus: Up",
    "Host: 10.10.10.12 (db01.example.test)\tPorts: 22/open/tcp//ssh///, 3306/open/tcp//mysql///",
    "Host: 10.10.10.40 (old.example.test)\tStatus: Up",
    "Host: 10.10.10.40 (old.example.test)\tPorts: 21/open/tcp//ftp///, 3389/open/tcp//ms-wbt-server///",
    "# Nmap done -- 3 IP address(es) scanned",
  ].join("\n") + "\n";

const NMAP_AYER =
  [
    "Host: 10.10.10.5 (web01.example.test)\tPorts: 22/open/tcp//ssh///",
    "Host: 10.10.10.12 (db01.example.test)\tPorts: 22/open/tcp//ssh///, 3306/open/tcp//mysql///",
  ].join("\n") + "\n";

const FFUF_JSON =
  JSON.stringify(
    {
      commandline: "ffuf -u http://10.10.10.5/FUZZ -w lista.txt",
      results: [
        { url: "http://10.10.10.5/admin", status: 301, length: 178 },
        { url: "http://10.10.10.5/api", status: 200, length: 52 },
        { url: "http://10.10.10.5/backup", status: 403, length: 199 },
        { url: "http://10.10.10.5/login", status: 200, length: 1204 },
      ],
    },
    null,
    2,
  ) + "\n";

const NUCLEI_JSONL =
  [
    '{"template-id":"tech-detect","info":{"name":"Tecnologia detectada","severity":"info"},"host":"10.10.10.5"}',
    '{"template-id":"ssh-old-version","info":{"name":"Version de SSH antigua","severity":"medium"},"host":"10.10.10.12"}',
    '{"template-id":"ftp-anonymous","info":{"name":"FTP anonimo permitido","severity":"high"},"host":"10.10.10.40"}',
  ].join("\n") + "\n";

/** Un directorio con permisos flojos, para los retos de revisión. */
const OPT_TREE = {
  "/opt/app/": {},
  "/opt/app/arrancar.sh": { content: "#!/bin/bash\necho arrancando\n", mode: 0o755 },
  "/opt/app/config.ini": { content: "clave=secreta\n", mode: 0o600 },
  "/opt/app/temporal.txt": { content: "basura\n", mode: 0o666 },
  "/opt/app/herramienta": { content: "binario\n", mode: 0o4755, owner: "root" },
  "/opt/datos/": {},
  "/opt/datos/informe.csv": { content: "a,b,c\n1,2,3\n", mode: 0o644 },
  "/opt/datos/publico.txt": { content: "cualquiera escribe aqui\n", mode: 0o777 },
};

const caso = (expected: string, extra: Partial<BashCase> = {}): BashCase => ({
  expected,
  ...extra,
});

export const BASH_CHALLENGES: BashChallenge[] = [
  // ------------------------------------------------- Nivel 1: mirar y buscar
  {
    slug: "bash-contar-fallos",
    difficulty: 1,
    title: "Intentos fallidos",
    prompt:
      "El archivo `auth.log` está en el directorio. Imprime cuántas líneas contienen `Failed password`, y nada más que el número.",
    cases: [
      caso("4\n", { files: { "/home/analista/auth.log": AUTH_LOG } }),
      caso("1\n", { files: { "/home/analista/auth.log": AUTH_LOG_CORTO } }),
    ],
    hint: "`grep -c` cuenta las líneas que casan en vez de imprimirlas.",
    solution: "#!/bin/bash\ngrep -c 'Failed password' auth.log\n",
  },
  {
    slug: "bash-ultimas-lineas",
    difficulty: 1,
    title: "Lo último que pasó",
    prompt: "Imprime las últimas 2 líneas de `auth.log`.",
    cases: [
      caso(
        "Mar 14 09:59:12 estacion sshd[2021]: Failed password for root from 10.0.0.7 port 51541 ssh2\nMar 14 10:01:40 estacion sshd[2044]: Accepted password for respaldo from 10.0.0.15 port 51560 ssh2\n",
        { files: { "/home/analista/auth.log": AUTH_LOG } },
      ),
      caso(
        "Mar 15 11:00:01 estacion sshd[3001]: Failed password for admin from 10.0.0.31 port 60001 ssh2\nMar 15 11:00:05 estacion sshd[3002]: Accepted password for analista from 10.0.0.15 port 60002 ssh2\n",
        { files: { "/home/analista/auth.log": AUTH_LOG_CORTO } },
      ),
    ],
    hint: "`tail -n 2` da las últimas dos.",
    solution: "#!/bin/bash\ntail -n 2 auth.log\n",
  },
  {
    slug: "bash-primera-linea",
    difficulty: 1,
    title: "La primera",
    prompt: "Imprime solo la primera línea de `notas.txt`.",
    cases: [
      caso("uno\n", { files: { "/home/analista/notas.txt": "uno\ndos\ntres\n" } }),
      caso("alfa\n", { files: { "/home/analista/notas.txt": "alfa\nbeta\n" } }),
    ],
    hint: "`head -n 1` se queda con la primera línea. Sin el `-n`, `head` da diez.",
    solution: "#!/bin/bash\nhead -n 1 notas.txt\n",
  },
  {
    slug: "bash-listar-conf",
    difficulty: 1,
    title: "Solo los de configuración",
    prompt:
      "En el directorio `datos` hay archivos de varios tipos. Imprime los nombres de los que terminan en `.conf`, uno por línea y en orden alfabético. Imprime solo el nombre, sin la carpeta.",
    cases: [
      caso("base.conf\nweb.conf\n", {
        files: {
          "/home/analista/datos/web.conf": "a\n",
          "/home/analista/datos/base.conf": "b\n",
          "/home/analista/datos/notas.txt": "c\n",
        },
      }),
      caso("uno.conf\n", {
        files: {
          "/home/analista/datos/uno.conf": "a\n",
          "/home/analista/datos/registro.log": "b\n",
        },
      }),
    ],
    hint: "`ls datos` los lista ordenados; `grep` se queda con los que quieras.",
    solution: "#!/bin/bash\nls datos | grep '\\.conf$'\n",
  },
  {
    slug: "bash-buscar-root",
    difficulty: 1,
    title: "Las de root",
    prompt: "Imprime las líneas de `auth.log` que mencionen a `root`.",
    cases: [
      caso(
        "Mar 14 09:58:01 estacion sshd[2011]: Failed password for root from 10.0.0.7 port 51520 ssh2\nMar 14 09:59:11 estacion sshd[2020]: Failed password for root from 10.0.0.99 port 51540 ssh2\nMar 14 09:59:12 estacion sshd[2021]: Failed password for root from 10.0.0.7 port 51541 ssh2\n",
        { files: { "/home/analista/auth.log": AUTH_LOG } },
      ),
      caso("", { files: { "/home/analista/auth.log": AUTH_LOG_CORTO } }),
    ],
    hint: "`grep root auth.log`.",
    solution: "#!/bin/bash\ngrep root auth.log\n",
  },
  {
    slug: "bash-contar-lineas",
    difficulty: 1,
    title: "Cuántas líneas",
    prompt: "Imprime cuántas líneas tiene `passwd`, solo el número.",
    cases: [
      caso("5\n", { files: { "/home/analista/passwd": PASSWD } }),
      caso("2\n", {
        files: {
          "/home/analista/passwd": "root:x:0:0::/root:/bin/bash\nana:x:1:1::/home/ana:/bin/sh\n",
        },
      }),
    ],
    hint: "`wc -l < archivo` da el número pelado, sin el nombre detrás.",
    solution: "#!/bin/bash\nwc -l < passwd\n",
  },
  {
    slug: "bash-sin-comentarios",
    difficulty: 1,
    title: "La configuración de verdad",
    prompt:
      "El archivo `config.ini` trae comentarios que empiezan con `#` y líneas en blanco. Imprime solo las líneas que configuran algo.",
    cases: [
      caso("puerto=8080\nhost=10.10.10.5\nmodo=produccion\n", {
        files: { "/home/analista/config.ini": CONFIG_CON_COMENTARIOS },
      }),
      caso("nivel=3\n", {
        files: { "/home/analista/config.ini": "# solo esto\n\nnivel=3\n\n" },
      }),
    ],
    hint: "Dos `grep -v` encadenados: uno quita los comentarios y otro las vacías. El patrón de una línea vacía es `^$`.",
    solution: "#!/bin/bash\ngrep -v '^#' config.ini | grep -v '^$'\n",
  },
  {
    slug: "bash-sin-distinguir",
    difficulty: 1,
    title: "Sin distinguir mayúsculas",
    prompt:
      "Imprime cuántas líneas de `registro.txt` mencionan `error`, den igual las mayúsculas. Solo el número.",
    cases: [
      caso("3\n", {
        files: {
          "/home/analista/registro.txt":
            "ERROR: uno\naviso: dos\nError leve\ntodo bien\nerror final\n",
        },
      }),
      caso("1\n", { files: { "/home/analista/registro.txt": "Error unico\nnada\n" } }),
    ],
    hint: "`grep -i` no distingue, y `-c` cuenta. Se pueden juntar: `grep -ci`.",
    solution: "#!/bin/bash\ngrep -ci error registro.txt\n",
  },
  {
    slug: "bash-numerar-hallazgos",
    difficulty: 1,
    title: "En qué línea está",
    prompt:
      "Imprime las líneas de `auth.log` que digan `Accepted`, cada una con el número de línea delante, como lo pone `grep`.",
    cases: [
      caso(
        "3:Mar 14 09:58:09 estacion sshd[2013]: Accepted password for analista from 10.0.0.15 port 51530 ssh2\n6:Mar 14 10:01:40 estacion sshd[2044]: Accepted password for respaldo from 10.0.0.15 port 51560 ssh2\n",
        { files: { "/home/analista/auth.log": AUTH_LOG } },
      ),
      caso(
        "2:Mar 15 11:00:05 estacion sshd[3002]: Accepted password for analista from 10.0.0.15 port 60002 ssh2\n",
        { files: { "/home/analista/auth.log": AUTH_LOG_CORTO } },
      ),
    ],
    hint: "`grep -n` pone el número de línea y los dos puntos.",
    solution: "#!/bin/bash\ngrep -n Accepted auth.log\n",
  },
  {
    slug: "bash-ultimo-acceso",
    difficulty: 1,
    title: "El último que entró",
    prompt:
      "Imprime la última línea de `auth.log` que diga `Accepted`. Si no hay ninguna, no imprimas nada.",
    cases: [
      caso(
        "Mar 14 10:01:40 estacion sshd[2044]: Accepted password for respaldo from 10.0.0.15 port 51560 ssh2\n",
        { files: { "/home/analista/auth.log": AUTH_LOG } },
      ),
      caso("", {
        files: {
          "/home/analista/auth.log":
            "Mar 15 11:00:01 estacion sshd[3001]: Failed password for admin from 10.0.0.31 port 60001 ssh2\n",
        },
      }),
    ],
    hint: "Filtra con `grep` y quédate con la última usando `tail -n 1`.",
    solution: "#!/bin/bash\ngrep Accepted auth.log | tail -n 1\n",
  },

  // ------------------------------------------ Nivel 2: el script y sus datos
  {
    slug: "bash-saludo-argumento",
    difficulty: 2,
    title: "Saluda a quien te digan",
    prompt:
      "El script recibe un nombre como primer argumento. Imprime `Hola, NOMBRE!`. Ojo con los nombres que traen espacios.",
    cases: [
      caso("Hola, DeLuna!\n", { args: ["DeLuna"] }),
      caso("Hola, Ana Luisa!\n", { args: ["Ana Luisa"] }),
      caso("Hola, root!\n", { args: ["root"] }),
    ],
    hint: 'El primer argumento es `$1`. Entrecomíllalo: `"$1"`.',
    solution: '#!/bin/bash\necho "Hola, $1!"\n',
  },
  {
    slug: "bash-contar-de-archivo",
    difficulty: 2,
    title: "Contar el que te pasen",
    prompt:
      "El script recibe el nombre de un archivo como primer argumento. Imprime cuántas líneas tiene, solo el número.",
    cases: [
      caso("6\n", { args: ["auth.log"], files: { "/home/analista/auth.log": AUTH_LOG } }),
      caso("5\n", { args: ["passwd"], files: { "/home/analista/passwd": PASSWD } }),
    ],
    hint: 'Pasa el argumento a `wc`: `wc -l < "$1"`.',
    solution: '#!/bin/bash\nwc -l < "$1"\n',
  },
  {
    slug: "bash-nombre-base",
    difficulty: 2,
    title: "Solo el nombre",
    prompt:
      "El script recibe una ruta completa. Imprime solo el nombre del archivo, sin las carpetas.",
    cases: [
      caso("auth.log\n", { args: ["/var/log/auth.log"] }),
      caso("informe.csv\n", { args: ["/opt/datos/2026/informe.csv"] }),
      caso("script.sh\n", { args: ["script.sh"] }),
    ],
    hint: "`basename` hace justo eso. También sale con `${1##*/}`.",
    solution: '#!/bin/bash\nbasename "$1"\n',
  },
  {
    slug: "bash-extension",
    difficulty: 2,
    title: "Qué extensión tiene",
    prompt: "El script recibe un nombre de archivo. Imprime solo su extensión, sin el punto.",
    cases: [
      caso("log\n", { args: ["auth.log"] }),
      caso("csv\n", { args: ["/opt/datos/informe.csv"] }),
      caso("sh\n", { args: ["recon.sh"] }),
    ],
    hint: "`${1##*.}` quita todo hasta el último punto, incluido.",
    solution: '#!/bin/bash\necho "${1##*.}"\n',
  },
  {
    slug: "bash-valor-por-defecto",
    difficulty: 2,
    title: "Con un valor de respaldo",
    prompt:
      "El script recibe un nivel como primer argumento. Imprime `Nivel: X`. Si no le pasan nada, usa `info`.",
    cases: [
      caso("Nivel: alto\n", { args: ["alto"] }),
      caso("Nivel: info\n", { args: [] }),
      caso("Nivel: bajo\n", { args: ["bajo"] }),
    ],
    hint: "`${1:-info}` usa `info` cuando `$1` viene vacío o no viene.",
    solution: '#!/bin/bash\necho "Nivel: ${1:-info}"\n',
  },
  {
    slug: "bash-sumar-dos",
    difficulty: 2,
    title: "Suma lo que te den",
    prompt: "El script recibe dos números. Imprime su suma.",
    cases: [
      caso("7\n", { args: ["3", "4"] }),
      caso("100\n", { args: ["40", "60"] }),
      caso("-5\n", { args: ["5", "-10"] }),
    ],
    hint: "La aritmética va entre `$(( ))`: `$(($1 + $2))`.",
    solution: '#!/bin/bash\necho "$(($1 + $2))"\n',
  },
  {
    slug: "bash-mensaje-de-uso",
    difficulty: 2,
    title: "Explica cómo se usa",
    prompt:
      "Si no le pasan ningún argumento, el script imprime `Uso: contar.sh ARCHIVO` y termina con código 1. Si le pasan uno, imprime cuántas líneas tiene ese archivo.",
    cases: [
      caso("Uso: contar.sh ARCHIVO\n", { args: [], expectedExit: 1 }),
      caso("6\n", {
        args: ["auth.log"],
        files: { "/home/analista/auth.log": AUTH_LOG },
        expectedExit: 0,
      }),
    ],
    hint: "`$#` es cuántos argumentos llegaron. `exit 1` termina con error.",
    solution:
      '#!/bin/bash\nif [ $# -eq 0 ]; then\n  echo "Uso: contar.sh ARCHIVO"\n  exit 1\nfi\nwc -l < "$1"\n',
  },
  {
    slug: "bash-leer-entrada",
    difficulty: 2,
    title: "Lee y devuelve en mayúsculas",
    prompt: "El script lee una línea por la entrada estándar y la imprime en mayúsculas.",
    cases: [caso("HOLA MUNDO\n", { stdin: "hola mundo\n" }), caso("ROOT\n", { stdin: "root\n" })],
    hint: "`read -r linea` la lee, y `tr 'a-z' 'A-Z'` la sube de caja.",
    solution: "#!/bin/bash\nread -r linea\necho \"$linea\" | tr 'a-z' 'A-Z'\n",
  },
  {
    slug: "bash-crear-con-espacios",
    difficulty: 2,
    title: "Un nombre con espacios",
    prompt:
      "El script recibe un nombre de archivo que puede traer espacios. Crea ese archivo con el texto `listo` dentro. No imprimas nada.",
    cases: [
      caso("", {
        args: ["informe final.txt"],
        expectedFiles: { "/home/analista/informe final.txt": "listo\n" },
      }),
      caso("", {
        args: ["notas.txt"],
        expectedFiles: { "/home/analista/notas.txt": "listo\n" },
      }),
    ],
    hint: 'Sin comillas, un nombre con espacios se parte en dos. Usa `> "$1"`.',
    solution: '#!/bin/bash\necho listo > "$1"\n',
  },
  {
    slug: "bash-armar-ruta",
    difficulty: 2,
    title: "Arma la ruta",
    prompt:
      "El script recibe una carpeta y un nombre. Imprime la ruta completa, con una sola barra entre las dos partes.",
    cases: [
      caso("/var/log/auth.log\n", { args: ["/var/log", "auth.log"] }),
      caso("/opt/datos/informe.csv\n", { args: ["/opt/datos", "informe.csv"] }),
    ],
    hint: 'Pega las dos con una barra en medio, todo dentro de las mismas comillas: `"$1/$2"`.',
    solution: '#!/bin/bash\necho "$1/$2"\n',
  },

  // ----------------------------------------- Nivel 3: decidir y repetir
  {
    slug: "bash-existe-o-no",
    difficulty: 3,
    title: "¿Existe o no?",
    prompt:
      "El script recibe una ruta. Imprime `existe` si es un archivo que está ahí, y `no existe` si no.",
    cases: [
      caso("existe\n", {
        args: ["auth.log"],
        files: { "/home/analista/auth.log": AUTH_LOG },
      }),
      caso("no existe\n", { args: ["fantasma.txt"] }),
      caso("existe\n", {
        args: ["passwd"],
        files: { "/home/analista/passwd": PASSWD },
      }),
    ],
    hint: '`[ -f "$1" ]` es verdadero cuando es un archivo que existe.',
    solution: '#!/bin/bash\nif [ -f "$1" ]; then\n  echo existe\nelse\n  echo "no existe"\nfi\n',
  },
  {
    slug: "bash-archivo-vacio",
    difficulty: 3,
    title: "¿Trae algo?",
    prompt:
      "El script recibe una ruta. Imprime `vacio` si el archivo no tiene nada, y `con datos` si sí.",
    cases: [
      caso("con datos\n", {
        args: ["auth.log"],
        files: { "/home/analista/auth.log": AUTH_LOG },
      }),
      caso("vacio\n", { args: ["nada.txt"], files: { "/home/analista/nada.txt": "" } }),
    ],
    hint: "`[ -s archivo ]` es verdadero cuando el archivo existe y tiene tamaño.",
    solution: '#!/bin/bash\nif [ -s "$1" ]; then\n  echo "con datos"\nelse\n  echo vacio\nfi\n',
  },
  {
    slug: "bash-recorrer-argumentos",
    difficulty: 3,
    title: "Uno por línea",
    prompt:
      "El script recibe varios argumentos. Imprime cada uno en su línea, con un guion y un espacio delante.",
    cases: [
      caso("- uno\n- dos\n- tres\n", { args: ["uno", "dos", "tres"] }),
      caso("- 10.0.0.7\n- 10.0.0.99\n", { args: ["10.0.0.7", "10.0.0.99"] }),
      caso("- Ana Luisa\n", { args: ["Ana Luisa"] }),
    ],
    hint: 'Un `for` sobre `"$@"` recorre los argumentos respetando los que traen espacios.',
    solution: '#!/bin/bash\nfor argumento in "$@"; do\n  echo "- $argumento"\ndone\n',
  },
  {
    slug: "bash-top-ips",
    difficulty: 3,
    title: "Las que más insisten",
    prompt:
      "De `auth.log`, saca las IP de las líneas con `Failed password` y ordénalas por cuántas veces aparecen, de mayor a menor. Imprime cada una como `CANTIDAD IP`, con un espacio, sin relleno.",
    cases: [
      caso("3 10.0.0.7\n1 10.0.0.99\n", { files: { "/home/analista/auth.log": AUTH_LOG } }),
      caso("1 10.0.0.31\n", { files: { "/home/analista/auth.log": AUTH_LOG_CORTO } }),
    ],
    hint: "El patrón clásico es `grep -oE` para sacar la IP, luego `sort | uniq -c | sort -rn`. El `uniq -c` rellena con espacios, así que pasa el resultado por `awk '{print $1, $2}'`.",
    solution:
      "#!/bin/bash\ngrep 'Failed password' auth.log \\\n  | grep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' \\\n  | sort | uniq -c | sort -rn \\\n  | awk '{print $1, $2}'\n",
  },
  {
    slug: "bash-lista-negra",
    difficulty: 3,
    title: "Cruzar con la lista negra",
    prompt:
      "En `objetivos.txt` hay una IP por línea y en `negras.txt` otra lista. Imprime, en el orden en que aparecen en `objetivos.txt`, las que estén también en `negras.txt`.",
    cases: [
      caso("10.0.0.99\n10.0.0.7\n", {
        files: {
          "/home/analista/objetivos.txt": "10.0.0.15\n10.0.0.99\n10.0.0.7\n",
          "/home/analista/negras.txt": "10.0.0.7\n10.0.0.99\n",
        },
      }),
      caso("", {
        files: {
          "/home/analista/objetivos.txt": "10.0.0.1\n",
          "/home/analista/negras.txt": "10.0.0.7\n",
        },
      }),
    ],
    hint: "Recorre `objetivos.txt` con `while read -r ip` y por cada una pregunta con `grep -qx` si está en la otra lista.",
    solution:
      '#!/bin/bash\nwhile read -r ip; do\n  if grep -qx "$ip" negras.txt; then\n    echo "$ip"\n  fi\ndone < objetivos.txt\n',
  },
  {
    slug: "bash-contar-por-usuario",
    difficulty: 3,
    title: "Fallos por usuario",
    prompt:
      "De `auth.log`, cuenta los `Failed password` por usuario y imprime `USUARIO: CANTIDAD`, ordenado por usuario alfabéticamente.",
    cases: [
      caso("admin: 1\nroot: 3\n", { files: { "/home/analista/auth.log": AUTH_LOG } }),
      caso("admin: 1\n", { files: { "/home/analista/auth.log": AUTH_LOG_CORTO } }),
    ],
    hint: "El usuario es el campo que va después de `for`. Con `awk '{print $9}'` lo sacas, y luego `sort | uniq -c`.",
    solution:
      "#!/bin/bash\ngrep 'Failed password' auth.log \\\n  | awk '{print $9}' \\\n  | sort | uniq -c \\\n  | awk '{print $2\": \"$1}'\n",
  },
  {
    slug: "bash-el-mayor",
    difficulty: 3,
    title: "El número más grande",
    prompt: "En `numeros.txt` hay un número por línea. Imprime el mayor.",
    cases: [
      caso("100\n", { files: { "/home/analista/numeros.txt": "10\n100\n42\n7\n" } }),
      caso("9\n", { files: { "/home/analista/numeros.txt": "9\n3\n" } }),
    ],
    hint: "Un `while read` que se va quedando con el mayor, o `sort -n | tail -n 1`.",
    solution: "#!/bin/bash\nsort -n numeros.txt | tail -n 1\n",
  },
  {
    slug: "bash-usuarios-con-shell",
    difficulty: 3,
    title: "Quién puede entrar",
    prompt:
      "De `passwd`, imprime el nombre de los usuarios cuyo shell NO sea `nologin`, uno por línea y en el orden del archivo.",
    cases: [
      caso("root\nanalista\nrespaldo\n", { files: { "/home/analista/passwd": PASSWD } }),
      caso("ana\n", {
        files: {
          "/home/analista/passwd":
            "ana:x:1:1::/home/ana:/bin/bash\nbot:x:2:2::/srv:/usr/sbin/nologin\n",
        },
      }),
    ],
    hint: "Recorre con `while IFS=: read -r usuario _ _ _ _ _ shell` y compara el shell.",
    solution:
      '#!/bin/bash\nwhile IFS=: read -r usuario _ _ _ _ _ shell; do\n  case "$shell" in\n    *nologin) ;;\n    *) echo "$usuario" ;;\n  esac\ndone < passwd\n',
  },
  {
    slug: "bash-clasificar-extension",
    difficulty: 3,
    title: "Clasifica por tipo",
    prompt:
      "El script recibe varios nombres de archivo. Por cada uno imprime `NOMBRE: registro` si termina en `.log`, `NOMBRE: configuracion` si termina en `.conf`, y `NOMBRE: otro` en cualquier otro caso.",
    cases: [
      caso("auth.log: registro\nweb.conf: configuracion\nnotas.txt: otro\n", {
        args: ["auth.log", "web.conf", "notas.txt"],
      }),
      caso("a.log: registro\n", { args: ["a.log"] }),
    ],
    hint: '`case "$archivo" in *.log) ... ;; esac`.',
    solution:
      '#!/bin/bash\nfor archivo in "$@"; do\n  case "$archivo" in\n    *.log) echo "$archivo: registro" ;;\n    *.conf) echo "$archivo: configuracion" ;;\n    *) echo "$archivo: otro" ;;\n  esac\ndone\n',
  },
  {
    slug: "bash-parar-al-encontrar",
    difficulty: 3,
    title: "Para en cuanto lo encuentres",
    prompt:
      "Recorre `auth.log` línea por línea e imprime cada una con `revisando: ` delante. En cuanto encuentres una que diga `Accepted`, imprime `encontrado` y para.",
    cases: [
      caso(
        "revisando: Mar 14 09:58:01 estacion sshd[2011]: Failed password for root from 10.0.0.7 port 51520 ssh2\nrevisando: Mar 14 09:58:03 estacion sshd[2012]: Failed password for admin from 10.0.0.7 port 51522 ssh2\nencontrado\n",
        { files: { "/home/analista/auth.log": AUTH_LOG } },
      ),
      caso("encontrado\n", {
        files: {
          "/home/analista/auth.log":
            "Mar 15 11:00:05 estacion sshd[3002]: Accepted password for analista from 10.0.0.15 port 60002 ssh2\n",
        },
      }),
    ],
    hint: "Dentro del `while`, un `if` con `break`. Ojo: la línea que casa ya no se imprime con `revisando`.",
    solution:
      '#!/bin/bash\nwhile read -r linea; do\n  case "$linea" in\n    *Accepted*)\n      echo encontrado\n      break\n      ;;\n  esac\n  echo "revisando: $linea"\ndone < auth.log\n',
  },

  // -------------------------------------- Nivel 4: masticar texto de verdad
  {
    slug: "bash-ips-unicas",
    difficulty: 4,
    title: "Las direcciones que aparecen",
    prompt:
      "Saca todas las direcciones IPv4 de `access.log`, sin repetir, ordenadas alfabéticamente.",
    cases: [
      caso("10.0.0.15\n10.0.0.7\n10.0.0.99\n", {
        files: { "/home/analista/access.log": ACCESS_LOG },
      }),
      caso("192.168.1.1\n", {
        files: {
          "/home/analista/access.log": '192.168.1.1 - - [x +0000] "GET / HTTP/1.1" 200 1\n',
        },
      }),
    ],
    hint: "`grep -oE` con el patrón de una IP, y luego `sort -u`.",
    solution: "#!/bin/bash\ngrep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' access.log | sort -u\n",
  },
  {
    slug: "bash-bytes-por-ip",
    difficulty: 4,
    title: "Cuántos bytes se llevó cada uno",
    prompt:
      "En `access.log`, el último campo son los bytes que se enviaron. Suma los bytes por IP e imprime `IP TOTAL`, ordenado por IP alfabéticamente.",
    cases: [
      caso("10.0.0.15 2019\n10.0.0.7 4280\n10.0.0.99 199\n", {
        files: { "/home/analista/access.log": ACCESS_LOG },
      }),
      caso("10.0.0.1 500\n", {
        files: { "/home/analista/access.log": '10.0.0.1 - - [x +0000] "GET / HTTP/1.1" 200 500\n' },
      }),
    ],
    hint: "`awk '{total[$1] += $NF} END {for (ip in total) print ip, total[ip]}'` y luego `sort`.",
    solution:
      "#!/bin/bash\nawk '{total[$1] += $NF} END {for (ip in total) print ip, total[ip]}' access.log | sort\n",
  },
  {
    slug: "bash-buscar-suid",
    difficulty: 4,
    title: "Los que corren como su dueño",
    prompt:
      "Busca bajo `/opt` los archivos con el bit SUID puesto e imprime su ruta, ordenada. Un SUID hace que el programa corra con los permisos de su dueño y no con los tuyos, así que uno que no debería estar ahí es un hallazgo.",
    cases: [
      caso("/opt/app/herramienta\n", { files: OPT_TREE }),
      caso("", {
        files: { "/opt/limpio/": {}, "/opt/limpio/normal.sh": { content: "x\n", mode: 0o755 } },
      }),
    ],
    hint: "`find /opt -type f -perm -4000`. El guion del `-4000` significa 'que tenga al menos estos bits'.",
    solution: "#!/bin/bash\nfind /opt -type f -perm -4000 | sort\n",
  },
  {
    slug: "bash-escribibles-por-todos",
    difficulty: 4,
    title: "Los que cualquiera puede cambiar",
    prompt:
      "Busca bajo `/opt` los archivos que cualquier usuario pueda escribir e imprime su ruta, ordenada.",
    cases: [
      caso("/opt/app/temporal.txt\n/opt/datos/publico.txt\n", { files: OPT_TREE }),
      caso("", {
        files: { "/opt/limpio/": {}, "/opt/limpio/normal.sh": { content: "x\n", mode: 0o755 } },
      }),
    ],
    hint: "`find /opt -type f -perm /002` busca los que tengan el bit de escritura para 'otros'.",
    solution: "#!/bin/bash\nfind /opt -type f -perm /002 | sort\n",
  },
  {
    slug: "bash-limpiar-prefijo",
    difficulty: 4,
    title: "Quita lo que sobra",
    prompt:
      "De `auth.log`, deja solo la hora y el mensaje: quita la fecha y el nombre del equipo. O sea, de `Mar 14 09:58:01 estacion sshd[2011]: Failed...` tiene que quedar `09:58:01 sshd[2011]: Failed...`.",
    cases: [
      caso(
        "09:58:01 sshd[2011]: Failed password for root from 10.0.0.7 port 51520 ssh2\n09:58:03 sshd[2012]: Failed password for admin from 10.0.0.7 port 51522 ssh2\n09:58:09 sshd[2013]: Accepted password for analista from 10.0.0.15 port 51530 ssh2\n09:59:11 sshd[2020]: Failed password for root from 10.0.0.99 port 51540 ssh2\n09:59:12 sshd[2021]: Failed password for root from 10.0.0.7 port 51541 ssh2\n10:01:40 sshd[2044]: Accepted password for respaldo from 10.0.0.15 port 51560 ssh2\n",
        { files: { "/home/analista/auth.log": AUTH_LOG } },
      ),
      caso(
        "11:00:01 sshd[3001]: Failed password for admin from 10.0.0.31 port 60001 ssh2\n11:00:05 sshd[3002]: Accepted password for analista from 10.0.0.15 port 60002 ssh2\n",
        { files: { "/home/analista/auth.log": AUTH_LOG_CORTO } },
      ),
    ],
    hint: "Con `sed 's/^... .. //'` quitas la fecha, o con `cut -d' ' -f3,5-` te quedas con los campos que quieres.",
    solution: "#!/bin/bash\ncut -d' ' -f3,5- auth.log\n",
  },
  {
    slug: "bash-campos-passwd",
    difficulty: 4,
    title: "Usuario y carpeta",
    prompt:
      "De `passwd`, imprime el nombre del usuario y su carpeta personal separados por una flecha ` -> `, uno por línea.",
    cases: [
      caso(
        "root -> /root\ndaemon -> /usr/sbin\nanalista -> /home/analista\nrespaldo -> /opt/respaldo\ninvitado -> /home/invitado\n",
        { files: { "/home/analista/passwd": PASSWD } },
      ),
      caso("ana -> /home/ana\n", {
        files: { "/home/analista/passwd": "ana:x:1:1::/home/ana:/bin/bash\n" },
      }),
    ],
    hint: 'Con `awk -F:` los campos son `$1` y `$6`. La flecha va dentro de comillas: `print $1 " -> " $6`.',
    solution: "#!/bin/bash\nawk -F: '{print $1 \" -> \" $6}' passwd\n",
  },
  {
    slug: "bash-codigos-http",
    difficulty: 4,
    title: "Cuántas de cada código",
    prompt:
      "En `access.log`, el penúltimo campo es el código HTTP. Cuenta cuántas peticiones hubo de cada código e imprime `CODIGO: CANTIDAD`, ordenado por código.",
    cases: [
      caso("200: 4\n403: 2\n", { files: { "/home/analista/access.log": ACCESS_LOG } }),
      caso("404: 1\n", {
        files: { "/home/analista/access.log": '10.0.0.1 - - [x +0000] "GET /x HTTP/1.1" 404 10\n' },
      }),
    ],
    hint: "El penúltimo campo es `$(NF-1)`. Cuenta con un arreglo asociativo y ordena al final.",
    solution:
      "#!/bin/bash\nawk '{cuenta[$(NF-1)]++} END {for (c in cuenta) print c\": \"cuenta[c]}' access.log | sort\n",
  },
  {
    slug: "bash-rutas-mas-pedidas",
    difficulty: 4,
    title: "Las rutas más pedidas",
    prompt:
      "De `access.log`, saca la ruta que se pidió en cada línea y cuenta cuántas veces se pidió cada una. Imprime `CANTIDAD RUTA`, de mayor a menor, y a igualdad de cantidad, por ruta alfabéticamente.",
    cases: [
      caso("3 /index.html\n2 /admin\n1 /login\n", {
        files: { "/home/analista/access.log": ACCESS_LOG },
      }),
      caso("1 /solo\n", {
        files: {
          "/home/analista/access.log": '10.0.0.1 - - [x +0000] "GET /solo HTTP/1.1" 200 1\n',
        },
      }),
    ],
    hint: "La ruta es el campo 7 si cuentas por espacios. `sort | uniq -c | sort -rn` y luego dale formato con `awk`.",
    solution:
      "#!/bin/bash\nawk '{print $7}' access.log | sort | uniq -c | sort -rn | awk '{print $1, $2}'\n",
  },
  {
    slug: "bash-por-minuto",
    difficulty: 4,
    title: "En qué minuto pasó",
    prompt:
      "De las líneas de `auth.log` con `Failed password`, imprime cuántas hubo en cada minuto, como `HH:MM CANTIDAD`, ordenado por hora.",
    cases: [
      caso("09:58 2\n09:59 2\n", { files: { "/home/analista/auth.log": AUTH_LOG } }),
      caso("11:00 1\n", { files: { "/home/analista/auth.log": AUTH_LOG_CORTO } }),
    ],
    hint: "La hora es el campo 3, con formato `HH:MM:SS`. Quédate con los cinco primeros caracteres con `cut -c1-5` y luego cuenta.",
    solution:
      "#!/bin/bash\ngrep 'Failed password' auth.log \\\n  | awk '{print $3}' | cut -c1-5 \\\n  | sort | uniq -c \\\n  | awk '{print $2, $1}'\n",
  },
  {
    slug: "bash-archivos-modificados",
    difficulty: 4,
    title: "Qué se tocó bajo /opt",
    prompt:
      "Imprime la ruta y el modo en octal de cada archivo bajo `/opt`, ordenado por ruta, con el formato `MODO RUTA`.",
    cases: [
      caso(
        "755 /opt/app/arrancar.sh\n600 /opt/app/config.ini\n4755 /opt/app/herramienta\n666 /opt/app/temporal.txt\n644 /opt/datos/informe.csv\n777 /opt/datos/publico.txt\n",
        { files: OPT_TREE },
      ),
      caso("755 /opt/limpio/normal.sh\n", {
        files: { "/opt/limpio/": {}, "/opt/limpio/normal.sh": { content: "x\n", mode: 0o755 } },
      }),
    ],
    hint: "`find /opt -type f | sort` te da las rutas, y `stat -c '%a %n'` el modo y el nombre. Encádenalos con `xargs`.",
    solution: "#!/bin/bash\nfind /opt -type f | sort | xargs stat -c '%a %n'\n",
  },

  // ------------------------------------ Nivel 5: empaquetar en herramienta
  {
    slug: "bash-funcion-simple",
    difficulty: 5,
    title: "Tu primera función",
    prompt:
      "Escribe una función llamada `avisar` que reciba un texto e imprima `[aviso] TEXTO`. Úsala con cada argumento que reciba el script.",
    cases: [
      caso("[aviso] uno\n[aviso] dos\n", { args: ["uno", "dos"] }),
      caso("[aviso] puerto abierto\n", { args: ["puerto abierto"] }),
    ],
    hint: "Una función se declara `avisar() { ... }` y dentro sus argumentos también son `$1`.",
    solution:
      '#!/bin/bash\navisar() {\n  echo "[aviso] $1"\n}\n\nfor texto in "$@"; do\n  avisar "$texto"\ndone\n',
  },
  {
    slug: "bash-funcion-que-decide",
    difficulty: 5,
    title: "Una función que responde sí o no",
    prompt:
      "Escribe una función `es_ip` que diga si un texto tiene forma de IPv4. Por cada argumento del script, imprime `TEXTO: si` o `TEXTO: no`.",
    cases: [
      caso("10.0.0.7: si\nhola: no\n999: no\n", { args: ["10.0.0.7", "hola", "999"] }),
      caso("192.168.1.1: si\n", { args: ["192.168.1.1"] }),
    ],
    hint: "Una función devuelve su respuesta con el código de salida, no imprimiéndola. Dentro, `[[ $1 =~ ^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$ ]]` ya vale como resultado.",
    solution:
      '#!/bin/bash\nes_ip() {\n  [[ $1 =~ ^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$ ]]\n}\n\nfor texto in "$@"; do\n  if es_ip "$texto"; then\n    echo "$texto: si"\n  else\n    echo "$texto: no"\n  fi\ndone\n',
  },
  {
    slug: "bash-opciones-getopts",
    difficulty: 5,
    title: "Opciones de verdad",
    prompt:
      "El script acepta `-n NOMBRE` y `-v`. Imprime `nombre: X` con lo que venga en `-n`, o `nombre: (ninguno)` si no vino. Si estaba `-v`, imprime además una segunda línea que diga `modo detallado`.",
    cases: [
      caso("nombre: web01\n", { args: ["-n", "web01"] }),
      caso("nombre: db01\nmodo detallado\n", { args: ["-n", "db01", "-v"] }),
      caso("nombre: (ninguno)\n", { args: [] }),
    ],
    hint: '`while getopts "n:v" opcion; do case $opcion in n) nombre=$OPTARG ;; v) detalle=1 ;; esac; done`. Los dos puntos detrás de la `n` dicen que esa opción lleva valor.',
    solution:
      '#!/bin/bash\nnombre="(ninguno)"\ndetalle=0\n\nwhile getopts "n:v" opcion; do\n  case "$opcion" in\n    n) nombre="$OPTARG" ;;\n    v) detalle=1 ;;\n  esac\ndone\n\necho "nombre: $nombre"\nif [ "$detalle" -eq 1 ]; then\n  echo "modo detallado"\nfi\n',
  },
  {
    slug: "bash-ayuda",
    difficulty: 5,
    title: "Una herramienta se explica sola",
    prompt:
      "Si el primer argumento es `--help`, imprime estas tres líneas y termina con código 0:\n```\nUso: revisar.sh RUTA\nRevisa los permisos de una carpeta.\n  --help  muestra esta ayuda\n```\nSi no, imprime `revisando RUTA`.",
    cases: [
      caso(
        "Uso: revisar.sh RUTA\nRevisa los permisos de una carpeta.\n  --help  muestra esta ayuda\n",
        { args: ["--help"], expectedExit: 0 },
      ),
      caso("revisando /opt\n", { args: ["/opt"] }),
    ],
    hint: "Un bloque de texto largo se imprime cómodo con un heredoc: `cat <<FIN ... FIN`.",
    solution:
      '#!/bin/bash\nif [ "$1" = "--help" ]; then\n  cat <<FIN\nUso: revisar.sh RUTA\nRevisa los permisos de una carpeta.\n  --help  muestra esta ayuda\nFIN\n  exit 0\nfi\n\necho "revisando $1"\n',
  },
  {
    slug: "bash-codigos-de-salida",
    difficulty: 5,
    title: "Fallar con criterio",
    prompt:
      "El script recibe una ruta. Si no le pasan nada, imprime `falta la ruta` y sale con 2. Si la ruta no existe, imprime `no existe: RUTA` y sale con 3. Si existe, imprime `ok` y sale con 0.",
    cases: [
      caso("falta la ruta\n", { args: [], expectedExit: 2 }),
      caso("no existe: fantasma\n", { args: ["fantasma"], expectedExit: 3 }),
      caso("ok\n", {
        args: ["auth.log"],
        files: { "/home/analista/auth.log": AUTH_LOG },
        expectedExit: 0,
      }),
    ],
    hint: "Códigos distintos para fallos distintos: así quien llama al script puede reaccionar a cada uno.",
    solution:
      '#!/bin/bash\nif [ $# -eq 0 ]; then\n  echo "falta la ruta"\n  exit 2\nfi\n\nif [ ! -e "$1" ]; then\n  echo "no existe: $1"\n  exit 3\nfi\n\necho ok\n',
  },
  {
    slug: "bash-limpiar-al-salir",
    difficulty: 5,
    title: "Recoger antes de irse",
    prompt:
      "El script recibe un texto. Crea un archivo temporal `trabajo.tmp` con ese texto, escribe `resultado.txt` con `hecho: TEXTO`, imprime `trabajando`, y al terminar borra el temporal. El borrado tiene que ocurrir pase lo que pase, así que ponlo en un `trap`.",
    cases: [
      caso("trabajando\nlimpiando\n", {
        args: ["uno"],
        files: { "/home/analista/": {} },
        expectedFiles: { "/home/analista/resultado.txt": "hecho: uno\n" },
      }),
      caso("trabajando\nlimpiando\n", {
        args: ["dos"],
        files: { "/home/analista/": {} },
        expectedFiles: { "/home/analista/resultado.txt": "hecho: dos\n" },
      }),
    ],
    hint: "`trap 'echo limpiando; rm -f trabajo.tmp' EXIT` al principio: eso corre pase lo que pase, incluso si el script se corta a medias.",
    solution:
      '#!/bin/bash\ntrap \'echo limpiando; rm -f trabajo.tmp\' EXIT\n\necho "$1" > trabajo.tmp\necho "hecho: $1" > resultado.txt\necho trabajando\n',
  },
  {
    slug: "bash-reporte-en-columnas",
    difficulty: 5,
    title: "Un reporte que se lee",
    prompt:
      "De `auth.log`, saca las IP con `Failed password` y su cantidad, y escríbelas en columnas: la IP alineada a la izquierda en 16 espacios, y la cantidad alineada a la derecha en 3. De mayor a menor cantidad.",
    cases: [
      caso("10.0.0.7           3\n10.0.0.99          1\n", {
        files: { "/home/analista/auth.log": AUTH_LOG },
      }),
      caso("10.0.0.31          1\n", { files: { "/home/analista/auth.log": AUTH_LOG_CORTO } }),
    ],
    hint: '`printf "%-16s %3d\\n" "$ip" "$cantidad"`. El guion alinea a la izquierda.',
    solution:
      '#!/bin/bash\ngrep \'Failed password\' auth.log \\\n  | grep -oE \'([0-9]{1,3}\\.){3}[0-9]{1,3}\' \\\n  | sort | uniq -c | sort -rn \\\n  | while read -r cantidad ip; do\n      printf "%-16s %3d\\n" "$ip" "$cantidad"\n    done\n',
  },
  {
    slug: "bash-variables-locales",
    difficulty: 5,
    title: "Que no se pisen las variables",
    prompt:
      "Hay una variable `estado` que vale `global`. Escribe una función `procesar` que reciba un texto, declare su PROPIA `estado` con ese valor y la imprima. Después de llamarla, imprime `estado` otra vez: tiene que seguir valiendo `global`.",
    cases: [
      caso("dentro\nglobal\n", { args: ["dentro"] }),
      caso("revisando\nglobal\n", { args: ["revisando"] }),
    ],
    hint: 'Sin `local`, la función pisa la variable de fuera y no te enteras hasta que algo falla lejos de ahí. Con `local estado="$1"`, no.',
    solution:
      '#!/bin/bash\nestado="global"\n\nprocesar() {\n  local estado="$1"\n  echo "$estado"\n}\n\nprocesar "$1"\necho "$estado"\n',
  },
  {
    slug: "bash-modo-estricto",
    difficulty: 5,
    title: "Que falle pronto",
    prompt:
      "Escribe un script que arranque con `set -euo pipefail`, imprima `paso 1`, intente leer `no-existe.txt` con `cat` y luego imprima `paso 2`. Con el modo estricto puesto, el script tiene que cortarse en el `cat` y salir con código 1, así que `paso 2` no llega a imprimirse.",
    cases: [
      caso("paso 1\n", { expectedExit: 1 }),
      // Con el archivo ahí, y vacío, el `cat` no falla ni imprime nada, así
      // que el script llega hasta el final. Es el contraste de la lección.
      caso("paso 1\npaso 2\n", {
        files: { "/home/analista/no-existe.txt": "" },
        expectedExit: 0,
      }),
    ],
    hint: "`set -e` corta en cuanto un comando falla. Manda el error de `cat` a `/dev/null` para que no ensucie.",
    solution:
      "#!/bin/bash\nset -euo pipefail\n\necho 'paso 1'\ncat no-existe.txt 2>/dev/null\necho 'paso 2'\n",
  },
  {
    slug: "bash-herramienta-permisos",
    difficulty: 5,
    title: "Tu herramienta de revisión",
    prompt:
      "Escribe `revisar.sh`, que recibe una carpeta como argumento. Tiene que imprimir:\n```\nRevisando: CARPETA\nSUID: N\nEscribibles por todos: M\n```\nSi no le pasan carpeta, imprime `Uso: revisar.sh CARPETA` y sale con 1.",
    cases: [
      caso("Revisando: /opt\nSUID: 1\nEscribibles por todos: 2\n", {
        args: ["/opt"],
        files: OPT_TREE,
      }),
      caso("Uso: revisar.sh CARPETA\n", { args: [], expectedExit: 1 }),
      caso("Revisando: /opt/datos\nSUID: 0\nEscribibles por todos: 1\n", {
        args: ["/opt/datos"],
        files: OPT_TREE,
      }),
    ],
    hint: "Guarda cada conteo en una variable con `$(find ... | wc -l)` y luego imprímelas.",
    solution:
      '#!/bin/bash\nif [ $# -eq 0 ]; then\n  echo "Uso: revisar.sh CARPETA"\n  exit 1\nfi\n\ncarpeta="$1"\nsuid=$(find "$carpeta" -type f -perm -4000 | wc -l)\nabiertos=$(find "$carpeta" -type f -perm /002 | wc -l)\n\necho "Revisando: $carpeta"\necho "SUID: $suid"\necho "Escribibles por todos: $abiertos"\n',
  },

  // ------------------------------------ Nivel 6: automatizar un pentest
  {
    slug: "bash-parsear-nmap",
    difficulty: 6,
    title: "Sacar los host de un nmap",
    prompt:
      "En `barrido.txt` está la salida de `nmap -oG`. Imprime la IP de cada host que tenga puertos, una por línea y ordenadas.",
    cases: [
      caso("10.10.10.12\n10.10.10.40\n10.10.10.5\n", {
        files: { "/home/analista/barrido.txt": NMAP_GUARDADO },
      }),
      caso("10.10.10.12\n10.10.10.5\n", {
        files: { "/home/analista/barrido.txt": NMAP_AYER },
      }),
    ],
    hint: "Las líneas que interesan traen `Ports:`. La IP es el campo 2.",
    solution: "#!/bin/bash\nawk '/Ports:/ {print $2}' barrido.txt | sort\n",
  },
  {
    slug: "bash-host-puerto",
    difficulty: 6,
    title: "Normalizar a host:puerto",
    prompt:
      "De `barrido.txt`, saca cada pareja de host y puerto abierto en el formato `IP:PUERTO`, una por línea, ordenadas alfabéticamente.",
    cases: [
      caso(
        "10.10.10.12:22\n10.10.10.12:3306\n10.10.10.40:21\n10.10.10.40:3389\n10.10.10.5:22\n10.10.10.5:80\n",
        { files: { "/home/analista/barrido.txt": NMAP_GUARDADO } },
      ),
      caso("10.10.10.12:22\n10.10.10.12:3306\n10.10.10.5:22\n", {
        files: { "/home/analista/barrido.txt": NMAP_AYER },
      }),
    ],
    hint: "Saca la IP y la parte de los puertos, y recorre los puertos separándolos por la coma. Un `awk` con `split` lo hace, y también sale con `sed` y un bucle.",
    solution:
      '#!/bin/bash\nawk -F\'\\t\' \'/Ports:/ {\n  ip = $1\n  sub(/^Host: /, "", ip)\n  sub(/ .*/, "", ip)\n  puertos = $2\n  sub(/^Ports: /, "", puertos)\n  n = split(puertos, lista, ", ")\n  for (i = 1; i <= n; i++) {\n    split(lista[i], campos, "/")\n    print ip ":" campos[1]\n  }\n}\' barrido.txt | sort\n',
  },
  {
    slug: "bash-puertos-criticos",
    difficulty: 6,
    title: "Los puertos que hay que mirar primero",
    prompt:
      "De `barrido.txt`, imprime la IP de los host que tengan abierto el 22, el 3389 o el 445, una por línea, sin repetir y ordenadas.",
    cases: [
      caso("10.10.10.12\n10.10.10.40\n10.10.10.5\n", {
        files: { "/home/analista/barrido.txt": NMAP_GUARDADO },
      }),
      caso("10.10.10.12\n10.10.10.5\n", {
        files: { "/home/analista/barrido.txt": NMAP_AYER },
      }),
    ],
    hint: "Reutiliza lo de `IP:PUERTO` y filtra con `grep -E ':(22|3389|445)$'`, luego quédate con la IP.",
    solution:
      "#!/bin/bash\nawk '/Ports:/ {\n  ip = $2\n  if ($0 ~ /(: |, )(22|3389|445)\\/open/) print ip\n}' barrido.txt | sort -u\n",
  },
  {
    slug: "bash-validar-alcance",
    difficulty: 6,
    title: "Nada fuera del alcance",
    prompt:
      "En `objetivos.txt` hay una IP por línea y en `scope.txt` las que están autorizadas. Imprime `OK IP` por cada una autorizada y `FUERA IP` por cada una que no, en el orden de `objetivos.txt`.",
    cases: [
      caso("OK 10.10.10.5\nFUERA 203.0.113.9\nOK 10.10.10.12\n", {
        files: {
          "/home/analista/objetivos.txt": "10.10.10.5\n203.0.113.9\n10.10.10.12\n",
          "/home/analista/scope.txt": "10.10.10.5\n10.10.10.12\n",
        },
      }),
      caso("FUERA 192.168.1.1\n", {
        files: {
          "/home/analista/objetivos.txt": "192.168.1.1\n",
          "/home/analista/scope.txt": "10.10.10.5\n",
        },
      }),
    ],
    hint: "Por cada objetivo, `grep -qx` contra `scope.txt`. Esta comprobación es la primera que se escribe en cualquier herramienta que vaya a tocar algo.",
    solution:
      '#!/bin/bash\nwhile read -r objetivo; do\n  if grep -qx "$objetivo" scope.txt; then\n    echo "OK $objetivo"\n  else\n    echo "FUERA $objetivo"\n  fi\ndone < objetivos.txt\n',
  },
  {
    slug: "bash-descartados-con-motivo",
    difficulty: 6,
    title: "Deja constancia de lo que descartaste",
    prompt:
      "Igual que antes, pero ahora los autorizados se imprimen en pantalla (solo la IP) y los descartados se escriben en `descartados.txt` con el formato `IP: fuera de alcance`, en el orden en que aparecen.",
    cases: [
      caso("10.10.10.5\n10.10.10.12\n", {
        files: {
          "/home/analista/objetivos.txt": "10.10.10.5\n203.0.113.9\n10.10.10.12\n",
          "/home/analista/scope.txt": "10.10.10.5\n10.10.10.12\n",
        },
        expectedFiles: { "/home/analista/descartados.txt": "203.0.113.9: fuera de alcance\n" },
      }),
      caso("", {
        files: {
          "/home/analista/objetivos.txt": "198.51.100.4\n203.0.113.9\n",
          "/home/analista/scope.txt": "10.10.10.5\n",
        },
        expectedFiles: {
          "/home/analista/descartados.txt":
            "198.51.100.4: fuera de alcance\n203.0.113.9: fuera de alcance\n",
        },
      }),
    ],
    hint: "Vacía `descartados.txt` al empezar con `> descartados.txt` y luego ve añadiendo con `>>`.",
    solution:
      '#!/bin/bash\n> descartados.txt\n\nwhile read -r objetivo; do\n  if grep -qx "$objetivo" scope.txt; then\n    echo "$objetivo"\n  else\n    echo "$objetivo: fuera de alcance" >> descartados.txt\n  fi\ndone < objetivos.txt\n',
  },
  {
    slug: "bash-ffuf-a-lista",
    difficulty: 6,
    title: "Del JSON a una lista",
    prompt:
      "`ffuf.json` trae la salida de ffuf. Imprime la URL de los resultados cuyo código sea 200, una por línea.",
    cases: [
      caso("http://10.10.10.5/api\nhttp://10.10.10.5/login\n", {
        files: { "/home/analista/ffuf.json": FFUF_JSON },
      }),
      caso("http://10.10.10.5/solo\n", {
        files: {
          "/home/analista/ffuf.json":
            '{"results":[{"url":"http://10.10.10.5/solo","status":200,"length":10}]}\n',
        },
      }),
    ],
    hint: "`jq -r '.results[] | select(.status == 200) | .url'`. El `-r` saca el texto sin comillas.",
    solution: "#!/bin/bash\njq -r '.results[] | select(.status == 200) | .url' ffuf.json\n",
  },
  {
    slug: "bash-hallazgos-por-severidad",
    difficulty: 6,
    title: "Solo lo que importa",
    prompt:
      "`nuclei.jsonl` trae un hallazgo por línea. Imprime `SEVERIDAD HOST NOMBRE` de los que NO sean de severidad `info`, en el orden del archivo.",
    cases: [
      caso("medium 10.10.10.12 Version de SSH antigua\nhigh 10.10.10.40 FTP anonimo permitido\n", {
        files: { "/home/analista/nuclei.jsonl": NUCLEI_JSONL },
      }),
      caso("", {
        files: {
          "/home/analista/nuclei.jsonl":
            '{"template-id":"x","info":{"name":"Nada","severity":"info"},"host":"10.10.10.5"}\n',
        },
      }),
    ],
    hint: 'Con jq: `select(.info.severity != "info")` y luego arma la línea con los tres campos.',
    solution:
      '#!/bin/bash\njq -r \'select(.info.severity != "info") | .info.severity + " " + .host + " " + .info.name\' nuclei.jsonl\n',
  },
  {
    slug: "bash-comparar-barridos",
    difficulty: 6,
    title: "Qué cambió desde ayer",
    prompt:
      "Tienes `ayer.txt` y `hoy.txt`, los dos con la salida de `nmap -oG`. Imprime las parejas `IP:PUERTO` que estén hoy y no estuvieran ayer, ordenadas. Si no hay ninguna, no imprimas nada.",
    cases: [
      caso("10.10.10.40:21\n10.10.10.40:3389\n10.10.10.5:80\n", {
        files: {
          "/home/analista/ayer.txt": NMAP_AYER,
          "/home/analista/hoy.txt": NMAP_GUARDADO,
        },
      }),
      caso("", {
        files: {
          "/home/analista/ayer.txt": NMAP_GUARDADO,
          "/home/analista/hoy.txt": NMAP_GUARDADO,
        },
      }),
    ],
    hint: "Saca `IP:PUERTO` de cada archivo a dos temporales ordenados y compáralos con `comm -13`, que da solo lo que está en el segundo.",
    solution:
      '#!/bin/bash\nextraer() {\n  awk -F\'\\t\' \'/Ports:/ {\n    ip = $1\n    sub(/^Host: /, "", ip)\n    sub(/ .*/, "", ip)\n    puertos = $2\n    sub(/^Ports: /, "", puertos)\n    n = split(puertos, lista, ", ")\n    for (i = 1; i <= n; i++) {\n      split(lista[i], campos, "/")\n      print ip ":" campos[1]\n    }\n  }\' "$1" | sort\n}\n\nextraer ayer.txt > .ayer\nextraer hoy.txt > .hoy\ncomm -13 .ayer .hoy\n',
  },
  {
    slug: "bash-inventario-sin-duplicados",
    difficulty: 6,
    title: "Un inventario de tres fuentes",
    prompt:
      "Junta los host de `barrido.txt`, los subdominios de `subdominios.txt` y las IP de `extra.txt` en una sola lista ordenada y sin repetidos.",
    cases: [
      caso("10.10.10.12\n10.10.10.40\n10.10.10.5\n10.10.10.7\nweb01.example.test\n", {
        files: {
          "/home/analista/barrido.txt": NMAP_GUARDADO,
          "/home/analista/subdominios.txt": "web01.example.test\n",
          "/home/analista/extra.txt": "10.10.10.7\n10.10.10.5\n",
        },
      }),
      caso("10.10.10.12\n10.10.10.5\n", {
        files: {
          "/home/analista/barrido.txt": NMAP_AYER,
          "/home/analista/subdominios.txt": "",
          "/home/analista/extra.txt": "",
        },
      }),
    ],
    hint: "Manda las tres fuentes a la misma tubería y termina en `sort -u`. Cuidado con las líneas vacías de un archivo sin nada.",
    solution:
      "#!/bin/bash\n{\n  awk '/Ports:/ {print $2}' barrido.txt\n  cat subdominios.txt\n  cat extra.txt\n} | grep -v '^$' | sort -u\n",
  },
  {
    slug: "bash-recon-completo",
    difficulty: 6,
    title: "El flujo entero",
    prompt:
      "Escribe `recon.sh`, que recibe una carpeta de trabajo como argumento. Dentro están `scope.txt` y `barrido.txt`. Tiene que escribir en pantalla un reporte así:\n```\n# Reporte de reconocimiento\nObjetivos en alcance: N\nServicios abiertos: M\n\n## Host\nIP:PUERTO\n...\n```\nLos servicios se sacan de `barrido.txt`, pero solo de los host que estén en `scope.txt`. Si no le pasan carpeta, imprime `Uso: recon.sh CARPETA` y sale con 1.",
    cases: [
      caso(
        "# Reporte de reconocimiento\nObjetivos en alcance: 2\nServicios abiertos: 4\n\n## Host\n10.10.10.12:22\n10.10.10.12:3306\n10.10.10.5:22\n10.10.10.5:80\n",
        {
          args: ["trabajo"],
          files: {
            "/home/analista/trabajo/scope.txt": "10.10.10.5\n10.10.10.12\n",
            "/home/analista/trabajo/barrido.txt": NMAP_GUARDADO,
          },
        },
      ),
      caso("Uso: recon.sh CARPETA\n", { args: [], expectedExit: 1 }),
      caso(
        "# Reporte de reconocimiento\nObjetivos en alcance: 1\nServicios abiertos: 2\n\n## Host\n10.10.10.40:21\n10.10.10.40:3389\n",
        {
          args: ["trabajo"],
          files: {
            "/home/analista/trabajo/scope.txt": "10.10.10.40\n",
            "/home/analista/trabajo/barrido.txt": NMAP_GUARDADO,
          },
        },
      ),
    ],
    hint: 'Saca las parejas `IP:PUERTO`, quédate solo con las cuya IP esté en el alcance, y cuenta antes de imprimir. `wc -l` sobre una variable se hace con `echo "$var" | wc -l`, pero ojo con la variable vacía.',
    solution:
      '#!/bin/bash\nset -u\n\nif [ $# -eq 0 ]; then\n  echo "Uso: recon.sh CARPETA"\n  exit 1\nfi\n\ncarpeta="$1"\n\nservicios=$(awk -F\'\\t\' \'/Ports:/ {\n  ip = $1\n  sub(/^Host: /, "", ip)\n  sub(/ .*/, "", ip)\n  puertos = $2\n  sub(/^Ports: /, "", puertos)\n  n = split(puertos, lista, ", ")\n  for (i = 1; i <= n; i++) {\n    split(lista[i], campos, "/")\n    print ip ":" campos[1]\n  }\n}\' "$carpeta/barrido.txt" | sort)\n\nen_alcance=""\nwhile read -r pareja; do\n  ip="${pareja%%:*}"\n  if grep -qx "$ip" "$carpeta/scope.txt"; then\n    en_alcance="$en_alcance$pareja\\n"\n  fi\ndone <<< "$servicios"\n\nobjetivos=$(grep -c . "$carpeta/scope.txt")\ntotal=$(printf "$en_alcance" | grep -c . || true)\n\necho "# Reporte de reconocimiento"\necho "Objetivos en alcance: $objetivos"\necho "Servicios abiertos: $total"\necho\necho "## Host"\nprintf "$en_alcance"\n',
  },
];

/** Los retos de un nivel, en orden. */
export function bashChallengesByLevel(level: number): BashChallenge[] {
  return BASH_CHALLENGES.filter((challenge) => challenge.difficulty === level);
}

export function findBashChallenge(slug: string): BashChallenge | undefined {
  return BASH_CHALLENGES.find((challenge) => challenge.slug === slug);
}
