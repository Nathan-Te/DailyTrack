// Lot T0 — le banc d'essai : 40 pièces posées selon une suite FIXE de commandes (forme, quart de tour, position, vitesse, instant), sur une plateforme étroite
// (6 m), avec un effondrement provoqué ; plus la « tour propre » de 40 pièces posées exactement (mesure de stabilité). Les deux moteurs rejouent les mêmes commandes.
import { BANC_TABLE } from "./bancTable";
import { empreinte, empreinteTexte } from "./empreinte";
import { type Engine, type PieceKind, type PieceSpec, type Snapshot, type WorldConfig, DEFAULT_CONFIG } from "./interface";
import { pieceBoxes } from "./pieces";

export const BANC_CONFIG: WorldConfig = DEFAULT_CONFIG;
export const BANC_PIECES = 40;
/** Après la dernière pièce, 10 s pour que tout se pose. */
export const BANC_REPOS = 600;
export const BANC_GRAINE = 20261030;
/** Indice de la pièce qui provoque l'effondrement : un long bâton jeté de côté, à pleine vitesse, dans le haut de la tour. */
export const BANC_COUP = 33;

/** Une commande du banc : l'INSTANT, la forme, le quart de tour et la colonne sont fixes ; la hauteur d'apparition se déduit de l'état (voir `apparition`). */
export interface Commande {
  tick: number;
  kind: PieceKind;
  rot: number;
  /** Position horizontale du centre de masse, en huitièmes de mètre. */
  x8: number;
  /** Vitesse horizontale initiale (huitièmes de m/s) : 0 sauf pour le coup. */
  vx8: number;
  /** « dessus » : la pièce naît au-dessus de la tour, tombe à 3 m/s ; « flanc » : jetée de côté à hauteur du sommet. */
  depart: "dessus" | "flanc";
}

/**
 * La suite fixe : forme, quart de tour, colonne et ATTENTE (pas écoulés avant la pièce suivante) viennent de `BANC_TABLE`, calibrée une fois sur le moteur A par un bot
 * glouton (`tools/calibrer-banc.ts` : l'attente est le temps que A a mis à se stabiliser) ; le coup est écrit ici. Aucune lecture d'horloge, aucun hasard non semé.
 */
export function bancCommandes(): Commande[] {
  if (BANC_TABLE.length !== BANC_PIECES) throw new Error(`la table du banc doit avoir ${BANC_PIECES} lignes, pas ${BANC_TABLE.length}`);
  const out: Commande[] = [];
  let tick = 0;
  BANC_TABLE.forEach(([kind, rot, x8, attente], i) => {
    // Le coup : un bâton debout, jeté de la droite vers la gauche à hauteur du sommet de la tour.
    out.push(i === BANC_COUP ? { tick, kind: "I", rot: 1, x8: 72, vx8: -128, depart: "flanc" } : { tick, kind, rot, x8, vx8: 0, depart: "dessus" });
    tick += attente;
  });
  return out;
}

/** Le texte canonique de la suite (une ligne par commande) et son empreinte : un test les fige. */
export function bancTexte(cmds: Commande[] = bancCommandes()): string {
  return cmds.map((c) => `${c.tick} ${c.kind} ${c.rot} ${c.x8} ${c.vx8} ${c.depart}`).join("\n");
}
export const bancEmpreinte = (): string => empreinteTexte(bancTexte());

const HALF_PI = 1.5707963267948966;

/**
 * Le sommet de la tour (borne haute, en mètres) d'après l'instantané : pour chaque pièce non perdue, ses coins ; une pièce à un multiple de 90° (à 0,02 rad près)
 * donne son sommet exact, une autre son rayon. Sans sinus ni cosinus. Lecture seule de l'état : la hauteur d'apparition en dépend, comme dans le jeu où la pièce
 * naît en haut de l'écran, au-dessus de la tour.
 */
export function sommetTour(s: Snapshot, specs: PieceSpec[]): number {
  let h = 0;
  for (const p of s.pieces) {
    if (p.lost) continue;
    const spec = specs[p.id]!;
    const k = Math.round(p.angle / HALF_PI);
    const droit = Math.abs(p.angle - k * HALF_PI) < 0.02;
    const boxes = pieceBoxes(spec.kind, (spec.rot + k) & 3);
    let top = 0;
    for (const b of boxes) {
      const hy = droit ? (b.cy + b.hh) / 8 : Math.sqrt((b.cx + b.hw) * (b.cx + b.hw) + (b.cy + b.hh) * (b.cy + b.hh)) / 8;
      if (hy > top) top = hy;
    }
    if (p.y + top > h) h = p.y + top;
  }
  return h;
}

