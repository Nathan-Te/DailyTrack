import { call, type FetchLike } from "./client";
import type { Langue } from "./langue";

// Lot N2 de la plateforme — le **message en direct** côté client (portail, Track, Jump) : lire le message actif (`GET /api/annonce`, une réponse **publique** gardée 30 s par le cache
// de Firebase Hosting, partagée par toutes les pages ouvertes), décider s'il s'affiche ici, et le relire **toutes les 60 s, seulement quand la page est visible et seulement tant que
// l'écran est de ceux où le bandeau a le droit d'être** (accueil, arrivée, pause ; jamais pendant une course ou un niveau : `suspendre()` arrête tout, minuterie, écoute et réseau).
// Pur côté décision (testé : `test/annonce.test.ts`) ; le réseau, le stockage, l'horloge et la minuterie sont injectés. Aucun DOM : le bandeau est `bandeauAnnonce` de `@cdj/ui`.
// Ne lève jamais : un serveur injoignable ou un stockage refusé n'est jamais un problème (pas de bandeau, rien ne casse).

/** Où un message s'affiche : le portail, Track ou Jump (le dossier du jeu sur le site). */
export type OuAnnonce = "portail" | "track" | "jump";
export type TonAnnonce = "information" | "important";

/** Le message en direct, tel que `GET /api/annonce` et `GET /api/portail/jour` le rendent. */
export interface Annonce {
  id: number;
  fr: string;
  en: string;
  ou: OuAnnonce[];
  ton: TonAnnonce;
  /** L'heure de fin, en millisecondes depuis 1970 (UTC). */
  fin: number;
}

/** Le message fermé sur cet appareil (son identifiant) : il revient si le message change (un autre identifiant). Réglage gardé : jamais effacé par « Nouveau départ ». */
export const ANNONCE_FERMEE_KEY = "cdj:annonce:fermee";
/** Une page ouverte relit le message toutes les 60 s (le cache de Hosting le garde 30 s : il est vu en 45 s en moyenne, 90 s au pire). */
export const ANNONCE_RELECTURE_MS = 60_000;

const OU: readonly string[] = ["portail", "track", "jump"];

/** Lit un message d'une réponse du serveur (illisible : `null`). Jamais du HTML : un texte reste un texte, posé en `textContent`. */
export function annonceDe(brut: unknown): Annonce | null {
  const o = brut as Partial<Record<keyof Annonce, unknown>> | null;
  if (!o || typeof o !== "object") return null;
  if (typeof o.id !== "number" || typeof o.fr !== "string" || typeof o.en !== "string" || typeof o.fin !== "number" || !Number.isFinite(o.fin)) return null;
  if (!Array.isArray(o.ou) || (o.ton !== "information" && o.ton !== "important")) return null;
  return { id: o.id, fr: o.fr, en: o.en, ou: o.ou.filter((x): x is OuAnnonce => typeof x === "string" && OU.includes(x)), ton: o.ton, fin: o.fin };
}

/** Le texte du message dans la langue (le français à défaut). */
export const texteDeAnnonce = (a: Annonce, langue: Langue): string => (langue === "en" && a.en !== "" ? a.en : a.fr);

/**
 * Faut-il montrer ce message **ici** ? Oui s'il est destiné à cet endroit, que son heure de fin n'est pas passée (`decalage` : l'heure du serveur moins celle de l'appareil,
 * pour ne pas se fier à une horloge fausse) et qu'il n'a pas été fermé sur cet appareil (`fermee` : l'identifiant gardé).
 */
export function annonceAffichable(a: Annonce | null, ou: OuAnnonce, maintenant: number, fermee: number | null, decalage = 0): Annonce | null {
  if (!a || !a.ou.includes(ou)) return null;
  if (a.fin <= maintenant + decalage) return null;
  return fermee === a.id ? null : a;
}

// --- Lecture --------------------------------------------------------------------------------------------------------------------------------
export interface LectureAnnonce {
  annonce: Annonce | null;
  /** L'heure du serveur moins celle de l'appareil, en ms (0 si le serveur ne la dit pas). */
  decalage: number;
}

/** Lit `GET /api/annonce`. `null` : pas de réponse (serveur injoignable, délai, réponse illisible) — le message d'avant reste ce qu'il était. */
export async function lireAnnonce(base: string, fetchImpl?: FetchLike, maintenant: () => number = Date.now): Promise<LectureAnnonce | null> {
  const envoi = maintenant();
  const r = await call<{ annonce?: unknown; maintenant?: unknown }>(base, "GET", "/api/annonce", undefined, 8000, undefined, fetchImpl);
  if (!r.ok || !r.data || typeof r.data !== "object" || !("annonce" in r.data)) return null;
  const recu = maintenant();
  const serveur = typeof r.data.maintenant === "string" ? Date.parse(r.data.maintenant) : NaN;
  return { annonce: annonceDe(r.data.annonce), decalage: Number.isFinite(serveur) ? serveur - (envoi + recu) / 2 : 0 };
}

// --- Le message fermé (stockage injecté, jamais d'exception) ---------------------------------------------------------------------------------
export type StockageAnnonce = Pick<Storage, "getItem" | "setItem">;

