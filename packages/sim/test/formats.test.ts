import { describe, expect, it } from "vitest";
import {
  DEFAULT_PEAK,
  THEMES,
  THEME_NAMES,
  bestPilotRun,
  circuitFingerprint,
  clearAxes,
  dailyCircuit,
  daysFromCivil,
  fingerprintDistance,
  formatViolations,
  isCurve,
  isWide,
  meanFingerprint,
  parseTrack,
  shapeFingerprint,
  trackJumps,
  type DailyCircuit,
  type Fingerprint,
  type ThemeName,
} from "../src/index";

// Lot 25 : fiches de format par thème, et les écarts qu'elles promettent (seuils recopiés dans docs/lots/lot-25-formats.md).

const JOUR = daysFromCivil(2026, 10, 6);
const PER_THEME = 6;
const cache = new Map<string, { c: DailyCircuit; f: Fingerprint }>();
function sample(theme: ThemeName, n = PER_THEME): { c: DailyCircuit; f: Fingerprint }[] {
  const out = [];
  for (let d = 0; d < n; d++) {
    const key = `${theme}:${d}`;
    let e = cache.get(key);
    if (!e) {
      const c = dailyCircuit(JOUR + d, 0, theme);
      e = { c, f: circuitFingerprint(c.track, bestPilotRun(c.track)!) };
      cache.set(key, e);
    }
    out.push(e);
  }
  return out;
}

describe("fiches de format", () => {
  it("chaque thème a sa fiche : bornes ordonnées, une phrase, des hauteurs qui contiennent le départ", () => {
    for (const name of THEME_NAMES) {
      const f = THEMES[name].format;
      expect(f.summary.length, name).toBeGreaterThan(20);
      for (const [lo, hi] of [f.heights, f.net, f.relief, f.turns, f.speed.mean, f.jumps.count]) expect(lo, name).toBeLessThanOrEqual(hi);
      expect(f.heights[0]).toBeLessThanOrEqual(0);
      expect(f.heights[1]).toBeGreaterThanOrEqual(0);
    }
  });

  it("les quatre formats demandés sont écrits dans la fiche", () => {
    const { rallye, canyon, banquise, col } = THEMES;
    // Rallye — la spéciale
    expect(rallye.format.width.main).toBe("e");
    expect(rallye.format.straight).toBeLessThanOrEqual(3);
    expect(rallye.format.turbos).toBe(0);
    expect(rallye.format.pads).toBeLessThanOrEqual(1);
    expect(rallye.format.jumps.count).toEqual([0, 0]);
    expect(rallye.format.relief[1]).toBeLessThanOrEqual(12);
    // Canyon — les grands espaces
    expect(canyon.format.width.main).toBe("l");
    expect(canyon.maxTight).toBe(0);
    expect(canyon.format.jumps.count[0]).toBeGreaterThanOrEqual(2);
    expect(canyon.format.jumps.longGap).toBe(2);
    expect(canyon.format.grand).toBe(true);
    // Banquise — la patinoire
    expect(banquise.format.relief[1]).toBeLessThanOrEqual(8);
    expect(banquise.format.surfaces.ice).toBeGreaterThanOrEqual(0.4);
    expect(banquise.format.jumps.count).toEqual([0, 0]);
    expect(banquise.openChance).toBe(0);
    // Col alpin — la descente
    expect(col.format.net[1]).toBeLessThanOrEqual(-40);
    expect(col.format.descent).toBeGreaterThanOrEqual(0.7);
    expect(col.format.climb).toBeLessThanOrEqual(4);
    expect(col.format.speed.peak).toBeGreaterThanOrEqual(70);
    expect(col.format.turbos).toBe(0);
    expect(col.format.finishLow).toBe(true);
    // Les quatre autres gardent la pointe exigée depuis le lot 15.
    for (const n of ["stade", "nuit", "campagne", "ville"] as const) expect(THEMES[n].format.speed.peak).toBe(DEFAULT_PEAK);
  });

  it("formatViolations nomme ce qui contredit une fiche", () => {
    const flat = parseTrack("f", "S@start S S S S S L2 S S S S S S@finish");
    expect(formatViolations(flat, THEMES.rallye.format).some((v) => v.startsWith("droite"))).toBe(true);
    expect(formatViolations(flat, THEMES.col.format).some((v) => v.startsWith("dénivelé net"))).toBe(true);
    expect(formatViolations(flat, THEMES.banquise.format).some((v) => v.startsWith("ice"))).toBe(true);
    expect(formatViolations(flat, THEMES.canyon.format).some((v) => v.includes("saut"))).toBe(true);
  });
});

