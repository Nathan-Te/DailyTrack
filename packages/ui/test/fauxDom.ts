// Lot F2 : un petit DOM de test (le dépôt n'a ni jsdom ni happy-dom, et les composants sont du DOM construit à la main : `el`, `svg`). Il ne fait que ce que les composants des amis, `bouton`, `medaille` et `suivreDialogue`
// utilisent : éléments et texte, attributs, classes, `hidden`, `tabIndex`, `disabled`, `value`, événements avec propagation (capture et bulles), focus, sélecteurs simples (`tag`, `.classe`, `[attr]`, `[attr=val]`,
// `:not(:disabled)`, listes séparées par une virgule, descendants), `closest`. Un `textContent` n'est jamais du HTML : c'est ce que les tests vérifient.

type Ecouteur = { f: (e: FauxEvenement) => void; capture: boolean };

export class FauxEvenement {
  defaultPrevented = false;
  propagationArretee = false;
  target: FauxCible | null = null;
  currentTarget: FauxCible | null = null;
  constructor(
    readonly type: string,
    init: { bubbles?: boolean; key?: string; shiftKey?: boolean; relatedTarget?: unknown } = {},
  ) {
    this.bubbles = init.bubbles ?? true;
    this.key = init.key;
    this.shiftKey = init.shiftKey ?? false;
    this.relatedTarget = init.relatedTarget ?? null;
  }
  bubbles: boolean;
  key: string | undefined;
  shiftKey: boolean;
  relatedTarget: unknown;
  preventDefault(): void {
    this.defaultPrevented = true;
  }
  stopPropagation(): void {
    this.propagationArretee = true;
  }
}

class FauxCible {
  parentNode: FauxCible | null = null;
  private ecouteurs = new Map<string, Ecouteur[]>();
  addEventListener(type: string, f: (e: never) => void, option?: boolean | { capture?: boolean }): void {
    const capture = typeof option === "boolean" ? option : (option?.capture ?? false);
    const l = this.ecouteurs.get(type) ?? [];
    l.push({ f: f as Ecouteur["f"], capture });
    this.ecouteurs.set(type, l);
  }
  removeEventListener(type: string, f: (e: never) => void, option?: boolean | { capture?: boolean }): void {
    const capture = typeof option === "boolean" ? option : (option?.capture ?? false);
    this.ecouteurs.set(type, (this.ecouteurs.get(type) ?? []).filter((x) => !(x.f === (f as Ecouteur["f"]) && x.capture === capture)));
  }
  private appeler(e: FauxEvenement, quand: "capture" | "bulles" | "cible"): void {
    e.currentTarget = this;
    for (const x of [...(this.ecouteurs.get(e.type) ?? [])]) if (quand === "cible" || x.capture === (quand === "capture")) x.f(e);
  }
  dispatchEvent(e: FauxEvenement): boolean {
    e.target = this;
    const chemin: FauxCible[] = [];
    for (let n: FauxCible | null = this.parentNode; n; n = n.parentNode) chemin.push(n);
    for (const n of [...chemin].reverse()) {
      n.appeler(e, "capture");
      if (e.propagationArretee) return !e.defaultPrevented;
    }
    this.appeler(e, "cible");
    if (e.bubbles) {
      for (const n of chemin) {
        if (e.propagationArretee) break;
        n.appeler(e, "bulles");
      }
    }
    return !e.defaultPrevented;
  }
}

export class FauxTexte extends FauxCible {
  constructor(public data: string) {
    super();
  }
  get textContent(): string {
    return this.data;
  }
}

type Noeud = FauxElement | FauxTexte;

const SANS_TABULATION = new Set(["div", "p", "span", "ul", "li", "table", "tbody", "thead", "tr", "td", "th", "section", "h1", "h2", "h3", "label", "form", "svg", "path", "body", "html"]);

