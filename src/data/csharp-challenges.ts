/**
 * Banco de retos de C# para la práctica solo.
 *
 * Vive en el repo y no en la base, a diferencia de los de regex y KQL. Esos
 * alimentan el 1v1, donde el servidor corrige para que nadie haga trampa. C#
 * no va al 1v1: se corrige en el navegador de quien practica, y ahí no hay nada
 * que proteger. Así sumar un reto no necesita una migración.
 *
 * Un reto de C# es un programa de consola: lee con `Console.ReadLine`, una
 * línea por dato, e imprime el resultado. Cada caso de prueba es una entrada
 * con la salida que tiene que dar. El primero se enseña como ejemplo; los
 * demás se comprueban sin enseñarlos, para que no se pueda escribir la
 * respuesta a mano.
 *
 * `npm run verify:csharp` compila cada `solution` con el mismo compilador del
 * navegador y la corre contra sus casos. Un reto con la solución mal no llega
 * a nadie.
 *
 * El orden de los niveles es el de una materia de Programación: entrada y
 * salida, condicionales, bucles, arreglos y texto, y algoritmos.
 */
import type { CSharpCase } from "@/features/csharp/grade";

export interface CSharpChallenge {
  slug: string;
  difficulty: number;
  title: string;
  /** El enunciado. El código va entre acentos graves y se pinta como código. */
  prompt: string;
  /** El primero se enseña como ejemplo; el resto se comprueba sin enseñarlo. */
  cases: CSharpCase[];
  hint: string;
  /** Referencia, verificada por verify:csharp. Solo se enseña si el jugador se rinde. */
  solution: string;
}

/** Un caso de prueba. La entrada va con un dato por línea, igual que se lee. */
const caso = (stdin: string, expected: string): CSharpCase => ({ stdin, expected });

const contarHasta = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1)).join("\n");

const tabla = (n: number) =>
  Array.from({ length: 10 }, (_, i) => `${n} x ${i + 1} = ${n * (i + 1)}`).join("\n");

const cuentaRegresiva = (n: number) =>
  [...Array.from({ length: n }, (_, i) => String(n - i)), "Despegue!"].join("\n");

const piramide = (n: number) =>
  Array.from({ length: n }, (_, i) => " ".repeat(n - i - 1) + "*".repeat(2 * i + 1)).join("\n");

