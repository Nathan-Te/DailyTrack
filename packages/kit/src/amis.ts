import { adresseAvecFiltre, lireFiltre, refValide, type FiltreAmis } from "@cdj/profile";

// Lot K4c — **la colle des amis et du groupe d'un jeu neuf, partie pure** (aucun DOM, aucun réseau). Modèle : `apps/tower/src/amisLogique.ts`, rendue générique. Le contrat est
// `GET /api/<jeu>/day/<date>/board?filtre=amis|groupe` (`docs/plateforme/lots/lot-F2-amis.md`) : toi et tes amis, tous, sans la limite des 50 ; `rank` est le rang ENTRE AMIS, `rangGeneral` celui du classement
// « Tous », `ref` la référence publique, `moi` ta ligne ; `absents` ceux qui n'ont rien fini ce jour-là. **Le score d'une ligne est la suite des colonnes de classement de la fiche** (leurs noms sont donnés).
// La partie qui parle au DOM est `amisDom.ts`. **À la demande** (jamais dans un premier chargement).

export interface LigneAmis {
  rank: number;
  name: string;
  /** Les colonnes de classement de la fiche, par leur nom. */
  score: Record<string, number>;
  medal: string | null;
  ref: string;
  rangGeneral: number;
  moi: boolean;
}
export interface AbsentAmis {
  ref: string;
  pseudo: string;
}
export interface ClassementAmis {
  date: string;
  lignes: LigneAmis[];
  absents: AbsentAmis[];
  amis: number;
  classes: number;
  participants: number;
}

const MEDAILLES: readonly string[] = ["author", "gold", "silver", "bronze"];
const nombre = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function lireLigne(v: unknown, colonnes: readonly string[]): LigneAmis | null {
  const o = v as Record<string, unknown> | null;
  if (!o || !refValide(o.ref) || typeof o.name !== "string") return null;
  const rank = nombre(o.rank ?? o.rang);
  if (rank === null) return null;
  const score: Record<string, number> = {};
  for (const c of colonnes) {
    const x = nombre(o[c]);
    if (x === null) return null;
    score[c] = x;
  }
  return { rank, name: o.name, score, medal: typeof o.medal === "string" && MEDAILLES.includes(o.medal) ? o.medal : null, ref: o.ref, rangGeneral: nombre(o.rangGeneral) ?? rank, moi: o.moi === true };
}

/** Lit la réponse du serveur ; `null` si elle n'a pas la forme du contrat (une réponse mal formée ne casse rien). `colonnes` : les noms des colonnes de classement de la fiche. */
export function lireClassementAmis(corps: unknown, colonnes: readonly string[], filtre: "amis" | "groupe" = "amis"): ClassementAmis | null {
  const o = corps as Record<string, unknown> | null;
  if (!o || o.filtre !== filtre || !Array.isArray(o.top)) return null;
  const lignes = o.top.map((l) => lireLigne(l, colonnes)).filter((l): l is LigneAmis => l !== null);
  const absents = (Array.isArray(o.absents) ? o.absents : []).flatMap((a): AbsentAmis[] => {
    const x = a as { ref?: unknown; pseudo?: unknown } | null;
    return x && refValide(x.ref) && typeof x.pseudo === "string" ? [{ ref: x.ref, pseudo: x.pseudo }] : [];
  });
  return {
    date: typeof o.date === "string" ? o.date : "",
    lignes,
    absents,
    amis: nombre(o.amis) ?? absents.length + lignes.filter((l) => !l.moi).length,
    classes: nombre(o.classes) ?? lignes.length,
    participants: nombre(o.participants) ?? 0,
  };
}

/** Faut-il dire « Tu n'as pas encore d'ami » ? Oui quand la liste d'amis est vide. */
export const sansAmi = (c: ClassementAmis): boolean => c.amis === 0;

/** Le filtre de l'adresse de la page (`?filtre=amis`) ; tout le reste est « Tous ». */
export const filtreDeLAdresse = (search: string): FiltreAmis => lireFiltre(search);

/** L'adresse de la page avec le filtre choisi, tous les autres paramètres et le fragment gardés. */
export const adresseDuFiltre = (lieu: { pathname: string; search: string; hash: string }, filtre: FiltreAmis): string => adresseAvecFiltre(`${lieu.pathname}${lieu.search}${lieu.hash}`, filtre);

/** L'adresse de la route du classement filtré d'un jeu (jamais l'identifiant : il voyage en en-tête). */
export const adresseClassementFiltre = (codeJeu: string, date: string, filtre: "amis" | "groupe"): string => `/api/${codeJeu}/day/${encodeURIComponent(date)}/board?filtre=${filtre}`;

export interface LigneTouchable {
  ref?: string;
  pseudo: string;
  moi: boolean;
}
/** Une ligne sur laquelle on peut toucher : un autre joueur, qui a une référence. Ta ligne n'ouvre rien. */
export const ouvreUneFeuille = (l: LigneTouchable | undefined): l is LigneTouchable & { ref: string } => !!l && !l.moi && refValide(l.ref);
