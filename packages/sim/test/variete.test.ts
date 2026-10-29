import { describe, expect, it } from "vitest";
import {
  GENERATOR_RYTHMES,
  GENERATOR_VERSION,
  MOTIF_BOOST_SERRE,
  RYTHMES,
  RYTHME_DOMINANT,
  THEME_NAMES,
  approachAfter,
  brakingDeficit,
  dailyCircuit,
  daysFromCivil,
  distanceProfils,
  elementsOf,
  formatDay,
  longestFreeStraight,
  motifs,
  motifsBoostSerre,
  parseToken,
  profilCircuit,
  rythmeDuJour,
  themeForDay,
  vecteurProfil,
  type DailyCircuit,
} from "../src/index";
import { jourAbsentDuRegistre } from "./helpers/versions";

// Lot V2 (Track) — variété des circuits : la mesure (`variete.ts`), les rythmes (`rythmes.ts`) et les règles du générateur v21 sur 200 jours. Les jours de mesure sont loin
// devant (à partir du 01/01/2028) avec la version imposée : le registre des jours ne les nommera pas avant longtemps, le résultat ne bouge pas d'une mise en production à l'autre.
// Plafonds et chiffres : `docs/track/variete.md` (la mesure, `npm run mesure-circuits`) et le README du lot.

/** Plafond de fréquence d'une suite de trois éléments (part des circuits qui la contiennent), sur 200 jours. Mesuré : 35 % au plus en v21, 44 % en v20 (voir le README du lot). */
export const PLAFOND_SUITE_3 = 0.4;
const DEBUT = daysFromCivil(2028, 1, 1);
const JOURS = 200;

describe("mesure de la variété (variete.ts)", () => {
  it("compte le motif « boost → longue ligne droite → virage serré » une fois par virage serré", () => {
    expect(motifsBoostSerre("S P S S S L S".split(" "))).toBe(1);
    expect(motifsBoostSerre("S T S S S S S R S".split(" "))).toBe(1);
    expect(motifsBoostSerre("S P D D D L S".split(" "))).toBe(1); // des pentes sont des blocs droits
    expect(motifsBoostSerre("S P S S L S".split(" "))).toBe(0); // deux droites seulement
    expect(motifsBoostSerre("S P S S S L2 S".split(" "))).toBe(0); // un virage large
    expect(motifsBoostSerre("S S S S L S".split(" "))).toBe(0); // sans poussée
    expect(motifsBoostSerre("S P S S S K GD S L".split(" "))).toBe(0); // un saut coupe la ligne droite
    expect(motifsBoostSerre("S P S S S L S P S/t S/~h S@cp R S".split(" "))).toBe(2);
  });

  it("lit les éléments d'un circuit et ses motifs de deux et trois éléments", () => {
    expect(elementsOf("S/n@start S P S S S L S U U S D D K GD S V V V S L2/b S@finish")).toEqual(["droite", "boost", "longue", "serré", "droite", "montée", "droite", "descente", "saut", "droite", "cuve", "droite", "relevé"]);
    expect([...motifs("S@start P S S S L S L2 S@finish", 3)]).toEqual([MOTIF_BOOST_SERRE, "longue → serré → large"]);
    expect(motifs("S@start P S S S L S@finish", 2)).toEqual(new Set(["boost → longue", "longue → serré"]));
  });

  it("dresse le profil d'un circuit et mesure une distance entre deux profils", () => {
    const p = profilCircuit("S/e@start S S S L2 S/e>n L S P S S S S R3 U D S/~v S/o S@finish");
    expect(p.virages).toBe(3);
    expect(p.partSerres).toBeCloseTo(1 / 3);
    expect(p.rayonMoyen).toBeCloseTo((48 + 16 + 80) / 3);
    expect(p.changements).toBe(1); // L2, L, R3 : un seul changement de sens
    expect(p.droiteMax).toBe(6); // S P S S S S : la plaque est un bloc droit
    expect(p.denivele).toBe(4);
    expect(p.ouverte).toBeGreaterThan(0);
    const v = vecteurProfil(p, 35_000);
    expect(v.every((x) => x >= 0 && x <= 1)).toBe(true);
    expect(distanceProfils(v, v)).toBe(0);
    expect(distanceProfils(v, v.map(() => 0))).toBeGreaterThan(0);
  });

  it("la ligne droite libre ne compte ni le dégagement d'une poussée, d'un saut ou d'une cuve, ni l'élan d'une rampe", () => {
    expect(longestFreeStraight("S L S S S S R".split(" "))).toBe(4);
    expect(longestFreeStraight("S P S S S S R".split(" "))).toBe(1);
    expect(longestFreeStraight("S K GD D S S S S R".split(" "))).toBe(0);
    expect(longestFreeStraight("L S S S S K GD".split(" "))).toBe(0);
    expect(longestFreeStraight("V V S S S S L".split(" "))).toBe(0);
  });
});

