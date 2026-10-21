import { ATTEMPT_DEAD, DEFAULT_JUMP_PARAMS, PLAYER_HEIGHT, PLAYER_WIDTH, UNITS_PER_TILE, decodeReplay, fromRuns, initialAttempt, stepAttempt, type DailyLevel, type SlowRoute } from "@cdj/jump-sim";

// Lot 16 — la seconde voie vue par le jeu (pur : aucune dépendance au rendu ; `scene.ts` dessine).
//   - **Le repère d'entrée** d'une voie lente : l'ouverture dans le mur gauche de la cage (trois rangées au-dessus du toit de la piste) est
//     cernée d'un cadre et porte deux chevrons qui montent. Couleurs de la charte « Cartouches » : `--dj-papier` (crème clair) cerné de
//     `--dj-encre` (brun foncé), **jamais le rouge des dangers** ni le jaune du personnage : un repère neutre, sans texte.
//   - **`?debug`** : les deux trajets de chaque portion dure (la preuve de l'auteur et la voie lente enregistrée) et leurs temps.

/** Couleurs du repère : `--dj-papier` (face) et `--dj-encre` (cerne), les valeurs de la charte (`docs/plateforme/identite.md`, § 3.1). */
export const SLOW_MARK = { face: 0xfff6e0, edge: 0x2a1e16 } as const;
/** `?debug` : le trajet rapide (cyan) et le trajet lent (crème), comme le fantôme et le repère. */
export const SLOW_DEBUG = { fast: 0x6fd3ff, slow: 0xfff6e0 } as const;

/** Un quadrilatère du repère, en tuiles (x vers la droite, y vers le bas comme la simulation), tourné de `angle` radians autour de son centre. */
export interface MarkQuad {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
}

/** Le repère d'une voie : le cadre de l'ouverture (quatre côtés) et deux chevrons « ∧ » empilés dedans. */
export function slowMarkQuads(route: Pick<SlowRoute, "zone" | "entryRow">): MarkQuad[] {
  const x = route.zone;
  const top = route.entryRow - 5;
  const t = 0.08;
  const quads: MarkQuad[] = [
    { x: x + 0.5, y: top + 0.04, w: 1, h: t, angle: 0 },
    { x: x + 0.5, y: top + 2.96, w: 1, h: t, angle: 0 },
    { x: x + 0.04, y: top + 1.5, w: t, h: 3, angle: 0 },
    { x: x + 0.96, y: top + 1.5, w: t, h: 3, angle: 0 },
  ];
  // Deux chevrons qui montent (vers le haut et vers la cage) : chacun deux barres inclinées à ±40°.
  for (const cy of [top + 1.05, top + 1.85]) {
    quads.push({ x: x + 0.34, y: cy, w: 0.42, h: 0.12, angle: 0.7 });
    quads.push({ x: x + 0.66, y: cy, w: 0.42, h: 0.12, angle: -0.7 });
  }
  return quads;
}

/** `?debug` : un trajet (centres du personnage en tuiles, y vers le bas), de `from` à `to` pas d'une suite de commandes rejouée. */
export function pathOf(level: DailyLevel["level"], inputs: readonly number[], from: number, to: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let s = initialAttempt(level);
  for (let t = 0; t < inputs.length && t < to; t++) {
    s = stepAttempt(s, inputs[t]!, level, DEFAULT_JUMP_PARAMS);
    if (s.status === ATTEMPT_DEAD) break;
    if (t + 1 >= from && (t - from) % 4 === 0) out.push({ x: (s.player.x + PLAYER_WIDTH / 2) / UNITS_PER_TILE, y: (s.player.y + PLAYER_HEIGHT / 2) / UNITS_PER_TILE });
  }
  return out;
}

/** `?debug` : les deux trajets d'une portion dure et l'étiquette de leurs temps (secondes à 2 décimales, le surcoût). */
export interface SlowDebugPath {
  fast: { x: number; y: number }[];
  slow: { x: number; y: number }[];
  /** Où poser l'étiquette (tuiles, y vers le bas) et son texte. */
  at: { x: number; y: number };
  label: string;
}

const seconds = (ticks: number) => (ticks / 120).toFixed(2);

export function slowDebugPaths(daily: Pick<DailyLevel, "level" | "replay" | "slowRoutes" | "pieces">): SlowDebugPath[] {
  const proof = fromRuns(daily.replay.runs);
  return daily.slowRoutes.map((r) => {
    const slowInputs = fromRuns(decodeReplay(r.code).runs);
    const p = daily.pieces[r.piece]!;
    // i18n-ok: étiquette de débogage (`?debug`) : outil interne, pas un texte d'interface
    const label = `${p.id} · rapide ${seconds(r.fastTicks)} s · lente ${seconds(r.slowTicks)} s (+${seconds(r.slowTicks - r.fastTicks)} s)`;
    return {
      fast: pathOf(daily.level, proof, r.fork, r.fork + r.fastTicks),
      slow: pathOf(daily.level, slowInputs, r.fork, r.fork + r.slowTicks),
      at: { x: r.zone + 3, y: r.galleryRow - 4.6 },
      label,
    };
  });
}
