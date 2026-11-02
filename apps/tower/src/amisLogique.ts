import { adresseAvecFiltre, lireFiltre, refValide, type FiltreAmis } from "@cdj/profile";
import type { LigneTower, MedailleApi } from "./apiTower";

// Lot F2 — « Les amis » dans le classement de Tower : la logique pure (aucun DOM, aucun réseau), chargée à la demande avec le reste (`amisClassement.ts`). Le contrat est
// `GET /api/tower/day/<date>/board?filtre=amis` (`docs/plateforme/lots/lot-F2-amis.md`) : toi et tes amis, tous, sans la limite des 50 ; `rank` est le rang ENTRE AMIS (le serveur donne aussi `rang`),
// `rangGeneral` celui du classement « Tous », `ref` la référence publique, `moi` ta ligne ; `absents` les amis qui n'ont rien fini ce jour-là. Le classement est à la HAUTEUR (millimètres), pas au temps.

/** Une ligne du classement « Amis » : la ligne de « Tous » (`rank` = rang entre amis), plus le rang général et la référence. */
export interface LigneAmisTower extends LigneTower {
  ref: string;
  rangGeneral: number;
  moi: boolean;
}
export interface AbsentTower {
  ref: string;
  pseudo: string;
}
export interface ClassementAmisTower {
  date: string;
  /** Les lignes classées (toi et tes amis), dans l'ordre du serveur. */
  lignes: LigneAmisTower[];
  /** Les amis qui n'ont rien fini ce jour-là : en bas, sans hauteur. */
  absents: AbsentTower[];
  /** Le nombre d'amis (0 : « Tu n'as pas encore d'ami »). */
  amis: number;
  /** Le nombre de lignes classées. */
  classes: number;
  /** Le nombre de classés du classement « Tous » (pour « 8e sur 412 »). */
  participants: number;
}

const MEDAILLES: readonly string[] = ["author", "gold", "silver", "bronze"];
const entier = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function lireLigne(v: unknown): LigneAmisTower | null {
  const o = v as Record<string, unknown> | null;
  if (!o || !refValide(o.ref) || typeof o.name !== "string") return null;
  const rank = entier(o.rank ?? o.rang);
  const hauteurMm = entier(o.hauteurMm);
  if (rank === null || hauteurMm === null) return null;
  return {
    rank,
    name: o.name,
    hauteurMm,
    vies: entier(o.vies) ?? 0,
    ticks: entier(o.ticks) ?? 0,
    medal: typeof o.medal === "string" && MEDAILLES.includes(o.medal) ? (o.medal as MedailleApi) : null,
    ref: o.ref,
    rangGeneral: entier(o.rangGeneral) ?? rank,
    moi: o.moi === true,
  };
}

/** Lit la réponse du serveur ; `null` si elle n'a pas la forme du contrat (une réponse mal formée ne casse rien). */
export function lireClassementAmis(corps: unknown): ClassementAmisTower | null {
  const o = corps as Record<string, unknown> | null;
  if (!o || o.filtre !== "amis" || !Array.isArray(o.top)) return null;
  const lignes = o.top.map(lireLigne).filter((l): l is LigneAmisTower => l !== null);
  const absents = (Array.isArray(o.absents) ? o.absents : []).flatMap((a): AbsentTower[] => {
    const x = a as { ref?: unknown; pseudo?: unknown } | null;
    return x && refValide(x.ref) && typeof x.pseudo === "string" ? [{ ref: x.ref, pseudo: x.pseudo }] : [];
  });
  return {
    date: typeof o.date === "string" ? o.date : "",
    lignes,
    absents,
    amis: entier(o.amis) ?? absents.length + lignes.filter((l) => !l.moi).length,
    classes: entier(o.classes) ?? lignes.length,
    participants: entier(o.participants) ?? 0,
  };
}

/** Faut-il dire « Tu n'as pas encore d'ami » (et proposer d'en inviter) ? Oui quand la liste d'amis est vide. */
export const sansAmi = (c: ClassementAmisTower): boolean => c.amis === 0;

/** Le filtre de l'adresse de la page (`?filtre=amis`) ; tout le reste est « Tous ». */
export const filtreDeLAdresse = (search: string): FiltreAmis => lireFiltre(search);

/** L'adresse de la page avec le filtre choisi, tous les autres paramètres (`?seed=`, `?api=`…) et le fragment gardés. */
export const adresseDuFiltre = (lieu: { pathname: string; search: string; hash: string }, filtre: FiltreAmis): string => adresseAvecFiltre(`${lieu.pathname}${lieu.search}${lieu.hash}`, filtre);

/** Une ligne sur laquelle on peut toucher : un autre joueur, qui a une référence. Ta ligne n'ouvre rien. */
export interface LigneTouchable {
  ref?: string;
  pseudo: string;
  moi: boolean;
}
export const ouvreUneFeuille = (l: LigneTouchable | undefined): l is LigneTouchable & { ref: string } => !!l && !l.moi && refValide(l.ref);
