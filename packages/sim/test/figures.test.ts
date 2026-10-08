import { describe, expect, it } from "vitest";
import {
  FIGURES,
  FIGURE_CATEGORIES,
  FIGURE_NAMES,
  MAX_PLAIN_STRAIGHT,
  MIN_RELIEF,
  SIGNATURE_FIGURE,
  THEMES,
  THEME_NAMES,
  bestPilotRun,
  buildFigure,
  composeFigures,
  createFigureTrack,
  createFiguresTrack,
  dailyCircuit,
  daysFromCivil,
  estimateSeconds,
  figureByName,
  figureSeconds,
  isCurve,
  isRested,
  isWide,
  longestPlainStraight,
  parseTrack,
  reach,
  reliefOf,
  themeForDay,
  widthAfter,
  type DailyCircuit,
  type Figure,
  type WidthLetter,
} from "../src/index";

// Lot 20 : la bibliothèque de figures et le générateur qui les assemble.
const JOUR_TEST = daysFromCivil(2026, 10, 6);
const DAYS = Array.from({ length: 60 }, (_, i) => JOUR_TEST + i);

const circuits = new Map<number, DailyCircuit>();
const circuit = (day: number) => {
  let c = circuits.get(day);
  if (!c) circuits.set(day, (c = dailyCircuit(day)));
  return c;
};
const isFast = (f: Figure) => f.category === "rapide" || !!f.turbo;

/** Le cadre d'essai d'une figure : départ, cinq droites de lancement, la figure, arrivée. */
function frame(f: Figure, left: boolean, width: WidthLetter, variant: number): string | null {
  const body = buildFigure(f, left, width, variant);
  if (!body) return null;
  const tokens = [`S/${width}@start`, "S", "S", "S", "S", "S", ...(body[0] === "S" ? body.slice(1) : body), "S", "S@finish"];
  const cut = tokens.indexOf("C");
  if (cut >= 0) tokens[cut + 2] = "S@cp";
  return tokens.join(" ");
}

describe("bibliothèque de figures", () => {
  it("compte au moins vingt figures, de noms uniques, avec une catégorie, une intention et des variantes", () => {
    expect(FIGURES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(FIGURE_NAMES).size).toBe(FIGURES.length);
    for (const f of FIGURES) {
      expect(f.name, f.name).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(FIGURE_CATEGORIES).toContain(f.category);
      expect(f.intent.length, f.name).toBeGreaterThan(20);
      expect(f.label.length).toBeGreaterThan(2);
      expect(f.variants, f.name).toBeGreaterThanOrEqual(1);
    }
  });

  it("couvre les quatre familles du lot : techniques, sauts techniques, portions rapides, combinaisons (et les cuves et reliefs)", () => {
    const by = (c: string) => FIGURES.filter((f) => f.category === c).length;
    expect(by("technique")).toBeGreaterThanOrEqual(10);
    expect(by("saut")).toBeGreaterThanOrEqual(8);
    expect(by("rapide")).toBeGreaterThanOrEqual(3);
    expect(by("combo")).toBeGreaterThanOrEqual(3);
    expect(by("cuve")).toBeGreaterThanOrEqual(3);
    expect(by("relief")).toBeGreaterThanOrEqual(2);
  });

  it("offre au moins deux sens (miroir) et plusieurs variantes pour la plupart des figures", () => {
    const withVariants = FIGURES.filter((f) => f.variants >= 2).length;
    expect(withVariants).toBeGreaterThanOrEqual(FIGURES.length - 3);
    const t = buildFigure(figureByName("slalom-route")!, true, "n", 0)!;
    const m = buildFigure(figureByName("slalom-route")!, false, "n", 0)!;
    expect(t).not.toEqual(m);
    expect(t.map((x) => x.replace("L", "r").replace("R", "L").replace("r", "R"))).toEqual(m);
  });

  it("donne à chaque thème une figure signature qui existe, et des figures favorites ou interdites qui existent", () => {
    for (const name of THEME_NAMES) {
      const theme = THEMES[name];
      expect(figureByName(SIGNATURE_FIGURE[theme.signature]), name).not.toBeNull();
      for (const f of [...theme.figures.favor, ...theme.figures.ban]) expect(figureByName(f), `${name} : ${f}`).not.toBeNull();
      expect(theme.figures.favor.filter((f) => theme.figures.ban.includes(f)), `${name} : favorite et interdite`).toEqual([]);
      expect(theme.figures.ban, `${name} interdit sa propre signature`).not.toContain(SIGNATURE_FIGURE[theme.signature]);
    }
  });

  it("n'interdit les figures de glace, de terre ou de cuve que là où le thème n'a ni glace, ni terre, ni cuve", () => {
    expect(THEMES.stade.figures.ban).toContain("slalom-glace");
    expect(THEMES.banquise.figures.favor).toContain("slalom-glace");
    expect(THEMES.rallye.figures.favor).toContain("saut-terre");
    expect(THEMES.rallye.figures.ban).toContain("cuve-droite");
    expect(THEMES.nuit.figures.favor).toContain("saut-paroi");
  });

  it("estime la durée d'une figure et d'une suite de blocs", () => {
    expect(estimateSeconds(["S", "S"])).toBeCloseTo(1.4, 5);
    expect(estimateSeconds(["L2"])).toBeGreaterThan(estimateSeconds(["S"]));
    expect(estimateSeconds(["S/g"])).toBeGreaterThan(estimateSeconds(["S"]));
    for (const f of FIGURES) expect(figureSeconds(f), f.name).toBeGreaterThan(1);
  });

  it("passe d'une largeur à l'autre un cran à la fois", () => {
    expect(reach("l", "e")).toEqual(["S/l>n", "S/n>e"]);
    expect(reach("n", "n")).toEqual([]);
    expect(widthAfter(["S", "S/n>e", "S"], "n")).toBe("e");
    expect(widthAfter(["S"], "l")).toBe("l");
  });
});

