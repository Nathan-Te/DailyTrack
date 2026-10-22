// Retouche 38b — le panneau des réglages de la vitrine : le palier (1 | 2 | 3) et une case par pas, groupés par famille. Un seul état, partagé
// par la colonne « à la carte » et la vue en mouvement (le panneau est dessiné aux deux endroits). Outil interne, en français.
import { PAS, PAS_IDS, avecPas, palierDe, reglagesDuPalier, texteReglages, type Famille, type Palier, type Reglages } from "../scene/paliers";
import { TEXTES_PAS, TITRES_FAMILLES } from "./textesPaliers";

/** Les réglages courants et ceux qui les écoutent. */
export class EtatReglages {
  private ecoutes = new Set<(r: Reglages) => void>();
  constructor(private r: Reglages) {}
  get(): Reglages {
    return this.r;
  }
  set(r: Reglages) {
    if (PAS_IDS.every((id) => r[id] === this.r[id])) return;
    this.r = r;
    for (const f of this.ecoutes) f(r);
  }
  ecouter(f: (r: Reglages) => void): () => void {
    this.ecoutes.add(f);
    return () => this.ecoutes.delete(f);
  }
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, texte?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (texte !== undefined) e.textContent = texte;
  return e;
};

const FAMILLES: Famille[] = ["finition", "lumiere", "vie", "post"];

/** Dessine le panneau dans `parent` ; `prefixe` rend les identifiants uniques (le panneau existe en deux exemplaires). */
export function panneauReglages(parent: HTMLElement, etat: EtatReglages, prefixe: string) {
  parent.textContent = "";
  const choix = el("div", "segments");
  choix.setAttribute("role", "group");
  choix.setAttribute("aria-label", "Palier");
  const boutons = new Map<Palier, HTMLButtonElement>();
  for (const p of [1, 2, 3] as const) {
    const b = el("button", "segment", `Palier ${p}`);
    b.type = "button";
    b.dataset.palier = String(p);
    b.addEventListener("click", () => etat.set(reglagesDuPalier(p)));
    boutons.set(p, b);
    choix.append(b);
  }
  const resume = el("p", "reglages__resume");
  parent.append(choix, resume);
  const cases = new Map<string, HTMLInputElement>();
  for (const famille of FAMILLES) {
    const fs = el("fieldset", "reglages__famille");
    fs.append(el("legend", undefined, TITRES_FAMILLES[famille]));
    for (const pas of PAS.filter((p) => p.famille === famille)) {
      const id = `${prefixe}-${pas.id}`;
      const l = el("label", "reglages__pas");
      l.htmlFor = id;
      const c = el("input");
      c.type = "checkbox";
      c.id = id;
      c.dataset.pas = pas.id;
      c.addEventListener("change", () => etat.set(avecPas(etat.get(), pas.id, c.checked)));
      cases.set(pas.id, c);
      const texte = el("span", "reglages__texte");
      const t = TEXTES_PAS[pas.id];
      texte.append(el("strong", undefined, t.titre), document.createTextNode(` — ${t.detail}`));
      if (t.charte) texte.append(el("em", "reglages__charte", ` Charte : ${t.charte} — à toi de décider pour la scène.`));
      l.append(c, texte);
      fs.append(l);
    }
    parent.append(fs);
  }
  const maj = (r: Reglages) => {
    const p = palierDe(r);
    for (const [q, b] of boutons) b.setAttribute("aria-pressed", String(p === q));
    for (const [id, c] of cases) c.checked = r[id as keyof Reglages];
    resume.textContent = `Réglages : ${p ? `palier ${p}` : `à la carte (${texteReglages(r)})`}`;
  };
  maj(etat.get());
  etat.ecouter(maj);
}
