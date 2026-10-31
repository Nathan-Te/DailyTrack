import { baseApi, type Medaille, type ScoreHauteur } from "./jour";

// Lot I3, refait au lot A1 : ce que la page `/classement/` lit du serveur (`GET /api/portail/classement?date=&vue=`, une requête par jour et par vue
// affichés) — pur, le réseau est passé : testé dans `test/classementVues.test.ts`.

/** Ce qu'un joueur a fait dans un jeu : sa place, son temps et sa médaille (`medaille: null` : fini sans médaille) ; `null` dans `resultats` : pas fini. */
export interface ResultatClassement {
  rang: number;
  tempsMs: number;
  medaille: Medaille | null;
  /** Lot TP : le score d'un jeu à la hauteur (`tempsMs` est alors la durée de la partie). */
  score?: ScoreHauteur | null;
}

export interface LigneClassement {
  rang: number;
  pseudo: string;
  /** Le temps de la vue : le cumul, ou le temps du jeu. `null` au cumul d'un joueur qui n'a pas fini tous les jeux. */
  tempsMs: number | null;
  /** Lot TP : dans la vue d'un jeu à la hauteur, le score de la ligne (la hauteur classe, `tempsMs` est la durée de la partie). */
  score?: ScoreHauteur | null;
  /** A-t-il fini tous les jeux du jour ? (toujours vrai dans la vue d'un jeu) : faux = sous la séparation « Un jeu sur deux ». */
  complet: boolean;
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
  /** La vue rendue : `cumul`, ou le dossier d'un jeu sur le site (`track`, `jump`). */
  vue: string;
  /** Lot TP : `"mm"` dans la vue d'un jeu classé à la hauteur. */
  unite?: "mm";
  /** `unite` : le jeu est classé à la hauteur (absent : au temps) ; il a son onglet mais n'est jamais dans le cumul. */
  jeux: { jeu: string; site: string; nom: string; unite?: "mm" }[];
  classes: number;
  top: LigneClassement[];
  /** Ta ligne (avec ton identifiant), même hors du haut ; `null` : tu n'as fini aucun jeu ce jour-là. */
  moi?: (LigneClassement & { classes: number }) | null;
}

export interface LectureClassement {
  classement: Classement | null;
  /** Un code du serveur (`unknown_day`, `invalid_date`, `invalid_view`, `rate_limited`…), `reseau` ou `delai`. */
  erreur: string | null;
}

/** Délai d'attente d'une lecture du classement. */
export const DELAI_CLASSEMENT_MS = 8000;

const estClassement = (b: unknown): b is Classement => {
  const o = b as Partial<Classement> | null;
  return !!o && typeof o.date === "string" && typeof o.ouvert === "boolean" && Array.isArray(o.top) && Array.isArray(o.jeux) && typeof o.vue === "string";
};

/**
 * Lit le classement d'un jour (`date` : `AAAA-MM-JJ`, absent : aujourd'hui) dans une vue (`cumul` ou le dossier d'un jeu). L'identifiant secret part dans l'en-tête `X-Player-Id` (jamais dans l'adresse).
 * Un joueur inconnu du serveur (404 `unknown_player`) ou au code révoqué (410) reçoit quand même le classement public (le corps le porte). Ne lève jamais.
 */
export async function lireClassement(fetchImpl: typeof fetch, joueur: string | null, date: string | null, vue = "cumul", base = baseApi(), delaiMs = DELAI_CLASSEMENT_MS): Promise<LectureClassement> {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), delaiMs);
  try {
    const parametres = new URLSearchParams();
    if (date) parametres.set("date", date);
    if (vue !== "cumul") parametres.set("vue", vue);
    const query = parametres.size > 0 ? `?${parametres}` : "";
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
