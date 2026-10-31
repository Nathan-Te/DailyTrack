import { daysFromCivil } from "@cdj/core";
import type { ApiOptions } from "../src/api";
import type { TowerOptions } from "../src/tower";
import { DAY_MS, makeApi, ouvrirJeu, type TestApi } from "../test/helpers";
import { creerTablesTower, gamesAvecTower } from "./tower-aide";

// Lot T4 — l'API de test avec Tower monté (les tests `tower*.test.ts` seulement : ce fichier importe les aides de test). Tower n'est pas encore au registre : on l'ajoute par l'option `games`, on crée
// ses tables et on l'ouvre à l'interrupteur (un nouveau jeu naît `off`).

export const D = (date: string): number => daysFromCivil(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)));
export const midi = (jour: number): number => jour * DAY_MS + 12 * 3_600_000;

export async function monterTower(date: string, tower: TowerOptions = {}, options: Partial<ApiOptions> = {}, ouvert = true): Promise<TestApi> {
  const t = await makeApi({ seed: false, games: gamesAvecTower(tower), ...options });
  await creerTablesTower(t.db);
  if (ouvert) await ouvrirJeu(t, "tower");
  t.clock.now = midi(D(date));
  return t;
}
