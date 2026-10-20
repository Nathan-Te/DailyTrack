import { ecrireLangue, lireLangue } from "@cdj/profile";
import { CATALOGUE_COMMUN, formatDate, formatDateCourte, formatNombre, formatNumeroJour, formatRang, formatTemps, traducteur, type Langue, type Parametres, type Traducteur } from "@cdj/ui";
import { CATALOGUE_TRACK } from "./catalogue";
import { gameStorage } from "./storage";

// La langue de DailyTrack (lot I4, charte § 7) : celle de la plateforme (`cdj:langue`, lue par `lireLangue` de `@cdj/profile` sur le stockage du jeu),
// les catalogues du jeu puis le catalogue commun de `@cdj/ui`, les formats du socle. Changer de langue (Réglages › Langue) l'écrit pour toute
// la plateforme (même clé que le portail) et met l'écran à jour **sans recharger** : le HTML du jeu porte `data-t="clé"` (re-rempli par
// `appliquerTextes`), chaque écran construit en JavaScript s'abonne par `onLangue` pour se redessiner, et `lier()` marque un élément dont le
// texte est une clé fixe (il se met à jour tout seul). Le jeu n'écrit aucune chaîne d'interface : tout passe par `t()` (test
// `packages/ui/test/chainesEnDur.test.ts`, `apps/web/test/catalogue.test.ts`).

function langueInitiale(): Langue {
  try {
    return lireLangue(gameStorage(), typeof navigator === "undefined" ? [] : navigator.languages).langue;
  } catch {
    return "fr"; // stockage refusé : la langue du navigateur sera relue au démarrage
  }
}
let langue: Langue = langueInitiale();
let traducteurCourant: Traducteur = traducteur(langue, CATALOGUE_TRACK as never, CATALOGUE_COMMUN);
const ecouteurs = new Set<(l: Langue) => void>();

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
  return traducteurCourant.t(cle, params);
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

/** Le nom d'un thème du jour (code de `@cdj/sim` : `stade`, `rallye`…). */
export const nomTheme = (code: string): string => t(`theme.${code}`);

/** S'abonne aux changements de langue ; rend la fonction qui se désabonne. */
export function onLangue(cb: (l: Langue) => void): () => void {
  ecouteurs.add(cb);
  return () => ecouteurs.delete(cb);
}

/**
 * Change la langue : l'écrit pour toute la plateforme (`cdj:langue`), met à jour `<html lang>`, le titre, les textes du HTML, puis prévient les écrans.
 * `ecrire: false` pour un essai qui ne doit rien mémoriser.
 */
export function setLangue(l: Langue, { ecrire = true }: { ecrire?: boolean } = {}): void {
  if (l === langue) return;
  langue = l;
  if (ecrire) ecrireLangue(gameStorage(), l);
  traducteurCourant = traducteur(l, CATALOGUE_TRACK as never, CATALOGUE_COMMUN);
  appliquerDocument();
  appliquerTextes();
  for (const cb of [...ecouteurs]) cb(l);
}

/** Texte et attributs des éléments `data-t="clé"` / `data-t-<attribut>="clé"` d'une zone (le HTML source n'a aucun texte : le build le pré-remplit en français). Paramètres : `data-p='{"jeu":"Jump"}'`. */
export function appliquerTextes(racine: ParentNode = document): void {
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
}

function parametresDe(e: HTMLElement): Parametres | undefined {
  if (!e.dataset.p) return undefined;
  try {
    return JSON.parse(e.dataset.p) as Parametres;
  } catch {
    return undefined;
  }
}

/** Marque un élément dont le texte est la clé `cle` : il suit les changements de langue sans autre code (`appliquerTextes`). Rend l'élément. */
export function lier<E extends HTMLElement>(e: E, cle: string, params?: Parametres, attribut?: string): E {
  if (attribut) {
    e.dataset[`t${attribut[0]!.toUpperCase()}${attribut.slice(1)}`] = cle;
    e.setAttribute(attribut, t(cle, params));
  } else {
    e.dataset.t = cle;
    e.textContent = t(cle, params);
  }
  if (params) e.dataset.p = JSON.stringify(params);
  return e;
}

// --- Formats du socle dans la langue courante : plus aucun formatage de nombre à la main ------------------------------------------------------
/** Un temps : `31,402 s` / `31.402 s` ; `1:02,345` au-delà d'une minute. */
export const fTemps = (ms: number): string => formatTemps(ms, langue);
/** Un écart signé à la milliseconde : `+0,412` / `−0,412` (en anglais `+0.412`). Le signe est écrit (la couleur seule ne porte pas l'information). */
export function fEcart(ms: number): string {
  const abs = Math.abs(Math.round(ms));
  const virgule = langue === "fr" ? "," : ".";
  return `${ms < 0 ? "−" : "+"}${Math.floor(abs / 1000)}${virgule}${String(abs % 1000).padStart(3, "0")}`;
}
/** Un rang : `1er`, `14e` / `1st`, `14th`. */
export const fRang = (n: number): string => formatRang(n, langue);
/** Un nombre au format de la langue (`1 284` / `1,284`). */
export const fNombre = (n: number, decimales = 0): string => formatNombre(n, langue, decimales);
/** Une date (numéro de jour civil de `@cdj/clock`) : « mardi 20 octobre » / « Tuesday, October 20 ». */
export const fDate = (jour: number, capitale = false): string => formatDate(jour, langue, { capitale });
/** Une date courte : « mar. 20 oct. » / « Tue, Oct 20 ». */
export const fDateCourte = (jour: number, capitale = false): string => formatDateCourte(jour, langue, { capitale });
/** Le numéro du circuit : `n° 12` / `#12`. */
export const fNumero = (n: number): string => formatNumeroJour(n, langue);

// --- Démarrage ---------------------------------------------------------------------------------------------------------------------------------
/** À appeler une fois au chargement : `<html lang>`, titre, description et textes du HTML dans la langue du joueur. */
export function demarrerLangue(): void {
  appliquerDocument();
  appliquerTextes();
}
