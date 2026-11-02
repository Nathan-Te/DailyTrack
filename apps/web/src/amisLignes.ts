// Lot F2 (plateforme) — le filtre « Amis » du classement du jour de Track : la logique pure (lecture prudente de la réponse du serveur, ordre des lignes, absents,
// choix du filtre au chargement, adresse). Aucun DOM, aucun réseau : `amisClassement.ts` (à la demande) la dessine. Contrat : `docs/plateforme/lots/lot-F2-amis.md`
// (`GET /api/day/<date>/leaderboard?filtre=amis`, `X-Player-Id`). Ce fichier n'importe que le client commun (`@cdj/profile`) : il n'entre pas dans le premier chargement.
import { adresseAvecFiltre, lireFiltre, refValide, type FiltreAmis } from "@cdj/profile";

export type Medaille = "author" | "gold" | "silver" | "bronze";

/** Une ligne du classement « Amis » : toi ou un ami qui a un temps. `rang` est le rang **entre amis**, `rangGeneral` celui du classement « Tous ». */
export interface LigneAmis {
  ref: string;
  nom: string;
  ms: number;
  medal: Medaille | null;
  rang: number;
  rangGeneral: number | null;
  moi: boolean;
}

/** Un ami qui n'a rien fini ce jour-là : en bas, sans temps. */
export interface AbsentAmis {
  ref: string;
  nom: string;
}

export interface ClassementAmis {
  date: string;
  /** Le nombre d'amis (hors toi). */
  amis: number;
  /** Les lignes classées (toi compris). */
  classes: number;
  /** Le nombre de joueurs du classement « Tous » (sert au compteur « Tous · N »), s'il est donné. */
  participants: number | null;
  lignes: LigneAmis[];
  absents: AbsentAmis[];
}

const MEDAILLES: readonly string[] = ["author", "gold", "silver", "bronze"];
const entierPositif = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

/**
 * Lit la réponse du serveur sans lui faire confiance : une ligne mal formée est écartée, une référence ne compte qu'une fois, les lignes sont mises dans l'ordre du rang entre amis
 * (puis celui du serveur), les absents ne contiennent ni toi ni quelqu'un qui a une ligne. `null` : réponse illisible (le classement retombe sur « Tous »).
 */
export function lireClassementAmis(corps: unknown): ClassementAmis | null {
  const o = corps as Record<string, unknown> | null;
  if (!o || typeof o !== "object" || !Array.isArray(o.top)) return null;
  const vus = new Set<string>();
  const lignes: LigneAmis[] = [];
  for (const brute of o.top) {
    const r = brute as Record<string, unknown> | null;
    if (!r || !refValide(r.ref) || vus.has(r.ref)) continue;
    const rang = entierPositif(r.rang ?? r.rank);
    const ms = entierPositif(r.ms);
    if (rang === null || rang < 1 || ms === null || typeof r.name !== "string") continue;
    vus.add(r.ref);
    lignes.push({ ref: r.ref, nom: r.name, ms, medal: typeof r.medal === "string" && MEDAILLES.includes(r.medal) ? (r.medal as Medaille) : null, rang, rangGeneral: entierPositif(r.rangGeneral), moi: r.moi === true });
  }
  lignes.sort((a, b) => a.rang - b.rang); // tri stable : à rang égal, l'ordre du serveur
  const absents: AbsentAmis[] = [];
  if (Array.isArray(o.absents)) {
    for (const brut of o.absents) {
      const a = brut as Record<string, unknown> | null;
      if (!a || !refValide(a.ref) || typeof a.pseudo !== "string" || vus.has(a.ref)) continue;
      vus.add(a.ref);
      absents.push({ ref: a.ref, nom: a.pseudo });
    }
  }
  const classes = entierPositif(o.classes) ?? lignes.length;
  return { date: typeof o.date === "string" ? o.date : "", amis: entierPositif(o.amis) ?? Math.max(0, lignes.filter((l) => !l.moi).length + absents.length), classes, participants: entierPositif(o.participants), lignes, absents };
}

/** Le classement « Amis » n'a rien à montrer d'autre que l'invitation : aucun ami (le serveur ne garde alors que toi, ou rien). */
export const sansAmi = (c: Pick<ClassementAmis, "amis">): boolean => c.amis === 0;

/** Il y a des amis, mais ni eux ni toi n'avez de temps ni d'absent à montrer (amis masqués, par exemple). */
export const classementVide = (c: Pick<ClassementAmis, "lignes" | "absents">): boolean => c.lignes.length === 0 && c.absents.length === 0;

// --- Le filtre dans l'adresse ---------------------------------------------------------------------------------------------------------------------------------

/**
 * Le filtre à montrer quand le classement s'ouvre : celui choisi pendant cette page s'il y en a un (`memoire`), sinon celui de l'adresse (`?filtre=amis`). Le choix ne dépend que de la page :
 * rien n'est écrit dans le navigateur.
 */
export const filtreAuChargement = (search: string, memoire: FiltreAmis | null): FiltreAmis => memoire ?? lireFiltre(search);

/** L'adresse de la page avec le filtre (`?filtre=amis`, ou rien pour « Tous ») : le chemin, la requête et le fragment, sans l'origine (`history.replaceState`). */
export const adresseDuFiltre = (page: { pathname: string; search: string; hash: string }, filtre: FiltreAmis): string => adresseAvecFiltre(`${page.pathname}${page.search}${page.hash}`, filtre);

/** Le chemin de la requête « Amis » (l'identifiant du joueur voyage dans l'en-tête `X-Player-Id`, jamais ici). Pas de `limit` : toi et tes amis, tous. */
export const cheminClassementAmis = (date: string): string => `/api/day/${encodeURIComponent(date)}/leaderboard?filtre=amis`;
