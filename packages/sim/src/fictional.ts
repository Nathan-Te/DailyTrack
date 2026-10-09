import { AXIS_MAX, makeInput } from "./car";
import { CELL, cellKey, type Track } from "./track";
import { createRace, stepRace } from "./race";
import { ReplayRecorder, encodeReplay } from "./replay";
import { Rng } from "./rng";
import { createAutopilot } from "./autopilot";
import { trackJumps } from "./jump";

// Pilotes fictifs (lots 11 et 26) : le pilote automatique, bridé et brouillé selon un niveau, pour fabriquer des courses crédibles
// de joueurs imaginaires (historique du lot 11, Salon de démonstration du lot 26). Ce ne sont que des commandes : toute course passe
// ensuite par le même rejeu que celle d'un vrai joueur.

export interface PilotStyle {
  /** Part de l'adhérence que le pilote automatique ose utiliser (plus bas = plus lent dans les virages). */
  grip: number;
  /** Anticipation du point visé. */
  look: number;
  /** Plafond des gaz (1 = plein gaz). */
  throttleCap: number;
  /** Vitesse au-delà de laquelle le pilote lève le pied (m/s) : un pilote prudent ne pousse pas jusqu'à la pointe. */
  topSpeed: number;
  /** Amplitude des hésitations de volant (0 = aucune). */
  wobble: number;
}

/** Pseudos fictifs (acceptés par `cleanName`) : un préfixe qui ne laisse aucun doute. */
export const FICTIONAL_NAMES = [
  "Démo Renard", "Démo Mistral", "Démo Zéphyr", "Démo Orage", "Démo Cactus", "Démo Brume", "Démo Étincelle", "Démo Galet",
  "Démo Tonnerre", "Démo Plume", "Démo Cyclone", "Démo Marmotte", "Démo Comète", "Démo Bouchon", "Démo Fusée", "Démo Tortue",
  "Démo Rafale", "Démo Pirate", "Démo Lynx", "Démo Biscotte", "Démo Aurore", "Démo Crabe", "Démo Chicane", "Démo Nitro",
  "Démo Pétale", "Démo Vortex", "Démo Gaufre", "Démo Sirocco", "Démo Mulot", "Démo Turbine",
] as const;

/** Style d'un pilote de niveau `skill` ∈ [0, 1] (1 = presque l'auteur, 0 = prudent et brouillon). */
export function styleFor(skill: number): PilotStyle {
  return { grip: 1.05 - 0.65 * (1 - skill), look: 0.3 + 0.12 * (1 - skill), throttleCap: 1 - 0.5 * (1 - skill), topSpeed: 24 + 40 * skill, wobble: 0.35 * (1 - skill) };
}

/** Fait rouler le pilote automatique avec ce style ; `null` s'il ne finit pas (sorti de la route, bloqué, repris). */
export function runFictional(track: Track, style: PilotStyle, seed: number, maxSeconds = 150): { code: string; finishMs: number } | null {
  const race = createRace(track);
  // Sauts (lot 17) : même un pilote prudent accélère avant une rampe, il sait qu'un saut se prend avec de la vitesse. Dans les quatre
  // blocs qui précèdent la rampe (et sur elle), il ne lève plus le pied et met plein gaz comme le pilote automatique.
  const jumps = trackJumps(track).map((j) => ({ from: j.kick - 4, to: j.kick }));
  const drive = createAutopilot(track, { grip: style.grip, look: style.look });
  const rec = new ReplayRecorder();
  const rng = new Rng(seed);
  let wob = 0;
  let stuck = 0;
  const maxTicks = maxSeconds * 120;
  for (let t = 0; t < maxTicks && race.finishMs < 0 && race.respawns === 0; t++) {
    const base = drive(race);
    wob += ((rng.int(2001) - 1000) / 1000 - wob) * 0.04; // bruit lissé
    const steer = Math.max(-1, Math.min(1, base.steer / AXIS_MAX + wob * style.wobble));
    const speed = Math.sqrt(race.car.vx * race.car.vx + race.car.vz * race.car.vz);
    const here = track.cells.get(cellKey(Math.floor(race.car.x / CELL), Math.floor(race.car.z / CELL)))?.index ?? -1;
    const approach = jumps.find((j) => here >= j.from && here <= j.to);
    const gas = approach ? base.throttle / AXIS_MAX : speed > style.topSpeed ? 0 : (base.throttle / AXIS_MAX) * style.throttleCap;
    const input = makeInput(steer, gas, base.brake / AXIS_MAX);
    rec.record(input);
    stepRace(race, input);
    const v2 = race.car.vx * race.car.vx + race.car.vz * race.car.vz;
    stuck = v2 < 0.25 && t > 240 ? stuck + 1 : 0;
    if (stuck > 360) return null;
  }
  if (race.finishMs < 0 || race.respawns > 0) return null;
  return { code: encodeReplay(rec.toReplay(track.id)), finishMs: race.finishMs };
}