/** Fait naître la pièce d'une commande : au-dessus du sommet de la tour (marge de 1,5 m, vitesse de chute de 3 m/s) ou, pour le coup, 2,5 m sous le sommet. */
export function apparition(c: Commande, sommet: number): PieceSpec {
  const boxes = pieceBoxes(c.kind, c.rot);
  let bas8 = 0;
  for (const b of boxes) bas8 = Math.min(bas8, b.cy - b.hh);
  if (c.depart === "flanc") {
    const y8 = Math.max(48, Math.ceil(sommet * 8) - 20);
    return { kind: c.kind, rot: c.rot, x8: c.x8, y8, vx8: c.vx8, vy8: 0 };
  }
  const y8 = Math.ceil(sommet * 8) + 12 - bas8;
  return { kind: c.kind, rot: c.rot, x8: c.x8, y8: Math.max(y8, 40), vx8: 0, vy8: -24 };
}

export interface TraceBanc {
  tick: number;
  empreinte: string;
}

export interface ResultatBanc {
  moteur: string;
  /** Empreinte de l'état final. */
  empreinte: string;
  /** Empreintes intermédiaires toutes les `trace` pas : localisent un écart entre deux plateformes. */
  traces: TraceBanc[];
  final: Snapshot;
  ticks: number;
  tombees: number;
  /** Les pièces telles qu'elles sont nées (hauteur d'apparition déduite de l'état) : de quoi relire le banc. */
  specs: PieceSpec[];
}

/** Rejoue le banc entier sur un moteur ; `trace` : intervalle des empreintes intermédiaires (0 = aucune). */
export function rejouerBanc(engine: Engine, options: { trace?: number; config?: WorldConfig; commandes?: Commande[]; repos?: number } = {}): ResultatBanc {
  const cmds = options.commandes ?? bancCommandes();
  const config = options.config ?? BANC_CONFIG;
  const world = engine.createWorld(config);
  const total = cmds[cmds.length - 1]!.tick + (options.repos ?? BANC_REPOS);
  const traces: TraceBanc[] = [];
  const specs: PieceSpec[] = [];
  let next = 0;
  for (let t = 0; t < total; t++) {
    while (next < cmds.length && cmds[next]!.tick === t) {
      const spec = apparition(cmds[next++]!, sommetTour(engine.snapshot(world), specs));
      specs.push(spec);
      engine.addPiece(world, spec);
    }
    engine.step(world);
    if (options.trace && (t + 1) % options.trace === 0) traces.push({ tick: t + 1, empreinte: empreinte(engine.snapshot(world)) });
  }
  const final = engine.snapshot(world);
  const res: ResultatBanc = {
    moteur: engine.name,
    empreinte: empreinte(final),
    traces,
    final,
    ticks: total,
    tombees: final.pieces.filter((p) => p.lost).length,
    specs,
  };
  engine.dispose(world);
  return res;
}

// ---- la tour propre : 40 pièces posées exactement, sans vitesse ----

/**
 * 40 pièces rangées en couches (sans jeu entre elles) sur la plateforme de 6 m : trois carrés (6 m × 2 m), deux carrés (4 m × 2 m), un bâton couché (4 m × 1 m),
 * un second bâton ; 5 fois, puis encore trois carrés et deux carrés — 34 m de haut. Le centre de masse de chaque couche est sur l'axe : elle tient en théorie.
 */
export function tourPropre(): PieceSpec[] {
  const out: PieceSpec[] = [];
  const O = (x8: number, y8: number): PieceSpec => ({ kind: "O", rot: 0, x8, y8, vx8: 0, vy8: 0 });
  const I = (x8: number, y8: number): PieceSpec => ({ kind: "I", rot: 0, x8, y8, vx8: 0, vy8: 0 });
  let y = 0; // dessus de la couche, en huitièmes
  const couche = (kind: "3O" | "2O" | "I"): void => {
    if (kind === "3O") {
      for (const x of [-16, 0, 16]) out.push(O(x * 1, y + 8 * 1));
      y += 16;
    } else if (kind === "2O") {
      for (const x of [-8, 8]) out.push(O(x * 1, y + 8));
      y += 16;
    } else {
      out.push(I(0, y + 4));
      y += 8;
    }
  };
  for (let k = 0; k < 5; k++) {
    couche("3O");
    couche("2O");
    couche("I");
    couche("I");
  }
  couche("3O");
  couche("2O");
  if (out.length !== BANC_PIECES) throw new Error(`la tour propre doit avoir ${BANC_PIECES} pièces, pas ${out.length}`);
  return out;
}


/** Rejoue la tour propre (40 pièces posées sans vitesse) pendant `secondes`, empreintes toutes les `trace` pas : la tour doit rester où elle est. */
export function rejouerTour(engine: Engine, config: WorldConfig, secondes: number, trace = 0): { empreinte: string; traces: TraceBanc[]; final: Snapshot } {
  const world = engine.createWorld(config);
  for (const s of tourPropre()) engine.addPiece(world, s);
  const traces: TraceBanc[] = [];
  const total = secondes * config.hz;
  for (let t = 1; t <= total; t++) {
    engine.step(world);
    if (trace && t % trace === 0) traces.push({ tick: t, empreinte: empreinte(engine.snapshot(world)) });
  }
  const final = engine.snapshot(world);
  const res = { empreinte: empreinte(final), traces, final };
  engine.dispose(world);
  return res;
}
