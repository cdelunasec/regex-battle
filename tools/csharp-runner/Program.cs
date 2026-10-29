using System.Diagnostics;
using System.Globalization;
using System.Reflection;
using System.Runtime.InteropServices.JavaScript;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

// El runtime lo arranca JavaScript y llama directamente a las funciones de
// Runner. Main no hace nada: solo tiene que existir para que esto sea un
// ejecutable que el SDK de WebAssembly sepa publicar.
return;

/// <summary>
/// Compila y ejecuta el programa de un jugador.
///
/// Corre dentro de un Web Worker, nunca en el hilo de la página. Así un
/// `while (true) {}` no congela la pestaña: JavaScript espera un tiempo, y si
/// no hay respuesta mata el worker entero y arranca otro. Desde aquí dentro no
/// hay forma de interrumpir un bucle infinito, porque WebAssembly en .NET 8
/// tiene un solo hilo.
/// </summary>
public static partial class Runner
{
    /// <summary>
    /// Lo que trae un proyecto de consola nuevo sin escribirlo. Sin esto,
    /// `Console.WriteLine` no compilaría sin su `using System;`, y el jugador se
    /// encontraría un error que en Visual Studio no le sale.
    /// </summary>
    private const string GlobalUsings = """
        global using System;
        global using System.Collections.Generic;
        global using System.IO;
        global using System.Linq;
        global using System.Text;
        global using System.Threading;
        global using System.Threading.Tasks;
        """;

    /// <summary>
    /// La consola de mentira que recibe lo que en el navegador no existe.
    ///
    /// En WebAssembly, `Console.ReadLine`, `Console.In` y `Console.SetIn` lanzan
    /// "Operation is not supported on this platform": no hay teclado del que
    /// leer. Y un curso de C# lee datos del usuario desde el primer día. Así que
    /// antes de ejecutar, cada llamada a esas partes de la consola se redirige
    /// aquí, y la entrada sale del caso de prueba.
    ///
    /// ReadKey, Clear y los colores entran por lo mismo: en clase se usan para
    /// "pausar" al final y para decorar, y en el navegador revientan.
    /// </summary>
    private const string ConsoleShim = """
        internal static class __CodeBattleConsola
        {
            public static global::System.IO.TextReader Entrada = global::System.IO.TextReader.Null;

            public static global::System.IO.TextReader In => Entrada;
            public static string ReadLine() => Entrada.ReadLine();
            public static int Read() => Entrada.Read();
            public static global::System.ConsoleKeyInfo ReadKey() => default;
            public static global::System.ConsoleKeyInfo ReadKey(bool intercept) => default;
            public static void Clear() { }
            public static void ResetColor() { }
            public static void Beep() { }
            public static global::System.ConsoleColor ForegroundColor { get; set; } = global::System.ConsoleColor.Gray;
            public static global::System.ConsoleColor BackgroundColor { get; set; } = global::System.ConsoleColor.Black;
            public static string Title { get; set; } = "";
            public static bool CursorVisible { get; set; } = true;
        }
        """;

    private const string ShimTypeName = "__CodeBattleConsola";

    /// <summary>Los miembros de System.Console que se redirigen a la consola de mentira.</summary>
    private static readonly HashSet<string> RedirectedMembers =
    [
        "In",
        "ReadLine",
        "Read",
        "ReadKey",
        "Clear",
        "ResetColor",
        "Beep",
        "ForegroundColor",
        "BackgroundColor",
        "Title",
        "CursorVisible",
    ];

    /// <summary>
    /// Las librerías contra las que compila el código del jugador. Son las que
    /// usa un curso de consola; si falta alguna, el error de compilación lo
    /// dice con nombre y apellido.
    /// </summary>
    private static readonly string[] ReferenceNames =
    [
        "System.Private.CoreLib",
        "System.Runtime",
        "System.Console",
        "System.Collections",
        "System.Collections.NonGeneric",
        "System.Linq",
        "System.Memory",
        "System.ObjectModel",
        "System.Runtime.Extensions",
        "System.Runtime.Numerics",
        "System.Text.RegularExpressions",
        "System.Threading",
        "System.Threading.Tasks",
        "netstandard",
    ];

    /// <summary>Tope de salida, para que un bucle que imprime sin parar no se coma la memoria.</summary>
    private const int MaxOutputChars = 64_000;

    private static readonly List<MetadataReference> References = [];

