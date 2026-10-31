import { el } from "@cdj/ui";
import { blocJson, CURSEURS, type Curseur } from "./curseurs";
import { reglagesDeDepart, type ReglagesTune, reglagesEssai } from "./reglagesEssai";

// Les réglages de sensation (`?debug&tune`, lots T1 et T5) — l'outil de Nathan, en français, comme `?debug&tune` de Track et de Jump. **Chargé à la demande, seulement avec `?debug&tune`.** Les curseurs
// sont à Nathan : les valeurs de départ sont **provisoires**. Deux groupes (`curseurs.ts`) : la sensation et la physique (une partie qui en change un est une partie d'ESSAI : marquée « réglage d'essai »,
// jamais envoyée au classement ; ces valeurs s'appliquent à la partie suivante, « Recommencer »), puis le rendu et le son (immédiats, aucun effet sur la partie). Le bouton « Copier les valeurs » met
// un seul bloc JSON dans le presse-papiers (à coller dans le prompt du lot T5b). Rien n'est gardé dans le navigateur.

export { reglagesDeDepart, type ReglagesTune };

const nombre = (v: number, c: Curseur): string => (c.decimales !== undefined ? v.toFixed(c.decimales) : Number.isInteger(v) ? String(v) : v.toFixed(c.unite === "ms" ? 0 : 3).replace(/\.?0+$/, ""));

export interface OptionsTune {
  /** La demi-largeur de la plateforme du jour (huitièmes de mètre) : la valeur de départ du curseur de largeur. */
  demiJour: number;
  onRecommencer(): void;
  /** Une valeur du second groupe (ou une valeur quelconque) vient de changer. */
  onChange?(): void;
}

export function monterTune(racine: HTMLElement, r: ReglagesTune, o: OptionsTune): void {
  const resume = el("pre", { classe: "tune__resume", attrs: { id: "tune-resume" } });
  const essai = el("p", { classe: "tune__essai", attrs: { id: "tune-essai", role: "status" } });
  const maj = (): void => {
    resume.textContent = blocJson(r, o.demiJour);
    const e = reglagesEssai(r);
    essai.hidden = !e;
    essai.textContent = e ? "Réglage d'essai : cette partie ne sera pas classée." : "";
    o.onChange?.();
  };
  const ligne = (nom: string, min: number, max: number, pas: number, lire: () => number, ecrire: (v: number) => void, montrer: (v: number) => string, id: string): HTMLElement => {
    const valeur = el("output", { classe: "tune__valeur" });
    const champ = el("input", { attrs: { type: "range", min, max, step: pas, value: lire(), "aria-label": nom, id } }) as HTMLInputElement;
    const afficher = (): void => void (valeur.textContent = montrer(lire()));
    champ.addEventListener("input", () => {
      ecrire(Number(champ.value));
      afficher();
      maj();
    });
    afficher();
    return el("label", { classe: "tune__ligne" }, el("span", { texte: nom }), champ, valeur);
  };
  const dePanneau = (c: Curseur): HTMLElement => ligne(c.nom, c.min, c.max, c.pas, () => c.lire(r), (v) => c.ecrire(r, v), (v) => `${nombre(v, c)} ${c.unite}`.trim(), `tune-${c.cle}`);
  // La largeur de la plateforme : une valeur forcée pour essayer, sans toucher au générateur (le contenu du jour garde la sienne).
  const largeur = ligne(
    "Largeur de la plateforme",
    12,
    40,
    1,
    () => r.plateformeDemi8 ?? o.demiJour,
    (v) => (r.plateformeDemi8 = v === o.demiJour ? null : Math.round(v)),
    (v) => `${(v / 4).toFixed(2).replace(/\.?0+$/, "")} m${r.plateformeDemi8 === null ? " (jour)" : ""}`,
    "tune-plateformeDemi8",
  );
  const g1 = CURSEURS.filter((c) => c.groupe === 1).map(dePanneau);
  const g2 = CURSEURS.filter((c) => c.groupe === 2).map(dePanneau);
  const bouton = (texte: string, id: string, fn: () => void): HTMLButtonElement => {
    const b = el("button", { classe: "tune__bouton", attrs: { type: "button", id }, texte }) as HTMLButtonElement;
    b.addEventListener("click", () => {
      b.blur();
      fn();
    });
    return b;
  };
  const retour = el("span", { classe: "tune__retour", attrs: { role: "status", "aria-live": "polite" } });
  const copier = bouton("Copier les valeurs", "tune-copier", () => {
    const texte = blocJson(r, o.demiJour);
    const fini = (ok: boolean): void => void (retour.textContent = ok ? "Copié." : "Copie impossible : sélectionne le texte du bas.");
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(texte).then(() => fini(true), () => fini(false));
    else fini(false);
  });
  const recommencer = bouton("Recommencer avec ces réglages", "tune-recommencer", () => o.onRecommencer());
  const reinit = bouton("Réinitialiser", "tune-reinit", () => {
    const d = reglagesDeDepart();
    r.entrees = d.entrees;
    r.sim = d.sim;
    r.physique = d.physique;
    r.plateformeDemi8 = d.plateformeDemi8;
    r.rendu = d.rendu;
    for (const c of racine.querySelectorAll<HTMLInputElement>(".tune input[type=range]")) {
      const cle = c.id.replace(/^tune-/, "");
      const cur = CURSEURS.find((x) => x.cle === cle);
      c.value = String(cur ? cur.lire(r) : cle === "plateformeDemi8" ? o.demiJour : c.value);
      c.dispatchEvent(new Event("input"));
    }
    maj();
  });
  maj();
  racine.append(
    el(
      "details",
      { classe: "tune", attrs: { id: "tune", ...(typeof window !== "undefined" && window.innerHeight > 520 ? { open: true } : {}), "aria-label": "Réglages de sensation" } }, // fermé sur un petit écran (844 × 390) : le panneau couvre la tour
      el("summary", { classe: "tune__titre" }, el("strong", { texte: "Sensation (valeurs provisoires)" })),
      el("h3", { classe: "tune__groupe", texte: "Sensation et physique : parties d'essai" }),
      ...g1,
      largeur,
      el("h3", { classe: "tune__groupe", texte: "Rendu et son : sans effet sur la partie" }),
      ...g2,
      essai,
      el("div", { classe: "tune__boutons" }, recommencer, copier, reinit),
      retour,
      resume,
    ),
  );
}
