import { TICK_RATE } from "@cdj/jump-sim";
import { ecrireLangue, lireLangue } from "@cdj/profile";
import { CATALOGUE_COMMUN_FR, cheminMentions, formatDate, formatDateCourte, formatDecompte, formatNombre, formatNumeroJour, formatRang, formatTemps, traducteur, type Catalogue, type Langue, type Parametres, type Traducteur } from "@cdj/ui";
import { CATALOGUE_FR } from "./catalogue.fr";
import { gameStorage } from "./storage";

// La langue de Jump (lot I5, charte § 7), sur le patron de Track (apps/web/src/i18n.ts, lot I4) : celle de la plateforme (`cdj:langue`, lue par
// `lireLangue` de `@cdj/profile`), les catalogues du jeu puis le catalogue commun de `@cdj/ui` (composants, erreurs du serveur, répliques des
// thèmes), les formats du socle. Changer de langue (Réglages › Langue) l'écrit pour toute la plateforme (même clé que le portail et Track) et met
// l'écran à jour **sans recharger** : le HTML du jeu porte `data-t="clé"` (re-rempli par `appliquerTextes`), chaque écran construit en JavaScript
// s'abonne par `onLangue`, et `lier()` marque un élément dont le texte est une clé fixe. Le jeu n'écrit aucune chaîne d'interface : tout passe par
// `t()` (test `packages/ui/test/chainesEnDur.test.ts`, `apps/jump/test/catalogue.test.ts`).

function langueInitiale(): Langue {
  try {
    return lireLangue(gameStorage(), typeof navigator === "undefined" ? [] : navigator.languages).langue;
  } catch {
    return "fr"; // stockage refusé : la langue du navigateur sera relue au démarrage
  }
}
let langue: Langue = langueInitiale();
/** Le catalogue anglais : un autre fichier, chargé à la demande (`chargerLangue`) pour ne pas peser sur le premier chargement des joueurs en français. */
let anglais: Catalogue | null = null;
/** Lot I6 : l'anglais du catalogue commun, chargé avec celui du jeu (le même `import()`). */
let communAnglais: Catalogue | null = null;
function creerTraducteur(l: Langue): Traducteur {
  // Le français est toujours là ; l'anglais seulement une fois chargé (sans lui, une clé s'écrit telle quelle : `chargerLangue` doit précéder le premier écran).
  return traducteur(l, { fr: CATALOGUE_FR, en: anglais ?? {} } as never, { fr: CATALOGUE_COMMUN_FR, en: communAnglais ?? {} } as never);
}
let traducteurCourant: Traducteur = creerTraducteur(langue);

/** Charge ce que la langue demande (l'anglais : son catalogue, un fichier à part) ; au démarrage et avant tout changement de langue. Ne lève jamais. */
export async function chargerLangue(l: Langue = langue): Promise<boolean> {
  if (l === "fr" || anglais) return true;
  try {
    const m = await import("./catalogue.en");
    anglais = m.CATALOGUE_EN;
    communAnglais = m.CATALOGUE_COMMUN_EN;
    if (l === langue) traducteurCourant = creerTraducteur(langue);
    return true;
  } catch {
    return false;
  }
}
const ecouteurs = new Set<(l: Langue) => void>();

/** Le titre de la page (« Jump — Du Jour ») et sa description suivent la langue. */
function appliquerDocument(): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = langue;
  document.title = t("page.titre");
  document.querySelector('meta[name="description"]')?.setAttribute("content", t("page.description"));
}

/** La langue courante (`fr` ou `en`). */
export const langueCourante = (): Langue => langue;

/** Le texte d'une clé dans la langue courante, paramètres remplacés (`{n}` choisit aussi la forme plurielle). Une clé absente rend la clé. */
export function t(cle: string, params?: Parametres): string {
  // Lot M2 : les aides citent les touches CHOISIES (`{sauter}`) : le jeu fournit leurs noms (`definirParametresCommuns`), lus à chaque appel.
  return traducteurCourant.t(cle, paramsCommuns && /^(commandes\.|aide\.|hud\.astuces|bandeau\.aide|arrivee\.aideClavier)/.test(cle) ? { ...paramsCommuns(), ...params } : params);
}

