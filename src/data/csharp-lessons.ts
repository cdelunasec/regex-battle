/**
 * El curso de C#, desde cero.
 *
 * Va en el orden de una materia de Programación, y cada lección enseña una
 * pieza con programas que se ejecutan ahí mismo. Los ejemplos son editables a
 * propósito: leer que `7 / 2` da `3` no enseña ni la mitad que cambiarlo a
 * `7.0 / 2` y ver que sale `3.5`.
 *
 * Los ejercicios se corrigen con el compilador del navegador, igual que la
 * práctica solo, y `npm run verify:csharp` comprueba que la solución de
 * referencia de cada uno pasa sus casos.
 */
import type { CSharpLesson, Section } from "./lesson-types.ts";

export const CSHARP_SECTIONS: Section[] = [
  {
    slug: "cs-lo-primero",
    language: "csharp",
    title: "Lo primero",
    summary: "Escribir, guardar datos, leerlos y hacer cuentas.",
    practiceSlugs: [
      "cs-saludo",
      "cs-doble",
      "cs-suma-dos",
      "cs-area-rectangulo",
      "cs-edad-en-meses",
    ],
  },
  {
    slug: "cs-decidir",
    language: "csharp",
    title: "Decidir",
    summary: "Que el programa haga una cosa u otra según lo que reciba.",
    practiceSlugs: [
      "cs-par-o-impar",
      "cs-mayor-de-dos",
      "cs-aprobado",
      "cs-signo",
      "cs-dia-de-la-semana",
    ],
  },
  {
    slug: "cs-repetir",
    language: "csharp",
    title: "Repetir",
    summary: "Hacer algo muchas veces sin escribirlo muchas veces.",
    practiceSlugs: [
      "cs-contar-hasta-n",
      "cs-tabla-de-multiplicar",
      "cs-suma-hasta-n",
      "cs-cuenta-regresiva",
      "cs-piramide",
    ],
  },
  {
    slug: "cs-guardar-varios",
    language: "csharp",
    title: "Guardar varios datos",
    summary: "Arreglos, texto y listas: cuando una variable suelta no alcanza.",
    practiceSlugs: [
      "cs-mayor-de-la-lista",
      "cs-contar-vocales",
      "cs-invertir-texto",
      "cs-suma-en-una-linea",
      "cs-contar-palabras",
    ],
  },
  {
    slug: "cs-organizar",
    language: "csharp",
    title: "Organizar el código",
    summary: "Métodos y clases, para que un programa grande no sea un enredo.",
    practiceSlugs: [
      "cs-mcd-y-mcm",
      "cs-anagramas",
      "cs-cuenta-del-colmado",
      "cs-mejor-del-grupo",
      "cs-parentesis-balanceados",
    ],
  },
];

