/**
 * El curso de Bash: seis secciones, dieciocho lecciones.
 *
 * El hilo es el de alguien que empieza a trabajar en una terminal y termina
 * automatizando un reconocimiento: mirar, escribir un script, decidir y
 * repetir, masticar texto en serio, empaquetar lo aprendido en una herramienta
 * propia, y encadenarlo todo.
 *
 * El escenario es siempre el mismo equipo de mentira, `estacion`, con sus
 * registros y su carpeta `/opt`. Eso no es decorado: que los archivos sean los
 * mismos de una lección a otra permite que cada una se apoye en lo anterior sin
 * volver a explicar de dónde salen los datos.
 *
 * Los símbolos se escriben entre acentos graves y se pintan como código, nunca
 * se deletrean. Lo vigila
 * `lessons.prosa.test.ts`: deletrearlos obliga a traducir de vuelta mientras se
 * aprende, y eso fue lo que más costó en la primera vuelta del curso.
 */
import type { BashLesson, Section } from "./lesson-types.ts";
import { BASH_CHALLENGES } from "./bash-challenges.ts";

// ------------------------------------------------------------- el escenario

const AUTH_LOG =
  [
    "Mar 14 09:58:01 estacion sshd[2011]: Failed password for root from 10.0.0.7 port 51520 ssh2",
    "Mar 14 09:58:03 estacion sshd[2012]: Failed password for admin from 10.0.0.7 port 51522 ssh2",
    "Mar 14 09:58:09 estacion sshd[2013]: Accepted password for analista from 10.0.0.15 port 51530 ssh2",
    "Mar 14 09:59:11 estacion sshd[2020]: Failed password for root from 10.0.0.99 port 51540 ssh2",
    "Mar 14 09:59:12 estacion sshd[2021]: Failed password for root from 10.0.0.7 port 51541 ssh2",
  ].join("\n") + "\n";

const PASSWD =
  [
    "root:x:0:0:root:/root:/bin/bash",
    "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin",
    "analista:x:1000:1000:Analista:/home/analista:/bin/bash",
    "respaldo:x:1001:1001:Respaldo:/opt/respaldo:/bin/sh",
  ].join("\n") + "\n";

const NMAP_GUARDADO =
  [
    "Host: 10.10.10.5 (web01.example.test)\tPorts: 22/open/tcp//ssh///, 80/open/tcp//http///",
    "Host: 10.10.10.12 (db01.example.test)\tPorts: 22/open/tcp//ssh///, 3306/open/tcp//mysql///",
    "Host: 10.10.10.40 (old.example.test)\tPorts: 21/open/tcp//ftp///, 3389/open/tcp//ms-wbt-server///",
  ].join("\n") + "\n";

/** El escritorio de la práctica, igual en casi todas las lecciones. */
const CASA = {
  "/home/analista/auth.log": AUTH_LOG,
  "/home/analista/passwd": PASSWD,
  "/home/analista/notas.txt": "uno\ndos\ntres\n",
  "/home/analista/datos/": {},
  "/home/analista/datos/web.conf": "puerto=80\n",
  "/home/analista/datos/base.conf": "puerto=5432\n",
  "/home/analista/datos/salida.log": "todo bien\n",
};

const OPT = {
  "/opt/app/": {},
  "/opt/app/arrancar.sh": { content: "#!/bin/bash\necho arrancando\n", mode: 0o755 },
  "/opt/app/config.ini": { content: "clave=secreta\n", mode: 0o600 },
  "/opt/app/temporal.txt": { content: "basura\n", mode: 0o666 },
  "/opt/app/herramienta": { content: "binario\n", mode: 0o4755, owner: "root" },
};

// ------------------------------------------------------------- las secciones

export const BASH_SECTIONS: Section[] = [
  {
    slug: "bash-la-terminal",
    language: "bash",
    title: "La terminal y los archivos",
    summary: "Moverse, mirar, buscar y encadenar. Lo que se hace antes de escribir un script.",
    practiceSlugs: BASH_CHALLENGES.filter((c) => c.difficulty === 1).map((c) => c.slug),
  },
  {
    slug: "bash-el-script",
    language: "bash",
    title: "El script y sus variables",
    summary: "Guardar lo que haces en un archivo, darle datos y que no se rompa con un espacio.",
    practiceSlugs: BASH_CHALLENGES.filter((c) => c.difficulty === 2).map((c) => c.slug),
  },
  {
    slug: "bash-decidir",
    language: "bash",
    title: "Decidir y repetir",
    summary: "Condiciones, bucles y el patrón con el que se cuenta lo que hay en un registro.",
    practiceSlugs: BASH_CHALLENGES.filter((c) => c.difficulty === 3).map((c) => c.slug),
  },
  {
    slug: "bash-masticar",
    language: "bash",
    title: "Masticar texto en serio",
    summary: "sed, awk y find: sustituir, analizar por campos y revisar permisos.",
    practiceSlugs: BASH_CHALLENGES.filter((c) => c.difficulty === 4).map((c) => c.slug),
  },
  {
    slug: "bash-herramientas",
    language: "bash",
    title: "Herramientas propias",
    summary:
      "Funciones, opciones, códigos de salida y fallar pronto. Aquí dejas de escribir recetas.",
    practiceSlugs: BASH_CHALLENGES.filter((c) => c.difficulty === 5).map((c) => c.slug),
  },
  {
    slug: "bash-pentest",
    language: "bash",
    title: "Automatizar un pentest",
    summary: "Alcance, registro, parseo de herramientas y el flujo completo de reconocimiento.",
    practiceSlugs: BASH_CHALLENGES.filter((c) => c.difficulty === 6).map((c) => c.slug),
  },
];

// ------------------------------------------------------------- las lecciones

