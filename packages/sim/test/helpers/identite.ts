import { describe, expect, it } from "vitest";
import {
  AUTHOR_MAX_MS,
  AUTHOR_MIN_MS,
  BASCULE_LOT_49,
  FIGURES_LOT49,
  SALON_SEED_BASE,
  THEMES,
  THEME_NAMES,
  TURBO_FIGURES,
  dailyCircuit,
  enchainementsCommuns,
  figureByName,
  formatDay,
  generateCircuit,
  themeForDay,
  themeOccurrence,
  themeOfVersion,
  vedetteOf,
  type DailyCircuit,
  type ThemeName,
} from "../../src/index";

// Lot 49 : le générateur v18 (fiches d'identité des thèmes, douze nouvelles figures, variété garantie). Mesures de référence et cible : README du lot
// (`docs/lots/lot-49-identite-gameplay.md`) ; la même mesure, plus complète : `IDENTITE=1 npm run measure:generator` (section 5).
export const PER_THEME = 60;

/** Les `n` premiers jours de chaque thème à partir de la bascule, en marchant de jour en jour (de vrais jours : les jours consécutifs d'un thème en font partie). */
export function themeDays(n: number): Map<ThemeName, number[]> {
  const out = new Map<ThemeName, number[]>(THEME_NAMES.map((t) => [t, []]));
  for (let d = BASCULE_LOT_49; [...out.values()].some((l) => l.length < n); d++) {
    const l = out.get(themeForDay(d).name)!;
    if (l.length < n) l.push(d);
  }
  return out;
}

const circuits = new Map<number, DailyCircuit>();
export const genMs = new Map<number, number>();
export const v18 = (day: number) => {
  let c = circuits.get(day);
  if (!c) {
    const t0 = performance.now();
    circuits.set(day, (c = dailyCircuit(day)));
    genMs.set(day, performance.now() - t0);
  }
  return c;
};
export const names = (c: DailyCircuit) => c.figures.map((f) => f.name);

export function suiteIdentite(THEMES_DU_FICHIER: readonly ThemeName[]) {
  const DAYS = themeDays(PER_THEME);
  describe(`lot 49 : générateur v18, soixante circuits par thème après la bascule (${THEMES_DU_FICHIER.join(", ")})`, () => {
  for (const theme of THEMES_DU_FICHIER) {
    it(`${theme} : ${PER_THEME} circuits validés par le pilote dans la fenêtre 30–40 s, or sous 45 s, identifiant -g18`, () => {
      for (const day of DAYS.get(theme)!) {
        const c = v18(day);
        expect(c.fallback, formatDay(day)).toBe(false);
        expect(c.track.id).toBe(`jour-${formatDay(day)}-g18`);
        expect(c.authorMs, formatDay(day)).toBeGreaterThanOrEqual(AUTHOR_MIN_MS);
        expect(c.authorMs, formatDay(day)).toBeLessThanOrEqual(AUTHOR_MAX_MS);
        // La course correcte (lot 35 : l'or) tient en 30–45 s : l'or est sous le temps du pilote.
        expect(c.medals.gold, formatDay(day)).toBeLessThanOrEqual(45_000);
      }
    }, 300_000);
  }

  it("chaque nouvelle figure se génère : dans les circuits de chacun de ses thèmes (ou d'au moins un de ces thèmes, si elle est de tous)", () => {
    for (const nom of FIGURES_LOT49) {
      const only = figureByName(nom)!.only as readonly ThemeName[] | undefined;
      const themes = (only ?? THEME_NAMES).filter((t) => THEMES_DU_FICHIER.includes(t));
      if (themes.length === 0) continue;
      const vus = themes.filter((t) => DAYS.get(t)!.some((d) => names(v18(d)).includes(nom)));
      if (only) expect(vus, nom).toEqual(themes);
      else expect(vus.length, nom).toBeGreaterThanOrEqual(1);
    }
  });

  it("la vedette du jour est toujours là, et jamais celle de l'apparition d'avant ni d'après (une vedette par circuit, à tour de rôle)", () => {
    for (const theme of THEMES_DU_FICHIER) {
      const t = themeOfVersion(THEMES[theme], 18);
      for (const day of DAYS.get(theme)!) {
        const k = themeOccurrence(day, theme);
        const figs = names(v18(day));
        expect(figs, formatDay(day)).toContain(vedetteOf(t, k));
        for (const autre of t.figures.vedettes!) if (autre !== vedetteOf(t, k)) expect(figs, formatDay(day)).not.toContain(autre);
      }
    }
  });

  it("variété garantie : deux circuits consécutifs d'un même thème ne partagent aucun enchaînement de deux figures, ni leur vedette", () => {
    for (const theme of THEMES_DU_FICHIER) {
      const days = DAYS.get(theme)!;
      for (let i = 1; i < days.length; i++) {
        const a = names(v18(days[i - 1]!));
        const b = names(v18(days[i]!));
        expect(themeOccurrence(days[i]!, theme)).toBe(themeOccurrence(days[i - 1]!, theme) + 1);
        expect(enchainementsCommuns(a, b), `${formatDay(days[i - 1]!)} → ${formatDay(days[i]!)}`).toEqual([]);
      }
    }
  });

  it("un thème sans super turbo (Rallye, Banquise, Campagne) n'en pose aucun, ni aucune figure à super turbo", () => {
    for (const theme of THEMES_DU_FICHIER.filter((t) => THEMES[t].turboChance === 0)) {
      for (const day of DAYS.get(theme)!) {
        const c = v18(day);
        expect(c.spec.split(" ").some((t) => /^T(\/|@|$)/.test(t)), formatDay(day)).toBe(false);
        for (const f of TURBO_FIGURES) expect(names(c), formatDay(day)).not.toContain(f);
      }
    }
  });

  if (THEMES_DU_FICHIER.includes("stade")) it("le Salon suit la même version : dix sessions de suite, chacune un circuit validé", () => {
    for (let s = 0; s < 10; s++) {
      const seed = SALON_SEED_BASE + 2_946_000 + s;
      const theme = THEMES[THEME_NAMES[s % THEME_NAMES.length]!];
      expect(generateCircuit(seed, theme, 0, `salon-${s}`), `session ${s}`).not.toBeNull();
    }
  }, 120_000);
});
}
