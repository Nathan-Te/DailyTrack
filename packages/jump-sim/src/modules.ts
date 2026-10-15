import { circleHitsBox } from "./attempt";
import { MODULE_SOLUTIONS, MODULE_TEXTS } from "./catalog";
import { JUMP_SIM_VERSION, UNITS_PER_TILE } from "./constants";
import { LevelError, MAX_SAW_CYCLE, TILE_EMPTY, TILE_SOLID, parseLevel, sawCenter, type Level } from "./level";

// Les morceaux (lot 4) : des portions de niveau écrites en texte qui **portent leur solution**, matière première du niveau du jour (lot 5).
// La source est un fichier texte par morceau (`packages/jump-sim/modules/<id>.txt`) ; le solveur hors ligne (`npm run solve:modules -w
// @cdj/jump-sim`) recopie ces textes et les solutions trouvées dans `catalog.ts` (généré : la simulation reste pure, sans lecture de fichier).
//
// Format d'un fichier (une ligne `clé: valeur` par métadonnée, `//` commente une ligne) :
//   id: cheminee                                  minuscules, chiffres, tirets ; le nom du fichier
//   intention: Monter une cheminée …              une phrase en français
//   etiquettes: mural vertical                    parmi MODULE_TAGS
//   paliers: 17 9                                 rangées (du gabarit) du **sol** du palier d'entrée, puis de sortie
//   repeter: haut rangees 6-7                     un paramètre nommé et une plage de rangées (ou de `colonnes`) du gabarit
//   variante: haut=2 cycle=180                    une variante = une valeur pour chaque paramètre (2 à 4 variantes)
//   grille:                                       puis la grille (caractères de `level.ts`, sans `S`, `F` ni `C`), une ligne vide,
//   scie <id> <rayon> <cycle> <mode> <c,r>…       puis le bloc annexe : seulement des scies (la section est implicite)
//
// **Variantes déclaratives.** Une plage `repeter` est dessinée **une fois** dans le gabarit ; dans une variante, elle apparaît autant de
// fois que la valeur du paramètre (0 la retire) : `repeter: trou colonnes 12-12` avec `trou=3` donne un trou de trois colonnes. Deux plages
// d'un même axe ne se chevauchent pas. Dans le bloc annexe, `{nom}` est remplacé par la valeur du paramètre (cycle, rayon d'une scie…), et
// les coordonnées `col,rangée` sont celles du gabarit : elles désignent la **première** copie d'une plage répétée, ou la **dernière** avec
// une apostrophe (`14',3`).
//
// **Paliers.** Le morceau commence et finit sur un palier : au moins `PALIER_MIN` tuiles de sol plein (`#`) collées au bord, avec
// `PALIER_HEADROOM` rangées libres au-dessus (ni bloc, ni danger, ni scie qui y passe). Le niveau construit ajoute **une colonne d'appel** à
// gauche (copie de la première colonne, avec le départ `S` au sol) et **une colonne de sortie** à droite (copie de la dernière, avec
// l'arrivée `F` au sol) : sortir, c'est franchir le bord droit du palier de sortie. Le morceau forme **une seule section** (ses scies mobiles
// démarrent quand le centre du personnage y entre). Le point de passage du morceau est implicite, au début du palier d'entrée.
//
// **Entrées et sortie.** Entrée *arrêt* : au départ, immobile. Entrée *élan* : au départ, au sol, à pleine vitesse vers la droite (drapeau
// « élan » de la rediffusion). **Sortie toujours en élan** : la solution finit au sol, à pleine vitesse, en touchant l'arrivée.

export const MODULE_TAGS = ["mural", "precision", "vertical", "scie", "friable", "ressort", "respiration"] as const;
export type ModuleTag = (typeof MODULE_TAGS)[number];
export const MODULE_ENTRIES = ["arret", "elan"] as const;
export type ModuleEntry = (typeof MODULE_ENTRIES)[number];

