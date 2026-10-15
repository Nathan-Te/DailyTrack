import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_FINISHED,
  DEFAULT_JUMP_PARAMS,
  EXIGENCE_VERSION,
  INPUT_RIGHT,
  JUMP_SIM_VERSION,
  MODULES,
  MODULE_ENTRIES,
  MODULE_MAX_HEIGHT,
  MODULE_MAX_TICKS,
  MODULE_MIN_TICKS,
  MODULE_TAGS,
  ModuleError,
  MODULE_FORMAT,
  PALIER_GUARD,
  PALIER_HEADROOM,
  PALIER_LENGTH,
  PAS_PRES,
  PLAYER_HEIGHT,
  RACCORD_MIN,
  RACCORD_POSITIONS,
  TILE_EMPTY,
  TILE_SOLID,
  UNITS_PER_TILE,
  buildModule,
  buildModuleDef,
  centerCol,
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
} from "../src/index";
import { MODULE_SOLUTIONS, MODULE_TEXTS } from "../src/catalog";
import { catalogSource } from "../tools/files";

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
format: 2
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
function staleReason(file: ModuleSolutionsFile, built: BuiltModule): string | null {
  if (file.jumpSimVersion !== JUMP_SIM_VERSION) return `version de la simulation ${file.jumpSimVersion} ≠ ${JUMP_SIM_VERSION} : ${STALE}`;
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
  // Sans plage répétée de colonnes ni de rangées, la grille du fichier est recopiée telle quelle.
  if (def.repeats.length === 0) return sliced.join("\n") === def.grid.join("\n");
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
    expect(a.level.sections).toEqual([{ name: "essai-format", c0: 3, c1: 6 }]);
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
    expect(bad((t) => t.replace("etiquettes: scie precision", "etiquettes: scie glace"))).toThrow(/étiquette « glace » inconnue/);
    expect(bad((t) => t.replace("id: essai-format", "id: Essai"))).toThrow(/id/);
    expect(bad((t) => t.replace("variante: trou=3 haut=0 cycle=60", "variante: trou=3 haut=0"))).toThrow(/« cycle » manque/);
    expect(bad((t) => t.replace("variante: trou=3", "variante: trou=99"))).toThrow(/au plus 40/);
    expect(bad((t) => t.replace("repeter: haut rangees 1-1", "repeter: haut colonnes 0-2"))).toThrow(/chevauchent/);
    expect(bad((t) => t.replace("....\n#.##", "..S.\n#.##"))).toThrow(/interdit/);
    expect(bad((t) => t.replace("paliers: 5 5", "palier: 5 5"))).toThrow(/clé: valeur/);
    expect(bad((t) => t.replace("repeter: haut rangees 1-1", "repeter: haut rangees 5-5"))).toThrow(/palier ne se répète pas/);
    // Format v1 (paliers dessinés) ou absent : refusé ; un sol de palier trop haut dans la grille.
    expect(bad((t) => t.replace("format: 2", "format: 1"))).toThrow(/format 1/);
    expect(bad((t) => t.replace("format: 2\n", ""))).toThrow(/« format: » attendu/);
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
    const plain = buildModule("plaine", 0);
    const run = buildModule("plaine", 0, { lancement: 5 });
    expect(run.lead).toBe(5 + PALIER_GUARD + PALIER_LENGTH);
    expect(run.level.width).toBe(plain.level.width + 5);
    expect(run.level.start).toEqual({ col: 0, row: plain.entryRow - 1 });
    expect(plain.level.start).toEqual({ col: PALIER_GUARD, row: plain.entryRow - 1 });
    expect(run.palierIn).toEqual({ col0: 5 + PALIER_GUARD, col1: 5 + PALIER_GUARD + PALIER_LENGTH - 1, row: plain.entryRow });
    expect(run.level.sections[0]).toEqual({ name: "plaine", c0: run.lead, c1: run.lead + plain.width - 1 });
  });
});

