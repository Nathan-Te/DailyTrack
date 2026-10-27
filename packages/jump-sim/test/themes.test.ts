import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_VARIANTS,
  JUMP_THEME_NAMES,
  LEVEL_ID_PATTERN,
  MODULES,
  PREMIER_JOUR_JUMP,
  SIGNATURE_MIN_PIECES,
  SIGNATURE_SHARE_MAX,
  SIGNATURE_SHARE_MIN,
  THEME_MECHANIC,
  buildModule,
  dailyLevel,
  dailyLevelId,
  dailyProblems,
  fallbackLevel,
  jumpThemeForDay,
  mechanicOf,
  moduleDef,
  moduleSolutions,
  variantExigence,
  variantTheme,
  type JumpThemeName,
} from "../src/index";

// Lot 11 — le thème est une donnée du générateur : il décide des morceaux permis et du quota de signature (la mécanique de son thème) ; lot 12 :
// nuit (blocs clignotants) et néon (blocs alternés) ont la leur.

const lot9 = JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/themes-lot9.json"), "utf8")) as { first: number; count: number; names: string };
const DATES = Array.from({ length: 60 }, (_, k) => PREMIER_JOUR_JUMP + k);

describe("jumpThemeForDay (socle)", () => {
  it("donne, date par date, exactement les thèmes du lot 9 (400 dates, référence figée avant le changement)", () => {
    const expected = lot9.names.split(" ");
    expect(expected).toHaveLength(400);
    expect(lot9.count).toBe(400);
    for (let k = 0; k < 400; k++) expect(jumpThemeForDay(lot9.first + k), `jour ${lot9.first + k}`).toBe(expected[k]);
  });

  it("jamais deux jours de suite le même thème, les cinq thèmes sortent", () => {
    const seen = new Set<string>();
    for (let d = lot9.first; d < lot9.first + 400; d++) {
      expect(jumpThemeForDay(d)).not.toBe(jumpThemeForDay(d + 1));
      seen.add(jumpThemeForDay(d));
    }
    expect([...seen].sort()).toEqual([...JUMP_THEME_NAMES].sort());
  });

  it("les cinq thèmes ont une mécanique : usine (tapis), glace, nuit (clignotants, lot 12), néon (alternés, lot 12) et forêt (courants d'air, lot 13)", () => {
    expect(THEME_MECHANIC).toEqual({ usine: "tapis", glace: "glace", nuit: "clignotant", neon: "alterne", foret: "vent" });
    expect(JUMP_THEME_NAMES.filter((n) => mechanicOf(n) === null)).toEqual([]);
  });
});

