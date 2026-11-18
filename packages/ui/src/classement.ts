import type { CATALOGUE_CLASSEMENT } from "./catalogue.classement";
import type { TypeMedaille } from "./composants";
import { el, svg } from "./dom";
import type { Traducteur } from "./i18n";

// Lot U6 — le composant commun de classement : **un podium de trois marches, puis la liste**, le même format partout (le portail ; les jeux l'utiliseront au lot U7). Il est **pur** : il reçoit des places déjà
// prêtes (textes formatés, photos construites, valeurs et écarts écrits) et rend des éléments ; il ne lit ni le serveur, ni le stockage, ni l'adresse, et **il ne nomme aucun jeu** (le nom d'un jeu, d'une
// médaille ou d'un joueur est une donnée). Feuille : `classement.css` ; textes : `catalogue.classement.ts` ; logique pure (seuils, places gagnées) : `classementLogique.ts`.
// **À la demande, jamais dans `index.ts`** (un jeu ne le paie pas avant le lot U7). Aucun `innerHTML` : tout est en `textContent`.

export type TraducteurClassement = Traducteur<keyof typeof CATALOGUE_CLASSEMENT.fr & string>;

/** La taille que le visuel d'une place doit avoir : `premier` (marche du milieu), `suivant` (2e et 3e), `ligne` (la liste). L'appelant construit la photo ronde d'un joueur ou l'emblème carré d'un groupe à cette taille. */
export type TailleVisuel = "premier" | "suivant" | "ligne";

/** Une place du podium ou une ligne de la liste, déjà prête. */
export interface PlaceClassement {
  rang: number;
  /** Le rang dit aux lecteurs d'écran (« 1er »). */
  rangLu: string;
  nom: string;
  /** La photo ronde d'un joueur ou l'emblème carré d'un groupe, à la taille demandée (décorative : le nom est écrit). */
  visuel(taille: TailleVisuel): HTMLElement;
  /** Le temps (ou la hauteur, ou les points) de la vue, déjà écrit ; `null` : pas de résultat. */
  valeur: string | null;
  /** L'écart au premier, déjà écrit avec son signe (« +0,185 ») ; `null` pour le premier et pour qui n'a pas de résultat. */
  ecart: string | null;
  moi: boolean;
  /** L'étiquette de ta place (« Toi », « Ton groupe »), déjà traduite ; `null` pour les autres. */
  toi: string | null;
  /** Places gagnées (> 0) ou perdues (< 0) depuis la dernière visite ; `0` ou absent : rien. */
  mouvement?: number;
  /** Toucher la place ouvre sa feuille (jamais la tienne). */
  ouvrir?: (() => void) | null;
  /** Ou : la place est un lien (la page d'un groupe). Prime sur `ouvrir`. */
  lien?: string | null;
  /** Le rang écrit à la place du nombre (« – » pour un groupe qui n'est pas encore classé). */
  rangTexte?: string;
  /** Une ligne pâle, en pointillés : ce qui n'est pas (encore) classé. */
  pale?: boolean;
  /** Le repère d'un test ou d'un focus (`data-cle="ligne-<repere>"`). */
  repere?: string;
  /** Un groupe : les photos des trois membres qui comptent, déjà construites. */
  trio?: readonly HTMLElement[];
  /** Un petit emblème à côté du nom (le groupe d'un joueur). */
  embleme?: HTMLElement | null;
  /** Une phrase sous le nom, dans la liste (« 4 classés · les 3 meilleurs comptent »). */
  detail?: string | null;
  /** Ce qui s'ajoute entre le nom et la valeur dans la liste (les colonnes par jeu, sur ordinateur). */
  suite?: HTMLElement | null;
}

const MARCHES = [1, 2, 3] as const;
const COURONNE = "M3 23 L3 7 L12 15 L20 3 L28 15 L37 7 L37 23Z";

/** La couronne du premier : un dessin au trait (jetons seulement : la feuille la colore). */
function couronne(): SVGElement {
  return svg(
    "svg",
    { classe: "classement-couronne", attrs: { viewBox: "0 0 40 26", "aria-hidden": "true", focusable: "false" } },
    svg("path", { classe: "classement-couronne__corps", attrs: { d: COURONNE } }),
    svg("circle", { classe: "classement-couronne__gemme", attrs: { cx: 20, cy: 17, r: 2.6 } }),
  );
}