export const CSHARP_LESSONS: CSharpLesson[] = [
  // ------------------------------------------------------------ Lo primero
  {
    slug: "cs-hola-mundo",
    sectionSlug: "cs-lo-primero",
    language: "csharp",
    title: "Tu primer programa",
    summary: "Dónde empieza un programa de C# y cómo imprimir en pantalla.",
    body: [
      "Un programa de C# de consola empieza siempre en un método que se llama `Main`. Ahí dentro va lo que quieres que pase, y pasa en orden: de arriba hacia abajo, una línea después de otra.",
      'Para escribir en pantalla se usa `Console.WriteLine("Hola")`, que imprime el texto y baja una línea. Su hermano `Console.Write` imprime igual pero se queda en la misma línea. El texto siempre va entre comillas dobles.',
      "Cada instrucción termina en punto y coma. Olvidarlo es el error más común al empezar, y por suerte el compilador lo dice con todas sus letras: `Se esperaba ;`.",
      "Las llaves `{` y `}` marcan dónde empieza y dónde termina un bloque. La clase abre uno y `Main` abre otro dentro. Por eso el código se ve escalonado: cada bloque que entra se escribe un poco más a la derecha.",
    ],
    examples: [
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        Console.WriteLine("Hola, ITLA!");
    }
}`,
        note: "Dale a Ejecutar. Después cambia el texto de entre comillas y vuelve a darle: lo que hay dentro de las comillas sale tal cual.",
      },
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        Console.Write("uno ");
        Console.Write("dos ");
        Console.WriteLine("tres");
        Console.WriteLine("otra linea");
    }
}`,
        note: "`Write` deja el cursor donde estaba y `WriteLine` baja. Por eso los tres primeros salen juntos.",
      },
    ],
    exercise: {
      prompt: "Imprime dos líneas: primero `ITLA` y en la siguiente `Code Battle`.",
      cases: [{ stdin: "", expected: "ITLA\nCode Battle" }],
      hint: "Dos `Console.WriteLine`, uno debajo del otro, cada uno con su punto y coma.",
      solution: String.raw`using System;

class Program
{
    static void Main()
    {
        Console.WriteLine("ITLA");
        Console.WriteLine("Code Battle");
    }
}`,
    },
  },
  {
    slug: "cs-variables",
    sectionSlug: "cs-lo-primero",
    language: "csharp",
    title: "Variables y tipos",
    summary: "Guardar un dato con un nombre para usarlo después.",
    body: [
      "Una variable es una caja con nombre donde guardas un dato. Para crearla dices de qué tipo es y cómo se llama: `int edad = 19;`.",
      "C# es estricto con los tipos, y eso ayuda más de lo que estorba: `int` para números enteros, `double` para los que llevan decimales, `string` para texto y `bool` para verdadero o falso. Si le metes a una caja algo que no es de su tipo, no compila.",
      "Una vez creada, la variable se usa por su nombre y se le puede cambiar el valor: `edad = 20;`. Lo que no se repite es el tipo, eso solo va la primera vez.",
      'Para imprimir mezclando texto y variables está la interpolación: un `$` delante de las comillas y las variables entre llaves, como en `$"Tengo {edad} años"`. Es más cómodo que ir pegando pedazos con `+`.',
    ],
    examples: [
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        string nombre = "DeLuna";
        int edad = 19;
        double promedio = 88.5;
        bool estudiante = true;

        Console.WriteLine(nombre);
        Console.WriteLine(edad);
        Console.WriteLine(promedio);
        Console.WriteLine(estudiante);
    }
}`,
        note: "Fíjate en cómo se imprime un `bool`: sale `True`, con mayúscula. Prueba a cambiarle los valores.",
      },
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        string nombre = "Ana";
        int edad = 20;

        Console.WriteLine("Me llamo " + nombre + " y tengo " + edad);
        Console.WriteLine($"Me llamo {nombre} y tengo {edad}");
    }
}`,
        note: "Las dos líneas imprimen lo mismo. La segunda es la interpolación, y se lee mucho mejor cuando hay varias variables.",
      },
    ],
    exercise: {
      prompt:
        "Crea una variable `string` con el valor `DeLuna` y una `int` con el valor 19, e imprime `DeLuna tiene 19 anios` usando las dos.",
      cases: [{ stdin: "", expected: "DeLuna tiene 19 anios" }],
      hint: 'Declara las dos variables y arma la frase con interpolación: `$"{nombre} tiene {edad} anios"`.',
      solution: String.raw`using System;

class Program
{
    static void Main()
    {
        string nombre = "DeLuna";
        int edad = 19;
        Console.WriteLine($"{nombre} tiene {edad} anios");
    }
}`,
    },
  },
  {
    slug: "cs-leer-datos",
    sectionSlug: "cs-lo-primero",
    language: "csharp",
    title: "Leer lo que escribe el usuario",
    summary: "`Console.ReadLine` y cómo convertir ese texto en número.",
    body: [
      "`Console.ReadLine()` lee una línea de lo que escribió el usuario y te la devuelve. Ojo con esto: te la devuelve como `string`, siempre, aunque lo que haya escrito sean puros números.",
      "Para hacer cuentas con eso hay que convertirlo: `int.Parse(Console.ReadLine())` lo pasa a entero, y `double.Parse` a decimal. Si el texto no es un número de verdad, el programa se detiene con `FormatException`.",
      "Cada llamada a `ReadLine` lee UNA línea. Si el reto trae dos datos, son dos llamadas.",
      'Una regla de aquí que te va a ahorrar rabia: **imprime solo lo que te piden**. En clase se acostumbra escribir `Console.Write("Ingrese un numero: ")` antes de leer, pero el corrector compara la salida entera, y ese mensaje de más la hace distinta.',
    ],
    examples: [
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        string nombre = Console.ReadLine();
        Console.WriteLine($"Hola, {nombre}!");
    }
}`,
        stdin: "DeLuna",
        note: "La entrada de este ejemplo es `DeLuna`. Cámbiala en el recuadro de entrada y vuelve a ejecutar.",
      },
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        int numero = int.Parse(Console.ReadLine());
        Console.WriteLine(numero * 2);
    }
}`,
        stdin: "21",
        note: "Sin el `int.Parse` esto no compilaría: no se puede multiplicar un texto por 2.",
      },
    ],
    exercise: {
      prompt: "Lee dos números enteros, uno por línea, e imprime su suma. No imprimas nada más.",
      cases: [
        { stdin: "2\n3", expected: "5" },
        { stdin: "10\n-4", expected: "6" },
        { stdin: "0\n0", expected: "0" },
      ],
      hint: "Dos `Console.ReadLine()`, cada uno con su `int.Parse`, guardados en dos variables.",
      solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int a = int.Parse(Console.ReadLine());
        int b = int.Parse(Console.ReadLine());
        Console.WriteLine(a + b);
    }
}`,
    },
  },
  {
    slug: "cs-operadores",
    sectionSlug: "cs-lo-primero",
    language: "csharp",
    title: "Hacer cuentas",
    summary: "Los operadores, la división entera y el resto.",
    body: [
      "Los de siempre: `+`, `-`, `*` y `/`. Y uno que al principio no se ve venir, `%`, que da el RESTO de una división. `7 % 2` es `1`, porque 7 entre 2 da 3 y sobra 1.",
      "El `%` sirve para más de lo que parece. Un número es par si `n % 2 == 0`. Y para saber el último dígito de un número, `n % 10`.",
      "Cuidado con la división: si los dos números son enteros, C# hace división ENTERA y bota los decimales. `7 / 2` da `3`, no `3.5`. Para que dé `3.5`, alguno de los dos tiene que ser decimal: `7.0 / 2`, o convertir con `(double)`.",
      "Las cuentas se resuelven con la prioridad de siempre: primero `*`, `/` y `%`, después `+` y `-`. Los paréntesis mandan sobre todo, y de paso hacen que se entienda de un vistazo.",
    ],
    examples: [
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        Console.WriteLine(7 / 2);
        Console.WriteLine(7.0 / 2);
        Console.WriteLine(7 % 2);
        Console.WriteLine((1 + 2) * 3);
    }
}`,
        note: "La primera línea da 3 y la segunda 3.5. Esa diferencia es la que más errores calla: el programa no falla, solo da otro número.",
      },
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        int total = int.Parse(Console.ReadLine());
        Console.WriteLine(total / 60);
        Console.WriteLine(total % 60);
    }
}`,
        stdin: "150",
        note: "150 segundos son 2 minutos y sobran 30. La división entera da los minutos y el resto da los segundos.",
      },
    ],
    exercise: {
      prompt:
        "Lee una cantidad de segundos e imprime en una línea los minutos completos y en la siguiente los segundos que sobran.",
      cases: [
        { stdin: "150", expected: "2\n30" },
        { stdin: "59", expected: "0\n59" },
        { stdin: "3600", expected: "60\n0" },
      ],
      hint: "Los minutos salen con `/ 60` y lo que sobra con `% 60`.",
      solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int total = int.Parse(Console.ReadLine());
        Console.WriteLine(total / 60);
        Console.WriteLine(total % 60);
    }
}`,
    },
  },

  // --------------------------------------------------------------- Decidir
  {
    slug: "cs-if",
    sectionSlug: "cs-decidir",
    language: "csharp",
    title: "if y else",
    summary: "Que el programa tome un camino u otro.",
    body: [
      "`if` ejecuta un bloque solo si se cumple una condición, y `else` dice qué hacer cuando no se cumple. La condición va entre paréntesis y tiene que dar verdadero o falso.",
      "Para comparar: `==` es igual, `!=` distinto, y `>`, `<`, `>=`, `<=` lo que parecen. El más traicionero es `==`: con UN solo `=` no comparas, asignas, y el compilador te lo va a reclamar.",
      "Cuando hay más de dos caminos se encadena con `else if`. Se pregunta en orden, y en cuanto uno se cumple, los demás ni se miran.",
      "Si el bloque es de una sola línea las llaves se pueden omitir, pero ponlas igual: el día que agregues una segunda línea, sin llaves solo entra la primera y el error es de los que cuesta ver.",
    ],
    examples: [
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        int nota = int.Parse(Console.ReadLine());

        if (nota >= 70)
        {
            Console.WriteLine("aprobado");
        }
        else
        {
            Console.WriteLine("reprobado");
        }
    }
}`,
        stdin: "70",
        note: "Con 70 imprime `aprobado`, porque la comparación es `>=`. Cámbialo a `>` y ejecuta otra vez: ahora 70 reprueba.",
      },
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());

        if (n > 0)
        {
            Console.WriteLine("positivo");
        }
        else if (n < 0)
        {
            Console.WriteLine("negativo");
        }
        else
        {
            Console.WriteLine("cero");
        }
    }
}`,
        stdin: "-5",
        note: "Tres caminos, uno solo se cumple. El último `else` recoge lo que no entró en ninguno.",
      },
    ],
    exercise: {
      prompt: "Lee una edad e imprime `mayor de edad` si es 18 o más, y `menor de edad` si no.",
      cases: [
        { stdin: "18", expected: "mayor de edad" },
        { stdin: "17", expected: "menor de edad" },
        { stdin: "40", expected: "mayor de edad" },
      ],
      hint: "Los 18 ya son mayor de edad, así que la comparación es `>=` y no `>`.",
      solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int edad = int.Parse(Console.ReadLine());
        if (edad >= 18)
        {
            Console.WriteLine("mayor de edad");
        }
        else
        {
            Console.WriteLine("menor de edad");
        }
    }
}`,
    },
  },
  {
    slug: "cs-logicos",
    sectionSlug: "cs-decidir",
    language: "csharp",
    title: "Condiciones con y, o, no",
    summary: "Juntar varias condiciones en una sola.",
    body: [
      "`&&` es Y: se cumple solo si las dos condiciones se cumplen. `||` es O: basta con que una se cumpla. Y `!` le da la vuelta a lo que sea.",
      "Con esto se escriben los rangos, que aparecen todo el tiempo. Un número entre 1 y 100 es `n >= 1 && n <= 100`. Ojo, `1 <= n <= 100` no compila en C#: hay que decirlo con las dos comparaciones.",
      "C# se ahorra trabajo: en `a && b`, si `a` ya es falso ni mira `b`. Eso además protege, porque deja escribir cosas como `texto != null && texto.Length > 0` sin miedo.",
      "Cuando mezcles `&&` y `||` en la misma condición, usa paréntesis. Aunque sepas de memoria cuál va primero, quien lea el código mañana no tiene por qué.",
    ],
    examples: [
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        int nota = int.Parse(Console.ReadLine());

        if (nota >= 0 && nota <= 100)
        {
            Console.WriteLine("nota valida");
        }
        else
        {
            Console.WriteLine("nota invalida");
        }
    }
}`,
        stdin: "105",
        note: "Prueba con 50, con -1 y con 105. Las dos condiciones tienen que cumplirse a la vez.",
      },
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        int anio = int.Parse(Console.ReadLine());
        bool bisiesto = (anio % 4 == 0 && anio % 100 != 0) || anio % 400 == 0;
        Console.WriteLine(bisiesto);
    }
}`,
        stdin: "1900",
        note: "El año bisiesto es el ejemplo clásico de mezclar `&&` con `||`. Prueba con 2024, 1900 y 2000.",
      },
    ],
    exercise: {
      prompt:
        "Lee un número e imprime `dentro` si está entre 1 y 100, los dos incluidos, y `fuera` si no.",
      cases: [
        { stdin: "50", expected: "dentro" },
        { stdin: "1", expected: "dentro" },
        { stdin: "0", expected: "fuera" },
        { stdin: "101", expected: "fuera" },
      ],
      hint: "Dos comparaciones unidas con `&&`: una para el 1 y otra para el 100.",
      solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        if (n >= 1 && n <= 100)
        {
            Console.WriteLine("dentro");
        }
        else
        {
            Console.WriteLine("fuera");
        }
    }
}`,
    },
  },
  {
    slug: "cs-switch",
    sectionSlug: "cs-decidir",
    language: "csharp",
    title: "El switch",
    summary: "Cuando hay muchos caminos y todos comparan lo mismo.",
    body: [
      "Cuando estás preguntando una y otra vez por el mismo valor, una escalera de `else if` se hace larga. `switch` dice ese valor una sola vez y después lista los casos.",
      "Cada caso termina en `break`, que es lo que corta y sale del `switch`. Si se te olvida, C# no compila: en otros lenguajes te dejaría caer al caso siguiente sin avisar.",
      "`default` es el caso que atrapa todo lo que no encajó en ninguno, como el `else` final de la escalera.",
      "`switch` solo sirve para comparar por igualdad contra valores fijos. Para rangos como `nota >= 90`, la escalera de `if` sigue siendo la herramienta.",
    ],
    examples: [
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        int dia = int.Parse(Console.ReadLine());

        switch (dia)
        {
            case 1:
                Console.WriteLine("lunes");
                break;
            case 2:
                Console.WriteLine("martes");
                break;
            default:
                Console.WriteLine("otro dia");
                break;
        }
    }
}`,
        stdin: "2",
        note: "Prueba con 1, con 2 y con 9. Quítale un `break` y mira lo que dice el compilador.",
      },
    ],
    exercise: {
      prompt:
        "Lee un número del 1 al 3 e imprime `oro`, `plata` o `bronce`. Con cualquier otro número imprime `sin medalla`.",
      cases: [
        { stdin: "1", expected: "oro" },
        { stdin: "3", expected: "bronce" },
        { stdin: "7", expected: "sin medalla" },
      ],
      hint: "Tres `case` con su `break`, y un `default` para lo demás.",
      solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int puesto = int.Parse(Console.ReadLine());
        switch (puesto)
        {
            case 1:
                Console.WriteLine("oro");
                break;
            case 2:
                Console.WriteLine("plata");
                break;
            case 3:
                Console.WriteLine("bronce");
                break;
            default:
                Console.WriteLine("sin medalla");
                break;
        }
    }
}`,
    },
  },

  // --------------------------------------------------------------- Repetir
  {
    slug: "cs-for",
    sectionSlug: "cs-repetir",
    language: "csharp",
    title: "El bucle for",
    summary: "Repetir algo una cantidad de veces que ya sabes.",
    body: [
      "El `for` junta en una línea las tres cosas que lleva toda repetición: dónde empieza, hasta cuándo sigue y cómo avanza. `for (int i = 1; i <= 5; i++)` arranca en 1, sigue mientras `i` no pase de 5, y sube de uno en uno.",
      "`i++` suma 1 a `i`. Es la forma corta de `i = i + 1`, y la vas a ver en todos los bucles.",
      "La variable del bucle solo existe dentro de él. Eso es bueno: cuando el bucle termina, no queda nada suelto estorbando.",
      "Contar desde 0 o desde 1 depende de lo que hagas. Para imprimir del 1 al 5, empieza en 1. Para recorrer un arreglo, empieza en 0, porque la primera posición es la 0.",
    ],
    examples: [
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        for (int i = 1; i <= 5; i++)
        {
            Console.WriteLine(i);
        }
    }
}`,
        note: "Cambia el `<=` por `<` y ejecuta: ahora llega solo hasta el 4. Ese detalle decide cuántas vueltas da.",
      },
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());

        for (int i = 1; i <= 10; i++)
        {
            Console.WriteLine($"{n} x {i} = {n * i}");
        }
    }
}`,
        stdin: "7",
        note: "La tabla del 7. Lo que cambia en cada vuelta es `i`, y con él lo que se imprime.",
      },
    ],
    exercise: {
      prompt:
        "Lee un número `n` e imprime los números pares del 2 hasta `n`, uno por línea. Si no hay ninguno, no imprimas nada.",
      cases: [
        { stdin: "6", expected: "2\n4\n6" },
        { stdin: "1", expected: "" },
        { stdin: "9", expected: "2\n4\n6\n8" },
      ],
      hint: "Recorre del 1 al `n` y dentro pregunta con `%` si el número es par. O más corto: empieza en 2 y avanza de dos en dos.",
      solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        for (int i = 2; i <= n; i += 2)
        {
            Console.WriteLine(i);
        }
    }
}`,
    },
  },
  {
    slug: "cs-while",
    sectionSlug: "cs-repetir",
    language: "csharp",
    title: "El bucle while",
    summary: "Repetir sin saber de antemano cuántas veces.",
    body: [
      "Cuando no sabes cuántas vueltas van a ser, el `for` no encaja. `while` repite mientras la condición se cumpla, y la condición se revisa antes de cada vuelta.",
      "Aquí aparece el bucle infinito: si nada de lo que hay dentro cambia la condición, el programa no para nunca. Es el error más caro de los bucles, y la forma de evitarlo es siempre la misma: mira qué variable decide la parada y asegúrate de que de verdad cambia dentro.",
      "Un patrón que vas a usar mucho es el acumulador: una variable que empieza en 0 (o en 1, si vas a multiplicar) y va creciendo en cada vuelta.",
      "`do ... while` es igual pero revisa al final, así que el bloque se ejecuta al menos una vez. Se usa poco, pero cuadra cuando hay que pedir un dato y repetir si vino mal.",
    ],
    examples: [
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());

        while (n > 0)
        {
            Console.WriteLine(n);
            n--;
        }
        Console.WriteLine("Despegue!");
    }
}`,
        stdin: "3",
        note: "El `n--` es lo que hace que esto termine. Bórralo y ejecuta: el programa se queda dando vueltas y hay que pararlo.",
      },
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        int suma = 0;
        int numero = int.Parse(Console.ReadLine());

        while (numero != 0)
        {
            suma += numero;
            numero = int.Parse(Console.ReadLine());
        }
        Console.WriteLine(suma);
    }
}`,
        stdin: "5\n3\n0",
        note: "Un acumulador. `suma += numero` es la forma corta de `suma = suma + numero`.",
      },
    ],
    exercise: {
      prompt:
        "Lee números, uno por línea, hasta que llegue un `-1`. Imprime cuántos de los anteriores fueron positivos, o sea mayores que cero.",
      cases: [
        { stdin: "5\n-3\n8\n-1", expected: "2" },
        { stdin: "-1", expected: "0" },
        { stdin: "1\n2\n3\n-1", expected: "3" },
      ],
      hint: "Un contador que empieza en 0, y un `while` que lee hasta el `-1`. Dentro, un `if` decide si ese número suma.",
      solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int positivos = 0;
        int numero = int.Parse(Console.ReadLine());

        while (numero != -1)
        {
            if (numero > 0)
            {
                positivos++;
            }
            numero = int.Parse(Console.ReadLine());
        }
        Console.WriteLine(positivos);
    }
}`,
    },
  },
  {
    slug: "cs-bucles-anidados",
    sectionSlug: "cs-repetir",
    language: "csharp",
    title: "Bucles dentro de bucles",
    summary: "Filas y columnas: un bucle por cada dimensión.",
    body: [
      "Un bucle dentro de otro da vueltas completas del de adentro por cada vuelta del de afuera. Con 3 y 3, el de adentro corre 9 veces.",
      "La forma de pensarlo que menos enreda: el de afuera lleva las filas y el de adentro las columnas. Dentro del de adentro imprimes con `Write`, sin bajar, y al terminar cada fila haces un `Console.WriteLine()` vacío para pasar a la siguiente.",
      "Las variables se suelen llamar `i` y `j`. Con dos bucles anidados eso todavía se entiende; si algún día metes tres, ponles nombres de verdad.",
      "Todo lo que sea dibujar con asteriscos, tablas o matrices sale de aquí. Y también es donde más se nota la sangría: con los bloques bien escalonados se ve enseguida qué pertenece a qué.",
    ],
    examples: [
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        for (int fila = 1; fila <= 3; fila++)
        {
            for (int columna = 1; columna <= 4; columna++)
            {
                Console.Write("*");
            }
            Console.WriteLine();
        }
    }
}`,
        note: "Un rectángulo de 3 por 4. El `Console.WriteLine()` vacío, el de después del bucle de adentro, es el que corta la fila.",
      },
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        for (int fila = 1; fila <= 4; fila++)
        {
            for (int columna = 1; columna <= fila; columna++)
            {
                Console.Write("*");
            }
            Console.WriteLine();
        }
    }
}`,
        note: "Aquí el bucle de adentro depende de `fila`, así que cada fila sale más larga que la anterior. Ese es el truco de casi todos los dibujos.",
      },
    ],
    exercise: {
      prompt:
        "Lee un número `n` e imprime un cuadrado de `n` por `n` hecho con asteriscos, sin espacios.",
      cases: [
        { stdin: "3", expected: "***\n***\n***" },
        { stdin: "1", expected: "*" },
        { stdin: "4", expected: "****\n****\n****\n****" },
      ],
      hint: "Dos `for` anidados, los dos de 1 a `n`. El de adentro imprime con `Write` y al salir va un `WriteLine()` vacío.",
      solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());

        for (int fila = 1; fila <= n; fila++)
        {
            for (int columna = 1; columna <= n; columna++)
            {
                Console.Write("*");
            }
            Console.WriteLine();
        }
    }
}`,
    },
  },

  // ------------------------------------------------------- Guardar varios
  {
    slug: "cs-arreglos",
    sectionSlug: "cs-guardar-varios",
    language: "csharp",
    title: "Arreglos",
    summary: "Muchos datos del mismo tipo bajo un solo nombre.",
    body: [
      "Cuando necesitas guardar cinco notas, no creas cinco variables: creas un arreglo. `int[] notas = new int[5];` reserva cinco cajas de enteros.",
      "Las posiciones empiezan en 0. En un arreglo de 5, la primera es `notas[0]` y la última es `notas[4]`. Pedir `notas[5]` lanza `IndexOutOfRangeException`, y es de los errores que más se repiten al empezar.",
      "`notas.Length` dice cuántas cajas tiene. Con eso, el bucle para recorrerlo se escribe siempre igual: `for (int i = 0; i < notas.Length; i++)`. Fíjate que es `<` y no `<=`, justo porque la última posición es `Length - 1`.",
      "Si solo vas a leer los valores y no te importa la posición, `foreach (int nota in notas)` es más corto y más claro.",
    ],
    examples: [
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        int[] notas = { 90, 75, 88 };

        for (int i = 0; i < notas.Length; i++)
        {
            Console.WriteLine($"posicion {i}: {notas[i]}");
        }
    }
}`,
        note: "Así se crea un arreglo con valores ya puestos. Prueba a pedir `notas[3]` y mira el error que sale.",
      },
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        int cuantos = int.Parse(Console.ReadLine());
        int[] numeros = new int[cuantos];

        for (int i = 0; i < cuantos; i++)
        {
            numeros[i] = int.Parse(Console.ReadLine());
        }

        int suma = 0;
        foreach (int numero in numeros)
        {
            suma += numero;
        }
        Console.WriteLine(suma);
    }
}`,
        stdin: "3\n10\n20\n30",
        note: "Un bucle para llenar y otro para recorrer. El segundo es `foreach`, porque ahí la posición no hace falta.",
      },
    ],
    exercise: {
      prompt:
        "La primera línea dice cuántos números vienen, y después llega cada uno en su línea. Guárdalos en un arreglo e imprime el mayor.",
      cases: [
        { stdin: "3\n4\n9\n2", expected: "9" },
        { stdin: "1\n-5", expected: "-5" },
        { stdin: "4\n-3\n-1\n-7\n-2", expected: "-1" },
      ],
      hint: "No empieces el mayor en 0: si todos fueran negativos, ganaría el 0. Empiézalo con el primer elemento del arreglo.",
      solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int cuantos = int.Parse(Console.ReadLine());
        int[] numeros = new int[cuantos];

        for (int i = 0; i < cuantos; i++)
        {
            numeros[i] = int.Parse(Console.ReadLine());
        }

        int mayor = numeros[0];
        foreach (int numero in numeros)
        {
            if (numero > mayor)
            {
                mayor = numero;
            }
        }
        Console.WriteLine(mayor);
    }
}`,
    },
  },
  {
    slug: "cs-strings",
    sectionSlug: "cs-guardar-varios",
    language: "csharp",
    title: "Trabajar con texto",
    summary: "Un `string` por dentro es una hilera de caracteres.",
    body: [
      "Un `string` se parece más a un arreglo de lo que uno cree: `texto.Length` dice cuántos caracteres tiene, y `texto[0]` es el primero. También se puede recorrer con `foreach (char c in texto)`.",
      'Lo que más se usa: `ToUpper()` y `ToLower()` cambian la caja, `Contains("algo")` dice si aparece dentro, `Replace("a", "b")` cambia lo que le digas, y `Substring(2, 3)` saca un pedazo.',
      "`Split(' ')` parte una línea en pedazos por donde tú digas, y devuelve un arreglo. Es lo que se usa cuando llegan varios datos en la misma línea. Para volver a juntarlos, `string.Join(\" \", pedazos)`.",
      "Ojo con una cosa: en C# los `string` no se modifican. `texto.ToUpper()` no cambia `texto`, DEVUELVE uno nuevo en mayúsculas. Si no guardas lo que devuelve, no pasó nada.",
    ],
    examples: [
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        string texto = Console.ReadLine();

        Console.WriteLine(texto.Length);
        Console.WriteLine(texto.ToUpper());
        Console.WriteLine(texto[0]);
    }
}`,
        stdin: "code battle",
        note: "Fíjate que el espacio también cuenta como carácter en el `Length`.",
      },
      {
        code: String.raw`using System;

