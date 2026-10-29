/**
 * El temario del modo aprendizaje.
 *
 * Vive en el repo y no en la base a propósito. Los retos son filas uniformes y
 * ahí la base gana, pero una lección es prosa con ejemplos, y para eso el
 * control de versiones es mejor sitio: se revisa en un diff, se corrige una
 * tilde sin escribir una migración, y los tests comprueban el contenido.
 *
 * Lo que sí vive en la base es el progreso de cada quien, que es dato de
 * usuario.
 *
 * Cada ejercicio se valida con el MISMO motor que reparte golpes en el 1v1, y
 * los tests corren la solución de referencia contra sus propias listas, así que
 * una lección con un ejercicio imposible rompe el build.
 */
import type { PatternLesson, Section } from "./lesson-types.ts";

const RAW_SECTIONS: Omit<Section, "language">[] = [
  {
    slug: "lo-basico",
    title: "Lo básico",
    summary: "Buscar texto tal cual, y las primeras piezas que valen por un carácter.",
    practiceSlugs: ["gato-pato-rato", "vocal-suelta", "letra-mayuscula", "hay-un-espacio"],
  },
  {
    slug: "cuantas-veces",
    title: "Cuántas veces",
    summary: "Repetir lo que acabas de escribir, con o sin número exacto.",
    practiceSlugs: [
      "digitos-sueltos",
      "tres-minusculas",
      "palabra-capitalizada",
      "palabras-sin-e",
      "tres-caracteres",
      "dos-digitos",
      "numero-corto",
      "codigo-postal",
      "gol-alargado",
    ],
  },
  {
    slug: "donde",
    title: "Dónde",
    summary: "Exigir que la coincidencia caiga en un sitio y no en cualquiera.",
    practiceSlugs: [
      "termina-en-punto",
      "fecha-dd-mm-aaaa",
      "etiqueta-html-apertura",
      "palabra-sol-exacta",
      "empieza-con-mayuscula",
      "termina-en-signo-de-cierre",
      "solo-letras-y-espacios",
    ],
  },
  {
    slug: "agrupar-y-elegir",
    title: "Agrupar y elegir",
    summary: "Tratar varias piezas como una sola, y ofrecer alternativas.",
    practiceSlugs: [
      "color-hexadecimal",
      "telefono-dominicano",
      "archivos-de-imagen",
      "ipv4",
      "palabra-duplicada",
      "comentario-de-linea",
      "decimal-con-miles",
      "dia-de-semana",
      "mes-de-dos-cifras",
      "letra-doble",
      "iniciales-con-punto",
      "hora-valida-24h",
      "triple-palabra-repetida",
    ],
  },
  {
    slug: "mirar-sin-consumir",
    title: "Mirar sin consumir",
    summary: "Condiciones que se comprueban sin llevarse el texto, y cómo domar los símbolos.",
    practiceSlugs: [
      "correos-com",
      "password-fuerte",
      "error-sin-warning",
      "password-con-simbolo",
      "linea-sin-pendiente",
      "dominio-sin-www",
      "password-muy-fuerte",
      "sin-palabra-prohibida",
      "numero-decimal",
      "correo-estricto",
    ],
  },
];

