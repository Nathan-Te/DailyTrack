import { parseDay } from "@cdj/core";
import type { JumpMedal } from "@cdj/jump-sim";
import { mergeName, writeIdentity, type KeyValueStore, type ListableStore } from "@cdj/profile";
import { HISTORY_KEY, HISTORY_VERSION, isDayRecord, mergeDay, streakOf, type DayRecord } from "./history";
import { RANKS_KEY } from "./rankQueue";

// Le profil DailyJump synchronisé par le serveur (lot P2 de la plateforme), **logique pure** (testée sous Node) : ce que rend
// `GET /api/jump/me`, la **fusion « le meilleur gagne »** avec l'historique local (`jump:historique`, lot 10), les statistiques de la carte du
// profil, et ce qu'un code chargé efface (le cache de l'ancienne identité).
//
// Fusion (`mergeJumpHistory`), jour par jour (identifiant du niveau du jour) :
//   - **le meilleur gagne** : le temps le plus court l'emporte (avec sa médaille) ; un temps local meilleur (fait hors ligne, ou dont l'envoi
//     est encore dans la file) reste : un jour en file compte comme en local ;
//   - **morts et essais du jour** ne sont connus qu'en local (les vies arrivent au lot P3) : la valeur locale est gardée quand elle existe ;
//   - un jour **présent seulement sur le serveur** (joué sur un autre appareil) est ajouté : ses morts sont celles de l'essai classé, un essai ;
//   - **rien n'est jamais supprimé** ; la série se calcule ensuite sur l'historique fusionné (`streakOf`).

/** Un jour du profil DailyJump vu par le serveur (`GET /api/jump/me`). */
export interface JumpMeDay {
  date: string;
  levelId: string;
  ticks: number;
  deaths: number;
  medal: JumpMedal | null;
}

/** `GET /api/jump/me`. */
export interface JumpMe {
  name: string;
  renameRequired: boolean;
  today: string;
  simVersion: number;
  generatorVersion: number;
  days: JumpMeDay[];
  stats: { days: number; medals: { author: number; gold: number; silver: number; bronze: number }; streak: number };
}

export interface JumpMergeResult {
  /** L'historique fusionné (à écrire si `changed`). */
  list: DayRecord[];
  changed: boolean;
  /** Jours ajoutés (présents seulement sur le serveur) et jours dont le meilleur temps vient du serveur. */
  added: number;
  improved: number;
}

const LEVEL_ID = /^jour-\d{4}-\d{2}-\d{2}-g\d+$/;

/** Fusionne le profil du serveur dans l'historique local : le meilleur gagne, morts et essais locaux gardés, jours du serveur ajoutés. Pure. */
export function mergeJumpHistory(local: readonly DayRecord[], days: readonly JumpMeDay[]): JumpMergeResult {
  const byId = new Map(local.map((r) => [r.id, { ...r }]));
  let added = 0;
  let improved = 0;
  for (const d of days) {
    // Rien n'est pris sur parole : un jour mal formé (ou d'un essai de thème forcé) est ignoré.
    const candidate: DayRecord = { id: d.levelId, date: d.date, best: d.ticks, medal: d.medal, deaths: d.deaths, attempts: 1 };
    if (!LEVEL_ID.test(String(d.levelId)) || !String(d.levelId).includes(String(d.date)) || !isDayRecord(candidate) || candidate.best === null) continue;
    const mine = byId.get(d.levelId);
    if (!mine) {
      byId.set(d.levelId, candidate);
      added++;
    } else if (mine.best === null || d.ticks < mine.best) {
      byId.set(d.levelId, { ...mine, best: d.ticks, medal: d.medal, attempts: Math.max(1, mine.attempts) });
      improved++;
    }
  }
  const list = [...byId.values()];
  return { list, changed: added + improved > 0, added, improved };
}

/** Les statistiques de la carte du profil (accueil, Réglages › Profil) : jours joués, médailles, série. Sur l'historique (fusionné). */
export interface JumpStats {
  days: number;
  medals: { author: number; gold: number; silver: number; bronze: number };
  streak: number;
}

export function jumpStats(list: readonly DayRecord[], today: number): JumpStats {
  const dates = [...new Set(list.filter((r) => r.best !== null && parseDay(r.date) !== null).map((r) => r.date))];
  const medals = { author: 0, gold: 0, silver: 0, bronze: 0 };
  for (const date of dates) {
    const m = mergeDay(list.filter((r) => r.date === date))?.medal;
    if (m) medals[m]++;
  }
  return { days: dates.length, medals, streak: streakOf(list, today) };
}

/** Ce que la synchronisation fait du profil reçu : le pseudo du serveur (part commune), puis la fusion de l'historique. */
export function applyJumpProfile(me: JumpMe, storage: KeyValueStore, local: readonly DayRecord[]): JumpMergeResult & { nameChanged: boolean } {
  const nameChanged = mergeName(me, storage);
  return { ...mergeJumpHistory(local, Array.isArray(me.days) ? me.days : []), nameChanged };
}

/**
 * « Charger un code » dans DailyJump : l'identité de la plateforme est remplacée (`writeIdentity` : `cdj:player`, `cdj:name` — DailyTrack la
 * retrouve, c'est le même stockage), et ce que DailyJump gardait **au nom de l'ancienne identité** est oublié : les rangs connus et les jours
 * passés de l'historique (le serveur rendra ceux du profil chargé). **Restent** : la mémoire du jour (meilleur essai, vies, taches) et le jour
 * d'aujourd'hui de l'historique (son meilleur essai part au classement au nom du profil chargé, comme le record du jour de DailyTrack), et les
 * envois en attente. Rend faux si le stockage refuse d'écrire (rien n'a alors changé d'identité).
 */
export function applyJumpIdentity(identity: { id: string; name: string | null }, storage: ListableStore, local: readonly DayRecord[], today: string): boolean {
  try {
    const kept = local.filter((r) => r.date === today);
    storage.setItem(HISTORY_KEY, JSON.stringify({ v: HISTORY_VERSION, jours: kept }));
    storage.removeItem(RANKS_KEY);
    writeIdentity(identity, storage);
    return true;
  } catch {
    return false;
  }
}
