/**
 * Lo que se comprueba aquí es la FORMA, no el resultado de correr nada.
 *
 * Los casos elegidos son los que se rompen en silencio: que un `$var` sepa si
 * venía entrecomillado, que `<` dentro de `[[ ]]` compare en vez de redirigir,
 * y que una palabra reservada deje de serlo cuando no está en su sitio.
 */
import { describe, expect, it } from "vitest";
import type {
  AndOrNode,
  CaseNode,
  CondNode,
  ForArithNode,
  ForNode,
  FunctionNode,
  IfNode,
  LoopNode,
  PipelineNode,
  SimpleCommand,
} from "./ast.ts";
import { parse } from "./parser.ts";
import { BashSyntaxError } from "./lexer.ts";

const simple = (source: string): SimpleCommand => parse(source) as SimpleCommand;

describe("las palabras y sus comillas", () => {
  it("guarda cada pedazo sabiendo de dónde salió", () => {
    const command = simple('echo "hola $nombre" adios');
    expect(command.words).toHaveLength(3);
    expect(command.words[1]).toEqual([
      { kind: "literal", quoted: true, text: "hola " },
      { kind: "param", quoted: true, text: "nombre" },
    ]);
  });

  it("distingue la variable con comillas de la que no las lleva", () => {
    expect(simple("rm $archivo").words[1]![0]!.quoted).toBe(false);
    expect(simple('rm "$archivo"').words[1]![0]!.quoted).toBe(true);
  });

  it("dentro de comillas simples no hay variables", () => {
    expect(simple("echo '$nombre'").words[1]).toEqual([
      { kind: "literal", quoted: true, text: "$nombre" },
    ]);
  });

  it("lee un comando dentro de una palabra", () => {
    const command = simple('echo "hay $(ls | wc -l) archivos"');
    const parts = command.words[1]!;
    expect(parts[1]).toMatchObject({ kind: "command", quoted: true, text: "ls | wc -l" });
  });

  it("lee la aritmética", () => {
    expect(simple("echo $((2 + 3))").words[1]![0]).toMatchObject({
      kind: "arith",
      text: "2 + 3",
    });
  });
});

describe("los modificadores de ${}", () => {
  const partOf = (source: string) => simple(source).words[1]![0]!;

  it("entiende el valor de respaldo", () => {
    expect(partOf('echo "${1:-vacio}"')).toMatchObject({ op: "default", colon: true });
  });

  it("entiende el recorte, y que la forma larga no es la corta", () => {
    expect(partOf("echo ${archivo%.log}")).toMatchObject({ op: "trimEnd", greedy: false });
    expect(partOf("echo ${ruta##*/}")).toMatchObject({ op: "trimStart", greedy: true });
  });

  it("entiende el reemplazo", () => {
    const part = partOf("echo ${linea//,/ }");
    expect(part).toMatchObject({ op: "replace", greedy: true });
    expect(part.args?.[0]).toEqual([{ kind: "literal", quoted: true, text: "," }]);
  });

  it("entiende la longitud y los índices", () => {
    expect(partOf("echo ${#nombre}")).toMatchObject({ op: "length", text: "nombre" });
    expect(partOf("echo ${#lista[@]}")).toMatchObject({ op: "length", index: "@" });
  });
});

describe("las asignaciones", () => {
  it("separa el nombre del valor", () => {
    const command = simple("puerto=22");
    expect(command.assignments[0]).toMatchObject({ name: "puerto", append: false });
    expect(command.assignments[0]!.value).toEqual([{ kind: "literal", quoted: false, text: "22" }]);
  });

  it("entiende el arreglo", () => {
    const command = simple("puertos=(22 80 443)");
    expect(command.assignments[0]!.array).toHaveLength(3);
  });

  it("entiende el añadido", () => {
    expect(simple('ruta+=":/opt"').assignments[0]).toMatchObject({ append: true });
  });

  it("deja de ser asignación una vez empezó el comando", () => {
    const command = simple("echo puerto=22");
    expect(command.assignments).toHaveLength(0);
    expect(command.words).toHaveLength(2);
  });
});

describe("las redirecciones", () => {
  it("lee el descriptor pegado al operador", () => {
    const command = simple("comando 2>&1");
    expect(command.redirects[0]).toMatchObject({ fd: 2, op: ">&" });
  });

  it("no se come un número que es un argumento", () => {
    const command = simple("echo 2");
    expect(command.redirects).toHaveLength(0);
    expect(command.words).toHaveLength(2);
  });

  it("distingue escribir de añadir", () => {
    expect(simple("echo hola > salida.txt").redirects[0]).toMatchObject({ op: ">" });
    expect(simple("echo hola >> salida.txt").redirects[0]).toMatchObject({ op: ">>" });
  });

  it("lee el bloque de texto hasta su etiqueta", () => {
    const command = simple("cat <<FIN\nuna\ndos\nFIN\n");
    const here = command.redirects[0]!;
    expect(here.op).toBe("heredoc");
    expect(here.here).toEqual([{ kind: "literal", quoted: true, text: "una\ndos\n" }]);
  });

  it("con la etiqueta entrecomillada no expande nada de dentro", () => {
    const command = simple("cat <<'FIN'\n$HOME\nFIN\n");
    expect(command.redirects[0]!.here).toEqual([
      { kind: "literal", quoted: true, text: "$HOME\n" },
    ]);
  });
});

