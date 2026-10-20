import type { CleCommune } from "./catalogue";
import { el, svg } from "./dom";
import { formatDateCourte, formatNumeroJour, majuscule } from "./formats";
import { LANGUES, type Langue, type Traducteur } from "./i18n";
import { icone } from "./icones";

// Les composants de base de la charte « Cartouches » (lot I1) : des fonctions qui construisent des éléments du DOM portant les classes de
// `composants.css` (états : survol, appui qui s'enfonce, focus, désactivé). Aucune couleur, police ni chaîne d'interface en dur : les styles
// viennent des jetons, les textes du catalogue commun (`t`) ou de l'appelant (déjà traduits). Chaque composant est montré dans la vitrine `/ui/`.

/** Le traducteur que reçoivent les composants : au moins le catalogue commun. */
export type TraducteurCommun = Traducteur<CleCommune>;
export type Jeu = "track" | "jump";
export type TypeMedaille = "auteur" | "or" | "argent" | "bronze";
export const MEDAILLES: readonly TypeMedaille[] = ["auteur", "or", "argent", "bronze"];

/** Le logo `DU JOUR` : `grand` (barre du portail, sur son rectangle encre) ou `petit` (barre de retour des jeux, texte encre seul). */
export function logo(t: TraducteurCommun, { taille = "grand" }: { taille?: "grand" | "petit" } = {}): HTMLElement {
  return el("span", { classe: ["dj-logo", `dj-logo--${taille}`], texte: t.t("marque.logo") });
}

export type VarianteBouton = "marque" | "secondaire" | "track" | "jump";
export interface OptionsBouton {
  texte: string;
  variante?: VarianteBouton;
  /** Un lien (`a`) plutôt qu'un bouton. */
  href?: string;
  onClick?: (e: MouseEvent) => void;
  desactive?: boolean;
  ariaLabel?: string;
  pleineLargeur?: boolean;
  /** Classe d'état forcée (vitrine seulement) : `est-survol`, `est-appui`, `est-focus`. */
  etat?: string;
}

/** Un bouton : principal de marque (terre cuite), secondaire, principal Track (« Courir »), principal Jump (« Jouer »). */
export function bouton(o: OptionsBouton): HTMLAnchorElement | HTMLButtonElement {
  const classe = ["dj-bouton", `dj-bouton--${o.variante ?? "marque"}`, o.pleineLargeur && "dj-bouton--large", o.etat];
  const e = o.href !== undefined
    ? el("a", { classe, attrs: { href: o.desactive ? null : o.href, "aria-disabled": o.desactive ? "true" : null, "aria-label": o.ariaLabel, role: o.desactive ? "link" : null }, texte: o.texte })
    : el("button", { classe, attrs: { type: "button", disabled: !!o.desactive, "aria-label": o.ariaLabel }, texte: o.texte });
  if (o.onClick) e.addEventListener("click", (ev) => o.onClick!(ev as MouseEvent));
  return e;
}

export interface OptionsCartouche {
  /** Le jeu dont c'est la cartouche (coque Track ou Jump) ; absent : coque générique. */
  jeu?: Jeu;
  /** L'étiquette, fournie par le jeu (`etiquetteTrack`, `etiquetteJump`). */
  etiquette: HTMLElement;
  /** L'action sous l'étiquette (un `bouton`). */
  action?: HTMLElement;
  attrs?: Record<string, string>;
}

/** La cartouche : coque (stries de préhension, bordure, coins 12/3, ombre nette) et l'étiquette du jeu. */
export function cartouche(o: OptionsCartouche): HTMLElement {
  return el(
    "article",
    { classe: ["dj-cartouche", o.jeu && `dj-cartouche--${o.jeu}`], attrs: o.attrs },
    el("div", { classe: "dj-cartouche__stries", attrs: { "aria-hidden": "true" } }),
    o.etiquette,
    o.action ? el("div", { classe: "dj-cartouche__action" }, o.action) : null,
  );
}

export interface OptionsEtiquette {
  /** Le nom en capitales (`TRACK`, `JUMP`, du catalogue). */
  titre: string;
  /** Le numéro du jour, déjà écrit (`n° 12` / `#12`) ; absent si le jeu n'a pas encore commencé. */
  numero?: string;
  /** Une ligne de texte sous le titre. */
  texte?: string;
  /** Le niveau de titre (h2 par défaut). */
  niveau?: "h2" | "h3";
  /** Lot I2 : ce qui suit le texte dans l'étiquette (le statut du joueur sur le portail), fourni par l'appelant. */
  suite?: HTMLElement;
}

