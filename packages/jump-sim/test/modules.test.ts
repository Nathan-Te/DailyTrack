import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_FINISHED,
  DEFAULT_JUMP_PARAMS,
  EXIGENCE_VERSION,
  INPUT_RIGHT,
  MODULE_SIM_VERSION,
  MODULES,
  MODULE_ENTRIES,
  MODULE_MAX_HEIGHT,
  MODULE_MAX_TICKS,
  MODULE_MIN_TICKS,
  MODULE_TAGS,
  ModuleError,
  MODULE_FORMAT,
  MAX_VARIANTS,
  MAX_MUTATIONS,
  MUTATORS,
  LONG_MAX_TICKS,
  LONG_MIN_TICKS,
  mutateTemplate,
  mutationLabel,
  PALIER_GUARD,
  PALIER_HEADROOM,
  PALIER_LENGTH,
  HUMAIN_MIN,
  NOTE_SEUILS,
  PLAYER_HEIGHT,
  RACCORD_MIN,
  RACCORD_POSITIONS,
  TILE_EMPTY,
  TILE_SOLID,
  UNITS_PER_TILE,
  buildModule,
  buildModuleDef,
  MAX_REST_EXIGENCE,
  centerCol,
  INPUT_JUMP,
  decodeReplay,
  exigenceOf,
  fromRuns,
  isCleanRun,
  moduleSolutions,
  moduleSpan,
  moduleStart,
  palierProblems,
  parseModule,
  replayAttempt,
  stepAttempt,
  variantExigence,
  type BuiltModule,
  type ModuleSolution,
  type ModuleSolutionsFile,
  type CatalogFile,
  variantTheme,
} from "../src/index";
import { MODULE_SOLUTIONS, MODULE_TEXTS } from "../src/catalog";
import { catalogOf, catalogSource, readSolutions } from "../tools/files";
import { ELAN_FLAT_MAX, FLAT_MAX, flatLimit, flatsOf, longestFlat } from "../tools/plats";

/** Lot 15 : les solutions complètes (gigue, raccord, plus rapide…), que le jeu n'embarque plus. */
const FULL = readSolutions()!;

// Les morceaux des lots 4 et 6 : format v2, variantes, palier standard, catalogue et solutions stockées (point canonique au bord droit des
// paliers). Les solutions sont trouvées hors ligne (`npm run solve:modules -w @cdj/jump-sim`) : ce test ne cherche rien, il **rejoue** ce
// qui est stocké.

const T = UNITS_PER_TILE;
const DIR = join(import.meta.dirname, "../modules");
const STALE = "relancer solve:modules (npm run solve:modules -w @cdj/jump-sim)";

const SMALL = `
// Un petit morceau d'essai : une plage de colonnes répétée (le trou), une plage de rangées (la hauteur), une scie paramétrée.
id: essai-format
intention: Tester le format.
etiquettes: scie precision
famille: essai
format: 3
paliers: 5 5
repeter: trou colonnes 1-1
repeter: haut rangees 1-1
variante: trou=1 haut=1 cycle=120
variante: trou=3 haut=0 cycle=60
grille:
....
....
....
....
....
#.##
#.##

scie s o {cycle} aller-retour 1,0 1',4
`;

/** Pourquoi une solution stockée n'est plus valable pour ce morceau construit (null : elle l'est). */
function staleReason(file: ModuleSolutionsFile | CatalogFile, built: BuiltModule): string | null {
  if (file.jumpSimVersion !== MODULE_SIM_VERSION) return `version de la simulation ${file.jumpSimVersion} ≠ ${MODULE_SIM_VERSION} : ${STALE}`;
  if (file.exigenceVersion !== EXIGENCE_VERSION) return `mesure d'exigence ${file.exigenceVersion} ≠ ${EXIGENCE_VERSION} : ${STALE}`;
  const v = file.modules[built.id]?.variants[built.variant];
  if (!v) return `« ${built.id} » variante ${built.variant} sans solution : ${STALE}`;
  if (v.grid !== built.hash) return `grille de « ${built.id} » variante ${built.variant} modifiée (${v.grid} ≠ ${built.hash}) : ${STALE}`;
  for (const e of MODULE_ENTRIES) if (!v[e]) return `« ${built.id} » variante ${built.variant}, entrée ${e} : aucune solution : ${STALE}`;
  return null;
}

/** Les colonnes du morceau, dans le niveau construit, sont exactement la grille déroulée de la variante (rien n'y est ajouté). */
function row0(rows: readonly string[], m: BuiltModule): boolean {
  const def = MODULES.find((d) => d.id === m.id)!;
  const sliced = rows.map((r) => r.slice(m.lead, m.lead + m.width).replace(/[SFC]/g, "."));
  // Sans plage répétée de colonnes ni de rangées (ni dénivelé), la grille du fichier, mutée (lot 7), est recopiée telle quelle.
  const tpl = mutateTemplate(def, m.mutations);
  if (def.repeats.length === 0 && !tpl.denivele) return sliced.join("\n") === tpl.grid.join("\n");
  return sliced.length === m.height && sliced.every((r) => r.length === m.width);
}

