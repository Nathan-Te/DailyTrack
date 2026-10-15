import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  DEFAULT_JUMP_PARAMS,
  EXIGENCE_VERSION,
  JUMP_SIM_VERSION,
  MODULES,
  MODULE_ENTRIES,
  MODULE_MAX_HEIGHT,
  MODULE_MAX_TICKS,
  MODULE_MIN_TICKS,
  MODULE_TAGS,
  ModuleError,
  PALIER_HEADROOM,
  PALIER_MIN,
  PAS_PRES,
  PLAYER_WIDTH,
  TILE_EMPTY,
  TILE_SOLID,
  UNITS_PER_TILE,
  buildModule,
  buildModuleDef,
  decodeReplay,
  exigenceOf,
  moduleSolutions,
  palierProblems,
  parseModule,
  replayAttempt,
  variantExigence,
  type BuiltModule,
  type ModuleSolution,
  type ModuleSolutionsFile,
} from "../src/index";
import { MODULE_SOLUTIONS, MODULE_TEXTS } from "../src/catalog";
import { catalogSource } from "../tools/files";

// Les morceaux du lot 4 : format, variantes, paliers, catalogue et solutions stockées. Les solutions sont trouvées hors ligne
// (`npm run solve:modules -w @cdj/jump-sim`) : ce test ne cherche rien, il **rejoue** ce qui est stocké.

const T = UNITS_PER_TILE;
const DIR = join(import.meta.dirname, "../modules");
const STALE = "relancer solve:modules (npm run solve:modules -w @cdj/jump-sim)";

