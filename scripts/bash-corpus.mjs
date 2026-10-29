/**
 * Los casos con los que se compara el intérprete contra bash de verdad.
 *
 * Convención importante: todo lo que se siembra cuelga de `/home/analista`, que
 * es el directorio de trabajo, y los scripts usan rutas RELATIVAS. Así el mismo
 * caso corre igual en el mundo de mentira y en un directorio temporal de la
 * máquina, donde `/var/log` sería otra cosa.
 *
 * Campos de un caso:
 *   name            cómo se llama en el informe
 *   source          el script
 *   files           qué hay en el disco antes de empezar
 *   stdin, args     lo que recibe
 *   expect          salida esperada a mano, para lo que bash no puede reproducir
 *   interpreterOnly no compares contra bash (permisos en Windows, comandos de mentira)
 *   ignoreStatus    compara la salida pero no el código
 */

const AUTH_LOG =
  [
    "Mar 14 09:58:01 estacion sshd[2011]: Failed password for root from 10.0.0.7 port 51520 ssh2",
    "Mar 14 09:58:03 estacion sshd[2012]: Failed password for admin from 10.0.0.7 port 51522 ssh2",
    "Mar 14 09:58:09 estacion sshd[2013]: Accepted password for analista from 10.0.0.15 port 51530 ssh2",
    "Mar 14 09:59:11 estacion sshd[2020]: Failed password for root from 10.0.0.99 port 51540 ssh2",
    "Mar 14 09:59:12 estacion sshd[2021]: Failed password for root from 10.0.0.7 port 51541 ssh2",
    "Mar 14 10:00:00 estacion sudo: analista : TTY=pts/0 ; PWD=/home/analista ; COMMAND=/bin/ls",
  ].join("\n") + "\n";

const PASSWD =
  [
    "root:x:0:0:root:/root:/bin/bash",
    "daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin",
    "analista:x:1000:1000:Analista:/home/analista:/bin/bash",
    "respaldo:x:1001:1001:Respaldo:/opt/respaldo:/bin/sh",
  ].join("\n") + "\n";

const HOME = {
  "/home/analista/auth.log": AUTH_LOG,
  "/home/analista/passwd": PASSWD,
  "/home/analista/notas.txt": "uno\ndos\ntres\ncuatro\ncinco\n",
  "/home/analista/repetidas.txt": "b\nb\na\nc\nc\nc\n",
  "/home/analista/vacio.txt": "",
  "/home/analista/datos/": {},
  "/home/analista/datos/uno.conf": "puerto=22\n",
  "/home/analista/datos/dos.conf": "puerto=80\n",
  "/home/analista/datos/tres.log": "nada\n",
};