let paramsCommuns: (() => Parametres) | null = null;
/** Lot M2 : les paramètres que les clés d'aide reçoivent en plus de ceux de l'appelant : les touches CHOISIES (`commandes.ts` les fournit ; i18n n'importe pas les commandes : le Node des e2e charge ce module). */
export function definirParametresCommuns(f: () => Parametres): void {
  paramsCommuns = f;
}

/** La clé existe-t-elle (jeu ou catalogue commun) ? Sert aux codes d'erreur venus du serveur. */
export const aCle = (cle: string): boolean => traducteurCourant.t(cle) !== cle;

/** Le traducteur courant, à passer aux composants de `@cdj/ui` (`barreJeu`, `medaille`, `choixLangue`…). Lu à chaque appel : il suit la langue. */
export const traducteurDuSocle = (): Traducteur<never> => traducteurCourant as Traducteur<never>;

/** Le texte d'une erreur de l'API : celle du serveur (`erreur.<code>`, catalogue commun) ou locale (réseau, délai). Le `message` du serveur n'est plus lu. */
export function messageErreur(code: string): string {
  if (aCle(`erreur.${code}`)) return t(`erreur.${code}`);
  if (aCle(`erreur.local.${code}`)) return t(`erreur.local.${code}`);
  return t("erreur.local.inconnue");
}

/** Le nom d'un thème de Jump (code de `@cdj/jump-sim` : `foret`, `usine`…). */
export const nomTheme = (code: string): string => t(`theme.${code}`);
/** La réplique d'un thème (catalogue commun : `jump.replique.<thème>`, la même que sur le portail). */
export const repliqueTheme = (code: string): string => (aCle(`jump.replique.${code}`) ? t(`jump.replique.${code}`) : t("accueil.accroche"));

/** S'abonne aux changements de langue ; rend la fonction qui se désabonne. */
export function onLangue(cb: (l: Langue) => void): () => void {
  ecouteurs.add(cb);
  return () => ecouteurs.delete(cb);
}

/**
 * Change la langue : l'écrit pour toute la plateforme (`cdj:langue`), met à jour `<html lang>`, le titre, les textes du HTML, puis prévient les écrans.
 * `ecrire: false` pour un essai qui ne doit rien mémoriser (tests).
 */
export function setLangue(l: Langue, { ecrire = true }: { ecrire?: boolean } = {}): Promise<void> {
  if (l === langue) return Promise.resolve();
  const appliquer = () => {
    langue = l;
    if (ecrire) ecrireLangue(gameStorage(), l);
    traducteurCourant = creerTraducteur(l);
    appliquerDocument();
    appliquerTextes();
    for (const cb of [...ecouteurs]) cb(l);
  };
  if (l === "fr" || anglais) {
    appliquer();
    return Promise.resolve();
  }
  // L'anglais pas encore chargé : on attend son fichier (hors ligne et pas encore là : on reste dans la langue d'avant).
  return chargerLangue(l).then((ok) => {
    if (ok) appliquer();
  });
}

/** Texte et attributs des éléments `data-t="clé"` / `data-t-<attribut>="clé"` d'une zone (le HTML source n'a aucun texte : le build le pré-remplit en français). Paramètres : `data-p='{"n":3}'`. */
export function appliquerTextes(racine: ParentNode | null = typeof document === "undefined" ? null : document): void {
  if (!racine) return; // Vitest (Node) : pas de page
  for (const e of racine.querySelectorAll<HTMLElement>("[data-t]")) {
    const texte = t(e.dataset.t!, parametresDe(e));
    if (e.textContent !== texte) e.textContent = texte;
  }
  for (const e of racine.querySelectorAll<HTMLElement>("*")) {
    for (const nom of e.getAttributeNames()) {
      if (!nom.startsWith("data-t-")) continue;
      e.setAttribute(nom.slice("data-t-".length), t(e.getAttribute(nom)!, parametresDe(e)));
    }
  }
  // Lot I6 : les liens « Mentions légales » (`data-mentions`) ouvrent la page de la langue choisie (`/mentions-legales/` ou `/legal/`).
  for (const e of racine.querySelectorAll<HTMLElement>("[data-mentions]")) e.setAttribute("href", cheminMentions(langue, "../"));
}

