// Les palettes et les ambiances de chaque thème, les types de la scène et **le décor d'aujourd'hui** (lots 9b, 22, 23, 37) : tribune du départ, décor du
// thème, front de rue et lampadaires de la Ville, passe dense. Lot 43 : la route, les accessoires et l'assemblage de l'ancienne scène sont partis dans
// `scene/existant.ts` (chargé à la demande) ; le palier 1 (`scene/composerP1.ts`, premier chargement) garde ce décor tel quel (`decorGeometry`).
import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace, type Mesh, type MeshStandardMaterial, type Scene } from "three";
import {
  CELL,
  FALL_DEPTH,
  cellKey,
  NO_GROUND,
  createSurface,
  trackWorld,
  WALL_HEIGHT,
  rippleAt,
  bankAt,
  blockHeight,
  blockHalfWidth,
  curveCenter,
  curveSize,
  isCurve,
  turnsLeft,
  type BankSample,
  type Block,
  type PaletteName,
  type SurfaceKind,
  type Track,
  type World,
} from "@cdj/sim";
import { PALETTE_LABELS } from "./labels";
import { Builder, mix, seeded, shade, world, type Box, type V3 } from "./meshKit";
import { CHAPEAU, MARGE_DECOR, placed, type PoseLog } from "./decorPose";
import type { EtatFeux } from "./feux";
import type { TextesScene } from "./scene/types";

/** Couleurs et éclairage d'un thème. Une palette différente par jour : `paletteForDay` (sim) choisit laquelle. */
export interface Palette {
  label: string;
  sky: number;
  fogNear: number;
  fogFar: number;
  ambient: [color: number, intensity: number];
  sun: [color: number, intensity: number];
  floorA: string;
  floorB: string;
  road: [number, number];
  dash: number;
  skirt: number;
  wallA: number;
  wallB: number;
  boost: number;
  boostMark: number;
  checkpoint: number;
  finish: number;
  finishDark: number;
  /** Haut du ciel (le bas est `sky`), disque du soleil ou de la lune (null : aucun), montagnes lointaines et leur sommet. */
  zenith: number;
  disc: number | null;
  mountain: number;
  mountainTop: number;
  /** Décor au bord de la piste : cactus et rochers, sapins, lampadaires, arbres, pylônes lumineux, drapeaux et haies (Stade). */
  scenery: "desert" | "pine" | "lamps" | "trees" | "pylons" | "flags" | "canyon" | "alpine" | "city";
  /**
   * Lumière (lot 21) : hauteur du soleil (0 = à l'horizon, 1 = au zénith : la lumière vient d'en haut, le disque monte) et rebord au bout
   * d'un bas-côté (couleurs alternées : muret, clôture de bois, filet…). `neon` : bordure lumineuse au bord du vide (Nuit).
   */
  sunHeight: number;
  fence: [number, number];
  neon?: [number, number];
  /**
   * Hauteur dessinée du chapeau des rebords (m) : `WALL_HEIGHT` (1,4, la hauteur de la simulation) par défaut. Présentation seule : la voiture n'y change rien.
   * Lot 37 : la Ville, qui les dessinait hauts (3,4 m, des murs qui cachaient la ville), a un muret bas de béton surmonté d'un garde-corps.
   */
  wallHeight?: number;
  /** `garde-corps` (lot 37) : au-dessus du muret de béton (`wallHeight`), des lisses et des montants jusqu'à `WALL_HEIGHT` : on voit à travers. */
  barrier?: "garde-corps";
}

