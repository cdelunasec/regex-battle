import { useRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

const INDENT = "    ";

/**
 * Inserta texto donde está el cursor sin romper el Ctrl+Z.
 *
 * Cambiar el valor del textarea desde React borra el historial de deshacer del
 * navegador: escribir, pulsar Tab y deshacer se llevaría todo lo escrito.
 * `insertText` pasa por el mismo camino que teclear, así que el historial se
 * conserva. Está marcado como obsoleto pero lo soportan todos los navegadores,
 * y si algún día falla, el fallback hace lo mismo sin historial.
 */
function insertAtCursor(
  textarea: HTMLTextAreaElement,
  text: string,
  onChange: (v: string) => void,
) {
  textarea.focus();
  if (document.execCommand("insertText", false, text)) return;

  const { selectionStart, selectionEnd, value } = textarea;
  const next = value.slice(0, selectionStart) + text + value.slice(selectionEnd);
  onChange(next);
  requestAnimationFrame(() => {
    textarea.selectionStart = textarea.selectionEnd = selectionStart + text.length;
  });
}

/** Dónde empieza y dónde termina la línea que contiene una posición. */
function lineBounds(value: string, position: number) {
  const start = value.lastIndexOf("\n", position - 1) + 1;
  const newline = value.indexOf("\n", position);
  return { start, end: newline === -1 ? value.length : newline };
}

/**
 * Un editor de código mínimo, hecho con un textarea.
 *
 * Sin librería a propósito: una dependencia nueva obliga a regenerar el
 * lockfile de bun, y eso aquí no se puede. Lo que trae es lo que se echa en
 * falta al escribir C# en un textarea pelado: números de línea para ubicar los
 * errores del compilador, y que Tab y Enter hagan lo que hacen en Visual
 * Studio en vez de saltar de campo o perder la sangría.
 */
export function CodeEditor({
  value,
  onChange,
  onSubmit,
  disabled = false,
  label,
  errorLines = [],
  minRows = 12,
}: {
  value: string;
  onChange: (value: string) => void;
  /** Ctrl+Enter. */
  onSubmit?: () => void;
  disabled?: boolean;
  label: string;
  /** Líneas con error de compilación, para marcarlas en el margen. */
  errorLines?: number[];
  minRows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = Math.max(value.split("\n").length, minRows);
  const errors = new Set(errorLines);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const textarea = event.currentTarget;
    const { selectionStart, selectionEnd, value: current } = textarea;

    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onSubmit?.();
      return;
    }

    if (event.key === "Tab" && !event.shiftKey && selectionStart === selectionEnd) {
      event.preventDefault();
      insertAtCursor(textarea, INDENT, onChange);
      return;
    }

    if (event.key === "Tab") {
      // Con selección, o con Shift, la sangría se aplica a líneas enteras.
      event.preventDefault();
      const first = lineBounds(current, selectionStart).start;
      const last = lineBounds(current, selectionEnd).end;
      const block = current.slice(first, last);

      const changed = block
        .split("\n")
        .map((line) =>
          event.shiftKey ? line.replace(new RegExp(`^ {1,${INDENT.length}}`), "") : INDENT + line,
        )
        .join("\n");

      textarea.setSelectionRange(first, last);
      insertAtCursor(textarea, changed, onChange);
      requestAnimationFrame(() => textarea.setSelectionRange(first, first + changed.length));
      return;
    }

    if (event.key === "Enter" && selectionStart === selectionEnd) {
      // La línea nueva conserva la sangría de la actual, y si la actual abre
      // un bloque con `{`, entra un nivel más.
      event.preventDefault();
      const { start } = lineBounds(current, selectionStart);
      const line = current.slice(start, selectionStart);
      const indentation = line.match(/^\s*/)?.[0] ?? "";
      const opensBlock = line.trimEnd().endsWith("{");
      insertAtCursor(textarea, "\n" + indentation + (opensBlock ? INDENT : ""), onChange);
      return;
    }

    if (event.key === "}" && selectionStart === selectionEnd) {
      // Una llave que cierra, escrita en una línea que solo tiene sangría,
      // vuelve un nivel atrás para quedar alineada con la que abrió.
      const { start } = lineBounds(current, selectionStart);
      const before = current.slice(start, selectionStart);
      if (before.length >= INDENT.length && /^\s+$/.test(before)) {
        event.preventDefault();
        textarea.setSelectionRange(start, selectionStart);
        insertAtCursor(textarea, before.slice(INDENT.length) + "}", onChange);
      }
    }
  }

  return (
    <div
      className={cn(
        "flex overflow-hidden rounded-md border bg-background font-mono text-sm focus-within:ring-2 focus-within:ring-ring/50",
        disabled && "opacity-60",
      )}
    >
      <div
        ref={gutterRef}
        aria-hidden
        className="shrink-0 overflow-hidden border-r bg-muted/40 py-3 text-right text-muted-foreground select-none"
      >
        {Array.from({ length: lineCount }, (_, index) => (
          <div
            key={index}
            className={cn(
              "px-2 leading-6 tabular-nums",
              errors.has(index + 1) && "bg-destructive/15 font-semibold text-destructive",
            )}
          >
            {index + 1}
          </div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        // El margen se desplaza con el texto, o los números dejarían de casar.
        onScroll={(event) => {
          if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
        }}
        disabled={disabled}
        aria-label={label}
        rows={lineCount}
        wrap="off"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        className="min-w-0 flex-1 resize-none overflow-x-auto bg-transparent px-3 py-3 leading-6 outline-none"
      />
    </div>
  );
}
