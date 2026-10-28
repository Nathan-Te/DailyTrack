import "./modale.css";
import { CATALOGUE_IPHONE } from "./catalogue.iphone";

// Lot 53 (plateforme) : l'iPhone n'a pas de plein écran de page — l'API Fullscreen n'y est ouverte qu'aux vidéos — ; le seul vrai plein écran est l'ajout du site à l'écran
// d'accueil. **L'aide** (`aidePleinEcran`) que le bouton « Plein écran » ouvre à la place du plein écran : le geste (Partager › Sur l'écran d'accueil), le profil qui se retrouve
// avec le code de transfert, un bouton pour copier ce code (s'il y a un profil) et le lien vers la page du profil. Un dialogue nommé dont le focus entre et revient.
// **À la demande, et sans rien importer du reste du socle** (ni `dom`, ni `i18n`, ni `icones`, ni `pleinEcran`) : un module à la demande qui importe un module du premier
// chargement fait éclater celui-ci en plusieurs fichiers (la compression par fichier se perd : +1,2 ko mesurés sur Track) ; ses petits outils sont donc les siens, et ce que
// l'application lui dit du profil lui est passé (`o.lienCode`, `o.code`). Il ne touche ni au stockage ni au réseau. « Retrouver mon profil » : `retrouver.ts`, à la demande aussi.

type Langue = "fr" | "en";
type Cle = keyof typeof CATALOGUE_IPHONE.fr;
type Params = Readonly<Record<string, string | number>>;

/** Les textes de ces écrans, dans la langue de la page (`<html lang>`, tenu à jour par chaque application) ; `{nom}` remplacé, pluriel choisi par `n`. */
export function textesIphone(): (cle: Cle, params?: Params) => string {
  const langue: Langue = document.documentElement.lang.toLowerCase().startsWith("en") ? "en" : "fr";
  const regles = new Intl.PluralRules(langue === "en" ? "en-US" : "fr-FR");
  return (cle, params) => {
    const v = CATALOGUE_IPHONE[langue][cle] as string | { other: string; one?: string };
    const texte = typeof v === "string" ? v : ((regles.select(Number(params?.n ?? 0)) === "one" ? v.one : undefined) ?? v.other);
    return texte.replace(/\{(\w+)\}/g, (m, nom: string) => String(params?.[nom] ?? m));
  };
}

/** Un élément HTML (classe, attributs, enfants : du texte ou des nœuds ; jamais de HTML écrit). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, classe: string | null, attrs: Record<string, string> = {}, ...enfants: (Node | string | null)[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const enfant of enfants) if (enfant !== null) e.append(enfant);
  return e;
}

/** Un écran en surimpression : voile, dialogue nommé, Échap et appui sur le voile le ferment, le focus entre et revient. Rend `{ dialogue, fermer }`. */
export function modale(nomId: string, contenu: Node[], onFermer?: () => void): { dialogue: HTMLElement; fermer: () => void } {
  const avant = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const dialogue = h("div", "dj-modale__dialogue", { role: "dialog", "aria-modal": "true", "aria-labelledby": nomId, tabindex: "-1" }, ...contenu);
  const racine = h("div", "dj-modale", {}, dialogue);
  const fermer = () => {
    if (!racine.isConnected) return;
    document.removeEventListener("keydown", surTouche, true);
    racine.remove();
    if (avant?.isConnected) avant.focus();
    onFermer?.();
  };
  const surTouche = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    fermer();
  };
  racine.addEventListener("pointerdown", (e) => {
    if (e.target === racine) fermer();
  });
  document.addEventListener("keydown", surTouche, true);
  document.body.append(racine);
  return { dialogue, fermer };
}

/** L'icône « Partager » de Safari (un carré ouvert et une flèche qui en sort), avec son nom lu : on la reconnaît sur l'écran du téléphone. */
function partager(nom: string): SVGSVGElement {
  const NS = "http://www.w3.org/2000/svg";
  const i = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", width: "22", height: "22", fill: "none", stroke: "currentColor", "stroke-linecap": "square", "stroke-linejoin": "miter", focusable: "false", role: "img", "aria-label": nom, class: "dj-modale__partage" })) i.setAttribute(k, v);
  for (const d of ["M8 10H5v11h14V10h-3", "M12 15V3M8 7l4-4 4 4"]) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    i.append(p);
  }
  return i;
}

export interface OptionsAide {
  /** L'adresse de la page du profil (le code de transfert y est affiché et copiable), relative à la page courante. */
  lienCode?: string;
  /** Le code de transfert de ce navigateur, ou `null` s'il n'a pas encore de profil. */
  code?: string | null;
  onFermer?: () => void;
}

/**
 * L'aide du bouton « Plein écran » sur iPhone : « Pour jouer en plein écran : touche [Partager] puis « Sur l'écran d'accueil ». Ton profil se retrouve avec ton code de
 * transfert. » ; « Copier mon code » (s'il y a un profil : le code part au presse-papiers, prêt à être collé dans l'application) et un lien vers le profil. Rend sa fermeture.
 */
export function aidePleinEcran(o: OptionsAide = {}): () => void {
  const t = textesIphone();
  const message = h("p", "dj-modale__message", { role: "status" });
  const copier = o.code ? h("button", "dj-bouton dj-bouton--secondaire", { type: "button" }, t("pleinEcran.aide.copier")) : null;
  copier?.addEventListener("click", () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(o.code!);
        message.textContent = t("pleinEcran.aide.copie");
      } catch {
        message.textContent = t("pleinEcran.aide.pasDeCopie");
      }
    })();
  });
  const lien = o.lienCode ? h("a", "dj-bouton dj-bouton--secondaire", { href: o.lienCode }, t("pleinEcran.aide.lien")) : null;
  const fermer = h("button", "dj-bouton dj-bouton--marque", { type: "button" }, t("pleinEcran.aide.fermer"));
  const m = modale(
    "dj-aide-titre",
    [
      h("h2", "dj-modale__titre", { id: "dj-aide-titre" }, t("pleinEcran.aide.titre")),
      h("p", "dj-modale__texte", {}, t("pleinEcran.aide.avant") + " ", partager(t("pleinEcran.aide.partager")), " " + t("pleinEcran.aide.apres")),
      h("p", "dj-modale__texte", {}, t("pleinEcran.aide.profil")),
      message,
      h("div", "dj-modale__actions", {}, copier, lien, fermer),
    ],
    o.onFermer,
  );
  fermer.addEventListener("click", m.fermer);
  (copier ?? lien ?? fermer).focus();
  return m.fermer;
}