export const PALETTE_DEFS: Record<PaletteName, Palette> = {
  desert: {
    label: PALETTE_LABELS.desert,
    sky: 0xf2b27a, fogNear: 90, fogFar: 320,
    ambient: [0xfff0e0, 0.9], sun: [0xffffff, 2.2],
    floorA: "#d9a35f", floorB: "#c78f4c",
    road: [0x9a9da8, 0x8a8d98], dash: 0xf4f1e6, skirt: 0x5b4a3a,
    wallA: 0xe8283a, wallB: 0xf4f4f4,
    boost: 0xffd22e, boostMark: 0xe39b00, checkpoint: 0x2e7dff, finish: 0xf4f4f4, finishDark: 0x16181f,
    zenith: 0x6ea6d8, disc: 0xfff2c9, mountain: 0xc7794a, mountainTop: 0xe9a06a, scenery: "desert",
    sunHeight: 0.45, fence: [0x2a2a2e, 0xe8e0d0], // pneus empilés et bande claire
  },
  neige: {
    label: PALETTE_LABELS.neige,
    // Jour blanc (lot 21) : ciel laiteux presque uni, brume claire et proche, lumière diffuse plutôt qu'un soleil franc.
    sky: 0xe6edf3, fogNear: 60, fogFar: 260,
    ambient: [0xf2f7ff, 1.25], sun: [0xffffff, 1.5],
    floorA: "#f4f8fb", floorB: "#e1ebf3",
    road: [0x6f7a8c, 0x646f82], dash: 0xffffff, skirt: 0x8a97ab,
    wallA: 0x2f6fd0, wallB: 0xffffff,
    boost: 0xffc414, boostMark: 0xe08a00, checkpoint: 0x1fb6a6, finish: 0xffffff, finishDark: 0x16181f,
    zenith: 0xbfd2e4, disc: 0xffffff, mountain: 0x9fb4cc, mountainTop: 0xffffff, scenery: "pine",
    sunHeight: 0.6, fence: [0x2f6fd0, 0xffffff],
  },
  nuit: {
    label: PALETTE_LABELS.nuit,
    sky: 0x0b1030, fogNear: 60, fogFar: 260,
    ambient: [0x8fa0ff, 0.75], sun: [0xaab8ff, 1.1],
    floorA: "#1a1f3d", floorB: "#141935",
    road: [0x434863, 0x3a3f58], dash: 0xe9e6ff, skirt: 0x1b1d2e,
    wallA: 0xff5a36, wallB: 0xffe9c4,
    boost: 0xffd22e, boostMark: 0xe39b00, checkpoint: 0x39c0ff, finish: 0xf4f4f4, finishDark: 0x16181f,
    zenith: 0x02030f, disc: 0xdfe8ff, mountain: 0x1a2145, mountainTop: 0x2b3566, scenery: "lamps",
    sunHeight: 0.5, fence: [0xff5a36, 0xffe9c4], neon: [0x00e5ff, 0xff2bd6],
  },
  campagne: {
    label: PALETTE_LABELS.campagne,
    // Fin d'après-midi (lot 21) : horizon doré, soleil bas et chaud.
    sky: 0xf6cf96, fogNear: 100, fogFar: 340,
    ambient: [0xffe8cc, 0.9], sun: [0xffcf8a, 2.1],
    floorA: "#6fbf4f", floorB: "#63b044",
    road: [0x80838c, 0x777a83], dash: 0xf4f1e6, skirt: 0x5a6b3c,
    wallA: 0xd9402a, wallB: 0xf6f6f0,
    boost: 0xffd22e, boostMark: 0xe39b00, checkpoint: 0x2e7dff, finish: 0xf4f4f4, finishDark: 0x16181f,
    zenith: 0x5b8fd2, disc: 0xffd27a, mountain: 0x5f9a63, mountainTop: 0x7db681, scenery: "trees",
    sunHeight: 0.18, fence: [0x7a5230, 0x9a6a3e], // clôture de bois
  },
  neon: {
    label: PALETTE_LABELS.neon,
    sky: 0x120024, fogNear: 70, fogFar: 280,
    ambient: [0xd8b0ff, 0.85], sun: [0xff9af0, 1.3],
    floorA: "#2a0a4a", floorB: "#210840",
    road: [0x2d2250, 0x261c45], dash: 0x00f0ff, skirt: 0x14092b,
    wallA: 0xff2bd6, wallB: 0x00f0ff,
    boost: 0xfff200, boostMark: 0xff7a00, checkpoint: 0x00ff9c, finish: 0xffffff, finishDark: 0x16181f,
    zenith: 0x06000f, disc: 0xff4fd8, mountain: 0x2a0b55, mountainTop: 0x7a2bff, scenery: "pylons",
    sunHeight: 0.5, fence: [0xff2bd6, 0x00f0ff], neon: [0x00f0ff, 0xff2bd6],
  },
  stade: {
    label: PALETTE_LABELS.stade,
    // Plein jour ensoleillé (lot 21) : ciel bleu franc, soleil haut et chaud, herbe verte, route d'asphalte sombre.
    sky: 0xb4dcff, fogNear: 140, fogFar: 420,
    ambient: [0xfff4e0, 1.0], sun: [0xfff1d2, 2.7],
    floorA: "#5cb544", floorB: "#51a83b",
    road: [0x5f636d, 0x585c66], dash: 0xffffff, skirt: 0x8b8f99,
    wallA: 0xe8283a, wallB: 0xf4f4f4,
    boost: 0xffd22e, boostMark: 0xe39b00, checkpoint: 0x2e7dff, finish: 0xf4f4f4, finishDark: 0x16181f,
    zenith: 0x2f7fe0, disc: 0xfffbe8, mountain: 0x6f9fca, mountainTop: 0xdfeefa, scenery: "flags",
    sunHeight: 0.85, fence: [0x2e7dff, 0xf4f4f4], // muret bleu et blanc
  },
  canyon: {
    label: PALETTE_LABELS.canyon,
    // Soleil rasant orangé (lot 22) : ciel cuivré, ombres longues, sol de sable et parois de roche rouge.
    sky: 0xf2a463, fogNear: 80, fogFar: 300,
    ambient: [0xffdcb8, 1.35], sun: [0xff9a4a, 2.4],
    floorA: "#d49a55", floorB: "#c88c47",
    road: [0x8a7468, 0x7f6a5e], dash: 0xf6e6c8, skirt: 0x93472a,
    wallA: 0xb04a2a, wallB: 0xe6a46a,
    boost: 0xffd22e, boostMark: 0xe39b00, checkpoint: 0x2e7dff, finish: 0xf4f4f4, finishDark: 0x16181f,
    zenith: 0x6a5aa0, disc: 0xffd89a, mountain: 0xa8452a, mountainTop: 0xe08a52, scenery: "canyon",
    sunHeight: 0.2, fence: [0xa8472a, 0xdc9a5e], // blocs de roche rouge et ocre
  },
  alpin: {
    label: PALETTE_LABELS.alpin,
    // Matin clair en montagne (lot 22) : air limpide, ciel bleu profond, alpage vert, cimes enneigées au loin.
    sky: 0xcde6f7, fogNear: 130, fogFar: 400,
    ambient: [0xeaf4ff, 1.05], sun: [0xfff6e2, 2.4],
    floorA: "#8fb67a", floorB: "#84ab70",
    road: [0x666b75, 0x5e636d], dash: 0xffffff, skirt: 0x7b8794,
    wallA: 0xe8283a, wallB: 0xf6f6f6,
    boost: 0xffd22e, boostMark: 0xe39b00, checkpoint: 0x2e7dff, finish: 0xf4f4f4, finishDark: 0x16181f,
    zenith: 0x3a82d6, disc: 0xfffbe6, mountain: 0x78899e, mountainTop: 0xffffff, scenery: "alpine",
    sunHeight: 0.5, fence: [0xe8283a, 0xf6f6f6], // glissières rouges et blanches
  },
  ville: {
    label: PALETTE_LABELS.ville,
    // Jour de ville (lot 22) : béton clair, ciel voilé bleu-gris, route d'asphalte sombre entre des rebords de béton (bas depuis le lot 37 : on voit la ville).
    sky: 0xc3d6e6, fogNear: 110, fogFar: 350,
    ambient: [0xf2f5ff, 1.0], sun: [0xfff3dc, 2.1],
    floorA: "#9a9da4", floorB: "#8f9298",
    road: [0x474a52, 0x41444c], dash: 0xf4f1e6, skirt: 0x707680,
    wallA: 0xbfc2c8, wallB: 0xa4a8af,
    boost: 0xffd22e, boostMark: 0xe39b00, checkpoint: 0x2e7dff, finish: 0xf4f4f4, finishDark: 0x16181f,
    zenith: 0x6f9fd2, disc: 0xfff6dc, mountain: 0x8a95a6, mountainTop: 0xb6c1cf, scenery: "city",
    sunHeight: 0.7, fence: [0xc4c7cd, 0xa4a8af], wallHeight: 0.8, barrier: "garde-corps", // muret de béton bas et garde-corps (lot 37 ; 3,4 m de mur avant)
  },
};

/**
 * Ambiance d'un thème (lot 23), en plus de la palette : `exposure` (tonalité du rendu), `haze` (brume : > 1 plus dense, < 1 plus claire),
 * `halo` (force des halos sur néons, lampadaires et portes ; 0 le jour), `headlights` (puissance des phares : 0 le jour),
 * `shadow` (0–1 : à quel point les ombres portées sont marquées ; la lumière rasante en donne de longues).
 */
export interface Look {
  exposure: number;
  haze: number;
  halo: number;
  headlights: number;
  shadow: number;
}

export const LOOKS: Record<PaletteName, Look> = {
  desert: { exposure: 1.0, haze: 1.0, halo: 0.1, headlights: 0, shadow: 0.8 }, // Rallye : poussière, soleil franc
  neige: { exposure: 1.06, haze: 1.35, halo: 0, headlights: 0, shadow: 0.35 }, // Banquise : jour blanc, ombres douces, brume laiteuse
  nuit: { exposure: 1.15, haze: 0.95, halo: 1, headlights: 1, shadow: 0.55 }, // Nuit : lampadaires, phares
  neon: { exposure: 1.1, haze: 1.0, halo: 1.25, headlights: 1, shadow: 0.5 },
  campagne: { exposure: 1.0, haze: 1.1, halo: 0, headlights: 0, shadow: 0.9 }, // fin d'après-midi : ombres longues
  stade: { exposure: 1.02, haze: 0.8, halo: 0.1, headlights: 0, shadow: 1 }, // plein soleil : ombres nettes
  canyon: { exposure: 1.04, haze: 1.2, halo: 0, headlights: 0, shadow: 1 }, // soleil rasant, air poussiéreux
  alpin: { exposure: 1.0, haze: 0.7, halo: 0, headlights: 0, shadow: 0.85 }, // air limpide
  ville: { exposure: 0.96, haze: 1.3, halo: 0.2, headlights: 0, shadow: 0.7 }, // voile de ville
};