describe("chaque figure se franchit", () => {
  // Une figure qu'on ne sait pas franchir est corrigée ou retirée, pas contournée : le pilote doit finir chacune de ses variantes,
  // dans les deux sens, sur la route étroite, normale et large (quand la figure s'y adapte).
  for (const f of FIGURES) {
    it(`${f.name} (${f.variants} variante${f.variants > 1 ? "s" : ""})`, { timeout: 120_000 }, () => {
      for (let v = 0; v < f.variants; v++) {
        expect(buildFigure(f, true, "n", v), `${f.name} v${v} sur route normale`).not.toBeNull();
        for (const left of [true, false]) {
          for (const width of ["e", "n", "l"] as const) {
            if (!left && width !== "n") continue; // le miroir est testé sur la route normale seulement : même géométrie renversée
            const spec = frame(f, left, width, v);
            if (!spec) continue;
            const track = parseTrack("figure", spec);
            const pilot = bestPilotRun(track);
            expect(pilot, `${f.name} v${v} ${left ? "gauche" : "droite"} ${width} : ${spec}`).not.toBeNull();
          }
        }
      }
    });
  }
});

describe("scénarios ?scenario=figures et ?scenario=figure", () => {
  it("le tour des figures se termine, avec un point de contrôle environ tous les dix blocs, des sauts, de la glace, une cuve, un turbo et un moteur coupé", { timeout: 60_000 }, () => {
    const t = createFiguresTrack();
    expect(t.blocks.length).toBeGreaterThan(70);
    expect(bestPilotRun(t)).not.toBeNull();
    expect(t.gates.filter((g) => g.kind === "checkpoint").length).toBeGreaterThanOrEqual(7);
    expect(t.blocks.some((b) => b.kind === "gap")).toBe(true);
    expect(t.blocks.some((b) => b.surface === "ice")).toBe(true);
    expect(t.blocks.some((b) => b.cuve)).toBe(true);
    expect(t.blocks.some((b) => b.kind === "turbo")).toBe(true);
    expect(t.blocks.some((b) => b.kind === "cut")).toBe(true);
  });

  it("une figure seule : cinq droites de lancement, un point de contrôle juste avant, arrivée", () => {
    for (const f of FIGURES) {
      for (let v = 0; v < f.variants; v++) {
        for (const mirror of [false, true]) {
          const t = createFigureTrack(f.name, v, mirror);
          expect(t, `${f.name} v${v}`).not.toBeNull();
          expect(t!.blocks[0]!.mark).toBe("start");
          expect(t!.blocks[5]!.mark).toBe("checkpoint");
          expect(t!.blocks[t!.blocks.length - 1]!.mark).toBe("finish");
        }
      }
    }
  });

  it("un nom inconnu ne donne rien ; une variante hors bornes est ramenée dans les bornes", () => {
    expect(createFigureTrack("n-importe-quoi")).toBeNull();
    expect(createFigureTrack("")).toBeNull();
    const f = figureByName("pincement")!;
    expect(createFigureTrack("pincement", 99)!.blocks.length).toBe(createFigureTrack("pincement", f.variants - 1)!.blocks.length);
    expect(createFigureTrack("pincement", -3)!.blocks.length).toBe(createFigureTrack("pincement", 0)!.blocks.length);
  });

  it("le miroir échange les virages à gauche et à droite", () => {
    const a = createFigureTrack("slalom-route", 0, false)!;
    const b = createFigureTrack("slalom-route", 0, true)!;
    const sides = (t: typeof a) => t.blocks.filter((x) => isCurve(x.kind)).map((x) => (x.kind.endsWith("L") ? "L" : "R")).join("");
    expect(sides(a)).toBe("LRL");
    expect(sides(b)).toBe("RLR");
  });
});

