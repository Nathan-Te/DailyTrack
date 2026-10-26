import { demoAttempts, lifeReplay, repriseParPhase, replayAttempt, type DailyLevel, type JumpReplay } from "@cdj/jump-sim";

// Lot 21 : les joueurs fictifs du carnage de démonstration d'un niveau du jour (`?seed=…&carnage=demo`, `?api=demo`) **qui reprennent bien après une mort** : ils attendent sur
// le palier la phase de l'horloge qui convient puis jouent la solution du morceau qui commence là (`repriseParPhase`, jump-sim). Ce fichier est chargé à la demande
// (`main.ts`, seulement avec `?carnage=demo`) : il tire le catalogue des morceaux, qui n'est pas dans le premier chargement.

/** Les vies des essais fictifs d'un niveau du jour (14 essais, graine fixe), prêtes pour le carnage de démonstration. */
export function dayDemoLives(d: DailyLevel): JumpReplay[] {
  const lives: JumpReplay[] = [];
  for (const a of demoAttempts(d.level, d.replay, 0xa11, { attempts: 14, reprise: repriseParPhase(d) })) for (const life of replayAttempt(d.level, a.replay, d.id).lives) lives.push(lifeReplay(a.replay, life));
  return lives;
}