    /// <summary>
    /// La cultura de los mensajes del compilador.
    ///
    /// Los textos en español vienen en ensamblados satélite, que JavaScript
    /// carga al arrancar el runtime con `loadAllSatelliteResources`. Sin esa
    /// opción el runtime no los carga, y ni pidiéndolos a mano aparecen. Aquí
    /// solo queda pedir cada mensaje en esta cultura, y se pasa explícita en vez
    /// de confiar en la ambiente, que dentro de código async no se queda donde
    /// uno la pone.
    /// </summary>
    private static readonly CultureInfo MessageCulture = SpanishOrInvariant();

    private static readonly CSharpParseOptions ParseOptions = new(LanguageVersion.Latest);

    private static readonly CSharpCompilationOptions CompilationOptions = new CSharpCompilationOptions(
        OutputKind.ConsoleApplication
    )
        .WithOptimizationLevel(OptimizationLevel.Debug)
        // Las advertencias de nulos son ruido para quien está empezando.
        .WithNullableContextOptions(NullableContextOptions.Disable)
        // WebAssembly no tiene hilos: la compilación en paralelo revienta.
        .WithConcurrentBuild(false);

    private static readonly JsonSerializerOptions Json = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    /// <summary>
    /// Descarga las librerías de referencia y hace una compilación de
    /// calentamiento. La primera compilación de Roslyn en WebAssembly es la
    /// lenta; mejor pagarla aquí que cuando el jugador pulsa Ejecutar.
    /// </summary>
    [JSExport]
    public static async Task<string> Initialize(string frameworkUrl)
    {
        var watch = Stopwatch.StartNew();
        using var http = new HttpClient { BaseAddress = new Uri(frameworkUrl) };
        var missing = new List<string>();

        foreach (var name in ReferenceNames)
        {
            try
            {
                var bytes = await http.GetByteArrayAsync($"{name}.dll");
                References.Add(MetadataReference.CreateFromImage(bytes));
            }
            catch (HttpRequestException)
            {
                missing.Add(name);
            }
        }

        // El calentamiento pasa por la redirección de la consola a propósito,
        // para que también esa ruta llegue caliente al primer Ejecutar.
        var warmup = await RunInternal("var x = Console.ReadLine(); Console.WriteLine(x);", "hola");

        return JsonSerializer.Serialize(
            new
            {
                references = References.Count,
                missing,
                messagesInSpanish = MessageCulture.Name == "es",
                warmupStatus = warmup.Status,
                milliseconds = watch.ElapsedMilliseconds,
            },
            Json
        );
    }

    private static CultureInfo SpanishOrInvariant()
    {
        try
        {
            return CultureInfo.GetCultureInfo("es");
        }
        catch (CultureNotFoundException)
        {
            // Si la globalización quedara en modo invariante, los errores saldrían
            // en inglés. Es peor, pero no tumba el compilador entero.
            return CultureInfo.InvariantCulture;
        }
    }

    [JSExport]
    public static async Task<string> Run(string source, string stdin)
    {
        var result = await RunInternal(source, stdin);
        return JsonSerializer.Serialize(result, Json);
    }

    /// <summary>
    /// La última compilación, para no repetirla.
    ///
    /// Un reto se comprueba con varios casos de prueba y el código es el mismo
    /// en todos: compilarlo una vez por caso sería pagar lo más caro varias
    /// veces. Lo que sí se repite por caso es cargar el ensamblado, y eso es a
    /// propósito: cada carga trae sus variables `static` de cero, así un
    /// contador estático no arrastra lo que sumó en el caso anterior.
    /// </summary>
    private static (string Source, CompileOutcome Outcome)? LastCompilation;

    private sealed record CompileOutcome(byte[]? Image, RunResult? Failure, long CompileMs);

    private static CompileOutcome Compile(string source)
    {
        if (LastCompilation is { } cached && cached.Source == source)
        {
            return cached.Outcome with { CompileMs = 0 };
        }

        var outcome = CompileFresh(source);
        LastCompilation = (source, outcome);
        return outcome;
    }