export const CSHARP_CHALLENGES: CSharpChallenge[] = [
  // --------------------------------------------------- Nivel 1: entrada y salida
  {
    slug: "cs-saludo",
    difficulty: 1,
    title: "Saludo",
    prompt: "Lee un nombre y saluda con el formato `Hola, nombre!`.",
    cases: [
      caso("DeLuna", "Hola, DeLuna!"),
      caso("Ana", "Hola, Ana!"),
      caso("Juan Pablo", "Hola, Juan Pablo!"),
    ],
    hint: '`Console.ReadLine()` te da el nombre como `string`. Júntalo con `+` o con `$"..."`.',
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        string nombre = Console.ReadLine();
        Console.WriteLine("Hola, " + nombre + "!");
    }
}`,
  },
  {
    slug: "cs-doble",
    difficulty: 1,
    title: "El doble",
    prompt: "Lee un número entero e imprime su doble.",
    cases: [caso("21", "42"), caso("-5", "-10"), caso("0", "0")],
    hint: "Lo que lee `Console.ReadLine()` es texto. Conviértelo con `int.Parse` antes de multiplicar.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        Console.WriteLine(n * 2);
    }
}`,
  },
  {
    slug: "cs-suma-dos",
    difficulty: 1,
    title: "Suma de dos",
    prompt: "Lee dos números enteros, uno por línea, e imprime su suma.",
    cases: [caso("2\n3", "5"), caso("10\n-4", "6"), caso("-7\n-8", "-15")],
    hint: "Llama a `Console.ReadLine()` dos veces: cada llamada lee una línea.",
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
  {
    slug: "cs-area-rectangulo",
    difficulty: 1,
    title: "Área del rectángulo",
    prompt: "Lee la base y la altura de un rectángulo, dos enteros, e imprime su área.",
    cases: [caso("4\n5", "20"), caso("10\n1", "10"), caso("0\n9", "0")],
    hint: "El área es base por altura.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int baseRect = int.Parse(Console.ReadLine());
        int altura = int.Parse(Console.ReadLine());
        Console.WriteLine(baseRect * altura);
    }
}`,
  },
  {
    slug: "cs-edad-en-meses",
    difficulty: 1,
    title: "Edad en meses",
    prompt: "Lee una edad en años e imprime cuántos meses son.",
    cases: [caso("19", "228"), caso("1", "12"), caso("0", "0")],
    hint: "Un año tiene 12 meses.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int anios = int.Parse(Console.ReadLine());
        Console.WriteLine(anios * 12);
    }
}`,
  },
  {
    slug: "cs-dolares-a-pesos",
    difficulty: 1,
    title: "Dólares a pesos",
    prompt:
      "Lee una cantidad de dólares, un entero, e imprime cuántos pesos dominicanos son con una tasa de 60 pesos por dólar.",
    cases: [caso("10", "600"), caso("1", "60"), caso("0", "0"), caso("250", "15000")],
    hint: "Multiplica por la tasa. Guárdala en una variable con nombre, que se lee mejor que un 60 suelto.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        const int tasa = 60;
        int dolares = int.Parse(Console.ReadLine());
        Console.WriteLine(dolares * tasa);
    }
}`,
  },
  {
    slug: "cs-promedio-entero",
    difficulty: 1,
    title: "Promedio entero",
    prompt:
      "Lee tres enteros e imprime la parte entera de su promedio. Si el promedio es 81.67, se imprime `81`.",
    cases: [
      caso("7\n8\n9", "8"),
      caso("10\n10\n11", "10"),
      caso("90\n85\n70", "81"),
      caso("0\n0\n1", "0"),
    ],
    hint: "Si sumas tres `int` y divides entre `3`, C# hace división entera y ya descarta los decimales.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int a = int.Parse(Console.ReadLine());
        int b = int.Parse(Console.ReadLine());
        int c = int.Parse(Console.ReadLine());
        Console.WriteLine((a + b + c) / 3);
    }
}`,
  },
  {
    slug: "cs-apellido-primero",
    difficulty: 1,
    title: "Apellido primero",
    prompt:
      "Lee un nombre y después un apellido, uno por línea, e imprímelos como en una lista de clase: `Apellido, Nombre`.",
    cases: [
      caso("Cristian\nDe Luna", "De Luna, Cristian"),
      caso("Ana\nPerez", "Perez, Ana"),
      caso("Luis\nGarcia", "Garcia, Luis"),
    ],
    hint: "Lee los dos en variables separadas y júntalos en otro orden.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        string nombre = Console.ReadLine();
        string apellido = Console.ReadLine();
        Console.WriteLine(apellido + ", " + nombre);
    }
}`,
  },
  {
    slug: "cs-precio-con-itbis",
    difficulty: 1,
    title: "Precio con ITBIS",
    prompt:
      "Lee un precio entero sin impuestos e imprime el total con el 18 % de ITBIS, con dos decimales y punto decimal.",
    cases: [caso("100", "118.00"), caso("250", "295.00"), caso("99", "116.82"), caso("0", "0.00")],
    hint: 'Multiplica por `1.18` y formatea con `.ToString("F2")`, que deja siempre dos decimales.',
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        decimal precio = decimal.Parse(Console.ReadLine());
        decimal total = precio * 1.18m;
        Console.WriteLine(total.ToString("F2"));
    }
}`,
  },
  {
    slug: "cs-antecesor-sucesor",
    difficulty: 1,
    title: "Antecesor y sucesor",
    prompt:
      "Lee un entero e imprime en una línea el número que va antes y en la siguiente el que va después.",
    cases: [caso("5", "4\n6"), caso("0", "-1\n1"), caso("-10", "-11\n-9")],
    hint: "Dos `Console.WriteLine`, uno con `n - 1` y otro con `n + 1`.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        Console.WriteLine(n - 1);
        Console.WriteLine(n + 1);
    }
}`,
  },

  // --------------------------------------------------- Nivel 2: condicionales
  {
    slug: "cs-par-o-impar",
    difficulty: 2,
    title: "Par o impar",
    prompt: "Lee un entero e imprime `par` o `impar`.",
    cases: [caso("4", "par"), caso("7", "impar"), caso("0", "par"), caso("-3", "impar")],
    hint: "Usa el resto de dividir entre 2 con `%`. Ojo: en C#, `-3 % 2` da `-1`, no `1`.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        if (n % 2 == 0)
        {
            Console.WriteLine("par");
        }
        else
        {
            Console.WriteLine("impar");
        }
    }
}`,
  },
  {
    slug: "cs-mayor-de-dos",
    difficulty: 2,
    title: "El mayor de dos",
    prompt: "Lee dos enteros e imprime el mayor. Si son iguales, imprime ese número.",
    cases: [caso("3\n8", "8"), caso("10\n2", "10"), caso("-1\n-5", "-1"), caso("7\n7", "7")],
    hint: "Un `if` que compare los dos con `>`.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int a = int.Parse(Console.ReadLine());
        int b = int.Parse(Console.ReadLine());
        if (a > b)
        {
            Console.WriteLine(a);
        }
        else
        {
            Console.WriteLine(b);
        }
    }
}`,
  },
  {
    slug: "cs-aprobado",
    difficulty: 2,
    title: "¿Aprobé?",
    prompt: "Lee una nota de 0 a 100 e imprime `aprobado` si es 70 o más, y `reprobado` si no.",
    cases: [
      caso("70", "aprobado"),
      caso("69", "reprobado"),
      caso("100", "aprobado"),
      caso("0", "reprobado"),
    ],
    hint: "El 70 aprueba: la comparación es `>=`, no `>`.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int nota = int.Parse(Console.ReadLine());
        Console.WriteLine(nota >= 70 ? "aprobado" : "reprobado");
    }
}`,
  },
  {
    slug: "cs-signo",
    difficulty: 2,
    title: "Positivo, negativo o cero",
    prompt: "Lee un entero e imprime `positivo`, `negativo` o `cero`.",
    cases: [caso("5", "positivo"), caso("-2", "negativo"), caso("0", "cero")],
    hint: "Con tres posibilidades hace falta `if`, `else if` y `else`.",
    solution: String.raw`using System;

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
  },
  {
    slug: "cs-dia-de-la-semana",
    difficulty: 2,
    title: "Día de la semana",
    prompt:
      "Lee un número del 1 al 7 e imprime el día en minúsculas y sin tildes, empezando por `lunes`. Cualquier otro número imprime `invalido`.",
    cases: [
      caso("1", "lunes"),
      caso("3", "miercoles"),
      caso("7", "domingo"),
      caso("9", "invalido"),
      caso("0", "invalido"),
    ],
    hint: "Es el caso de libro para un `switch`, con un `default` para lo que no es un día.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int dia = int.Parse(Console.ReadLine());
        switch (dia)
        {
            case 1: Console.WriteLine("lunes"); break;
            case 2: Console.WriteLine("martes"); break;
            case 3: Console.WriteLine("miercoles"); break;
            case 4: Console.WriteLine("jueves"); break;
            case 5: Console.WriteLine("viernes"); break;
            case 6: Console.WriteLine("sabado"); break;
            case 7: Console.WriteLine("domingo"); break;
            default: Console.WriteLine("invalido"); break;
        }
    }
}`,
  },
  {
    slug: "cs-mayor-de-tres",
    difficulty: 2,
    title: "El mayor de tres",
    prompt: "Lee tres enteros e imprime el mayor.",
    cases: [
      caso("1\n2\n3", "3"),
      caso("9\n4\n6", "9"),
      caso("5\n12\n7", "12"),
      caso("-3\n-1\n-2", "-1"),
    ],
    hint: "Guarda el primero como el mayor, y cámbialo si alguno de los otros lo supera.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int a = int.Parse(Console.ReadLine());
        int b = int.Parse(Console.ReadLine());
        int c = int.Parse(Console.ReadLine());
        int mayor = a;
        if (b > mayor) mayor = b;
        if (c > mayor) mayor = c;
        Console.WriteLine(mayor);
    }
}`,
  },
  {
    slug: "cs-bisiesto",
    difficulty: 2,
    title: "Año bisiesto",
    prompt:
      "Lee un año e imprime `si` si es bisiesto y `no` si no. Es bisiesto si es divisible entre 4, salvo los divisibles entre 100, que solo lo son si además son divisibles entre 400.",
    cases: [caso("2024", "si"), caso("1900", "no"), caso("2000", "si"), caso("2023", "no")],
    hint: "Se escribe en una sola condición con `&&` y `||`. Prueba con 1900 y con 2000, que son los que engañan.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int anio = int.Parse(Console.ReadLine());
        bool bisiesto = (anio % 4 == 0 && anio % 100 != 0) || anio % 400 == 0;
        Console.WriteLine(bisiesto ? "si" : "no");
    }
}`,
  },
  {
    slug: "cs-reloj",
    difficulty: 2,
    title: "Segundos a reloj",
    prompt:
      "Lee una cantidad de segundos, menos de un día, e imprímela como reloj `HH:MM:SS`, con dos cifras en cada parte.",
    cases: [
      caso("3661", "01:01:01"),
      caso("0", "00:00:00"),
      caso("86399", "23:59:59"),
      caso("59", "00:00:59"),
    ],
    hint: 'Divide entre 3600 para las horas y usa `%` para lo que sobra. `.ToString("D2")` rellena con un cero delante.',
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int total = int.Parse(Console.ReadLine());
        int horas = total / 3600;
        int minutos = total % 3600 / 60;
        int segundos = total % 60;
        Console.WriteLine(horas.ToString("D2") + ":" + minutos.ToString("D2") + ":" + segundos.ToString("D2"));
    }
}`,
  },
  {
    slug: "cs-letra-de-nota",
    difficulty: 2,
    title: "Nota en letra",
    prompt:
      "Lee una nota de 0 a 100 e imprime su letra: `A` de 90 para arriba, `B` de 80, `C` de 70 y `F` por debajo de 70.",
    cases: [caso("95", "A"), caso("80", "B"), caso("79", "C"), caso("70", "C"), caso("69", "F")],
    hint: "Pregunta de la nota más alta a la más baja. Así cada `else if` ya sabe que no llegó a la anterior.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int nota = int.Parse(Console.ReadLine());
        if (nota >= 90) Console.WriteLine("A");
        else if (nota >= 80) Console.WriteLine("B");
        else if (nota >= 70) Console.WriteLine("C");
        else Console.WriteLine("F");
    }
}`,
  },
  {
    slug: "cs-tipo-de-triangulo",
    difficulty: 2,
    title: "Tipo de triángulo",
    prompt:
      "Lee los tres lados de un triángulo e imprime `equilatero` si son iguales, `isosceles` si dos son iguales y `escaleno` si los tres son distintos.",
    cases: [
      caso("3\n3\n3", "equilatero"),
      caso("3\n3\n5", "isosceles"),
      caso("3\n4\n5", "escaleno"),
      caso("5\n3\n5", "isosceles"),
    ],
    hint: "El isósceles puede tener los lados iguales en cualquier posición: compara las tres parejas.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int a = int.Parse(Console.ReadLine());
        int b = int.Parse(Console.ReadLine());
        int c = int.Parse(Console.ReadLine());
        if (a == b && b == c) Console.WriteLine("equilatero");
        else if (a == b || b == c || a == c) Console.WriteLine("isosceles");
        else Console.WriteLine("escaleno");
    }
}`,
  },

  // --------------------------------------------------------- Nivel 3: bucles
  {
    slug: "cs-contar-hasta-n",
    difficulty: 3,
    title: "Contar hasta n",
    prompt: "Lee un entero `n` e imprime los números del 1 al `n`, uno por línea.",
    cases: [caso("3", contarHasta(3)), caso("1", contarHasta(1)), caso("5", contarHasta(5))],
    hint: "Un `for` que empiece en 1 y llegue hasta `n` incluido: la condición es `<=`.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        for (int i = 1; i <= n; i++)
        {
            Console.WriteLine(i);
        }
    }
}`,
  },
  {
    slug: "cs-tabla-de-multiplicar",
    difficulty: 3,
    title: "Tabla de multiplicar",
    prompt:
      "Lee un número e imprime su tabla del 1 al 10, una línea por multiplicación, con el formato `7 x 3 = 21`.",
    cases: [caso("7", tabla(7)), caso("1", tabla(1)), caso("12", tabla(12))],
    hint: "Un `for` del 1 al 10, y en cada vuelta imprime la multiplicación con los espacios justos.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        for (int i = 1; i <= 10; i++)
        {
            Console.WriteLine(n + " x " + i + " = " + (n * i));
        }
    }
}`,
  },
  {
    slug: "cs-suma-hasta-n",
    difficulty: 3,
    title: "Suma hasta n",
    prompt: "Lee un entero `n` e imprime la suma de 1 + 2 + ... + `n`. Si `n` es 0, la suma es 0.",
    cases: [caso("10", "55"), caso("1", "1"), caso("100", "5050"), caso("0", "0")],
    hint: "Un acumulador: una variable que empieza en 0 y en cada vuelta suma el número de esa vuelta.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        int suma = 0;
        for (int i = 1; i <= n; i++)
        {
            suma += i;
        }
        Console.WriteLine(suma);
    }
}`,
  },
  {
    slug: "cs-factorial",
    difficulty: 3,
    title: "Factorial",
    prompt:
      "Lee un entero del 0 al 20 e imprime su factorial. El factorial de 0 es 1. Ojo con el tamaño: el de 20 no cabe en un `int`.",
    cases: [caso("5", "120"), caso("0", "1"), caso("1", "1"), caso("20", "2432902008176640000")],
    hint: "Usa `long` para el resultado, y empieza a multiplicar desde 1, no desde 0.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        long factorial = 1;
        for (int i = 2; i <= n; i++)
        {
            factorial *= i;
        }
        Console.WriteLine(factorial);
    }
}`,
  },
  {
    slug: "cs-cuenta-regresiva",
    difficulty: 3,
    title: "Cuenta regresiva",
    prompt:
      "Lee un entero positivo `n` e imprime la cuenta regresiva desde `n` hasta 1, uno por línea, y al final `Despegue!`.",
    cases: [
      caso("3", cuentaRegresiva(3)),
      caso("1", cuentaRegresiva(1)),
      caso("5", cuentaRegresiva(5)),
    ],
    hint: "Un `for` que empiece en `n` y vaya bajando con `i--`. El `Despegue!` va después del bucle, no dentro.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        for (int i = n; i >= 1; i--)
        {
            Console.WriteLine(i);
        }
        Console.WriteLine("Despegue!");
    }
}`,
  },
  {
    slug: "cs-sumar-hasta-cero",
    difficulty: 3,
    title: "Sumar hasta el cero",
    prompt:
      "Lee enteros, uno por línea, hasta que llegue un 0. Imprime la suma de todos los que llegaron antes del 0.",
    cases: [caso("5\n3\n0", "8"), caso("0", "0"), caso("10\n-4\n2\n0", "8")],
    hint: "Aquí no sabes cuántas vueltas son, así que es un `while` y no un `for`.",
    solution: String.raw`using System;

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
  },
  {
    slug: "cs-contar-digitos",
    difficulty: 3,
    title: "Contar dígitos",
    prompt:
      "Lee un entero no negativo e imprime cuántos dígitos tiene, sin convertirlo a texto. El 0 tiene un dígito.",
    cases: [caso("12345", "5"), caso("0", "1"), caso("7", "1"), caso("1000", "4")],
    hint: "Divide entre 10 hasta que llegue a 0 y cuenta las vueltas. El 0 hay que tratarlo aparte.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        int digitos = 0;
        do
        {
            digitos++;
            n /= 10;
        } while (n > 0);
        Console.WriteLine(digitos);
    }
}`,
  },
  {
    slug: "cs-invertir-numero",
    difficulty: 3,
    title: "Invertir un número",
    prompt:
      "Lee un entero no negativo e imprímelo al revés, como número. `1200` al revés es `21`, sin ceros delante.",
    cases: [caso("1234", "4321"), caso("1200", "21"), caso("7", "7"), caso("0", "0")],
    hint: "`n % 10` te da el último dígito y `n / 10` lo quita. Ve armando el invertido multiplicando por 10.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        int invertido = 0;
        while (n > 0)
        {
            invertido = invertido * 10 + n % 10;
            n /= 10;
        }
        Console.WriteLine(invertido);
    }
}`,
  },
  {
    slug: "cs-piramide",
    difficulty: 3,
    title: "Pirámide de asteriscos",
    prompt:
      "Lee un entero `n` y dibuja una pirámide de `n` filas centrada con asteriscos. La fila `i` tiene `n - i` espacios delante y `2i - 1` asteriscos. Los espacios de delante cuentan.",
    cases: [caso("3", piramide(3)), caso("1", piramide(1)), caso("4", piramide(4))],
    hint: "Un `for` para las filas y, dentro, uno para los espacios y otro para los asteriscos. `new string('*', k)` también sirve.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        for (int i = 1; i <= n; i++)
        {
            Console.WriteLine(new string(' ', n - i) + new string('*', 2 * i - 1));
        }
    }
}`,
  },
  {
    slug: "cs-es-primo",
    difficulty: 3,
    title: "¿Es primo?",
    prompt:
      "Lee un entero positivo e imprime `primo` si solo se divide entre 1 y entre sí mismo, y `no primo` si no. El 1 no es primo.",
    cases: [
      caso("7", "primo"),
      caso("1", "no primo"),
      caso("2", "primo"),
      caso("9", "no primo"),
      caso("97", "primo"),
    ],
    hint: "Busca un divisor entre 2 y `n - 1`. En cuanto encuentres uno ya sabes la respuesta.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        bool primo = n >= 2;
        for (int i = 2; i * i <= n; i++)
        {
            if (n % i == 0)
            {
                primo = false;
                break;
            }
        }
        Console.WriteLine(primo ? "primo" : "no primo");
    }
}`,
  },

  // ---------------------------------------------- Nivel 4: arreglos y texto
  {
    slug: "cs-mayor-de-la-lista",
    difficulty: 4,
    title: "El mayor de la lista",
    prompt:
      "La primera línea dice cuántos números vienen, y después llega cada número en su línea. Imprime el mayor.",
    cases: [caso("3\n4\n9\n2", "9"), caso("1\n-5", "-5"), caso("4\n-3\n-1\n-7\n-2", "-1")],
    hint: "No empieces el mayor en 0: si todos son negativos, ganaría el 0. Empiézalo con el primer número.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        int[] numeros = new int[n];
        for (int i = 0; i < n; i++)
        {
            numeros[i] = int.Parse(Console.ReadLine());
        }
        int mayor = numeros[0];
        foreach (int numero in numeros)
        {
            if (numero > mayor) mayor = numero;
        }
        Console.WriteLine(mayor);
    }
}`,
  },
  {
    slug: "cs-promedio-de-notas",
    difficulty: 4,
    title: "Promedio de notas",
    prompt:
      "La primera línea dice cuántas notas vienen, y después llega cada nota en su línea. Imprime el promedio con dos decimales.",
    cases: [
      caso("3\n90\n85\n70", "81.67"),
      caso("1\n100", "100.00"),
      caso("4\n70\n71\n72\n73", "71.50"),
    ],
    hint: "Si sumas en un `int` y divides entre otro `int`, pierdes los decimales. Convierte a `double` antes de dividir.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        int suma = 0;
        for (int i = 0; i < n; i++)
        {
            suma += int.Parse(Console.ReadLine());
        }
        double promedio = (double)suma / n;
        Console.WriteLine(promedio.ToString("F2"));
    }
}`,
  },
  {
    slug: "cs-contar-vocales",
    difficulty: 4,
    title: "Contar vocales",
    prompt:
      "Lee una línea de texto sin tildes e imprime cuántas vocales tiene, sin importar mayúsculas o minúsculas.",
    cases: [
      caso("murcielago", "5"),
      caso("xyz", "0"),
      caso("AEIOU aeiou", "10"),
      caso("Hola Mundo", "4"),
    ],
    hint: 'Recorre el texto con `foreach (char c in texto)` y pregunta si `"aeiou".Contains(char.ToLower(c))`.',
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        string texto = Console.ReadLine();
        int vocales = 0;
        foreach (char c in texto)
        {
            if ("aeiou".Contains(char.ToLower(c))) vocales++;
        }
        Console.WriteLine(vocales);
    }
}`,
  },
  {
    slug: "cs-palindromo",
    difficulty: 4,
    title: "¿Palíndromo?",
    prompt:
      "Lee una frase e imprime `si` si se lee igual al derecho y al revés, sin contar espacios ni mayúsculas, y `no` si no.",
    cases: [
      caso("anita lava la tina", "si"),
      caso("hola", "no"),
      caso("Oso", "si"),
      caso("a", "si"),
    ],
    hint: 'Primero limpia: quita los espacios con `Replace(" ", "")` y pásala a minúsculas. Después compárala con su versión al revés.',
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        string limpio = Console.ReadLine().Replace(" ", "").ToLower();
        char[] letras = limpio.ToCharArray();
        Array.Reverse(letras);
        string alReves = new string(letras);
        Console.WriteLine(limpio == alReves ? "si" : "no");
    }
}`,
  },
  {
    slug: "cs-invertir-texto",
    difficulty: 4,
    title: "Texto al revés",
    prompt: "Lee una línea de texto e imprímela al revés.",
    cases: [caso("hola", "aloh"), caso("ITLA", "ALTI"), caso("a b", "b a")],
    hint: "Recorre el texto desde el último carácter hasta el primero, o usa `ToCharArray` y `Array.Reverse`.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        string texto = Console.ReadLine();
        string alReves = "";
        for (int i = texto.Length - 1; i >= 0; i--)
        {
            alReves += texto[i];
        }
        Console.WriteLine(alReves);
    }
}`,
  },
  {
    slug: "cs-suma-en-una-linea",
    difficulty: 4,
    title: "Suma en una línea",
    prompt: "Llegan varios enteros en UNA sola línea, separados por un espacio. Imprime su suma.",
    cases: [caso("1 2 3", "6"), caso("10", "10"), caso("-5 5 20", "20")],
    hint: "`Split(' ')` corta la línea en pedazos, y cada pedazo se convierte con `int.Parse`.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        string[] partes = Console.ReadLine().Split(' ');
        int suma = 0;
        foreach (string parte in partes)
        {
            suma += int.Parse(parte);
        }
        Console.WriteLine(suma);
    }
}`,
  },
  {
    slug: "cs-ordenar-numeros",
    difficulty: 4,
    title: "Ordenar números",
    prompt:
      "Llegan varios enteros en una línea, separados por un espacio. Imprímelos de menor a mayor en una línea, separados por un espacio.",
    cases: [caso("3 1 2", "1 2 3"), caso("5", "5"), caso("10 -2 7 -2", "-2 -2 7 10")],
    hint: 'Pásalos a un arreglo de `int`, ordénalo con `Array.Sort`, y júntalos con `string.Join(" ", arreglo)`.',
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        string[] partes = Console.ReadLine().Split(' ');
        int[] numeros = new int[partes.Length];
        for (int i = 0; i < partes.Length; i++)
        {
            numeros[i] = int.Parse(partes[i]);
        }
        Array.Sort(numeros);
        Console.WriteLine(string.Join(" ", numeros));
    }
}`,
  },
  {
    slug: "cs-contar-palabras",
    difficulty: 4,
    title: "Contar palabras",
    prompt:
      "Lee una línea e imprime cuántas palabras tiene. Entre palabra y palabra puede haber más de un espacio, y también puede haber espacios al principio y al final.",
    cases: [
      caso("hola mundo", "2"),
      caso("  uno   dos  tres ", "3"),
      caso("palabra", "1"),
      caso("   ", "0"),
    ],
    hint: "`Split` con `StringSplitOptions.RemoveEmptyEntries` tira los pedazos vacíos que dejan los espacios dobles.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        string linea = Console.ReadLine();
        string[] palabras = linea.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        Console.WriteLine(palabras.Length);
    }
}`,
  },
  {
    slug: "cs-iniciales-en-mayuscula",
    difficulty: 4,
    title: "Iniciales en mayúscula",
    prompt:
      "Lee una frase en minúsculas con una sola separación entre palabras, y pon en mayúscula la primera letra de cada palabra.",
    cases: [
      caso("hola mundo", "Hola Mundo"),
      caso("itla es lo mejor", "Itla Es Lo Mejor"),
      caso("a", "A"),
    ],
    hint: "Parte la frase en palabras, a cada una cámbiale la primera letra con `char.ToUpper(palabra[0]) + palabra.Substring(1)`, y vuelve a juntarlas.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        string[] palabras = Console.ReadLine().Split(' ');
        for (int i = 0; i < palabras.Length; i++)
        {
            palabras[i] = char.ToUpper(palabras[i][0]) + palabras[i].Substring(1);
        }
        Console.WriteLine(string.Join(" ", palabras));
    }
}`,
  },
  {
    slug: "cs-segundo-mayor",
    difficulty: 4,
    title: "El segundo mayor",
    prompt:
      "Llegan enteros en una línea, separados por un espacio. Imprime el segundo mayor sin contar repetidos. Si no hay, imprime `no hay`.",
    cases: [caso("4 9 2 9 7", "7"), caso("5 5 5", "no hay"), caso("1 2", "1"), caso("8", "no hay")],
    hint: "Quita los repetidos con `Distinct()`, ordena de mayor a menor, y mira si queda un segundo.",
    solution: String.raw`using System;
using System.Linq;

class Program
{
    static void Main()
    {
        int[] distintos = Console.ReadLine()
            .Split(' ')
            .Select(int.Parse)
            .Distinct()
            .OrderByDescending(n => n)
            .ToArray();
        Console.WriteLine(distintos.Length >= 2 ? distintos[1].ToString() : "no hay");
    }
}`,
  },

  // ------------------------------------------------------ Nivel 5: algoritmos
  {
    slug: "cs-fibonacci",
    difficulty: 5,
    title: "Fibonacci",
    prompt:
      "Lee un entero `n`, de 1 a 40, e imprime los primeros `n` términos de Fibonacci en una línea, separados por un espacio. Empieza en `0 1`.",
    cases: [caso("5", "0 1 1 2 3"), caso("1", "0"), caso("10", "0 1 1 2 3 5 8 13 21 34")],
    hint: "Guarda los dos últimos términos. El siguiente es su suma, y después corres los dos un lugar.",
    solution: String.raw`using System;
using System.Collections.Generic;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        List<long> terminos = new List<long>();
        long a = 0, b = 1;
        for (int i = 0; i < n; i++)
        {
            terminos.Add(a);
            long siguiente = a + b;
            a = b;
            b = siguiente;
        }
        Console.WriteLine(string.Join(" ", terminos));
    }
}`,
  },
  {
    slug: "cs-frecuencia-de-letras",
    difficulty: 5,
    title: "Frecuencia de letras",
    prompt:
      "Lee una palabra en minúsculas e imprime cuántas veces sale cada letra, una por línea con el formato `letra:veces`, en orden alfabético.",
    cases: [
      caso("banana", "a:3\nb:1\nn:2"),
      caso("itla", "a:1\ni:1\nl:1\nt:1"),
      caso("zzz", "z:3"),
    ],
    hint: "Un `Dictionary<char, int>` cuenta las letras. `SortedDictionary` las deja ya en orden.",
    solution: String.raw`using System;
using System.Collections.Generic;

class Program
{
    static void Main()
    {
        string palabra = Console.ReadLine();
        SortedDictionary<char, int> veces = new SortedDictionary<char, int>();
        foreach (char letra in palabra)
        {
            if (veces.ContainsKey(letra)) veces[letra]++;
            else veces[letra] = 1;
        }
        foreach (KeyValuePair<char, int> par in veces)
        {
            Console.WriteLine(par.Key + ":" + par.Value);
        }
    }
}`,
  },
  {
    slug: "cs-matriz-traspuesta",
    difficulty: 5,
    title: "Matriz traspuesta",
    prompt:
      "La primera línea trae las filas y las columnas de una matriz, y después llega cada fila con sus números separados por un espacio. Imprime la traspuesta: las filas pasan a ser columnas.",
    cases: [
      caso("2 3\n1 2 3\n4 5 6", "1 4\n2 5\n3 6"),
      caso("1 1\n7", "7"),
      caso("3 2\n1 2\n3 4\n5 6", "1 3 5\n2 4 6"),
    ],
    hint: "Lee todo a un `int[,]`. En la traspuesta, lo que estaba en `[f, c]` pasa a `[c, f]`.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        string[] tamano = Console.ReadLine().Split(' ');
        int filas = int.Parse(tamano[0]);
        int columnas = int.Parse(tamano[1]);
        int[,] matriz = new int[filas, columnas];
        for (int f = 0; f < filas; f++)
        {
            string[] valores = Console.ReadLine().Split(' ');
            for (int c = 0; c < columnas; c++)
            {
                matriz[f, c] = int.Parse(valores[c]);
            }
        }
        for (int c = 0; c < columnas; c++)
        {
            string[] fila = new string[filas];
            for (int f = 0; f < filas; f++)
            {
                fila[f] = matriz[f, c].ToString();
            }
            Console.WriteLine(string.Join(" ", fila));
        }
    }
}`,
  },
  {
    slug: "cs-mcd-y-mcm",
    difficulty: 5,
    title: "MCD y MCM",
    prompt:
      "Lee dos enteros positivos e imprime su máximo común divisor y su mínimo común múltiplo, en dos líneas: `MCD: x` y `MCM: y`.",
    cases: [
      caso("12\n18", "MCD: 6\nMCM: 36"),
      caso("7\n5", "MCD: 1\nMCM: 35"),
      caso("20\n20", "MCD: 20\nMCM: 20"),
    ],
    hint: "El algoritmo de Euclides: mientras `b` no sea 0, `(a, b) = (b, a % b)`. Y el MCM es `a * b / MCD`.",
    solution: String.raw`using System;