describe("format d'un morceau", () => {
  const def = parseModule(SMALL);

  it("lit les métadonnées, la grille, les plages répétées, les variantes et le bloc annexe", () => {
    expect(def.id).toBe("essai-format");
    expect(def.tags).toEqual(["scie", "precision"]);
    expect([def.entryRow, def.exitRow]).toEqual([5, 5]);
    expect(def.params).toEqual(["trou", "haut", "cycle"]);
    expect(def.variants).toEqual([{ trou: 1, haut: 1, cycle: 120 }, { trou: 3, haut: 0, cycle: 60 }]);
    expect(def.grid).toHaveLength(7);
    expect(def.annex).toEqual(["scie s o {cycle} aller-retour 1,0 1',4"]);
  });

  it("une variante déroule les plages ; buildModule pose les paliers standard : palier d'entrée (départ), morceau, palier de sortie, piste, arrivée", () => {
    const a = buildModuleDef(def, 0);
    expect(a.width).toBe(4);
    expect(a.height).toBe(7);
    expect(a.lead).toBe(PALIER_GUARD + PALIER_LENGTH);
    // Garde, paliers : sol plein à la rangée déclarée, plein dessous, **vide au-dessus jusqu'en haut** (un rebord, pas un couloir).
    expect(a.ascii.split("\n\n")[0]!.split("\n")).toEqual([
      "...........",
      "...........",
      "...........",
      "...........",
      ".S........F",
      "####.######",
      "####.######",
    ]);
    expect(a.palierIn).toEqual({ col0: 1, col1: 2, row: 5 });
    expect(a.palierOut).toEqual({ col0: 7, col1: 8, row: 5 });
    expect(a.exitCol).toBe(9);
    expect(a.level.sections).toEqual([{ name: "essai-format", c0: 3, c1: 6, phase: 0 }]);
    const b = buildModuleDef(def, 1);
    expect(b.width).toBe(6); // trou de trois colonnes
    expect(b.height).toBe(6); // la rangée 1 retirée
    expect(b.entryRow).toBe(4);
    // `1,0` : première copie de la colonne 1 ; `1',4` : dernière copie (la rangée 4 de la grille devient la 3) ; `{cycle}` remplacé.
    const saw = b.level.saws[0]!;
    expect(saw.cycle).toBe(60);
    expect(saw.points).toEqual([{ x: 4 * T + T / 2, y: 0 * T + T / 2 }, { x: 6 * T + T / 2, y: 3 * T + T / 2 }]);
    expect(a.levelId).toBe("module:essai-format:0");
  });

  it("refuse ce qui est mal formé, avec un message clair", () => {
    const bad = (patch: (t: string) => string) => () => parseModule(patch(SMALL));
    expect(bad((t) => t.replace("etiquettes: scie precision", "etiquettes: scie neige"))).toThrow(/étiquette « neige » inconnue/);
    expect(bad((t) => t.replace("id: essai-format", "id: Essai"))).toThrow(/id/);
    expect(bad((t) => t.replace("variante: trou=3 haut=0 cycle=60", "variante: trou=3 haut=0"))).toThrow(/« cycle » manque/);
    expect(bad((t) => t.replace("variante: trou=3", "variante: trou=99"))).toThrow(/au plus 40/);
    expect(bad((t) => t.replace("repeter: haut rangees 1-1", "repeter: haut colonnes 0-2"))).toThrow(/chevauchent/);
    expect(bad((t) => t.replace("....\n#.##", "..S.\n#.##"))).toThrow(/interdit/);
    expect(bad((t) => t.replace("paliers: 5 5", "palier: 5 5"))).toThrow(/clé: valeur/);
    expect(bad((t) => t.replace("repeter: haut rangees 1-1", "repeter: haut rangees 5-5"))).toThrow(/palier ne se répète pas/);
    // Format v1 (paliers dessinés) ou absent : refusé ; un sol de palier trop haut dans la grille.
    expect(bad((t) => t.replace("format: 3", "format: 2"))).toThrow(/format 2/);
    expect(bad((t) => t.replace("format: 3\n", ""))).toThrow(/« format: » attendu/);
    expect(bad((t) => t.replace("famille: essai\n", ""))).toThrow(/« famille: » attendu/);
    expect(bad((t) => t.replace("famille: essai", "famille: Essai"))).toThrow(/famille/);
    expect(bad((t) => t.replace("paliers: 5 5", "paliers: 3 5"))).toThrow(/rangées libres/);
    // Une variante qui retire une colonne citée par une scie ; une première colonne pleine au ras du sol (on n'y entre pas en courant) ;
    // une scie qui passe au-dessus d'un palier.
    expect(() => buildModuleDef(parseModule(SMALL.replace("variante: trou=1", "variante: trou=0")), 0)).toThrow(ModuleError);
    expect(() => buildModuleDef(parseModule(SMALL.replace("....\n#.##\n#.##", "#...\n#.##\n#.##")), 0)).toThrow(/première colonne/);
    expect(() => buildModuleDef(parseModule(SMALL.replace("s o {cycle} aller-retour 1,0", "s O {cycle} aller-retour 0,2")), 0)).toThrow(/palier d'entrée : la scie s y passe/);
  });

  it("buildModule est pur et déterministe : même morceau, même variante, même niveau ; le gabarit ne bouge pas", () => {
    const before = JSON.stringify(def);
    const a = buildModuleDef(def, 1);
    const b = buildModuleDef(def, 1);
    expect(b).toEqual(a);
    expect(b.ascii).toBe(a.ascii);
    expect(JSON.stringify(def)).toBe(before);
    expect(buildModuleDef(def, 0).hash).not.toBe(a.hash);
    for (const m of MODULES) for (let v = 0; v < m.variants.length; v++) expect(buildModule(m.id, v)).toEqual(buildModule(m.id, v));
  });

  it("le couloir de lancement (jeu humain, entrée en élan) ajoute des colonnes devant le palier, le départ au bout", () => {
    const plain = buildModule("tunnel", 0);
    const run = buildModule("tunnel", 0, { lancement: 5 });
    expect(run.lead).toBe(5 + PALIER_GUARD + PALIER_LENGTH);
    expect(run.level.width).toBe(plain.level.width + 5);
    expect(run.level.start).toEqual({ col: 0, row: plain.entryRow - 1 });
    expect(plain.level.start).toEqual({ col: PALIER_GUARD, row: plain.entryRow - 1 });
    expect(run.palierIn).toEqual({ col0: 5 + PALIER_GUARD, col1: 5 + PALIER_GUARD + PALIER_LENGTH - 1, row: plain.entryRow });
    expect(run.level.sections[0]).toEqual({ name: "tunnel", c0: run.lead, c1: run.lead + plain.width - 1, phase: 0 });
  });
});

describe("le catalogue", () => {
  it("compte au moins 50 morceaux (lot 7), d'id distincts, chacun dans son fichier, avec 2 à 6 variantes", () => {
    expect(MODULES.length).toBeGreaterThanOrEqual(50);
    const files = readdirSync(DIR).filter((f) => f.endsWith(".txt")).sort();
    expect(MODULES.map((m) => `${m.id}.txt`)).toEqual(files);
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length);
    for (const m of MODULES) {
      expect(m.variants.length, m.id).toBeGreaterThanOrEqual(2);
      expect(m.variants.length, m.id).toBeLessThanOrEqual(MAX_VARIANTS);
    }
  });

  it("lot 7b : toute variante d'un morceau « respiration » a une exigence de 2 au plus (aux deux entrées)", () => {
    const rest = MODULES.filter((m) => m.tags.includes("respiration"));
    expect(rest.length).toBeGreaterThanOrEqual(4);
    for (const m of rest) {
      m.variants.forEach((_, v) => {
        const sol = moduleSolutions(m.id, v);
        expect(sol, `${m.id} v${v} a ses solutions`).not.toBeNull();
        for (const e of ["arret", "elan"] as const) expect(sol![e]!.exigence, `${m.id} v${v} ${e}`).toBeLessThanOrEqual(MAX_REST_EXIGENCE);
        expect(variantExigence(sol), `${m.id} v${v}`).toBeLessThanOrEqual(MAX_REST_EXIGENCE);
      });
    }
  });

  it("couvre toutes les étiquettes ; au moins 4 morceaux « respiration » faciles et 6 « mural » ; pas de doublon d'intention", () => {
    for (const tag of MODULE_TAGS) expect(MODULES.some((m) => m.tags.includes(tag)), tag).toBe(true);
    const easy = MODULES.filter((m) => m.tags.includes("respiration") && m.variants.every((_, v) => variantExigence(moduleSolutions(m.id, v)) <= 2));
    expect(easy.length).toBeGreaterThanOrEqual(4);
    expect(MODULES.filter((m) => m.tags.includes("mural")).length).toBeGreaterThanOrEqual(6);
    expect(new Set(MODULES.map((m) => m.intention)).size).toBe(MODULES.length);
    for (const m of MODULES) expect(m.intention, m.id).toMatch(/^[A-ZÀ-Ý].{20,}\.$/);
  });

  it("format v3 : chaque fichier est au format 3, aucune grille ne contient de palier — buildModule pose le palier standard à côté d'elle", () => {
    for (const def of MODULES) {
      expect(def.text, def.id).toMatch(new RegExp(`^format: ${MODULE_FORMAT}$`, "m"));
      for (let v = 0; v < def.variants.length; v++) {
        const m = buildModule(def.id, v);
        const where = `${def.id} v${v}`;
        expect(m.height, where).toBeLessThanOrEqual(MODULE_MAX_HEIGHT);
        expect(palierProblems(m), where).toEqual([]);
        const L = m.level;
        const rows = m.ascii.split("\n\n")[0]!.split("\n");
        // Le niveau = palier d'entrée · la grille de la variante, recopiée telle quelle · palier de sortie · piste · arrivée.
        expect(L.width, where).toBe(PALIER_GUARD + PALIER_LENGTH + m.width + PALIER_LENGTH + 2);
        expect(m.palierIn, where).toEqual({ col0: PALIER_GUARD, col1: PALIER_GUARD + PALIER_LENGTH - 1, row: m.entryRow });
        expect(m.palierOut, where).toEqual({ col0: m.lead + m.width, col1: m.lead + m.width + PALIER_LENGTH - 1, row: m.exitRow });
        expect(m.exitCol, where).toBe(m.palierOut.col1 + 1);
        for (const [p, row] of [[{ ...m.palierIn, col0: 0 }, m.entryRow], [m.palierOut, m.exitRow]] as const) {
          for (let c = p.col0; c <= p.col1; c++) {
            for (let r = 0; r < L.height; r++) expect(L.tiles[r * L.width + c], `${where} (${c}, ${r})`).toBe(r < row ? TILE_EMPTY : TILE_SOLID);
          }
        }
        expect(row0(rows, m), where).toBe(true);
        // Départ au début du palier d'entrée (la garde devant lui), arrivée après le palier de sortie et une colonne de piste, au sol.
        expect(L.start).toEqual({ col: PALIER_GUARD, row: m.entryRow - 1 });
        expect(L.finish).toEqual({ col: m.exitCol + 1, row: m.exitRow - 1 });
        expect(L.checkpoints).toEqual([]);
        expect(L.sections).toEqual([{ name: def.id, c0: m.lead, c1: m.lead + m.width - 1, phase: 0 }]);
        expect(m.entryRow, where).toBeGreaterThanOrEqual(PALIER_HEADROOM);
      }
    }
  });

  it("`src/catalog.ts` est exactement ce que solve:modules écrirait (textes des fichiers, solutions stockées)", () => {
    const texts = readdirSync(DIR)
      .filter((f) => f.endsWith(".txt"))
      .sort()
      .map((f) => readFileSync(join(DIR, f), "utf8"));
    expect(MODULE_TEXTS, `un fichier de morceau a changé : ${STALE}`).toEqual(texts);
    const stored = JSON.parse(readFileSync(join(DIR, "solutions.json"), "utf8")) as ModuleSolutionsFile;
    expect(MODULE_SOLUTIONS, STALE).toEqual(catalogOf(stored));
    expect(readFileSync(join(import.meta.dirname, "../src/catalog.ts"), "utf8"), STALE).toBe(catalogSource(texts, stored));
  });
});