    private static CompileOutcome CompileFresh(string source)
    {
        var compileWatch = Stopwatch.StartNew();
        var playerTree = CSharpSyntaxTree.ParseText(source, ParseOptions, path: "Program.cs");
        var trees = new[]
        {
            CSharpSyntaxTree.ParseText(GlobalUsings, ParseOptions, path: "GlobalUsings.cs"),
            CSharpSyntaxTree.ParseText(ConsoleShim, ParseOptions, path: "Consola.cs"),
            playerTree,
        };

        var compilation = CSharpCompilation.Create("Programa", trees, References, CompilationOptions);

        // Los errores se sacan del código tal como lo escribió el jugador, antes
        // de redirigir nada. Si no, las columnas de un error en la misma línea
        // que un Console.ReadLine quedarían corridas.
        var errors = compilation
            .GetDiagnostics()
            .Where(d => d.Severity == DiagnosticSeverity.Error)
            .Take(20)
            .Select(ToDiagnostic)
            .ToList();

        if (errors.Count > 0)
        {
            var elapsed = compileWatch.ElapsedMilliseconds;
            return new CompileOutcome(
                null,
                new RunResult
                {
                    Status = "compile_error",
                    Diagnostics = errors,
                    CompileMs = elapsed,
                },
                elapsed
            );
        }

        var runnable = RedirectConsole(compilation, playerTree);

        using var image = new MemoryStream();
        var emit = runnable.Emit(image);
        var compileMs = compileWatch.ElapsedMilliseconds;

        if (!emit.Success)
        {
            // No debería pasar: el código ya compiló una vez. Si pasa, es la
            // redirección la que rompió algo, y conviene verlo tal cual.
            return new CompileOutcome(
                null,
                new RunResult
                {
                    Status = "internal_error",
                    Diagnostics = emit
                        .Diagnostics.Where(d => d.Severity == DiagnosticSeverity.Error)
                        .Take(5)
                        .Select(ToDiagnostic)
                        .ToList(),
                    CompileMs = compileMs,
                },
                compileMs
            );
        }

        return new CompileOutcome(image.ToArray(), null, compileMs);
    }

    private static async Task<RunResult> RunInternal(string source, string stdin)
    {
        if (References.Count == 0)
        {
            return new RunResult { Status = "not_ready" };
        }

        var compiled = Compile(source);
        if (compiled.Failure is not null || compiled.Image is null)
        {
            return compiled.Failure ?? new RunResult { Status = "internal_error" };
        }

        var compileMs = compiled.CompileMs;
        var assembly = Assembly.Load(compiled.Image);
        var entry = assembly.EntryPoint;
        if (entry is null)
        {
            return new RunResult { Status = "no_entry_point", CompileMs = compileMs };
        }

        assembly
            .GetType(ShimTypeName)
            ?.GetField("Entrada", BindingFlags.Public | BindingFlags.Static)
            ?.SetValue(null, new StringReader(stdin));

        var originalOut = Console.Out;
        var output = new CappedWriter(MaxOutputChars);
        var runWatch = Stopwatch.StartNew();

        try
        {
            // Formato invariante para el programa del jugador. Con la cultura
            // española un 3.5 se imprimiría 3,5, y no casaría con la salida
            // esperada del reto por algo que no es un error suyo.
            CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;
            Console.SetOut(output);

            var target = AsyncMainBehind(entry) ?? entry;
            var arguments = target.GetParameters().Length == 1 ? new object[] { Array.Empty<string>() } : null;
            var returned = target.Invoke(null, arguments);

            // Un Main async devuelve Task. Se espera con await y no con .Wait(),
            // porque con un solo hilo esperar bloqueando es un bloqueo eterno.
            if (returned is Task task)
            {
                await task;
            }

            return new RunResult
            {
                Status = "ok",
                Stdout = output.ToString(),
                CompileMs = compileMs,
                RunMs = runWatch.ElapsedMilliseconds,
            };
        }
        catch (Exception caught)
        {
            var cause = caught is TargetInvocationException { InnerException: { } inner } ? inner : caught;

            return new RunResult
            {
                Status = output.Overflowed ? "output_limit" : "runtime_error",
                Stdout = output.ToString(),
                Exception = output.Overflowed ? null : new ExceptionInfo(cause.GetType().Name, cause.Message),
                CompileMs = compileMs,
                RunMs = runWatch.ElapsedMilliseconds,
            };
        }
        finally
        {
            Console.SetOut(originalOut);
        }
    }

    /// <summary>
    /// Cuando el programa usa `await`, el compilador no marca como punto de
    /// entrada el método async: genera un envoltorio síncrono que lo espera con
    /// `GetAwaiter().GetResult()`. Esperar bloqueando necesita un segundo hilo,
    /// y en el navegador no lo hay: revienta con "Cannot wait on monitors".
    ///
    /// Así que se busca el método async que hay detrás y se llama a ese, para
    /// esperarlo con await.
    /// </summary>
    private static MethodInfo? AsyncMainBehind(MethodInfo entry)
    {
        if (entry.ReturnType != typeof(void) && entry.ReturnType != typeof(int))
        {
            return null;
        }

        return entry
            .DeclaringType?.GetMethods(BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic)
            .FirstOrDefault(method =>
                method != entry
                && (method.Name == "<Main>$" || method.Name == "Main")
                && typeof(Task).IsAssignableFrom(method.ReturnType)
            );
    }