class Program
{
    static int Mcd(int a, int b)
    {
        while (b != 0)
        {
            int resto = a % b;
            a = b;
            b = resto;
        }
        return a;
    }

    static void Main()
    {
        int a = int.Parse(Console.ReadLine());
        int b = int.Parse(Console.ReadLine());
        int mcd = Mcd(a, b);
        Console.WriteLine("MCD: " + mcd);
        Console.WriteLine("MCM: " + (a / mcd * b));
    }
}`,
  },
  {
    slug: "cs-a-binario",
    difficulty: 5,
    title: "Decimal a binario",
    prompt:
      "Lee un entero no negativo e imprímelo en binario, sin usar `Convert.ToString`. El 0 es `0`.",
    cases: [caso("10", "1010"), caso("0", "0"), caso("1", "1"), caso("255", "11111111")],
    hint: "Divide entre 2 y guarda cada resto. Los restos leídos del último al primero son el binario.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        if (n == 0)
        {
            Console.WriteLine("0");
            return;
        }
        string binario = "";
        while (n > 0)
        {
            binario = (n % 2) + binario;
            n /= 2;
        }
        Console.WriteLine(binario);
    }
}`,
  },
  {
    slug: "cs-anagramas",
    difficulty: 5,
    title: "Anagramas",
    prompt:
      "Lee dos palabras, una por línea, e imprime `si` si una es anagrama de la otra, sin importar mayúsculas, y `no` si no.",
    cases: [
      caso("roma\namor", "si"),
      caso("hola\nhoja", "no"),
      caso("Listen\nSilent", "si"),
      caso("abc\nab", "no"),
    ],
    hint: "Dos palabras son anagramas si, pasadas a minúsculas y con sus letras ordenadas, quedan iguales.",
    solution: String.raw`using System;

class Program
{
    static string Ordenada(string palabra)
    {
        char[] letras = palabra.ToLower().ToCharArray();
        Array.Sort(letras);
        return new string(letras);
    }

    static void Main()
    {
        string a = Console.ReadLine();
        string b = Console.ReadLine();
        Console.WriteLine(Ordenada(a) == Ordenada(b) ? "si" : "no");
    }
}`,
  },
  {
    slug: "cs-cuenta-del-colmado",
    difficulty: 5,
    title: "La cuenta del colmado",
    prompt:
      "Llegan productos, uno por línea, como `nombre precio cantidad`, hasta una línea que dice `fin`. El precio puede traer decimales con punto. Imprime el total con dos decimales.",
    cases: [
      caso("arroz 45.50 2\nhabichuelas 60 1\nfin", "151.00"),
      caso("fin", "0.00"),
      caso("salami 125.75 3\nfin", "377.25"),
    ],
    hint: "Un `while` que lea hasta `fin`. Cada línea se parte con `Split(' ')`: el precio va en `[1]` y la cantidad en `[2]`. Para dinero, `decimal`.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        decimal total = 0;
        string linea = Console.ReadLine();
        while (linea != "fin")
        {
            string[] partes = linea.Split(' ');
            decimal precio = decimal.Parse(partes[1]);
            int cantidad = int.Parse(partes[2]);
            total += precio * cantidad;
            linea = Console.ReadLine();
        }
        Console.WriteLine(total.ToString("F2"));
    }
}`,
  },
  {
    slug: "cs-mejor-del-grupo",
    difficulty: 5,
    title: "El mejor del grupo",
    prompt:
      "Llegan estudiantes, uno por línea, como `nombre nota`, hasta `fin`. Imprime en una línea el nombre de la nota más alta (si empatan, el que llegó primero) y en la siguiente `Promedio: x` con dos decimales.",
    cases: [
      caso("Ana 90\nLuis 85\nPedro 95\nfin", "Pedro\nPromedio: 90.00"),
      caso("Maria 70\nfin", "Maria\nPromedio: 70.00"),
      caso("Juan 80\nRosa 80\nfin", "Juan\nPromedio: 80.00"),
    ],
    hint: "Lleva a la vez el mejor nombre, la mejor nota, la suma y cuántos van. Para el empate, cambia de mejor solo con `>`, no con `>=`.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        string mejor = "";
        int mejorNota = -1;
        int suma = 0;
        int cuantos = 0;
        string linea = Console.ReadLine();
        while (linea != "fin")
        {
            string[] partes = linea.Split(' ');
            int nota = int.Parse(partes[1]);
            if (nota > mejorNota)
            {
                mejorNota = nota;
                mejor = partes[0];
            }
            suma += nota;
            cuantos++;
            linea = Console.ReadLine();
        }
        Console.WriteLine(mejor);
        Console.WriteLine("Promedio: " + ((double)suma / cuantos).ToString("F2"));
    }
}`,
  },
  {
    slug: "cs-numero-romano",
    difficulty: 5,
    title: "Número romano",
    prompt: "Lee un entero del 1 al 3999 e imprímelo en números romanos.",
    cases: [
      caso("4", "IV"),
      caso("9", "IX"),
      caso("40", "XL"),
      caso("2026", "MMXXVI"),
      caso("3999", "MMMCMXCIX"),
    ],
    hint: "Ten dos arreglos en paralelo, de mayor a menor: `1000, 900, 500, 400, ...` y `M, CM, D, CD, ...`. Resta el mayor que quepa y añade su símbolo.",
    solution: String.raw`using System;

class Program
{
    static void Main()
    {
        int n = int.Parse(Console.ReadLine());
        int[] valores = { 1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1 };
        string[] simbolos = { "M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I" };
        string romano = "";
        for (int i = 0; i < valores.Length; i++)
        {
            while (n >= valores[i])
            {
                romano += simbolos[i];
                n -= valores[i];
            }
        }
        Console.WriteLine(romano);
    }
}`,
  },
  {
    slug: "cs-parentesis-balanceados",
    difficulty: 5,
    title: "Paréntesis balanceados",
    prompt:
      "Lee una línea con paréntesis, corchetes y llaves, e imprime `balanceado` si cada uno cierra en su orden correcto, y `no balanceado` si no.",
    cases: [
      caso("([]{})", "balanceado"),
      caso("(]", "no balanceado"),
      caso("((", "no balanceado"),
      caso("{[()()]}", "balanceado"),
      caso(")(", "no balanceado"),
    ],
    hint: "Una `Stack<char>`: los que abren entran, y cada uno que cierra tiene que casar con el de arriba. Al final la pila tiene que quedar vacía.",
    solution: String.raw`using System;
using System.Collections.Generic;

class Program
{
    static void Main()
    {
        string linea = Console.ReadLine();
        Stack<char> pila = new Stack<char>();
        bool bien = true;
        foreach (char c in linea)
        {
            if (c == '(' || c == '[' || c == '{')
            {
                pila.Push(c);
            }
            else
            {
                char esperado = c == ')' ? '(' : c == ']' ? '[' : '{';
                if (pila.Count == 0 || pila.Pop() != esperado)
                {
                    bien = false;
                    break;
                }
            }
        }
        Console.WriteLine(bien && pila.Count == 0 ? "balanceado" : "no balanceado");
    }
}`,
  },
];

/** El programa con el que arranca el editor. Es la estructura que se ve en clase. */
export const CSHARP_STARTER = `using System;

class Program
{
    static void Main()
    {

    }
}`;