export const CORPUS = [
  // ------------------------------------------------------------- lo básico
  {
    name: "echo simple",
    source: "echo hola mundo\n",
  },
  {
    name: "echo -n no salta de línea",
    source: 'echo -n "sin salto"\necho "|"\n',
  },
  {
    name: "variables y comillas dobles",
    source: 'nombre="DeLuna"\necho "hola $nombre"\necho \'hola $nombre\'\n',
  },
  {
    name: "una variable sin comillas se parte en palabras",
    source: 'lista="uno dos tres"\nfor x in $lista; do echo "[$x]"; done\n',
  },
  {
    name: "una variable con comillas no se parte",
    source: 'lista="uno dos tres"\nfor x in "$lista"; do echo "[$x]"; done\n',
  },
  {
    name: "sustitución de comando",
    source: 'echo "hay $(wc -l < notas.txt) líneas"\n',
    files: HOME,
  },
  {
    name: "aritmética",
    source: "echo $((2 + 3 * 4))\necho $((7 / 2))\ni=5\necho $((i++)) $i\n",
  },
  {
    name: "argumentos del script",
    source:
      'echo "$0 tiene $# argumentos"\necho "primero: $1"\nfor a in "$@"; do echo "- $a"; done\n',
    args: ["uno", "dos tres"],
    // `$0` es el nombre del script, y el bash de la comparación se llama a sí
    // mismo "bash" porque lee por la entrada estándar. Se compara a mano.
    expect: "script.sh tiene 2 argumentos\nprimero: uno\n- uno\n- dos tres\n",
    interpreterOnly: true,
  },
  {
    name: "código de salida",
    source: "true; echo $?\nfalse; echo $?\n",
  },

  // ------------------------------------------------------- ${} y sus mañas
  {
    name: "valor de respaldo",
    source:
      'echo "${vacia:-por defecto}"\nvacia=""\necho "${vacia:-por defecto}"\necho "${vacia-por defecto}"\n',
  },
  {
    name: "recorte de sufijo y prefijo",
    source:
      'archivo="/var/log/auth.log"\necho "${archivo##*/}"\necho "${archivo%.log}"\necho "${archivo%/*}"\n',
  },
  {
    name: "reemplazo",
    source: 'linea="a,b,c"\necho "${linea/,/ }"\necho "${linea//,/ }"\n',
  },
  {
    name: "longitud y subcadena",
    source: 'texto="expresiones"\necho "${#texto}"\necho "${texto:0:5}"\necho "${texto: -5}"\n',
  },

  // ------------------------------------------------------------- tuberías
  {
    name: "tubería de tres",
    source: "cat auth.log | grep Failed | wc -l\n",
    files: HOME,
  },
  {
    name: "el clásico top de IPs",
    source:
      "grep 'Failed password' auth.log | grep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' | sort | uniq -c | sort -rn\n",
    files: HOME,
  },
  {
    name: "cut por delimitador",
    source: "cut -d: -f1 passwd\n",
    files: HOME,
  },
  {
    name: "cut varios campos",
    source: "cut -d: -f1,3 passwd | head -3\n",
    files: HOME,
  },
  {
    name: "sort numérico y reverso",
    source: "printf '10\\n9\\n100\\n2\\n' | sort -n\nprintf '10\\n9\\n100\\n2\\n' | sort -rn\n",
  },
  {
    name: "uniq -c con su ancho de siete",
    source: "sort repetidas.txt | uniq -c\n",
    files: HOME,
  },
  {
    name: "uniq solo junta lo pegado",
    source: "uniq -c repetidas.txt\n",
    files: HOME,
  },
  {
    name: "wc de un archivo",
    source: "wc notas.txt\nwc -l notas.txt\n",
    files: HOME,
  },
  {
    name: "wc por tubería alinea distinto",
    source: "cat notas.txt | wc\ncat notas.txt | wc -l\n",
    files: HOME,
  },
  {
    name: "head y tail",
    source: "head -2 notas.txt\ntail -2 notas.txt\ntail -n +4 notas.txt\n",
    files: HOME,
  },
  {
    name: "tr traduce y borra",
    source: "echo 'Hola Mundo' | tr 'a-z' 'A-Z'\necho 'a1b2c3' | tr -d '0-9'\n",
  },
  {
    name: "tee escribe y deja pasar",
    source: "printf 'a\\nb\\n' | tee copia.txt | wc -l\ncat copia.txt\n",
    files: HOME,
  },

  // ---------------------------------------------------------------- grep
  {
    name: "grep BRE contra ERE",
    source:
      "printf 'a+\\naa\\n' > t.txt\ngrep 'a+' t.txt\necho ---\ngrep 'a\\+' t.txt\necho ---\ngrep -E 'a+' t.txt\n",
    files: HOME,
  },
  {
    name: "grep con clases de POSIX",
    source: "grep -c '[[:digit:]]\\{4\\}' auth.log\n",
    files: HOME,
  },
  {
    name: "grep -v y -i",
    source: "grep -v Failed auth.log | wc -l\ngrep -ci failed auth.log\n",
    files: HOME,
  },
  {
    name: "grep -n numera",
    source: "grep -n Accepted auth.log\n",
    files: HOME,
  },
  {
    name: "grep -o saca solo lo que casa",
    source: "grep -oE 'port [0-9]+' auth.log | head -3\n",
    files: HOME,
  },
  {
    name: "grep -l con varios archivos",
    source: "grep -l puerto datos/*.conf\n",
    files: HOME,
  },
  {
    name: "grep sin resultados devuelve 1",
    source: "grep 'no-esta-aqui' auth.log\necho \"salida: $?\"\n",
    files: HOME,
  },
  {
    name: "grep -q para decidir",
    source: 'if grep -q Accepted auth.log; then echo "hubo un acceso"; else echo "nada"; fi\n',
    files: HOME,
  },

  // --------------------------------------------------------- redirecciones
  {
    name: "escribir y añadir",
    source: "echo primera > salida.txt\necho segunda >> salida.txt\ncat salida.txt\n",
    files: HOME,
  },
  {
    name: "redirigir la entrada",
    source: "wc -l < notas.txt\n",
    files: HOME,
  },
  {
    name: "mandar los errores a otro lado",
    source: 'cat noexiste.txt 2> errores.txt\necho "salida: $?"\ncat errores.txt\n',
    files: HOME,
    // El texto del error lleva el nombre del shell delante y no coincide.
    interpreterOnly: true,
    expect: "salida: 1\ncat: noexiste.txt: No such file or directory\n",
  },
  {
    name: "el orden de 2>&1 importa",
    source: "{ echo salida; echo error >&2; } > todo.txt 2>&1\ncat todo.txt\n",
    files: HOME,
  },
  {
    name: "bloque de texto",
    source: "cat <<FIN\nhola\nmundo\nFIN\n",
  },
  {
    name: "bloque de texto sin expandir",
    source: "nombre=DeLuna\ncat <<'FIN'\nhola $nombre\nFIN\n",
  },
  {
    name: "bloque de texto expandido",
    source: "nombre=DeLuna\ncat <<FIN\nhola $nombre\nFIN\n",
  },
  {
    name: "cadena por la entrada",
    source: "wc -w <<< 'una dos tres'\n",
  },

  // ------------------------------------------------------ control de flujo
  {
    name: "if con test de archivo",
    source:
      'if [ -f notas.txt ]; then echo "existe"; fi\nif [ -f nada.txt ]; then echo "existe"; else echo "no existe"; fi\n',
    files: HOME,
  },
  {
    name: "if con corchetes dobles",
    source:
      'texto="ERROR: algo"\nif [[ $texto == ERROR* ]]; then echo "es un error"; fi\nif [[ $texto =~ ^[A-Z]+ ]]; then echo "empieza en mayúsculas"; fi\n',
  },
  {
    name: "comparaciones numéricas",
    source:
      'n=5\nif [ "$n" -gt 3 ]; then echo "mayor"; fi\nif (( n * 2 == 10 )); then echo "el doble es diez"; fi\n',
  },
  {
    name: "bucle for sobre una lista",
    source: 'for puerto in 22 80 443; do echo "puerto $puerto"; done\n',
  },
  {
    name: "bucle for con glob",
    source: 'for archivo in datos/*.conf; do echo "$archivo"; done\n',
    files: HOME,
  },
  {
    name: "bucle while leyendo líneas",
    source: 'while read -r linea; do echo "[$linea]"; done < notas.txt\n',
    files: HOME,
  },
  {
    name: "while read con IFS",
    source:
      'while IFS=: read -r usuario _ uid _; do echo "$usuario tiene uid $uid"; done < passwd\n',
    files: HOME,
  },
  {
    name: "for aritmético",
    source: 'for ((i = 1; i <= 3; i++)); do echo "vuelta $i"; done\n',
  },
  {
    name: "break y continue",
    source:
      "for i in 1 2 3 4 5; do\n  if [ $i -eq 2 ]; then continue; fi\n  if [ $i -eq 4 ]; then break; fi\n  echo $i\ndone\n",
  },
  {
    name: "case con patrones",
    source:
      'for archivo in informe.log datos.conf otro.txt; do\n  case "$archivo" in\n    *.log) echo "registro: $archivo" ;;\n    *.conf) echo "configuración: $archivo" ;;\n    *) echo "otro: $archivo" ;;\n  esac\ndone\n',
  },
  {
    name: "cadena de y griega y o",
    source:
      'mkdir -p nueva && echo "creada"\nfalse || echo "el respaldo corrió"\ntrue && false || echo "encadenado"\n',
    files: HOME,
  },

  // ------------------------------------------------------------- funciones
  {
    name: "función con argumentos",
    source: 'saludar() {\n  echo "hola, $1"\n}\nsaludar DeLuna\nsaludar "Ana Luisa"\n',
  },
  {
    name: "función con código de salida",
    source:
      'es_par() {\n  (( $1 % 2 == 0 ))\n}\nif es_par 4; then echo "cuatro es par"; fi\nif ! es_par 5; then echo "cinco no"; fi\n',
  },
  {
    name: "variables locales",
    source:
      'x="de fuera"\ncambiar() {\n  local x="de dentro"\n  echo "$x"\n}\ncambiar\necho "$x"\n',
  },
  {
    name: "función que imprime y se captura",
    source: 'contar() {\n  wc -l < "$1"\n}\ntotal=$(contar notas.txt)\necho "total: $total"\n',
    files: HOME,
  },

  // --------------------------------------------------------------- arreglos
  {
    name: "arreglo y sus elementos",
    source:
      'puertos=(22 80 443)\necho "${puertos[0]}"\necho "${#puertos[@]}"\nfor p in "${puertos[@]}"; do echo "- $p"; done\n',
  },

  // ---------------------------------------------------------- set y errores
  {
    name: "set -e corta al fallar",
    source: 'set -e\necho "antes"\nfalse\necho "después"\n',
    ignoreStatus: true,
  },
  {
    name: "set -e no corta dentro de una condición",
    source:
      'set -e\nif false; then echo "no"; fi\nfalse || echo "el o griego salva"\necho "sigue vivo"\n',
  },
  {
    name: "set -u revienta con variable sin definir",
    source: 'set -u\necho "antes"\necho "$noexiste"\necho "después"\n',
    ignoreStatus: true,
    interpreterOnly: true,
    expect: "antes\n",
  },
  {
    name: "pipefail cambia el código de la tubería",
    source:
      'false | true\necho "sin pipefail: $?"\nset -o pipefail\nfalse | true\necho "con pipefail: $?"\n',
  },

  // ------------------------------------------------------ archivos y modos
  {
    name: "crear, copiar, mover y borrar",
    source:
      "mkdir -p trabajo\necho contenido > trabajo/a.txt\ncp trabajo/a.txt trabajo/b.txt\nmv trabajo/b.txt trabajo/c.txt\nls trabajo\nrm trabajo/c.txt\nls trabajo\n",
    files: HOME,
  },
  {
    name: "basename y dirname",
    source:
      "basename /var/log/auth.log\nbasename /var/log/auth.log .log\ndirname /var/log/auth.log\n",
  },
  {
    name: "ls -l enseña el modo",
    source: "chmod 4755 marcado.sh\nls -l marcado.sh | cut -d' ' -f1\n",
    files: { ...HOME, "/home/analista/marcado.sh": { content: "#!/bin/bash\n", mode: 0o644 } },
    // En Windows no hay modos de verdad, así que esto no se puede comparar.
    interpreterOnly: true,
    expect: "-rwsr-xr-x\n",
  },
  {
    name: "stat con formato",
    source: "chmod 600 secreto.txt\nstat -c '%a %n' secreto.txt\n",
    files: { ...HOME, "/home/analista/secreto.txt": "clave\n" },
    interpreterOnly: true,
    expect: "600 secreto.txt\n",
  },
  {
    name: "un script sin permiso de ejecución no corre",
    source:
      "printf '#!/bin/bash\\necho corriendo\\n' > tarea.sh\n./tarea.sh\necho \"salida: $?\"\nchmod +x tarea.sh\n./tarea.sh\n",
    files: HOME,
    interpreterOnly: true,
    expect: "salida: 126\ncorriendo\n",
  },

  // ------------------------------------------------------------ el conjunto
  {
    name: "un mini informe completo",
    source:
      [
        "#!/bin/bash",
        "total=$(grep -c 'Failed password' auth.log)",
        'echo "Intentos fallidos: $total"',
        'echo "Top de origen:"',
        "grep 'Failed password' auth.log \\",
        "  | grep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' \\",
        "  | sort | uniq -c | sort -rn | head -2 \\",
        "  | while read -r veces ip; do",
        '      printf "  %-12s %s\\n" "$ip" "$veces"',
        "    done",
      ].join("\n") + "\n",
    files: HOME,
  },
];