describe("circuits des quatre formats (6 dates chacun, thème imposé)", { timeout: 300_000 }, () => {
  it("chaque circuit respecte la fiche de son thème (contrôle du générateur), dans la fenêtre de durée", () => {
    for (const name of THEME_NAMES) {
      for (const { c } of sample(name, name === "rallye" || name === "canyon" || name === "banquise" || name === "col" ? PER_THEME : 3)) {
        expect(c.fallback, `${name} ${c.date}`).toBe(false);
        expect(formatViolations(c.track, THEMES[name].format), `${name} ${c.date} ${c.spec}`).toEqual([]);
        expect(c.authorMs).toBeGreaterThanOrEqual(30_000);
        expect(c.authorMs).toBeLessThanOrEqual(40_000);
      }
    }
  });

  it("Rallye : route étroite, aucune droite de plus de 3 blocs, ni vide, ni super turbo, au plus une plaque, la terre", () => {
    for (const { c, f } of sample("rallye")) {
      const kinds = c.track.blocks.map((b) => b.kind);
      expect(f.straight, c.spec).toBeLessThanOrEqual(3);
      expect(kinds.filter((k) => k === "turbo").length, c.spec).toBe(0);
      expect(kinds.filter((k) => k === "boost").length, c.spec).toBeLessThanOrEqual(1);
      expect(kinds.includes("gap") || kinds.includes("kick"), c.spec).toBe(false);
      expect(f.mainWidth, c.spec).toBe(14);
      expect(f.surfaces.dirt, c.spec).toBeGreaterThanOrEqual(0.3);
      expect(c.track.blocks.some((b) => b.bumpy), c.spec).toBe(true);
    }
  });

  it("Canyon : route large, aucun virage serré, deux sauts au-dessus du vide dont un long, des courbes amples", () => {
    for (const { c, f } of sample("canyon")) {
      expect(c.track.blocks.some((b) => isCurve(b.kind) && !isWide(b.kind)), c.spec).toBe(false);
      const jumps = trackJumps(c.track);
      expect(jumps.length, c.spec).toBeGreaterThanOrEqual(2);
      expect(Math.max(...jumps.map((j) => j.gapCells)), c.spec).toBe(2);
      expect(f.mainWidth, c.spec).toBe(26);
      expect(c.track.blocks.some((b) => b.kind === "wideL" || b.kind === "wideR"), c.spec).toBe(false); // les virages larges sont devenus amples
    }
  });

  it("Banquise : 8 m d'amplitude au plus, glace sur 40 % de la longueur au moins, aucun vide", () => {
    for (const { c, f } of sample("banquise")) {
      expect(f.relief, c.spec).toBeLessThanOrEqual(8);
      expect(f.surfaces.ice, c.spec).toBeGreaterThanOrEqual(0.4);
      expect(c.track.blocks.some((b) => b.kind === "gap" || b.open), c.spec).toBe(false);
    }
  });

  it("Col alpin : départ en haut, arrivée en bas, −40 m au moins, 70 % en descente, aucune montée de plus d'un niveau, plus de 70 m/s sans super turbo", () => {
    for (const { c, f } of sample("col")) {
      expect(f.net, c.spec).toBeLessThanOrEqual(-40);
      expect(f.descent, c.spec).toBeGreaterThanOrEqual(0.7);
      expect(f.climb, c.spec).toBeLessThanOrEqual(4);
      expect(Math.max(...c.track.blocks.map((b) => b.y0)), c.spec).toBeLessThanOrEqual(4); // rien au-dessus du départ (à un niveau près)
      const last = c.track.blocks[c.track.blocks.length - 1]!;
      expect(last.y0 - Math.min(...c.track.blocks.map((b) => Math.min(b.y0, b.y0 + b.rise))), c.spec).toBeLessThanOrEqual(4);
      expect(c.track.blocks.some((b) => b.kind === "turbo"), c.spec).toBe(false);
      expect(f.peakSpeed, c.spec).toBeGreaterThan(70);
      expect(f.peakSpeed, c.spec).toBeLessThan(88); // sous la vitesse des tests anti-traversée (vitesse.test.ts)
      expect(c.track.blocks.some((b) => b.open), c.spec).toBe(true); // au-dessus du vide, sans rebord
    }
  });
});