describe("rythmes (rythmes.ts)", () => {
  const absent = jourAbsentDuRegistre();
  it("un jour d'une version d'avant n'a pas de rythme ; la dernière version en a un, tiré de la graine", () => {
    expect(rythmeDuJour(absent, GENERATOR_RYTHMES - 1)).toBeNull();
    expect(GENERATOR_VERSION).toBeGreaterThanOrEqual(GENERATOR_RYTHMES);
    expect(RYTHMES).toContain(rythmeDuJour(absent));
    expect(rythmeDuJour(absent)).toBe(rythmeDuJour(absent));
  });

  it("jamais deux jours de suite le même rythme, chacun au moins un jour sur huit (« mixte » un sur seize), le rythme dominant d'un biome plus souvent que les autres", () => {
    const n = 800;
    const suite = Array.from({ length: n }, (_, i) => rythmeDuJour(absent + i)!);
    for (let i = 1; i < n; i++) expect(suite[i], formatDay(absent + i)).not.toBe(suite[i - 1]);
    // « mixte » cède sa place au rythme dominant du biome quand il le peut : il sort moins souvent que les autres.
    for (const r of RYTHMES) expect(suite.filter((x) => x === r).length, r).toBeGreaterThan(r === "mixte" ? n / 16 : n / 8);
    // Le rythme dominant de chaque biome (sauf « mixte ») : ensemble, plus d'un jour du biome sur quatre (1/5 sans la règle ; mesuré sur ces 800 jours : 0,29).
    let dom = 0;
    let total = 0;
    suite.forEach((r, i) => {
      const d = RYTHME_DOMINANT[themeForDay(absent + i).name];
      if (d === "mixte") return;
      total++;
      if (r === d) dom++;
    });
    expect(dom / total).toBeGreaterThan(0.25);
  });

  it("le premier jour de la v21 n'est jamais rapide (la veille, d'une version d'avant, a pu avoir le motif)", () => {
    // Le registre nomme les jours servis avec une version d'avant : le premier jour qu'il ne nomme pas suit un jour « ancien ».
    expect(rythmeDuJour(absent)).not.toBe("rapide");
  });
});

describe("générateur v21 sur 200 jours : motifs plafonnés", () => {
  const circuits: DailyCircuit[] = [];
  const get = (): DailyCircuit[] => {
    if (circuits.length === 0) for (let i = 0; i < JOURS; i++) circuits.push(dailyCircuit(DEBUT + i, 0, null, GENERATOR_VERSION));
    return circuits;
  };

  it("le motif « boost → longue ligne droite → virage serré » : au plus une fois par circuit, un jour rapide seulement, jamais deux jours de suite", { timeout: 300_000 }, () => {
    const cs = get();
    let avec = 0;
    for (let i = 0; i < cs.length; i++) {
      const c = cs[i]!;
      expect(c.fallback, c.date).toBe(false);
      const m = motifsBoostSerre(c.spec.split(" "));
      expect(m, c.spec).toBeLessThanOrEqual(1);
      if (m > 0) {
        avec++;
        expect(rythmeDuJour(c.day, GENERATOR_VERSION, c.theme), c.date).toBe("rapide");
        if (i > 0) expect(motifsBoostSerre(cs[i - 1]!.spec.split(" ")), `${cs[i - 1]!.date} puis ${c.date}`).toBe(0);
      }
    }
    // Il existe encore (un jour rapide sur deux environ) : il n'est pas interdit, il est rare.
    expect(avec).toBeGreaterThan(5);
    expect(avec / cs.length).toBeLessThan(0.2);
  });

  it("quand le motif apparaît, sa zone de freinage est lisible : le virage se freine à temps, sur une route sans revêtement, sans bosses ni bord ouvert", { timeout: 300_000 }, () => {
    for (const c of get()) {
      const tokens = c.spec.split(" ");
      for (let i = 0; i < tokens.length; i++) {
        const p = parseToken(tokens[i]!);
        if (p.kind !== "curveL" && p.kind !== "curveR") continue;
        if (motifsBoostSerre(tokens.slice(0, i + 1)) === motifsBoostSerre(tokens.slice(0, i))) continue;
        expect(brakingDeficit(approachAfter(tokens.slice(0, i)), tokens[i]!), `${c.date} @${i}`).toBeLessThanOrEqual(0);
        for (let j = i - 1; j >= 0 && !/^[PT](\/|@|$)/.test(tokens[j]!); j--) {
          const a = parseToken(tokens[j]!);
          expect(a.surface === "road" && !a.bumpy && !a.open, `${c.date} @${j} : ${tokens[j]}`).toBe(true);
        }
      }
    }
  });

  it(`aucune suite de trois éléments dans plus de ${PLAFOND_SUITE_3 * 100} % des circuits`, { timeout: 300_000 }, () => {
    const cs = get();
    const n = new Map<string, number>();
    for (const c of cs) for (const s of motifs(c.spec, 3)) n.set(s, (n.get(s) ?? 0) + 1);
    for (const [s, k] of n) expect(k / cs.length, s).toBeLessThanOrEqual(PLAFOND_SUITE_3);
    expect(n.get(MOTIF_BOOST_SERRE) ?? 0).toBeLessThan(0.2 * cs.length);
  });

  it("deux jours qui se suivent ont toujours des profils différents", { timeout: 300_000 }, () => {
    const cs = get();
    for (let i = 1; i < cs.length; i++) {
      const a = vecteurProfil(profilCircuit(cs[i - 1]!.spec), cs[i - 1]!.authorMs);
      const b = vecteurProfil(profilCircuit(cs[i]!.spec), cs[i]!.authorMs);
      expect(distanceProfils(a, b), cs[i]!.date).toBeGreaterThan(0.03);
    }
  });
});