/** Couleurs de la route selon le revêtement (deux tons en alternance, comme la route) : lisibles d'un coup d'œil. */
export const SURFACE_COLORS: Record<Exclude<SurfaceKind, "road">, [number, number]> = {
  dirt: [0x8f6b43, 0x82603b],
  ice: [0xc4e9f7, 0xb2dff1],
  grass: [0x58a340, 0x4e9638],
  // Bas-côtés (lot 21) et vibreur : gravier gris-brun, neige poudreuse presque blanche ; le vibreur est dessiné à part (rouge et blanc).
  gravel: [0x9b8a72, 0x8f7f68],
  snow: [0xf4f8fc, 0xe9f0f7],
  // Sable (lot 22) : beige chaud, un ton plus clair que le sol du Canyon pour que la bande se lise.
  sand: [0xf2d690, 0xe8ca82],
  kerb: [0xe8283a, 0xf4f4f4],
};
const bank: BankSample = { h: 0, gp: 0, gq: 0 };

/** Point (rayon `r`, angle `a` depuis l'entrée) d'un virage, serré ou large ; la hauteur suit le relevé éventuel. */
export function arcPoint(b: Block, r: number, a: number, y: number): V3 {
  const { cp } = curveCenter(b.kind);
  const side = turnsLeft(b.kind) ? -1 : 1;
  const p = cp + side * r * Math.cos(a);
  const q = r * Math.sin(a);
  if (b.banked) {
    bankAt(b, p, q, bank);
    y += bank.h;
  }
  return world(b, p, q, y);
}

/** Hauteur de la route d'un bloc droit, tôle ondulée comprise (route bosselée, lot 21). */
export function roadHeight(b: Block, q: number): number {
  if (!b.bumpy) return blockHeight(b, q);
  rippleAt(q, ripple);
  return blockHeight(b, q) + ripple.h;
}
const ripple = { h: 0, dq: 0 };

/** Point du bloc : `lat` mètres à gauche de l'axe, `t` ∈ [0, 1] le long du bloc, à `lift` au-dessus de la route. */
export function onBlock(b: Block, lat: number, t: number, lift: number): V3 {
  if (isCurve(b.kind)) {
    const { r: R } = curveCenter(b.kind);
    return arcPoint(b, turnsLeft(b.kind) ? R - lat : R + lat, t * (Math.PI / 2), b.y0 + lift);
  }
  const q = t * CELL;
  return world(b, CELL / 2 + lat, q, blockHeight(b, q) + lift);
}


// --- Sensation de vitesse (lot 15) : poteaux, arches, chevrons ---------------------------------------------------
// Des éléments réguliers qui défilent au bord de la piste (décor seulement : aucune collision, rien dans `sim`). Plus serrés
// dans une portion rapide (`fastZones`), où s'ajoutent des arches et des chevrons peints au sol. Rangés dans le décor
// « lourd » : masqués à la qualité basse, absents des miniatures.

/** Poutre entre deux points `a` et `b` (à la même hauteur), épaisse de `y1 - y0`, profonde de `2 × depth` le long de `fwd`. */
export function beam(g: Builder, a: V3, b: V3, fwd: [number, number], depth: number, y0: number, y1: number, color: number) {
  const pt = (e: V3, f: number, y: number): V3 => [e[0] + fwd[0] * f * depth, y, e[2] + fwd[1] * f * depth];
  const c = (f: number, y: number): [V3, V3] => [pt(a, f, y), pt(b, f, y)];
  const [fa0, fb0] = c(1, y0);
  const [fa1, fb1] = c(1, y1);
  const [ba0, bb0] = c(-1, y0);
  const [ba1, bb1] = c(-1, y1);
  g.quad(fa0, fb0, fb1, fa1, color);
  g.quad(bb0, ba0, ba1, bb1, color);
  g.quad(fa1, fb1, bb1, ba1, shade(color, 1.15));
  g.quad(ba0, bb0, fb0, fa0, shade(color, 0.7));
  g.quad(ba0, fa0, fa1, ba1, color);
  g.quad(fb0, bb0, bb1, fb1, color);
}


/**
 * Mobilier de rue de la Ville (lot 37) : un lampadaire sur le chapeau du rebord, un bloc sur deux, un côté puis l'autre. Le pied est sur le chapeau (appui :
 * le rebord), la potence passe au-dessus de la route à 5,9 m, au-dessus du passage et de la caméra ; la lampe est un halo. C'est lui qui habille la rue, à
 * hauteur de voiture ; les lampadaires qui étaient posés au sol, huit mètres plus bas, ne se voyaient pas.
 */
export function addStreetLamps(g: Builder, glow: Builder, pal: Palette, b: Block, log?: PoseLog) {
  if (pal.scenery !== "city" || !hasCap(b) || b.index % 2 === 0) return;
  const cap = pal.wallHeight ?? WALL_HEIGHT;
  const side = b.index % 4 === 1 ? 1 : -1;
  const p = onRim(b, 0.5, side, CHAPEAU / 2, cap);
  const c = onBlock(b, 0, 0.5, 0);
  const len = Math.hypot(c[0] - p[0], c[2] - p[2]) || 1;
  const inward: [number, number] = [(c[0] - p[0]) / len, (c[2] - p[2]) / len];
  const meta = { kind: "lampadaire", block: b.index, style: "", group: log?.group() ?? 0 } as const;
  const top = p[1] + 5.2;
  const reach: V3 = [p[0] + inward[0] * 1.8, top, p[2] + inward[1] * 1.8];
  placed(log, { ...meta, part: "pied", appui: "rebord" }, [g], () => g.box(p[0] - 0.1, p[1], p[2] - 0.1, p[0] + 0.1, top, p[2] + 0.1, 0x3a3f4d));
  placed(log, { ...meta, part: "surplomb", appui: "rebord" }, [g, glow], () => {
    beam(g, [p[0], 0, p[2]], [reach[0], 0, reach[2]], [-inward[1], inward[0]], 0.05, top - 0.1, top + 0.04, 0x3a3f4d);
    glow.box(reach[0] - 0.25, top - 0.2, reach[2] - 0.25, reach[0] + 0.25, top - 0.1, reach[2] + 0.25, 0xf6efd0);
    glow.halo(reach[0], top - 0.15, reach[2], 0xfff0c8, 4.5);
  });
}

/**
 * Front de rue de la Ville (lot 37) : de chaque côté de la piste, des immeubles à des distances (2 à 12 m du rebord) et des hauteurs (8 à 38 m au-dessus de
 * la route) différentes, la plupart dans le champ de vision d'une voiture qui roule. Une suite de nombres à part (le reste du décor ne bouge pas) ;
 * jamais sur la route ni à moins de 1,5 m, jamais l'un dans l'autre. Tirés pour toute la piste ; `near` ne choisit que ceux qu'on construit (miniatures).
 */
