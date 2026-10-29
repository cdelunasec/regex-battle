import { describe, expect, it } from "vitest";
import { kqlMatcherEngine, guardKql } from "./kql-matcher.ts";
import { parseKql, KqlSyntaxError } from "./kql-parse.ts";

/** Un log de ejemplo con lo que suele traer uno de verdad. */
const LOG = {
  "@timestamp": "2026-08-30T14:05:00Z",
  level: "error",
  message: "Failed password for invalid user admin",
  status: 401,
  activo: true,
  source: { ip: "192.168.1.50", port: 4444 },
  user: { name: "Admin", roles: ["ops", "lectura"] },
  tags: ["ssh", "auth"],
  nulo: null,
};

/** Corre una consulta contra un documento. */
function run(query: string, document: unknown = LOG): boolean {
  return kqlMatcherEngine.compile(query, "partial")(JSON.stringify(document));
}

describe("KQL: campo y valor", () => {
  it("compara un campo simple", () => {
    expect(run("level:error")).toBe(true);
    expect(run("level:warning")).toBe(false);
  });

  it("el valor no distingue mayúsculas, el nombre del campo sí", () => {
    // Es lo que hace Elastic: el valor pasa por el analizador y el nombre del
    // campo es una clave del documento, tal cual está escrita.
    expect(run("user.name:admin")).toBe(true);
    expect(run("level:ERROR")).toBe(true);
    expect(run("LEVEL:error")).toBe(false);
  });

  it("baja por rutas con puntos", () => {
    expect(run("source.ip:192.168.1.50")).toBe(true);
    expect(run("source.port:4444")).toBe(true);
    expect(run("source.ip:10.0.0.1")).toBe(false);
  });

  it("un campo que no existe no encaja con nada", () => {
    expect(run("no.existe:loquesea")).toBe(false);
  });

  it("encaja si cualquier elemento de una lista encaja", () => {
    expect(run("tags:ssh")).toBe(true);
    expect(run("tags:auth")).toBe(true);
    expect(run("tags:http")).toBe(false);
    expect(run("user.roles:ops")).toBe(true);
  });

  it("compara números y booleanos", () => {
    expect(run("status:401")).toBe(true);
    expect(run("status:404")).toBe(false);
    expect(run("activo:true")).toBe(true);
    expect(run("activo:false")).toBe(false);
  });

  it("un campo nulo cuenta como ausente", () => {
    expect(run("nulo:*")).toBe(false);
    expect(run("nulo:algo")).toBe(false);
  });
});

describe("KQL: existencia y comodines", () => {
  it("pregunta si un campo existe", () => {
    expect(run("level:*")).toBe(true);
    expect(run("source.ip:*")).toBe(true);
    expect(run("no.existe:*")).toBe(false);
  });

  it("acepta comodines en el valor", () => {
    expect(run("message:*password*")).toBe(true);
    expect(run("message:Failed*")).toBe(true);
    expect(run("message:*admin")).toBe(true);
    expect(run("message:*contraseña*")).toBe(false);
  });

  it("el punto del comodín es un punto y no cualquier carácter", () => {
    expect(run("source.ip:192.168.1.*")).toBe(true);
    expect(run("source.ip:19x.168.1.50")).toBe(false);
  });

  it("entre comillas el asterisco es un asterisco", () => {
    expect(run('message:"*password*"')).toBe(false);
    expect(run('message:"Failed password for invalid user admin"')).toBe(true);
  });
});

describe("KQL: rangos", () => {
  it("compara números", () => {
    expect(run("status >= 400")).toBe(true);
    expect(run("status > 401")).toBe(false);
    expect(run("status <= 401")).toBe(true);
    expect(run("status < 400")).toBe(false);
  });

  it("compara fechas ISO como texto, que para eso están hechas", () => {
    expect(run('@timestamp >= "2026-08-30T00:00:00Z"')).toBe(true);
    expect(run('@timestamp >= "2026-09-01T00:00:00Z"')).toBe(false);
  });

  it("un campo ausente no entra en ningún rango", () => {
    expect(run("no.existe > 0")).toBe(false);
  });
});

describe("KQL: lógica", () => {
  it("combina con and, or y not", () => {
    expect(run("level:error and status:401")).toBe(true);
    expect(run("level:error and status:500")).toBe(false);
    expect(run("level:warning or status:401")).toBe(true);
    expect(run("not level:warning")).toBe(true);
    expect(run("not level:error")).toBe(false);
  });

  it("acepta las palabras clave en cualquier caja", () => {
    expect(run("level:error AND status:401")).toBe(true);
    expect(run("level:error Or level:warning")).toBe(true);
  });

  it("and aprieta más que or", () => {
    // Sin paréntesis esto es: warning, o bien (error y 401).
    expect(run("level:warning or level:error and status:401")).toBe(true);
    expect(run("level:warning or level:error and status:500")).toBe(false);
  });

  it("los paréntesis mandan sobre la precedencia", () => {
    expect(run("(level:warning or level:error) and status:401")).toBe(true);
    expect(run("(level:warning or level:error) and status:500")).toBe(false);
  });

  it("acepta listas de valores en un campo", () => {
    expect(run("level:(error or warning)")).toBe(true);
    expect(run("level:(warning or info)")).toBe(false);
    expect(run("tags:(ssh and auth)")).toBe(true);
    expect(run("tags:(ssh and http)")).toBe(false);
  });

  it("not se aplica antes que and", () => {
    expect(run("not level:warning and status:401")).toBe(true);
    expect(run("not level:error and status:401")).toBe(false);
  });
});

describe("KQL: términos sueltos", () => {
  it("busca en cualquier valor del documento", () => {
    expect(run("error")).toBe(true);
    expect(run("4444")).toBe(true);
    expect(run("noaparece")).toBe(false);
  });

  it("un término suelto compara el valor entero, no un pedazo", () => {
    expect(run("password")).toBe(false);
    expect(run("*password*")).toBe(true);
  });
});

describe("KQL: errores de sintaxis", () => {
  const roto = [
    "level:",
    "(level:error",
    "level:error)",
    'message:"sin cerrar',
    "and level:error",
    ":error",
  ];

  it.each(roto)("rechaza %s", (query) => {
    expect(() => parseKql(query)).toThrow(KqlSyntaxError);
  });

  it("el error trae código y mensaje en español", () => {
    try {
      parseKql("(level:error");
      throw new Error("debería haber lanzado");
    } catch (cause) {
      expect(cause).toBeInstanceOf(KqlSyntaxError);
      expect((cause as KqlSyntaxError).code).toBe("unclosed_paren");
      expect((cause as KqlSyntaxError).message).toContain("paréntesis");
    }
  });

  it("una palabra clave en sitio de valor es un valor", () => {
    expect(run("level:not", { level: "not" })).toBe(true);
  });
});

describe("guardKql", () => {
  it("deja pasar una consulta normal", () => {
    expect(guardKql("level:error")).toBeNull();
  });

  it("rechaza la vacía y la larguísima", () => {
    expect(guardKql("   ")?.code).toBe("empty_query");
    expect(guardKql("a:b and ".repeat(60))?.code).toBe("query_too_long");
  });

  it("corta el anidamiento antes de que reviente la pila", () => {
    expect(() => parseKql("(".repeat(30) + "a:b" + ")".repeat(30))).toThrow(KqlSyntaxError);
  });
});

describe("KQL: un documento que no es JSON no revienta", () => {
  it("se trata como documento vacío", () => {
    const compiled = kqlMatcherEngine.compile("level:error", "partial");
    expect(compiled("esto no es json")).toBe(false);
  });
});
