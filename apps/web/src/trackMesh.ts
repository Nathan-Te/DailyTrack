// Les palettes et les ambiances de chaque thème, les types de la scène et quelques points de la piste (lots 9b, 22, 23, 37). Lot 43 : la route, les accessoires
// et l'assemblage de l'ancienne scène sont partis dans `scene/existant.ts` (chargé à la demande) ; lot 44 : **le décor d'avant** (tribune, décor du thème, front
// de rue et lampadaires de la Ville, passe dense) l'a suivi — le palier 1 a le sien, chargé à la demande par thème (`scene/decor.ts`).
import { CanvasTexture, NearestFilter, RepeatWrapping, SRGBColorSpace, type Mesh, type MeshStandardMaterial, type Scene } from "three";
import {
  CELL,
  WALL_HEIGHT,
  rippleAt,
  bankAt,
  blockHeight,
  blockHalfWidth,
  curveCenter,
  isCurve,
  turnsLeft,
  type BankSample,
  type Block,
  type PaletteName,
  type SurfaceKind,
} from "@cdj/sim";
import { PALETTE_LABELS } from "./labels";
import { world, type V3 } from "./meshKit";
import type { EtatFeux } from "./feux";
import type { PoseLog } from "./decorPose";
import type { ModuleDecor, TextesScene } from "./scene/types";

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
  /**
   * Lot 44 : ajoute le décor du thème (son module chargé à la demande) à une scène construite sans lui ; une seule fois. **Jamais pendant une course** : c'est
   * l'appelant (`main.ts`) qui choisit le moment (accueil, pause, arrivée, podium). Absent de l'existant (son décor est le sien).
   */
  poserDecor?(module: ModuleDecor): void;
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
  /** Lot 44 : le décor du thème est dans la scène (palier 1). */
  decor?: boolean;
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
  /** Lot 44 : le décor du thème, s'il est déjà chargé (`decorPret`) : la scène se construit avec lui ; sinon sans lui (`poserDecor` l'ajoutera). */
  decor?: ModuleDecor | null;
}

/** Vue aérienne d'une portion (miniatures) : le décor n'est construit qu'à `NEAR_CELLS` cellules de ses blocs. */
export const NEAR_CELLS = 4;
