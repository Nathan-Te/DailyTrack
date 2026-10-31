// Lot T2 — le contenu du jour de Tower : `dailyTower(jour, version)`, une fonction PURE (aucune date lue, aucune transcendante, aucun hasard non semé). Le jour est un numéro
// de jour civil (`daysFromCivil` de `@cdj/core`, la règle de changement de jour est celle de Paris, lue ailleurs par `@cdj/clock`) ; la graine en vient (`mixSeed`).
//
// **Versions.** `TOWER_GENERATOR_VERSION` monte à tout changement de ce que produit le générateur. Les versions passées RESTENT dans `GENERATEURS` tant qu'un jour figé les
// nomme (le registre des jours figés, règle R11 : `docs/plateforme/lots/lot-R11-track-fige-ses-circuits.md`) ; appeler une version inconnue lève `ErreurGenerateur`.
import { formatDay } from "@cdj/core";
import type { Scenario } from "../partie";
import type { Palier } from "../paliers";
import type { ThemeTower } from "../themes";
import { dailyTowerV1 } from "./v1";
import { dailyTowerV2 } from "./v2";
import { dailyTowerV3 } from "./v3";

export type { ThemeTower };

/**
 * Version courante du générateur du contenu du jour. Version 2 (lot T3) : le thème vient du sac de thèmes commun (`themes.ts`) ; la version 1 (tout `port`) reste appelable.
 * Version 3 (lot T3b) : le TIRAGE (`dailyTower(jour, version, tirage)`), les paliers tous les 8 m (8 à 48 m), le Diamant plafonné (`medailles.ts`) et les médailles à 15, 30 et 50 % ;
 * les versions 1 et 2 restent appelables et inchangées.
 */
export const TOWER_GENERATOR_VERSION = 3;

/** Première version qui connaît le tirage, les paliers tous les 8 m et le plafond du Diamant. */
export const GENERATEUR_TIRAGE = 3;

/** Le contenu d'un jour : un `Scenario` complet (pièces, plateforme, paliers, sens du vent) avec le jour, la version qui l'a produit et le thème. */
export interface Contenu extends Scenario {
  jour: number;
  g: number;
  /** Lot T3b : le tirage du contenu (génération 3 et suivantes) ; absent des versions 1 et 2 (= 0). */
  tirage?: number;
  theme: ThemeTower;
  paliers: readonly Palier[];
  ventSens: 1 | -1;
}

export class ErreurGenerateur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurGenerateur";
  }
}

/** Les générateurs par version. Une nouvelle version s'AJOUTE ; on ne retire une ancienne que lorsqu'aucun jour figé ne la nomme plus. */
const GENERATEURS: Readonly<Record<number, (jour: number, tirage: number) => Contenu>> = { 1: dailyTowerV1, 2: dailyTowerV2, 3: dailyTowerV3 };


/** Les versions que `dailyTower` sait appeler. */
export const VERSIONS_GENERATEUR: readonly number[] = Object.keys(GENERATEURS).map(Number);

/**
 * Le contenu du jour `jour` (numéro de jour civil) avec la version `version` du générateur (la courante par défaut) et le tirage `tirage` (lot T3b : 0 par défaut). Un tirage n > 0 décale
 * la graine du jour de façon déterministe ; le tirage 0 de la version 3 suit les mêmes règles que les autres. **Les versions 1 et 2 n'ont pas de tirage** : n > 0 y est refusé.
 */
export function dailyTower(jour: number, version: number = TOWER_GENERATOR_VERSION, tirage = 0): Contenu {
  const gen = GENERATEURS[version];
  if (!gen) throw new ErreurGenerateur(`version de générateur inconnue : ${version}`);
  if (!Number.isInteger(jour) || jour < 0) throw new ErreurGenerateur(`jour invalide : ${jour}`);
  if (!Number.isInteger(tirage) || tirage < 0 || (tirage > 0 && version < GENERATEUR_TIRAGE)) throw new ErreurGenerateur(`tirage invalide : ${tirage}`); // les versions 1 et 2 n'ont pas de tirage
  return gen(jour, tirage);
}

/** « AAAA-MM-JJ » d'un contenu du jour. */
export const dateDuContenu = (c: Pick<Contenu, "jour">): string => formatDay(c.jour);