function correspond(e: FauxElement, simple: string): boolean {
  // Un sélecteur simple : tag, .classe, [attr], [attr=val], :not(...) mis bout à bout.
  let reste = simple.trim();
  while (reste) {
    let m: RegExpMatchArray | null;
    if ((m = reste.match(/^:not\((.+?)\)(?=$|[.[:])/))) {
      const interne = m[1]!;
      if (interne === ":disabled" ? e.disabled : correspond(e, interne)) return false;
    } else if ((m = reste.match(/^([a-zA-Z][a-zA-Z0-9]*)/))) {
      if (e.tagName !== m[1]!.toLowerCase()) return false;
    } else if ((m = reste.match(/^\.([\w-]+)/))) {
      if (!e.classList.contains(m[1]!)) return false;
    } else if ((m = reste.match(/^\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/))) {
      const v = e.getAttribute(m[1]!);
      const attendu = m[2] ?? m[3] ?? m[4];
      if (v === null || (attendu !== undefined && v !== attendu)) return false;
    } else throw new Error(`sélecteur non géré par le faux DOM : ${simple}`);
    reste = reste.slice(m[0].length);
  }
  return true;
}

export class FauxElement extends FauxCible {
  readonly tagName: string;
  readonly attrs = new Map<string, string>();
  noeuds: Noeud[] = [];
  valeur = "";
  readonly style = { setProperty: (_k: string, _v: string): void => undefined };
  constructor(tag: string, private readonly doc: FauxDocument) {
    super();
    this.tagName = tag.toLowerCase();
  }
  get classList() {
    const lire = () => (this.attrs.get("class") ?? "").split(/\s+/).filter(Boolean);
    return {
      add: (...c: string[]) => this.attrs.set("class", [...new Set([...lire(), ...c])].join(" ")),
      remove: (...c: string[]) => this.attrs.set("class", lire().filter((x) => !c.includes(x)).join(" ")),
      contains: (c: string) => lire().includes(c),
    };
  }
  get className(): string {
    return this.attrs.get("class") ?? "";
  }
  get id(): string {
    return this.attrs.get("id") ?? "";
  }
  get hidden(): boolean {
    return this.attrs.has("hidden");
  }
  set hidden(v: boolean) {
    if (v) this.attrs.set("hidden", "");
    else this.attrs.delete("hidden");
  }
  get disabled(): boolean {
    return this.attrs.has("disabled");
  }
  set disabled(v: boolean) {
    if (v) this.attrs.set("disabled", "");
    else this.attrs.delete("disabled");
  }
  get tabIndex(): number {
    const v = this.attrs.get("tabindex");
    if (v !== undefined) return Number(v);
    return SANS_TABULATION.has(this.tagName) || (this.tagName === "a" && !this.attrs.has("href")) ? -1 : 0;
  }
  set tabIndex(n: number) {
    this.attrs.set("tabindex", String(n));
  }
  get value(): string {
    return this.valeur;
  }
  set value(v: string) {
    this.valeur = v;
  }
  get lang(): string {
    return this.attrs.get("lang") ?? "";
  }
  setAttribute(k: string, v: string): void {
    this.attrs.set(k, String(v));
    if (k === "value") this.valeur = String(v);
  }
  getAttribute(k: string): string | null {
    return this.attrs.get(k) ?? null;
  }
  hasAttribute(k: string): boolean {
    return this.attrs.has(k);
  }
  removeAttribute(k: string): void {
    this.attrs.delete(k);
  }
  get children(): FauxElement[] {
    return this.noeuds.filter((n): n is FauxElement => n instanceof FauxElement);
  }
  get childElementCount(): number {
    return this.children.length;
  }
  get textContent(): string {
    return this.noeuds.map((n) => n.textContent).join("");
  }
  set textContent(v: string) {
    this.replaceChildren(String(v));
  }
  append(...enfants: (Noeud | string)[]): void {
    for (const e of enfants) {
      const n = typeof e === "string" ? new FauxTexte(e) : e;
      if (n.parentNode instanceof FauxElement) n.parentNode.noeuds = n.parentNode.noeuds.filter((x) => x !== n);
      n.parentNode = this;
      this.noeuds.push(n);
    }
  }
  replaceChildren(...enfants: (Noeud | string)[]): void {
    for (const n of this.noeuds) n.parentNode = null;
    this.noeuds = [];
    this.append(...enfants);
  }
  remove(): void {
    const p = this.parentNode;
    if (p instanceof FauxElement) p.noeuds = p.noeuds.filter((x) => x !== this);
    this.parentNode = null;
  }
  get isConnected(): boolean {
    for (let n: FauxCible | null = this; n; n = n.parentNode) if (n === this.doc) return true;
    return false;
  }
  contains(autre: unknown): boolean {
    for (let n = autre as FauxCible | null; n; n = n.parentNode) if (n === this) return true;
    return false;
  }
  matches(sel: string): boolean {
    return sel.split(",").some((s) => correspond(this, s));
  }
  closest(sel: string): FauxElement | null {
    for (let n: FauxCible | null = this; n instanceof FauxElement; n = n.parentNode) if (n.matches(sel)) return n;
    return null;
  }
  querySelectorAll(sel: string): FauxElement[] {
    const resultat: FauxElement[] = [];
    // Descendants (`a b`) : le dernier segment doit correspondre et un ancêtre le précédent.
    const alternatives = sel.split(",").map((s) => s.trim().split(/\s+/));
    const parcourir = (e: FauxElement) => {
      for (const enfant of e.children) {
        if (alternatives.some((seg) => correspond(enfant, seg[seg.length - 1]!) && seg.slice(0, -1).every((s) => enfant.closest(s) && enfant.parentNode instanceof FauxElement && !!(enfant.parentNode as FauxElement).closest(s)))) resultat.push(enfant);
        parcourir(enfant);
      }
    };
    parcourir(this);
    return resultat;
  }
  querySelector(sel: string): FauxElement | null {
    return this.querySelectorAll(sel)[0] ?? null;
  }
  getClientRects(): unknown[] {
    if (!this.isConnected) return [];
    for (let n: FauxCible | null = this; n instanceof FauxElement; n = n.parentNode) if (n.hidden) return [];
    return [{}];
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 10, bottom: 10, width: 10, height: 10 };
  }
  focus(): void {
    const avant = this.doc.activeElement;
    if (avant === this) return;
    this.doc.actif = this;
    if (avant && avant !== this.doc.body) avant.dispatchEvent(new FauxEvenement("focusout", { relatedTarget: this }));
    this.dispatchEvent(new FauxEvenement("focusin"));
  }
  blur(): void {
    if (this.doc.actif === this) {
      this.doc.actif = null;
      this.dispatchEvent(new FauxEvenement("focusout", { relatedTarget: null }));
    }
  }
  click(): void {
    if (!this.disabled) this.dispatchEvent(new FauxEvenement("click"));
  }
  select(): void {
    /* rien */
  }
  scrollIntoView(): void {
    /* rien */
  }
  /** Tape une touche sur l'élément (événement `keydown`). */
  toucheClavier(key: string, init: { shiftKey?: boolean } = {}): FauxEvenement {
    const e = new FauxEvenement("keydown", { key, ...init });
    this.dispatchEvent(e);
    return e;
  }
}