describe("el control de flujo", () => {
  it("arma el if con sus ramas", () => {
    const node = parse("if [ -f x ]; then echo si; else echo no; fi") as IfNode;
    expect(node.type).toBe("if");
    expect(node.clauses).toHaveLength(1);
    expect(node.otherwise).toBeDefined();
  });

  it("arma el elif como una rama más", () => {
    const node = parse("if a; then b; elif c; then d; fi") as IfNode;
    expect(node.clauses).toHaveLength(2);
    expect(node.otherwise).toBeUndefined();
  });

  it("arma el bucle y sabe si era until", () => {
    expect((parse("while true; do echo x; done") as LoopNode).until).toBe(false);
    expect((parse("until false; do echo x; done") as LoopNode).until).toBe(true);
  });

  it("arma el for con su lista", () => {
    const node = parse("for ip in 10.0.0.1 10.0.0.2; do echo $ip; done") as ForNode;
    expect(node.name).toBe("ip");
    expect(node.items).toHaveLength(2);
  });

  it("un for sin in recorre los argumentos", () => {
    expect((parse("for x; do echo $x; done") as ForNode).items).toBeNull();
  });

  it("arma el for aritmético con sus tres partes", () => {
    const node = parse("for ((i=0; i<3; i++)); do echo $i; done") as ForArithNode;
    expect(node.type).toBe("forArith");
    expect(node.condition.trim()).toBe("i<3");
  });

  it("arma el case con sus ramas y sus patrones", () => {
    const node = parse("case $x in\n  a|b) echo ab ;;\n  *) echo otro ;;\nesac") as CaseNode;
    expect(node.branches).toHaveLength(2);
    expect(node.branches[0]!.patterns).toHaveLength(2);
  });

  it("arma la función", () => {
    const node = parse("saludar() {\n  echo hola\n}") as FunctionNode;
    expect(node.type).toBe("function");
    expect(node.name).toBe("saludar");
  });
});

describe("las condiciones de [[ ]]", () => {
  it("lee una prueba de un solo operando", () => {
    const node = parse("[[ -f /etc/passwd ]]") as CondNode;
    expect(node.expr).toMatchObject({ type: "unary", op: "-f" });
  });

  it("junta con y griega y con o", () => {
    const node = parse("[[ -f x && $a == b ]]") as CondNode;
    expect(node.expr.type).toBe("and");
  });

  it("devuelve a su sitio el menor que, que el léxico leyó como redirección", () => {
    const node = parse("[[ $a < $b ]]") as CondNode;
    expect(node.expr).toMatchObject({ type: "binary", op: "<" });
  });

  it("lee la comparación con expresión regular", () => {
    const node = parse("[[ $linea =~ ^ERROR ]]") as CondNode;
    expect(node.expr).toMatchObject({ type: "binary", op: "=~" });
  });
});

describe("las tuberías y las cadenas", () => {
  it("arma la tubería con todos sus comandos", () => {
    const node = parse("cat a | grep b | wc -l") as PipelineNode;
    expect(node.type).toBe("pipeline");
    expect(node.commands).toHaveLength(3);
  });

  it("guarda la negación del pipeline", () => {
    expect((parse("! grep x archivo") as PipelineNode).negated).toBe(true);
  });

  it("arma la cadena de y griega", () => {
    const node = parse("mkdir d && cd d") as AndOrNode;
    expect(node.type).toBe("andOr");
    expect(node.op).toBe("&&");
  });
});

describe("las palabras reservadas solo valen en su sitio", () => {
  it("imprime la palabra if cuando es un argumento", () => {
    const command = simple("echo if then fi");
    expect(command.words).toHaveLength(4);
  });
});

describe("los errores de sintaxis", () => {
  it("avisa cuando falta cerrar", () => {
    expect(() => parse("if true; then echo x")).toThrow(BashSyntaxError);
    expect(() => parse('echo "sin cerrar')).toThrow(BashSyntaxError);
    expect(() => parse("for i in 1 2; do echo $i")).toThrow(BashSyntaxError);
  });

  it("dice en qué línea fue", () => {
    try {
      parse("echo uno\necho dos\nif true; then\n");
      expect.unreachable("tenía que fallar");
    } catch (error) {
      expect(error).toBeInstanceOf(BashSyntaxError);
      expect((error as BashSyntaxError).line).toBeGreaterThanOrEqual(3);
    }
  });
});