export function addCityFront(g: Builder, pal: Palette, track: Track, floorY: number, world: World, near?: (b: Block) => boolean, log?: PoseLog) {
  const rnd = seeded(`${track.id}:${pal.scenery}:rue`);
  const taken: Box[] = [];
  for (const b of track.blocks) {
    if (b.kind === "gap" || b.cuve) continue;
    const curve = isCurve(b.kind);
    const slots = curve ? 2 * curveSize(b.kind) : 2;
    for (const side of [-1, 1] as const) {
      for (let k = 0; k < slots; k++) {
        const t = (k + 0.2 + rnd() * 0.6) / slots;
        const gap = 2 + rnd() * 10;
        const depth = 7 + rnd() * 5;
        const along = 8 + rnd() * 8;
        const above = 8 + rnd() * 30;
        const tint = rnd();
        const hw = curve ? b.w0 / 2 : blockHalfWidth(b, t * CELL);
        const c = onBlock(b, side * (hw + gap + depth / 2), t, 0);
        // Boîte alignée sur les axes : la profondeur suit la perpendiculaire à la piste (carrée dans un virage).
        const alongX = !curve && (b.dir === 1 || b.dir === 3);
        const w = curve ? (along + depth) / 2 : alongX ? along : depth;
        const d = curve ? (along + depth) / 2 : alongX ? depth : along;
        const box: Box = { x0: c[0] - w / 2, x1: c[0] + w / 2, z0: c[2] - d / 2, z1: c[2] + d / 2, y0: floorY, y1: 0 };
        if (!planLibre(world, box, 1.5) || taken.some((o) => box.x0 < o.x1 + 0.5 && box.x1 > o.x0 - 0.5 && box.z0 < o.z1 + 0.5 && box.z1 > o.z0 - 0.5)) continue;
        taken.push(box);
        const roadY = curve ? b.y0 + b.rise / 2 : blockHeight(b, t * CELL);
        const h = roadY - floorY + above;
        g.mute = !!near && !near(b);
        placed(log, { kind: "decor", part: "pied", appui: "sol", group: log?.group() ?? 0, block: -1, style: "city-front" }, [g], () => addBuilding(g, c[0], floorY, c[2], w, d, h, cityWall(tint), roadY - floorY - 2));
        g.mute = false;
      }
    }
  }
}

/** Un rebord plein et fermé : le chapeau où l'on pose un poteau (ni bas-côté ni cuve ni vide ; un tremplin ou un vide de saut n'en ont pas). */
export const hasCap = (b: Block) => !b.open && !b.shoulder && !b.cuve && b.kind !== "gap" && b.kind !== "jump";

/**
 * Chapeau du rebord (lot 37) : le point à `off` m au-delà du bord de la route (la demi-largeur du bloc, côté `side`) à la fraction `t` du bloc, à la hauteur
 * du bord plus celle du chapeau `cap`. C'est là, et nulle part ailleurs, qu'un poteau de bordure a son appui : ni à la hauteur de la ligne centrale, ni au
 * bout du bloc, ni plus loin dans le vide (un virage relevé monte au-delà du bord : on lit la hauteur du bord, pas celle du poteau).
 */
export function onRim(b: Block, t: number, side: 1 | -1, off: number, cap: number): V3 {
  if (isCurve(b.kind)) {
    const { r: R } = curveCenter(b.kind);
    const hw = b.w0 / 2;
    const r = (e: number) => (turnsLeft(b.kind) ? R - side * e : R + side * e);
    const a = t * (Math.PI / 2);
    const edge = arcPoint(b, r(hw), a, b.y0);
    const at = arcPoint(b, r(hw + off), a, b.y0);
    return [at[0], edge[1] + cap, at[2]];
  }
  const q = t * CELL;
  return world(b, CELL / 2 + side * (blockHalfWidth(b, q) + off), q, roadHeight(b, q) + cap);
}

export function checkerTexture(a: string, b: string, repeat: number): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 2;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 2, 2);
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillRect(1, 1, 1, 1);
  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

// --- Décor (lot 9b) : tout est construit une fois, fusionné en un ou deux maillages ; rien ne touche à `sim` -------------

/** Une boîte alignée sur les axes, donnée par ses deux coins dans le repère (p, q) du bloc. */
function blockBox(g: Builder, b: Block, p0: number, p1: number, q0: number, q1: number, y0: number, y1: number, color: number) {
  const a = world(b, p0, q0, y0);
  const c = world(b, p1, q1, y1);
  g.box(Math.min(a[0], c[0]), y0, Math.min(a[2], c[2]), Math.max(a[0], c[0]), y1, Math.max(a[2], c[2]), color);
}

const CROWD = [0xff4b4b, 0xffd22e, 0x4bd0ff, 0xf4f4f4, 0x6bff8a, 0xff8a3d, 0xc084fc] as const;

/**
 * Tribune au départ : trois gradins en escalier, de la foule en petites boîtes de couleur, un toit léger. Lot 37 : elle repose sur un socle plein jusqu'au
 * sol lointain (elle flottait à la hauteur de la route), et ne se pose que là où rien de la piste n'est à moins de `MARGE_DECOR` : du côté opposé à un
 * éventuel virage, sinon de l'autre, sinon pas du tout.
 */
export function addGrandstand(g: Builder, pal: Palette, b: Block, rnd: () => number, floorY: number, world: World, id: string, log?: PoseLog) {
  const meta = { kind: "tribune", part: "pied", appui: "sol", group: log?.group() ?? 0, block: -1, style: "" } as const;
  const first = turnsLeft(b.kind) ? 1 : -1;
  const accepter = (box: Box) => planLibre(world, box, MARGE_DECOR);
  if (placed(log, meta, [g], () => buildGrandstand(g, pal, b, rnd, first, floorY), accepter)) return;
  // L'autre côté : une suite de nombres à part, pour que le reste du décor, tiré de `rnd`, ne bouge pas.
  placed(log, { ...meta, group: log?.group() ?? 0 }, [g], () => buildGrandstand(g, pal, b, seeded(`${id}:tribune`), -first as 1 | -1, floorY), accepter);
}

function buildGrandstand(g: Builder, pal: Palette, b: Block, rnd: () => number, side: 1 | -1, floorY: number) {
  const hw = blockHalfWidth(b, CELL / 2);
  const base = side > 0 ? CELL / 2 + hw + 3.5 : CELL / 2 - hw - 3.5;
  const dir = side > 0 ? 1 : -1;
  const y0 = b.y0;
  const q0 = 5;
  const q1 = 27;
  for (let tier = 0; tier < 3; tier++) {
    const p0 = base + dir * tier * 2.2;
    const p1 = p0 + dir * 2.2;
    blockBox(g, b, Math.min(p0, p1), Math.max(p0, p1), q0, q1, floorY, y0 + 0.9 + tier * 1.0, shade(pal.skirt, 1.1 + tier * 0.08));
    const top = y0 + 0.9 + tier * 1.0;
    const mid = (p0 + p1) / 2;
    for (let q = q0 + 0.6; q < q1 - 0.4; q += 0.9) {
      for (const o of [-0.5, 0.5]) {
        if (rnd() < 0.12) continue; // places vides
        const c = CROWD[Math.floor(rnd() * CROWD.length)]!;
        const pp = mid + o * 0.6;
        blockBox(g, b, pp - 0.22, pp + 0.22, q, q + 0.4, top, top + 0.55 + rnd() * 0.15, c);
      }
    }
  }
  // Toit : une dalle sur quatre poteaux, qui descendent eux aussi jusqu'au sol.
  const pBack = base + dir * 6.6;
  const roof = y0 + 6.2;
  for (const q of [q0 + 0.4, q1 - 0.8]) blockBox(g, b, Math.min(pBack, pBack - dir * 0.4), Math.max(pBack, pBack - dir * 0.4), q, q + 0.4, floorY, roof, 0x3a3f4d);
  blockBox(g, b, Math.min(base, pBack + dir * 0.6), Math.max(base, pBack + dir * 0.6), q0, q1, roof, roof + 0.4, pal.wallA);
}