class Program
{
    static void Main()
    {
        string[] partes = Console.ReadLine().Split(' ');

        Console.WriteLine(partes.Length);
        foreach (string parte in partes)
        {
            Console.WriteLine(parte);
        }
    }
}`,
        stdin: "uno dos tres",
        note: "`Split` devuelve un arreglo, así que de aquí en adelante se trata como cualquier otro arreglo.",
      },
    ],
    exercise: {
      prompt:
        "Lee una línea de texto e imprime en la primera línea cuántos caracteres tiene, y en la segunda el mismo texto en mayúsculas.",
      cases: [
        { stdin: "hola", expected: "4\nHOLA" },
        { stdin: "code battle", expected: "11\nCODE BATTLE" },
        { stdin: "a", expected: "1\nA" },
      ],
      hint: "`Length` para lo primero y `ToUpper()` para lo segundo. Acuérdate de que `ToUpper` devuelve el texto nuevo.",
      solution: String.raw`using System;

class Program
{
    static void Main()
    {
        string texto = Console.ReadLine();
        Console.WriteLine(texto.Length);
        Console.WriteLine(texto.ToUpper());
    }
}`,
    },
  },
  {
    slug: "cs-listas",
    sectionSlug: "cs-guardar-varios",
    language: "csharp",
    title: "Listas",
    summary: "Como un arreglo, pero que crece.",
    body: [
      "Un arreglo nace con un tamaño y ahí se queda. Cuando no sabes cuántos datos van a llegar, lo que sirve es una `List`.",
      "Se crea con `List<int> numeros = new List<int>();`. Lo de las llaves angulares dice qué guarda: `List<int>` para enteros, `List<string>` para texto.",
      "`Add` agrega al final, `Count` dice cuántos hay (en el arreglo era `Length`, aquí es `Count`), y se recorre igual, con `for` o con `foreach`.",
      "Para usarla hace falta `using System.Collections.Generic;` arriba, aunque en los proyectos nuevos de Visual Studio eso ya viene puesto sin que se vea.",
    ],
    examples: [
      {
        code: String.raw`using System;
