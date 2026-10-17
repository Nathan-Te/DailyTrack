import {
  DEFAULT_JUMP_PARAMS,
  INPUT_RIGHT,
  MODULES,
  MODULE_ENTRIES,
  buildModule,
  decodeReplay,
  initialAttempt,
  mutationLabel,
  moduleSolutions,
  stepAttempt,
  UNITS_PER_TILE,
  JUMP_THEME_NAMES,
  MECHANIC_THEMES,
  variantExigence,
  variantTheme,
  type JumpReplay,
  type JumpThemeName,
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
  tapis: "tapis roulant",
  glace: "glace",
  clignotant: "clignotant",
  alterne: "alterné",
  vent: "vent",
};

/**
 * Le thème d'une variante (lot 11) : celui de son morceau (`theme:`) ou de sa mutation de surface (`+surface:…`), null pour un morceau de tous
 * les thèmes. C'est le thème dans lequel la galerie l'ouvre (`&theme=`) : un morceau de mécanique se joue dans son décor.
 */
export function moduleTheme(id: string, variant: number): JumpThemeName | null {
  const def = MODULES.find((m) => m.id === id);
  return def ? variantTheme(def, variant) : null;
}

export interface VariantInfo {
  index: number;
  /** Paramètres de la variante (« haut=3 large=2 »), vide s'il n'y en a pas. */
  label: string;
  /** Mutateurs de la variante (lot 7), écrits comme dans le fichier (« +plafond:pics +denivele:2 »), vide sans mutateur. */
  mutations: string;
  /** Lot 11 : le thème auquel la variante est réservée (null : tous). */
  theme: JumpThemeName | null;
  exigence: number;
  /** Durées des solutions (pas), à l'arrêt et en élan ; null : pas de solution stockée pour cette version. */
  ticks: Record<ModuleEntry, number | null>;
}

export interface ModuleInfo {
  id: string;
  intention: string;
  tags: readonly ModuleTag[];
  /** Lot 11 : le thème du morceau (`theme:`), null s'il est de tous les thèmes (certaines de ses variantes peuvent l'être d'un thème : `variants[].theme`). */
  theme: JumpThemeName | null;
  /** Famille (lot 7) et enchaînement long. */
  family: string;
  long: boolean;
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
    return { index, label: Object.entries(values).map(([k, v]) => `${k}=${v}`).join(" "), mutations: mutationLabel(def.mutations[index]!), theme: variantTheme(def, index), exigence: variantExigence(s), ticks };
  });
  const ex = variants.map((v) => v.exigence);
  return { id, intention: def.intention, tags: def.tags, theme: def.theme, family: def.family, long: def.long, variants, min: Math.min(...ex), max: Math.max(...ex) };
}

/** Les morceaux dans l'ordre de la galerie : du plus facile au plus exigeant (exigence de la variante la plus facile, puis la plus dure), puis par id. */
export function galleryOrder(): ModuleInfo[] {
  return MODULES.map((m) => infoOf(m.id)).sort((a, b) => a.min - b.min || a.max - b.max || (a.id < b.id ? -1 : 1));
}

/** Lot 11 : le filtre par thème de la galerie : un thème, ou `sans` (« sans mécanique »), ou tous (null). */
export const THEME_FILTERS = [...JUMP_THEME_NAMES, "sans"] as const;
export type ThemeFilter = (typeof THEME_FILTERS)[number];

/** Filtre de la galerie (lot 7) : une étiquette, une famille et (lot 11) un thème, ou toutes (null). */
export interface GalleryFilter {
  tag: ModuleTag | null;
  family: string | null;
  theme?: ThemeFilter | null;
}

/**
 * Le morceau a-t-il une variante pour ce thème ? Un thème à mécanique (depuis le lot 13, les cinq) : les variantes qui lui sont réservées (la
 * mécanique) ; `sans` : les variantes de tous les thèmes (celles que tout niveau peut tirer).
 */
export function matchesTheme(m: ModuleInfo, theme: ThemeFilter | null): boolean {
  if (theme === null) return true;
  // Lot 12 : usine, glace, nuit et néon ont chacun leur mécanique : ne restent que leurs morceaux (et variantes mutées) ; lot 13 : la forêt aussi
  // (courants d'air) ; « sans » : ceux de tous les thèmes.
  if ((MECHANIC_THEMES as readonly string[]).includes(theme)) return m.variants.some((v) => v.theme === theme);
  return m.variants.some((v) => v.theme === null);
}

/** Le morceau passe-t-il le filtre ? */
export function matchesFilter(m: ModuleInfo, f: GalleryFilter): boolean {
  return (f.tag === null || m.tags.includes(f.tag)) && (f.family === null || m.family === f.family) && matchesTheme(m, f.theme ?? null);
}

/** Les familles du catalogue, dans l'ordre alphabétique, avec leur nombre de morceaux. */
export function galleryFamilies(order: readonly ModuleInfo[]): { family: string; count: number }[] {
  const n = new Map<string, number>();
  for (const m of order) n.set(m.family, (n.get(m.family) ?? 0) + 1);
  return [...n].map(([family, count]) => ({ family, count })).sort((a, b) => (a.family < b.family ? -1 : 1));
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

/** Temps de référence à l'arrivée (pas) : la solution stockée, plus le couloir quand on joue en élan (`corridor`) ; null sans solution. */
export function referenceTicks(id: string, variant: number, entry: ModuleEntry, corridor = entry === "elan"): number | null {
  const s = moduleSolutions(id, variant)?.[entry];
  if (!s) return null;
  return corridor ? s.ticks + launchTicks(id, variant) : s.ticks;
}