export class FauxDocument extends FauxCible {
  actif: FauxElement | null = null;
  readonly documentElement: FauxElement;
  readonly body: FauxElement;
  constructor() {
    super();
    this.documentElement = new FauxElement("html", this);
    this.documentElement.parentNode = this;
    this.documentElement.setAttribute("lang", "fr");
    this.body = new FauxElement("body", this);
    this.documentElement.append(this.body);
  }
  get activeElement(): FauxElement {
    return this.actif ?? this.body;
  }
  createElement(tag: string): FauxElement {
    return new FauxElement(tag, this);
  }
  createElementNS(_ns: string, tag: string): FauxElement {
    return new FauxElement(tag, this);
  }
  querySelectorAll(sel: string): FauxElement[] {
    return this.documentElement.querySelectorAll(sel);
  }
  querySelector(sel: string): FauxElement | null {
    return this.documentElement.querySelector(sel);
  }
  elementFromPoint(): FauxElement | null {
    return null;
  }
}

/** Installe un document vide et les globaux dont les composants ont besoin ; rend le document. À appeler dans un `beforeEach`. */
export function installerFauxDom(vi: { stubGlobal: (nom: string, valeur: unknown) => unknown }): FauxDocument {
  const doc = new FauxDocument();
  vi.stubGlobal("document", doc);
  vi.stubGlobal("HTMLElement", FauxElement);
  vi.stubGlobal("MutationObserver", class { observe(): void {} disconnect(): void {} });
  vi.stubGlobal("navigator", {});
  return doc;
}