describe("morceaux d'un thème", () => {
  it("un morceau `theme:` porte l'étiquette de sa mécanique, et inversement", () => {
    for (const def of MODULES) {
      // Lot 22 : l'usine a deux éléments, les tapis et les presses : l'étiquette de l'un ou de l'autre.
      expect(def.tags.includes("tapis") || def.tags.includes("presse"), def.id).toBe(def.theme === "usine");
      // Lot 24 : la glace a deux éléments, la glace au sol et les stalactites : l'étiquette de l'un ou de l'autre.
      expect(def.tags.includes("glace") || def.tags.includes("stalactite"), def.id).toBe(def.theme === "glace");
      // Lot 26 : la nuit a deux éléments, les blocs clignotants et les ponts à interrupteur : l'étiquette de l'un ou de l'autre.
      expect(def.tags.includes("clignotant") || def.tags.includes("pont"), def.id).toBe(def.theme === "nuit");
      // Lot 25 : le néon a deux éléments, les blocs alternés et les lasers : l'étiquette de l'un ou de l'autre.
      expect(def.tags.includes("alterne") || def.tags.includes("laser"), def.id).toBe(def.theme === "neon");
    }
  });

  it("au moins 6 morceaux par mécanique, dont un enchaînement long et une respiration (exigence ≤ 2 partout)", () => {
    for (const [theme, tag] of [["usine", "tapis"], ["glace", "glace"], ["nuit", "clignotant"], ["neon", "alterne"]] as const) {
      const own = MODULES.filter((m) => m.theme === theme);
      expect(own.length, theme).toBeGreaterThanOrEqual(6);
      expect(own.every((m) => m.tags.includes(tag) || (theme === "usine" && m.tags.includes("presse")) || (theme === "glace" && m.tags.includes("stalactite")) || (theme === "neon" && m.tags.includes("laser")) || (theme === "nuit" && m.tags.includes("pont")))).toBe(true);
      expect(own.some((m) => m.long), `${theme} : enchaînement long`).toBe(true);
      const rest = own.filter((m) => m.tags.includes("respiration"));
      expect(rest.length, `${theme} : respiration`).toBeGreaterThanOrEqual(1);
      for (const m of rest) for (let v = 0; v < m.variants.length; v++) expect(variantExigence(moduleSolutions(m.id, v)), `${m.id} v${v}`).toBeLessThanOrEqual(2);
    }
  });

  it("les mutateurs de surface sont réservés à leur thème : `+surface:glace` ↔ glace, `+surface:tapis:…` ↔ usine", () => {
    let glace = 0;
    let tapis = 0;
    for (const def of MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        const s = def.mutations[v]!.find((m) => m.name === "surface");
        if (!s) continue;
        expect(variantTheme(def, v), `${def.id} v${v}`).toBe(s.arg === "glace" ? "glace" : "usine");
        if (s.arg === "glace") glace++;
        else tapis++;
        // La variante convertit vraiment du sol : le niveau construit contient la surface.
        const ascii = buildModule(def.id, v).ascii;
        expect(ascii).toMatch(s.arg === "glace" ? /~/ : s.arg === "tapis:gauche" ? /\[/ : /\]/);
      }
    }
    expect(glace).toBeGreaterThanOrEqual(3);
    expect(tapis).toBeGreaterThanOrEqual(3);
  });

  it("lot 12 : les mutateurs `clignotant` et `alterne` sont réservés à nuit et néon, convertissent vraiment des blocs, et le niveau construit les contient", () => {
    let blink = 0;
    let alt = 0;
    for (const def of MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        for (const m of def.mutations[v]!) {
          if (m.name !== "clignotant" && m.name !== "alterne") continue;
          expect(variantTheme(def, v), `${def.id} v${v}`).toBe(m.name === "clignotant" ? "nuit" : "neon");
          const built = buildModule(def.id, v);
          if (m.name === "clignotant") {
            blink++;
            expect(built.level.blinks.length, `${def.id} v${v}`).toBeGreaterThan(0);
            expect(built.ascii).toMatch(/clignote /);
          } else {
            alt++;
            expect(built.level.alts.length, `${def.id} v${v}`).toBeGreaterThan(0);
          }
        }
      }
    }
    expect(blink).toBeGreaterThanOrEqual(2);
    expect(alt).toBeGreaterThanOrEqual(2);
  });

  it("une variante mutée reste dans la limite de variantes par morceau (7 depuis le lot 17 : une variante ajoutée à `scie-sol` remplace la refusée sans toucher la référence v3)", () => {
    for (const def of MODULES) expect(def.variants.length, def.id).toBeLessThanOrEqual(MAX_VARIANTS);
  });
});

