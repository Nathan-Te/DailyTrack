import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import { PRESS_HEIGHT_TILES, pressAt, sectionClock, type AttemptState, type Level } from "@cdj/jump-sim";
import { PRESS_DUST_TICKS, pressLook } from "./announce";

// Le dessin des presses (lot 22), **affichage seul** : un bloc sombre, dans le style de l'usine, dont **la face basse porte le rouge des dangers** (toute la
// presse tue, mais le rouge dit où elle frappe) ; une tige jusqu'en haut de sa course ; au sol, l'**empreinte** de l'impact. Position lue dans la simulation
// (`pressAt`), jamais recalculée à part.
//   - **Annonce** (principe du lot 18) : pendant les 0,5 s qui précèdent la chute (`pressLook().warn`, de 0 à 1), la presse **frémit** (amplitude croissante,
//     2,9 Hz : lent, jamais un clignotement) et l'empreinte au sol **s'assombrit**, en continu, jusqu'au pas où la chute part. Hors annonce, l'empreinte est
//     au plus discrète et la presse immobile.
//   - **Impact** : quelques poussières qui montent et s'estompent pendant 0,5 s (fonction de la phase, aucun état) ; **aucune secousse de caméra** (lot 14).
//   - **Carnage** (lot 17) : élément à horloge, donc estompé (`setFade`, 35 %) ; ses pièces **ne se recouvrent pas** (corps, face rouge, tige, empreinte,
//     poussières), opaques et sans mélange tant qu'on n'estompe pas.

/** Couleurs : le corps sombre (`--dj-encre` éclaircie), le rouge est celui du thème (`palette.hazard`), l'empreinte et la poussière sont neutres. */
export const PRESS_LOOK = { body: 0x3a322c, rod: 0x2a1e16, footprint: 0x2a1e16, dust: 0xd8cdb6 } as const;
/** Hauteur de la face rouge (tuiles, sur les `PRESS_HEIGHT_TILES` de la presse), largeur de la tige, opacité de l'empreinte au repos et à l'annonce pleine. */
export const FACE = 0.3;
const ROD = 0.3;
export const FOOTPRINT_REST = 0.08;
export const FOOTPRINT_FULL = 0.55;
/** Amplitude du frémissement à l'annonce pleine (tuiles) et sa fréquence (Hz, bien sous `FLICKER_MAX_HZ`). */
export const TREMBLE = 0.05;
export const TREMBLE_HZ = 2.9;
const PUFFS = 5;

export interface PressStats {
  /** Pour chaque presse (ordre de `level.presses`) : où elle est dessinée (coin haut-gauche, tuiles, y vers le bas), l'annonce (0 à 1) et l'opacité de l'empreinte. */
  x: number[];
  y: number[];
  warn: number[];
  footprint: number[];
  /** Les poussières visibles (nombre, par presse) et l'opacité dessinée (1 : normale). */
  dust: number[];
  opacity: number;
}

export interface PressArt {
  readonly stats: PressStats;
  update(prev: Readonly<AttemptState>, state: Readonly<AttemptState>, alpha: number, fade: number, seconds: number): void;
}