export const BASH_LESSONS: BashLesson[] = [
  // =================================================== 1. La terminal
  {
    slug: "bash-primeros-comandos",
    sectionSlug: "bash-la-terminal",
    language: "bash",
    title: "Mirar lo que hay",
    summary: "Dónde estás, qué hay, y cómo se lee un archivo sin abrirlo.",
    body: [
      "Una terminal es una conversación corta: tú escribes un comando, el sistema responde con texto, y ya. No hay ventanas ni botones, así que lo primero es saber preguntar tres cosas: dónde estoy, qué hay aquí, y qué dice este archivo.",
      "`pwd` responde dónde estás. `ls` lista lo que hay en el directorio, y `ls datos` lista lo que hay dentro de esa carpeta. `cat archivo` escupe el contenido entero por pantalla.",
      "Los nombres que empiezan por punto, como `.bashrc`, no salen en `ls`. No están escondidos de verdad, es una convención: son archivos de configuración que estorbarían todo el tiempo. Para verlos se pide `ls -a`.",
      "Casi todo comando acepta opciones, que se escriben con un guion delante. `ls -l` es el mismo `ls` pero con una línea por archivo y mucha más información: los permisos, el dueño, el tamaño y la fecha. Esa vista es la que se usa cuando se revisa un equipo.",
    ],
    examples: [
      {
        script: "pwd\nls\n",
        files: CASA,
        note: "`ls` ordena alfabéticamente y no dice nada más. Prueba a cambiarlo por `ls datos` para mirar dentro de la carpeta.",
      },
      {
        script: "ls -l datos\n",
        files: CASA,
        note: "Las diez letras de la izquierda son los permisos. La primera dice si es un archivo o un directorio, y las otras nueve van de tres en tres: dueño, grupo y todos los demás.",
      },
      {
        script: "cat notas.txt\n",
        files: CASA,
        note: "`cat` imprime el archivo entero. Con uno de mil líneas te llenaría la pantalla, y por eso existen `head` y `tail`, que vienen en la lección de tuberías.",
      },
    ],
    exercise: {
      prompt:
        "Imprime el contenido de `passwd`, que es el archivo donde un sistema Linux guarda sus usuarios.",
      cases: [
        { files: CASA, expected: PASSWD },
        {
          files: { "/home/analista/passwd": "ana:x:1:1::/home/ana:/bin/bash\n" },
          expected: "ana:x:1:1::/home/ana:/bin/bash\n",
        },
      ],
      hint: "Un solo comando: `cat` seguido del nombre del archivo.",
      solution: "#!/bin/bash\ncat passwd\n",
    },
  },
  {
    slug: "bash-buscar-en-texto",
    sectionSlug: "bash-la-terminal",
    language: "bash",
    title: "Encontrar la aguja",
    summary: "grep, que es la herramienta con la que más vas a trabajar.",
    body: [
      "Un registro de un servidor tiene miles de líneas y a ti te interesan tres. `grep PATRÓN ARCHIVO` imprime solo las líneas que contienen ese patrón, y es el comando que más se escribe en seguridad.",
      "Las opciones que vas a usar todos los días son cuatro. `-i` no distingue mayúsculas de minúsculas, `-v` da la vuelta al filtro y deja pasar las que NO casan, `-n` pone delante el número de línea, y `-c` cuenta en vez de imprimir.",
      "El patrón no es texto pelado: es una expresión regular. Eso significa que `.` es un comodín de un carácter cualquiera, `^` ancla al principio de la línea y `$` al final. Así, `grep '^Mar 14' auth.log` solo casa las líneas que EMPIEZAN por esa fecha.",
      "Entrecomilla siempre el patrón. Sin comillas, el shell puede confundir un `*` o un `$` con algo suyo y cambiártelo antes de que `grep` lo vea. Con comillas simples, lo que escribes es exactamente lo que busca.",
    ],
    examples: [
      {
        script: "grep 'Failed password' auth.log\n",
        files: CASA,
        note: "Cinco líneas en el archivo, cuatro fallidas. Cambia el patrón por `Accepted` para ver el que sí entró.",
      },
      {
        script: "grep -c Failed auth.log\ngrep -n Accepted auth.log\ngrep -v Failed auth.log\n",
        files: CASA,
        note: "`-c` cuenta, `-n` numera y `-v` invierte. Son la misma búsqueda con tres preguntas distintas.",
      },
      {
        script: "grep '^Mar 14 09:58' auth.log\n",
        files: CASA,
        note: "`^` obliga a que la línea empiece ahí. Quítalo y verás que sigue casando lo mismo, porque la fecha ya estaba al principio; pruébalo con un patrón que esté en medio para notar la diferencia.",
      },
    ],
    exercise: {
      prompt:
        "Imprime cuántas líneas de `auth.log` mencionan a `root`. Solo el número, sin nada más.",
      cases: [
        { files: CASA, expected: "3\n" },
        {
          files: {
            "/home/analista/auth.log":
              "Mar 15 11:00:01 estacion sshd[3001]: Failed password for admin from 10.0.0.31 port 60001 ssh2\n",
          },
          expected: "0\n",
        },
      ],
      hint: "`grep -c` cuenta las líneas que casan. No hace falta encadenar nada más.",
      solution: "#!/bin/bash\ngrep -c root auth.log\n",
    },
  },
  {
    slug: "bash-tuberias",
    sectionSlug: "bash-la-terminal",
    language: "bash",
    title: "Encadenar comandos",
    summary: "La tubería, las redirecciones, y por qué cada comando hace una sola cosa.",
    body: [
      "La idea que sostiene toda la terminal es esta: cada comando hace una cosa y la hace sobre texto, así que la salida de uno puede ser la entrada del siguiente. El símbolo que los encadena es `|`, la tubería.",
      "`cat auth.log | grep Failed | wc -l` se lee de izquierda a derecha: saca el archivo, quédate con las líneas fallidas, y cuenta cuántas quedaron. Ninguno de los tres sabe de los otros, y ahí está la gracia.",
      "Para quedarte con un pedazo hay dos comandos hermanos: `head -n 3` da las tres primeras líneas y `tail -n 3` las tres últimas. `tail` es el que más se usa en un registro, porque lo último que pasó está al final.",
      "Y para guardar en vez de mirar están las redirecciones. `> archivo` manda la salida a ese archivo y lo deja con eso dentro, borrando lo que hubiera. `>> archivo` añade al final sin borrar. `< archivo` hace lo contrario: le da ese archivo a un comando como entrada.",
      "Hay una segunda salida que conviene conocer ya: la de errores. Cuando un comando se queja, ese texto no va por la tubería, va por un canal aparte. Por eso `2> errores.txt` guarda las quejas y `2>/dev/null` las tira a la basura.",
    ],
    examples: [
      {
        script: "cat auth.log | grep Failed | wc -l\n",
        files: CASA,
        note: "Tres comandos, una sola respuesta. Quita el último tramo para ver qué le llega a `wc`.",
      },
      {
        script: "head -n 2 auth.log\necho ---\ntail -n 1 auth.log\n",
        files: CASA,
        note: "El `echo ---` de en medio es un truco para separar visualmente dos salidas mientras pruebas.",
      },
      {
        script:
          "grep Failed auth.log > fallos.txt\nwc -l < fallos.txt\ncat fallos.txt | head -n 1\n",
        files: CASA,
        note: "`>` escribió el archivo y `<` se lo dio a `wc`. Fíjate en que `wc -l < archivo` imprime el número pelado, sin el nombre detrás.",
      },
    ],
    exercise: {
      prompt:
        "Imprime las 2 últimas líneas de `auth.log` que mencionen `Failed password`. Encadena `grep` con `tail`.",
      cases: [
        {
          files: CASA,
          expected:
            "Mar 14 09:59:11 estacion sshd[2020]: Failed password for root from 10.0.0.99 port 51540 ssh2\nMar 14 09:59:12 estacion sshd[2021]: Failed password for root from 10.0.0.7 port 51541 ssh2\n",
        },
        {
          files: {
            "/home/analista/auth.log":
              "Mar 15 11:00:01 estacion sshd[3001]: Failed password for admin from 10.0.0.31 port 60001 ssh2\nMar 15 11:00:09 estacion sshd[3003]: Accepted password for ana from 10.0.0.15 port 60009 ssh2\n",
          },
          expected:
            "Mar 15 11:00:01 estacion sshd[3001]: Failed password for admin from 10.0.0.31 port 60001 ssh2\n",
        },
      ],
      hint: "Primero filtras y después recortas: `grep ... | tail -n 2`. Al revés daría otra cosa, porque recortarías antes de filtrar.",
      solution: "#!/bin/bash\ngrep 'Failed password' auth.log | tail -n 2\n",
    },
  },

  // =================================================== 2. El script
  {
    slug: "bash-tu-primer-script",
    sectionSlug: "bash-el-script",
    language: "bash",
    title: "Guardarlo en un archivo",
    summary: "El shebang, el permiso de ejecución y el código de salida.",
    body: [
      "Un script es lo mismo que acabas de escribir en la terminal, pero guardado en un archivo para no volver a teclearlo. La primera línea se llama shebang y dice con qué se ejecuta: `#!/bin/bash`.",
      "Que un archivo tenga comandos dentro no basta para poder correrlo. Hace falta el permiso de ejecución, que se da con `chmod +x archivo`. Sin él, el sistema responde `Permission denied` aunque el contenido sea perfecto.",
      "Todo lo que va detrás de `#` en una línea es un comentario y no se ejecuta. Un script sin comentarios se entiende hoy y ya no dentro de tres meses.",
      "Cuando un script termina deja un número: el código de salida. Cero significa que todo fue bien y cualquier otro número significa que algo falló. Ese número no es decorativo: es como un script le habla al que lo llamó, y lo vas a usar en cuanto encadenes dos. Se pone con `exit`, y se consulta con `$?`.",
    ],
    examples: [
      {
        script:
          '#!/bin/bash\n# Esto es un comentario: no se ejecuta.\necho "Revisando el equipo"\necho "Listo"\n',
        note: "El shebang no cambia nada mientras lo corres desde aquí, pero es lo que hace que el archivo sea ejecutable de verdad en un sistema.",
      },
      {
        script:
          'printf \'#!/bin/bash\\necho corriendo\\n\' > tarea.sh\n./tarea.sh\necho "salida: $?"\nchmod +x tarea.sh\n./tarea.sh\necho "salida: $?"\n',
        note: 'El primer intento falla con 126, que es el código de "existe pero no puedo ejecutarlo". Después de `chmod +x` el mismo archivo corre.',
      },
      {
        script:
          'grep Accepted auth.log > /dev/null\necho "encontro: $?"\ngrep NOEXISTE auth.log > /dev/null\necho "no encontro: $?"\n',
        files: CASA,
        note: "`grep` devuelve 0 cuando encuentra algo y 1 cuando no. Eso, que parece un detalle, es lo que hace que se pueda usar dentro de un `if`.",
      },
    ],
    exercise: {
      prompt:
        "Escribe un script que imprima `revisado` y termine con código de salida 0. Luego cámbialo para que termine con 3 y fíjate en que la salida impresa es la misma pero el código no.",
      cases: [{ expected: "revisado\n", expectedExit: 3 }],
      hint: "`echo revisado` y después `exit 3`. Lo que va detrás de un `exit` ya no se ejecuta.",
      solution: "#!/bin/bash\necho revisado\nexit 3\n",
    },
  },
  {
    slug: "bash-variables-y-comillas",
    sectionSlug: "bash-el-script",
    language: "bash",
    title: "Variables, y por qué las comillas son seguridad",
    summary: "Guardar valores, meter la salida de un comando dentro, y el error que rompe scripts.",
    body: [
      "Una variable se crea sin espacios alrededor del igual: `archivo=auth.log`. Y se usa con `$` delante: `cat $archivo`. Si pones espacios, bash cree que `archivo` es un comando y se queja.",
      "Con `$(comando)` metes la salida de un comando dentro de una variable o de un texto. `total=$(grep -c Failed auth.log)` deja el número en `total`, listo para usarlo.",
      "Y ahora lo que de verdad importa de esta lección. Hay tres formas de entrecomillar y no son intercambiables: entre comillas dobles, `\"$archivo\"`, la variable se resuelve; entre comillas simples, `'$archivo'`, no se resuelve nada y sale el texto tal cual; y sin comillas, la variable se resuelve y ADEMÁS su contenido se parte por espacios.",
      'Esa última parte es un agujero de seguridad, no una rareza. Si `archivo` vale `informe final.txt` y escribes `rm $archivo`, el shell entiende dos nombres y borra dos cosas. Con `rm "$archivo"` borra una. La regla es simple: entrecomilla siempre las variables, y solo quítales las comillas cuando sepas exactamente por qué.',
    ],
    examples: [
      {
        script:
          'archivo="auth.log"\nfallos=$(grep -c Failed "$archivo")\necho "El archivo $archivo tiene $fallos intentos fallidos"\n',
        files: CASA,
        note: "`$(...)` corre el comando y se queda con lo que imprimió. Prueba a cambiar `grep -c` por `wc -l` y verás el total de líneas.",
      },
      {
        script: 'nombre="Ana Luisa"\necho "con dobles: $nombre"\necho \'con simples: $nombre\'\n',
        note: "Entre comillas simples no se resuelve nada. Sirve justo para eso, cuando quieres enseñar un `$` sin que se lo coma el shell.",
      },
      {
        script:
          'archivo="dos palabras.txt"\necho contenido > "$archivo"\nls\necho "--- sin comillas, el shell ve dos nombres:"\nwc -l $archivo\n',
        files: { "/home/analista/": {} },
        note: "El `wc` de abajo se queja de dos archivos que no existen, porque partió el nombre por el espacio. Ponle las comillas y mira cómo cambia.",
      },
    ],
    exercise: {
      prompt:
        "Guarda en una variable `cuantos` el número de líneas de `auth.log` e imprime `El registro tiene N lineas`, con el número en el sitio de la N.",
      cases: [
        { files: CASA, expected: "El registro tiene 5 lineas\n" },
        {
          files: { "/home/analista/auth.log": "una sola\n" },
          expected: "El registro tiene 1 lineas\n",
        },
      ],
      hint: "`cuantos=$(wc -l < auth.log)` y después un `echo` con comillas dobles para que la variable se resuelva dentro del texto.",
      solution:
        '#!/bin/bash\ncuantos=$(wc -l < auth.log)\necho "El registro tiene $cuantos lineas"\n',
    },
  },
  {
    slug: "bash-argumentos",
    sectionSlug: "bash-el-script",
    language: "bash",
    title: "Que el script reciba datos",
    summary: "Argumentos, valores de respaldo y leer de la entrada.",
    body: [
      "Un script que solo sirve para un archivo concreto no es una herramienta, es una nota. Para que sirva para cualquiera hay que pasarle datos al llamarlo, y esos datos llegan en unas variables que bash prepara solo.",
      "`$1` es el primer argumento, `$2` el segundo, y así. `$#` dice cuántos llegaron y `$@` son todos juntos. `$0` es el nombre del propio script.",
      'Cuando recorras los argumentos, usa `"$@"` con comillas. Sin ellas, un argumento con espacios se parte en dos, que es el mismo problema de la lección anterior.',
      'Si un dato puede faltar, dale un valor de respaldo con `${1:-algo}`: eso significa "el primer argumento, o `algo` si vino vacío". Es la forma corta de no tener que escribir un `if` para cada dato opcional.',
      "Y si el dato no viene por argumento sino por la entrada, se lee con `read`. `read -r linea` toma una línea y la guarda en `linea`. El `-r` casi siempre va: sin él, una barra invertida en el texto desaparece.",
    ],
    examples: [
      {
        script: 'echo "me llamo: $0"\necho "me llegaron $# argumentos"\necho "el primero es: $1"\n',
        args: ["auth.log", "root"],
        note: "Cambia los argumentos de arriba y vuelve a ejecutar para ver cómo cambia todo.",
      },
      {
        script: 'nivel="${1:-info}"\necho "Nivel: $nivel"\n',
        args: [],
        note: "Sin argumentos usa `info`. Escribe uno arriba y verás que gana el que le pasas.",
      },
      {
        script: 'read -r primera\necho "la primera linea decia: $primera"\n',
        stdin: "hola desde la entrada\nsegunda linea\n",
        note: "`read` consume una sola línea. Si lo pones dentro de un bucle, va leyendo una por vuelta, y eso es lo que viene en la sección siguiente.",
      },
    ],
    exercise: {
      prompt:
        "El script recibe el nombre de un archivo. Imprime `NOMBRE: N lineas`, con el nombre tal como te lo pasaron y el número de líneas que tiene.",
      cases: [
        { args: ["auth.log"], files: CASA, expected: "auth.log: 5 lineas\n" },
        { args: ["notas.txt"], files: CASA, expected: "notas.txt: 3 lineas\n" },
      ],
      hint: 'Guarda el conteo con `$(wc -l < "$1")` y luego imprime las dos cosas en un `echo` con comillas dobles.',
      solution: '#!/bin/bash\nlineas=$(wc -l < "$1")\necho "$1: $lineas lineas"\n',
    },
  },

  // =================================================== 3. Decidir y repetir
  {
    slug: "bash-condicionales",
    sectionSlug: "bash-decidir",
    language: "bash",
    title: "Decidir",
    summary: "if, las pruebas de archivo, y la diferencia entre comparar textos y números.",
    body: [
      "Un `if` en bash no pregunta si algo es verdadero: pregunta si un comando terminó bien. Por eso `if grep -q root passwd; then ...` funciona sin más, porque `grep` devuelve 0 cuando encuentra algo.",
      'Para preguntar por archivos y por textos existe un comando llamado `test`, que casi siempre se escribe con su otro nombre, los corchetes. `[ -f archivo ]` es cierto si existe y es un archivo, `[ -d carpeta ]` si es un directorio, `[ -s archivo ]` si además tiene algo dentro, y `[ -z "$texto" ]` si el texto está vacío.',
      "Ojo con los espacios: `[ -f x ]` lleva espacio después del corchete y antes del de cierre, porque el corchete es un comando y esos son sus argumentos. Sin los espacios, no funciona.",
      "Los números y los textos se comparan distinto. Para números van `-eq`, `-ne`, `-lt`, `-le`, `-gt` y `-ge`. Para textos van `=` y `!=`. Comparar números con `=` a veces parece funcionar y luego falla, porque `010` y `10` son el mismo número pero distinto texto.",
      "Bash moderno trae también `[[ ... ]]`, con dos corchetes, que es más cómodo: dentro no hace falta entrecomillar tanto, se puede usar `&&` y `||`, y `=~` compara con una expresión regular. Cuando puedas elegir, usa los dobles.",
    ],
    examples: [
      {
        script:
          'if [ -f auth.log ]; then\n  echo "el registro esta"\nelse\n  echo "no hay registro"\nfi\n\nif [ -d datos ]; then\n  echo "datos es una carpeta"\nfi\n',
        files: CASA,
        note: "Cambia `auth.log` por un nombre que no exista para ver la otra rama.",
      },
      {
        script:
          'total=$(grep -c Failed auth.log)\nif [ "$total" -gt 3 ]; then\n  echo "demasiados fallos: $total"\nelse\n  echo "normal: $total"\nfi\n',
        files: CASA,
        note: "`-gt` es para números. Prueba a cambiarlo por `-gt 10` y verás la otra rama.",
      },
      {
        script:
          'archivo="informe.log"\nif [[ $archivo == *.log ]]; then\n  echo "es un registro"\nfi\nif [[ $archivo =~ ^inf ]]; then\n  echo "y empieza por inf"\nfi\n',
        note: "Dentro de `[[ ]]`, `==` compara con un patrón y `=~` con una expresión regular. Eso no se puede hacer con un solo corchete.",
      },
    ],
    exercise: {
      prompt:
        "El script recibe un nombre de archivo. Si existe y tiene contenido, imprime `ok`. Si existe pero está vacío, imprime `vacio`. Si no existe, imprime `falta`.",
      cases: [
        { args: ["auth.log"], files: CASA, expected: "ok\n" },
        {
          args: ["nada.txt"],
          files: { "/home/analista/nada.txt": "" },
          expected: "vacio\n",
        },
        { args: ["fantasma.txt"], files: CASA, expected: "falta\n" },
      ],
      hint: 'Tres ramas: `if [ -s "$1" ]`, luego `elif [ -f "$1" ]`, y `else` para el resto.',
      solution:
        '#!/bin/bash\nif [ -s "$1" ]; then\n  echo ok\nelif [ -f "$1" ]; then\n  echo vacio\nelse\n  echo falta\nfi\n',
    },
  },
  {
    slug: "bash-bucles",
    sectionSlug: "bash-decidir",
    language: "bash",
    title: "Repetir",
    summary: "for sobre una lista, while sobre un archivo, y cómo cortar un bucle.",
    body: [
      "Hay dos bucles que se usan casi siempre. El `for` recorre una lista que ya tienes, y el `while read` recorre un archivo línea por línea.",
      '`for x in a b c; do ... done` da una vuelta por cada elemento. La lista puede venir de argumentos con `"$@"`, de archivos con `datos/*.conf`, o de la salida de un comando con `$(...)`.',
      "Para leer un archivo, el patrón es `while read -r linea; do ... done < archivo`. Fíjate dónde va la redirección: al final del `done`, no dentro. Eso es porque el archivo alimenta al bucle entero, no a una vuelta.",
      "Cuando cada línea trae campos separados por algo, se pueden leer de golpe: `while IFS=: read -r usuario resto; do` parte por `:` y te deja el primer campo en `usuario`. `IFS` es la variable que dice por dónde cortar, y ponerla delante del `read` solo la cambia para esa línea.",
      'Dentro de un bucle, `break` lo corta del todo y `continue` salta a la vuelta siguiente. Los dos son formas de decir "ya no me hace falta seguir con esto".',
    ],
    examples: [
      {
        script: 'for puerto in 22 80 443; do\n  echo "revisando el puerto $puerto"\ndone\n',
        note: "La lista está escrita a mano. Prueba a cambiarla por `$(seq 1 5)` para que la genere un comando.",
      },
      {
        script: 'for archivo in datos/*.conf; do\n  echo "== $archivo"\n  cat "$archivo"\ndone\n',
        files: CASA,
        note: "El `*` lo resuelve el shell antes de arrancar el bucle: para cuando `for` empieza, ya tiene los nombres.",
      },
      {
        script:
          'while IFS=: read -r usuario _ uid _; do\n  echo "$usuario tiene uid $uid"\ndone < passwd\n',
        files: CASA,
        note: "El `_` es una variable de usar y tirar, para los campos que no te interesan. La redirección va al final del `done`.",
      },
    ],
    exercise: {
      prompt:
        "Recorre `notas.txt` línea por línea e imprime cada una con su número delante, en el formato `1: uno`. Cuenta tú las líneas con una variable, sin usar `grep -n`.",
      cases: [
        { files: CASA, expected: "1: uno\n2: dos\n3: tres\n" },
        {
          files: { "/home/analista/notas.txt": "alfa\nbeta\n" },
          expected: "1: alfa\n2: beta\n",
        },
      ],
      hint: "Lleva un contador fuera del bucle y súmale uno en cada vuelta con `n=$((n + 1))`.",
      solution:
        '#!/bin/bash\nn=0\nwhile read -r linea; do\n  n=$((n + 1))\n  echo "$n: $linea"\ndone < notas.txt\n',
    },
  },
  {
    slug: "bash-cortar-y-contar",
    sectionSlug: "bash-decidir",
    language: "bash",
    title: "Cortar, ordenar y contar",
    summary: "El patrón que responde la pregunta más común de un registro.",
    body: [
      "Hay una pregunta que se repite todo el tiempo al mirar un registro: qué es lo que más aparece. La respuesta casi siempre es la misma cadena de cuatro comandos, y conviene aprendérsela como una sola cosa.",
      "`cut` se queda con un pedazo de cada línea. `cut -d: -f1 passwd` parte por `:` y toma el primer campo. `-d` es el delimitador y `-f` el campo o los campos.",
      "`sort` ordena, y `sort -n` ordena como números en vez de como texto, que es lo que hace que `100` no quede antes que `9`. `sort -r` le da la vuelta y `sort -u` quita los repetidos.",
      "`uniq -c` cuenta, pero solo junta líneas que estén PEGADAS. Por eso siempre va detrás de un `sort`: sin ordenar antes, cuenta mal y no avisa.",
      'Junta las piezas y tienes el patrón: `... | sort | uniq -c | sort -rn | head`. Ordena, cuenta, ordena por cantidad de mayor a menor, y quédate con los primeros. Eso responde "qué IP insistió más" y media docena de preguntas parecidas.',
    ],
    examples: [
      {
        script: "cut -d: -f1 passwd\necho ---\ncut -d: -f1,7 passwd\n",
        files: CASA,
        note: "Con `-f1,7` pide dos campos y los junta con el mismo delimitador. Prueba con `-f3` para ver los identificadores.",
      },
      {
        script:
          "grep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' auth.log\necho '--- ahora ordenadas y contadas:'\ngrep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' auth.log | sort | uniq -c\n",
        files: CASA,
        note: "`grep -oE` imprime solo lo que casa, una coincidencia por línea, en vez de la línea entera. Es la forma de extraer datos de un texto.",
      },
      {
        script:
          "grep 'Failed password' auth.log \\\n  | grep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' \\\n  | sort | uniq -c | sort -rn\n",
        files: CASA,
        note: "El patrón completo. La barra al final de la línea la une con la siguiente, y sirve para que una tubería larga se lea por partes.",
      },
    ],
    exercise: {
      prompt:
        "De `passwd`, imprime los shells que usan los usuarios, ordenados y sin repetir. El shell es el último campo, separado por `:`.",
      cases: [
        { files: CASA, expected: "/bin/bash\n/bin/sh\n/usr/sbin/nologin\n" },
        {
          files: {
            "/home/analista/passwd": "ana:x:1:1::/home/ana:/bin/zsh\nbot:x:2:2::/srv:/bin/zsh\n",
          },
          expected: "/bin/zsh\n",
        },
      ],
      hint: "`cut -d: -f7` saca el campo, y `sort -u` ordena quitando los repetidos de una vez.",
      solution: "#!/bin/bash\ncut -d: -f7 passwd | sort -u\n",
    },
  },

  // =================================================== 4. Masticar texto
  {
    slug: "bash-sed",
    sectionSlug: "bash-masticar",
    language: "bash",
    title: "Sustituir y recortar con sed",
    summary: "El editor que trabaja sobre el flujo, sin abrir nada.",
    body: [
      "`sed` edita texto según pasa. No abre un archivo ni lo modifica: recibe líneas, les aplica una orden y las suelta. Eso lo hace perfecto para meterlo en medio de una tubería.",
      "La orden que vas a usar el noventa por ciento de las veces es la sustitución: `sed 's/viejo/nuevo/'`. Cambia la PRIMERA aparición de cada línea. Con una `g` al final, `s/viejo/nuevo/g`, cambia todas.",
      "Antes de la orden puede ir una dirección, que dice en qué líneas actuar. `sed '2d'` borra la segunda línea, `sed '1,3d'` borra de la uno a la tres, y `sed '/ERROR/d'` borra las que contengan ERROR. Un `!` detrás de la dirección le da la vuelta.",
      "La pareja `-n` y `p` es el otro uso frecuente: `-n` le dice a `sed` que no imprima nada por su cuenta, y `p` que imprima solo lo que tú marques. Así `sed -n '/ERROR/p'` se parece a un `grep`.",
      "En la sustitución, `&` en la parte derecha significa \"lo que casó\", y si agrupas con `\\(` y `\\)` puedes recuperar cada grupo con `\\1`, `\\2`. Con eso se recorta lo que sobra de una línea: `sed -n 's/.*from \\([0-9.]*\\) port.*/\\1/p'` deja solo la dirección.",
    ],
    examples: [
      {
        script: "echo 'a-b-c' | sed 's/-/+/'\necho 'a-b-c' | sed 's/-/+/g'\n",
        note: "Sin la `g` cambia una sola vez por línea. Es el olvido más común con `sed`.",
      },
      {
        script:
          "sed -n '2p' notas.txt\necho ---\nsed '2d' notas.txt\necho ---\nsed -n '/Failed/p' auth.log | head -n 2\n",
        files: CASA,
        note: "Las direcciones son lo que hace a `sed` distinto de un simple reemplazo: puedes decir DÓNDE, no solo QUÉ.",
      },
      {
        script: "sed -n 's/.*from \\([0-9.]*\\) port.*/\\1/p' auth.log | sort -u\n",
        files: CASA,
        note: "El grupo entre `\\(` y `\\)` se recupera con `\\1`. Toda la línea se reemplaza por ese trozo, así que lo que queda es solo la dirección.",
      },
    ],
    exercise: {
      prompt:
        "De `passwd`, cambia todos los `/bin/bash` por `/bin/rbash` e imprime el resultado. No modifiques el archivo, solo imprime.",
      cases: [
        {
          files: CASA,
          expected:
            "root:x:0:0:root:/root:/bin/rbash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\nanalista:x:1000:1000:Analista:/home/analista:/bin/rbash\nrespaldo:x:1001:1001:Respaldo:/opt/respaldo:/bin/sh\n",
        },
        {
          files: { "/home/analista/passwd": "ana:x:1:1::/home/ana:/bin/bash\n" },
          expected: "ana:x:1:1::/home/ana:/bin/rbash\n",
        },
      ],
      hint: "Una sustitución basta. El delimitador no tiene que ser `/`: como el texto lleva barras, queda más limpio con `sed 's|/bin/bash|/bin/rbash|'`.",
      solution: "#!/bin/bash\nsed 's|/bin/bash|/bin/rbash|' passwd\n",
    },
  },
  {
    slug: "bash-awk",
    sectionSlug: "bash-masticar",
    language: "bash",
    title: "Analizar por campos con awk",
    summary: "El caballo de batalla del análisis de registros.",
    body: [
      "`awk` no es un comando, es un lenguaje pequeño hecho para texto en columnas. Un programa suyo es una lista de reglas `patrón { acción }`: por cada línea mira las reglas y ejecuta la acción de las que casen.",
      "Lo primero que hace con cada línea es partirla en campos. `$1` es el primero, `$2` el segundo, `$NF` el último y `$0` la línea entera. `NF` es cuántos campos hay y `NR` en qué número de línea vas.",
      "Por defecto parte por espacios. Con `-F:` parte por `:`, y eso convierte a `awk` en un `cut` con superpoderes: `awk -F: '{print $1, $7}' passwd`.",
      "El patrón puede ser una condición: `awk '$3 > 500 {print $1}'` solo actúa en las líneas cuyo tercer campo pase de 500. Y puede ser una expresión regular entre barras: `awk '/Failed/ {print $9}'`.",
      "Dos bloques especiales cierran el lenguaje. `BEGIN { }` corre antes de leer nada y `END { }` después de todo, que es donde se imprimen los totales. Con eso y un arreglo puedes contar: `{cuenta[$1]++} END {for (k in cuenta) print k, cuenta[k]}` cuenta cuántas veces aparece cada valor del primer campo.",
      'Y para que un informe se lea, `printf` alinea en columnas: `printf "%-16s %3d\\n", ip, total` pone la dirección a la izquierda en dieciséis espacios y el número a la derecha en tres.',
    ],
    examples: [
      {
        script: "awk '{print $1}' notas.txt\necho ---\nawk -F: '{print $1, $7}' passwd\n",
        files: CASA,
        note: "La coma en el `print` mete el separador de salida, que por defecto es un espacio. Sin la coma, los campos salen pegados.",
      },
      {
        script:
          "awk -F: '$3 >= 1000 {print $1, \"es un usuario de persona\"}' passwd\necho ---\nawk 'NR == 2' notas.txt\n",
        files: CASA,
        note: "Una regla sin acción imprime la línea entera, y por eso `NR == 2` sola funciona como un `sed -n '2p'`.",
      },
      {
        script:
          "grep Failed auth.log | awk '{cuenta[$9]++} END {for (u in cuenta) printf \"%-8s %d\\n\", u, cuenta[u]}' | sort\n",
        files: CASA,
        note: "El campo 9 es el usuario. El arreglo no se declara: se usa y ya. El `sort` del final está porque el orden de un `for in` no está garantizado.",
      },
    ],
    exercise: {
      prompt:
        "De `passwd`, imprime el nombre y el identificador de los usuarios cuyo identificador sea 1000 o más, con el formato `nombre 1000`.",
      cases: [
        { files: CASA, expected: "analista 1000\nrespaldo 1001\n" },
        {
          files: {
            "/home/analista/passwd":
              "root:x:0:0::/root:/bin/bash\nana:x:1500:1500::/home/ana:/bin/bash\n",
          },
          expected: "ana 1500\n",
        },
      ],
      hint: "`awk -F:` para partir por `:`, la condición `$3 >= 1000` como patrón, y `{print $1, $3}` como acción.",
      solution: "#!/bin/bash\nawk -F: '$3 >= 1000 {print $1, $3}' passwd\n",
    },
  },
  {
    slug: "bash-buscar-archivos",
    sectionSlug: "bash-masticar",
    language: "bash",
    title: "Buscar archivos y revisar permisos",
    summary: "find, los permisos como dato, y por qué un SUID de más es un hallazgo.",
    body: [
      "`find` recorre un árbol de directorios entero y se queda con lo que cumple unas condiciones. No se escribe con banderas sueltas sino como una frase: `find /opt -type f -name '*.sh'` se lee \"bajo /opt, los que sean archivos y se llamen algo punto sh\".",
      "Las condiciones más usadas son `-name` por nombre, `-type f` o `-type d` por tipo, `-size` por tamaño y `-mtime` por cuándo se tocó. Se pueden encadenar todas las que quieras y se cumplen todas a la vez.",
      'La que importa en seguridad es `-perm`, y tiene tres formas que no significan lo mismo. `-perm 644` es exactamente ese modo. `-perm -4000` es "que tenga AL MENOS estos bits", o sea todos los SUID. Y `-perm /002` es "que tenga alguno de estos", que sirve para encontrar lo que cualquiera puede escribir.',
      "Un archivo con SUID corre con los permisos de su dueño y no con los tuyos. Que `/usr/bin/passwd` lo tenga es normal, porque necesita tocar un archivo de root. Que lo tenga un script en `/opt` que instaló alguien es justo lo que hay que mirar.",
      "Para hacer algo con lo que encuentras hay dos caminos. `-exec comando {} ;` corre el comando una vez por resultado, poniendo la ruta donde está `{}`. O mandas la lista por una tubería a `xargs`, que junta los resultados y se los pasa de golpe al comando que le digas.",
    ],
    examples: [
      {
        script: "find /opt -type f | sort\necho ---\nfind /opt -name '*.sh' | sort\n",
        files: OPT,
        note: "Sin condiciones, `find` lo lista todo. Cada condición que añades recorta.",
      },
      {
        script:
          "echo 'con SUID:'\nfind /opt -type f -perm -4000\necho 'que cualquiera puede escribir:'\nfind /opt -type f -perm /002\n",
        files: OPT,
        note: "Dos búsquedas que en una revisión de verdad son de las primeras que se hacen. Fíjate en el guion y la barra: no significan lo mismo.",
      },
      {
        script: "find /opt -type f | sort | xargs stat -c '%a %n'\n",
        files: OPT,
        note: "`stat -c '%a %n'` imprime el modo en octal y el nombre. Con `xargs` se lo aplicas a todo lo que encontró `find`.",
      },
    ],
    exercise: {
      prompt:
        "Imprime la ruta de los archivos bajo `/opt` que cualquiera pueda escribir, ordenada. Son los que tienen el bit de escritura para el resto del mundo.",
      cases: [
        { files: OPT, expected: "/opt/app/temporal.txt\n" },
        {
          files: {
            "/opt/dos/": {},
            "/opt/dos/abierto.txt": { content: "x\n", mode: 0o777 },
            "/opt/dos/cerrado.txt": { content: "x\n", mode: 0o644 },
          },
          expected: "/opt/dos/abierto.txt\n",
        },
      ],
      hint: "`find /opt -type f -perm /002`, y encadena `sort` para que el orden sea siempre el mismo.",
      solution: "#!/bin/bash\nfind /opt -type f -perm /002 | sort\n",
    },
  },

  // =================================================== 5. Herramientas propias
  {
    slug: "bash-funciones-y-errores",
    sectionSlug: "bash-herramientas",
    language: "bash",
    title: "Funciones y fallar pronto",
    summary: "Trocear el script, variables locales, y el modo estricto.",
    body: [
      "Una función es un trozo de script con nombre: `revisar() { ... }`, y se llama escribiendo `revisar`. Dentro, sus argumentos también son `$1`, `$2`, que es lo que la hace reutilizable.",
      "Las variables que declares dentro de una función son globales salvo que digas lo contrario. Eso muerde: una función que usa `i` para contar te pisa el `i` de fuera y el fallo aparece lejos de donde está la causa. Se arregla con `local i`.",
      "Una función no devuelve un valor, devuelve un código de salida. Si quieres que responda sí o no, deja que la última orden hable: `es_ip() { [[ $1 =~ ^[0-9]+ ]]; }` ya vale para usarla en un `if`. Y si lo que quieres es un dato, imprímelo y recógelo con `$(...)`.",
      "El modo estricto son tres opciones que se ponen juntas al principio: `set -euo pipefail`. `-e` corta el script en cuanto un comando falla, `-u` lo corta si usas una variable que no existe, y `pipefail` hace que una tubería falle si falla cualquier tramo, no solo el último.",
      "Sin `-e`, un script sigue adelante después de un error y termina haciendo daño con datos a medias. Con `-e`, se para donde se rompió. Es la diferencia entre enterarte ahí y enterarte tres pasos después.",
      "Y para recoger lo que dejaste a medias está `trap`. `trap 'rm -f temporal.txt' EXIT` dice \"pase lo que pase, al salir borra eso\". Corre aunque el script se corte por un error, que es justo cuando más falta hace.",
    ],
    examples: [
      {
        script:
          'aviso() {\n  echo "[$1] $2"\n}\n\naviso INFO "empezando"\naviso ALERTA "hay un SUID raro"\n',
        note: "La misma función con datos distintos. Cambia el cuerpo para que ponga la hora delante y verás que cambia en los dos sitios a la vez.",
      },
      {
        script:
          'contador="de fuera"\n\nprocesar() {\n  local contador="de dentro"\n  echo "en la funcion: $contador"\n}\n\nprocesar\necho "fuera sigue siendo: $contador"\n',
        note: "Quítale el `local` y vuelve a ejecutar: la de fuera se pierde. Ese es el fallo que cuesta encontrar.",
      },
      {
        script:
          'set -euo pipefail\ntrap \'echo "recogiendo antes de salir"\' EXIT\n\necho "paso 1"\ncat no-existe.txt 2>/dev/null\necho "paso 2 (esto no se imprime)"\n',
        note: "El script se corta en el `cat` por `set -e`, pero el `trap` corre igual. Quita el `set -euo pipefail` y verás que llega al paso 2.",
      },
    ],
    exercise: {
      prompt:
        "Escribe una función `contar` que reciba un archivo e imprima cuántas líneas tiene. Llámala con el primer argumento del script y luego imprime `total: N` usando lo que devolvió.",
      cases: [
        { args: ["auth.log"], files: CASA, expected: "total: 5\n" },
        { args: ["notas.txt"], files: CASA, expected: "total: 3\n" },
      ],
      hint: 'La función imprime y tú recoges con `total=$(contar "$1")`. Así se devuelve un dato en bash.',
      solution:
        '#!/bin/bash\ncontar() {\n  wc -l < "$1"\n}\n\ntotal=$(contar "$1")\necho "total: $total"\n',
    },
  },
  {
    slug: "bash-herramienta-completa",
    sectionSlug: "bash-herramientas",
    language: "bash",
    title: "De script a herramienta",
    summary: "Opciones con getopts, ayuda, códigos distintos, y por qué eval es un agujero.",
    body: [
      "La diferencia entre un script y una herramienta es que la herramienta se explica sola, acepta opciones y falla de forma que se entienda. Nada de eso es complicado: son tres cosas que se añaden siempre igual.",
      'Las opciones se leen con `getopts`. `while getopts "n:v" opcion; do case $opcion in n) nombre=$OPTARG ;; v) detalle=1 ;; esac; done` acepta `-n algo` y `-v`. Un `:` detrás de una letra dice que esa opción lleva valor, y ese valor llega en `OPTARG`.',
      "La ayuda se imprime cómoda con un bloque de texto: `cat <<FIN`, las líneas que quieras, y `FIN` en una línea suya para cerrar. Si la etiqueta va entre comillas, `<<'FIN'`, lo de dentro no se expande, que es lo que quieres cuando la ayuda enseña ejemplos con `$`.",
      "Usa códigos de salida distintos para fallos distintos: 1 para uso incorrecto, 2 para un archivo que falta, 3 para algo fuera de alcance. Quien llame a tu herramienta podrá reaccionar a cada caso, y ese es el punto.",
      'Y una advertencia que es de seguridad y no de estilo. `eval "$variable"` ejecuta lo que haya dentro de esa variable. Si el contenido vino de un archivo, de un argumento o de otra herramienta, acabas de darle a esa fuente permiso para ejecutar lo que quiera en tu equipo.',
      "Lo mismo, más discreto, pasa con una variable sin comillas en medio de un comando. La regla es la misma de siempre: no metas datos donde se esperan comandos, y entrecomilla.",
    ],
    examples: [
      {
        script:
          'nombre=""\ndetalle=0\n\nwhile getopts "n:v" opcion; do\n  case "$opcion" in\n    n) nombre="$OPTARG" ;;\n    v) detalle=1 ;;\n  esac\ndone\n\necho "nombre: ${nombre:-(ninguno)}"\necho "detalle: $detalle"\n',
        args: ["-n", "web01", "-v"],
        note: "Cambia los argumentos de arriba: quita el `-v`, o el `-n web01`, y mira cómo responde.",
      },
      {
        script:
          "ayuda() {\n  cat <<'FIN'\nUso: revisar.sh [-v] CARPETA\n  -v   enseña cada archivo que mira\n  --help  esta ayuda\nFIN\n}\n\nayuda\n",
        note: "Con la etiqueta entre comillas, un `$` de dentro saldría tal cual. Prueba a quitarle las comillas a `'FIN'` y a meter un `$HOME` en el texto.",
      },
      {
        script:
          'entrada="notas.txt; echo ESTO-NO-DEBERIA-CORRER"\n\necho "--- con eval, el texto se ejecuta:"\neval "cat $entrada" 2>/dev/null\n\necho "--- entrecomillado, es solo un nombre de archivo:"\ncat "$entrada" 2>/dev/null || echo "no existe ningun archivo con ese nombre, que es lo correcto"\n',
        files: CASA,
        note: "Lo de arriba imprimió un texto que nadie pidió, porque `eval` trató el dato como comando. Ese es el agujero, y aquí lo ves en cuatro líneas.",
      },
    ],
    exercise: {
      prompt:
        "Escribe una herramienta que acepte `-f ARCHIVO`. Si le pasan el archivo y existe, imprime `lineas: N`. Si no le pasan `-f`, imprime `Uso: contar.sh -f ARCHIVO` y sale con 1. Si el archivo no existe, imprime `no existe: NOMBRE` y sale con 2.",
      cases: [
        { args: ["-f", "auth.log"], files: CASA, expected: "lineas: 5\n", expectedExit: 0 },
        { args: [], expected: "Uso: contar.sh -f ARCHIVO\n", expectedExit: 1 },
        {
          args: ["-f", "fantasma.txt"],
          files: CASA,
          expected: "no existe: fantasma.txt\n",
          expectedExit: 2,
        },
      ],
      hint: 'Lee la opción con `getopts "f:"`, guarda `$OPTARG`, y después comprueba primero si está vacía y luego si el archivo existe.',
      solution:
        '#!/bin/bash\narchivo=""\n\nwhile getopts "f:" opcion; do\n  case "$opcion" in\n    f) archivo="$OPTARG" ;;\n  esac\ndone\n\nif [ -z "$archivo" ]; then\n  echo "Uso: contar.sh -f ARCHIVO"\n  exit 1\nfi\n\nif [ ! -f "$archivo" ]; then\n  echo "no existe: $archivo"\n  exit 2\nfi\n\necho "lineas: $(wc -l < "$archivo")"\n',
    },
  },
  {
    slug: "bash-encadenar",
    sectionSlug: "bash-herramientas",
    language: "bash",
    title: "Encadenar herramientas",
    summary: "JSON con jq, trabajo repetido con xargs, y huellas para comparar.",
    body: [
      "Hasta aquí las herramientas escupían texto en columnas. Las modernas escupen JSON, y eso con `cut` no se mastica: un campo puede tener comas dentro, el orden puede cambiar, y un valor puede faltar.",
      "Para JSON está `jq`. `jq '.campo'` saca un campo, `jq '.lista[]'` recorre una lista y suelta un resultado por elemento, y `jq 'select(.status == 200)'` se queda solo con los que cumplen. Se encadenan con `|`, igual que en el shell.",
      "La opción `-r` es la que hace que `jq` sirva dentro de un script: imprime los textos sin comillas, listos para pasárselos a otro comando. Sin `-r`, cada línea te llega entre comillas y hay que quitárselas a mano.",
      "`xargs` es para cuando tienes una lista y quieres hacer algo con cada elemento. `cat objetivos.txt | xargs -n1 echo revisando` llama al comando una vez por elemento, y con `-I{}` decides dónde va cada uno: `xargs -I{} echo 'mirando {}'`.",
      "Y para comparar estados están las huellas. `sha256sum archivo` da una cadena que cambia si el archivo cambia, aunque cambie un solo byte. Guardar hoy las huellas de una carpeta y compararlas mañana es la forma más simple de saber qué se tocó.",
    ],
    examples: [
      {
        script:
          "echo '{\"host\":\"10.10.10.5\",\"puertos\":[22,80],\"activo\":true}' > equipo.json\njq '.host' equipo.json\njq -r '.host' equipo.json\njq -r '.puertos[]' equipo.json\n",
        files: { "/home/analista/": {} },
        note: "La primera sale entre comillas y la segunda no. Esa es toda la diferencia de `-r`, y es la que importa al encadenar.",
      },
      {
        script:
          "printf 'web01\\ndb01\\n' > equipos.txt\ncat equipos.txt | xargs -n1 echo revisando\necho ---\ncat equipos.txt | xargs -I{} echo 'informe-{}.txt'\n",
        files: { "/home/analista/": {} },
        note: "Con `-n1` el comando corre una vez por elemento. Con `-I{}` además decides en qué parte del comando se mete.",
      },
      {
        script: "sha256sum notas.txt\necho 'una linea mas' >> notas.txt\nsha256sum notas.txt\n",
        files: CASA,
        note: "La misma orden antes y después de tocar el archivo. La huella no se parece en nada, que es justo lo que la hace útil.",
      },
    ],
    exercise: {
      prompt:
        "En `hallazgos.json` hay una lista bajo la clave `results`. Imprime la `url` de los que tengan `status` igual a 200, una por línea y sin comillas.",
      cases: [
        {
          files: {
            "/home/analista/hallazgos.json":
              '{"results":[{"url":"/admin","status":301},{"url":"/api","status":200},{"url":"/login","status":200}]}\n',
          },
          expected: "/api\n/login\n",
        },
        {
          files: {
            "/home/analista/hallazgos.json": '{"results":[{"url":"/solo","status":404}]}\n',
          },
          expected: "",
        },
      ],
      hint: "`jq -r '.results[] | select(.status == 200) | .url' hallazgos.json`. Léelo de izquierda a derecha: recorre, filtra, saca el campo.",
      solution: "#!/bin/bash\njq -r '.results[] | select(.status == 200) | .url' hallazgos.json\n",
    },
  },

  // =================================================== 6. Automatizar un pentest
  {
    slug: "bash-alcance-y-registro",
    sectionSlug: "bash-pentest",
    language: "bash",
    title: "El alcance y el registro",
    summary: "Lo primero que se escribe en cualquier herramienta que vaya a tocar algo.",
    body: [
      "Antes de automatizar nada conviene tener clara una cosa: en un trabajo de verdad, lo que puedes tocar está acordado por escrito antes de empezar, y se llama el alcance. Todo lo que no esté ahí dentro no se toca, aunque responda y aunque sea tentador.",
      "Eso no es un consejo, es algo que se programa. Un archivo `scope.txt` con un objetivo por línea, y una función que comprueba si algo está dentro antes de dejar pasar. Se escribe una vez y se reutiliza en cada herramienta que hagas.",
      'La comprobación más simple es `grep -qx "$objetivo" scope.txt`: el `-x` exige que la línea entera coincida, así que `10.10.10.5` no casa con `10.10.10.50`. El `-q` hace que no imprima nada y solo devuelva el código, que es lo que necesita un `if`.',
      "La otra mitad es dejar constancia. Un registro con qué se corrió, contra qué y cuándo te sirve para reconstruir lo que hiciste, y es lo que te piden cuando algo se cae y hay que demostrar que no fuiste tú. Se hace con un `echo` a un archivo y `date` para la marca de tiempo.",
      "Las herramientas de esta plataforma se comportan así: si hay un `scope.txt`, comprueban antes de responder y se niegan si el objetivo no está. No es una simulación del sermón, es el comportamiento.",
    ],
    examples: [
      {
        script:
          'printf \'10.10.10.5\\n10.10.10.12\\n\' > scope.txt\n\nen_alcance() {\n  grep -qx "$1" scope.txt\n}\n\nfor objetivo in 10.10.10.5 203.0.113.9 10.10.10.12; do\n  if en_alcance "$objetivo"; then\n    echo "OK    $objetivo"\n  else\n    echo "FUERA $objetivo"\n  fi\ndone\n',
        files: { "/home/analista/": {} },
        note: "Quita una línea de `scope.txt` y vuelve a ejecutar: el objetivo pasa de OK a FUERA sin tocar el resto del script.",
      },
      {
        script:
          'printf \'10.10.10.5\\n\' > scope.txt\nnmap 10.10.10.5 > /dev/null 2>&1\necho "dentro del alcance: $?"\nnmap 10.10.10.40 > /dev/null 2>&1\necho "fuera del alcance: $?"\n',
        files: { "/home/analista/": {} },
        note: "El segundo devuelve 2 y no escanea nada. La herramienta simulada respeta el alcance igual que se espera de una de verdad.",
      },
      {
        script:
          'registrar() {\n  echo "$(date +%H:%M:%S) $*" >> registro.txt\n}\n\nregistrar "inicio del reconocimiento"\nregistrar "barrido de 10.10.10.0/24"\ncat registro.txt\n',
        files: { "/home/analista/": {} },
        note: "`$*` son todos los argumentos juntos. Con dos líneas tienes un registro que después puedes adjuntar al informe.",
      },
    ],
    exercise: {
      prompt:
        "En `objetivos.txt` hay una IP por línea y en `scope.txt` las autorizadas. Imprime solo las autorizadas, en el orden en que aparecen en `objetivos.txt`.",
      cases: [
        {
          files: {
            "/home/analista/objetivos.txt": "10.10.10.5\n203.0.113.9\n10.10.10.12\n",
            "/home/analista/scope.txt": "10.10.10.5\n10.10.10.12\n",
          },
          expected: "10.10.10.5\n10.10.10.12\n",
        },
        {
          files: {
            "/home/analista/objetivos.txt": "198.51.100.4\n",
            "/home/analista/scope.txt": "10.10.10.5\n",
          },
          expected: "",
        },
      ],
      hint: 'Un `while read -r objetivo` sobre `objetivos.txt`, y dentro un `if grep -qx "$objetivo" scope.txt`.',
      solution:
        '#!/bin/bash\nwhile read -r objetivo; do\n  if grep -qx "$objetivo" scope.txt; then\n    echo "$objetivo"\n  fi\ndone < objetivos.txt\n',
    },
  },
  {
    slug: "bash-parsear-herramientas",
    sectionSlug: "bash-pentest",
    language: "bash",
    title: "Normalizar lo que escupe cada herramienta",
    summary: "De tres formatos distintos a una sola lista con la que trabajar.",
    body: [
      "Cada herramienta escribe a su manera: `nmap` en columnas, `ffuf` en JSON, `subfinder` una línea por nombre. Si intentas trabajar con los tres formatos a la vez, el script se vuelve imposible de leer.",
      "Lo que se hace es normalizar: convertir todo a un formato propio y sencillo lo antes posible, y de ahí en adelante trabajar solo con ese. Para reconocimiento, `IP:PUERTO` una por línea funciona bien.",
      "De `nmap` en formato grepable, con `-oG`, las líneas que interesan llevan `Ports:` y los puertos van separados por comas. Se saca la IP y se recorren los puertos, y eso es un `awk` de unas pocas líneas.",
      "De `ffuf` sale JSON y lo masticas con `jq`, como en la lección anterior. De `subfinder` sale texto pelado y no hay nada que hacerle.",
      "Una vez todo está en el mismo formato, juntarlo es `sort -u`, comparar dos barridos es `comm`, y contar es `wc -l`. Toda la dificultad estaba en el primer paso.",
    ],
    examples: [
      {
        script:
          "cat barrido.txt\necho '--- solo las IP:'\nawk '/Ports:/ {print $2}' barrido.txt | sort\n",
        files: { "/home/analista/barrido.txt": NMAP_GUARDADO },
        note: "El campo 2 es la IP porque la línea empieza por `Host: `. Mira el archivo de arriba para contar los campos tú mismo.",
      },
      {
        script:
          'awk -F\'\\t\' \'/Ports:/ {\n  ip = $1\n  sub(/^Host: /, "", ip)\n  sub(/ .*/, "", ip)\n  puertos = $2\n  sub(/^Ports: /, "", puertos)\n  n = split(puertos, lista, ", ")\n  for (i = 1; i <= n; i++) {\n    split(lista[i], campos, "/")\n    print ip ":" campos[1]\n  }\n}\' barrido.txt | sort\n',
        files: { "/home/analista/barrido.txt": NMAP_GUARDADO },
        note: "`-F'\\t'` parte por tabulador, que es lo que separa la IP de los puertos. `sub` recorta y `split` parte en pedazos. Es largo pero se escribe una vez y se reutiliza siempre.",
      },
      {
        script: "nmap -oG - 10.10.10.0/24 2>/dev/null | awk '/Ports:/ {print $2}' | sort\n",
        note: "El mismo `awk` funciona igual con la salida de la herramienta que con el archivo guardado, porque el formato es el mismo. Eso es lo que hace que lo que practicas aquí sirva fuera.",
      },
    ],
    exercise: {
      prompt:
        "De `barrido.txt`, que está en formato grepable de nmap, imprime la IP de los host que tengan el puerto 22 abierto, ordenadas.",
      cases: [
        {
          files: { "/home/analista/barrido.txt": NMAP_GUARDADO },
          expected: "10.10.10.12\n10.10.10.5\n",
        },
        {
          files: {
            "/home/analista/barrido.txt":
              "Host: 10.10.10.40 (old.example.test)\tPorts: 21/open/tcp//ftp///\n",
          },
          expected: "",
        },
      ],
      hint: "Filtra las líneas que traigan `22/open` y quédate con el campo 2. Cuidado: el 22 puede ir detrás de `Ports: ` o detrás de una coma.",
      solution: "#!/bin/bash\nawk '/(: |, )22\\/open/ {print $2}' barrido.txt | sort -u\n",
    },
  },
  {
    slug: "bash-orquestar-recon",
    sectionSlug: "bash-pentest",
    language: "bash",
    title: "El flujo completo",
    summary: "Juntar todo: alcance, barrido, normalizado, comparación y reporte.",
    body: [
      "Ya tienes todas las piezas. Esta lección no enseña nada nuevo: las ordena. Un flujo de reconocimiento es siempre el mismo y cabe en cinco pasos.",
      "Primero el alcance: lees `scope.txt` y descartas lo que no esté, guardando por qué lo descartaste. Segundo el barrido, que aquí sale de un archivo guardado. Tercero normalizar todo a `IP:PUERTO`.",
      "Cuarto, comparar con lo de la vez anterior. Un puerto que hoy está abierto y ayer no es lo más interesante que te va a dar un barrido, y se saca con `comm -13 ayer hoy`, que da solo lo que está en el segundo.",
      "Y quinto, el reporte. Un encabezado, los totales, y la lista. `printf` para las columnas y `echo` para los títulos. Que se lea es parte del trabajo: un reporte que hay que descifrar no lo lee nadie.",
      "Del flujo entero, lo único que no se puede correr aquí es el barrido de verdad, porque no hay red. Todo lo demás, que es donde está el trabajo, funciona igual con datos reales.",
    ],
    examples: [
      {
        script:
          'printf \'10.10.10.5\\n10.10.10.12\\n\' > scope.txt\n\nextraer() {\n  awk \'/Ports:/ {print $2}\' "$1" | sort -u\n}\n\nen_alcance() {\n  grep -qx "$1" scope.txt\n}\n\nfor ip in $(extraer barrido.txt); do\n  if en_alcance "$ip"; then\n    echo "revisando $ip"\n  else\n    echo "saltando $ip, fuera de alcance"\n  fi\ndone\n',
        files: { "/home/analista/barrido.txt": NMAP_GUARDADO },
        note: "Dos funciones cortas y un bucle. Cada pieza se entiende sola, que es lo que hace que el flujo se pueda cambiar sin romperlo.",
      },
      {
        script:
          "printf '10.10.10.5:22\\n10.10.10.12:22\\n' > ayer.txt\nprintf '10.10.10.5:22\\n10.10.10.5:80\\n10.10.10.12:22\\n' > hoy.txt\necho 'lo que apareció hoy:'\ncomm -13 ayer.txt hoy.txt\n",
        files: { "/home/analista/": {} },
        note: "`comm` necesita las dos listas ordenadas. `-13` esconde la primera y la tercera columna, así que deja solo lo que está en el segundo archivo.",
      },
      {
        script:
          'servicios=$(awk -F\'\\t\' \'/Ports:/ {\n  ip = $1; sub(/^Host: /, "", ip); sub(/ .*/, "", ip)\n  p = $2; sub(/^Ports: /, "", p)\n  n = split(p, lista, ", ")\n  for (i = 1; i <= n; i++) { split(lista[i], c, "/"); print ip ":" c[1] }\n}\' barrido.txt | sort)\n\necho "# Reconocimiento"\necho "Servicios: $(echo "$servicios" | wc -l)"\necho\nprintf \'%s\\n\' "$servicios"\n',
        files: { "/home/analista/barrido.txt": NMAP_GUARDADO },
        note: "El reporte entero en unas pocas líneas. Cámbiale el formato, añádele la fecha, hazlo tuyo: eso es lo que vas a hacer con el de verdad.",
      },
    ],
    exercise: {
      prompt:
        "Con `barrido.txt` y `scope.txt`, imprime un reporte de dos líneas: `En alcance: N` con cuántos host del barrido están autorizados, y `Fuera: M` con cuántos no.",
      cases: [
        {
          files: {
            "/home/analista/barrido.txt": NMAP_GUARDADO,
            "/home/analista/scope.txt": "10.10.10.5\n10.10.10.12\n",
          },
          expected: "En alcance: 2\nFuera: 1\n",
        },
        {
          files: {
            "/home/analista/barrido.txt": NMAP_GUARDADO,
            "/home/analista/scope.txt": "10.10.10.40\n",
          },
          expected: "En alcance: 1\nFuera: 2\n",
        },
      ],
      hint: "Saca las IP con `awk '/Ports:/ {print $2}' | sort -u`, recórrelas con un `while read`, y lleva dos contadores que vas subiendo con `$((dentro + 1))`.",
      solution:
        '#!/bin/bash\ndentro=0\nfuera=0\n\nfor ip in $(awk \'/Ports:/ {print $2}\' barrido.txt | sort -u); do\n  if grep -qx "$ip" scope.txt; then\n    dentro=$((dentro + 1))\n  else\n    fuera=$((fuera + 1))\n  fi\ndone\n\necho "En alcance: $dentro"\necho "Fuera: $fuera"\n',
    },
  },
];