using System.Collections.Generic;

class Program
{
    static void Main()
    {
        List<string> compras = new List<string>();

        compras.Add("arroz");
        compras.Add("habichuelas");

        Console.WriteLine(compras.Count);
        foreach (string producto in compras)
        {
            Console.WriteLine(producto);
        }
    }
}`,
        note: "La lista empieza vacía y crece con cada `Add`. Agrega otro producto y ejecuta.",
      },
      {
        code: String.raw`using System;
using System.Collections.Generic;

class Program
{
    static void Main()
    {
        List<int> numeros = new List<int>();
        string linea = Console.ReadLine();

        while (linea != "fin")
        {
            numeros.Add(int.Parse(linea));
            linea = Console.ReadLine();
        }
        Console.WriteLine(numeros.Count);
    }
}`,
        stdin: "4\n8\n15\nfin",
        note: "Aquí se ve para qué sirve una lista: no sabemos cuántos números van a llegar hasta que aparece el `fin`.",
      },
    ],
    exercise: {
      prompt:
        "Lee números, uno por línea, hasta una línea que diga `fin`. Imprime cuántos llegaron y en la línea siguiente el mayor. Si no llegó ninguno, imprime `0` y después `no hay`.",
      cases: [
        { stdin: "4\n8\n15\nfin", expected: "3\n15" },
        { stdin: "fin", expected: "0\nno hay" },
        { stdin: "-2\n-9\nfin", expected: "2\n-2" },
      ],
      hint: "Guarda todo en una `List<int>` y después decide. Con `Count == 0` sabes si no llegó ninguno.",
      solution: String.raw`using System;
