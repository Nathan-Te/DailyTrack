import { ATTEMPT_RUNNING, stepAttempt, type AttemptState } from "./attempt";
import { ALT_KEPT_VERSION } from "./constants";
import type { Level } from "./level";
import { DEFAULT_JUMP_PARAMS, INPUT_JUMP } from "./player";

// Lot 28 — **le saut sur place qui remet les blocs alternés dans l'état voulu**. Depuis la version 12, une reprise sur un point de passage garde l'état des blocs alternés (A ou B) :
// un joueur qui repart en B sur le palier (un sol sûr à toute phase, au moins quatre rangées libres au-dessus) peut sauter une fois sur place — le saut qui part inverse les deux jeux
// (`stepAttempt`) — puis retomber sur le palier, en A. C'est ce que fait un joueur fictif (`demo.ts`) et ce que la validation de l'état B (`etats:modules`) essaie d'abord.

/** Pas où le bouton de saut est tenu pour sauter sur place (au moins `PRESS_MIN` = 5 pas : un appui plus court n'est pas jouable au clavier, lot 11). */
export const ALT_HOP_PRESS = 6;
/** Pas au plus pour retomber sur le palier après le saut (le saut dure ≈ 0,55 s). */
export const ALT_HOP_LAND_MAX = 150;

/**
 * Les commandes qui remettent les blocs alternés en A depuis `state` (un personnage vivant, au sol, sur un palier, les blocs en B) : le saut tenu `ALT_HOP_PRESS` pas, puis rien
 * jusqu'à retomber au sol ; avec l'état obtenu. `null` si `state` n'est pas en B, si le niveau n'est pas de la version 12 ou si le saut ne remet pas A (rien n'a sauté, le personnage
 * ne retombe pas au sol à temps ou meurt).
 */
export function hopToA(level: Level, state: Readonly<AttemptState>): { inputs: number[]; after: AttemptState } | null {
  if (level.simVersion < ALT_KEPT_VERSION || level.alts.length === 0 || (state.alt ?? 0) !== 1 || state.status !== ATTEMPT_RUNNING) return null;
  return hopInPlace(level, state);
}

/**
 * Le saut sur place, quel que soit le niveau et l'état des blocs (les outils : le morceau seul est en version 3) : `hopToA` sans ses gardes. Les deux jeux sont inversés ; `null` si le
 * personnage meurt, ne retombe pas au sol à temps ou si le saut n'a rien inversé.
 */
export function hopInPlace(level: Level, state: Readonly<AttemptState>): { inputs: number[]; after: AttemptState } | null {
  const was = state.alt ?? 0;
  const inputs: number[] = [];
  let s: AttemptState = state as AttemptState;
  for (let i = 0; i < ALT_HOP_PRESS; i++) {
    s = stepAttempt(s, INPUT_JUMP, level, DEFAULT_JUMP_PARAMS);
    inputs.push(INPUT_JUMP);
  }
  for (let i = 0; i < ALT_HOP_LAND_MAX; i++) {
    if (s.status !== ATTEMPT_RUNNING) return null;
    if (s.player.ground === 1 && i > 0) break;
    s = stepAttempt(s, 0, level, DEFAULT_JUMP_PARAMS);
    inputs.push(0);
  }
  if (s.status !== ATTEMPT_RUNNING || s.player.ground !== 1 || (s.alt ?? 0) === was) return null;
  return { inputs, after: s };
}

/**
 * Le texte d'un niveau ou d'un morceau avec les deux jeux de blocs alternés **échangés** (`A` ↔ `B` dans la grille ; le bloc annexe n'est pas touché). Un personnage qui part de l'état B du
 * niveau d'origine joue exactement comme un personnage qui part de l'état A du niveau échangé : c'est ainsi que les outils valident la reprise en B (`etats:modules`) avec la machinerie
 * qui part toujours de A. Les commandes sont les mêmes, rien d'autre ne change.
 */
export function swapAlternes(ascii: string): string {
  const lines = ascii.split("\n");
  const blank = lines.findIndex((l) => l.trim() === "");
  const end = blank < 0 ? lines.length : blank;
  for (let i = 0; i < end; i++) lines[i] = lines[i]!.replace(/[AB]/g, (c) => (c === "A" ? "B" : "A"));
  return lines.join("\n");
}
