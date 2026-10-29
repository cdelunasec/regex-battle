/**
 * Código dentro de la prosa de una lección.
 *
 * Las lecciones enseñan símbolos, así que la explicación tiene que poder
 * escribirlos: `\d{4}` se lee de un vistazo y "un dígito con llaves y un cuatro
 * dentro" hay que traducirlo de vuelta mientras aprendes.
 *
 * El texto de las lecciones marca esos pedazos entre acentos graves, como en
 * markdown, y esto los separa. No es un markdown completo a propósito: aquí lo
 * único que hace falta es distinguir código de prosa.
 */

export type InlineSegment = {
  text: string;
  code: boolean;
};

/**
 * Un acento grave suelto, sin pareja, se queda como texto. Vale más una lección
 * con una tilde rara que una lección que no se pinta.
 */
export function parseInline(text: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  let rest = text;

  while (rest.length > 0) {
    const open = rest.indexOf("`");
    if (open === -1) break;

    const close = rest.indexOf("`", open + 1);
    if (close === -1) break;

    if (open > 0) segments.push({ text: rest.slice(0, open), code: false });
    segments.push({ text: rest.slice(open + 1, close), code: true });
    rest = rest.slice(close + 1);
  }

  if (rest.length > 0) segments.push({ text: rest, code: false });
  return segments;
}
