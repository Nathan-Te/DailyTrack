import { describe, expect, it } from "vitest";
import {
  AUTHOR_MAX_MS,
  AUTHOR_MIN_MS,
  FIGURES_LOT58,
  SALON_SEED_BASE,
  THEMES,
  THEME_NAMES,
  dailyCircuit,
  fauteEffets,
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
import { jourAbsentDuRegistre } from "./versions";

// Lot 58 : le générateur v22 (les familles de blocs nouveaux gardées par Nathan, pondérées par thème, et leurs règles d'équité) sur soixante circuits par
// thème, sur de vrais jours (le thème de chaque jour est celui que la v22 lui donne), à partir du premier jour que le registre ne fige pas.
export const V22 = 22;
export const PER_THEME = 60;

/** Les `n` premiers jours de chaque thème à partir du premier jour absent du registre (jours consécutifs d'un thème compris). */
export function themeDays(n: number): Map<ThemeName, number[]> {
  const out = new Map<ThemeName, number[]>(THEME_NAMES.map((t) => [t, []]));
  for (let d = jourAbsentDuRegistre(); [...out.values()].some((l) => l.length < n); d++) {
    const l = out.get(themeForDay(d, V22).name)!;
    if (l.length < n) l.push(d);
  }
  return out;
}

const circuits = new Map<string, DailyCircuit>();
export const genMs = new Map<string, number>();
/** Le circuit du jour en version `g` (gardé : chaque fichier de test le calcule une fois), et son temps de génération. */
export const circuit = (day: number, g = V22): DailyCircuit => {
  const k = `${g}:${day}`;
  let c = circuits.get(k);
  if (!c) {
    const t0 = performance.now();
    circuits.set(k, (c = dailyCircuit(day, 0, null, g)));
    genMs.set(k, performance.now() - t0);
  }
  return c;
};
export const names = (c: DailyCircuit) => c.figures.map((f) => f.name);
const avecBloc = (c: DailyCircuit) => names(c).some((n) => FIGURES_LOT58.includes(n));

export function suiteBlocs(THEMES_DU_FICHIER: readonly ThemeName[]) {
  const DAYS = themeDays(PER_THEME);
  describe(`lot 58 : générateur v22, soixante circuits par thème (${THEMES_DU_FICHIER.join(", ")})`, () => {
    for (const theme of THEMES_DU_FICHIER) {
      it(`${theme} : ${PER_THEME} circuits validés par le pilote dans la fenêtre 30–40 s, or sous 45 s, identifiant -g22, règles d'équité tenues`, () => {
        for (const day of DAYS.get(theme)!) {
          const c = circuit(day);
          expect(c.fallback, formatDay(day)).toBe(false);
          expect(c.track.id).toBe(`jour-${formatDay(day)}-g22`);
          expect(c.authorMs, formatDay(day)).toBeGreaterThanOrEqual(AUTHOR_MIN_MS);
          expect(c.authorMs, formatDay(day)).toBeLessThanOrEqual(AUTHOR_MAX_MS);
          expect(c.medals.gold, formatDay(day)).toBeLessThanOrEqual(45_000);
          expect(fauteEffets(c.spec.split(" ")), formatDay(day)).toBeNull();
        }
      }, 600_000);
    }

    // Part des circuits qui ont une famille nouvelle, au moins (mesuré sur ces 60 jours, README du lot : Stade 90 %, Canyon 100 %, Ville 93 %, Nuit 52 % — ses
    // circuits sont déjà longs, une figure de plus les fait souvent refuser, et le jour reprend sans elle —, Rallye ≈ 25 % : une famille, un tour sur deux).
    const PRESENCE: Partial<Record<ThemeName, number>> = { stade: 0.85, canyon: 0.9, ville: 0.75, nuit: 0.4, rallye: 0.15 };
    it("on croise les blocs nouveaux : un thème qui en exige (`blocs`) en a dans la part mesurée de ses circuits ; un thème où ils sont vedettes les a le jour de leur vedette ; les autres n'en ont jamais", () => {
      for (const theme of THEMES_DU_FICHIER) {
        const t = themeOfVersion(THEMES[theme], V22);
        const days = DAYS.get(theme)!;
        const part = days.filter((d) => avecBloc(circuit(d))).length / days.length;
        if (t.figures.blocs) expect(part, `${theme} ${part.toFixed(2)}`).toBeGreaterThanOrEqual(PRESENCE[theme]!);
        else if (t.figures.vedettes?.some((v) => FIGURES_LOT58.includes(v))) {
          for (const d of days) if (FIGURES_LOT58.includes(vedetteOf(t, themeOccurrence(d, theme, V22))!)) expect(avecBloc(circuit(d)), formatDay(d)).toBe(true);
        } else expect(part, theme).toBe(0);
      }
    });

    it("chaque famille nouvelle se génère dans chacun de ses thèmes, et jamais ailleurs", () => {
      for (const nom of FIGURES_LOT58) {
        const only = figureByName(nom)!.only as readonly ThemeName[];
        for (const theme of THEMES_DU_FICHIER) {
          const vue = DAYS.get(theme)!.some((d) => names(circuit(d)).includes(nom));
          expect(vue, `${nom} (${theme})`).toBe(only.includes(theme));
        }
      }
    });

    if (THEMES_DU_FICHIER.includes("stade"))
      it("le Salon suit la même version : dix sessions de suite, chacune un circuit validé", () => {
        for (let s = 0; s < 10; s++) {
          const seed = SALON_SEED_BASE + 2_958_000 + s;
          const theme = THEMES[THEME_NAMES[s % THEME_NAMES.length]!];
          expect(generateCircuit(seed, theme, 0, `salon-${s}`, V22), `session ${s}`).not.toBeNull();
        }
      }, 120_000);
  });
}
