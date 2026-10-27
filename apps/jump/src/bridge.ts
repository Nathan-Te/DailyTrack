import { TILE_BRIDGE_ON, bridgeTileLit, standsOnSwitch, type AttemptState, type Bridge, type Level } from "@cdj/jump-sim";
import { bridgeGauge } from "./announce";

// Le pont à interrupteur (lot 26) vu par le jeu, **logique pure** et testée : ce qui s'affiche (tuile allumée, éteinte, qui attend la sortie du personnage, sa jauge qui se vide pendant
// les 0,4 s qui précèdent son extinction), l'aspect de l'interrupteur, les couleurs réservées. Rien ici ne modifie la simulation : on lit `AttemptState.bridges` et `AttemptState.tiles`.
//   - **Couleurs** : une lumière froide de la nuit, un cyan (teinte ≈ 188°) — **ni le rouge des dangers (0°) ni le jaune du personnage (44°)** (règle du lot 9 : à 30° au moins de
//     chacun), et à plus de 30° du bleu-violet des blocs clignotants (226°). Le pont éteint n'est qu'un **contour pointillé discret** (cinq tirets par côté), comme un bloc absent.
//   - **Annonce** (principe du lot 18) : chaque tuile allumée se vide comme une jauge pendant les 0,4 s qui précèdent son extinction (`bridgeGauge`) ; comme les tuiles s'éteignent une à
//     une à `BRIDGE_STEP` pas d'écart, la vague d'extinction se lit d'un seul regard, de l'interrupteur vers le bout. Aucun clignotement, aucune secousse de caméra.
//   - **L'affichage ne ment jamais** : une tuile est dessinée pleine exactement quand la simulation la tient pleine (`TILE_BRIDGE_ON` dans `tiles`), pointillée sinon ; une tuile qui doit
//     s'allumer pendant que la boîte du personnage la chevauche (règle de sortie) a un contour épais et pas de face.
//   - **Carnage** (lot 17) : l'état d'un pont dépend de chaque vie ; le carnage le dessine **allumé** (jamais en train de s'éteindre) à 35 % d'opacité (`scene.clockFade`).

export const BRIDGE_LOOK = {
  /** La lumière du pont : face allumée, liseré clair, trait de crête. */
  fill: 0x38dcff,
  edge: 0xdaf8ff,
  crest: 0xffffff,
  /** L'interrupteur : socle sombre, plaque éteinte (le pont dort), plaque allumée (le pont brille), couronne. */
  base: 0x0e3a4a,
  plateOff: 0x3a9bb4,
  plateOn: 0xb6f4ff,
  ring: 0x38dcff,
} as const;

/** Ce qu'on dessine pour une tuile de pont : pleine ou non, la hauteur de sa face (la jauge : 0 vide … 1 pleine), et si elle attend la sortie du personnage. */
export interface BridgeTileLook {
  solid: boolean;
  fill: number;
  waiting: boolean;
}

/** Ce qu'on dessine pour un interrupteur : enfoncé (le personnage est posé dessus) et le pont est-il allumé ? */
export interface SwitchLook {
  pressed: boolean;
  lit: boolean;
}

/** Les tuiles de tous les ponts (dans l'ordre de `Level.bridges`, puis de chaque pont) dans cet état. `carnage` : l'état est toujours « allumé, pleine jauge » (état d'une autre vie). */
export function bridgeTileLooks(level: Level, state: Readonly<AttemptState>, carnage = false, out: BridgeTileLook[] = []): BridgeTileLook[] {
  let n = 0;
  level.bridges.forEach((b, i) => {
    const age = state.bridges?.[i] ?? 0;
    b.tiles.forEach((cell, k) => {
      const slot = (out[n++] ??= { solid: false, fill: 0, waiting: false });
      if (carnage) {
        slot.solid = true;
        slot.fill = 1;
        slot.waiting = false;
        return;
      }
      const solid = state.tiles[cell.row * level.width + cell.col] === TILE_BRIDGE_ON;
      slot.solid = solid;
      slot.fill = solid ? bridgeGauge(b.delay, k, age) : 0;
      slot.waiting = !solid && bridgeTileLit(b, age, k);
    });
  });
  out.length = n;
  return out;
}

/** L'interrupteur du pont `i` dans cet état. */
export function switchLook(level: Level, state: Readonly<AttemptState>, i: number, carnage = false): SwitchLook {
  const b: Bridge = level.bridges[i]!;
  if (carnage) return { pressed: false, lit: true };
  return { pressed: standsOnSwitch(b, state.player), lit: (state.bridges?.[i] ?? 0) > 0 };
}

/** Le nombre total de tuiles de pont d'un niveau. */
export function bridgeTileCount(level: Level): number {
  return level.bridges.reduce((n, b) => n + b.tiles.length, 0);
}