using System.Collections.Generic;

class Program
{
    static void Main()
    {
        List<int> numeros = new List<int>();
        string linea = Console.ReadLine();

        while (linea != "fin")
        {
            numeros.Add(int.Parse(linea));
            linea = Console.ReadLine();
        }

        Console.WriteLine(numeros.Count);

        if (numeros.Count == 0)
        {
            Console.WriteLine("no hay");
        }
        else
        {
            int mayor = numeros[0];
            foreach (int numero in numeros)
            {
                if (numero > mayor)
                {
                    mayor = numero;
                }
            }
            Console.WriteLine(mayor);
        }
    }
}`,
    },
  },

  // ------------------------------------------------------------- Organizar
  {
    slug: "cs-metodos",
    sectionSlug: "cs-organizar",
    language: "csharp",
    title: "Métodos",
    summary: "Ponerle nombre a un pedazo de código para no repetirlo.",
    body: [
      "Un método es un pedazo de código con nombre. Se escribe una vez y se llama las veces que haga falta, con datos distintos cada vez.",
      "En la firma va todo: `static int Doble(int n)` dice que devuelve un `int`, que se llama `Doble` y que recibe un `int`. Lo que recibe se llama parámetro, y dentro del método se usa como una variable normal.",
      "`return` devuelve el resultado y termina el método ahí mismo. Si un método no devuelve nada, su tipo es `void`, y entonces no lleva `return` (o lleva uno pelado para salir antes).",
      "Los métodos van dentro de la clase, al lado de `Main`, no dentro de `Main`. Llevan `static` por la misma razón que `Main`: se pueden llamar sin crear un objeto, y eso es lo que toca hasta la próxima lección.",
    ],
    examples: [
      {
        code: String.raw`using System;