/** Hauteur maximale d'un morceau construit, en rangées. */
export const MODULE_MAX_HEIGHT = 30;
/** Tuiles de sol plat d'un palier, au moins. */
export const PALIER_MIN = 3;
/** Rangées libres au-dessus du sol d'un palier, au moins. */
export const PALIER_HEADROOM = 4;
/** Durée d'une solution : entre 2 et 6 s. */
export const MODULE_MIN_TICKS = 240;
export const MODULE_MAX_TICKS = 720;
/** Copies d'une plage répétée : de 0 à 40 (un paramètre du bloc annexe, comme un cycle, va jusqu'à `MAX_SAW_CYCLE`). */
export const MAX_PARAM = 40;

export class ModuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModuleError";
  }
}

export interface ModuleRepeat {
  param: string;
  axis: "colonnes" | "rangees";
  from: number;
  to: number;
}

/** Un morceau tel qu'écrit (gabarit + métadonnées). */
export interface ModuleDef {
  id: string;
  intention: string;
  tags: readonly ModuleTag[];
  /** Rangées du gabarit du sol du palier d'entrée et de sortie. */
  entryRow: number;
  exitRow: number;
  repeats: readonly ModuleRepeat[];
  /** Paramètres (dans l'ordre de leur première mention) et valeurs de chaque variante. */
  params: readonly string[];
  variants: readonly Readonly<Record<string, number>>[];
  grid: readonly string[];
  annex: readonly string[];
  /** Texte du fichier. */
  text: string;
}