/** L'étiquette Track : asphalte, bandes de livrée à 115° sur le bord droit, nom en Barlow Condensed italique. */
export function etiquetteTrack(o: OptionsEtiquette): HTMLElement {
  return el(
    "div",
    { classe: ["dj-etiquette", "track-etiquette", "dj-sombre"] },
    el("div", { classe: "track-etiquette__livree", attrs: { "aria-hidden": "true" } }),
    el("div", { classe: "track-etiquette__tete" }, el(o.niveau ?? "h2", { classe: "track-etiquette__titre", texte: o.titre }), o.numero ? el("span", { classe: "track-etiquette__numero", texte: o.numero }) : null),
    o.texte ? el("p", { classe: "track-etiquette__texte", texte: o.texte }) : null,
    o.suite ? el("div", { classe: "track-etiquette__suite" }, o.suite) : null,
  );
}

/** Le petit dessin de l'étiquette Jump (le personnage qui saute au-dessus d'une scie) : décoratif, couleurs des jetons. */
function dessinJump(): SVGSVGElement {
  return svg(
    "svg",
    { classe: "jump-etiquette__dessin", attrs: { viewBox: "0 0 76 52", width: 76, height: 52, "aria-hidden": "true", focusable: "false" } },
    svg("rect", { classe: "jump-dessin__sol", attrs: { x: 0, y: 44, width: 76, height: 8 } }),
    svg("circle", { classe: "jump-dessin__danger", attrs: { cx: 52, cy: 40, r: 9 } }),
    svg("path", { classe: "jump-dessin__danger", attrs: { d: "M52 29l3 6 6-3-3 6 6 3-6 3 3 6-6-3-3 6-3-6-6 3 3-6-6-3 6-3-3-6 6 3z" } }),
    svg("rect", { classe: "jump-dessin__heros", attrs: { x: 14, y: 10, width: 16, height: 16, rx: 2 } }),
    svg("rect", { classe: "jump-dessin__oeil", attrs: { x: 23, y: 15, width: 3, height: 4 } }),
    svg("path", { classe: "jump-dessin__trajet", attrs: { d: "M6 30q6-14 16-18" } }),
  );
}

/** L'étiquette Jump : papier sur coque moutarde, nom en Lilita One, bordure épaisse. */
export function etiquetteJump(o: OptionsEtiquette): HTMLElement {
  return el(
    "div",
    { classe: ["dj-etiquette", "jump-etiquette"] },
    el(
      "div",
      { classe: "jump-etiquette__corps" },
      el("div", { classe: "jump-etiquette__tete" }, el(o.niveau ?? "h2", { classe: "jump-etiquette__titre", texte: o.titre }), o.numero ? el("span", { classe: "jump-etiquette__numero", texte: o.numero }) : null),
      o.texte ? el("p", { classe: "jump-etiquette__texte", texte: o.texte }) : null,
      o.suite ? el("div", { classe: "jump-etiquette__suite" }, o.suite) : null,
    ),
    dessinJump(),
  );
}

/** Une tuile : légende en capitales, valeur, sous-texte. */
export function tuile(o: { legende: string; valeur: string; sousTexte?: string; icone?: SVGSVGElement }): HTMLElement {
  return el(
    "div",
    { classe: "dj-tuile" },
    el("span", { classe: "dj-tuile__legende", texte: o.legende }),
    el("span", { classe: "dj-tuile__valeur" }, o.icone ?? null, o.valeur),
    o.sousTexte ? el("span", { classe: "dj-tuile__sous-texte", texte: o.sousTexte }) : null,
  );
}

/** L'afficheur encastré : légende et chiffres mono ambre (compte à rebours du portail au lot I2). */
export function afficheur(o: { legende: string; valeur: string }): HTMLElement {
  return el("div", { classe: ["dj-afficheur", "dj-sombre"] }, el("span", { classe: "dj-afficheur__legende", texte: o.legende }), el("span", { classe: "dj-afficheur__valeur", texte: o.valeur }));
}

/** Le choix de la langue : deux boutons de 44 px, `aria-pressed`. `onChange` reçoit la langue touchée. */
export function choixLangue(t: TraducteurCommun, o: { langue: Langue; onChange?: (l: Langue) => void }): HTMLElement {
  const COURT = { fr: "langue.fr.court", en: "langue.en.court" } as const;
  const NOM = { fr: "langue.fr.nom", en: "langue.en.nom" } as const;
  return el(
    "div",
    { classe: "dj-choix-langue", attrs: { role: "group", "aria-label": t.t("langue.groupe") } },
    ...LANGUES.map((l) => {
      const b = el("button", { classe: "dj-choix-langue__bouton", attrs: { type: "button", "aria-pressed": String(l === o.langue), lang: l, "aria-label": t.t(NOM[l]), "data-langue": l }, texte: t.t(COURT[l]) });
      b.addEventListener("click", () => {
        if (l !== o.langue) o.onChange?.(l);
      });
      return b;
    }),
  );
}

/** Les initiales d'un pseudo (deux premières lettres ou chiffres, en capitales). */
export function initiales(pseudo: string, langue: Langue): string {
  return [...pseudo.normalize("NFC").replace(/[^\p{L}\p{N}]/gu, "")].slice(0, 2).join("").toLocaleUpperCase(langue === "fr" ? "fr-FR" : "en-US");
}

