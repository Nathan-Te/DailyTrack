import type { CleCommune } from "./catalogue";
import { el, svg } from "./dom";
import { formatDateCourte, formatNumeroJour, majuscule } from "./formats";
import { LANGUES, type Langue, type Traducteur } from "./i18n";
import { icone } from "./icones";
import { astuceIphoneAPropos, basculerPleinEcran, pleinEcranActif, pleinEcranPossible, surChangementPleinEcran } from "./pleinEcran";

// Les composants de base de la charte « Cartouches » (lot I1) : des fonctions qui construisent des éléments du DOM portant les classes de
// `composants.css` (états : survol, appui qui s'enfonce, focus, désactivé). Aucune couleur, police ni chaîne d'interface en dur : les styles
// viennent des jetons, les textes du catalogue commun (`t`) ou de l'appelant (déjà traduits). Chaque composant est montré dans la vitrine `/ui/`.

/** Le traducteur que reçoivent les composants : au moins le catalogue commun. */
export type TraducteurCommun = Traducteur<CleCommune>;
export type Jeu = "track" | "jump";
export type TypeMedaille = "diamant" | "or" | "argent" | "bronze";
export const MEDAILLES: readonly TypeMedaille[] = ["diamant", "or", "argent", "bronze"];

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
      // Lot I6 : le code court (« FR ») se voit, le nom (« Français ») se lit ; pas d'`aria-label` qui ne contiendrait pas le texte visible (axe).
      const b = el(
        "button",
        { classe: "dj-choix-langue__bouton", attrs: { type: "button", "aria-pressed": String(l === o.langue), lang: l, "data-langue": l } },
        el("span", { attrs: { "aria-hidden": "true" }, texte: t.t(COURT[l]) }),
        el("span", { classe: "dj-cache", texte: t.t(NOM[l]) }),
      );
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

export interface OptionsBarreJeu {
  href: string;
  jour: number;
  numero?: number;
  /**
   * Lot I4 : un autre retour que « ‹ DU JOUR » — « ‹ TRACK » sur les écrans d'un jeu (réglages, classement, Salon…), qui ramène à l'accueil du jeu.
   * `onClick` : le retour est alors un bouton (il ne quitte pas la page) ; sans lui, un lien vers `href`.
   */
  retour?: { texte: string; ariaLabel: string; onClick?: () => void };
  /** Lot I7 : le bouton plein écran, à droite à côté de la date (l'accueil de chaque jeu : on se met en plein écran avant de jouer). Caché si le plein écran n'est pas possible. */
  pleinEcran?: boolean;
}

/** La barre des jeux : « ‹ DU JOUR » (lien vers le portail, 44 px) et, à droite en mono, la date et le numéro du jour. */
export function barreJeu(t: TraducteurCommun, o: OptionsBarreJeu): HTMLElement {
  const date = formatDateCourte(o.jour, t.langue, { capitale: true });
  const texte = o.numero !== undefined && o.numero > 0 ? t.t("barre.jour", { date, numero: formatNumeroJour(o.numero, t.langue) }) : majuscule(date, t.langue);
  const contenu = [icone("chevron", { taille: 18 }), el("span", { classe: "dj-logo dj-logo--petit", texte: o.retour?.texte ?? t.t("barre.retour") })];
  const ariaLabel = o.retour?.ariaLabel ?? t.t("barre.retour.aria");
  const retour = o.retour?.onClick
    ? el("button", { classe: "dj-barre-jeu__retour", attrs: { type: "button", "aria-label": ariaLabel } }, ...contenu)
    : el("a", { classe: "dj-barre-jeu__retour", attrs: { href: o.href, "aria-label": ariaLabel } }, ...contenu);
  if (o.retour?.onClick) retour.addEventListener("click", o.retour.onClick);
  const jour = el("span", { classe: "dj-barre-jeu__jour", texte });
  if (!o.pleinEcran) return el("header", { classe: "dj-barre-jeu" }, retour, jour);
  const plein = boutonPleinEcran({ t: (cle) => t.t(cle), classe: "dj-plein-ecran--barre" });
  return el("header", { classe: "dj-barre-jeu" }, retour, el("span", { classe: "dj-barre-jeu__droite" }, jour, plein));
}

// --- Plein écran (lot I7) ------------------------------------------------------------------------------------------------------------------------
// Les boutons et astuces du plein écran se relisent (état, textes) sur l'événement `maj` : `majPleinEcran()` le leur envoie — à chaque `fullscreenchange` (un seul
// abonnement au document) et quand un jeu change de langue (une barre redessinée à chaque langue ne laisse rien derrière elle : aucun registre).
const SELECTEUR_MAJ = ".dj-plein-ecran, .dj-astuce";
let abonne = false;

/** Relit l'état (plein écran en cours, textes) de tous les boutons et astuces du plein écran. */
export function majPleinEcran(): void {
  document.querySelectorAll(SELECTEUR_MAJ).forEach((e) => e.dispatchEvent(new Event("maj")));
}

function suivre(e: Element, maj: () => void): void {
  e.addEventListener("maj", maj);
  if (!abonne) {
    abonne = true;
    surChangementPleinEcran(majPleinEcran);
  }
}

