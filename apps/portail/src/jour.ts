import { parisDay, parisDayStart } from "@cdj/clock";
import { annonceDe, generationDeReponse, type Annonce } from "@cdj/profile";

// Lot I2 : ce que le portail lit du serveur (`GET /api/portail/jour`, une requête au chargement) et le compte à rebours. Pur (le réseau et
// l'horloge sont passés) : testé dans `test/jour.test.ts`.

export type Medaille = "author" | "gold" | "silver" | "bronze";

/** Lot TP : le score d'un jeu classé à la hauteur (Tower) : la hauteur en millimètres entiers et les vies restantes. */
export interface ScoreHauteur {
  unite: "mm";
  valeur: number;
  vies: number;
}

export type Etat =
  | { statut: "pas_joue" }
  | { statut: "en_cours"; morts?: number }
  /** `tempsMs` : le temps du jeu (au chrono) ou, pour un jeu à la hauteur, la durée de la partie ; `score` n'existe que pour un jeu à la hauteur. */
  | { statut: "fini"; tempsMs: number; medaille: Medaille | null; rang: number; classes: number; score?: ScoreHauteur };

export interface JeuDuJour {
  /** Le code du jeu au registre du serveur (`cdj`, `jump`). */
  jeu: string;
  /** Lot I3 : son dossier sur le site (`track`, `jump`) et son nom : « Jeu suivant du jour » n'a besoin d'aucune connaissance d'un jeu. */
  site?: string;
  nom?: string;
  numero: number;
  /** Lot TP : `"mm"` pour un jeu classé à la hauteur (Tower : seuils en millimètres, score `{ valeur, vies }`) ; absent pour un jeu au temps. */
  unite?: "mm";
  theme: string | null;
  seuils: Record<Medaille, number> | null;
  premierJour: string;
  /**
   * Lot P (interrupteur des jeux) : ce jeu **compte-t-il dans la journée d'aujourd'hui** (journée parfaite, série, partage, classement du jour) ? Faux le jour même de son activation (il compte dès
   * le lendemain) : il est quand même jouable. Absent (serveur plus ancien) : il compte.
   */
  compte?: boolean;
  /** Lot P : présent seulement sur un aperçu de PR, pour un jeu pas encore `on` : le badge « Brouillon ». */
  brouillon?: boolean;
  /** Avec un joueur seulement. */
  etat?: Etat;
}

export interface JoueurDuJour {
  pseudo: string;
  serie: number;
  aProlonger: boolean;
  journeesParfaites: number;
  aujourdhuiParfaite: boolean;
  /** Lot A1 : son temps cumulé du jour (la somme de ses temps prouvés, `null` tant qu'il n'a pas fini tous les jeux du jour), sa place et le nombre de classés du jour (`null` tant qu'il n'a fini aucun jeu aujourd'hui). */
  cumulMs?: number | null;
  rangDuJour?: number | null;
  classesDuJour?: number | null;
}

/** Lot N2 : la dernière nouveauté publiée (la ligne de l'accueil). `publieLe` : l'instant de publication en ms (« lue sur cet appareil » se compare à lui). */
export interface NouveauteAccueil {
  id: number;
  /** AAAA-MM-JJ. */
  date: string;
  titre: { fr: string; en: string };
  publieLe: number;
}

export interface Jour {
  date: string;
  /** Lot I3 : le numéro de la journée commune (`null` avant la journée n° 1, `config/lancement.json`). */
  journee?: number | null;
  /** Lot R8 : la génération de données du serveur (remise à zéro du lancement) ; absente d'un serveur plus ancien. */
  generation?: number | null;
  maintenant: string;
  prochainJour: string;
  jeux: JeuDuJour[];
  joueur?: JoueurDuJour;
  /** Lot N2 : la dernière nouveauté publiée (`null` : aucune, la ligne n'apparaît pas) et le message en direct (`null` : aucun) — dans la même réponse, jamais une requête de plus. */
  nouveaute?: NouveauteAccueil | null;
  annonce?: Annonce | null;
}

/** La nouveauté de l'accueil, lue avec prudence (une valeur illisible : aucune ligne). */
export function nouveauteDe(brut: unknown): NouveauteAccueil | null {
  const o = brut as Partial<NouveauteAccueil> | null;
  if (!o || typeof o !== "object" || typeof o.id !== "number" || typeof o.date !== "string" || typeof o.publieLe !== "number") return null;
  const t = o.titre as Partial<{ fr: unknown; en: unknown }> | undefined;
  if (!t || typeof t.fr !== "string" || typeof t.en !== "string") return null;
  return { id: o.id, date: o.date, titre: { fr: t.fr, en: t.en }, publieLe: o.publieLe };
}

/**
 * Ce que le chargement a donné : `jour` (la partie publique, toujours là si le serveur a répondu, même pour un joueur inconnu), le décalage de
 * l'horloge du téléphone sur celle du serveur, et l'erreur s'il y en a une (`erreur` : un code du serveur, ou `reseau` / `delai`).
 */
