// Lot R7 (audit de sécurité) : ce que coûte un rejeu au plafond global de `REPLAYS_PER_MINUTE` (platform.ts).
/**
 * Lot R7 : le coût d'un rejeu est proportionnel à sa **durée** (mesuré : ≈ 15 ms pour une course de ≈ 4 200 pas, 200 à 350 ms pour les 72 000 pas
 * permis à une rediffusion qui ne finit jamais). Une unité de `REPLAYS_PER_MINUTE` vaut donc `REPLAY_TICKS_PER_UNIT` pas rejoués : une course
 * normale coûte une unité, la pire rediffusion permise en coûte 15. Le plafond borne ainsi le temps de calcul (≈ 10 s par minute au plus),
 * pas seulement le nombre de rejeux.
 */
export const REPLAY_TICKS_PER_UNIT = 5000;

/** Unités de plafond d'une rediffusion faite de ces séries (`count` pas chacune). */
export function replayUnits(runs: readonly { count: number }[]): number {
  let ticks = 0;
  for (const r of runs) ticks += r.count;
  return Math.max(1, Math.ceil(ticks / REPLAY_TICKS_PER_UNIT));
}