describe("le niveau du jour lit le thème", () => {
  const levels = DATES.map((d) => dailyLevel(d));

  it("le thème du niveau est celui de la date ; l'identifiant est inchangé (jour-AAAA-MM-JJ-g<N>)", () => {
    for (const L of levels) {
      expect(L.theme).toBe(jumpThemeForDay(L.day));
      expect(L.forcedTheme).toBe(false);
      expect(L.id).toBe(dailyLevelId(L.day));
      expect(L.id).toMatch(/^jour-\d{4}-\d{2}-\d{2}-g\d+$/);
    }
  });

  it("les morceaux d'une mécanique ne sortent jamais hors de leur thème", () => {
    for (const L of levels) {
      for (const p of L.pieces) {
        const def = moduleDef(p.id);
        const lock = variantTheme(def, p.variant);
        if (lock !== null) expect(lock, `${L.date} ${p.id}:${p.variant}`).toBe(L.theme);
        expect(p.mechanic !== null, `${L.date} ${p.id}:${p.variant}`).toBe(lock !== null);
        if (mechanicOf(L.theme) === null) expect(p.mechanic).toBeNull();
      }
    }
    // Sur 60 jours il y a au moins un jour de chaque thème à mécanique.
    expect(levels.some((L) => L.theme === "usine")).toBe(true);
    expect(levels.some((L) => L.theme === "glace")).toBe(true);
    expect(levels.some((L) => L.theme === "nuit")).toBe(true);
    expect(levels.some((L) => L.theme === "neon")).toBe(true);
  });

  it(`quota de signature : au moins ${SIGNATURE_MIN_PIECES} morceaux de la mécanique, de ${SIGNATURE_SHARE_MIN / 10} à ${SIGNATURE_SHARE_MAX / 10} % du temps de l'auteur`, () => {
    for (const L of levels) {
      if (mechanicOf(L.theme) === null) continue;
      const mech = L.pieces.filter((p) => p.mechanic !== null);
      const t = mech.reduce((n, p) => n + (p.end - p.start), 0);
      expect(mech.length, L.date).toBeGreaterThanOrEqual(SIGNATURE_MIN_PIECES);
      expect(t * 1000, L.date).toBeGreaterThanOrEqual(SIGNATURE_SHARE_MIN * L.authorTicks);
      expect(t * 1000, L.date).toBeLessThanOrEqual(SIGNATURE_SHARE_MAX * L.authorTicks);
      expect(dailyProblems(L), L.date).toEqual([]);
    }
  });

  it("le quota est une règle de `dailyProblems` : sans mécanique dans un thème qui en a une, le niveau est refusé", () => {
    const usine = levels.find((L) => L.theme === "usine")!;
    const bare = { ...usine, pieces: usine.pieces.map((p) => ({ ...p, mechanic: null })) };
    expect(dailyProblems(bare).join(" ; ")).toMatch(/mécanique tapis/);
    const foret = levels.find((L) => L.theme === "foret")!;
    const bareForest = { ...foret, pieces: foret.pieces.map((p) => ({ ...p, mechanic: null })) };
    expect(dailyProblems(bareForest).join(" ; ")).toMatch(/mécanique vent/);
    // Lot 13 : un morceau d'une autre mécanique (un tapis en forêt) est hors de son thème, même si le quota est tenu.
    const plain = foret.pieces.findIndex((p) => p.mechanic === null);
    const stray = { ...foret, pieces: foret.pieces.map((p, k) => (k === plain ? { ...p, mechanic: "tapis" as const } : p)) };
    expect(dailyProblems(stray).join(" ; ")).toMatch(/hors de son thème/);
  });

  it("un niveau ne contient que des morceaux et des variantes de son thème (ou de tous les thèmes)", () => {
    for (const L of levels) {
      for (const p of L.pieces) {
        const def = moduleDef(p.id);
        const th = variantTheme(def, p.variant);
        expect(th === null || th === L.theme, `${L.date} ${p.id}:${p.variant}`).toBe(true);
      }
    }
  });

  it("le niveau de secours d'un thème à mécanique tient aussi le quota de signature", () => {
    for (const theme of ["usine", "glace", "nuit", "neon", "foret"] as const) {
      const day = DATES.find((d) => jumpThemeForDay(d) === theme)!;
      const f = fallbackLevel(day);
      expect(typeof f, theme).not.toBe("string");
      if (typeof f === "string") continue;
      expect(f.theme).toBe(theme);
      expect(dailyProblems(f)).toEqual([]);
    }
  });
});

describe("thème forcé = essai", () => {
  const day = DATES.find((d) => jumpThemeForDay(d) === "foret")!;

  it("forcer le thème de la date donne le niveau de la date (même identifiant, pas un essai)", () => {
    const natural = dailyLevel(day);
    const same = dailyLevel(day, natural.theme);
    expect(same.id).toBe(natural.id);
    expect(same.hash).toBe(natural.hash);
    expect(same.forcedTheme).toBe(false);
  });

  it("forcer un autre thème : identifiant suffixé -t<thème>, drapeau d'essai, morceaux de ce thème, règles tenues", () => {
    for (const forced of ["usine", "glace", "nuit", "neon"] as JumpThemeName[]) {
      const L = dailyLevel(day, forced);
      expect(L.forcedTheme).toBe(true);
      expect(L.theme).toBe(forced);
      expect(L.id).toBe(`${dailyLevelId(day)}-t${forced}`);
      expect(L.id).toBe(dailyLevelId(day, forced));
      expect(L.id).toMatch(LEVEL_ID_PATTERN);
      expect(L.date).toBe(dailyLevel(day).date);
      expect(dailyProblems(L), forced).toEqual([]);
      if (mechanicOf(forced) !== null) expect(L.pieces.filter((p) => p.mechanic !== null).length).toBeGreaterThanOrEqual(SIGNATURE_MIN_PIECES);
    }
    expect(dailyLevel(day, "usine").hash).not.toBe(dailyLevel(day).hash);
  });

  it("l'identifiant porte la version du générateur ; un thème forcé n'a pas le même identifiant que le niveau naturel", () => {
    expect(dailyLevelId(day, "usine")).not.toBe(dailyLevelId(day));
    expect(dailyLevelId(day, jumpThemeForDay(day))).toBe(dailyLevelId(day));
  });
});