/** Les presses d'un niveau ; `null` si le niveau n'en a pas. `colors.hazard` : le rouge du thème. */
export function createPressArt(world: Group, level: Level, colors: { hazard: number }): PressArt | null {
  if (level.presses.length === 0) return null;
  const bodyMat = new MeshBasicMaterial({ color: PRESS_LOOK.body });
  const faceMat = new MeshBasicMaterial({ color: colors.hazard });
  const rodMat = new MeshBasicMaterial({ color: PRESS_LOOK.rod });
  const mats = [bodyMat, faceMat, rodMat];
  const n = level.presses.length;
  const stats: PressStats = { x: Array(n).fill(0), y: Array(n).fill(0), warn: Array(n).fill(0), footprint: Array(n).fill(FOOTPRINT_REST), dust: Array(n).fill(0), opacity: 1 };
  const H = PRESS_HEIGHT_TILES;
  const parts = level.presses.map((p) => {
    // L'empreinte et la poussière ont chacune leur matériau (leur opacité change avec la presse).
    const printMat = new MeshBasicMaterial({ color: PRESS_LOOK.footprint, transparent: true, opacity: FOOTPRINT_REST });
    const dustMat = new MeshBasicMaterial({ color: PRESS_LOOK.dust, transparent: true, opacity: 0 });
    const g = new Group();
    const body = new Mesh(new PlaneGeometry(p.width, H - FACE), bodyMat);
    body.position.set(p.width / 2, -(H - FACE) / 2, 0.1);
    const face = new Mesh(new PlaneGeometry(p.width, FACE), faceMat);
    face.position.set(p.width / 2, -(H - FACE / 2), 0.1);
    g.add(body, face);
    // La tige : de la position haute du bord haut de la presse (dans le repère du groupe, elle monte au-dessus de lui) jusqu'au haut de la course.
    const rod = new Mesh(new PlaneGeometry(ROD, p.travel), rodMat);
    rod.position.set(p.width / 2, p.travel / 2, 0.09);
    g.add(rod);
    world.add(g);
    // L'empreinte : le sol sous la position basse (une tuile d'épaisseur fine), dans le repère du monde.
    const print = new Mesh(new PlaneGeometry(p.width, 0.12), printMat);
    print.position.set(p.col + p.width / 2, -(p.row + p.travel + H) + 0.06, 0.08);
    world.add(print);
    const puffs: Mesh[] = [];
    for (let k = 0; k < PUFFS; k++) {
      const puff = new Mesh(new PlaneGeometry(0.22, 0.22), dustMat);
      puff.visible = false;
      world.add(puff);
      puffs.push(puff);
    }
    return { g, puffs, printMat, dustMat };
  });
  let fade = 1;
  return {
    stats,
    update(prev, state, alpha, nextFade, seconds) {
      const v = Math.max(0, Math.min(1, nextFade));
      if (v !== fade) {
        fade = v;
        for (const m of mats) {
          m.transparent = v < 1;
          m.opacity = v;
        }
        stats.opacity = v;
      }
      level.presses.forEach((p, i) => {
        const a = pressAt(level, prev.sections, prev.time, i);
        const b = pressAt(level, state.sections, state.time, i);
        const far = Math.abs(b.y - a.y) > 4096 * (p.travel + 1);
        const unit = 4096;
        const y = (far ? b.y : a.y + (b.y - a.y) * alpha) / unit;
        const look = pressLook(p, sectionClock(level, state.sections, state.time, p.section));
        const shake = Math.sin(seconds * TREMBLE_HZ * Math.PI * 2) * TREMBLE * look.warn;
        const { g, puffs, printMat, dustMat } = parts[i]!;
        const x = p.col + shake;
        g.position.set(x, -y, 0);
        stats.x[i] = x;
        stats.y[i] = y;
        stats.warn[i] = look.warn;
        // L'empreinte s'assombrit avec l'annonce (continu) : discrète au repos, pleine au pas où la chute part.
        const op = (FOOTPRINT_REST + (FOOTPRINT_FULL - FOOTPRINT_REST) * look.warn) * fade;
        stats.footprint[i] = op;
        printMat.opacity = op;
        // Les poussières : quelques carrés qui s'écartent du point d'impact et montent, puis s'estompent (fonction de l'âge de l'impact).
        let shown = 0;
        puffs.forEach((puff, k) => {
          const on = look.dustAge >= 0;
          puff.visible = on;
          if (!on) return;
          shown++;
          const t = look.dustAge / PRESS_DUST_TICKS;
          const dir = (k / (PUFFS - 1)) * 2 - 1;
          puff.position.set(p.col + p.width / 2 + dir * (p.width / 2 + 0.2 * t), -(p.row + p.travel + H) + 0.15 + 0.5 * t * (1 - Math.abs(dir) * 0.4), 0.11);
        });
        dustMat.opacity = look.dustAge >= 0 ? 0.7 * (1 - look.dustAge / PRESS_DUST_TICKS) * fade : 0;
        stats.dust[i] = shown;
      });
    },
  };
}