/** L'identifiant du message fermé sur cet appareil, ou `null` (jamais fermé, ou stockage refusé). */
export function lireAnnonceFermee(stockage: StockageAnnonce | null | undefined): number | null {
  try {
    const n = Number(stockage?.getItem(ANNONCE_FERMEE_KEY));
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Retient que ce message est fermé. Sans stockage : tant pis, il reviendra au prochain chargement (rien ne casse). */
export function ecrireAnnonceFermee(stockage: StockageAnnonce | null | undefined, id: number): void {
  try {
    stockage?.setItem(ANNONCE_FERMEE_KEY, String(id));
  } catch {
    /* stockage plein ou refusé */
  }
}

// --- La surveillance : relire toutes les 60 s, seulement visible, seulement là où le bandeau a le droit d'être ------------------------------------
export interface OptionsSurveillance {
  /** Le préfixe de l'API (`""` : la même origine). */
  base: string;
  ou: OuAnnonce;
  /** Appelé à chaque changement de ce qui est **affichable ici** (le message, ou `null`). Aussi appelé tout de suite à `activer()` avec ce qu'on savait déjà. */
  surChangement: (a: Annonce | null) => void;
  stockage?: StockageAnnonce | null;
  fetchImpl?: FetchLike;
  maintenant?: () => number;
  /** La page est-elle visible ? (`visibiliteDeLaPage().visible` de `@cdj/ui`). Toujours vrai par défaut. */
  visible?: () => boolean;
  /** S'abonner aux changements de visibilité (`visibiliteDeLaPage().surVisibilite`) ; rend de quoi se désabonner. Rien par défaut. */
  surVisibilite?: (rappel: () => void) => () => void;
  /** Minuterie injectée (tests). */
  minuterie?: { demarrer: (rappel: () => void, ms: number) => unknown; arreter: (id: unknown) => void };
  delaiMs?: number;
}

export interface Surveillance {
  /** L'écran est de ceux où le bandeau a le droit d'être (accueil, arrivée, pause) : montre ce qu'on savait, relit tout de suite, puis toutes les 60 s tant que la page est visible. */
  activer(): void;
  /** Une course ou un niveau commence (ou la page se cache pour de bon) : plus de minuterie, plus d'écoute, plus de réseau ; une réponse en vol est ignorée. */
  suspendre(): void;
  /** Le joueur ferme le bandeau : l'identifiant est retenu, le message ne revient que s'il change. */
  fermer(): void;
  /**
   * Le portail a déjà le message dans la réponse de `GET /api/portail/jour` (la seule requête de son chargement, règle du lot I3) : il le **sème** ici ; le premier `activer()`
   * ne relit pas tout de suite, la première relecture est dans 60 s.
   */
  semer(annonce: Annonce | null, decalage?: number): void;
  /** Ce qui est affichable ici maintenant. */
  courant(): Annonce | null;
  /** Pour les tests et les mesures : le nombre de lectures du réseau lancées. */
  lectures(): number;
}

export function surveillerAnnonce(o: OptionsSurveillance): Surveillance {
  const maintenant = o.maintenant ?? Date.now;
  // Le module ne touche jamais au document (pureté) : la page donne sa visibilité (`visibiliteDeLaPage` de `@cdj/ui`) ; sans elle, la page est toujours « visible ».
  const visible = o.visible ?? (() => true);
  const surVisibilite = o.surVisibilite ?? (() => () => {});
  const minuterie = o.minuterie ?? { demarrer: (f: () => void, ms: number) => setInterval(f, ms), arreter: (id: unknown) => clearInterval(id as ReturnType<typeof setInterval>) };
  const delai = o.delaiMs ?? ANNONCE_RELECTURE_MS;

  let connu: Annonce | null = null;
  let decalage = 0;
  let actif = false;
  let tour = 0; // change à chaque activation et à chaque suspension : une réponse d'un tour fini est ignorée
  let id: unknown = null;
  let desabonner: (() => void) | null = null;
  let derniereLecture = -Infinity;
  let lectures = 0;
  let semee = false;
  let vu: Annonce | null | undefined; // ce qu'on a annoncé à `surChangement` en dernier

  const courant = (): Annonce | null => annonceAffichable(connu, o.ou, maintenant(), lireAnnonceFermee(o.stockage), decalage);
  const annoncer = () => {
    const a = courant();
    if (vu !== undefined && vu?.id === a?.id) return;
    vu = a;
    o.surChangement(a);
  };

  async function lire(): Promise<void> {
    const moi = tour;
    derniereLecture = maintenant();
    lectures++;
    const l = await lireAnnonce(o.base, o.fetchImpl, maintenant);
    if (!actif || moi !== tour) return; // l'écran a changé pendant l'attente : rien n'est montré, rien n'est fait
    if (l) {
      connu = l.annonce;
      decalage = l.decalage;
    }
    annoncer();
  }

  const siVisible = () => {
    if (actif && visible()) void lire();
  };
  const auRetourDeVisibilite = () => {
    if (actif && visible() && maintenant() - derniereLecture >= delai) void lire();
  };

  return {
    activer() {
      if (actif) return;
      actif = true;
      tour++;
      vu = undefined;
      annoncer(); // ce qu'on savait déjà (une lecture récente), sans attendre le réseau
      if (visible() && !semee) void lire();
      semee = false;
      id = minuterie.demarrer(siVisible, delai);
      desabonner = surVisibilite(auRetourDeVisibilite);
    },
    suspendre() {
      if (!actif) return;
      actif = false;
      tour++;
      if (id !== null) minuterie.arreter(id);
      id = null;
      desabonner?.();
      desabonner = null;
    },
    fermer() {
      const a = courant();
      if (a) ecrireAnnonceFermee(o.stockage, a.id);
      annoncer();
    },
    semer(annonce, ecart = 0) {
      connu = annonce;
      decalage = ecart;
      semee = true;
      derniereLecture = maintenant();
      if (actif) annoncer();
    },
    courant,
    lectures: () => lectures,
  };
}
