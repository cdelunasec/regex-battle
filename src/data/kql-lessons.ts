/**
 * El temario de KQL, el de la barra de búsqueda de Kibana.
 *
 * Mismo formato que el curso de expresiones regulares, porque las pantallas
 * son las mismas. Lo que cambia es qué corrige el ejercicio: aquí el caso de
 * prueba es un documento de log en JSON y la consulta decide si entra o no.
 *
 * Los ejemplos y los ejercicios se corrigen con el MISMO motor que reparte
 * golpes en el 1v1, y los tests corren cada solución de referencia, así que
 * una lección con un ejercicio imposible rompe el build.
 */
import type { PatternLesson, Section } from "./lesson-types.ts";

/** Un documento de log, tal como llega al caso de prueba. */
const log = (document: Record<string, unknown>): string => JSON.stringify(document);

export const KQL_SECTIONS: Section[] = [
  {
    slug: "kql-lo-basico",
    language: "kql",
    title: "Filtrar un log",
    summary: "Preguntarle a un campo por su valor, aunque venga anidado.",
    practiceSlugs: [
      "kql-nivel-error",
      "kql-servicio-auth",
      "kql-status-404",
      "kql-usuario-admin",
      "kql-ip-origen",
      "kql-tiene-usuario",
    ],
  },
  {
    slug: "kql-combinar",
    language: "kql",
    title: "Combinar condiciones",
    summary: "Pedir varias cosas a la vez, cualquiera de ellas, o lo contrario.",
    practiceSlugs: [
      "kql-error-en-auth",
      "kql-error-o-aviso",
      "kql-todo-menos-info",
      "kql-denegado-en-auth",
      "kql-fuera-las-pruebas",
      "kql-tiene-codigo-de-error",
    ],
  },
  {
    slug: "kql-comodines-y-rangos",
    language: "kql",
    title: "Comodines y rangos",
    summary: "Cuando no sabes el valor exacto, o buscas de un número para arriba.",
    practiceSlugs: [
      "kql-mensaje-password",
      "kql-usuarios-adm",
      "kql-transferencia-grande",
      "kql-desde-una-fecha",
      "kql-error-de-servidor",
      "kql-red-interna",
    ],
  },
  {
    slug: "kql-investigar",
    language: "kql",
    title: "Investigar de verdad",
    summary: "Juntarlo todo en la consulta con la que se caza un incidente.",
    practiceSlugs: [
      "kql-graves-en-auth",
      "kql-fallos-sin-404",
      "kql-caidas-y-saturacion",
      "kql-ssh-autenticado",
      "kql-fuerza-bruta",
      "kql-exfiltracion",
    ],
  },
];