/**
 * L'avatar : les initiales du pseudo s'il y en a un, sinon l'icône profil. Lot I2 : avec `href`, un lien vers le profil commun (cible de 44 px,
 * nommé « Ton profil… ») ; sans, une image (lot I1).
 */
export function avatar(t: TraducteurCommun, o: { pseudo: string | null; href?: string }): HTMLElement {
  const ini = o.pseudo ? initiales(o.pseudo, t.langue) : "";
  const nom = ini ? t.t("profil.avatar", { nom: o.pseudo! }) : t.t(o.href !== undefined ? "profil.ouvrir" : "profil.aucun");
  const contenu = ini ? el("span", { attrs: { "aria-hidden": "true" }, texte: ini }) : icone("profil", { taille: 22 });
  const classe = ["dj-avatar", !ini && "dj-avatar--vide", o.href !== undefined && "dj-avatar--lien"];
  return o.href !== undefined ? el("a", { classe, attrs: { href: o.href, "aria-label": nom } }, contenu) : el("span", { classe, attrs: { role: "img", "aria-label": nom } }, contenu);
}

/** La barre du portail : logo à gauche ; à droite le choix de langue et l'avatar (lot I2 : un lien vers le profil commun avec `profil`). */
export function barrePortail(t: TraducteurCommun, o: { langue: Langue; onLangue?: (l: Langue) => void; pseudo: string | null; profil?: string }): HTMLElement {
  return el(
    "header",
    { classe: "dj-barre-portail" },
    logo(t),
    el("div", { classe: "dj-barre-portail__droite" }, choixLangue(t, { langue: o.langue, onChange: o.onLangue }), avatar(t, { pseudo: o.pseudo, href: o.profil })),
  );
}

/** La barre des jeux : « ‹ DU JOUR » (lien vers le portail, 44 px) et, à droite en mono, la date et le numéro du jour. */
export function barreJeu(t: TraducteurCommun, o: { href: string; jour: number; numero?: number }): HTMLElement {
  const date = formatDateCourte(o.jour, t.langue, { capitale: true });
  const texte = o.numero !== undefined && o.numero > 0 ? t.t("barre.jour", { date, numero: formatNumeroJour(o.numero, t.langue) }) : majuscule(date, t.langue);
  return el(
    "header",
    { classe: "dj-barre-jeu" },
    el("a", { classe: "dj-barre-jeu__retour", attrs: { href: o.href, "aria-label": t.t("barre.retour.aria") } }, icone("chevron", { taille: 18 }), el("span", { classe: "dj-logo dj-logo--petit", texte: t.t("barre.retour") })),
    el("span", { classe: "dj-barre-jeu__jour", texte }),
  );
}

const NOM_MEDAILLE = { auteur: "medaille.auteur", or: "medaille.or", argent: "medaille.argent", bronze: "medaille.bronze" } as const;

/** Le nom d'une médaille dans la langue. */
export function nomMedaille(t: TraducteurCommun, type: TypeMedaille): string {
  return t.t(NOM_MEDAILLE[type]);
}

export interface OptionsMedaille {
  type: TypeMedaille;
  obtenue: boolean;
  /** `pastille` (pastille ronde + nom, une ligne) ou `case` (légende + valeur, grille des seuils). */
  forme?: "pastille" | "case";
  /** Le cadre : Track (pas encore = contour de la couleur, sur asphalte) ou Jump (pas encore = aplat neutre) ; marque par défaut. */
  jeu?: Jeu;
  /** La valeur sous la légende d'une case (le seuil : `31,500`). */
  valeur?: string;
}

/** Une médaille, obtenue ou pas encore : le nom toujours écrit (et dit aux lecteurs d'écran avec son état). */
export function medaille(t: TraducteurCommun, o: OptionsMedaille): HTMLElement {
  const nom = nomMedaille(t, o.type);
  const etat = t.t(o.obtenue ? "medaille.obtenue" : "medaille.pasEncore", { medaille: nom });
  const forme = o.forme ?? "pastille";
  const classe = ["dj-medaille", `dj-medaille--${forme}`, `dj-medaille--${o.type}`, o.obtenue ? "dj-medaille--obtenue" : "dj-medaille--pas-encore", o.jeu && `dj-medaille--${o.jeu}`];
  if (forme === "pastille") {
    return el("span", { classe, attrs: { role: "img", "aria-label": etat } }, el("span", { classe: "dj-medaille__pastille", attrs: { "aria-hidden": "true" } }), el("span", { classe: "dj-medaille__nom", attrs: { "aria-hidden": "true" }, texte: nom }));
  }
  return el(
    "div",
    { classe, attrs: { role: "group", "aria-label": etat } },
    el("span", { classe: "dj-medaille__nom", texte: majuscule(nom, t.langue) }),
    o.valeur !== undefined ? el("span", { classe: "dj-medaille__valeur", texte: o.valeur }) : null,
  );
}