class Program
{
    static int Doble(int n)
    {
        return n * 2;
    }

    static void Main()
    {
        Console.WriteLine(Doble(5));
        Console.WriteLine(Doble(21));
    }
}`,
        note: "Un método escrito una vez y llamado dos, con valores distintos. Agrégale una tercera llamada.",
      },
      {
        code: String.raw`using System;

class Program
{
    static bool EsPar(int n)
    {
        return n % 2 == 0;
    }

    static void Main()
    {
        int numero = int.Parse(Console.ReadLine());

        if (EsPar(numero))
        {
            Console.WriteLine("par");
        }
        else
        {
            Console.WriteLine("impar");
        }
    }
}`,
        stdin: "7",
        note: "Un método que devuelve `bool` se lee casi como una frase: `if (EsPar(numero))`. Por eso conviene ponerles nombres que se lean.",
      },
    ],
    exercise: {
      prompt:
        "Escribe un método `Cuadrado` que reciba un entero y devuelva su cuadrado. Lee tres números, uno por línea, e imprime el cuadrado de cada uno, uno por línea.",
      cases: [
        { stdin: "2\n3\n4", expected: "4\n9\n16" },
        { stdin: "0\n-5\n10", expected: "0\n25\n100" },
        { stdin: "1\n1\n1", expected: "1\n1\n1" },
      ],
      hint: "El método va fuera de `Main` pero dentro de la clase, con `static int Cuadrado(int n)`.",
      solution: String.raw`using System;

