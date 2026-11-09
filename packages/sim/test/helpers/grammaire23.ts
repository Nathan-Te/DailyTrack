import { describe, expect, it } from "vitest";
import {
  AUTHOR_MAX_MS,
  AUTHOR_MIN_MS,
  FIGURES_LOT58,
  GENERATOR_VERSION,
  SALON_SEED_BASE,
  TECHNICITE_MAX,
  THEMES,
  THEME_NAMES,
  classerSauts,
  combinaison,
  dailyCircuit,
  elementGrammaire,
  fauteEffets,
  fauteSauts,
  figureByName,
  formatDay,
  generateCircuit,
  parseTrack,
  sautDansLAxe,
  technicite,
  themeForDay,
  type DailyCircuit,
  type ThemeName,
} from "../../src/index";
import { jourAbsentDuRegistre } from "./versions";

// Lot 57b : le générateur v23 (la grammaire des sauts et des transitions) sur soixante circuits par thème, sur de vrais jours (le thème de chaque jour est celui que la v23 lui donne),
// à partir du premier jour que le registre ne fige pas.
export const V23 = 23;
export const PER_THEME = 60;

/** Les `n` premiers jours de chaque thème à partir du premier jour absent du registre. */
export function themeDays23(n: number, g = V23): Map<ThemeName, number[]> {
  const out = new Map<ThemeName, number[]>(THEME_NAMES.map((t) => [t, []]));
  for (let d = jourAbsentDuRegistre(); [...out.values()].some((l) => l.length < n); d++) {
    const l = out.get(themeForDay(d, g).name)!;
    if (l.length < n) l.push(d);
  }
  return out;
}

const circuits = new Map<string, DailyCircuit>();
export const genMs23 = new Map<string, number>();
/** Le circuit du jour en version `g` (gardé : chaque fichier de test le calcule une fois), et son temps de génération. */
export const circuit23 = (day: number, g = V23): DailyCircuit => {
  const k = `${g}:${day}`;
  let c = circuits.get(k);
  if (!c) {
    const t0 = performance.now();
    circuits.set(k, (c = dailyCircuit(day, 0, null, g)));
    genMs23.set(k, performance.now() - t0);
  }
  return c;
};
export const noms23 = (c: DailyCircuit) => c.figures.map((f) => f.name);
/** Une figure nouvelle : une famille du lot 58 ou un élément de la grammaire du lot 57. */
export const estNouvelle = (nom: string) => FIGURES_LOT58.includes(nom) || !!figureByName(nom)?.grammaire;
export const avecNouvelle = (c: DailyCircuit) => noms23(c).some(estNouvelle);
export const sautsDe = (c: DailyCircuit) => classerSauts(parseTrack("t", c.spec));

export function suiteGrammaire(THEMES_DU_FICHIER: readonly ThemeName[]) {
  const DAYS = themeDays23(PER_THEME);
  describe(`lot 57b : générateur v23, soixante circuits par thème (${THEMES_DU_FICHIER.join(", ")})`, () => {
    for (const theme of THEMES_DU_FICHIER) {
      it(`${theme} : ${PER_THEME} circuits validés par le pilote dans la fenêtre 30–40 s, or sous 45 s, aucun circuit de secours, identifiant -g${GENERATOR_VERSION}, règles d'équité et de variété tenues`, () => {
        for (const day of DAYS.get(theme)!) {
          const c = circuit23(day);
          expect(c.fallback, formatDay(day)).toBe(false);
          expect(c.track.id).toBe(`jour-${formatDay(day)}-g${GENERATOR_VERSION}`);
          expect(c.authorMs, formatDay(day)).toBeGreaterThanOrEqual(AUTHOR_MIN_MS);
          expect(c.authorMs, formatDay(day)).toBeLessThanOrEqual(AUTHOR_MAX_MS);
          expect(c.medals.gold, formatDay(day)).toBeLessThanOrEqual(45_000);
          expect(fauteEffets(c.spec.split(" ")), formatDay(day)).toBeNull();
          // Les règles de variété : au plus un saut « droite → tremplin → axe », jamais deux sauts de même combinaison.
          expect(fauteSauts(c.spec.split(" ")), formatDay(day)).toBeNull();
          const sauts = sautsDe(c);
          expect(sauts.filter(sautDansLAxe).length, formatDay(day)).toBeLessThanOrEqual(1);
          expect(new Set(sauts.map(combinaison)).size, formatDay(day)).toBe(sauts.length);
        }
      }, 600_000);

      it(`${theme} : le budget de technicité (au plus ${TECHNICITE_MAX}) est tenu par les figures de chaque circuit`, () => {
        for (const day of DAYS.get(theme)!) {
          const total = noms23(circuit23(day)).reduce((n, nom) => n + technicite(figureByName(nom)!), 0);
          expect(total, formatDay(day)).toBeLessThanOrEqual(TECHNICITE_MAX);
        }
      });
    }

    // La présence des figures nouvelles (lots 57 et 58 réunis) : au moins 80 % des circuits de chaque thème, mesurée sur ces soixante jours (README du lot 57b).
    it("on croise des figures nouvelles dans au moins 80 % des circuits de chaque thème", () => {
      for (const theme of THEMES_DU_FICHIER) {
        const days = DAYS.get(theme)!;
        const part = days.filter((d) => avecNouvelle(circuit23(d))).length / days.length;
        expect(part, `${theme} ${(100 * part).toFixed(0)} %`).toBeGreaterThanOrEqual(0.8);
      }
    });

    it("chaque saut et chaque transition de la grammaire se génère dans chacun de ses thèmes, et jamais ailleurs", () => {
      for (const theme of THEMES_DU_FICHIER) {
        for (const d of DAYS.get(theme)!)
          for (const nom of noms23(circuit23(d))) {
            const e = figureByName(nom);
            if (e?.grammaire) expect(e.only!, `${nom} (${theme}, ${formatDay(d)})`).toContain(theme);
          }
      }
    });

    // Un saut qui demande un geste dans (presque) chaque circuit : le saut de la grammaire, ou celui de la vedette ou de la signature quand il en est un.
    // Mesuré (README du lot 57b) : 68 % au moins dans chaque thème (Campagne, le plus bas) — un thème de peu de sauts (Campagne, 40 % de chance d'en avoir un) a des circuits sans saut du
    // tout, et un jour difficile (tentatives allégées : une transition seule) n'a pas de saut de la grammaire.
    it("la plupart des circuits ont un saut qui n'est pas « droite → tremplin → axe » (65 % au moins dans chaque thème)", () => {
      for (const theme of THEMES_DU_FICHIER) {
        const days = DAYS.get(theme)!;
        const avec = days.filter((d) => sautsDe(circuit23(d)).some((s) => !sautDansLAxe(s))).length / days.length;
        expect(avec, `${theme} ${(100 * avec).toFixed(0)} %`).toBeGreaterThanOrEqual(0.65);
      }
    });

    if (THEMES_DU_FICHIER.includes("stade"))
      it("le Salon suit la même version : dix sessions de suite, chacune un circuit validé", () => {
        for (let s = 0; s < 10; s++) {
          const seed = SALON_SEED_BASE + 2_958_000 + s;
          const theme = THEMES[THEME_NAMES[s % THEME_NAMES.length]!];
          expect(generateCircuit(seed, theme, 0, `salon-${s}`, V23), `session ${s}`).not.toBeNull();
        }
      }, 120_000);
  });
}