export interface Lecture {
  jour: Jour | null;
  /** Heure du serveur − heure du téléphone, en ms (0 sans serveur). */
  decalage: number;
  erreur: string | null;
}

/**
 * L'adresse du serveur, fixée à la construction comme pour les jeux (`VITE_API_URL`, posée par `deploy-site.yml`) : `/` ou rien = la même
 * origine (Firebase renvoie `/api/**` vers Cloud Run) ; l'adresse directe d'une révision de recette pour l'aperçu d'une PR qui touche le
 * serveur (sinon l'aperçu parlerait à la recette par défaut, sans le code de la PR). Rend le préfixe des chemins (`""` : même origine).
 */
export function baseApi(env: string | undefined = import.meta.env.VITE_API_URL as string | undefined): string {
  const base = (env ?? "").trim().replace(/\/+$/, "");
  return base === "" ? "" : base;
}

/** Délai d'attente de la requête du portail (le reste de la page ne l'attend pas). */
export const DELAI_MS = 8000;

const estJour = (b: unknown): b is Jour => {
  const o = b as Partial<Jour> | null;
  return !!o && typeof o.date === "string" && typeof o.maintenant === "string" && typeof o.prochainJour === "string" && Array.isArray(o.jeux);
};

/**
 * La requête du portail : l'identifiant secret dans l'en-tête `X-Player-Id` (jamais dans l'adresse). Le cache du navigateur n'est pas utilisé
 * (`no-store`) : l'heure du serveur doit être fraîche ; celle d'un cache partagé est corrigée par son en-tête `Age`. Ne lève jamais.
 */
export async function lireJour(fetchImpl: typeof fetch, joueur: string | null, maintenant: () => number = Date.now, delaiMs = DELAI_MS, base = baseApi()): Promise<Lecture> {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), delaiMs);
  try {
    const envoi = maintenant();
    const res = await fetchImpl(`${base}/api/portail/jour`, { headers: joueur ? { "X-Player-Id": joueur } : {}, cache: "no-store", signal: controle.signal });
    const recu = maintenant();
    const corps = (await res.json().catch(() => null)) as (Partial<Jour> & { error?: unknown }) | null;
    const jour = estJour(corps) ? { date: corps.date, journee: corps.journee ?? null, generation: generationDeReponse(corps), maintenant: corps.maintenant, prochainJour: corps.prochainJour, jeux: corps.jeux, nouveaute: nouveauteDe(corps.nouveaute), annonce: annonceDe(corps.annonce), ...(res.ok && corps.joueur ? { joueur: corps.joueur } : {}) } : null;
    // L'heure du serveur au milieu de l'aller-retour, plus l'âge de la réponse si un cache partagé l'a gardée.
    const age = Number(res.headers.get("age") ?? 0);
    const decalage = jour ? Date.parse(jour.maintenant) + (Number.isFinite(age) ? age * 1000 : 0) - (envoi + recu) / 2 : 0;
    if (res.ok && jour) return { jour, decalage, erreur: null };
    return { jour, decalage, erreur: typeof corps?.error === "string" ? corps.error : "reseau" };
  } catch (e) {
    return { jour: null, decalage: 0, erreur: e instanceof DOMException && e.name === "AbortError" ? "delai" : "reseau" };
  } finally {
    clearTimeout(minuterie);
  }
}

/** Le prochain minuit de Paris : celui du serveur s'il a répondu, sinon calculé sur l'heure du téléphone. */
export function prochainMinuit(jour: Jour | null, maintenant: number): number {
  const serveur = jour ? Date.parse(jour.prochainJour) : NaN;
  return Number.isFinite(serveur) && serveur > maintenant - 60_000 ? serveur : parisDayStart(parisDay(maintenant) + 1);
}

/** `hh:mm:ss` (les heures peuvent dépasser 24 un jour de 25 h ; jamais négatif). */
export function formatCompte(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Lot TP : le jeu est-il classé à la hauteur (et non au chrono) ? Il n'entre jamais dans le cumul au temps. */
export const estHauteur = (j: { unite?: string }): boolean => j.unite === "mm";

/** Lot P : le jeu compte-t-il aujourd'hui dans la journée ? (Absent : oui.) */
export const compteAujourdhui = (j: { compte?: boolean }): boolean => j.compte !== false;

/** Combien de jeux sont finis, sur combien (ceux que le portail montre et qui comptent aujourd'hui : un jeu activé aujourd'hui est jouable mais ne compte que dès demain). */
export function avancement(jeux: readonly JeuDuJour[]): { finis: number; total: number } {
  const comptes = jeux.filter(compteAujourdhui);
  return { finis: comptes.filter((j) => j.etat?.statut === "fini").length, total: comptes.length };
}