/** Vrai si le plan de `box`, élargi de `marge` m, ne touche ni route, ni bas-côté, ni paroi de cuve : rien de ce que la voiture roule (lot 37). */
export function planLibre(world: World, box: Box, marge: number): boolean {
  const x0 = box.x0 - marge;
  const x1 = box.x1 + marge;
  const z0 = box.z0 - marge;
  const z1 = box.z1 + marge;
  const hit = (x: number, z: number) => {
    world.sample(x, z, probe);
    return probe.height !== NO_GROUND;
  };
  if (hit((x0 + x1) / 2, (z0 + z1) / 2)) return false;
  const nx = Math.max(1, Math.ceil(x1 - x0));
  const nz = Math.max(1, Math.ceil(z1 - z0));
  for (let i = 0; i <= nx; i++) {
    const x = x0 + ((x1 - x0) * i) / nx;
    if (hit(x, z0) || hit(x, z1)) return false;
  }
  for (let j = 1; j < nz; j++) {
    const z = z0 + ((z1 - z0) * j) / nz;
    if (hit(x0, z) || hit(x1, z)) return false;
  }
  return true;
}
const probe = createSurface();

type Style = Palette["scenery"];

/** Teinte d'un immeuble de la Ville (lot 37) : le béton gris domine, le beige et le bleu-gris le varient. `r` ∈ [0, 1[. */
function cityWall(r: number): number {
  if (r < 0.2) return mix(0xcdbfa8, 0xe0d3bd, r / 0.2);
  if (r < 0.4) return mix(0x9fb0c2, 0xc2cfdc, (r - 0.2) / 0.2);
  return mix(0xa9adb5, 0xcfd2d8, (r - 0.4) / 0.6);
}

/**
 * Un immeuble : une boîte de béton, un acrotère, et des bandes de fenêtres sombres sur les quatre faces. Les fenêtres sont des surfaces à plat (2 triangles
 * chacune) et non des boîtes (12) : pour la même ville, six fois moins de triangles (lot 37).
 */
function addBuilding(g: Builder, x: number, y: number, z: number, w: number, d: number, h: number, wall: number, windowsFrom = 3) {
  g.box(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, wall);
  g.box(x - w / 2 - 0.15, y + h, z - d / 2 - 0.15, x + w / 2 + 0.15, y + h + 0.4, z + d / 2 + 0.15, shade(wall, 0.78)); // acrotère
  const glass = shade(0x35506b, 0.95 + ((Math.round(x * 3 + z) % 3) - 1) * 0.08);
  const e = 0.04;
  // Les bandes montent depuis 3 m au-dessus du pied (le rez-de-chaussée est plein), alignées sur le sol lointain ; sous le niveau de la route on ne les voit pas : `windowsFrom`.
  for (let f = 3 + Math.floor(Math.max(0, windowsFrom - 3) / 3.2) * 3.2; f < h - 1.5; f += 3.2) {
    const y0 = y + f;
    const y1 = y + f + 1.4;
    g.quad([x - w / 2 + 0.6, y0, z + d / 2 + e], [x + w / 2 - 0.6, y0, z + d / 2 + e], [x + w / 2 - 0.6, y1, z + d / 2 + e], [x - w / 2 + 0.6, y1, z + d / 2 + e], glass);
    g.quad([x + w / 2 - 0.6, y0, z - d / 2 - e], [x - w / 2 + 0.6, y0, z - d / 2 - e], [x - w / 2 + 0.6, y1, z - d / 2 - e], [x + w / 2 - 0.6, y1, z - d / 2 - e], glass);
    g.quad([x + w / 2 + e, y0, z - d / 2 + 0.6], [x + w / 2 + e, y0, z + d / 2 - 0.6], [x + w / 2 + e, y1, z + d / 2 - 0.6], [x + w / 2 + e, y1, z - d / 2 + 0.6], glass);
    g.quad([x - w / 2 - e, y0, z + d / 2 - 0.6], [x - w / 2 - e, y0, z - d / 2 + 0.6], [x - w / 2 - e, y1, z - d / 2 + 0.6], [x - w / 2 - e, y1, z + d / 2 - 0.6], glass);
  }
}