describe("composition d'un circuit par figures", () => {
  it("assemble 5 à 7 figures, jamais deux fois la même, toutes dans la bibliothèque, sur des blocs contigus", { timeout: 180_000 }, () => {
    for (const day of DAYS) {
      const c = circuit(day);
      expect(c.fallback, `jour ${day}`).toBe(false);
      const names = c.figures.map((f) => f.name);
      expect(names.length, c.spec).toBeGreaterThanOrEqual(5);
      expect(names.length, c.spec).toBeLessThanOrEqual(7);
      expect(new Set(names).size, `figure répétée : ${names.join(" ")}`).toBe(names.length);
      for (const n of names) expect(figureByName(n), n).not.toBeNull();
      let end = 1; // le bloc 0 est le départ
      for (const f of c.figures) {
        expect(f.from, c.spec).toBeGreaterThanOrEqual(end);
        expect(f.to).toBeGreaterThan(f.from);
        end = f.to;
      }
      expect(end).toBeLessThanOrEqual(c.track.blocks.length - 1);
    }
  });

  it("contient au moins deux techniques, une portion rapide, le passage signature du thème et un dénivelé d'au moins 12 m", () => {
    for (const day of DAYS) {
      const c = circuit(day);
      const figs = c.figures.map((f) => figureByName(f.name)!);
      expect(figs.filter((f) => f.category === "technique").length, `${c.date} : ${figs.map((f) => f.name).join(" ")}`).toBeGreaterThanOrEqual(2);
      expect(figs.some(isFast), c.date).toBe(true);
      expect(c.figures.map((f) => f.name), c.date).toContain(SIGNATURE_FIGURE[THEMES[c.theme].signature]);
      expect(reliefOf(c.spec.split(" ")), c.date).toBeGreaterThanOrEqual(MIN_RELIEF);
    }
  });

  it("ne met un saut ni en première ni en dernière figure", () => {
    for (const day of DAYS) {
      const figs = circuit(day).figures.map((f) => figureByName(f.name)!);
      expect(figs[0]!.jump, circuit(day).date).toBeFalsy();
      expect(figs[figs.length - 1]!.jump, circuit(day).date).toBeFalsy();
    }
  });

  it("tient les règles de virages serrés (au plus 2, jamais deux de suite, jamais sur la route large) et de lignes droites", () => {
    for (const day of DAYS) {
      const { track, spec } = circuit(day);
      let run = 0;
      let tight = 0;
      for (const b of track.blocks) {
        const isTight = isCurve(b.kind) && !isWide(b.kind);
        if (isTight) {
          tight++;
          run++;
          expect(b.w0, spec).toBeLessThan(26);
        } else run = 0;
        expect(run, spec).toBeLessThanOrEqual(1);
      }
      expect(tight, spec).toBeLessThanOrEqual(2);
      expect(longestPlainStraight(spec.split(" ")), spec).toBeLessThanOrEqual(MAX_PLAIN_STRAIGHT);
    }
  });

  it("utilise au moins vingt figures différentes sur soixante jours", () => {
    const used = new Set(DAYS.flatMap((d) => circuit(d).figures.map((f) => f.name)));
    expect(used.size).toBeGreaterThanOrEqual(20);
  });

  it("change de figures d'un jour à l'autre : deux jours consécutifs en ont en moyenne deux au plus en commun", () => {
    const common: number[] = [];
    for (let i = 1; i < DAYS.length; i++) {
      const a = circuit(DAYS[i - 1]!).figures.map((f) => f.name);
      common.push(circuit(DAYS[i]!).figures.filter((f) => a.includes(f.name)).length);
    }
    const mean = common.reduce((x, y) => x + y, 0) / common.length;
    expect(mean).toBeLessThanOrEqual(2);
    expect(Math.max(...common)).toBeLessThanOrEqual(4);
  });

  it("estime la durée du circuit à quelques secondes près (de quoi refuser un circuit trop long sans faire rouler le pilote)", () => {
    const off = DAYS.map((d) => Math.abs(0.95 * estimateSeconds(circuit(d).spec.split(" ")) - circuit(d).authorMs / 1000));
    expect(off.filter((x) => x < 4).length / off.length).toBeGreaterThan(0.85);
  });
});