describe("les solutions stockées", () => {
  it("une empreinte de grille ou de version périmée est signalée avec « relancer solve:modules »", () => {
    const m = buildModule("tunnel", 0);
    expect(staleReason(MODULE_SOLUTIONS, m)).toBeNull();
    const moved: CatalogFile = { ...MODULE_SOLUTIONS, modules: { ...MODULE_SOLUTIONS.modules, tunnel: { ...MODULE_SOLUTIONS.modules.tunnel!, variants: [{ ...MODULE_SOLUTIONS.modules.tunnel!.variants[0]!, grid: "00000000" }] } } };
    expect(staleReason(moved, m)).toMatch(/relancer solve:modules/);
    expect(staleReason({ ...MODULE_SOLUTIONS, jumpSimVersion: MODULE_SIM_VERSION - 1 }, m)).toMatch(/relancer solve:modules/);
    expect(staleReason({ ...MODULE_SOLUTIONS, exigenceVersion: EXIGENCE_VERSION + 1 }, m)).toMatch(/relancer solve:modules/);
    // La lecture du catalogue n'en rend aucune pour une autre version.
    expect(moduleSolutions("tunnel", 0)).not.toBeNull();
  });

  for (const def of MODULES) {
    it(`« ${def.id} » : chaque solution sort au bord droit de son palier, au sol, à pleine vitesse, en course propre, puis finit sans mourir`, () => {
      for (let v = 0; v < def.variants.length; v++) {
        const m = buildModule(def.id, v);
        expect(staleReason(MODULE_SOLUTIONS, m)).toBeNull();
        for (const entry of MODULE_ENTRIES) {
          // Lot 15 : le jeu n'embarque que la rediffusion et ses pas ; la mesure complète est dans `solutions.json`.
          const sol = FULL.modules[def.id]!.variants[v]![entry]!;
          const where = `${def.id} v${v} ${entry}`;
          const replay = decodeReplay(sol.code);
          expect(replay.start.elan, where).toBe(entry === "elan" ? 1 : 0);
          const r = replayAttempt(m.level, replay, m.levelId);
          expect(r.finished, where).toBe(true);
          expect(r.deaths, where).toEqual([]);
          expect(r.ticks, where).toBe(sol.ticks);
          expect(r.final.status).toBe(ATTEMPT_FINISHED);
          // La règle du point canonique, et les pas stockés sont ceux que le rejeu retrouve.
          const inputs = fromRuns(replay.runs);
          const span = moduleSpan(m, entry, inputs);
          expect(span, where).toEqual({ entryTick: sol.entryTick, exitTick: sol.exitTick, finishTick: sol.ticks });
          let s = moduleStart(m, entry);
          for (let t = 0; t < sol.exitTick; t++) {
            const before = s;
            s = stepAttempt(s, inputs[t]!, m.level, DEFAULT_JUMP_PARAMS);
            // Entrée (élan) : la course, droite tenue, jusqu'au pas où le centre passe le bord du palier d'entrée.
            if (entry === "elan" && t < sol.entryTick) expect(inputs[t], where).toBe(INPUT_RIGHT);
            if (entry === "elan" && t + 1 === sol.entryTick) {
              expect(centerCol(before.player), where).toBe(m.lead - 1);
              expect(centerCol(s.player), where).toBe(m.lead);
              expect(isCleanRun(s.player), where).toBe(true);
            }
            if (t + 1 < sol.exitTick) expect(centerCol(s.player), where).toBeLessThan(m.exitCol);
          }
          // Sortie : le premier pas où le centre passe le bord droit du palier de sortie, au sol de ce palier, à pleine vitesse.
          expect(centerCol(s.player), where).toBe(m.exitCol);
          expect(s.player.ground, where).toBe(1);
          expect(s.player.vx, where).toBe(DEFAULT_JUMP_PARAMS.runSpeed);
          expect(s.player.y + PLAYER_HEIGHT, where).toBe(m.exitRow * T);
          expect(isCleanRun(s.player), where).toBe(true);
          // Durée entre l'entrée et la sortie : de 1 à 6 s (5 à 8 s pour un enchaînement long) ; pas plus de 2 % au-dessus de la plus rapide.
          const ticks = sol.exitTick - sol.entryTick;
          expect(ticks, where).toBeGreaterThanOrEqual(def.long ? LONG_MIN_TICKS : MODULE_MIN_TICKS);
          expect(ticks, where).toBeLessThanOrEqual(def.long ? LONG_MAX_TICKS : MODULE_MAX_TICKS);
          expect(ticks, where).toBeLessThanOrEqual(sol.fastest + Math.floor((sol.fastest * 2) / 100));
          // Lot 8c, repli robuste : la plus rapide trouvée n'était pas jouable ; la solution gardée reste à 25 % d'elle au plus.
          if (sol.rapide !== undefined) {
            expect(sol.rapide, where).toBeLessThan(sol.fastest);
            expect(ticks, where).toBeLessThanOrEqual(sol.rapide + Math.floor((sol.rapide * 25) / 100));
          }
        }
      }
    });
  }

  it("tout morceau est jouable par un humain et solide au raccord : chaque solution réussit au moins une fois sur deux à ±3 pas (lot 8c), et en élan depuis 90 % des positions d'entrée", () => {
    const all: { where: string; sol: ModuleSolution }[] = [];
    for (const def of MODULES) {
      def.variants.forEach((_, v) => {
        for (const e of MODULE_ENTRIES) all.push({ where: `${def.id} v${v} ${e}`, sol: FULL.modules[def.id]!.variants[v]![e]! });
      });
    }
    for (const { where, sol } of all) {
      expect(sol.gigue[2], where).toBeGreaterThanOrEqual(HUMAIN_MIN);
      if (sol.raccord !== null) expect(sol.raccord, where).toBeGreaterThanOrEqual(RACCORD_MIN);
      expect(sol.exigence, where).toBe(exigenceOf(sol.gigue, sol.raccord));
      expect(sol.exigence, where).toBeGreaterThanOrEqual(1);
      expect(sol.raccord === null, where).toBe(where.endsWith("arret"));
    }
  });

  it("les exigences du catalogue vont de 1 à 5", () => {
    const seen = new Set<number>();
    for (const def of MODULES) def.variants.forEach((_, v) => seen.add(variantExigence(moduleSolutions(def.id, v))));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("règle d'exigence (lot 8c) : refusée sous la moitié à ±3 pas (pas jouable par un humain) ou sous 90 % au raccord (strict, lot 6), puis de 1 à 5 selon la gigue ±3", () => {
    expect([HUMAIN_MIN, ...NOTE_SEUILS]).toEqual([500, 950, 850, 720, 600]);
    // Le cas de plafond-pics v2 : parfait à ±1, mais un humain y échoue presque toujours (35 % à ±3) : refusé, il ne l'était pas avant.
    expect(exigenceOf([1000, 640, 350], null)).toBe(0);
    expect(exigenceOf([1000, 1000, 499], null)).toBe(0);
    expect(exigenceOf([1000, 1000, 1000], 899)).toBe(0);
    expect(exigenceOf([1000, 1000, 950], null)).toBe(1);
    expect(exigenceOf([1000, 1000, 950], 900)).toBe(1);
    expect(exigenceOf([1000, 950, 949], null)).toBe(2);
    expect(exigenceOf([1000, 900, 850], null)).toBe(2);
    expect(exigenceOf([1000, 900, 849], null)).toBe(3);
    expect(exigenceOf([1000, 800, 720], null)).toBe(3);
    expect(exigenceOf([1000, 800, 719], null)).toBe(4);
    expect(exigenceOf([1000, 700, 600], null)).toBe(4);
    expect(exigenceOf([1000, 700, 599], null)).toBe(5);
    expect(exigenceOf([900, 600, 500], 950)).toBe(5);
    // Seule la gigue ±3 compte : ±1 et ±2 ne changent ni le refus ni la note.
    expect(exigenceOf([400, 400, 800], null)).toBe(exigenceOf([1000, 1000, 800], null));
  });

  it("le test de raccord couvre tout un pas de course : 25 positions d'entrée régulières dans [0, runSpeed)", () => {
    expect(RACCORD_POSITIONS).toHaveLength(25);
    expect(Math.min(...RACCORD_POSITIONS)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...RACCORD_POSITIONS)).toBeLessThan(DEFAULT_JUMP_PARAMS.runSpeed);
    expect(Math.max(...RACCORD_POSITIONS) - Math.min(...RACCORD_POSITIONS)).toBeGreaterThan(DEFAULT_JUMP_PARAMS.runSpeed - 30);
  });
});

// ——— Lot 7 : mutateurs, plats, familles, enchaînements longs ———

const MUT = `
id: essai-mutateurs
intention: Tester les mutateurs.
etiquettes: precision
famille: essai
mutateurs: plafond fosse sol-friable patrouille garde ressort denivele surface clignotant alterne vent
format: 3
paliers: 6 6
repeter: large colonnes 4-4
variante: large=1
variante: large=2 +plafond:pics +fosse
variante: large=1 +sol-friable +ressort
variante: large=1 +patrouille:90 +garde
variante: large=1 +denivele:2
variante: large=2 +denivele:-1
grille:
...........
...........
...........
...........
...........
...........
###...#####
###...#####
###...#####

zone plafond 3-5 1
zone fosse 3-5 8
zone sol-friable 0-2 6
zone ressort 8 6
zone patrouille o 120 aller-retour 3,3 5,3
zone garde 5 5 <
zone denivele 6-10
zone surface 0-1 6
zone clignotant 0-1 6-8 b
zone alterne 8 6-8 A
zone vent 3-5 0-5
`;

describe("mutateurs (lot 7)", () => {
  const def = parseModule(MUT);
  const grid = (v: number) => buildModuleDef(def, v).ascii.split("\n\n")[0]!.split("\n").map((r) => r.slice(PALIER_GUARD + PALIER_LENGTH, -PALIER_LENGTH - 2));

  it("lit les zones et les mutateurs des variantes ; au plus deux par variante, six variantes, seulement ceux déclarés", () => {
    expect(def.mutators).toEqual(["plafond", "fosse", "sol-friable", "patrouille", "garde", "ressort", "denivele", "surface", "clignotant", "alterne", "vent"]);
    expect(MUTATORS).toEqual(def.mutators);
    expect([...def.zones.map((z) => z.name)].sort()).toEqual([...def.mutators].sort());
    expect(def.mutations[0]).toEqual([]);
    expect(def.mutations[1]).toEqual([{ name: "plafond", arg: "pics" }, { name: "fosse", arg: "" }]);
    expect(mutationLabel(def.mutations[1]!)).toBe("+plafond:pics +fosse");
    expect(def.mutations.every((m) => m.length <= MAX_MUTATIONS)).toBe(true);
    const bad = (from: string, to: string) => () => parseModule(MUT.replace(from, to));
    expect(bad("variante: large=1 +denivele:2", "variante: large=1 +denivele:2 +plafond +fosse")).toThrow(/au plus 2 mutateurs/);
    expect(bad("variante: large=1 +denivele:2", "variante: large=1 +tempete")).toThrow(/non accepté/);
    expect(bad("variante: large=1 +denivele:2", "variante: large=1 +denivele")).toThrow(/argument/);
    expect(bad("variante: large=1 +denivele:2", "variante: large=1 +plafond:lave")).toThrow(/argument/);
    expect(bad("zone garde 5 5 <", "zone garde 5 5 x")).toThrow(/zone garde/);
    expect(bad("zone denivele 6-10", "zone denivele 6-9")).toThrow(/dernière colonne/);
    expect(bad("zone ressort 8 6\n", "")).toThrow(/sans zone/);
    expect(bad("mutateurs: plafond fosse", "mutateurs: fosse")).toThrow(/absent de « mutateurs: »/);
    expect(bad("variante: large=1 +denivele:2", "variante: large=1")).toThrow(/identiques/);
    expect(() => parseModule(MUT.replace("variante: large=1\n", "variante: large=1\nvariante: large=3\n"))).toThrow(/au plus 6/);
  });

  it("chaque mutateur transforme exactement sa zone du gabarit, puis le déroulé recopie la plage répétée", () => {
    expect(grid(0)).toEqual(["...........", "...........", "...........", "...........", "...........", "...........", "###...#####", "###...#####", "###...#####"]);
    // plafond (pics) : plein jusqu'à la rangée d'au-dessus, pics à la rangée ; fosse : le fond vide devient un fond de pics sur du plein.
    expect(grid(1)).toEqual(["...####.....", "...vvvv.....", "............", "............", "............", "............", "###....#####", "###....#####", "###^^^^#####"]);
    // sol-friable : x ; ressort : *.
    expect(grid(2)).toEqual(["...........", "...........", "...........", "...........", "...........", "...........", "xxx...##*##", "###...#####", "###...#####"]);
    // garde : un pic contre le mur ; patrouille : une scie de plus, au cycle donné.
    expect(grid(3)[5]).toBe(".....<.....");
    const saw = buildModuleDef(def, 3).level.saws.find((s) => s.id === "mutee")!;
    expect(saw.cycle).toBe(90);
    // denivele : la zone descend de 2 (la grille s'allonge), la sortie aussi ; ou monte de 1 (le bas recopie la dernière tuile).
    const down = buildModuleDef(def, 4);
    expect(down.exitRow).toBe(8);
    expect(down.height).toBe(11);
    expect(grid(4).map((r) => r.slice(6))).toEqual([".....", ".....", ".....", ".....", ".....", ".....", ".....", ".....", "#####", "#####", "#####"]);
    const up = buildModuleDef(def, 5);
    expect(up.exitRow).toBe(5);
    expect(grid(5)[5]!.slice(7)).toBe("#####");
  });

  it("lot 11 : `+surface:glace` / `tapis:gauche` / `tapis:droite` convertissent exactement les tuiles de sol de leur zone, et la variante est réservée à son thème", () => {
    const withSurface = (arg: string) => parseModule(MUT.replace("variante: large=1 +denivele:2", `variante: large=1 +surface:${arg}`));
    const row = (arg: string) => buildModuleDef(withSurface(arg), 4).ascii.split("\n\n")[0]!.split("\n")[6]!.slice(PALIER_GUARD + PALIER_LENGTH, PALIER_GUARD + PALIER_LENGTH + 3);
    expect(row("glace")).toBe("~~#");
    expect(row("tapis:gauche")).toBe("[[#");
    expect(row("tapis:droite")).toBe("]]#");
    expect(variantTheme(withSurface("glace"), 4)).toBe("glace");
    expect(variantTheme(withSurface("tapis:droite"), 4)).toBe("usine");
    expect(variantTheme(withSurface("glace"), 0)).toBeNull();
    expect(() => parseModule(MUT.replace("variante: large=1 +denivele:2", "variante: large=1 +surface:sable"))).toThrow(/argument/);
    expect(() => parseModule(MUT.replace("variante: large=1 +denivele:2", "variante: large=1 +surface"))).toThrow(/argument/);
    // Une tuile qui n'est pas un bloc ne se convertit pas.
    expect(() => buildModuleDef(parseModule(MUT.replace("zone surface 0-1 6", "zone surface 0-3 6").replace("variante: large=1 +denivele:2", "variante: large=1 +surface:glace")), 4)).toThrow(/au lieu d'un bloc/);
  });

  it("purs et déterministes : le gabarit ne bouge pas, deux constructions donnent le même niveau", () => {
    const before = JSON.stringify(def);
    for (let v = 0; v < def.variants.length; v++) {
      const a = mutateTemplate(def, def.mutations[v]!);
      expect(mutateTemplate(def, def.mutations[v]!)).toEqual(a);
      expect(buildModuleDef(def, v)).toEqual(buildModuleDef(def, v));
    }
    expect(JSON.stringify(def)).toBe(before);
  });

  it("refuse une zone qui ne s'y prête pas (une tuile qui n'est pas ce que le mutateur attend), avec un message clair", () => {
    const wrong = parseModule(MUT.replace("zone sol-friable 0-2 6", "zone sol-friable 0-3 6"));
    expect(() => buildModuleDef(wrong, 2)).toThrow(/sol-friable.*au lieu d'un bloc/);
    const blocked = parseModule(MUT.replace("zone garde 5 5 <", "zone garde 6 6 <"));
    expect(() => buildModuleDef(blocked, 3)).toThrow(/garde.*occupée/);
  });

  it("toutes les variantes mutées du catalogue sont des morceaux conformes : paliers, hauteur, plats", () => {
    let mutated = 0;
    for (const def of MODULES) {
      def.mutations.forEach((muts, v) => {
        if (muts.length === 0) return;
        mutated++;
        const m = buildModule(def.id, v);
        expect(palierProblems(m), `${def.id} v${v}`).toEqual([]);
        expect(m.height, `${def.id} v${v}`).toBeLessThanOrEqual(MODULE_MAX_HEIGHT);
        expect(longestFlat(m).length, `${def.id} v${v}`).toBeLessThanOrEqual(flatLimit(def.elan));
      });
    }
    expect(mutated).toBeGreaterThanOrEqual(60);
  });

  it("chaque mutateur sert dans le catalogue", () => {
    for (const name of MUTATORS) expect(MODULES.some((d) => d.mutations.some((ms) => ms.some((x) => x.name === name))), name).toBe(true);
  });
});

describe("règle des plats (lot 7)", () => {
  it("un plat sans défi est une suite de colonnes au même sol, sans danger dans les 3 rangées au-dessus", () => {
    const flat = buildModuleDef(parseModule(MUT), 0);
    // Le sol à gauche (3 colonnes), le sol à droite (5 colonnes) ; le trou coupe.
    expect(flatsOf(flat).map((f) => f.length)).toEqual([5, 3]);
    const spiked = buildModuleDef(parseModule(MUT.replace("###...#####\n###...#####\n###...#####", "###...##^##\n###...#####\n###...#####")), 0);
    expect(flatsOf(spiked).map((f) => f.length)).toEqual([3, 2, 2]);
  });

  it(`aucun morceau n'a de plat sans défi de plus de ${FLAT_MAX} tuiles ; « elan » (l'élan est le défi) : ${ELAN_FLAT_MAX} au plus, et il en a besoin`, () => {
    for (const def of MODULES) {
      let longest = 0;
      for (let v = 0; v < def.variants.length; v++) {
        const f = longestFlat(buildModule(def.id, v));
        expect(f.length, `${def.id} v${v} (colonne ${f.col}, rangée ${f.row})`).toBeLessThanOrEqual(flatLimit(def.elan));
        longest = Math.max(longest, f.length);
      }
      if (def.elan) expect(longest, `${def.id} est marqué elan sans plat de plus de ${FLAT_MAX}`).toBeGreaterThan(FLAT_MAX);
    }
    expect(MODULES.filter((d) => d.elan).map((d) => d.id)).toEqual(["saut-long"]);
  });

  it("les respirations ne sont plus des courses à plat : chacune a au moins trois sauts à faire (trous, bosses, corniches, ressorts)", () => {
    for (const def of MODULES.filter((d) => d.tags.includes("respiration"))) {
      for (let v = 0; v < def.variants.length; v++) {
        // Lot 12 : les sols de nuit et de néon (et d'une variante mutée) sont des blocs clignotants ou alternés, pas des `#` : on compte alors les **sauts** de chaque solution
        // stockée (fronts montants du bouton de saut), aux deux entrées. Les autres : les plats, comme avant.
        if (def.theme === "nuit" || def.theme === "neon" || def.mutations[v]!.some((m) => m.name === "clignotant" || m.name === "alterne")) {
          for (const entry of ["arret", "elan"] as const) {
            const sol = moduleSolutions(def.id, v)![entry]!;
            const bits = fromRuns(decodeReplay(sol.code).runs);
            const presses = bits.filter((b, t) => (b & INPUT_JUMP) !== 0 && (t === 0 || (bits[t - 1]! & INPUT_JUMP) === 0)).length;
            expect(presses, `${def.id} v${v} ${entry}`).toBeGreaterThanOrEqual(3);
          }
          continue;
        }
        const flats = flatsOf(buildModule(def.id, v));
        expect(flats.length, `${def.id} v${v}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("familles et enchaînements longs (lot 7)", () => {
  it("chaque morceau a une famille ; les cheminées sont une seule famille ; aucune famille ne compte plus de 5 morceaux", () => {
    const fam = new Map<string, string[]>();
    for (const d of MODULES) fam.set(d.family, [...(fam.get(d.family) ?? []), d.id]);
    for (const id of ["cheminee", "cheminee-scie", "cheminee-pics"]) expect(MODULES.find((d) => d.id === id)!.family).toBe("cheminee");
    for (const [f, ids] of fam) expect(ids.length, f).toBeLessThanOrEqual(5);
    expect(fam.size).toBeGreaterThanOrEqual(25);
  });

  it("au moins 8 enchaînements longs, chacun de 5 à 8 s (entrée → sortie) ; les autres morceaux de 1 à 6 s", () => {
    const longs = MODULES.filter((d) => d.long);
    expect(longs.length).toBeGreaterThanOrEqual(8);
    for (const def of MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        for (const e of MODULE_ENTRIES) {
          const sol = moduleSolutions(def.id, v)![e]!;
          const ticks = sol.exitTick - sol.entryTick;
          const [lo, hi] = def.long ? [LONG_MIN_TICKS, LONG_MAX_TICKS] : [MODULE_MIN_TICKS, MODULE_MAX_TICKS];
          expect(ticks, `${def.id} v${v} ${e}`).toBeGreaterThanOrEqual(lo);
          expect(ticks, `${def.id} v${v} ${e}`).toBeLessThanOrEqual(hi);
        }
      }
    }
  });

  it("au moins 6 morceaux finissent plus bas qu'ils ne commencent (variante 0)", () => {
    const lower = MODULES.filter((d) => {
      const m = buildModule(d.id, 0);
      return m.exitRow > m.entryRow;
    });
    expect(lower.length).toBeGreaterThanOrEqual(6);
  });
});
