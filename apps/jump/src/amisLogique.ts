import type { JumpMedal } from "@cdj/jump-sim";
import { adresseAvecFiltre, refValide, type FiltreAmis } from "@cdj/profile";
import { fTicks, t } from "./i18n";
import type { RankRowView } from "./rankView";

// Les amis dans le classement du jour de Jump (lot F2 de la plateforme), **logique pure** (testée sans DOM) : quand le sélecteur « Tous / Amis » existe, comment lire la réponse du
// serveur (`GET /api/jump/day/<date>/board?filtre=amis`), quelles lignes en tirer (toi et tes amis, tous, sans la limite de 10 ; le rang est celui **entre amis**, le rang
// général se lit au toucher d'une ligne, dans la feuille du joueur), qui est « absent » (un ami qui n'a rien fini ce jour-là : en bas, sans temps), et l'adresse qui garde le
// choix (`?filtre=amis`). Le DOM est dans `classementAmis.ts`, chargé à la demande (jamais dans le premier chargement).

/** Un classement filtré est lu avec un identifiant et sert un joueur que le serveur connaît : ces refus-là ne laissent aucun sélecteur (rien à filtrer, rien à ajouter). */
export const CODES_SANS_AMIS: ReadonlySet<string> = new Set(["unknown_player", "invalid_player", "code_revoked"]);

/** Faut-il retirer le sélecteur après cet échec de `GET /api/amis` ? (Un réseau coupé, lui, le laisse : « Amis » dira sa panne quand on le choisira.) */
export const sansSelecteur = (code: string): boolean => CODES_SANS_AMIS.has(code);

export interface LigneAmis {
  /** Le rang **entre amis**. */
  rang: number;
  /** Le rang dans le classement « Tous » (null si le serveur ne le dit pas). */
  rangGeneral: number | null;
  ref: string;
  moi: boolean;
  name: string;
  ticks: number;
  deaths: number;
  medal: JumpMedal | null;
}
export interface AbsentAmi {
  ref: string;
  pseudo: string;
}
/** Ce que rend `GET /api/jump/day/<date>/board?filtre=amis`. */
export interface ClassementAmis {
  date: string;
  /** Les lignes classées (toi comprise). */
  classes: number;
  /** Le nombre de tes amis. */
  amis: number;
  /** Le nombre de joueurs du classement « Tous ». */
  participants: number;
  lignes: LigneAmis[];
  absents: AbsentAmi[];
}

/** Les médailles que le serveur nomme (`MEDAL_TYPE` de `dailyInfo.ts`, testé égal : l'importer ici ferait de `dailyInfo.ts` un fichier à part dans le premier chargement). */
export const MEDAILLES: readonly string[] = ["author", "gold", "silver", "bronze"];

const entier = (v: unknown, min: number): number | null => (typeof v === "number" && Number.isInteger(v) && v >= min ? v : null);
const objet = (v: unknown): Record<string, unknown> | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/**
 * Lit la réponse du serveur sans lui faire confiance : une ligne mal formée est écartée, une réponse qui n'est pas celle du filtre « Amis » (**un serveur plus ancien ignore le
 * paramètre et rend le classement « Tous »** : pas de `filtre: "amis"`) est refusée (`null`) — jamais montrée comme un classement d'amis.
 */
export function lireClassementAmis(corps: unknown, filtre: "amis" | "groupe" = "amis"): ClassementAmis | null {
  const c = objet(corps);
  if (!c || c.filtre !== filtre || !Array.isArray(c.top) || typeof c.date !== "string") return null;
  const lignes: LigneAmis[] = [];
  for (const brut of c.top) {
    const l = objet(brut);
    if (!l) continue;
    const rang = entier(l.rang, 1) ?? entier(l.rank, 1);
    const ticks = entier(l.ticks, 0);
    const medal = l.medal === null || l.medal === undefined ? null : typeof l.medal === "string" && MEDAILLES.includes(l.medal) ? (l.medal as JumpMedal) : undefined;
    if (rang === null || ticks === null || medal === undefined || typeof l.name !== "string" || l.name === "" || !refValide(l.ref)) continue;
    lignes.push({ rang, rangGeneral: entier(l.rangGeneral, 1), ref: l.ref, moi: l.moi === true, name: l.name, ticks, deaths: entier(l.deaths, 0) ?? 0, medal });
  }
  const absents: AbsentAmi[] = [];
  if (Array.isArray(c.absents)) {
    for (const brut of c.absents) {
      const a = objet(brut);
      if (a && refValide(a.ref) && typeof a.pseudo === "string" && a.pseudo !== "") absents.push({ ref: a.ref, pseudo: a.pseudo });
    }
  }
  const classes = entier(c.classes, 0) ?? lignes.length;
  return { date: c.date, classes, amis: entier(c.amis, 0) ?? lignes.filter((l) => !l.moi).length + absents.length, participants: entier(c.participants, 0) ?? classes, lignes, absents };
}

/** Une ligne d'« Amis », au format des lignes du classement du jeu (le rang affiché est le rang entre amis). */
export function ligneDeAmis(l: LigneAmis): RankRowView {
  return { rank: String(l.rang), name: l.name, time: fTicks(l.ticks), medal: l.medal, deaths: t("commun.morts", { n: l.deaths }), mine: l.moi, ref: l.ref };
}

/** Le toucher d'une ligne ouvre la feuille du joueur : jamais la tienne, et seulement si le serveur a donné sa référence. */
export const ouvrable = (r: { mine: boolean; ref?: string }): boolean => !r.mine && !!r.ref;

/** Les lignes classées d'« Amis », puis (en bas, sans temps) les amis qui n'ont rien fini ce jour-là. */
export function lignesAmis(c: ClassementAmis): { classes: RankRowView[]; absents: AbsentAmi[] } {
  return { classes: c.lignes.map(ligneDeAmis), absents: c.absents };
}

/** L'adresse de la page avec le filtre (`?filtre=amis`, ou rien pour « Tous »), le reste de l'adresse et son fragment gardés. */
export function adresseDuFiltre(page: { pathname: string; search: string; hash: string }, filtre: FiltreAmis): string {
  return adresseAvecFiltre(`${page.pathname}${page.search}${page.hash}`, filtre);
}