const RAW_LESSONS: Omit<PatternLesson, "language">[] = [
  // -------------------------------------------------------------- Lo básico
  {
    slug: "texto-literal",
    sectionSlug: "lo-basico",
    title: "Texto literal",
    summary: "Un patrón sin símbolos especiales busca exactamente eso.",
    body: [
      "Lo más simple que hace una expresión regular es buscar un texto tal cual. El patrón `gato` encuentra `gato` dentro de cualquier texto, y ya está.",
      "Ojo con esto desde el principio, porque explica muchas sorpresas de más adelante: el regex no busca palabras, busca secuencias de caracteres. `gato` también encuentra el `gato` que está metido dentro de `gatopardo`, porque esas cuatro letras están ahí en ese orden.",
      "Eso se arregla en la lección del límite de palabra. Por ahora quédate con que busca por posición y no por significado. Y que distingue mayúsculas de minúsculas: `luna` no encuentra `Luna`.",
    ],
    examples: [
      {
        pattern: "gato",
        sample: "el gato y el gatopardo",
        note: "Encuentra los dos, porque en `gatopardo` también están esas cuatro letras seguidas.",
      },
      {
        pattern: "la",
        sample: "la casa de la calle",
        note: "Tres veces, contando la que vive dentro de `calle`.",
      },
    ],
    exercise: {
      prompt: "Escribe un patrón que encuentre la palabra `luna` dentro de un texto.",
      match_mode: "partial",
      must_match: ["la luna", "luna llena", "media luna"],
      must_not_match: ["el sol", "Luna llena", "noche oscura"],
      hint: "Solo escribe las cuatro letras. Fíjate en que uno de los casos prohibidos lleva mayúscula.",
      solution: "luna",
    },
  },
  {
    slug: "el-punto",
    sectionSlug: "lo-basico",
    title: "El punto",
    summary: "`.` encaja con un carácter cualquiera, pero con uno solo.",
    body: [
      "El punto, `.`, es el primer símbolo con poder. Encaja con cualquier carácter (letra, número, espacio o signo) pero con uno solo, ni cero ni dos.",
      "Así `c.sa` encuentra `casa`, `cosa` y hasta `c9sa`. Lo único que exige es que en esa posición haya algo. Por eso mismo hay que usarlo con cuidado: acepta más de lo que uno quería.",
      "¿Y si lo que buscas es un punto de verdad, el de terminar una frase? Hay que quitarle el poder escribiéndolo como `\\.`, y de eso va la última lección del curso.",
    ],
    examples: [
      {
        pattern: "c.sa",
        sample: "casa cosa cesa c9sa",
        note: "Las cuatro, porque en esa posición hay algo distinto cada vez.",
      },
      {
        pattern: "p..",
        sample: "pan pez piso",
        note: "Tres caracteres empezando por `p`. En `piso` agarra `pis` y se detiene.",
      },
    ],
    exercise: {
      prompt:
        "Escribe un patrón de exactamente tres caracteres que empiece con `s`, termine con `l`, y acepte lo que sea en el medio.",
      match_mode: "full",
      must_match: ["sol", "sal", "sul"],
      must_not_match: ["sl", "sool", "SOL"],
      hint: "El `.` ocupa exactamente una posición, ni más ni menos.",
      solution: "s.l",
    },
  },
  {
    slug: "clases-de-caracteres",
    sectionSlug: "lo-basico",
    title: "Clases de caracteres",
    summary: "Los corchetes, `[ ]`, dicen: aquí va uno de estos.",
    body: [
      "El punto acepta cualquier cosa y a veces eso es demasiado. Los corchetes te dejan escribir la lista exacta de lo que aceptas en esa posición. `[gpr]ato` encaja con `gato`, `pato` y `rato`, pero deja fuera a `dato`.",
      "Dentro de los corchetes, un guion escribe un rango. `[a-z]` es cualquier minúscula, `[0-9]` cualquier dígito y `[A-Za-z]` cualquier letra, sea mayúscula o minúscula. También se mezclan: `[a-z0-9]` acepta minúsculas y dígitos.",
      "Y aunque escribas veinte cosas dentro, `[...]` sigue valiendo por un solo carácter. Eso se olvida mucho al principio.",
    ],
    examples: [
      {
        pattern: "[gpr]ato",
        sample: "gato pato rato dato",
        note: "Los tres primeros. `dato` queda fuera porque la `d` no está en la lista.",
      },
      {
        pattern: "[0-9][0-9]",
        sample: "año 2026 y 45 grados",
        note: "Pares de dígitos. En `2026` agarra `20` y después `26`.",
      },
    ],
    exercise: {
      prompt: "Captura una vocal minúscula.",
      match_mode: "partial",
      must_match: ["a", "hola", "murcielago"],
      must_not_match: ["xyz", "strng", "ppp"],
      hint: "Una lista de cinco letras entre `[` y `]`.",
      solution: "[aeiou]",
    },
  },
  {
    slug: "clases-negadas",
    sectionSlug: "lo-basico",
    title: "Clases negadas",
    summary: "Un `^` dentro de los corchetes le da la vuelta a la lista.",
    body: [
      "Si pones `^` como primer carácter dentro de los corchetes, la lista se invierte. `[^0-9]` es cualquier cosa que no sea un dígito.",
      "Es más útil de lo que parece, porque muchas veces sale más corto decir lo que no quieres. Para capturar lo que hay dentro de una etiqueta, `[^>]` (todo lo que no sea `>`) es más fácil que ponerse a listar lo que sí puede ir.",
      "Cuidado con la trampa: `^` solo niega si está pegado al corchete que abre. En `[a^b]` es un carácter normal, y esa lista acepta `a`, `^` o `b`.",
    ],
    examples: [
      {
        pattern: "[^aeiou]",
        sample: "hola",
        note: "La `h` y la `l`, o sea las consonantes.",
      },
      {
        pattern: "[^0-9]",
        sample: "a1b2",
        note: "La `a` y la `b`. Los dígitos quedan fuera.",
      },
    ],
    exercise: {
      prompt: "Captura un carácter que no sea ni letra minúscula ni espacio.",
      match_mode: "full",
      must_match: ["A", "7", "!"],
      must_not_match: ["a", " ", "z"],
      hint: "El `^` va pegado al corchete que abre, y el espacio también hay que listarlo.",
      solution: "[^a-z ]",
    },
  },
  {
    slug: "atajos",
    sectionSlug: "lo-basico",
    title: "Los atajos",
    summary: "Abreviaturas para las clases que más se usan: `\\d`, `\\w` y `\\s`.",
    body: [
      "Escribir `[0-9]` todo el rato cansa, así que hay atajos. `\\d` es un dígito. `\\w` es un carácter de palabra, o sea letra, número o guion bajo. `\\s` es un espacio en blanco, incluidos el tabulador y el salto de línea.",
      "Cada uno tiene su versión en mayúscula, que significa justo lo contrario. `\\D` es todo lo que no sea dígito, `\\W` todo lo que no sea carácter de palabra y `\\S` todo lo que no sea espacio. Es la idea de la clase negada, escrita en dos caracteres.",
      "También se meten dentro de los corchetes. `[\\d-]` acepta dígitos y el guion, que ahí es un guion normal porque no está entre dos cosas formando un rango.",
    ],
    examples: [
      {
        pattern: String.raw`\d`,
        sample: "a1b22",
        note: "Cada dígito por separado, porque todavía no sabemos repetir.",
      },
      {
        pattern: String.raw`\s`,
        sample: "dos palabras aqui",
        note: "Los dos espacios.",
      },
      {
        pattern: String.raw`[\d-]`,
        sample: "809-555",
        note: "Un atajo metido en una lista, junto a un `-` normal.",
      },
    ],
    exercise: {
      prompt: "Captura un dígito seguido de una letra minúscula.",
      match_mode: "full",
      must_match: ["1a", "9z", "5m"],
      must_not_match: ["a1", "11", "1A"],
      hint: "Un atajo primero y una clase `[...]` después.",
      solution: String.raw`\d[a-z]`,
    },
  },

  // ---------------------------------------------------------- Cuántas veces
  {
    slug: "cuantificadores",
    sectionSlug: "cuantas-veces",
    title: "Repetir con + * y ?",
    summary: "`+` es una o más, `*` es cero o más, `?` es cero o una.",
    body: [
      "Hasta ahora cada pieza que escribías valía por un carácter. Los cuantificadores la repiten, y se ponen justo detrás de lo que quieres repetir.",
      "`+` es una o más veces. Por eso `\\d+` captura un número entero completo, de la longitud que sea, en vez de ir dígito por dígito.",
      "`*` es cero o más. Acepta también que no haya nada, y eso sorprende al principio porque encaja con el vacío.",
      "`?` es cero o una. Es como se marcan las partes opcionales: `gatos?` encaja con `gato` y con `gatos`, porque la `s` puede estar o no.",
      "El cuantificador solo alcanza a la pieza que tiene justo delante. En `ab+` lo que se repite es la `b`, no el par. Para repetir `ab` entero hacen falta paréntesis, y eso es la lección de grupos.",
    ],
    examples: [
      {
        pattern: String.raw`\d+`,
        sample: "abc123 y 45",
        note: "Ahora sí, `123` y `45` completos en vez de dígito por dígito.",
      },
      {
        pattern: "gatos?",
        sample: "un gato y dos gatos",
        note: "Los dos, porque la `s` es opcional.",
      },
      {
        pattern: "ab+",
        sample: "ab abbb ababab",
        note: "Se repite la `b` sola. En `ababab` agarra `ab`, `ab` y `ab` por separado.",
      },
    ],
    exercise: {
      prompt: "Captura palabras que empiecen con `g` y sigan con una o más letras minúsculas.",
      match_mode: "full",
      must_match: ["gato", "gol", "ganas"],
      must_not_match: ["g", "Gato", "g1"],
      hint: "La `g` sola no vale, o sea que después tiene que venir por lo menos una letra.",
      solution: "g[a-z]+",
    },
  },
  {
    slug: "llaves",
    sectionSlug: "cuantas-veces",
    title: "Cuántas veces exactamente",
    summary: "Las llaves, `{ }`, le ponen números a la repetición.",
    body: [
      "Cuando sabes el número exacto, las llaves son más claras que repetir la pieza a mano. `\\d{4}` son cuatro dígitos, ni tres ni cinco, y es lo que usarías para un año.",
      "Con dos números separados por coma queda un rango. `\\d{1,3}` es de uno a tres dígitos, que es justo lo que necesita cada parte de una dirección IP.",
      "Si dejas la segunda cifra vacía, queda un mínimo sin techo. `\\d{2,}` es dos dígitos o más.",
      "Los cuantificadores cortos de la lección anterior son abreviaturas de esto: `+` es lo mismo que `{1,}`, y `*` es lo mismo que `{0,}`.",
    ],
    examples: [
      {
        pattern: String.raw`\d{4}`,
        sample: "naci en 1999 y hoy es 2026",
        note: "Los dos años, de cuatro cifras exactas.",
      },
      {
        pattern: "[a-z]{3}",
        sample: "sol y luna",
        note: "`sol` entero, y de `luna` agarra `lun`.",
      },
      {
        pattern: String.raw`\d{1,3}`,
        sample: "192.168.1.1",
        note: "Cada parte de la IP por separado.",
      },
    ],
    exercise: {
      prompt: "Captura códigos de exactamente dos letras mayúsculas seguidas de tres dígitos.",
      match_mode: "full",
      must_match: ["AB123", "XY999", "ZZ000"],
      must_not_match: ["A123", "ABC123", "AB12"],
      hint: "Dos pares de llaves, uno para las letras y otro para los dígitos.",
      solution: String.raw`[A-Z]{2}\d{3}`,
    },
  },
  {
    slug: "codicioso-o-perezoso",
    sectionSlug: "cuantas-veces",
    title: "Codicioso o perezoso",
    summary: "Por defecto los cuantificadores agarran todo lo que pueden.",
    body: [
      "Los cuantificadores son codiciosos: agarran lo máximo posible y solo sueltan si no queda más remedio. De ahí sale una de las sorpresas más comunes al empezar.",
      "Con `<.+>` sobre el texto `<b>hola</b>` uno esperaría capturar cada etiqueta por su lado. Lo que pasa es que se traga desde el primer `<` hasta el último `>`, todo de una vez.",
      "Poniéndole un `?` detrás al cuantificador se vuelve perezoso y agarra lo mínimo, así que `<.+?>` sí captura las dos etiquetas. Es el mismo cuantificador, solo cambia hasta dónde estira.",
      "Ojo que aquí `?` está haciendo otro trabajo. Detrás de una pieza significa opcional, como en `gatos?`. Detrás de un cuantificador significa perezoso, como en `.+?`. Es el mismo símbolo y depende de dónde caiga.",
      "Aun así, muchas veces la solución más limpia no es la pereza sino decir lo que no puede aparecer dentro. `<[^>]+>` llega al mismo sitio con una clase negada de las que ya viste.",
    ],
    examples: [
      {
        pattern: "<.+>",
        sample: "<b>hola</b>",
        note: "Una sola coincidencia que se lo traga todo. No era lo que queríamos.",
      },
      {
        pattern: "<.+?>",
        sample: "<b>hola</b>",
        note: "Con el `?` ya sí, las dos etiquetas por separado.",
      },
      {
        pattern: "<[^>]+>",
        sample: "<b>hola</b>",
        note: "El mismo resultado diciendo que dentro no puede ir un `>`. Suele ser lo más claro.",
      },
    ],
    exercise: {
      prompt:
        "Captura una etiqueta de apertura completa, sin usar el `.`. Di mejor lo que no puede aparecer dentro.",
      match_mode: "full",
      must_match: ["<b>", "<div>", "<p class=x>"],
      must_not_match: ["<b>hola</b>", "<>", "b>"],
      hint: "Una clase negada con el `>` dentro, y un cuantificador que exija al menos uno.",
      solution: "<[^>]+>",
    },
  },

  // --------------------------------------------------------------- Dónde
  {
    slug: "anclas",
    sectionSlug: "donde",
    title: "Anclas",
    summary: "`^` ata al principio del texto y `$` al final.",
    body: [
      "Un patrón normal se conforma con encontrar lo suyo en cualquier parte. Las anclas exigen posición. `^` al principio del patrón dice que la coincidencia tiene que empezar donde empieza el texto, y `$` al final dice que tiene que terminar donde termina.",
      "Poner las dos, `^...$`, es la forma de exigir que el patrón calce el texto entero y no un pedazo. Esa es la diferencia entre encontrar un correo dentro de un párrafo y comprobar que lo que alguien escribió es un correo y nada más. En los retos del juego, cuando ves que dice que tiene que calzar completo, es exactamente esto.",
      "Ojo que `^` tiene dos significados según dónde esté. Al principio del patrón es un ancla. Dentro de unos corchetes, como en `[^0-9]`, niega la lista. Es el mismo símbolo haciendo dos trabajos distintos.",
    ],
    examples: [
      {
        pattern: "^hola",
        sample: "hola mundo",
        note: "Encaja, porque `hola` está al principio del texto.",
      },
      {
        pattern: "^hola",
        sample: "dice hola",
        note: "Aquí no encaja nada, porque `hola` no está al principio.",
        expectsNoMatch: true,
      },
      {
        pattern: "do$",
        sample: "todo el mundo",
        note: "Solo el `do` final de `mundo`. El de `todo` no está al final.",
      },
    ],
    exercise: {
      prompt:
        "Captura textos que sean exactamente un número entero, sin nada más alrededor. Este reto está en modo buscar dentro, así que las anclas las tienes que poner tú.",
      match_mode: "partial",
      must_match: ["123", "7", "2026"],
      must_not_match: ["12a", "a12", "12 34"],
      hint: "Necesitas las dos anclas, una a cada lado.",
      solution: String.raw`^\d+$`,
    },
  },
  {
    slug: "limite-de-palabra",
    sectionSlug: "donde",
    title: "El límite de palabra",
    summary: "`\\b` marca dónde empieza o termina una palabra, sin capturar nada.",
    body: [
      "`\\b` no captura ningún carácter, marca una frontera. Es el punto donde un carácter de palabra toca uno que no lo es, o el borde del texto.",
      "Sirve justo para lo que quedó pendiente en la primera lección. `gato` encuentra el `gato` que vive dentro de `gatopardo`, pero `\\bgato\\b` ya no, porque después de `gato` tendría que venir algo que no sea letra.",
      "Como no consume nada, lo puedes poner sin miedo a que te descuadre la longitud de lo capturado.",
    ],
    examples: [
      {
        pattern: String.raw`\bgato\b`,
        sample: "el gato y el gatopardo",
        note: "Ahora solo el primero.",
      },
      {
        pattern: String.raw`\bde\b`,
        sample: "de dentro de casa",
        note: "Los dos `de` sueltos. El que está dentro de `dentro` no cuenta.",
      },
    ],
    exercise: {
      prompt: "Captura la palabra `sol` completa, de modo que no valga cuando es parte de otra.",
      match_mode: "partial",
      must_match: ["el sol", "sol brillante", "hace sol hoy"],
      must_not_match: ["solo", "girasol amarillo", "consola"],
      hint: "Un `\\b` a cada lado de las tres letras.",
      solution: String.raw`\bsol\b`,
    },
  },

  // ------------------------------------------------------- Agrupar y elegir
  {
    slug: "grupos",
    sectionSlug: "agrupar-y-elegir",
    title: "Grupos",
    summary: "Los paréntesis, `( )`, juntan varias piezas en una sola.",
    body: [
      "Los paréntesis agrupan. Sin ellos, un cuantificador solo alcanza a la pieza que tiene justo delante, así que en `ab+` lo que se repite es la `b`. Con `(ab)+` lo que se repite es `ab` entero: `ab`, `abab`, `ababab`.",
      "Además de agrupar, los paréntesis capturan, o sea que se acuerdan de qué texto encajó dentro de ellos. Eso no cambia lo que el patrón encuentra, pero es lo que hace posible la referencia hacia atrás, dos lecciones más adelante.",
      "Agrupar es lo que te deja construir patrones por bloques. `(\\d{2}/){2}\\d{4}` es una fecha: dos veces el bloque de dos dígitos con barra, y detrás el año.",
    ],
    examples: [
      {
        pattern: "(ab)+",
        sample: "ab ababab b",
        note: "El `ab` suelto y luego `ababab` entero, como un bloque repetido.",
      },
      {
        pattern: String.raw`(\d{2}/){2}\d{4}`,
        sample: "hoy es 25/12/2026",
        note: "La fecha completa, repitiendo dos veces el bloque de dos dígitos con barra.",
      },
    ],
    exercise: {
      prompt: "Captura la sílaba `ja` repetida dos o más veces seguidas.",
      match_mode: "full",
      must_match: ["jaja", "jajaja", "jajajaja"],
      must_not_match: ["ja", "jaj", "aj"],
      hint: "Agrupa las dos letras y cuantifica el grupo, no la última letra.",
      solution: "(ja){2,}",
    },
  },
  {
    slug: "alternancia",
    sectionSlug: "agrupar-y-elegir",
    title: "Alternancia",
    summary: "La barra vertical, `|`, significa o.",
    body: [
      "`|` separa opciones. El patrón `gato|perro` encaja con cualquiera de las dos palabras.",
      "Casi siempre vas a querer meterla entre paréntesis, porque sin ellos se come todo lo que tiene a los lados. `el gato|perro` no significa el gato o el perro: significa `el gato` completo, o bien `perro` a secas. Escribiéndolo `el (gato|perro)` ya dice lo que querías.",
      "Es el mecanismo detrás de casi todos los retos que aceptan varios formatos, como las extensiones de archivo o los códigos de teléfono.",
    ],
    examples: [
      {
        pattern: "gato|perro",
        sample: "un gato y un perro",
        note: "Las dos, cada una por su lado.",
      },
      {
        pattern: String.raw`archivo\.(jpg|png)`,
        sample: "archivo.jpg y archivo.png",
        note: "La misma base con dos extensiones posibles.",
      },
    ],
    exercise: {
      prompt: "Captura exactamente uno de estos tres colores: rojo, azul o amarillo.",
      match_mode: "full",
      must_match: ["rojo", "azul", "amarillo"],
      must_not_match: ["verde", "rojizo", "Azul"],
      hint: "Dos `|` para tres opciones.",
      solution: "rojo|azul|amarillo",
    },
  },
  {
    slug: "sin-captura-y-referencias",
    sectionSlug: "agrupar-y-elegir",
    title: "Grupos sin captura y referencias",
    summary: "Agrupar sin recordar, con `(?:...)`, y exigir que un texto se repita.",
    body: [
      "A veces solo quieres agrupar para aplicarle un cuantificador y no te interesa que el grupo se acuerde de nada. Para eso está `(?:...)`, que agrupa igual pero no captura. En patrones grandes eso mantiene la numeración limpia.",
      "Lo contrario también existe, y es lo más divertido de esta sección. Los grupos normales se numeran por orden de aparición: el primero es el `1`. Más adelante en el mismo patrón puedes referirte a él con `\\1` para exigir que aparezca otra vez el mismo texto que capturó.",
      "Con `\\b(\\w+) \\1\\b` se detectan palabras repetidas. La misma idea sirve para etiquetas que abren y cierran igual, o para cualquier cosa donde la segunda parte tiene que coincidir con la primera. Es de lo poco que hace un regex que no se puede imitar con una simple lista de caracteres.",
    ],
    examples: [
      {
        pattern: String.raw`\b(\w+) \1\b`,
        sample: "el el gato y la casa",
        note: "Captura `el el`. El grupo se acuerda de la primera palabra y la exige otra vez.",
      },
      {
        pattern: "(?:ab)+",
        sample: "ababab",
        note: "Igual que con paréntesis normales, pero sin numerar el grupo.",
      },
    ],
    exercise: {
      prompt: "Captura una misma letra minúscula repetida tres veces seguidas, sea cual sea.",
      match_mode: "full",
      must_match: ["aaa", "bbb", "zzz"],
      must_not_match: ["abc", "aab", "aa"],
      hint: "Captura una letra en un grupo, y después exígela dos veces más con `\\1`.",
      solution: String.raw`([a-z])\1\1`,
    },
  },

  // ---------------------------------------------------- Mirar sin consumir
  {
    slug: "lookahead",
    sectionSlug: "mirar-sin-consumir",
    title: "Mirar sin consumir",
    summary: "Comprobar lo que viene después, con `(?=...)`, sin llevárselo.",
    body: [
      "Un lookahead comprueba lo que viene a continuación sin incluirlo en la coincidencia. Es como asomarse. Se escribe `(?=...)`: lo que va dentro tiene que estar ahí, pero no se lo lleva.",
      "La versión negativa es `(?!...)`, y exige lo contrario, que ahí no esté eso.",
      "La utilidad clásica es validar varias condiciones a la vez sobre el mismo texto, cosas que no vienen en un orden fijo. Una contraseña que tenga por lo menos una mayúscula y además un dígito no se puede escribir de corrido, porque no sabes cuál va primero.",
      "Con `(?=.*[A-Z])(?=.*\\d)` al principio, cada uno comprueba lo suyo sin moverse del sitio, y después el patrón de verdad recorre el texto.",
    ],
    examples: [
      {
        pattern: String.raw`\d+(?= pesos)`,
        sample: "pague 500 pesos y 20 dolares",
        note: "Solo el `500`, y fíjate en que no se lleva la palabra `pesos`.",
      },
      {
        pattern: "^(?!.*error).*$",
        sample: "todo bien por aqui",
        note: "Encaja porque en la línea no aparece la palabra `error`.",
      },
      {
        pattern: "^(?!.*error).*$",
        sample: "hay un error aqui",
        note: "Aquí no encaja nada, que es justo lo que queríamos.",
        expectsNoMatch: true,
      },
    ],
    exercise: {
      prompt:
        "Captura textos de al menos seis caracteres, solo minúsculas y dígitos, que contengan por lo menos un dígito.",
      match_mode: "full",
      must_match: ["abc123", "a12345", "clave1x"],
      must_not_match: ["abcdef", "ab12", "12345"],
      hint: "Un `(?=...)` que exija el dígito en alguna parte, y detrás la clase con su `{6,}`.",
      solution: String.raw`(?=.*\d)[a-z\d]{6,}`,
    },
  },
  {
    slug: "escapar",
    sectionSlug: "mirar-sin-consumir",
    title: "Escapar lo especial",
    summary: "La barra invertida, `\\`, le quita el poder a un símbolo.",
    body: [
      "Ya viste que `.` significa cualquier carácter. Si lo que quieres es un punto de verdad, se escapa poniéndole una barra invertida delante: `\\.` vuelve a ser un punto normal y corriente.",
      "Los que hay que escapar son los que tienen poder: `.` `+` `*` `?` `^` `$` `(` `)` `[` `]` `{` `}` `|` y la propia `\\`. Si tienes duda con alguno, escaparlo no hace daño.",
      "Dentro de los corchetes casi todos pierden el poder solos, así que ahí hace falta escapar muchos menos. Con esto ya tienes todas las piezas del curso: lo que queda es practicar.",
    ],
    examples: [
      {
        pattern: String.raw`\.`,
        sample: "archivo.txt",
        note: "Solo el punto real, no cada carácter.",
      },
      {
        pattern: ".",
        sample: "archivo.txt",
        note: "Sin escapar, el `.` agarra absolutamente todo.",
      },
      {
        pattern: String.raw`\$\d+`,
        sample: "cuesta $50 hoy",
        note: "El `$` escapado, porque suelto significaría final de texto.",
      },
    ],
    exercise: {
      prompt: "Captura precios escritos con un `$` pegado a uno o más dígitos.",
      match_mode: "partial",
      must_match: ["$5", "$100", "vale $2026"],
      must_not_match: ["5 pesos", "$", "USD 100"],
      hint: "El `$` tiene poder, hay que quitárselo primero.",
      solution: String.raw`\$\d+`,
    },
  },
];

export const REGEX_SECTIONS: Section[] = RAW_SECTIONS.map((section) => ({
  ...section,
  language: "regex" as const,
}));

export const REGEX_LESSONS: PatternLesson[] = RAW_LESSONS.map((lesson) => ({
  ...lesson,
  language: "regex" as const,
}));
