import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  DARK_QUERY,
  normalizeChoice,
  resolveTheme,
  THEME_STORAGE_KEY,
  toggleChoice,
  type ThemeChoice,
} from "./theme.ts";

function readChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    return normalizeChoice(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function storeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Sin almacenamiento el tema dura lo que dure la pestaña. Es peor no poder
    // cambiarlo que no poder recordarlo.
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches;
}

/**
 * El estado del tema para la interfaz.
 *
 * Ojo con lo que NO hace: no devuelve el tema que se está viendo para pintarlo.
 * En el servidor no hay forma de saberlo, así que devolverlo obligaría a esperar
 * al montaje y el botón parpadearía. Quien tenga que verse distinto en oscuro lo
 * pide por CSS con `dark:`, que ya está resuelto antes de que React hidrate.
 */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice);

  const choose = useCallback((next: ThemeChoice) => {
    setChoice(next);
    storeChoice(next);
    applyTheme(document.documentElement, resolveTheme(next, systemPrefersDark()));
  }, []);

  const toggle = useCallback(() => {
    setChoice((current) => {
      const next = toggleChoice(current, systemPrefersDark());
      storeChoice(next);
      applyTheme(document.documentElement, resolveTheme(next, systemPrefersDark()));
      return next;
    });
  }, []);

  // Mientras se siga al sistema, cambiar el tema del sistema cambia el de la
  // app en el momento, sin recargar.
  useEffect(() => {
    if (choice !== "system") return;
    const media = window.matchMedia(DARK_QUERY);
    const sync = () => applyTheme(document.documentElement, resolveTheme("system", media.matches));
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [choice]);

  return { choice, choose, toggle };
}
