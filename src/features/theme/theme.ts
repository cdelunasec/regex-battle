/**
 * El tema, sin React.
 *
 * La paleta oscura ya vive en `styles.css` bajo `.dark`. Lo único que falta es
 * decidir cuándo esa clase está puesta en el <html>, y eso se decide en dos
 * sitios distintos: aquí, para la app ya hidratada, y en el script del <head>,
 * que corre antes de que React exista para que no haya un fogonazo blanco.
 *
 * Por eso la lógica está en funciones puras: el test compara las dos copias.
 */

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "code-battle-theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Lo guardado puede ser cualquier cosa: una versión vieja de la app, o alguien
 * escribiendo en localStorage a mano. Lo que no se reconoce vuelve a seguir al
 * sistema, que es el valor por defecto.
 */
export function normalizeChoice(stored: string | null | undefined): ThemeChoice {
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function resolveTheme(choice: ThemeChoice, prefersDark: boolean): ResolvedTheme {
  if (choice === "system") return prefersDark ? "dark" : "light";
  return choice;
}

/**
 * El botón alterna contra lo que se está viendo, no contra lo guardado. Desde
 * "system" eso significa fijar un tema explícito, que es justo lo que espera
 * quien lo pulsa.
 */
export function toggleChoice(choice: ThemeChoice, prefersDark: boolean): ThemeChoice {
  return resolveTheme(choice, prefersDark) === "dark" ? "light" : "dark";
}

/**
 * `color-scheme` además de la clase: sin él el navegador pinta en claro lo que
 * dibuja él mismo (la barra de desplazamiento, el calendario de un date input)
 * y queda un marco blanco alrededor de una app oscura.
 */
export function applyTheme(root: HTMLElement, resolved: ResolvedTheme): void {
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

/**
 * La misma decisión, en el idioma del <head>: sin módulos, sin React y en una
 * sola línea, porque corre de forma bloqueante antes de pintar. Si localStorage
 * está capado (ventana privada, cookies bloqueadas) se cae al preferido del
 * sistema en vez de reventar la página.
 */
export const THEME_INIT_SCRIPT = `(function(){var s=null;try{s=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});}catch(e){}try{var d=s==="dark"||(s!=="light"&&window.matchMedia(${JSON.stringify(
  DARK_QUERY,
)}).matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