/** Un élément de décor posé au sol en (x, y, z). `glow` : parties lumineuses (matériau sans éclairage). */
function addProp(g: Builder, glow: Builder, style: Style, pal: Palette, x: number, y: number, z: number, rnd: () => number, roadY = y) {
  const k = rnd();
  const jitter = 0.9 + rnd() * 0.2;
  if (style === "desert") {
    if (k < 0.45) {
      const h = (3 + rnd() * 3) * jitter;
      const green = mix(0x3d7a3a, 0x5aa04a, rnd());
      g.prism(x, y, z, 0.42, 0.34, h, 6, green, shade(green, 1.15));
      for (const s of [-1, 1]) {
        if (rnd() < 0.3) continue;
        const ah = 0.9 + rnd() * 1.2;
        const ay = y + h * (0.35 + rnd() * 0.25);
        g.box(x + s * 0.35, ay, z - 0.17, x + s * 1.05, ay + 0.34, z + 0.17, green);
        g.box(x + s * 0.85, ay, z - 0.17, x + s * 1.2, ay + ah, z + 0.17, green);
      }
    } else if (k < 0.85) {
      const r = (0.9 + rnd() * 1.6) * jitter;
      const rock = mix(0xa86a44, 0xd09a6a, rnd());
      g.prism(x, y, z, r, r * 0.55, r * 0.9, 5, rock, shade(rock, 1.2), rnd() * 3);
    } else {
      const r = 0.8 + rnd() * 0.5;
      g.prism(x, y, z, r, 0.1, 0.7, 6, mix(0x9a8a45, 0xb8a050, rnd()));
    }
  } else if (style === "pine") {
    const h = (5 + rnd() * 4.5) * jitter;
    const green = mix(0x1f5a3c, 0x2f7a50, rnd());
    g.box(x - 0.22, y, z - 0.22, x + 0.22, y + h * 0.22, z + 0.22, 0x5b3d26);
    for (let t = 0; t < 3; t++) {
      const f = t / 3;
      const r = (2.1 - f * 1.0) * jitter;
      g.prism(x, y + h * (0.16 + f * 0.27), z, r, 0.05, h * 0.42, 7, green, 0xf6fbff); // neige sur le sommet
    }
    if (k > 0.8) {
      const r = 0.7 + rnd() * 0.8;
      g.prism(x + 3, y, z + 1, r, r * 0.5, r * 0.8, 5, 0x8a96a8, 0xffffff);
    }
  } else if (style === "lamps") {
    if (k < 0.5) {
      const h = (4.5 + rnd() * 1.5) * jitter;
      g.box(x - 0.1, y, z - 0.1, x + 0.1, y + h, z + 0.1, 0x20243a);
      g.box(x - 0.1, y + h - 0.1, z - 0.1, x + 0.9, y + h + 0.05, z + 0.1, 0x20243a);
      glow.box(x + 0.5, y + h - 0.2, z - 0.25, x + 0.95, y + h - 0.08, z + 0.25, 0xffe9a8);
      glow.prism(x + 0.72, y, z, 0.01, 0.01, 0.01, 3, 0xffe9a8);
      glow.halo(x + 0.72, y + h - 0.15, z, 0xffd98a, 5.5);
    } else {
      const h = (4 + rnd() * 3.5) * jitter;
      const green = mix(0x16303a, 0x20424a, rnd());
      g.box(x - 0.2, y, z - 0.2, x + 0.2, y + h * 0.25, z + 0.2, 0x2a2018);
      for (let t = 0; t < 3; t++) g.prism(x, y + h * (0.18 + t * 0.26), z, (1.8 - t * 0.5) * jitter, 0.05, h * 0.4, 6, green, shade(green, 1.4));
    }
  } else if (style === "trees") {
    if (k < 0.7) {
      const h = (3.6 + rnd() * 2.4) * jitter;
      const leaf = mix(0x2f8f3a, 0x5cbb4a, rnd());
      g.box(x - 0.25, y, z - 0.25, x + 0.25, y + h * 0.5, z + 0.25, 0x6a4528);
      g.prism(x, y + h * 0.35, z, 2.0 * jitter, 1.2, h * 0.45, 7, leaf, shade(leaf, 1.2), rnd());
      g.prism(x, y + h * 0.7, z, 1.4 * jitter, 0.05, h * 0.38, 7, shade(leaf, 1.08), shade(leaf, 1.3), rnd());
    } else if (k < 0.88) {
      const r = (0.9 + rnd() * 0.7) * jitter;
      g.prism(x, y, z, r, r * 0.8, r * 0.9, 8, 0xd8b45a, 0xe9cc7c); // botte de foin
    } else {
      const r = 0.7 + rnd() * 0.6;
      g.prism(x, y, z, r, r * 0.4, r * 0.8, 6, mix(0x3f9a3a, 0x6fc45a, rnd()));
    }
  } else if (style === "flags") {
    // Stade (lot 21) : mâts à drapeaux de couleur, haies taillées, panneaux publicitaires.
    if (k < 0.4) {
      const h = (6 + rnd() * 3) * jitter;
      const flag = [0xe8283a, 0x2e7dff, 0xffd22e, 0x21b35a, 0xffffff][Math.floor(rnd() * 5)]!;
      g.box(x - 0.08, y, z - 0.08, x + 0.08, y + h, z + 0.08, 0xe9edf2);
      g.box(x + 0.08, y + h - 1.4, z - 0.04, x + 2.2, y + h - 0.1, z + 0.04, flag);
    } else if (k < 0.8) {
      const len = (3 + rnd() * 4) * jitter;
      const green = mix(0x2f8a3a, 0x3fa646, rnd());
      g.box(x - len / 2, y, z - 0.6, x + len / 2, y + 1.3, z + 0.6, green);
    } else {
      const w = 4 + rnd() * 2;
      const c = [0xe8283a, 0x2e7dff, 0xffd22e][Math.floor(rnd() * 3)]!;
      g.box(x - w / 2, y, z - 0.15, x + w / 2, y + 1.6, z + 0.15, c);
      g.box(x - w / 2 + 0.3, y + 0.4, z - 0.17, x + w / 2 - 0.3, y + 1.2, z + 0.17, 0xffffff);
    }
  } else if (style === "canyon") {
    // Canyon (lot 22) : mesas et aiguilles de roche rouge à strates, cactus, buissons secs.
    if (k < 0.4) {
      const r = (2.2 + rnd() * 2.6) * jitter;
      const h = (7 + rnd() * 11) * jitter;
      const rock = mix(0xa8452a, 0xc9683c, rnd());
      g.prism(x, y, z, r, r * 0.8, h * 0.55, 7, rock, shade(rock, 0.86), rnd() * 3);
      g.prism(x, y + h * 0.55, z, r * 0.8, r * 0.62, h * 0.45, 7, shade(rock, 1.12), mix(0xe3a86d, rock, 0.3), rnd() * 3);
    } else if (k < 0.62) {
      const h = (2.6 + rnd() * 2.4) * jitter;
      const green = mix(0x4a7a3a, 0x6a9a4a, rnd());
      g.prism(x, y, z, 0.36, 0.3, h, 6, green, shade(green, 1.15));
      if (rnd() < 0.7) g.box(x + 0.3, y + h * 0.45, z - 0.15, x + 0.95, y + h * 0.45 + 0.3, z + 0.15, green);
    } else if (k < 0.88) {
      const r = (0.8 + rnd() * 1.4) * jitter;
      const rock = mix(0xb86a46, 0xdc9a68, rnd());
      g.prism(x, y, z, r, r * 0.5, r * 0.85, 5, rock, shade(rock, 1.18), rnd() * 3);
    } else {
      const r = 0.7 + rnd() * 0.5;
      g.prism(x, y, z, r, 0.1, 0.6, 6, mix(0x8a7a40, 0xa89050, rnd())); // buisson sec
    }
  } else if (style === "alpine") {
    // Col alpin (lot 22) : sapins à sommet enneigé, gros blocs gris, chalets de bois au toit blanc.
    if (k < 0.62) {
      const h = (6 + rnd() * 5) * jitter;
      const green = mix(0x1f5a3c, 0x2d7550, rnd());
      g.box(x - 0.2, y, z - 0.2, x + 0.2, y + h * 0.2, z + 0.2, 0x5b3d26);
      for (let t = 0; t < 3; t++) {
        const f = t / 3;
        g.prism(x, y + h * (0.14 + f * 0.28), z, (2.2 - f) * jitter, 0.05, h * 0.44, 7, green, 0xf6fbff);
      }
    } else if (k < 0.88) {
      const r = (1.2 + rnd() * 2) * jitter;
      g.prism(x, y, z, r, r * 0.45, r * 0.95, 6, 0x7d8896, 0xdfe7ef, rnd() * 3);
    } else {
      const w = (3.4 + rnd() * 1.4) * jitter;
      g.box(x - w / 2, y, z - w / 2, x + w / 2, y + 2.6, z + w / 2, 0x8a5a36);
      g.prism(x, y + 2.6, z, w * 0.82, 0.1, 1.6, 4, 0xe8eef4, 0xffffff, Math.PI / 4);
    }
  } else if (style === "city") {
    // Ville (lot 22, repris au lot 37) : des immeubles de béton, dont le sommet dépasse la route de 6 à 34 m (le sol est à 8 m au moins sous elle : sans cela
    // on ne voyait que des toits derrière le rebord). Le mobilier de rue est sur le rebord (`addStreetLamps`), plus au sol où personne ne le voyait.
    if (k < 0.55) {
      const w = (6 + rnd() * 6) * jitter;
      const d = (6 + rnd() * 6) * jitter;
      const h = roadY - y + (6 + rnd() * 28) * jitter;
      addBuilding(g, x, y, z, w, d, h, cityWall(rnd()), roadY - y - 2);
    } else if (k < 0.85) {
      rnd(); // (l'ancien lampadaire au sol : ses tirages sont gardés, le reste du décor ne bouge pas)
    } else {
      rnd();
      rnd();
    }
  } else {
    // pylônes lumineux : un mât sombre, un tube lumineux, des cubes qui flottent
    const h = (5 + rnd() * 6) * jitter;
    const c = k < 0.5 ? 0x00f0ff : k < 0.8 ? 0xff2bd6 : 0xfff200;
    g.box(x - 0.18, y, z - 0.18, x + 0.18, y + h, z + 0.18, 0x1a0b36);
    glow.box(x - 0.08, y + h * 0.15, z - 0.2, x + 0.08, y + h, z + 0.2, c);
    glow.box(x - 0.2, y + h * 0.15, z - 0.08, x + 0.2, y + h, z + 0.08, c);
    glow.halo(x, y + h * 0.6, z, c, 6);
    if (rnd() < 0.4) glow.box(x + 1.4, y + h * 0.5, z, x + 2.2, y + h * 0.5 + 0.8, z + 0.8, c);
  }
}