const KEYS = new Set(["id", "intention", "etiquettes", "paliers", "repeter", "variante"]);
const MODULE_GRID = /^[#.^v<>oOx*]+$/;

/** Lit le texte d'un morceau. Refuse tout ce qui est mal formé (clé inconnue, étiquette inconnue, variante incomplète…). */
export function parseModule(text: string): ModuleDef {
  const lines = text.replace(/\r/g, "").split("\n");
  let i = 0;
  const meta: Record<string, string[]> = {};
  for (; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (raw === "" || raw.startsWith("//")) continue;
    if (raw === "grille:") break;
    const m = /^([a-z]+):\s*(.*)$/.exec(raw);
    if (!m || !KEYS.has(m[1]!)) throw new ModuleError(`Ligne ${i + 1} : « clé: valeur » attendu (${[...KEYS].join(", ")}, puis « grille: »)`);
    (meta[m[1]!] ??= []).push(m[2]!.trim());
  }
  if (i >= lines.length) throw new ModuleError("« grille: » manquant");
  const one = (k: string) => {
    const v = meta[k];
    if (!v || v.length !== 1 || v[0] === "") throw new ModuleError(`« ${k}: » attendu une fois`);
    return v[0]!;
  };
  const id = one("id");
  if (!/^[a-z0-9-]{1,24}$/.test(id)) throw new ModuleError(`id « ${id} » invalide (minuscules, chiffres, tirets, 24 au plus)`);
  const where = (s: string) => `Morceau « ${id} » : ${s}`;
  const intention = one("intention");
  const tags = one("etiquettes").split(/\s+/);
  for (const t of tags) if (!(MODULE_TAGS as readonly string[]).includes(t)) throw new ModuleError(where(`étiquette « ${t} » inconnue (${MODULE_TAGS.join(", ")})`));
  if (new Set(tags).size !== tags.length) throw new ModuleError(where("étiquette en double"));
  const paliers = /^(\d+)\s+(\d+)$/.exec(one("paliers"));
  if (!paliers) throw new ModuleError(where("« paliers: <rangée d'entrée> <rangée de sortie> » attendu"));

  // ——— Grille, puis bloc annexe ———
  i++;
  const grid: string[] = [];
  for (; i < lines.length && lines[i]!.trim() !== ""; i++) grid.push(lines[i]!.trim());
  const annex = lines.slice(i).map((l) => l.trim()).filter((l) => l !== "" && !l.startsWith("//"));
  if (grid.length === 0) throw new ModuleError(where("grille vide"));
  const width = grid[0]!.length;
  grid.forEach((row, r) => {
    if (row.length !== width) throw new ModuleError(where(`rangée ${r} : ${row.length} colonnes au lieu de ${width}`));
    if (!MODULE_GRID.test(row)) throw new ModuleError(where(`rangée ${r} : caractère interdit (ni S, ni F, ni C : le niveau les place lui-même)`));
  });
  const entryRow = Number(paliers[1]);
  const exitRow = Number(paliers[2]);
  if (entryRow >= grid.length || exitRow >= grid.length) throw new ModuleError(where("rangée de palier hors de la grille"));

  // ——— Plages répétées ———
  const params: string[] = [];
  const repeats: ModuleRepeat[] = (meta.repeter ?? []).map((spec) => {
    const m = /^([a-z][a-z0-9]*)\s+(colonnes|rangees)\s+(\d+)-(\d+)$/.exec(spec);
    if (!m) throw new ModuleError(where(`« repeter: <paramètre> colonnes|rangees <de>-<à> » attendu (« ${spec} »)`));
    const rep: ModuleRepeat = { param: m[1]!, axis: m[2] as ModuleRepeat["axis"], from: Number(m[3]), to: Number(m[4]) };
    const size = rep.axis === "colonnes" ? width : grid.length;
    if (rep.from > rep.to || rep.to >= size) throw new ModuleError(where(`plage ${rep.from}-${rep.to} hors du gabarit`));
    if (!params.includes(rep.param)) params.push(rep.param);
    return rep;
  });
  for (const a of repeats) {
    for (const b of repeats) {
      if (a !== b && a.axis === b.axis && a.from <= b.to && b.from <= a.to) throw new ModuleError(where(`les plages ${a.from}-${a.to} et ${b.from}-${b.to} se chevauchent`));
    }
  }
  for (const line of annex) for (const m of line.matchAll(/\{([a-z][a-z0-9]*)\}/g)) if (!params.includes(m[1]!)) params.push(m[1]!);
  for (const r of [entryRow, exitRow]) if (repeats.some((p) => p.axis === "rangees" && r >= p.from && r <= p.to)) throw new ModuleError(where("une rangée de palier ne se répète pas"));

  // ——— Variantes ———
  const variants = (meta.variante ?? []).map((spec, k) => {
    const values: Record<string, number> = {};
    for (const w of spec.split(/\s+/).filter(Boolean)) {
      const m = /^([a-z][a-z0-9]*)=(\d+)$/.exec(w);
      if (!m) throw new ModuleError(where(`variante ${k} : « nom=valeur » attendu (« ${w} »)`));
      if (!params.includes(m[1]!)) throw new ModuleError(where(`variante ${k} : paramètre « ${m[1]} » inconnu`));
      const v = Number(m[2]);
      const max = repeats.some((r) => r.param === m[1]) ? MAX_PARAM : MAX_SAW_CYCLE;
      if (v > max) throw new ModuleError(where(`variante ${k} : ${m[1]} = ${v} (au plus ${max})`));
      values[m[1]!] = v;
    }
    for (const p of params) if (values[p] === undefined) throw new ModuleError(where(`variante ${k} : « ${p} » manque`));
    return values;
  });
  if (variants.length === 0) throw new ModuleError(where("au moins une « variante: » (même sans paramètre)"));
  return { id, intention, tags: tags as ModuleTag[], entryRow, exitRow, repeats, params, variants, grid, annex, text };
}

/** Une plage d'un axe, déroulée : pour chaque index du gabarit, l'index de sa première et de sa dernière copie (−1 si retirée). */
function unroll(size: number, repeats: readonly ModuleRepeat[], values: Readonly<Record<string, number>>): { src: number[]; first: number[]; last: number[] } {
  const src: number[] = [];
  const first: number[] = new Array(size).fill(-1);
  const last: number[] = new Array(size).fill(-1);
  for (let k = 0; k < size; ) {
    const rep = repeats.find((r) => r.from === k);
    const to = rep ? rep.to : k;
    const copies = rep ? values[rep.param]! : 1;
    for (let c = 0; c < copies; c++) {
      for (let j = k; j <= to; j++) {
        if (c === 0) first[j] = src.length;
        last[j] = src.length;
        src.push(j);
      }
    }
    k = to + 1;
  }
  return { src, first, last };
}

/** Un morceau construit : le niveau jouable (appel, morceau, sortie) et ce qu'il faut pour l'enchaîner. */
export interface BuiltModule {
  id: string;
  variant: number;
  values: Readonly<Record<string, number>>;
  /** Identifiant de niveau des rediffusions : `module:<id>:<variante>`. */
  levelId: string;
  level: Level;
  /** Texte complet du niveau (grille et bloc annexe). */
  ascii: string;
  /** Empreinte FNV-1a du texte : une solution stockée l'est pour cette grille. */
  hash: string;
  /** Colonnes avant le morceau (appel, et couloir de lancement s'il y en a un) : la première colonne du morceau. */
  lead: number;
  /** Largeur du morceau seul (sans appel ni sortie), hauteur. */
  width: number;
  height: number;
  /** Rangées du sol des paliers d'entrée et de sortie (dans le niveau construit). */
  entryRow: number;
  exitRow: number;
}

export interface BuildOptions {
  /** Couloir de lancement (jeu humain, entrée en élan) : colonnes ajoutées devant le palier d'entrée, départ au bout. 0 par défaut. */
  lancement?: number;
}

export function textHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/** Construit une variante d'un morceau écrit (`parseModule`) : fonction pure, mêmes entrées, même niveau. */
export function buildModuleDef(def: ModuleDef, variant: number, options: BuildOptions = {}): BuiltModule {
  const values = def.variants[variant];
  if (!values) throw new ModuleError(`Morceau « ${def.id} » : pas de variante ${variant} (0 à ${def.variants.length - 1})`);
  const launch = options.lancement ?? 0;
  if (!Number.isInteger(launch) || launch < 0 || launch > 40) throw new ModuleError("lancement : de 0 à 40 colonnes");
  const where = (s: string) => `Morceau « ${def.id} », variante ${variant} : ${s}`;
  const cols = unroll(def.grid[0]!.length, def.repeats.filter((r) => r.axis === "colonnes"), values);
  const rows = unroll(def.grid.length, def.repeats.filter((r) => r.axis === "rangees"), values);
  const width = cols.src.length;
  const height = rows.src.length;
  if (height > MODULE_MAX_HEIGHT) throw new ModuleError(where(`${height} rangées (au plus ${MODULE_MAX_HEIGHT})`));
  if (width < 2 * PALIER_MIN) throw new ModuleError(where("trop étroit"));
  const entryRow = rows.first[def.entryRow]!;
  const exitRow = rows.first[def.exitRow]!;
  const lead = 1 + launch;

  const grid = rows.src.map((r) => cols.src.map((c) => def.grid[r]![c]!).join(""));
  const lines = grid.map((row, r) => {
    const head = row[0]!.repeat(lead);
    const tail = row[width - 1]!;
    const left = r === entryRow - 1 ? "S" + head.slice(1) : head;
    return left + row + (r === exitRow - 1 ? "F" : tail);
  });
  if (grid[entryRow - 1]?.[0] !== "." || grid[exitRow - 1]?.[width - 1] !== ".") throw new ModuleError(where("le départ et l'arrivée se posent sur des tuiles vides"));

  // ——— Bloc annexe : la section du morceau, ses scies (paramètres remplacés, coordonnées du gabarit traduites) ———
  const annex = [`section ${def.id} ${lead}-${lead + width - 1}`];
  for (const line of def.annex) {
    const filled = line.replace(/\{([a-z][a-z0-9]*)\}/g, (_, p: string) => String(values[p]));
    const words = filled.split(/\s+/);
    if (words[0] !== "scie") throw new ModuleError(where(`bloc annexe : seules les scies sont permises (« ${words[0]} »)`));
    annex.push(
      words
        .map((w, k) => {
          const m = k >= 5 ? /^(\d+)('?),(\d+)('?)$/.exec(w) : null;
          if (!m) return w;
          const c = Number(m[1]);
          const r = Number(m[3]);
          const col = (m[2] ? cols.last : cols.first)[c];
          const row = (m[4] ? rows.last : rows.first)[r];
          if (col === undefined || row === undefined || col < 0 || row < 0) throw new ModuleError(where(`point ${w} hors du gabarit ou retiré par la variante`));
          return `${col + lead},${row}`;
        })
        .join(" "),
    );
  }
  const ascii = lines.join("\n") + "\n\n" + annex.join("\n") + "\n";
  let level: Level;
  try {
    level = parseLevel(ascii);
  } catch (e) {
    if (e instanceof LevelError) throw new ModuleError(where(e.message));
    throw e;
  }
  const built: BuiltModule = {
    id: def.id,
    variant,
    values,
    levelId: `module:${def.id}:${variant}`,
    level,
    ascii,
    hash: textHash(ascii),
    lead,
    width,
    height,
    entryRow,
    exitRow,
  };
  const problems = palierProblems(built);
  if (problems.length > 0) throw new ModuleError(where(problems.join(" ; ")));
  return built;
}

/** Ce qui ne va pas dans les paliers d'un morceau construit (vide : conformes). */
export function palierProblems(m: BuiltModule): string[] {
  const out: string[] = [];
  const L = m.level;
  const T = UNITS_PER_TILE;
  const zones = [
    { name: "entrée", c0: m.lead, row: m.entryRow },
    { name: "sortie", c0: m.lead + m.width - PALIER_MIN, row: m.exitRow },
  ];
  for (const z of zones) {
    if (z.row - PALIER_HEADROOM < 0) out.push(`palier d'${z.name} : moins de ${PALIER_HEADROOM} rangées au-dessus`);
    for (let c = z.c0; c < z.c0 + PALIER_MIN; c++) {
      if (L.tiles[z.row * L.width + c] !== TILE_SOLID) out.push(`palier d'${z.name} : colonne ${c - m.lead} sans sol plein`);
      for (let r = Math.max(0, z.row - PALIER_HEADROOM); r < z.row; r++) {
        if (L.tiles[r * L.width + c] !== TILE_EMPTY) out.push(`palier d'${z.name} : tuile (${c - m.lead}, ${r}) occupée`);
      }
    }
    // Aucune scie (fixe ou mobile, sur tout son cycle) n'entre dans la boîte libre au-dessus du palier.
    const box = { x: z.c0 * T, y: (z.row - PALIER_HEADROOM) * T, w: PALIER_MIN * T, h: PALIER_HEADROOM * T };
    for (const saw of L.saws) {
      const n = saw.cycle === 0 ? 1 : saw.cycle;
      for (let t = 0; t < n; t++) {
        const p = sawCenter(saw, t);
        if (circleHitsBox(p.x, p.y, saw.radius, box)) {
          out.push(`palier d'${z.name} : la scie ${saw.id} y passe`);
          break;
        }
      }
    }
  }
  return out;
}

// ——— Le catalogue ———

/** Les morceaux du catalogue, dans l'ordre des fichiers (`catalog.ts`, généré par `solve:modules`). */
export const MODULES: readonly ModuleDef[] = MODULE_TEXTS.map(parseModule);

export function moduleDef(id: string): ModuleDef {
  const def = MODULES.find((m) => m.id === id);
  if (!def) throw new ModuleError(`Morceau « ${id} » inconnu`);
  return def;
}

/** **La** fonction qui construit un morceau du catalogue (solveur, tests, galerie, assemblage). Pure et déterministe. */
export function buildModule(id: string, variant: number, options: BuildOptions = {}): BuiltModule {
  return buildModuleDef(moduleDef(id), variant, options);
}

// ——— Solutions et exigence ———

/** Une solution stockée (une variante, un état d'entrée) : une rediffusion du lot 3 et sa marge. */
export interface ModuleSolution {
  /** Rediffusion (base64url) ; départ lancé pour l'entrée élan. */
  code: string;
  /** Durée (pas) de cette solution, et de la plus rapide trouvée avant recentrage (les deux sont égales ou presque). */
  ticks: number;
  fastest: number;
  /** Taux de réussite (‰) quand chaque changement de commande est décalé au hasard de ±1, ±2, ±3 pas (`GIGUE_DRAWS` tirages chacun). */
  gigue: readonly [number, number, number];
  /** Taux de réussite (‰) rejouée en élan depuis des positions d'entrée décalées de quelques unités (`RACCORD_OFFSETS`) ; null à l'arrêt. */
  raccord: number | null;
  /** Note d'exigence (1 facile … 5 exigeant), 0 = « au pas près » (refusée). */
  exigence: number;
}

export interface ModuleVariantSolutions {
  /** Empreinte de la grille construite (`BuiltModule.hash`). */
  grid: string;
  arret: ModuleSolution | null;
  elan: ModuleSolution | null;
}

export interface ModuleSolutionsFile {
  jumpSimVersion: number;
  /** Version de la règle de mesure (`EXIGENCE_VERSION`). */
  exigenceVersion: number;
  modules: Readonly<Record<string, { variants: readonly ModuleVariantSolutions[] }>>;
}

/** Version de la mesure d'exigence : la changer (tirages, décalages, seuils) oblige à relancer `solve:modules`. */
export const EXIGENCE_VERSION = 1;
/** Tirages par amplitude de gigue (±1, ±2, ±3 pas). */
export const GIGUE_DRAWS = 200;
/** Décalages d'entrée (unités, sur x) du test de raccord : un pas à pleine vitesse fait 375 unités, le raccord tombe n'importe où dedans. */
export const RACCORD_OFFSETS: readonly number[] = [-192, -160, -128, -96, -64, -48, -32, -16, -8, -4, -2, -1, 1, 2, 4, 8, 16, 32, 48, 64, 96, 128, 160, 192];
/** « Au pas près » : la solution échoue à ±1 pas sur plus de la moitié des tirages. */
export const PAS_PRES = 500;

/**
 * Note d'exigence d'une solution (taux en ‰). Règle (README du lot 4) :
 *   0 (« au pas près », refusée) si la gigue ±1 réussit moins d'une fois sur deux, ou si le raccord réussit moins d'une fois sur deux ;
 *   sinon, selon la gigue : 1 si ±3 réussit ≥ 90 % ; 2 si ±3 ≥ 60 % ; 3 si ±2 ≥ 60 % ; 4 si ±1 ≥ 80 % ; 5 sinon ;
 *   puis +1 (au plus 5) si le raccord échoue plus d'une fois sur dix.
 */
export function exigenceOf(gigue: readonly [number, number, number], raccord: number | null): number {
  const [g1, g2, g3] = gigue;
  if (g1 < PAS_PRES || (raccord !== null && raccord < PAS_PRES)) return 0;
  let e = g3 >= 900 ? 1 : g3 >= 600 ? 2 : g2 >= 600 ? 3 : g1 >= 800 ? 4 : 5;
  if (raccord !== null && raccord < 900 && e < 5) e++;
  return e;
}

/** Les solutions stockées d'un morceau (variante) : null si le catalogue n'en a pas (ou plus : grille ou version changée). */
export function moduleSolutions(id: string, variant: number): ModuleVariantSolutions | null {
  if (MODULE_SOLUTIONS.jumpSimVersion !== JUMP_SIM_VERSION) return null;
  return MODULE_SOLUTIONS.modules[id]?.variants[variant] ?? null;
}

/** Exigence d'une variante : la plus haute de ses deux solutions (0 s'il en manque une). */
export function variantExigence(s: ModuleVariantSolutions | null): number {
  if (!s || !s.arret || !s.elan) return 0;
  return s.arret.exigence === 0 || s.elan.exigence === 0 ? 0 : Math.max(s.arret.exigence, s.elan.exigence);
}