/** Les places gagnées (▲) ou perdues (▼) : un triangle dessiné, le nombre, et le texte entier pour les lecteurs d'écran. */
export function mouvement(t: TraducteurClassement, n: number): HTMLElement | null {
  if (!Number.isInteger(n) || n === 0) return null;
  const monte = n > 0;
  const abs = Math.abs(n);
  return el(
    "small",
    { classe: ["classement-mouvement", monte ? "classement-mouvement--monte" : "classement-mouvement--descend"] },
    svg("svg", { attrs: { viewBox: "0 0 10 8", width: 9, height: 7, "aria-hidden": "true", focusable: "false" } }, svg("path", { attrs: { d: monte ? "M5 0 10 8H0Z" : "M0 0H10L5 8Z" } })),
    el("span", { attrs: { "aria-hidden": "true" }, texte: String(abs) }),
    el("span", { classe: "dj-cache", texte: t.t(monte ? "classement.monte" : "classement.descend", { n: abs }) }),
  );
}

function ouvrirOuNon(p: PlaceClassement, classe: string, enfants: (HTMLElement | null)[]): HTMLElement {
  if (p.lien) return el("a", { classe: `classement-ligne__corps classement-ligne__bouton ${classe}`, attrs: { href: p.lien, "data-cle": `ligne-${p.repere ?? p.rang}` } }, ...enfants);
  const bouton = !!p.ouvrir;
  const corps = bouton
    ? el("button", { classe: `classement-ligne__corps classement-ligne__bouton ${classe}`, attrs: { type: "button", "aria-haspopup": "dialog", "data-cle": `ligne-${p.repere ?? p.rang}` } }, ...enfants)
    : el("div", { classe: `classement-ligne__corps ${classe}` }, ...enfants);
  if (p.ouvrir) corps.addEventListener("click", p.ouvrir);
  return corps;
}

const reperes = (p: PlaceClassement): Record<string, string> => ({ "data-rang": String(p.rang), ...(p.moi ? { "data-moi": "oui", "aria-current": "true" } : {}) });

/** Le nom, l'emblème de son groupe et l'étiquette de ta place : le premier enfant est le texte du nom (les tests le lisent). */
const nomDe = (p: PlaceClassement): HTMLElement => el("span", { classe: "classement-pseudo" }, p.nom, p.embleme ?? null, p.toi ? el("span", { classe: "classement-toi", texte: p.toi }) : null);

export interface OptionsPodium {
  /** Un podium de groupes : l'emblème est carré (la marche libre aussi). */
  groupes?: boolean;
  /** Un podium de panneau étroit (la colonne de droite du portail) : marches plus basses, couronne plus petite. */
  petit?: boolean;
  /** L'avance du premier sur le deuxième, écrite sans texte autour (« 0,185 s ») ; `null` : pas de deuxième. */
  avance?: string | null;
}

/**
 * Le podium : **toujours trois marches** (or, argent, bronze, de trois hauteurs), la couronne sur la première ; une marche sans personne est en pointillés et dit « Place à prendre ». `places` : les trois premières
 * lignes **dans l'ordre du classement** (1er, 2e, 3e : l'ordre des lecteurs d'écran, que la feuille range en 2e · 1er · 3e) ; moins de trois : les marches suivantes sont libres. Sous le 1er : « 0,185 s d'avance » ;
 * sous les deux autres : « +0,185 ». Une place est un bouton (sa feuille) sauf la tienne.
 * Les places libres sont des `div`, pas des éléments de liste : la liste ne contient que de vrais classés.
 */
export function podium(t: TraducteurClassement, places: readonly PlaceClassement[], o: OptionsPodium = {}): HTMLElement {
  const groupes = o.groupes === true;
  const reelles = MARCHES.flatMap((n) => {
    const p = places[n - 1];
    if (!p) return [];
    const taille: TailleVisuel = n === 1 ? "premier" : "suivant";
    const corps = ouvrirOuNon(p, "classement-place__corps", [
      el("span", { classe: "classement-place__photo" }, n === 1 ? couronne() : null, p.visuel(taille), el("span", { classe: "classement-rang classement-badge", texte: String(p.rang) }), el("span", { classe: "dj-cache", texte: p.rangLu })),
      nomDe(p),
      p.trio && p.trio.length > 0 ? el("span", { classe: "classement-trio" }, ...p.trio) : null,
      el("span", { classe: "classement-temps", texte: p.valeur ?? "" }),
      el("span", { classe: "classement-ecart", texte: n === 1 ? (o.avance ? t.t("classement.avance", { ecart: o.avance }) : "") : (p.ecart ?? "") }),
      el("span", { classe: "classement-marche", attrs: { "aria-hidden": "true" }, texte: String(n) }),
    ]);
    return [el("li", { classe: ["classement-ligne", "classement-place", `classement-place--${n}`, p.moi && "classement-ligne--moi", (p.ouvrir || p.lien) && "classement-ligne--touchable"], attrs: reperes(p) }, corps)];
  });
  const libres = MARCHES.filter((n) => !places[n - 1]).map((n) =>
    el(
      "div",
      { classe: ["classement-place", "classement-place--libre", `classement-place--${n}`] },
      el("span", { classe: "classement-place__photo" }, el("span", { classe: ["classement-libre__visuel", `classement-libre__visuel--${n === 1 ? "premier" : "suivant"}`, groupes && "classement-libre__visuel--carre"], attrs: { "aria-hidden": "true" }, texte: "?" })),
      el("span", { classe: "classement-pseudo classement-libre__nom", texte: t.t("classement.libre") }),
      el("span", { classe: "classement-temps", attrs: { "aria-hidden": "true" }, texte: " " }),
      el("span", { classe: "classement-ecart" }),
      el("span", { classe: "classement-marche", attrs: { "aria-hidden": "true" }, texte: String(n) }),
    ),
  );
  return el("div", { classe: ["classement-podium", groupes && "classement-podium--groupes", o.petit && "classement-podium--petit"], attrs: { role: "group", "aria-label": t.t("classement.podium.aria") } }, el("ol", { classe: "classement-podium__liste" }, ...reelles), ...libres);
}