describe("le catalogue", () => {
  it("compte 25 à 30 morceaux, d'id distincts, chacun dans son fichier, avec 2 à 4 variantes", () => {
    expect(MODULES.length).toBeGreaterThanOrEqual(25);
    expect(MODULES.length).toBeLessThanOrEqual(30);
    const files = readdirSync(DIR).filter((f) => f.endsWith(".txt")).sort();
    expect(MODULES.map((m) => `${m.id}.txt`)).toEqual(files);
    expect(new Set(MODULES.map((m) => m.id)).size).toBe(MODULES.length);
    for (const m of MODULES) {
      expect(m.variants.length, m.id).toBeGreaterThanOrEqual(2);
      expect(m.variants.length, m.id).toBeLessThanOrEqual(4);
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

  it("format v2 : chaque fichier est au format 2, aucune grille ne contient de palier — buildModule pose le palier standard à côté d'elle", () => {
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
        expect(L.sections).toEqual([{ name: def.id, c0: m.lead, c1: m.lead + m.width - 1 }]);
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
    expect(MODULE_SOLUTIONS, STALE).toEqual(stored);
    expect(readFileSync(join(import.meta.dirname, "../src/catalog.ts"), "utf8"), STALE).toBe(catalogSource(texts, stored));
  });
});

describe("les solutions stockées", () => {
  it("une empreinte de grille ou de version périmée est signalée avec « relancer solve:modules »", () => {
    const m = buildModule("plaine", 0);
    expect(staleReason(MODULE_SOLUTIONS, m)).toBeNull();
    const moved: ModuleSolutionsFile = { ...MODULE_SOLUTIONS, modules: { ...MODULE_SOLUTIONS.modules, plaine: { ...MODULE_SOLUTIONS.modules.plaine!, variants: [{ ...MODULE_SOLUTIONS.modules.plaine!.variants[0]!, grid: "00000000" }] } } };
    expect(staleReason(moved, m)).toMatch(/relancer solve:modules/);
    expect(staleReason({ ...MODULE_SOLUTIONS, jumpSimVersion: JUMP_SIM_VERSION - 1 }, m)).toMatch(/relancer solve:modules/);
    expect(staleReason({ ...MODULE_SOLUTIONS, exigenceVersion: EXIGENCE_VERSION + 1 }, m)).toMatch(/relancer solve:modules/);
    // La lecture du catalogue n'en rend aucune pour une autre version.
    expect(moduleSolutions("plaine", 0)).not.toBeNull();
  });

  for (const def of MODULES) {
    it(`« ${def.id} » : chaque solution sort au bord droit de son palier, au sol, à pleine vitesse, en course propre, puis finit sans mourir`, () => {
      for (let v = 0; v < def.variants.length; v++) {
        const m = buildModule(def.id, v);
        expect(staleReason(MODULE_SOLUTIONS, m)).toBeNull();
        for (const entry of MODULE_ENTRIES) {
          const sol = MODULE_SOLUTIONS.modules[def.id]!.variants[v]![entry]!;
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
          // Durée entre l'entrée et la sortie : de 1 à 6 s ; pas plus de 2 % au-dessus de la plus rapide trouvée.
          const ticks = sol.exitTick - sol.entryTick;
          expect(ticks, where).toBeGreaterThanOrEqual(MODULE_MIN_TICKS);
          expect(ticks, where).toBeLessThanOrEqual(MODULE_MAX_TICKS);
          expect(ticks, where).toBeLessThanOrEqual(sol.fastest + Math.floor((sol.fastest * 2) / 100));
        }
      }
    });
  }

  it("aucun morceau n'est « au pas près » ni fragile au raccord : chaque solution réussit au moins une fois sur deux à ±1 pas, et en élan depuis 90 % des positions d'entrée", () => {
    const all: { where: string; sol: ModuleSolution }[] = [];
    for (const def of MODULES) {
      def.variants.forEach((_, v) => {
        for (const e of MODULE_ENTRIES) all.push({ where: `${def.id} v${v} ${e}`, sol: MODULE_SOLUTIONS.modules[def.id]!.variants[v]![e]! });
      });
    }
    for (const { where, sol } of all) {
      expect(sol.gigue[0], where).toBeGreaterThanOrEqual(PAS_PRES);
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

  it("règle d'exigence : refusée sous la moitié à ±1 ou sous 90 % au raccord (strict, lot 6), puis de 1 à 5 selon la gigue", () => {
    expect(exigenceOf([499, 900, 900], null)).toBe(0);
    expect(exigenceOf([1000, 1000, 1000], 899)).toBe(0);
    expect(exigenceOf([1000, 1000, 950], null)).toBe(1);
    expect(exigenceOf([1000, 1000, 950], 900)).toBe(1);
    expect(exigenceOf([1000, 900, 700], null)).toBe(2);
    expect(exigenceOf([1000, 700, 400], null)).toBe(3);
    expect(exigenceOf([900, 500, 300], null)).toBe(4);
    expect(exigenceOf([600, 300, 100], null)).toBe(5);
    expect(exigenceOf([600, 300, 100], 950)).toBe(5);
  });

  it("le test de raccord couvre tout un pas de course : 25 positions d'entrée régulières dans [0, runSpeed)", () => {
    expect(RACCORD_POSITIONS).toHaveLength(25);
    expect(Math.min(...RACCORD_POSITIONS)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...RACCORD_POSITIONS)).toBeLessThan(DEFAULT_JUMP_PARAMS.runSpeed);
    expect(Math.max(...RACCORD_POSITIONS) - Math.min(...RACCORD_POSITIONS)).toBeGreaterThan(DEFAULT_JUMP_PARAMS.runSpeed - 30);
  });
});