export const KQL_LESSONS: PatternLesson[] = [
  // --------------------------------------------------------- Filtrar un log
  {
    slug: "kql-campo-valor",
    sectionSlug: "kql-lo-basico",
    language: "kql",
    title: "Un campo y su valor",
    summary: "La consulta más corta que existe: `campo:valor`.",
    body: [
      "En KQL no buscas dentro de un texto, filtras eventos. Cada línea de un log es un documento con campos, y la consulta decide si ese evento entra o se queda fuera. La forma más corta es `campo:valor`, por ejemplo `level:error`.",
      "El texto se compara sin distinguir mayúsculas, así que `level:error` también deja pasar un evento con `ERROR`. Y si el campo no está en el documento, ese evento no entra: no hay nada que comparar.",
    ],
    examples: [
      {
        pattern: "level:error",
        sample: log({ level: "error", service: "auth" }),
        note: "El documento tiene `level` con ese valor, así que pasa el filtro.",
      },
      {
        pattern: "level:error",
        sample: log({ level: "info", service: "auth" }),
        expectsNoMatch: true,
        note: "Mismo filtro, otro valor. Este evento se queda fuera.",
      },
      {
        pattern: "service:AUTH",
        sample: log({ service: "auth", status: 200 }),
        note: "Da igual cómo lo escribas, el texto no distingue mayúsculas.",
      },
    ],
    exercise: {
      prompt: "Deja pasar solo los eventos del servicio api.",
      match_mode: "partial",
      must_match: [
        log({ service: "api" }),
        log({ service: "api", level: "info" }),
        log({ service: "API", status: 200 }),
      ],
      must_not_match: [log({ service: "auth" }), log({ service: "cron" }), log({ level: "error" })],
      hint: "Nombre del campo, `:` y el valor que buscas, sin espacios en medio.",
      solution: "service:api",
    },
  },
  {
    slug: "kql-campos-anidados",
    sectionSlug: "kql-lo-basico",
    language: "kql",
    title: "Campos dentro de campos",
    summary: "La ruta con puntos, como `user.name` o `source.ip`.",
    body: [
      "Los logs de verdad vienen anidados: el usuario dentro de `user`, la dirección dentro de `source`. Para llegar ahí se escribe la ruta completa con puntos, como `user.name:admin` o `source.ip:10.0.0.5`.",
      "La ruta tiene que ser la exacta. `name:admin` no encuentra nada cuando el campo vive dentro de `user`, porque para el filtro ese campo se llama `user.name` y no `name`.",
    ],
    examples: [
      {
        pattern: "user.name:admin",
        sample: log({ user: { name: "admin" }, service: "ssh" }),
        note: "La ruta baja hasta el campo anidado y compara ahí.",
      },
      {
        pattern: "name:admin",
        sample: log({ user: { name: "admin" }, service: "ssh" }),
        expectsNoMatch: true,
        note: "Sin la ruta completa no hay campo `name` que valga.",
      },
      {
        pattern: "source.ip:10.0.0.5",
        sample: log({ source: { ip: "10.0.0.5", port: 22 } }),
        note: "Los puntos de la dirección no estorban, solo separan la ruta los primeros.",
      },
    ],
    exercise: {
      prompt: "Deja pasar las conexiones cuyo puerto de destino, dentro de `destination`, sea 22.",
      match_mode: "partial",
      must_match: [
        log({ destination: { port: 22 } }),
        log({ destination: { port: 22, ip: "10.0.0.1" } }),
        log({ destination: { port: 22 }, service: "ssh" }),
      ],
      must_not_match: [
        log({ destination: { port: 80 } }),
        log({ port: 22 }),
        log({ source: { port: 22 } }),
      ],
      hint: "Se nombra el contenedor, un punto, y dentro el campo: `contenedor.campo`.",
      solution: "destination.port:22",
    },
  },
  {
    slug: "kql-existe-el-campo",
    sectionSlug: "kql-lo-basico",
    language: "kql",
    title: "Preguntar si el campo existe",
    summary: "`campo:*` deja pasar cualquier evento que traiga ese campo.",
    body: [
      "A veces no importa el valor sino que el campo esté. `user.name:*` deja pasar todo evento que traiga un usuario, sea quien sea, y deja fuera los que no lo traen. Es la forma de separar lo que está identificado de lo anónimo.",
      "Un campo puede traer una lista en vez de un valor suelto. En ese caso basta con que encaje uno de sus elementos, así que `tags:ssh` deja pasar un evento cuyas etiquetas sean `ssh` y `auth` a la vez.",
    ],
    examples: [
      {
        pattern: "user.name:*",
        sample: log({ user: { name: "juan" }, service: "ssh" }),
        note: "No pregunta qué usuario, solo si hay uno.",
      },
      {
        pattern: "user.name:*",
        sample: log({ service: "cron", level: "info" }),
        expectsNoMatch: true,
        note: "Sin ese campo, el evento se queda fuera.",
      },
      {
        pattern: "tags:ssh",
        sample: log({ tags: ["ssh", "auth"], level: "warning" }),
        note: "Con una lista basta con que encaje uno de los elementos.",
      },
    ],
    exercise: {
      prompt: "Deja pasar los eventos que traigan dirección de origen, sin importar cuál sea.",
      match_mode: "partial",
      must_match: [
        log({ source: { ip: "10.0.0.5" } }),
        log({ source: { ip: "8.8.8.8" }, level: "info" }),
        log({ source: { ip: "192.168.1.1" }, service: "api" }),
      ],
      must_not_match: [
        log({ destination: { ip: "10.0.0.5" } }),
        log({ level: "error" }),
        log({ source: { port: 22 } }),
      ],
      hint: "La ruta del campo y, como valor, el comodín que vale por cualquier cosa.",
      solution: "source.ip:*",
    },
  },

  // --------------------------------------------------- Combinar condiciones
  {
    slug: "kql-y-o",
    sectionSlug: "kql-combinar",
    language: "kql",
    title: "Pedir dos cosas, o cualquiera",
    summary: "`and` aprieta el filtro y `or` lo abre.",
    body: [
      "Dos condiciones se juntan con `and` cuando las dos tienen que cumplirse: `level:error and service:auth` deja pasar solo los errores de ese servicio, no todos los errores.",
      "Con `or` basta con que se cumpla una: `level:error or level:warning` deja pasar las dos clases de evento. Cuando mezclas los dos, `and` se agrupa antes que `or`, igual que la multiplicación antes que la suma.",
    ],
    examples: [
      {
        pattern: "level:error and service:auth",
        sample: log({ level: "error", service: "auth" }),
        note: "Cumple las dos condiciones, así que entra.",
      },
      {
        pattern: "level:error and service:auth",
        sample: log({ level: "error", service: "api" }),
        expectsNoMatch: true,
        note: "Es un error, pero de otro servicio: con `and` no basta con una.",
      },
      {
        pattern: "level:error or level:warning",
        sample: log({ level: "warning", service: "api" }),
        note: "Con `or` alcanza con cumplir una de las dos.",
      },
    ],
    exercise: {
      prompt: "Deja pasar las respuestas con código 401 o 403, y ninguna más.",
      match_mode: "partial",
      must_match: [
        log({ status: 401 }),
        log({ status: 403, url: "/admin" }),
        log({ status: 401, service: "api" }),
      ],
      must_not_match: [log({ status: 200 }), log({ status: 404 }), log({ status: 500 })],
      hint: "Dos condiciones completas unidas por `or`. El campo se repite en las dos.",
      solution: "status:401 or status:403",
    },
  },
  {
    slug: "kql-negar",
    sectionSlug: "kql-combinar",
    language: "kql",
    title: "Quitar lo que estorba",
    summary: "`not` le da la vuelta a una condición.",
    body: [
      "Investigar es casi siempre quitar ruido. `not level:info` deja pasar todo menos lo informativo, y eso incluye los eventos que ni siquiera traen `level`, porque tampoco cumplen la condición negada.",
      "Se combina con lo demás sin ceremonia: `level:error and not service:cron` son los errores de cualquier sitio menos las tareas programadas.",
    ],
    examples: [
      {
        pattern: "not level:info",
        sample: log({ level: "error", service: "db" }),
        note: "No es informativo, así que pasa.",
      },
      {
        pattern: "not level:info",
        sample: log({ level: "info", service: "db" }),
        expectsNoMatch: true,
        note: "Justo lo que la consulta quería fuera.",
      },
      {
        pattern: "level:error and not service:cron",
        sample: log({ level: "error", service: "api" }),
        note: "Error sí, cron no. Las dos partes se cumplen.",
      },
    ],
    exercise: {
      prompt: "Deja pasar cualquier evento que no venga del servicio cron.",
      match_mode: "partial",
      must_match: [
        log({ service: "auth" }),
        log({ service: "api", level: "error" }),
        log({ level: "info", message: "arranque" }),
      ],
      must_not_match: [
        log({ service: "cron" }),
        log({ service: "cron", level: "error" }),
        log({ service: "CRON", message: "tarea" }),
      ],
      hint: "Escribe la condición que quieres fuera y ponle delante la palabra que la niega.",
      solution: "not service:cron",
    },
  },
  {
    slug: "kql-listas-de-valores",
    sectionSlug: "kql-combinar",
    language: "kql",
    title: "Varios valores del mismo campo",
    summary: "`campo:(uno or otro)`, sin repetir el nombre del campo.",
    body: [
      "Cuando las alternativas son del mismo campo, no hace falta repetirlo: `status:(401 or 403)` es lo mismo que escribir las dos condiciones enteras, pero se lee de un vistazo.",
      "Dentro del paréntesis también vale `and`, y ahí tiene sentido con los campos que traen listas: `tags:(ssh and auth)` pide que el evento lleve las dos etiquetas.",
    ],
    examples: [
      {
        pattern: "status:(401 or 403)",
        sample: log({ status: 403, url: "/admin" }),
        note: "Una lista de valores para el mismo campo.",
      },
      {
        pattern: "status:(401 or 403)",
        sample: log({ status: 200, url: "/inicio" }),
        expectsNoMatch: true,
        note: "No es ninguno de los dos, así que fuera.",
      },
      {
        pattern: "tags:(ssh and auth)",
        sample: log({ tags: ["ssh", "auth"] }),
        note: "Con `and` dentro, el evento tiene que traer las dos.",
      },
    ],
    exercise: {
      prompt: "Deja pasar los eventos cuyo nivel sea error o critical, nombrando el campo una vez.",
      match_mode: "partial",
      must_match: [
        log({ level: "error" }),
        log({ level: "critical", service: "db" }),
        log({ level: "CRITICAL", service: "api" }),
      ],
      must_not_match: [log({ level: "info" }), log({ level: "warning" }), log({ service: "db" })],
      hint: "El campo, `:` y entre paréntesis los dos valores separados por `or`.",
      solution: "level:(error or critical)",
    },
  },

  // ---------------------------------------------------- Comodines y rangos
  {
    slug: "kql-comodines",
    sectionSlug: "kql-comodines-y-rangos",
    language: "kql",
    title: "Cuando no sabes el valor exacto",
    summary: "`*` dentro del valor vale por cualquier trozo de texto.",
    body: [
      "Un `*` dentro del valor se rellena con lo que sea: `user.name:adm*` deja pasar a `admin` y a `administrador`, y `url:/api/*` a cualquier ruta que empiece así.",
      "Poniendo uno a cada lado buscas por dentro: `message:*password*` deja pasar cualquier mensaje que mencione esa palabra, esté donde esté. Sin comodines, el valor tiene que coincidir entero.",
    ],
    examples: [
      {
        pattern: "user.name:adm*",
        sample: log({ user: { name: "admin" }, service: "ssh" }),
        note: "Empieza por lo pedido y el resto lo rellena el comodín.",
      },
      {
        pattern: "user.name:adm*",
        sample: log({ user: { name: "juan" }, service: "ssh" }),
        expectsNoMatch: true,
        note: "El comodín rellena el final, pero el principio tiene que calzar.",
      },
      {
        pattern: "message:*denegado*",
        sample: log({ message: "acceso denegado para juan" }),
        note: "Con uno a cada lado se busca dentro del texto.",
      },
    ],
    exercise: {
      prompt: "Deja pasar los eventos cuyo mensaje mencione password en cualquier parte.",
      match_mode: "partial",
      must_match: [
        log({ message: "invalid password" }),
        log({ message: "password reset requested" }),
        log({ message: "PASSWORD expired", level: "warning" }),
      ],
      must_not_match: [
        log({ message: "login correcto" }),
        log({ message: "usuario creado" }),
        log({ level: "error" }),
      ],
      hint: "Un comodín delante y otro detrás de la palabra, todo pegado al campo.",
      solution: "message:*password*",
    },
  },
  {
    slug: "kql-comillas",
    sectionSlug: "kql-comodines-y-rangos",
    language: "kql",
    title: "Valores entre comillas",
    summary: "Las comillas comparan literal y aguantan los espacios.",
    body: [
      'Un valor con espacios necesita comillas: `message:"acceso denegado"` compara el mensaje entero, mientras que sin ellas la consulta se rompe o se lee como otra cosa.',
      'Entre comillas nada tiene poder, ni siquiera el comodín: `message:"*"` busca un mensaje que sea exactamente un `*`. Cuando quieras comparar literal, esa es la forma.',
    ],
    examples: [
      {
        pattern: 'message:"acceso denegado"',
        sample: log({ message: "acceso denegado", service: "auth" }),
        note: "El mensaje entero, espacios incluidos.",
      },
      {
        pattern: 'message:"*"',
        sample: log({ message: "acceso denegado", service: "auth" }),
        expectsNoMatch: true,
        note: "Entre comillas el comodín pierde el poder y se compara tal cual.",
      },
      {
        pattern: "message:*denegado",
        sample: log({ message: "acceso denegado" }),
        note: "Fuera de comillas sí rellena, y aquí encaja el final.",
      },
    ],
    exercise: {
      prompt: "Deja pasar los eventos cuyo mensaje sea exactamente connection refused.",
      match_mode: "partial",
      must_match: [
        log({ message: "connection refused" }),
        log({ message: "Connection Refused" }),
        log({ message: "connection refused", service: "db" }),
      ],
      must_not_match: [
        log({ message: "connection refused by peer" }),
        log({ message: "connection reset" }),
        log({ message: "refused" }),
      ],
      hint: "El valor lleva un espacio, así que va entre comillas y sin comodines.",
      solution: 'message:"connection refused"',
    },
  },
  {
    slug: "kql-rangos",
    sectionSlug: "kql-comodines-y-rangos",
    language: "kql",
    title: "De un número para arriba",
    summary: "`>`, `>=`, `<` y `<=` para números y para fechas.",
    body: [
      "No siempre buscas un valor, muchas veces buscas un umbral: `status>=500` son todos los errores del servidor y `bytes>1000000` las transferencias grandes.",
      'Cuando los dos lados son números se comparan como números. Si no, se comparan como texto, que es justo lo que hace falta para una fecha en formato ISO: `@timestamp>="2026-01-01"` deja pasar todo lo posterior.',
    ],
    examples: [
      {
        pattern: "status>=500",
        sample: log({ status: 503, url: "/api" }),
        note: "El umbral entra, y todo lo que esté por encima también.",
      },
      {
        pattern: "status>=500",
        sample: log({ status: 404, url: "/api" }),
        expectsNoMatch: true,
        note: "Por debajo del umbral no pasa.",
      },
      {
        pattern: 'event.start>="2026-01-01"',
        sample: log({ event: { start: "2026-03-05T10:00:00Z" } }),
        note: "Una fecha ISO se ordena bien comparándola como texto.",
      },
    ],
    exercise: {
      prompt: "Deja pasar las respuestas con error del servidor, de 500 para arriba.",
      match_mode: "partial",
      must_match: [log({ status: 500 }), log({ status: 503 }), log({ status: 599 })],
      must_not_match: [log({ status: 404 }), log({ status: 200 }), log({ status: 499 })],
      hint: "El campo pegado al operador que incluye el propio umbral, y el número.",
      solution: "status>=500",
    },
  },

  // ------------------------------------------------------ Investigar de verdad
  {
    slug: "kql-parentesis",
    sectionSlug: "kql-investigar",
    language: "kql",
    title: "Agrupar con paréntesis",
    summary: "Los paréntesis deciden qué se junta con qué.",
    body: [
      "Como `and` se agrupa antes que `or`, la consulta `level:error or level:critical and service:auth` no dice lo que parece: pide los errores de cualquier sitio, más los críticos de auth.",
      "Los paréntesis lo arreglan: `(level:error or level:critical) and service:auth` deja claro que el servicio se le exige a las dos alternativas. Cuando mezcles los dos operadores, agrupa siempre.",
    ],
    examples: [
      {
        pattern: "(level:error or level:critical) and service:auth",
        sample: log({ level: "critical", service: "auth" }),
        note: "Cumple una de las alternativas y además el servicio.",
      },
      {
        pattern: "(level:error or level:critical) and service:auth",
        sample: log({ level: "critical", service: "api" }),
        expectsNoMatch: true,
        note: "El servicio se le exige también a la segunda alternativa.",
      },
      {
        pattern: "level:error and (status:500 or status:503)",
        sample: log({ level: "error", status: 503 }),
        note: "El grupo va al otro lado y funciona igual.",
      },
    ],
    exercise: {
      prompt:
        "Deja pasar los eventos de auth o de ssh que además tengan `event.outcome` en failure.",
      match_mode: "partial",
      must_match: [
        log({ service: "auth", event: { outcome: "failure" } }),
        log({ service: "ssh", event: { outcome: "failure" } }),
        log({ service: "auth", event: { outcome: "failure" }, user: { name: "root" } }),
      ],
      must_not_match: [
        log({ service: "auth", event: { outcome: "success" } }),
        log({ service: "api", event: { outcome: "failure" } }),
        log({ service: "ssh", event: { outcome: "success" } }),
      ],
      hint: "Los dos servicios van agrupados entre paréntesis, y el resultado se pide aparte.",
      solution: "(service:auth or service:ssh) and event.outcome:failure",
    },
  },
  {
    slug: "kql-termino-suelto",
    sectionSlug: "kql-investigar",
    language: "kql",
    title: "Buscar sin nombrar el campo",
    summary: "Un término suelto se busca en todos los valores del documento.",
    body: [
      "Cuando no sabes en qué campo está lo que buscas, escribe el término solo: `root` deja pasar cualquier evento que tenga ese valor en alguna parte, sea `user.name`, `account` o lo que sea.",
      "Es cómodo para empezar a tirar del hilo, pero trae ruido. En cuanto sepas dónde vive el dato, nombra el campo: la consulta se vuelve más rápida de leer y deja fuera las coincidencias por casualidad.",
    ],
    examples: [
      {
        pattern: "denied",
        sample: log({ action: "denied", service: "auth" }),
        note: "Sin campo, el término se busca en todos los valores.",
      },
      {
        pattern: "denied",
        sample: log({ action: "allowed", service: "auth" }),
        expectsNoMatch: true,
        note: "Ningún valor del documento es ese, así que fuera.",
      },
      {
        pattern: "admin",
        sample: log({ user: { name: "admin" }, service: "ssh" }),
        note: "También mira dentro de los campos anidados.",
      },
    ],
    exercise: {
      prompt: "Deja pasar los eventos que mencionen root en algún campo, sin nombrar ninguno.",
      match_mode: "partial",
      must_match: [
        log({ user: { name: "root" }, service: "ssh" }),
        log({ account: "root" }),
        log({ process: { user: "root" }, level: "warning" }),
      ],
      must_not_match: [
        log({ user: { name: "juan" } }),
        log({ account: "admin" }),
        log({ message: "login correcto" }),
      ],
      hint: "Es la consulta más corta del curso: el valor y nada más.",
      solution: "root",
    },
  },
  {
    slug: "kql-consulta-de-caza",
    sectionSlug: "kql-investigar",
    language: "kql",
    title: "La consulta con la que se caza",
    summary: "Juntar campo, negación y comodín en un solo filtro útil.",
    body: [
      "Una consulta de investigación suele tener tres partes: dónde miras, qué pasó y qué ruido quitas. Por ejemplo `service:ssh and event.outcome:failure and not user.name:test*` son los fallos de acceso reales, sin las cuentas de prueba.",
      "Se construye por trozos. Empieza por lo ancho, mira cuántos eventos quedan, y ve apretando con `and` y con `not` hasta que lo que veas sea lo que estabas buscando.",
    ],
    examples: [
      {
        pattern: "service:ssh and event.outcome:failure and not user.name:test*",
        sample: log({ service: "ssh", event: { outcome: "failure" }, user: { name: "root" } }),
        note: "Fallo real contra ssh, y el usuario no es de pruebas.",
      },
      {
        pattern: "service:ssh and event.outcome:failure and not user.name:test*",
        sample: log({ service: "ssh", event: { outcome: "failure" }, user: { name: "testbot" } }),
        expectsNoMatch: true,
        note: "El mismo fallo, pero de una cuenta de prueba: se descarta.",
      },
      {
        pattern: "status>=400 and not status:404",
        sample: log({ status: 500, url: "/api" }),
        note: "Todos los fallos menos la página que no existe.",
      },
    ],
    exercise: {
      prompt:
        "Deja pasar los fallos de acceso contra ssh cuyo usuario no empiece por test. El resultado está en `event.outcome`.",
      match_mode: "partial",
      must_match: [
        log({ service: "ssh", event: { outcome: "failure" }, user: { name: "root" } }),
        log({ service: "ssh", event: { outcome: "failure" }, user: { name: "admin" } }),
        log({ service: "ssh", event: { outcome: "failure" }, user: { name: "juan" } }),
      ],
      must_not_match: [
        log({ service: "ssh", event: { outcome: "failure" }, user: { name: "testbot" } }),
        log({ service: "ssh", event: { outcome: "success" }, user: { name: "root" } }),
        log({ service: "api", event: { outcome: "failure" }, user: { name: "root" } }),
      ],
      hint: "Tres condiciones unidas: el servicio, el resultado, y la negación con comodín.",
      solution: "service:ssh and event.outcome:failure and not user.name:test*",
    },
  },
];