describe("écarts tenus (empreinte, 6 circuits par thème)", { timeout: 300_000 }, () => {
  it("Rallye et Canyon diffèrent nettement sur au moins quatre axes (largeur, virages / 100 m, plus longue droite, vitesse moyenne, temps en l'air)", () => {
    const r = meanFingerprint(sample("rallye").map((e) => e.f));
    const c = meanFingerprint(sample("canyon").map((e) => e.f));
    const axes = clearAxes(r, c, ["width", "turns", "straight", "meanSpeed", "air"]);
    console.info(`[formats] Rallye / Canyon : ${axes.join(", ")}`);
    expect(axes.length).toBeGreaterThanOrEqual(4);
    expect(c.meanSpeed! - r.meanSpeed!).toBeGreaterThan(8);
    expect(r.turns! / c.turns!).toBeGreaterThan(2.5);
  });

  it("Col alpin et Banquise diffèrent nettement sur au moins quatre axes (dénivelé net, part en descente, pointe, glace, roue libre)", () => {
    const col = meanFingerprint(sample("col").map((e) => e.f));
    const ban = meanFingerprint(sample("banquise").map((e) => e.f));
    const axes = clearAxes(col, ban, ["net", "descent", "peakSpeed", "ice", "coasts"]);
    console.info(`[formats] Col / Banquise : ${axes.join(", ")}`);
    expect(axes.length).toBeGreaterThanOrEqual(4);
    expect(col.net!).toBeLessThan(-100);
    expect(ban.ice! - col.ice!).toBeGreaterThan(0.3);
  });

  it("le Canyon est le thème le plus rapide en moyenne avec le Col, et celui où l'on passe le plus de temps en l'air", () => {
    const m = Object.fromEntries((["rallye", "canyon", "banquise", "col"] as const).map((n) => [n, meanFingerprint(sample(n).map((e) => e.f))]));
    expect(m.canyon!.meanSpeed!).toBeGreaterThan(m.rallye!.meanSpeed! + 8);
    expect(m.canyon!.meanSpeed!).toBeGreaterThan(m.banquise!.meanSpeed! + 8);
    expect(m.col!.meanSpeed!).toBeGreaterThan(m.rallye!.meanSpeed!);
    for (const n of ["rallye", "banquise", "col"] as const) expect(m.canyon!.air!, n).toBeGreaterThan(m[n]!.air!);
  });

  it("les quatre thèmes reformés sont loin les uns des autres (distance d'empreinte > 1)", () => {
    const names = ["rallye", "canyon", "banquise", "col"] as const;
    const m = Object.fromEntries(names.map((n) => [n, meanFingerprint(sample(n).map((e) => e.f))]));
    for (const a of names) for (const b of names) if (a < b) expect(fingerprintDistance(m[a]!, m[b]!), `${a}–${b}`).toBeGreaterThan(1);
  });
});

describe("empreinte du tracé", () => {
  it("compte la longueur, la descente (virages en pente compris), la plus longue droite et les virages par 100 m", () => {
    const f = shapeFingerprint(parseTrack("e", "S@start D D L2/d S S S S@finish"));
    expect(f.net).toBe(-12);
    expect(f.relief).toBe(12);
    expect(f.straight).toBe(4);
    const arc = (Math.PI / 2) * 48;
    expect(f.length).toBeCloseTo(7 * 32 + arc, 6);
    expect(f.descent).toBeCloseTo((2 * 32 + arc) / (7 * 32 + arc), 6);
    expect(f.turns).toBeCloseTo(100 / (7 * 32 + arc), 6);
  });
});
