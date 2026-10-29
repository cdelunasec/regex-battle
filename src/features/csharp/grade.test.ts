import { describe, expect, it } from "vitest";
import {
  describeDifference,
  evaluateCSharp,
  explainException,
  judge,
  normalizeOutput,
  type CSharpCase,
} from "./grade.ts";
import type { CSharpRunResult } from "./protocol.ts";
import type { CSharpExecutor } from "./runner.ts";

/** Un ejecutor de mentira que responde lo que se le diga, por entrada. */
function fakeExecutor(answers: Record<string, CSharpRunResult>) {
  const calls: string[] = [];
  const executor: CSharpExecutor = {
    run: async (_source, stdin) => {
      calls.push(stdin);
      return answers[stdin] ?? { status: "ok", stdout: "" };
    },
  };
  return { executor, calls };
}

const ok = (stdout: string): CSharpRunResult => ({ status: "ok", stdout });

describe("normalizeOutput", () => {
  it("perdona los espacios invisibles al final de cada línea", () => {
    expect(normalizeOutput("hola   \nmundo\t")).toBe("hola\nmundo");
  });

  it("perdona los saltos de línea al final del todo", () => {
    expect(normalizeOutput("12\n\n\n")).toBe("12");
  });

  it("trata igual el salto de Windows y el de los demás", () => {
    expect(normalizeOutput("a\r\nb\r\n")).toBe(normalizeOutput("a\nb\n"));
  });

  it("NO perdona la sangría, que en una pirámide es lo que se evalúa", () => {
    expect(normalizeOutput("  *\n ***")).not.toBe(normalizeOutput("*\n***"));
  });

  it("no inventa diferencias donde no las hay", () => {
    expect(normalizeOutput("")).toBe("");
    expect(normalizeOutput("sin nada raro")).toBe("sin nada raro");
  });
});

describe("judge", () => {
  it("pasa cuando la salida coincide, con espacios de sobra al final", () => {
    expect(judge(ok("12 \n"), "12").kind).toBe("pass");
  });

  it("da la salida real y la esperada cuando no coinciden", () => {
    expect(judge(ok("13\n"), "12")).toEqual({
      kind: "wrong_output",
      expected: "12",
      actual: "13\n",
    });
  });

  it("explica una excepción en español y conserva lo que alcanzó a imprimir", () => {
    const verdict = judge(
      {
        status: "runtime_error",
        stdout: "Dame un número: ",
        exception: { type: "FormatException", message: "The input string 'abc'..." },
      },
      "12",
    );
    expect(verdict.kind).toBe("runtime_error");
    if (verdict.kind !== "runtime_error") return;
    expect(verdict.explanation).toContain("int.Parse");
    expect(verdict.actual).toBe("Dame un número: ");
  });

  it("pasa los errores de compilación tal cual", () => {
    const diagnostics = [{ id: "CS1002", message: "Se esperaba ;", line: 1, column: 10 }];
    expect(judge({ status: "compile_error", diagnostics }, "")).toEqual({
      kind: "compile_error",
      diagnostics,
    });
  });

  it("reconoce el cuelgue, el tope de salida y la caída del runtime", () => {
    expect(judge({ status: "timeout" }, "").kind).toBe("timeout");
    expect(judge({ status: "output_limit", stdout: "xxx" }, "").kind).toBe("output_limit");
    expect(judge({ status: "crashed" }, "").kind).toBe("crashed");
  });

  it("lo que no se espera cae en error interno y no en un aprobado", () => {
    expect(judge({ status: "not_ready" }, "").kind).toBe("internal_error");
    expect(judge({ status: "no_entry_point" }, "").kind).toBe("internal_error");
  });
});

describe("explainException", () => {
  it("explica las excepciones de principiante en español", () => {
    for (const type of [
      "FormatException",
      "DivideByZeroException",
      "IndexOutOfRangeException",
      "NullReferenceException",
    ]) {
      expect(explainException(type), type).not.toContain(type);
    }
  });

  it("una que no conoce la nombra en vez de inventar", () => {
    expect(explainException("RaraException")).toContain("RaraException");
  });
});

