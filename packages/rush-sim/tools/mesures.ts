import { cpus } from "node:os";
import { daysFromCivil } from "@cdj/core";
import { REGLAGES_DEFAUT, MAX_CHANGEMENTS, PAS_MIN_DIRECTION, PAS_MIN_VISEE, Partie, contenuScenario, dailyRush, encoderRediffusion, entree, jouer, jouerLePilote, pilote, RUSH_GENERATOR_VERSION, RUSH_SIM_VERSION, type Changement } from "../src/index";

// Les mesures du lot BR0 (et BR0b) : `npm run mesures:rush -w @cdj/rush-sim` (Node seulement ; aucune base, aucun réseau). Le coût du rejeu d'une partie de 2 et de 5 minutes, la taille de la rediffusion, le coût par tick d'un jeu à
// 30 monstres. Le texte imprimé est celui que le README du lot recopie.
const mediane = (v: number[]): number => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;
function chrono(f: () => unknown, passes = 7): number {
  f(); // chauffe
  const t: number[] = [];
  for (let i = 0; i < passes; i++) {
    const d = performance.now();
    f();
    t.push(performance.now() - d);
  }
  return mediane(t);
}
const taille = (c: Changement[], contenu: { scenario: string }): number => encoderRediffusion({ sim: RUSH_SIM_VERSION, g: RUSH_GENERATOR_VERSION, contenu: { scenario: contenu.scenario }, changements: c }).length;

console.log(`Machine : ${cpus()[0]!.model.trim()} (${cpus().length} cœurs), Node ${process.version}`);
console.log(`Rush v${RUSH_SIM_VERSION} · 60 ticks par seconde · pas de changement de direction plus d'une fois tous les ${PAS_MIN_DIRECTION} ticks, de visée plus d'une fois tous les ${PAS_MIN_VISEE} ticks · plafond ${MAX_CHANGEMENTS} changements\n`);

// 1. Une partie de N minutes dans l'arène à 30 monstres (le pilote joue : ses entrées ressemblent à celles d'un joueur qui se bat).
for (const minutes of [2, 5]) {
  const ticks = minutes * 3600;
  const contenu = contenuScenario("arene", { monstres: 30 });
  const { changements } = jouerLePilote(contenu, REGLAGES_DEFAUT, ticks);
  const ms = chrono(() => jouer(contenu, changements.filter((c) => c.tick < ticks), REGLAGES_DEFAUT));
  // `jouer` rejoue jusqu'à la fin de la partie (10 minutes dans l'arène) : on compte donc le coût au tick, sur exactement `ticks` ticks.
  const msTicks = chrono(() => {
    const p = new Partie(contenu, REGLAGES_DEFAUT);
    let k = 0;
    let e = 0;
    while (!p.finie && p.tick < ticks) {
      while (k < changements.length && changements[k]!.tick <= p.tick) e = changements[k++]!.e;
      p.avancer(e);
    }
  });
  void ms;
  console.log(`Arène à 30 monstres, ${minutes} min (${ticks} ticks) : rejeu ${msTicks.toFixed(0)} ms (${((msTicks * 1000) / ticks).toFixed(1)} µs par tick) · ${changements.length} changements d'entrée · rediffusion ${taille(changements, contenu)} caractères`);
}

// 2. Le pire joueur pour la taille : une entrée différente à chaque tick où le jeu a le droit de changer de direction (tous les 3 ticks) ou de visée (tous les 4 ticks), 5 minutes ; le plafond de changements (8 000) borne la suite.
const pire: Changement[] = [];
for (let t = 0, i = 0; t < 5 * 3600 && pire.length < MAX_CHANGEMENTS; t++) {
  if (t % PAS_MIN_DIRECTION !== 0 && t % PAS_MIN_VISEE !== 0) continue;
  pire.push({ tick: t, e: entree(i % 32, i % 5 === 0, i % 11 === 0, (i * 7) % 32) });
  i++;
}
console.log(`Pire rediffusion permise (${pire.length} changements : une entrée toutes les fois que la direction (tous les ${PAS_MIN_DIRECTION} ticks) ou la visée (tous les ${PAS_MIN_VISEE}) peut changer) : ${taille(pire, { scenario: "arene" })} caractères (limite acceptée : 40 000)`);

// 3. La partie du jour : un combat contre le golem. Le pilote la gagne en ~20 s ; un joueur qui esquive sans frapper peut durer jusqu'à 10 minutes (le pire coût d'un rejeu du jour).
const jour = dailyRush(daysFromCivil(2026, 11, 5));
const bot = jouerLePilote(jour);
console.log(`Partie du jour, le pilote : ${bot.ticks} ticks (${(bot.ticks / 60).toFixed(1)} s), rejeu ${chrono(() => jouer(jour, bot.changements)).toFixed(2)} ms · ${bot.changements.length} changements · ${taille(bot.changements, { scenario: "jour" })} caractères`);
const pireJour = chrono(() => {
  const p = new Partie(jour, REGLAGES_DEFAUT);
  let t = 0;
  // Un chevalier qui ne meurt jamais et qui court en rond : le pire coût d'une rediffusion du jour (10 minutes, le golem et ses monstres en permanence).
  while (!p.finie) {
    p.c.coeurs = 3;
    p.c.degat = 0;
    p.avancer(entree((t >> 5) % 32, false, false));
    t++;
    void pilote;
  }
}, 3);
console.log(`Pire rejeu du jour (10 minutes, chevalier invincible qui court en rond, golem et monstres) : ${pireJour.toFixed(0)} ms`);