class Program
{
    static int Cuadrado(int n)
    {
        return n * n;
    }

    static void Main()
    {
        for (int i = 0; i < 3; i++)
        {
            int numero = int.Parse(Console.ReadLine());
            Console.WriteLine(Cuadrado(numero));
        }
    }
}`,
    },
  },
  {
    slug: "cs-clases",
    sectionSlug: "cs-organizar",
    language: "csharp",
    title: "Clases y objetos",
    summary: "Juntar datos y lo que se hace con ellos en un mismo sitio.",
    body: [
      "Hasta aquí, para guardar un estudiante harían falta dos variables sueltas, el nombre y la nota, y recordar que van juntas. Una clase es lo que las junta de verdad.",
      "La clase es el molde y el objeto es la pieza hecha con ese molde. `Estudiante ana = new Estudiante();` crea un objeto. De un mismo molde salen los que quieras, cada uno con sus propios valores.",
      "Dentro de la clase van las propiedades, que son los datos (`public string Nombre { get; set; }`), y los métodos, que es lo que ese objeto sabe hacer (`public bool Aprobo()`). Un método de la clase usa sus propias propiedades sin recibirlas por parámetro.",
      "El constructor es un método especial que se llama al crear el objeto, se llama igual que la clase y no declara tipo de retorno. Sirve para que un objeto no nazca a medio llenar.",
    ],
    examples: [
      {
        code: String.raw`using System;