    /// <summary>
    /// Cambia cada uso de la consola que en el navegador no existe por su
    /// equivalente en la consola de mentira.
    ///
    /// Se hace por símbolos y no buscando texto: así entra `Console.ReadLine()`,
    /// pero también `System.Console.ReadLine()` y el `ReadLine()` pelado de
    /// quien escribió `using static System.Console;`. Y no entra un método
    /// propio que el jugador haya llamado ReadLine.
    /// </summary>
    private static CSharpCompilation RedirectConsole(CSharpCompilation compilation, SyntaxTree tree)
    {
        var root = tree.GetRoot();

        // Atajo: si el texto ni menciona esos nombres, no hay nada que buscar.
        var candidates = root.DescendantNodes()
            .OfType<IdentifierNameSyntax>()
            .Where(name => RedirectedMembers.Contains(name.Identifier.Text))
            .ToList();

        if (candidates.Count == 0)
        {
            return compilation;
        }

        var model = compilation.GetSemanticModel(tree);
        var targets = new Dictionary<SyntaxNode, string>();

        foreach (var name in candidates)
        {
            var symbol = model.GetSymbolInfo(name).Symbol;
            if (symbol?.ContainingType?.ToDisplayString() != "System.Console")
            {
                continue;
            }

            // En `Console.ReadLine` se cambia el acceso entero; en el
            // `ReadLine` pelado de un using static, solo el nombre.
            SyntaxNode target =
                name.Parent is MemberAccessExpressionSyntax access && access.Name == name ? access : name;

            targets[target] = $"global::{ShimTypeName}.{name.Identifier.Text}";
        }

        if (targets.Count == 0)
        {
            return compilation;
        }

        var rewritten = root.ReplaceNodes(
            targets.Keys,
            (original, _) => SyntaxFactory.ParseExpression(targets[original]).WithTriviaFrom(original)
        );

        return compilation.ReplaceSyntaxTree(tree, tree.WithRootAndOptions(rewritten, tree.Options));
    }

    private static DiagnosticInfo ToDiagnostic(Diagnostic diagnostic)
    {
        var span = diagnostic.Location.GetLineSpan();
        var inPlayerCode = diagnostic.Location.SourceTree?.FilePath == "Program.cs";

        return new DiagnosticInfo(
            diagnostic.Id,
            diagnostic.GetMessage(MessageCulture),
            // Las líneas se cuentan desde 1, como en el editor.
            inPlayerCode ? span.StartLinePosition.Line + 1 : null,
            inPlayerCode ? span.StartLinePosition.Character + 1 : null
        );
    }
}

internal sealed class RunResult
{
    public required string Status { get; init; }
    public string? Stdout { get; init; }
    public List<DiagnosticInfo>? Diagnostics { get; init; }
    public ExceptionInfo? Exception { get; init; }
    public long? CompileMs { get; init; }
    public long? RunMs { get; init; }
}

internal sealed record DiagnosticInfo(string Id, string Message, int? Line, int? Column);

internal sealed record ExceptionInfo(string Type, string Message);

/// <summary>
/// Un TextWriter que se planta al pasar el tope. Lanza en vez de truncar en
/// silencio, porque la ejecución tiene que parar: un bucle imprimiendo sin fin
/// seguiría gastando tiempo aunque ya no se guardara nada.
/// </summary>
internal sealed class CappedWriter(int limit) : TextWriter
{
    private readonly StringBuilder buffer = new();

    public bool Overflowed { get; private set; }

    public override Encoding Encoding => Encoding.UTF8;

    public override void Write(char value)
    {
        if (buffer.Length >= limit)
        {
            Overflowed = true;
            throw new InvalidOperationException("La salida pasó del tope.");
        }
        buffer.Append(value);
    }

    public override void Write(string? value)
    {
        if (value is null)
        {
            return;
        }
        if (buffer.Length + value.Length > limit)
        {
            buffer.Append(value, 0, Math.Max(0, limit - buffer.Length));
            Overflowed = true;
            throw new InvalidOperationException("La salida pasó del tope.");
        }
        buffer.Append(value);
    }

    public override string ToString() => buffer.ToString();
}