export interface OptionsBoutonPleinEcran {
  /** La traduction du nom lu (`pleinEcran.entrer` / `pleinEcran.quitter`, du catalogue commun) : « Plein écran » / « Quitter le plein écran ». */
  t: (cle: "pleinEcran.entrer" | "pleinEcran.quitter") => string;
  /** L'identifiant du bouton (les tests et les outils le visent). */
  id?: string;
  /** Classes en plus (la plaque d'un jeu, ou `dj-plein-ecran--barre` pour la barre des jeux). */
  classe?: string | readonly (string | false | null | undefined)[];
  /** Un bouton à texte (la pause) au lieu de l'icône seule : le nom lu est alors le texte écrit, l'habillage celui de `classe`. */
  texte?: boolean;
}

/**
 * Le bouton plein écran : 44 px, icône au trait (quatre coins ; « quitter » : coins rentrants), `aria-pressed` et nom lu selon l'état, qui suit
 * `fullscreenchange`. **Caché** si le plein écran n'est pas possible (API absente, site ouvert comme application). Une seule logique : `pleinEcran.ts`.
 */
export function boutonPleinEcran(o: OptionsBoutonPleinEcran): HTMLButtonElement {
  const b = el("button", { classe: ["dj-plein-ecran", !o.texte && "dj-plein-ecran--icone", ...(typeof o.classe === "string" ? [o.classe] : (o.classe ?? []))], attrs: { type: "button", id: o.id } });
  b.hidden = !pleinEcranPossible();
  const maj = () => {
    const actif = pleinEcranActif();
    const nom = o.t(actif ? "pleinEcran.quitter" : "pleinEcran.entrer");
    b.setAttribute("aria-pressed", String(actif));
    if (o.texte) b.textContent = nom;
    else {
      b.setAttribute("aria-label", nom);
      b.replaceChildren(icone(actif ? "pleinEcranQuitter" : "pleinEcran", { taille: 20 }));
    }
  };
  maj();
  b.addEventListener("click", () => {
    b.blur();
    void basculerPleinEcran();
  });
  suivre(b, maj);
  return b;
}

/** Où se souvient-on que l'astuce de l'iPhone a été fermée (le stockage est celui de l'appelant : ce paquet n'y touche pas). */
export const CLE_ASTUCE_PLEIN_ECRAN = "cdj:astuce:plein-ecran";

export interface OptionsAstuceIphone {
  /** Les deux textes dans la langue courante. */
  textes: () => { astuce: string; fermer: string };
  /** Le stockage (lecture et écriture) ; indisponible : l'astuce revient à chaque visite, sans erreur. */
  stockage: Pick<Storage, "getItem" | "setItem">;
}

/**
 * Sur iPhone (pas de plein écran de page), une ligne courte : « Pour jouer en plein écran : Partager › Sur l'écran d'accueil ». Un bouton la ferme et
 * elle ne revient pas (mémorisé). `null` si elle n'a pas lieu d'être (autre appareil, mode application, déjà fermée).
 */
export function astuceIphone(o: OptionsAstuceIphone): HTMLElement | null {
  try {
    if (!astuceIphoneAPropos() || o.stockage.getItem(CLE_ASTUCE_PLEIN_ECRAN) === "1") return null;
  } catch {
    /* stockage indisponible : on la montre */
  }
  const texte = el("span", { classe: "dj-astuce__texte" });
  const fermer = el("button", { classe: "dj-astuce__fermer", attrs: { type: "button" } }, svgFermer());
  const racine = el("p", { classe: "dj-astuce", attrs: { role: "note" } }, texte, fermer);
  fermer.addEventListener("click", () => {
    try {
      o.stockage.setItem(CLE_ASTUCE_PLEIN_ECRAN, "1");
    } catch {
      /* tant pis : elle reviendra */
    }
    racine.remove();
  });
  const maj = () => {
    const { astuce, fermer: nom } = o.textes();
    texte.textContent = astuce;
    fermer.setAttribute("aria-label", nom);
  };
  maj();
  suivre(racine, maj);
  return racine;
}

/**
 * Lot R8 : « Nouveau départ : tout le monde repart de zéro. Bonne chance ! » — la ligne courte montrée **une fois** à un navigateur dont les données
 * de jeu ont été effacées par la remise à zéro du lancement (`lireNouveauDepart` de `@cdj/profile` dit s'il faut la montrer). Un bouton la ferme. Même
 * habillage que l'astuce de l'iPhone ; `role="status"` (annoncée sans prendre le focus).
 */
export function avisNouveauDepart(t: TraducteurCommun, o: { onFermer?: () => void } = {}): HTMLElement {
  const texte = el("span", { classe: "dj-astuce__texte" });
  const fermer = el("button", { classe: "dj-astuce__fermer", attrs: { type: "button" } }, svgFermer());
  const racine = el("p", { classe: "dj-astuce dj-astuce--depart", attrs: { role: "status" } }, texte, fermer);
  fermer.addEventListener("click", () => {
    racine.remove();
    o.onFermer?.();
  });
  const maj = () => {
    texte.textContent = t.t("nouveauDepart.message");
    fermer.setAttribute("aria-label", t.t("nouveauDepart.fermer"));
  };
  maj();
  suivre(racine, maj);
  return racine;
}

function svgFermer(): SVGSVGElement {
  return svg("svg", { attrs: { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", "stroke-width": 2.5, "stroke-linecap": "square", focusable: "false", "aria-hidden": "true" } }, svg("path", { attrs: { d: "M5 5l14 14M19 5 5 19" } }));
}

const NOM_MEDAILLE = { diamant: "medaille.diamant", or: "medaille.or", argent: "medaille.argent", bronze: "medaille.bronze" } as const;

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
