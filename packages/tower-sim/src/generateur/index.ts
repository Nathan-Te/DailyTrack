// Lot T2 — le contenu du jour de Tower : `dailyTower(jour, version)`, une fonction PURE (aucune date lue, aucune transcendante, aucun hasard non semé). Le jour est un numéro
// de jour civil (`daysFromCivil` de `@cdj/core`, la règle de changement de jour est celle de Paris, lue ailleurs par `@cdj/clock`) ; la graine en vient (`mixSeed`).
//
// **Versions.** `TOWER_GENERATOR_VERSION` monte à tout changement de ce que produit le générateur. Les versions passées RESTENT dans `GENERATEURS` tant qu'un jour figé les
// nomme (le registre des jours figés, règle R11 : `docs/plateforme/lots/lot-R11-track-fige-ses-circuits.md`) ; appeler une version inconnue lève `ErreurGenerateur`.
import { formatDay } from "@cdj/core";
import type { Scenario } from "../partie";
import type { Palier } from "../paliers";
import { dailyTowerV1 } from "./v1";

/** Version courante du générateur du contenu du jour. */
export const TOWER_GENERATOR_VERSION = 1;

/** Le thème du jour. Un seul au lot T2 (`port`) ; les autres et le sac de thèmes viennent au lot T3. */
export type ThemeTower = "port";

/** Le contenu d'un jour : un `Scenario` complet (pièces, plateforme, paliers, sens du vent) avec le jour, la version qui l'a produit et le thème. */
export interface Contenu extends Scenario {
  jour: number;
  g: number;
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
const GENERATEURS: Readonly<Record<number, (jour: number) => Contenu>> = { 1: dailyTowerV1 };

/** Les versions que `dailyTower` sait appeler. */
export const VERSIONS_GENERATEUR: readonly number[] = Object.keys(GENERATEURS).map(Number);

/** Le contenu du jour `jour` (numéro de jour civil) avec la version `version` du générateur (la courante par défaut). */
export function dailyTower(jour: number, version: number = TOWER_GENERATOR_VERSION): Contenu {
  const gen = GENERATEURS[version];
  if (!gen) throw new ErreurGenerateur(`version de générateur inconnue : ${version}`);
  if (!Number.isInteger(jour) || jour < 0) throw new ErreurGenerateur(`jour invalide : ${jour}`);
  return gen(jour);
}

/** « AAAA-MM-JJ » d'un contenu du jour. */
export const dateDuContenu = (c: Pick<Contenu, "jour">): string => formatDay(c.jour);
