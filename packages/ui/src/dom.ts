// Petites fonctions de construction du DOM pour les composants (lot I1) : pas de framework, pas de gabarit HTML (aucun `innerHTML`). Le texte
// est toujours posé par `textContent`, depuis un catalogue (jamais une chaîne d'interface écrite ici).

export type Enfant = Node | string | null | undefined | false;

export interface Options {
  classe?: string | readonly (string | false | null | undefined)[];
  attrs?: Readonly<Record<string, string | number | boolean | null | undefined>>;
  texte?: string;
  style?: Readonly<Record<string, string>>;
}

function classes(c: Options["classe"]): string {
  if (!c) return "";
  return (typeof c === "string" ? [c] : c).filter(Boolean).join(" ");
}

function appliquer(e: Element, o: Options, enfants: Enfant[]): void {
  const c = classes(o.classe);
  if (c) e.setAttribute("class", c);
  for (const [k, v] of Object.entries(o.attrs ?? {})) {
    if (v === null || v === undefined || v === false) continue;
    e.setAttribute(k, v === true ? "" : String(v));
  }
  for (const [k, v] of Object.entries(o.style ?? {})) (e as HTMLElement | SVGElement).style.setProperty(k, v);
  if (o.texte !== undefined) e.textContent = o.texte;
  for (const enfant of enfants) if (enfant !== null && enfant !== undefined && enfant !== false) e.append(enfant);
}

/** Un élément HTML. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, o: Options = {}, ...enfants: Enfant[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  appliquer(e, o, enfants);
  return e;
}

const SVG = "http://www.w3.org/2000/svg";
/** Un élément SVG. */
export function svg<K extends keyof SVGElementTagNameMap>(tag: K, o: Options = {}, ...enfants: Enfant[]): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag);
  appliquer(e, o, enfants);
  return e;
}
