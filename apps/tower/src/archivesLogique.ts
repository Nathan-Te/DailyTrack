import { formatDay } from "@cdj/core";
import { numeroTower, PREMIER_JOUR_TOWER, type NomMedaille } from "@cdj/tower-sim";
import { medailleLue, type JourMoiTower } from "./apiTower";
import type { Records } from "./records";

// Les archives de Tower (lot T7), **la partie pure** : quels jours montrer et ce que dit chaque ligne. Comme celles de Jump : les jours passés, rejouables, **jamais classés** — une partie
// jouée sur un jour passé n'a ni rang, ni record du navigateur, ni envoi (`peutClasser`, `envoi.ts` : seul le jour d'aujourd'hui se classe).
// Les données : la meilleure partie de chaque jour vient du serveur (`GET /api/tower/me`, `days`) quand il répond, et du navigateur (`tower:records`, 30 jours) sinon ; si les deux existent, la
// meilleure des deux. Aucune route nouvelle.

/** Au plus les 30 derniers jours passés (la mémoire du navigateur en garde autant : `JOURS_GARDES`). */
export const JOURS_ARCHIVES = 30;

/** Les jours à lister, du plus récent au plus ancien : de la veille d'aujourd'hui au premier jour de Tower, 30 au plus. Avant le premier jour : aucun. */
export function joursDArchives(aujourdhui: number, premier: number = PREMIER_JOUR_TOWER, max: number = JOURS_ARCHIVES): number[] {
  const out: number[] = [];
  for (let d = aujourdhui - 1; d >= Math.max(premier, aujourdhui - max); d--) out.push(d);
  return out;
}

export interface LigneArchive {
  date: string;
  /** Le numéro de la tour de ce jour. */
  numero: number;
  /** Ta meilleure hauteur de ce jour (mm), ou `null` : pas jouée. */
  hauteurMm: number | null;
  medaille: NomMedaille | null;
}

/** Une ligne : la meilleure hauteur entre le serveur et le navigateur (à égalité, le serveur, qui fait foi), avec la médaille de cette partie. */
export function ligneArchive(jour: number, records: Records, serveur: ReadonlyMap<string, JourMoiTower>): LigneArchive {
  const date = formatDay(jour);
  const local = records[date];
  const loin = serveur.get(date);
  const base = { date, numero: numeroTower(jour) };
  if (loin && (!local || loin.hauteurMm >= local.hauteurMm)) return { ...base, hauteurMm: loin.hauteurMm, medaille: medailleLue(loin.medal) };
  if (local) return { ...base, hauteurMm: local.hauteurMm, medaille: local.medaille };
  return { ...base, hauteurMm: null, medaille: null };
}

/** L'adresse qui ouvre un jour passé : la page actuelle avec `?seed=AAAA-MM-JJ` (les autres paramètres d'essai sont gardés, jamais la clé d'aperçu, que la page a retirée). */
export function archiveHref(recherche: string, date: string): string {
  const q = new URLSearchParams(recherche);
  q.delete("scenario");
  q.set("seed", date);
  return `?${q.toString()}`;
}
