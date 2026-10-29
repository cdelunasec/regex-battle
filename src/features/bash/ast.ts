/**
 * La forma de un script una vez leído.
 *
 * Una palabra NO es un texto, es una lista de pedazos, y eso es lo que hace
 * que el resto funcione. En bash lo que decide el comportamiento no es lo que
 * dice una palabra sino de dónde salió cada pedazo: `$ruta` sin comillas se
 * parte en varias palabras si trae espacios, `"$ruta"` no, y `'$ruta'` ni
 * siquiera es una variable. Guardar solo el texto ya expandido perdería justo
 * lo que la lección de comillas tiene que enseñar.
 *
 * La gramática que se soporta, de menor a mayor precedencia:
 *
 *   list     := andOr ((';' | '&' | salto) andOr)*
 *   andOr    := pipeline (('&&' | '||') pipeline)*
 *   pipeline := ['!'] command ('|' command)*
 *   command  := simple | if | while | until | for | case | grupo | subshell
 *             | función | '[[' cond ']]' | '((' aritmética '))'
 *
 * Lo que queda fuera a propósito: sustitución de procesos `<(...)`, coprocesos,
 * `select`, y el control de trabajos, porque no hay trabajos que controlar.
 */

export type ParamOp =
  /** ${var:-otro} y ${var-otro}: un valor de respaldo. */
  | "default"
  /** ${var:=otro}: además lo deja asignado. */
  | "assign"
  /** ${var:?mensaje}: revienta si no hay valor. */
  | "error"
  /** ${var:+otro}: el alternativo, al revés que el de respaldo. */
  | "alternative"
  /** ${#var} */
  | "length"
  /** ${var#pat} y ${var##pat} */
  | "trimStart"
  /** ${var%pat} y ${var%%pat} */
  | "trimEnd"
  /** ${var/pat/rep} y ${var//pat/rep} */
  | "replace"
  /** ${var:desde:cuánto} */
  | "substring";

export interface WordPart {
  kind: "literal" | "param" | "command" | "arith";
  /**
   * Si venía dentro de comillas. Un pedazo entrecomillado no se parte en
   * palabras ni se expande como glob, y esa es toda la diferencia entre
   * `rm $archivo` y `rm "$archivo"`.
   */
  quoted: boolean;
  /** El texto literal, el nombre de la variable, o el código de dentro. */
  text: string;
  op?: ParamOp;
  /** Para ${var:-esto} y compañía, que a su vez pueden llevar expansiones. */
  args?: Word[];
  /** Que el modificador lleve dos puntos: `${var:-x}` no es `${var-x}`. */
  colon?: boolean;
  /** La forma larga: `##` en vez de `#`, `%%` en vez de `%`, `//` en vez de `/`. */
  greedy?: boolean;
  /** Para `${arr[@]}` y `${arr[1]}`. */
  index?: string;
}

export type Word = WordPart[];

export type RedirectOp =
  | ">"
  | ">>"
  | "<"
  /** `2>&1`: apuntar un descriptor a otro. */
  | ">&"
  | "<&"
  /** `<<<`: una sola línea por la entrada. */
  | "here-string"
  /** `<<TAG`: el bloque de texto hasta la etiqueta. */
  | "heredoc";

export interface Redirect {
  /** El descriptor de la izquierda. Por defecto 1 al escribir y 0 al leer. */
  fd?: number;
  op: RedirectOp;
  target?: Word;
  /** El cuerpo del heredoc, ya recortado si venía con `<<-`. */
  here?: Word;
}

export interface Assignment {
  name: string;
  value: Word;
  /** `arr=(uno dos)` */
  array?: Word[];
  /** `arr[2]=x` */
  index?: Word;
  /** `ruta+=":/opt"` */
  append?: boolean;
}

export interface SimpleCommand {
  type: "simple";
  assignments: Assignment[];
  words: Word[];
  redirects: Redirect[];
}

export interface PipelineNode {
  type: "pipeline";
  commands: Command[];
  /** `! comando`, que da vuelta el código de salida. */
  negated: boolean;
}

export interface AndOrNode {
  type: "andOr";
  left: Command;
  op: "&&" | "||";
  right: Command;
}

export interface ListNode {
  type: "list";
  commands: Command[];
}

export interface IfNode {
  type: "if";
  clauses: { condition: Command; body: Command }[];
  otherwise?: Command;
  redirects: Redirect[];
}

export interface LoopNode {
  type: "while";
  condition: Command;
  body: Command;
  /** `until` es el mismo bucle con la condición al revés. */
  until: boolean;
  redirects: Redirect[];
}

export interface ForNode {
  type: "for";
  name: string;
  /** `for x in a b c`. Sin la parte `in`, recorre los argumentos del script. */
  items: Word[] | null;
  body: Command;
  redirects: Redirect[];
}

export interface ForArithNode {
  type: "forArith";
  init: string;
  condition: string;
  step: string;
  body: Command;
  redirects: Redirect[];
}

export interface CaseNode {
  type: "case";
  subject: Word;
  branches: { patterns: Word[]; body: Command | null }[];
  redirects: Redirect[];
}

export interface GroupNode {
  /** `{ ...; }` corre en el mismo shell; `( ... )` en uno aparte. */
  type: "group" | "subshell";
  body: Command;
  redirects: Redirect[];
}

export interface FunctionNode {
  type: "function";
  name: string;
  body: Command;
}

export type CondExpr =
  | { type: "unary"; op: string; word: Word }
  | { type: "binary"; op: string; left: Word; right: Word }
  | { type: "and"; left: CondExpr; right: CondExpr }
  | { type: "or"; left: CondExpr; right: CondExpr }
  | { type: "not"; expr: CondExpr }
  /** Una palabra suelta dentro de `[[ ]]`: verdadera si no está vacía. */
  | { type: "word"; word: Word };

export interface CondNode {
  type: "cond";
  expr: CondExpr;
  redirects: Redirect[];
}

export interface ArithNode {
  type: "arithCommand";
  source: string;
  redirects: Redirect[];
}

export type Command =
  | SimpleCommand
  | PipelineNode
  | AndOrNode
  | ListNode
  | IfNode
  | LoopNode
  | ForNode
  | ForArithNode
  | CaseNode
  | GroupNode
  | FunctionNode
  | CondNode
  | ArithNode;

/** Una palabra de un solo pedazo literal, que es lo que más se arma a mano. */
export function literalWord(text: string, quoted = false): Word {
  return [{ kind: "literal", quoted, text }];
}

/** Si una palabra es texto fijo, devuelve ese texto. Útil para leer nombres. */
export function staticText(word: Word): string | null {
  let out = "";
  for (const part of word) {
    if (part.kind !== "literal") return null;
    out += part.text;
  }
  return out;
}