const SMALL = `
// Un petit morceau d'essai : une plage de colonnes répétée (le trou), une plage de rangées (la hauteur), une scie paramétrée.
id: essai-format
intention: Tester le format.
etiquettes: scie precision
paliers: 5 5
repeter: trou colonnes 4-4
repeter: haut rangees 1-1
variante: trou=1 haut=1 cycle=120
variante: trou=3 haut=0 cycle=60
grille:
..........
..........
..........
..........
..........
####.#####
####.#####

scie s o {cycle} aller-retour 4,0 4',4
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

describe("format d'un morceau", () => {
  const def = parseModule(SMALL);

  it("lit les métadonnées, la grille, les plages répétées, les variantes et le bloc annexe", () => {
    expect(def.id).toBe("essai-format");
    expect(def.tags).toEqual(["scie", "precision"]);
    expect([def.entryRow, def.exitRow]).toEqual([5, 5]);
    expect(def.params).toEqual(["trou", "haut", "cycle"]);
    expect(def.variants).toEqual([{ trou: 1, haut: 1, cycle: 120 }, { trou: 3, haut: 0, cycle: 60 }]);
    expect(def.grid).toHaveLength(7);
    expect(def.annex).toEqual(["scie s o {cycle} aller-retour 4,0 4',4"]);
  });

  it("une variante déroule les plages : colonne d'appel avec le départ, morceau, colonne de sortie avec l'arrivée, une section", () => {
    const a = buildModuleDef(def, 0);
    expect(a.width).toBe(10);
    expect(a.height).toBe(7);
    expect(a.lead).toBe(1);
    expect(a.ascii.split("\n\n")[0]!.split("\n")).toEqual([
      "............",
      "............",
      "............",
      "............",
      "S..........F",
      ".####.######",
      ".####.######",
    ].map((row, r) => (r >= 5 ? "#" + row.slice(1) : row)));
    expect(a.level.sections).toEqual([{ name: "essai-format", c0: 1, c1: 10 }]);
    const b = buildModuleDef(def, 1);
    expect(b.width).toBe(12); // trou de trois colonnes
    expect(b.height).toBe(6); // la rangée 1 retirée
    expect(b.entryRow).toBe(4);
    // `4,0` : première copie de la colonne 4 ; `4',4` : dernière copie (la rangée 4 du gabarit devient la 3) ; `{cycle}` remplacé.
    const saw = b.level.saws[0]!;
    expect(saw.cycle).toBe(60);
    expect(saw.points).toEqual([{ x: 5 * T + T / 2, y: 0 * T + T / 2 }, { x: 7 * T + T / 2, y: 3 * T + T / 2 }]);
    expect(a.levelId).toBe("module:essai-format:0");
  });

  it("refuse ce qui est mal formé, avec un message clair", () => {
    const bad = (patch: (t: string) => string) => () => parseModule(patch(SMALL));
    expect(bad((t) => t.replace("etiquettes: scie precision", "etiquettes: scie glace"))).toThrow(/étiquette « glace » inconnue/);
    expect(bad((t) => t.replace("id: essai-format", "id: Essai"))).toThrow(/id/);
    expect(bad((t) => t.replace("variante: trou=3 haut=0 cycle=60", "variante: trou=3 haut=0"))).toThrow(/« cycle » manque/);
    expect(bad((t) => t.replace("variante: trou=3", "variante: trou=99"))).toThrow(/au plus 40/);
    expect(bad((t) => t.replace("repeter: haut rangees 1-1", "repeter: haut colonnes 3-5"))).toThrow(/chevauchent/);
    expect(bad((t) => t.replace("..........\n####", "....S.....\n####"))).toThrow(/interdit/);
    expect(bad((t) => t.replace("paliers: 5 5", "palier: 5 5"))).toThrow(/clé: valeur/);
    expect(bad((t) => t.replace("repeter: haut rangees 1-1", "repeter: haut rangees 5-5"))).toThrow(/palier ne se répète pas/);
    // Une variante qui retire une colonne citée par une scie, une plage qui casse un palier.
    expect(() => buildModuleDef(parseModule(SMALL.replace("variante: trou=1", "variante: trou=0")), 0)).toThrow(ModuleError);
    expect(() => buildModuleDef(parseModule(SMALL.replace("####.#####\n####", "##.#.#####\n####")), 0)).toThrow(/palier d'entrée/);
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
    expect(run.lead).toBe(6);
    expect(run.level.width).toBe(plain.level.width + 5);
    expect(run.level.start).toEqual({ col: 0, row: plain.entryRow - 1 });
    expect(run.level.sections[0]).toEqual({ name: "plaine", c0: 6, c1: 6 + plain.width - 1 });
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

  it("chaque variante construite a des paliers conformes (≥ 3 tuiles de sol plein, 4 rangées libres, aucune scie) et tient en 30 rangées", () => {
    for (const def of MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        const m = buildModule(def.id, v);
        expect(m.height, `${def.id} v${v}`).toBeLessThanOrEqual(MODULE_MAX_HEIGHT);
        expect(palierProblems(m), `${def.id} v${v}`).toEqual([]);
        const L = m.level;
        for (const [c0, row] of [[m.lead, m.entryRow], [m.lead + m.width - PALIER_MIN, m.exitRow]] as const) {
          for (let c = c0; c < c0 + PALIER_MIN; c++) {
            expect(L.tiles[row * L.width + c], `${def.id} v${v} sol (${c}, ${row})`).toBe(TILE_SOLID);
            for (let r = row - PALIER_HEADROOM; r < row; r++) expect(L.tiles[r * L.width + c], `${def.id} v${v} (${c}, ${r})`).toBe(TILE_EMPTY);
          }
        }
        // Départ au début du palier d'entrée (colonne d'appel), arrivée juste après le bord droit du palier de sortie, au sol.
        expect(L.start).toEqual({ col: m.lead - 1, row: m.entryRow - 1 });
        expect(L.finish).toEqual({ col: m.lead + m.width, row: m.exitRow - 1 });
        expect(L.checkpoints).toEqual([]);
        expect(L.sections).toHaveLength(1);
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
    it(`« ${def.id} » : chaque solution, rejouée, finit sans mourir, au sol, à pleine vitesse, en franchissant le bord droit du palier de sortie`, () => {
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
          expect(r.time, where).toBe(sol.ticks);
          expect(r.final.status).toBe(ATTEMPT_FINISHED);
          expect(r.final.player.ground, where).toBe(1);
          expect(r.final.player.vx, where).toBe(DEFAULT_JUMP_PARAMS.runSpeed);
          // Le bord droit du morceau : l'avant de la boîte vient de le passer, au niveau du palier de sortie.
          const edge = (m.lead + m.width) * T;
          expect(r.final.player.x + PLAYER_WIDTH, where).toBeGreaterThan(edge);
          expect(r.final.player.x + PLAYER_WIDTH - DEFAULT_JUMP_PARAMS.runSpeed, where).toBeLessThanOrEqual(edge);
          expect(r.final.player.y + 3072, where).toBe(m.exitRow * T);
          // Durée : entre 2 et 6 s ; elle ne vaut pas plus de 2 % de plus que la plus rapide trouvée.
          expect(sol.ticks, where).toBeGreaterThanOrEqual(MODULE_MIN_TICKS);
          expect(sol.ticks, where).toBeLessThanOrEqual(MODULE_MAX_TICKS);
          expect(sol.ticks, where).toBeLessThanOrEqual(sol.fastest + Math.floor((sol.fastest * 2) / 100));
          expect(r.final.status, where).not.toBe(ATTEMPT_DEAD);
        }
      }
    });
  }

  it("aucun morceau n'est « au pas près » : d'après les taux stockés, chaque solution réussit au moins une fois sur deux à ±1 pas", () => {
    const all: { where: string; sol: ModuleSolution }[] = [];
    for (const def of MODULES) {
      def.variants.forEach((_, v) => {
        for (const e of MODULE_ENTRIES) all.push({ where: `${def.id} v${v} ${e}`, sol: MODULE_SOLUTIONS.modules[def.id]!.variants[v]![e]! });
      });
    }
    for (const { where, sol } of all) {
      expect(sol.gigue[0], where).toBeGreaterThanOrEqual(PAS_PRES);
      if (sol.raccord !== null) expect(sol.raccord, where).toBeGreaterThanOrEqual(PAS_PRES);
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

  it("règle d'exigence : au pas près sous la moitié à ±1 (ou au raccord), puis de 1 à 5 selon la gigue, +1 pour un raccord fragile", () => {
    expect(exigenceOf([499, 900, 900], null)).toBe(0);
    expect(exigenceOf([1000, 1000, 1000], 499)).toBe(0);
    expect(exigenceOf([1000, 1000, 950], null)).toBe(1);
    expect(exigenceOf([1000, 1000, 950], 850)).toBe(2);
    expect(exigenceOf([1000, 900, 700], null)).toBe(2);
    expect(exigenceOf([1000, 700, 400], null)).toBe(3);
    expect(exigenceOf([900, 500, 300], null)).toBe(4);
    expect(exigenceOf([600, 300, 100], null)).toBe(5);
    expect(exigenceOf([600, 300, 100], 600)).toBe(5);
  });
});
