import {
  DEFAULT_JUMP_PARAMS,
  INPUT_RIGHT,
  MODULES,
  MODULE_ENTRIES,
  buildModule,
  decodeReplay,
  initialAttempt,
  moduleSolutions,
  stepAttempt,
  UNITS_PER_TILE,
  variantExigence,
  type JumpReplay,
  type ModuleEntry,
  type ModuleTag,
} from "@cdj/jump-sim";

// Le catalogue des morceaux vu par le jeu (lot 4), **logique pure** (testée sans DOM) : l'ordre de la galerie, le morceau suivant, la
// solution à regarder et le temps de référence affiché à l'arrivée.

/** Colonnes du couloir de lancement ajoutées devant le palier d'entrée quand on joue un morceau en élan. */
export const LAUNCH_TILES = 5;

export const TAG_LABELS: Record<ModuleTag, string> = {
  mural: "mural",
  precision: "précision",
  vertical: "vertical",
  scie: "scie",
  friable: "friable",
  ressort: "ressort",
  respiration: "respiration",
};

export interface VariantInfo {
  index: number;
  /** Paramètres de la variante (« haut=3 large=2 »), vide s'il n'y en a pas. */
  label: string;
  exigence: number;
  /** Durées des solutions (pas), à l'arrêt et en élan ; null : pas de solution stockée pour cette version. */
  ticks: Record<ModuleEntry, number | null>;
}

export interface ModuleInfo {
  id: string;
  intention: string;
  tags: readonly ModuleTag[];
  variants: VariantInfo[];
  /** Exigence la plus basse et la plus haute de ses variantes. */
  min: number;
  max: number;
}

function infoOf(id: string): ModuleInfo {
  const def = MODULES.find((m) => m.id === id)!;
  const variants = def.variants.map((values, index) => {
    const s = moduleSolutions(id, index);
    const ticks = Object.fromEntries(MODULE_ENTRIES.map((e) => [e, s?.[e]?.ticks ?? null])) as Record<ModuleEntry, number | null>;
    return { index, label: Object.entries(values).map(([k, v]) => `${k}=${v}`).join(" "), exigence: variantExigence(s), ticks };
  });
  const ex = variants.map((v) => v.exigence);
  return { id, intention: def.intention, tags: def.tags, variants, min: Math.min(...ex), max: Math.max(...ex) };
}

/** Les morceaux dans l'ordre de la galerie : du plus facile au plus exigeant (exigence de la variante la plus facile, puis la plus dure), puis par id. */
export function galleryOrder(): ModuleInfo[] {
  return MODULES.map((m) => infoOf(m.id)).sort((a, b) => a.min - b.min || a.max - b.max || (a.id < b.id ? -1 : 1));
}

/** Le morceau qui suit `id` dans la galerie (le premier après le dernier). */
export function nextModule(id: string): string {
  const order = galleryOrder();
  const k = order.findIndex((m) => m.id === id);
  return order[(k + 1) % order.length]!.id;
}

/** La solution stockée d'un morceau (variante, entrée), en rediffusion ; null s'il n'y en a pas pour cette version. */
export function solutionReplay(id: string, variant: number, entry: ModuleEntry): JumpReplay | null {
  const code = moduleSolutions(id, variant)?.[entry]?.code;
  if (!code) return null;
  try {
    return decodeReplay(code);
  } catch {
    return null;
  }
}

/**
 * Pas pour courir le couloir de lancement (départ à l'arrêt, droite tenue) jusqu'à l'endroit où part la solution en élan : ce que le temps
 * de référence ajoute quand on joue un morceau en élan (la solution, elle, part déjà lancée).
 */
export function launchTicks(id: string, variant: number): number {
  const run = buildModule(id, variant, { lancement: LAUNCH_TILES });
  const plain = buildModule(id, variant);
  // Dans le niveau à couloir, le départ du morceau sans couloir est `LAUNCH_TILES` colonnes plus loin, à la même place dans sa tuile.
  const target = initialAttempt(plain.level).player.x + LAUNCH_TILES * UNITS_PER_TILE;
  let s = initialAttempt(run.level);
  let t = 0;
  while (t < 600 && s.player.x < target) {
    s = stepAttempt(s, INPUT_RIGHT, run.level, DEFAULT_JUMP_PARAMS);
    t++;
  }
  return t;
}

/** Temps de référence à l'arrivée (pas) : la solution stockée, plus le couloir en élan ; null sans solution. */
export function referenceTicks(id: string, variant: number, entry: ModuleEntry): number | null {
  const s = moduleSolutions(id, variant)?.[entry];
  if (!s) return null;
  return entry === "elan" ? s.ticks + launchTicks(id, variant) : s.ticks;
}