describe("evaluateCSharp", () => {
  const cases: CSharpCase[] = [
    { stdin: "2\n3", expected: "5" },
    { stdin: "10\n-4", expected: "6" },
    { stdin: "0\n0", expected: "0" },
  ];

  it("aprueba solo si pasan todos los casos", async () => {
    const { executor } = fakeExecutor({
      "2\n3": ok("5\n"),
      "10\n-4": ok("6\n"),
      "0\n0": ok("0\n"),
    });
    const result = await evaluateCSharp("codigo", cases, executor);
    expect(result).toMatchObject({ passed: 3, total: 3, allPassed: true, compileErrors: null });
  });

  it("cuenta los que pasan aunque falle alguno", async () => {
    const { executor } = fakeExecutor({
      "2\n3": ok("5\n"),
      "10\n-4": ok("14\n"),
      "0\n0": ok("0\n"),
    });
    const result = await evaluateCSharp("codigo", cases, executor);
    expect(result.passed).toBe(2);
    expect(result.allPassed).toBe(false);
    expect(result.verdicts[1]?.kind).toBe("wrong_output");
  });

  it("si no compila, no vuelve a ejecutar y reporta los errores una vez", async () => {
    const diagnostics = [{ id: "CS0103", message: "El nombre 'x' no existe", line: 2, column: 5 }];
    const { executor, calls } = fakeExecutor({ "2\n3": { status: "compile_error", diagnostics } });
    const result = await evaluateCSharp("codigo", cases, executor);

    expect(calls).toEqual(["2\n3"]);
    expect(result.compileErrors).toEqual(diagnostics);
    expect(result.verdicts).toHaveLength(3);
    expect(result.passed).toBe(0);
  });

  it("si un caso se cuelga, salta los demás en vez de rearrancar el compilador por cada uno", async () => {
    const { executor, calls } = fakeExecutor({
      "2\n3": ok("5\n"),
      "10\n-4": { status: "timeout" },
    });
    const result = await evaluateCSharp("codigo", cases, executor);

    expect(calls).toEqual(["2\n3", "10\n-4"]);
    expect(result.verdicts.map((verdict) => verdict.kind)).toEqual(["pass", "timeout", "skipped"]);
    expect(result.allPassed).toBe(false);
  });

  it("un reto sin casos no se da por aprobado", async () => {
    const { executor } = fakeExecutor({});
    expect((await evaluateCSharp("codigo", [], executor)).allPassed).toBe(false);
  });
});

describe("describeDifference", () => {
  it("señala una mayúscula cambiada, que a ojo no se ve", () => {
    // El caso real que trajo esto: DeLuna escribió "Deluna" y no encontraba
    // qué tenía mal, con las dos salidas una al lado de la otra.
    const difference = describeDifference("DeLuna tiene 19 anios", "Deluna tiene 19 anios");
    expect(difference).toMatchObject({ line: 1, column: 3 });
    expect(difference?.message).toContain("posición 3");
    expect(difference?.message).toContain("mayúscula");
    expect(difference?.message).toContain('"L"');
    expect(difference?.message).toContain('"l"');
  });

  it("dice la línea cuando la diferencia está más abajo", () => {
    const difference = describeDifference("4\n6", "4\n7");
    expect(difference).toMatchObject({ line: 2, column: 1 });
    expect(difference?.message).toContain('"6"');
    expect(difference?.message).toContain('"7"');
  });

  it("nombra el espacio en vez de dejar unas comillas vacías", () => {
    const difference = describeDifference("Hola, Ana!", "Hola,Ana!");
    expect(difference?.message).toContain("un espacio");
  });

  it("avisa cuando a la línea le falta el final", () => {
    const difference = describeDifference("Hola, Ana!", "Hola, Ana");
    expect(difference).toMatchObject({ line: 1, column: 10 });
    expect(difference?.message).toContain("le falta el final");
  });

  it("avisa cuando la línea trae de más", () => {
    expect(describeDifference("12", "123")?.message).toContain("Sobra");
  });

  it("avisa de una línea de más y de una que falta", () => {
    expect(describeDifference("1\n2", "1\n2\n3")?.message).toContain("una línea de más");
    expect(describeDifference("1\n2\n3", "1\n2")?.message).toContain("Falta la línea 3");
  });

  it("no inventa una diferencia que al corrector le da igual", () => {
    // Espacios al final y saltos de línea sobrantes se perdonan al comparar,
    // así que tampoco se señalan.
    expect(describeDifference("12", "12  \n\n")).toBeNull();
    expect(describeDifference("a\r\nb", "a\nb")).toBeNull();
  });
});
