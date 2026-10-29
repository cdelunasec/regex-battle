import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  normalizeChoice,
  resolveTheme,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  toggleChoice,
  type ThemeChoice,
} from "./theme.ts";

const CHOICES: ThemeChoice[] = ["light", "dark", "system"];

describe("normalizeChoice", () => {
  it("acepta los dos temas explícitos", () => {
    expect(normalizeChoice("light")).toBe("light");
    expect(normalizeChoice("dark")).toBe("dark");
  });

  it("todo lo demás vuelve a seguir al sistema", () => {
    for (const raw of [null, undefined, "", "system", "oscuro", "DARK", "{}"]) {
      expect(normalizeChoice(raw)).toBe("system");
    }
  });
});

describe("resolveTheme", () => {
  it("un tema explícito no depende del sistema", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("siguiendo al sistema, manda el sistema", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});

describe("toggleChoice", () => {
  it("siempre deja lo contrario de lo que se está viendo", () => {
    for (const choice of CHOICES) {
      for (const prefersDark of [true, false]) {
        const visible = resolveTheme(choice, prefersDark);
        const next = toggleChoice(choice, prefersDark);
        expect(next).not.toBe("system");
        expect(resolveTheme(next, prefersDark)).not.toBe(visible);
      }
    }
  });

  it("dos pulsaciones devuelven lo que se veía", () => {
    for (const choice of CHOICES) {
      for (const prefersDark of [true, false]) {
        const once = toggleChoice(choice, prefersDark);
        const twice = toggleChoice(once, prefersDark);
        expect(resolveTheme(twice, prefersDark)).toBe(resolveTheme(choice, prefersDark));
      }
    }
  });
});

/**
 * El script del <head> es una copia de `resolveTheme` escrita a mano. Estas
 * pruebas lo ejecutan de verdad, con un DOM de mentira, para que las dos copias
 * no puedan separarse sin que algo se ponga rojo.
 */
function runInitScript(stored: string | null, prefersDark: boolean, breakStorage = false) {
  const root = {
    classList: {
      dark: false,
      toggle(name: string, on: boolean) {
        if (name === "dark") this.dark = on;
      },
    },
    style: { colorScheme: "" },
  };
  const sandbox = {
    localStorage: {
      getItem(key: string) {
        if (breakStorage) throw new Error("acceso denegado");
        return key === THEME_STORAGE_KEY ? stored : null;
      },
    },
    document: { documentElement: root },
    window: { matchMedia: (query: string) => ({ matches: query.includes("dark") && prefersDark }) },
  };
  runInNewContext(THEME_INIT_SCRIPT, sandbox);
  return root;
}

describe("THEME_INIT_SCRIPT", () => {
  it("decide lo mismo que resolveTheme en todos los casos", () => {
    for (const stored of ["light", "dark", "system", null, "basura"]) {
      for (const prefersDark of [true, false]) {
        const expected = resolveTheme(normalizeChoice(stored), prefersDark);
        const root = runInitScript(stored, prefersDark);
        expect({ stored, prefersDark, dark: root.classList.dark }).toEqual({
          stored,
          prefersDark,
          dark: expected === "dark",
        });
        expect(root.style.colorScheme).toBe(expected);
      }
    }
  });

  it("si localStorage está capado, cae en lo que pida el sistema sin reventar", () => {
    expect(runInitScript(null, true, true).classList.dark).toBe(true);
    expect(runInitScript(null, false, true).classList.dark).toBe(false);
  });
});