describe("rotation par jour (sans générer les jours précédents)", () => {
  it("laisse chaque jour un tiers des figures au repos, et chaque figure revient en service dès le lendemain", () => {
    for (const day of [JOUR_TEST, JOUR_TEST + 1, JOUR_TEST + 1000]) {
      const rested = FIGURE_NAMES.filter((n) => isRested(n, day));
      expect(rested.length).toBeGreaterThan(FIGURE_NAMES.length / 6);
      expect(rested.length).toBeLessThan(FIGURE_NAMES.length / 2);
    }
    for (const n of FIGURE_NAMES) {
      const week = [0, 1, 2, 3, 4, 5].map((k) => isRested(n, JOUR_TEST + k));
      expect(week.filter(Boolean).length, n).toBe(2); // une fois sur trois
      for (let k = 1; k < week.length; k++) expect(week[k] && week[k - 1], `${n} deux jours de suite au repos`).toBe(false);
    }
  });

  it("ne dépend que de la date : même résultat quel que soit l'ordre des appels", () => {
    const a = composeFigures(JOUR_TEST + 40, 0)!;
    composeFigures(JOUR_TEST + 3, 0);
    composeFigures(JOUR_TEST + 41, 0);
    const b = composeFigures(JOUR_TEST + 40, 0)!;
    expect(b.spec).toBe(a.spec);
  });

  it("respecte le repos : une figure au repos ne sert que si elle est la signature ou une figure obligatoire du thème (lot 21)", () => {
    for (const day of DAYS) {
      const c = composeFigures(day, 0);
      if (!c) continue;
      const theme = themeForDay(day);
      const exempt = [SIGNATURE_FIGURE[theme.signature], ...(theme.figures.require ?? [])];
      for (const f of c.figures) if (isRested(f.name, day)) expect(exempt, `jour ${day} : ${f.name}`).toContain(f.name);
    }
  });
});

describe("thèmes : figures favorites et interdites", () => {
  const samples = (name: (typeof THEME_NAMES)[number]) => {
    const out: string[][] = [];
    for (let d = 0; d < 80; d++) {
      const c = composeFigures(JOUR_TEST + d, 0, THEMES[name]);
      if (c) out.push(c.figures.map((f) => f.name));
    }
    return out;
  };

  for (const name of THEME_NAMES) {
    it(`${name} n'emploie jamais une figure interdite`, () => {
      const all = samples(name).flat();
      expect(all.length).toBeGreaterThan(200);
      for (const banned of THEMES[name].figures.ban) expect(all, `${name} : ${banned}`).not.toContain(banned);
    });

    it(`${name} tire ses figures favorites nettement plus souvent que les autres`, () => {
      const circuits = samples(name);
      const count = (n: string) => circuits.filter((c) => c.includes(n)).length / circuits.length;
      const theme = THEMES[name];
      const sig = SIGNATURE_FIGURE[theme.signature];
      const banned = new Set(theme.figures.ban);
      const favorites = theme.figures.favor.filter((n) => n !== sig);
      const others = FIGURE_NAMES.filter((n) => n !== sig && !banned.has(n) && !theme.figures.favor.includes(n));
      const mean = (xs: string[]) => xs.reduce((s, n) => s + count(n), 0) / xs.length;
      expect(mean(favorites), name).toBeGreaterThan(mean(others) * 1.3);
    });
  }

  it("la signature d'un thème est dans chacun de ses circuits (comme au lot 8)", () => {
    for (const name of THEME_NAMES) for (const names of samples(name).slice(0, 20)) expect(names).toContain(SIGNATURE_FIGURE[THEMES[name].signature]);
  });
});