/**
 * Décor propre à un thème, seulement dans la passe dense (lot 23) : clôtures et haies de la Campagne, falaises du Canyon, murets de pierre
 * du Col alpin, rangées de sapins de la Banquise. Renvoie vrai si un élément a été posé (sinon l'appelant pose un élément ordinaire).
 */
function addTypedProp(g: Builder, style: Style, x: number, y: number, z: number, rnd: () => number): boolean {
  const k = rnd();
  const jitter = 0.9 + rnd() * 0.2;
  const along = rnd() < 0.5; // le long de x ou de z
  if (style === "trees" && k < 0.45) {
    const len = (7 + rnd() * 9) * jitter;
    const half = len / 2;
    if (k < 0.25) {
      // Clôture de bois : poteaux tous les 2 m, deux lisses.
      for (let t = -half; t <= half; t += 2) along ? g.box(x + t - 0.07, y, z - 0.07, x + t + 0.07, y + 1.15, z + 0.07, 0x7a5230) : g.box(x - 0.07, y, z + t - 0.07, x + 0.07, y + 1.15, z + t + 0.07, 0x7a5230);
      for (const yy of [0.5, 0.95]) along ? g.box(x - half, y + yy, z - 0.04, x + half, y + yy + 0.1, z + 0.04, 0x9a6a3e) : g.box(x - 0.04, y + yy, z - half, x + 0.04, y + yy + 0.1, z + half, 0x9a6a3e);
    } else {
      // Haie taillée.
      const green = mix(0x2f7a32, 0x3f9a3e, rnd());
      along ? g.box(x - half, y, z - 0.55, x + half, y + 1.4, z + 0.55, green) : g.box(x - 0.55, y, z - half, x + 0.55, y + 1.4, z + half, green);
    }
    return true;
  }
  if (style === "canyon" && k < 0.4) {
    // Falaise : un mur de roche à strates, large et haut, qui ferme l'horizon proche.
    const w = (10 + rnd() * 14) * jitter;
    const d = 3 + rnd() * 2.5;
    const h = (9 + rnd() * 10) * jitter;
    const rock = mix(0x9a3f26, 0xc4673a, rnd());
    const bands = 4;
    for (let i = 0; i < bands; i++) {
      const y0 = y + (h * i) / bands;
      const inset = i * 0.35;
      const c = i % 2 === 0 ? rock : shade(rock, 1.15);
      along ? g.box(x - w / 2 + inset, y0, z - d / 2 + inset * 0.5, x + w / 2 - inset, y0 + h / bands, z + d / 2 - inset * 0.5, c) : g.box(x - d / 2 + inset * 0.5, y0, z - w / 2 + inset, x + d / 2 - inset * 0.5, y0 + h / bands, z + w / 2 - inset, c);
    }
    return true;
  }
  if (style === "alpine" && k < 0.3) {
    // Muret de pierre sèche, bas.
    const len = (5 + rnd() * 6) * jitter;
    const stone = mix(0x7d8896, 0x9aa5b2, rnd());
    along ? g.box(x - len / 2, y, z - 0.35, x + len / 2, y + 0.9, z + 0.35, stone) : g.box(x - 0.35, y, z - len / 2, x + 0.35, y + 0.9, z + len / 2, stone);
    return true;
  }
  if (style === "pine" && k < 0.3) {
    // Rangée de trois sapins serrés (forêt).
    for (let t = -1; t <= 1; t++) {
      const px = along ? x + t * 2.6 : x;
      const pz = along ? z : z + t * 2.6;
      const h = (5.5 + rnd() * 3.5) * jitter;
      const green = mix(0x1f5a3c, 0x2f7a50, rnd());
      g.box(px - 0.2, y, pz - 0.2, px + 0.2, y + h * 0.2, pz + 0.2, 0x5b3d26);
      for (let q = 0; q < 3; q++) g.prism(px, y + h * (0.15 + (q / 3) * 0.27), pz, 2 - q * 0.5, 0.05, h * 0.42, 7, green, 0xf6fbff);
    }
    return true;
  }
  return false;
}

/** Hauteur moyenne de la route autour de la cellule (cx, cz), à `span` cellules près ; `floorY` s'il n'y en a pas. */
function roadAround(track: Track, cx: number, cz: number, span: number, floorY: number): number {
  let sum = 0;
  let n = 0;
  for (const b of track.blocks) {
    if (Math.abs(b.cx - cx) <= span && Math.abs(b.cz - cz) <= span) {
      sum += b.y0 + b.rise / 2;
      n++;
    }
  }
  return n > 0 ? sum / n : floorY;
}

/** Décor au bord de la piste : dans les cellules vides à moins de 2 cellules d'un bloc, selon le style de la palette. */
export function addScenery(g: Builder, glow: Builder, pal: Palette, track: Track, floorY: number, world: World, rnd: () => number, keep?: (cx: number, cz: number) => boolean, dense = false, log?: PoseLog, aerial = false) {
  const wanted = new Set<number>();
  const span = 2;
  for (const b of track.blocks) {
    for (let dx = -span; dx <= span; dx++) {
      for (let dz = -span; dz <= span; dz++) {
        const key = cellKey(b.cx + dx, b.cz + dz);
        if (!track.cells.has(key)) wanted.add(key);
      }
    }
  }
  // La cellule est retrouvée par sa clé : on parcourt les blocs voisins pour garder (cx, cz).
  const cells: [number, number][] = [];
  const seen = new Set<number>();
  for (const b of track.blocks) {
    for (let dx = -span; dx <= span; dx++) {
      for (let dz = -span; dz <= span; dz++) {
        const key = cellKey(b.cx + dx, b.cz + dz);
        if (wanted.has(key) && !seen.has(key)) {
          seen.add(key);
          cells.push([b.cx + dx, b.cz + dz]);
        }
      }
    }
  }
  let count = 0;
  // Lot 37 : un élément posé au sol ne touche jamais la route ni un bas-côté (`MARGE_DECOR` m de marge) ; refusé, il disparaît mais a consommé ses tirages au sort.
  const accepter = (box: Box) => planLibre(world, box, MARGE_DECOR);
  for (const [cx, cz] of cells) {
    g.mute = glow.mute = keep ? !keep(cx, cz) : false; // hors du cadre : mêmes tirages au sort, aucune forme
    const n = dense ? 1 + Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 3);
    const roadY = aerial ? floorY : roadAround(track, cx, cz, span, floorY); // vue aérienne : la ville reste basse, elle ne cache pas la piste
    for (let i = 0; i < n && count < (dense ? 520 : 650); i++, count++) {
      const x = cx * CELL + 3 + rnd() * (CELL - 6);
      const z = cz * CELL + 3 + rnd() * (CELL - 6);
      const meta = { kind: "decor", part: "pied", appui: "sol", group: log?.group() ?? 0, block: -1, style: pal.scenery } as const;
      let typed = false;
      if (dense) placed(log, meta, [g, glow], () => (typed = addTypedProp(g, pal.scenery, x, floorY, z, rnd)), accepter);
      if (typed) continue;
      placed(log, meta, [g, glow], () => addProp(g, glow, pal.scenery, pal, x, floorY, z, rnd, roadY), accepter);
    }
  }
  g.mute = glow.mute = false;
}