class Estudiante
{
    public string Nombre { get; set; }
    public int Nota { get; set; }

    public bool Aprobo()
    {
        return Nota >= 70;
    }
}

class Program
{
    static void Main()
    {
        Estudiante ana = new Estudiante();
        ana.Nombre = "Ana";
        ana.Nota = 85;

        Console.WriteLine(ana.Nombre);
        Console.WriteLine(ana.Aprobo());
    }
}`,
        note: "`Aprobo()` no recibe la nota: la saca de su propio objeto. Crea un segundo estudiante con otra nota y verás que cada uno responde por lo suyo.",
      },
      {
        code: String.raw`using System;

class Estudiante
{
    public string Nombre { get; set; }
    public int Nota { get; set; }

    public Estudiante(string nombre, int nota)
    {
        Nombre = nombre;
        Nota = nota;
    }
}

class Program
{
    static void Main()
    {
        Estudiante luis = new Estudiante("Luis", 92);
        Console.WriteLine($"{luis.Nombre} saco {luis.Nota}");
    }
}`,
        note: "Con constructor, el objeto nace completo en una sola línea. Intenta crear uno sin pasarle los datos y mira lo que dice el compilador.",
      },
    ],
    exercise: {
      prompt:
        "Haz una clase `Estudiante` con nombre y nota. Lee un nombre y una nota, crea el objeto, e imprime `nombre: aprobado` si la nota es 70 o más, o `nombre: reprobado` si no.",
      cases: [
        { stdin: "Ana\n85", expected: "Ana: aprobado" },
        { stdin: "Luis\n60", expected: "Luis: reprobado" },
        { stdin: "Pedro\n70", expected: "Pedro: aprobado" },
      ],
      hint: "La clase va fuera de `Program`. Dale un método que devuelva `bool` y úsalo en un `if` desde `Main`.",
      solution: String.raw`using System;

class Estudiante
{
    public string Nombre { get; set; }
    public int Nota { get; set; }

    public bool Aprobo()
    {
        return Nota >= 70;
    }
}

class Program
{
    static void Main()
    {
        Estudiante estudiante = new Estudiante();
        estudiante.Nombre = Console.ReadLine();
        estudiante.Nota = int.Parse(Console.ReadLine());

        if (estudiante.Aprobo())
        {
            Console.WriteLine($"{estudiante.Nombre}: aprobado");
        }
        else
        {
            Console.WriteLine($"{estudiante.Nombre}: reprobado");
        }
    }
}`,
    },
  },
];
