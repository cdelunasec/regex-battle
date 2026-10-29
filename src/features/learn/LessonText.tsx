import { parseInline } from "./inline.ts";

/**
 * Prosa de lección, con los símbolos escritos como símbolos.
 *
 * Es un <span> y no un <p> para poder usarse también dentro de una frase, como
 * en la nota de un ejemplo o en una pista.
 */
export function LessonText({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((segment, index) =>
        segment.code ? (
          <code
            key={index}
            // break-normal porque un patrón partido en dos líneas se lee mal, y
            // whitespace-pre para que un ejemplo de espacio en blanco se vea.
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em] whitespace-pre text-foreground"
          >
            {segment.text}
          </code>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  );
}
