import { parisDay, parisDayStart } from "@cdj/clock";

// Lot I2 : ce que le portail lit du serveur (`GET /api/portail/jour`, une requête au chargement) et le compte à rebours. Pur (le réseau et
// l'horloge sont passés) : testé dans `test/jour.test.ts`.

export type Medaille = "author" | "gold" | "silver" | "bronze";

export type Etat =
  | { statut: "pas_joue" }
  | { statut: "en_cours"; morts?: number }
  | { statut: "fini"; tempsMs: number; medaille: Medaille | null; rang: number; classes: number };

export interface JeuDuJour {
  /** Le code du jeu au registre du serveur (`cdj`, `jump`). */
  jeu: string;
  numero: number;
  theme: string | null;
  seuils: Record<Medaille, number> | null;
  premierJour: string;
  /** Avec un joueur seulement. */
  etat?: Etat;
}

export interface JoueurDuJour {
  pseudo: string;
  serie: number;
  aProlonger: boolean;
  journeesParfaites: number;
  aujourdhuiParfaite: boolean;
}

export interface Jour {
  date: string;
  maintenant: string;
  prochainJour: string;
  jeux: JeuDuJour[];
  joueur?: JoueurDuJour;
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
export async function lireJour(fetchImpl: typeof fetch, joueur: string | null, maintenant: () => number = Date.now, delaiMs = DELAI_MS): Promise<Lecture> {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), delaiMs);
  try {
    const envoi = maintenant();
    const res = await fetchImpl("/api/portail/jour", { headers: joueur ? { "X-Player-Id": joueur } : {}, cache: "no-store", signal: controle.signal });
    const recu = maintenant();
    const corps = (await res.json().catch(() => null)) as (Partial<Jour> & { error?: unknown }) | null;
    const jour = estJour(corps) ? { date: corps.date, maintenant: corps.maintenant, prochainJour: corps.prochainJour, jeux: corps.jeux, ...(res.ok && corps.joueur ? { joueur: corps.joueur } : {}) } : null;
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

/** Combien de jeux sont finis, sur combien (ceux que le portail montre). */
export function avancement(jeux: readonly JeuDuJour[]): { finis: number; total: number } {
  return { finis: jeux.filter((j) => j.etat?.statut === "fini").length, total: jeux.length };
}
