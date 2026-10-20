import { baseApi, type Medaille } from "./jour";

// Lot I3 : ce que la page `/classement/` lit du serveur (`GET /api/portail/classement?date=`, une requête par jour affiché) — pur, le réseau est passé :
// testé dans `test/classement.test.ts`.

/** Ce qu'un joueur a fait dans un jeu : sa place et sa médaille (`medaille: null` : fini sans médaille) ; `null` dans `resultats` : pas fini. */
export interface ResultatClassement {
  rang: number;
  medaille: Medaille | null;
}

export interface LigneClassement {
  rang: number;
  pseudo: string;
  points: number;
  /** Par code de jeu du registre du serveur. */
  resultats: Record<string, ResultatClassement | null>;
  /** Le haut du classement : cette ligne est la tienne (avec ton identifiant seulement). */
  moi?: true;
}

export interface Classement {
  date: string;
  journee: number | null;
  /** Le jour accepte encore des temps (aujourd'hui) : le classement bouge. */
  ouvert: boolean;
  bareme: Record<Medaille, number>;
  jeux: { jeu: string; site: string; nom: string }[];
  classes: number;
  top: LigneClassement[];
  /** Ta ligne (avec ton identifiant), même hors du haut ; `null` : tu n'as fini aucun jeu ce jour-là. */
  moi?: (LigneClassement & { classes: number }) | null;
}

export interface LectureClassement {
  classement: Classement | null;
  /** Un code du serveur (`unknown_day`, `invalid_date`, `rate_limited`…), `reseau` ou `delai`. */
  erreur: string | null;
}

/** Délai d'attente d'une lecture du classement. */
export const DELAI_CLASSEMENT_MS = 8000;

const estClassement = (b: unknown): b is Classement => {
  const o = b as Partial<Classement> | null;
  return !!o && typeof o.date === "string" && typeof o.ouvert === "boolean" && Array.isArray(o.top) && Array.isArray(o.jeux) && typeof o.bareme === "object" && o.bareme !== null;
};

/**
 * Lit le classement d'un jour (`date` : `AAAA-MM-JJ`, absent : aujourd'hui). L'identifiant secret part dans l'en-tête `X-Player-Id` (jamais dans l'adresse).
 * Un joueur inconnu du serveur (404 `unknown_player`) ou au code révoqué (410) reçoit quand même le classement public (le corps le porte). Ne lève jamais.
 */
export async function lireClassement(fetchImpl: typeof fetch, joueur: string | null, date: string | null, base = baseApi(), delaiMs = DELAI_CLASSEMENT_MS): Promise<LectureClassement> {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), delaiMs);
  try {
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    const res = await fetchImpl(`${base}/api/portail/classement${query}`, { headers: joueur ? { "X-Player-Id": joueur } : {}, cache: "no-store", signal: controle.signal });
    const corps = (await res.json().catch(() => null)) as (Partial<Classement> & { error?: unknown }) | null;
    const classement = estClassement(corps) ? corps : null;
    if (res.ok && classement) return { classement, erreur: null };
    return { classement, erreur: typeof corps?.error === "string" ? corps.error : "reseau" };
  } catch (e) {
    return { classement: null, erreur: e instanceof DOMException && e.name === "AbortError" ? "delai" : "reseau" };
  } finally {
    clearTimeout(minuterie);
  }
}