export interface TrackScene {
  scene: Scene;
  followGround(x: number, z: number): void;
  /** Libère géométries, matériaux et textures (scènes jetables, comme celles des miniatures). */
  dispose(): void;
  /** Décor allégé (qualité basse) : montagnes, soleil, étoiles et décor de bord de piste masqués ; ciel et route restent. */
  setLite(on: boolean): void;
  /** Niveau de qualité 0–2 (lot 23) : 0 sans décor ni ombres ni halos ; 1 ombres de 512, halos, phares, décor de base ; 2 tout (ombres de 1024, décor dense, silhouettes proches). */
  setQuality(level: 0 | 1 | 2, shadows?: boolean): void;
  /** Ambiance du thème (exposition, brume, halos, phares). */
  look: Look;
  /** Hauteur de la fenêtre (pixels) et champ de vision (degrés) : taille des halos à l'écran. */
  setView(heightPx: number, fovDeg: number): void;
  /**
   * Position de la voiture (m) et cap (rad) : fenêtre des ombres, phares. `hood` : vue capot, l'œil est au ras du faisceau (la route juste
   * devant le museau remplirait l'écran d'une tache blanche : les phares sont atténués).
   */
  followCar(x: number, y: number, z: number, yaw: number, hood?: boolean): void;
  /** État du rendu (outil de test `?debug`) : ce que la qualité active, ce que le thème allume. */
  stats(): SceneStats;
  /** Lot 43 : les feux de départ du portique (palier 1), allumés selon le décompte ; absents de l'existant. Lecture seule de l'état de la course. */
  feux?(etat: EtatFeux): void;
}

export interface SceneStats {
  quality: number;
  /** Taille de la carte d'ombres (0 : coupée). */
  shadowMap: number;
  headlights: number;
  halos: { count: number; visible: boolean };
  denseDecor: boolean;
  hills: boolean;
  signs: number;
  fog: { near: number; far: number } | null;
  /** Lot 43 : ce que montrent les feux de départ (palier 1) ; absent de l'existant. */
  feux?: EtatFeux;
}

/** Libère tout ce que la scène tient côté carte graphique (géométries, matériaux, textures, fond). */
export function disposeScene(scene: Scene) {
  const texture = (t: unknown) => (t as { dispose?: () => void } | null)?.dispose?.();
  scene.traverse((o) => {
    const m = o as Mesh;
    m.geometry?.dispose();
    for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) {
      texture((mat as MeshStandardMaterial).map);
      mat.dispose();
    }
  });
  texture(scene.background);
}

export interface TrackSceneOptions {
  /**
   * Vue aérienne (miniatures, lot 13) : ni ciel, ni montagnes, ni brouillard ; la route, le décor de bord de piste et le sol
   * suffisent. Le reste de la scène (et son tirage au sort) est le même que dans le jeu.
   */
  aerial?: boolean;
  /**
   * Avec `aerial` : seule la portion [from, to] des blocs est vue. Le décor n'est construit qu'autour d'elle (il est tiré au sort
   * en entier, donc il est le même que dans le jeu) : une miniature coûte une fraction d'une scène complète.
   */
  near?: { from: number; to: number };
  /** Relevé de la pose du décor (lot 37) : ce qui est planté, où, sur quoi (voir `decorPose.ts`). Les tests le lisent ; le jeu n'en donne pas. */
  log?: PoseLog;
  /** Sans DOM (tests) : ni texture ni bandeau de texte ; les formes et leur pose sont les mêmes. */
  headless?: boolean;
  /** Lot 43 : les textes des bandeaux des portiques (« DÉPART », « ARRIVÉE »), du catalogue de la langue du joueur. Absents : pas de bandeau. */
  textes?: TextesScene;
}

/** Le décor de l'existant, séparé de sa route (lot 43) : ce que le palier 1 garde tel quel (« le décor de fond reste celui d'aujourd'hui »). */
export interface DecorGeometry {
  decorG: Builder;
  glowG: Builder;
  denseG: Builder;
  denseGlow: Builder;
}

/**
 * Le décor d'aujourd'hui (lot 37) sans la route : tribune du départ, décor du thème, front de rue et lampadaires de la Ville, passe dense. **Mêmes tirages au
 * sort que l'existant** (`${id}:${palette}`, puis `…:dense`, `…:rue`, `…:tribune`) : le palier 1 pose exactement le même décor. Les lampadaires de la Ville
 * sont sur le chapeau des rebords (le palier 1 garde le muret de 0,8 m et son garde-corps : `scene/route.ts`).
 */
export function decorGeometry(track: Track, paletteName: PaletteName, options: TrackSceneOptions = {}): DecorGeometry {
  const pal = PALETTE_DEFS[paletteName];
  const floorY = track.voidY - FALL_DEPTH;
  const decorG = new Builder();
  const glowG = new Builder();
  const roulant = trackWorld(track);
  if (!options.aerial) for (const b of track.blocks) addStreetLamps(decorG, glowG, pal, b, options.log);
  const rnd = seeded(`${track.id}:${paletteName}`);
  const first0 = track.blocks[0]!;
  const near = options.aerial ? options.near : undefined;
  const windowBlocks = near ? track.blocks.slice(near.from, near.to + 1) : [];
  const nearCell = (cx: number, cz: number) => windowBlocks.some((b) => Math.abs(b.cx - cx) <= NEAR_CELLS && Math.abs(b.cz - cz) <= NEAR_CELLS);
  decorG.mute = !!near && !nearCell(first0.cx, first0.cz);
  addGrandstand(decorG, pal, first0, rnd, floorY, roulant, track.id, options.log);
  decorG.mute = false;
  addScenery(decorG, glowG, pal, track, floorY, roulant, rnd, near ? nearCell : undefined, false, options.log, !!options.aerial);
  if (pal.scenery === "city" && !options.aerial) addCityFront(decorG, pal, track, floorY, roulant, near ? (b) => nearCell(b.cx, b.cz) : undefined, options.log);
  const denseG = new Builder();
  const denseGlow = new Builder();
  if (!options.aerial) addScenery(denseG, denseGlow, pal, track, floorY, roulant, seeded(`${track.id}:${paletteName}:dense`), undefined, true, options.log);
  return { decorG, glowG, denseG, denseGlow };
}

/** Vue aérienne d'une portion (miniatures) : le décor n'est construit qu'à `NEAR_CELLS` cellules de ses blocs. */
export const NEAR_CELLS = 4;