function parametresDe(e: HTMLElement): Parametres | undefined {
  if (!e.dataset.p) return undefined;
  try {
    return JSON.parse(e.dataset.p) as Parametres;
  } catch {
    return undefined;
  }
}

/** Marque un élément dont le texte (ou l'attribut `attribut`) est la clé `cle` : il suit les changements de langue sans autre code (`appliquerTextes`). Rend l'élément. */
export function lier<E extends HTMLElement>(e: E, cle: string, params?: Parametres, attribut?: string): E {
  if (attribut) {
    e.setAttribute(`data-t-${attribut}`, cle);
    e.setAttribute(attribut, t(cle, params));
  } else {
    e.dataset.t = cle;
    e.textContent = t(cle, params);
  }
  if (params) e.dataset.p = JSON.stringify(params);
  else delete e.dataset.p;
  return e;
}


/** Lot I6 : un lien vers les mentions légales de la langue choisie (`../mentions-legales/` ou `../legal/`), qui suit les changements de langue. Rend l'élément. */
export function lierMentions<E extends HTMLElement>(e: E): E {
  e.dataset.mentions = "";
  e.setAttribute("href", cheminMentions(langue, "../"));
  return e;
}
// --- Formats du socle dans la langue courante : plus aucun formatage de nombre à la main ------------------------------------------------------
/** Un temps en millisecondes : `31,402 s` / `31.402 s` ; `1:02,345` au-delà d'une minute. */
export const fTemps = (ms: number): string => formatTemps(ms, langue);
/** Un temps en pas de simulation (120 par seconde), au format de la langue. */
export const fTicks = (ticks: number): string => formatTemps(Math.round((ticks * 1000) / TICK_RATE), langue);
/** Un temps en pas, sans l'unité (la bande du HUD : `12,442`). */
export function fChrono(ticks: number): string {
  return fTicks(ticks).replace(/ s$/, "");
}
/** Un écart signé en pas : `+1,204` / `−0,412` (en anglais `+1.204`). Le signe est écrit : la couleur seule ne porte pas l'information. */
export function fEcart(ticks: number): string {
  const ms = Math.round((Math.abs(ticks) * 1000) / TICK_RATE);
  const virgule = langue === "fr" ? "," : ".";
  return `${ticks < 0 ? "−" : "+"}${Math.floor(ms / 1000)}${virgule}${String(ms % 1000).padStart(3, "0")}`;
}
/** Un rang : `1er`, `14e` / `1st`, `14th`. */
export const fRang = (n: number): string => formatRang(n, langue);
/** Un nombre au format de la langue (`1 284` / `1,284`). */
export const fNombre = (n: number, decimales = 0): string => formatNombre(n, langue, decimales);
/** Une date (numéro de jour civil de `@cdj/clock`) : « mardi 20 octobre » / « Tuesday, October 20 ». */
export const fDate = (jour: number, capitale = false): string => formatDate(jour, langue, { capitale });
/** Une date courte : « mar. 20 oct. » / « Tue, Oct 20 ». */
export const fDateCourte = (jour: number, capitale = false): string => formatDateCourte(jour, langue, { capitale });
/** Le numéro du niveau : `n° 12` / `#12`. */
export const fNumero = (n: number): string => formatNumeroJour(n, langue);
/** Un décompte : `07:42:09`. */
export const fDecompte = (ms: number): string => formatDecompte(ms);

// --- Démarrage ---------------------------------------------------------------------------------------------------------------------------------
/** À appeler une fois au chargement, **après** `await chargerLangue()` : `<html lang>`, titre, description et textes du HTML dans la langue du joueur. */
export function demarrerLangue(): void {
  traducteurCourant = creerTraducteur(langue);
  appliquerDocument();
  appliquerTextes();
}
