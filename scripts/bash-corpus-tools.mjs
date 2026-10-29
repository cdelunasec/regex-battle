/**
 * La segunda tanda de casos: las herramientas de la fase dos.
 *
 * Va aparte de `bash-corpus.mjs` para que cada archivo se pueda leer de una
 * sentada. Las reglas son las mismas: todo cuelga de `/home/analista` y los
 * scripts usan rutas relativas.
 *
 * Los de `jq` y los de red van marcados `interpreterOnly` por motivos
 * distintos: `jq` no está instalado en esta máquina, y las de red no existen
 * en ningún bash porque su salida es guardada.
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
  "/home/analista/datos/": {},
  "/home/analista/datos/uno.conf": "puerto=22\n",
  "/home/analista/datos/dos.conf": "puerto=80\n",
  "/home/analista/datos/tres.log": "nada\n",
};

export const TOOL_CORPUS = [
  // ------------------------------------------------------------------- sed
  {
    name: "sed sustituye la primera y todas",
    source: "printf 'a-a-a\\nb-b\\n' | sed 's/-/+/'\nprintf 'a-a-a\\nb-b\\n' | sed 's/-/+/g'\n",
  },
  {
    name: "sed con direcciones",
    source:
      "sed -n '2p' notas.txt\necho ---\nsed '2d' notas.txt\necho ---\nsed -n '$p' notas.txt\necho ---\nsed '1,3d' notas.txt\n",
    files: HOME,
  },
  {
    name: "sed con dirección por patrón",
    source: "sed -n '/Failed/p' auth.log | wc -l\nsed '/Failed/d' auth.log | wc -l\n",
    files: HOME,
  },
  {
    name: "sed y sus grupos, que en BRE llevan barra",
    source: "echo 'ab' | sed 's/\\(a\\)\\(b\\)/\\2\\1/'\necho 'ab' | sed -E 's/(a)(b)/\\2\\1/'\n",
  },
  {
    name: "sed y el ampersand",
    source: "echo 'hola' | sed 's/o/[&]/g'\n",
  },
  {
    name: "sed recorta lo que sobra de una línea de log",
    source: "sed -n 's/.*from \\([0-9.]*\\) port.*/\\1/p' auth.log | sort -u\n",
    files: HOME,
  },
  {
    name: "sed niega la dirección",
    source: "sed -n '/Failed/!p' auth.log | wc -l\n",
    files: HOME,
  },

  {
    name: "las comillas de dentro de una sustitucion no cierran las de fuera",
    source: [
      'echo "hay $(wc -l < "notas.txt") lineas"',
      'echo "y ahora $(echo "anidado de verdad" | tr a-z A-Z)"',
      "",
    ].join("\n"),
    files: HOME,
  },
  {
    name: "un escape en medio de una palabra no descoloca el resto",
    source: [
      "echo precio\\$100",
      "echo uno\\ dos",
      "if [[ 10.0.0.7 =~ ^[0-9]+\\.[0-9]+ ]]; then echo casa; else echo no; fi",
      "",
    ].join("\n"),
  },

  // ------------------------------------------------------------------- awk
  {
    name: "awk imprime campos",
    source: "awk '{print $1}' notas.txt\necho ---\nawk -F: '{print $1, $3}' passwd\n",
    files: HOME,
  },
  {
    name: "awk filtra por número de línea y por patrón",
    source: "awk 'NR==2' notas.txt\necho ---\nawk '/Accepted/ {print $1, $2, $3}' auth.log\n",
    files: HOME,
  },
  {
    name: "awk suma una columna",
    source: "printf '10\\n20\\n30\\n' | awk '{suma += $1} END {print suma}'\n",
  },
  {
    name: "awk cuenta con un arreglo asociativo",
    source:
      "grep Failed auth.log | awk '{cuenta[$9]++} END {for (u in cuenta) print cuenta[u], u}' | sort -rn\n",
    files: HOME,
  },
  {
    name: "awk con BEGIN y END",
    source: 'awk \'BEGIN {print "inicio"} {print NR": "$0} END {print "total", NR}\' notas.txt\n',
    files: HOME,
  },
  {
    name: "awk formatea en columnas",
    source: "awk -F: '{printf \"%-12s %5d\\n\", $1, $3}' passwd\n",
    files: HOME,
  },
  {
    name: "awk compara como número cuando los dos lados lo son",
    source:
      "awk -F: '$3 > 500 {print $1}' passwd\necho ---\necho '10 9' | awk '{print ($1 > $2) ? \"mayor\" : \"no\"}'\n",
    files: HOME,
  },
  {
    name: "awk y sus funciones de texto",
    source:
      "echo 'hola mundo' | awk '{print toupper($1), length($2), substr($2, 1, 3), index($0, \"mundo\")}'\n",
  },
  {
    name: "awk sustituye dentro de la línea",
    source:
      "echo 'a-b-c' | awk '{gsub(/-/, \"+\"); print}'\necho 'a-b-c' | awk '{sub(/-/, \"+\"); print}'\n",
  },
  {
    name: "awk parte una cadena",
    source: "echo '10.0.0.7' | awk '{n = split($0, o, \".\"); print n, o[1], o[4]}'\n",
  },
  {
    name: "awk concatena sin operador",
    source: "echo 'a b' | awk '{print $1 $2; print $1, $2}'\n",
  },
  {
    name: "awk cambia el separador de salida",
    source: "awk -F: 'BEGIN {OFS=\",\"} {print $1, $3}' passwd | head -2\n",
    files: HOME,
  },
  {
    name: "awk con NF y el último campo",
    source: "printf 'a b c\\nd e\\n' | awk '{print NF, $NF}'\n",
  },
  {
    name: "awk con condicional dentro",
    source:
      "printf '5\\n15\\n25\\n' | awk '{ if ($1 > 10) print $1, \"alto\"; else print $1, \"bajo\" }'\n",
  },
  {
    name: "awk con variable de fuera",
    source: "printf '5\\n15\\n' | awk -v limite=10 '$1 > limite {print $1}'\n",
  },

  // --------------------------------------------------------- find y xargs
  {
    name: "find por nombre",
    source: "find . -name '*.conf' | sort\n",
    files: HOME,
  },
  {
    name: "find por tipo",
    source: "find . -type d | sort\necho ---\nfind . -type f -name '*.log' | sort\n",
    files: HOME,
  },
  {
    name: "find con profundidad",
    source: "find . -maxdepth 1 -type f | sort\n",
    files: HOME,
  },
  {
    name: "find con exec",
    source: "find datos -name '*.conf' -exec cat {} ';' | sort\n",
    files: HOME,
  },
  {
    name: "xargs encadena",
    source: "find datos -name '*.conf' | sort | xargs cat\n",
    files: HOME,
  },
  {
    name: "xargs de a uno",
    source: "printf 'uno\\ndos\\n' | xargs -n1 echo linea:\n",
  },
  {
    name: "xargs con marcador",
    source: "printf 'uno\\ndos\\n' | xargs -I{} echo '[{}]'\n",
  },

  // -------------------------------------------------- huellas y codificación
  {
    name: "sha256sum de un texto",
    source: "printf 'hola' | sha256sum\n",
  },
  {
    name: "md5sum de un texto",
    source: "printf 'hola' | md5sum\n",
  },
  {
    name: "sha256sum de un archivo",
    source: "sha256sum notas.txt\n",
    files: HOME,
  },
  {
    name: "base64 ida y vuelta",
    source: "printf 'Code Battle' | base64\nprintf 'Code Battle' | base64 | base64 -d\necho\n",
  },

  // --------------------------------------------------------- cruzar listas
  {
    name: "comm compara dos listas ordenadas",
    source:
      "printf 'a\\nb\\nc\\n' > uno.txt\nprintf 'b\\nc\\nd\\n' > dos.txt\ncomm uno.txt dos.txt\necho ---\ncomm -12 uno.txt dos.txt\necho ---\ncomm -23 uno.txt dos.txt\n",
    files: HOME,
  },
  {
    name: "paste junta columnas",
    source: "printf 'a\\nb\\n' > col1.txt\nprintf '1\\n2\\n' > col2.txt\npaste col1.txt col2.txt\n",
    files: HOME,
  },
  {
    name: "diff dice qué cambió",
    source:
      "printf 'uno\\ndos\\ntres\\n' > ayer.txt\nprintf 'uno\\nDOS\\ntres\\n' > hoy.txt\ndiff ayer.txt hoy.txt\necho \"salida: $?\"\n",
    files: HOME,
  },
  {
    name: "diff con líneas añadidas y quitadas",
    source: "printf 'a\\nb\\nc\\n' > v1.txt\nprintf 'a\\nc\\nd\\n' > v2.txt\ndiff v1.txt v2.txt\n",
    files: HOME,
  },

  // ------------------------------------------- el conjunto, ya con awk y sed
  {
    name: "informe de fuerza bruta con awk",
    source:
      [
        "#!/bin/bash",
        "set -euo pipefail",
        "",
        "umbral=2",
        'echo "IPs con mas de $umbral intentos fallidos:"',
        "grep 'Failed password' auth.log \\",
        "  | grep -oE '([0-9]{1,3}\\.){3}[0-9]{1,3}' \\",
        "  | sort | uniq -c | sort -rn \\",
        '  | awk -v t="$umbral" \'$1 > t {printf "  %-15s %s intentos\\n", $2, $1}\'',
      ].join("\n") + "\n",
    files: HOME,
  },

  // -------------------------------------------- jq, que no está en la máquina
  {
    name: "jq saca un campo",
    source: 'echo \'{"host":"10.10.10.5","puerto":22}\' | jq -r \'.host\'\n',
    interpreterOnly: true,
    expect: "10.10.10.5\n",
  },
  {
    name: "jq recorre una lista y filtra",
    source:
      'echo \'{"results":[{"url":"/a","status":200},{"url":"/b","status":403}]}\' | jq -r \'.results[] | select(.status == 200) | .url\'\n',
    interpreterOnly: true,
    expect: "/a\n",
  },
  {
    name: "jq cuenta",
    source: "echo '[1,2,3]' | jq 'length'\n",
    interpreterOnly: true,
    expect: "3\n",
  },
  {
    name: "jq imprime compacto",
    source: "echo '{\"a\":1,\"b\":[2,3]}' | jq -c '.'\n",
    interpreterOnly: true,
    expect: '{"a":1,"b":[2,3]}\n',
  },
  {
    name: "jq lee varios documentos pegados",
    source: "printf '{\"id\":1}\\n{\"id\":2}\\n' | jq -r '.id'\n",
    interpreterOnly: true,
    expect: "1\n2\n",
  },

  // ------------------------------------- las de red, que no tocan nada de red
  {
    name: "nmap en formato grepable",
    source: "nmap -oG - 10.10.10.5 2>/dev/null | grep Ports\n",
    interpreterOnly: true,
    expect:
      "Host: 10.10.10.5 (web01.example.test)\tPorts: 22/open/tcp//ssh///, 80/open/tcp//http///, 443/open/tcp//https///\n",
  },
  {
    name: "parsear nmap para sacar los host vivos",
    source: "nmap -oG - 10.10.10.0/24 2>/dev/null | awk '/Ports:/ {print $2}' | sort\n",
    interpreterOnly: true,
    expect: "10.10.10.12\n10.10.10.23\n10.10.10.40\n10.10.10.5\n",
  },
  {
    name: "las de red avisan de que son simulación",
    source: "nmap 10.10.10.5 2>&1 >/dev/null\n",
    interpreterOnly: true,
    expect: "nmap: salida guardada, esta plataforma no tiene red\n",
  },
  {
    name: "sin scope.txt solo existe el laboratorio",
    source: 'nmap 203.0.113.9 >/dev/null 2>&1\necho "salida: $?"\n',
    interpreterOnly: true,
    expect: "salida: 2\n",
  },
  {
    name: "con scope.txt, lo que no está dentro se rechaza",
    source:
      'printf \'10.10.10.5\\n\' > scope.txt\nnmap 10.10.10.5 >/dev/null 2>&1; echo "dentro: $?"\nnmap 10.10.10.40 >/dev/null 2>&1; echo "fuera: $?"\n',
    files: HOME,
    interpreterOnly: true,
    expect: "dentro: 0\nfuera: 2\n",
  },
  {
    name: "scope.txt acepta rangos y comodines",
    source:
      'printf \'10.10.10.0/24\\n*.example.test\\n\' > scope.txt\nnmap 10.10.10.40 >/dev/null 2>&1; echo "rango: $?"\nsubfinder -d example.test >/dev/null 2>&1; echo "dominio: $?"\n',
    files: HOME,
    interpreterOnly: true,
    expect: "rango: 0\ndominio: 0\n",
  },
  {
    name: "ffuf escupe JSON y jq lo mastica",
    source:
      "ffuf -u http://10.10.10.5/FUZZ -w lista.txt 2>/dev/null | jq -r '.results[] | select(.status == 200) | .url'\n",
    interpreterOnly: true,
    expect: "http://10.10.10.5/api\nhttp://10.10.10.5/index.html\nhttp://10.10.10.5/login\n",
  },
  {
    name: "subfinder saca los subdominios",
    source: "subfinder -d example.test 2>/dev/null\n",
    interpreterOnly: true,
    expect:
      "correo.example.test\ndb01.example.test\nfiles.example.test\nold.example.test\nweb01.example.test\n",
  },
  {
    name: "nuclei escupe un hallazgo por línea",
    source:
      "nuclei -u http://10.10.10.5 2>/dev/null | jq -r 'select(.info.severity != \"info\") | .info.name'\n",
    interpreterOnly: true,
    expect: "Versión de SSH antigua\n",
  },
  {
    name: "dig corto",
    source: "dig +short web01.example.test 2>/dev/null\n",
    interpreterOnly: true,
    expect: "10.10.10.5\n",
  },
  {
    name: "gobuster y su formato de columnas",
    source: "gobuster dir -u http://10.10.10.5 -w lista.txt 2>/dev/null | grep 'Status: 200'\n",
    interpreterOnly: true,
    expect:
      "/api                 (Status: 200) [Size: 52]\n/index.html          (Status: 200) [Size: 812]\n/login               (Status: 200) [Size: 1204]\n",
  },
];