export interface OptionsLigne {
  /** Le texte lu quand la ligne n'a pas de résultat (« pas fini », déjà traduit : le catalogue de l'application l'a) ; le tiret est décoratif. */
  absent: string;
}

/**
 * Une ligne de la liste : le rang (et, dessous, les places gagnées ou perdues), la photo, le nom (avec l'emblème de son groupe, l'étiquette de ta place, et dessous un détail), ce que `suite` ajoute (les colonnes
 * par jeu, sur ordinateur), puis le temps et, dessous, l'écart au premier. Ta ligne est surlignée.
 */
export function ligne(t: TraducteurClassement, p: PlaceClassement, o: OptionsLigne): HTMLElement {
  const valeur = p.valeur === null ? el("span", { classe: "classement-temps" }, el("span", { attrs: { "aria-hidden": "true" }, texte: "—" }), el("span", { classe: "dj-cache", texte: o.absent })) : el("span", { classe: "classement-temps", texte: p.valeur });
  const corps = ouvrirOuNon(p, "", [
    el("span", { classe: "classement-rang-bloc" }, el("span", { classe: "classement-rang", texte: p.rangTexte ?? String(p.rang) }), mouvement(t, p.mouvement ?? 0)),
    p.visuel("ligne"),
    el("span", { classe: "classement-qui" }, nomDe(p), p.detail ? el("span", { classe: "classement-detail", texte: p.detail }) : null),
    p.suite ?? null,
    el("span", { classe: "classement-valeur" }, valeur, p.ecart ? el("span", { classe: "classement-ecart", texte: p.ecart }) : null),
  ]);
  return el("li", { classe: ["classement-ligne", p.moi && "classement-ligne--moi", p.pale && "classement-ligne--pale", (p.ouvrir || p.lien) && "classement-ligne--touchable"], attrs: reperes(p) }, corps);
}

/** La ligne d'un seuil de médaille (« Or · 32,000 s ») : un point de la couleur de la médaille entre deux traits en pointillés. Entre deux listes, jamais dans une liste. */
export function seuil(type: TypeMedaille, texte: string): HTMLElement {
  return el("p", { classe: "classement-seuil", attrs: { "data-medaille": type } }, el("i", { classe: `classement-seuil__point classement-seuil__point--${type}`, attrs: { "aria-hidden": "true" } }), texte);
}

/**
 * Pose les lignes d'une liste en **plusieurs listes numérotées** (`ol start`), séparées par les lignes de seuil : `avant` donne, par position dans `lignes`, les éléments à poser juste avant cette ligne.
 * Sans rien à poser : une seule liste. Les lignes de seuil ne sont pas des éléments de liste : le nombre d'éléments reste celui des classés.
 */
export function listeAvecSeuils(lignes: readonly HTMLElement[], avant: ReadonlyMap<number, readonly HTMLElement[]>): HTMLElement[] {
  const sorties: HTMLElement[] = [];
  let courante: HTMLElement[] = [];
  const vider = (): void => {
    if (courante.length === 0) return;
    const debut = Number(courante[0]!.getAttribute("data-rang"));
    sorties.push(el("ol", { classe: "classement-liste", attrs: Number.isInteger(debut) && debut > 1 ? { start: debut } : {} }, ...courante));
    courante = [];
  };
  lignes.forEach((l, i) => {
    const a = avant.get(i);
    if (a && a.length > 0) {
      vider();
      sorties.push(...a);
    }
    courante.push(l);
  });
  vider();
  return sorties;
}
