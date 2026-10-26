import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GENERATOR_VERSION, SIM_VERSION, dailyCircuit, generatorVersionOf, parseDay } from "../src/index";
import { versionDeReference } from "./helpers/versions";

// Circuits du jour de référence : le texte exact, le temps de l'auteur et la palette de quelques dates,
// calculés par Node. Le test navigateur (apps/web/e2e/daily.spec.ts) régénère ces circuits dans Chromium,
// Firefox et WebKit et doit retrouver exactement les mêmes : c'est ce qui garantit que tout le monde joue le
// même circuit, avec les mêmes médailles, et que le serveur validera les courses sur le même circuit.
//
// Si ce test casse, le circuit d'une date a changé : incrémenter `GENERATOR_VERSION` (ou `SIM_VERSION` si c'est
// la physique), puis régénérer : UPDATE_GOLDEN=1 npx vitest run packages/sim/test/golden-daily.test.ts
//
// Lot R11 : **chaque vecteur porte sa version du générateur** (le `trackId` du fichier : `jour-AAAA-MM-JJ-g<N>`), et le test la **impose** (`dailyCircuit(jour, 0, null, g)`) : le code
// ne connaît plus de date de bascule, le registre des jours (`jours-track.json`) ne dit la version que des jours servis. Les vecteurs d'avant la dernière version (v15 : jusqu'au
// 27/10/2026, v16 : du 28/10 au 03/11) sont les anciennes versions du générateur, gardées bit pour bit (texte, temps de l'auteur, identifiant) : **la régénération refuse de les
// réécrire**. Les autres suivent la dernière version (v18 : herbe de course du lot 48 et identité des thèmes du lot 49).
const FILE = join(import.meta.dirname, "fixtures/daily-golden.json");
const DATES = ["2026-10-06", "2026-10-07", "2026-10-08", "2026-10-21", "2026-10-27", "2026-10-28", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-08", "2026-11-10", "2026-11-15", "2026-11-16", "2026-12-10", "2026-12-25", "2027-02-28", "2028-02-29", "2030-01-01"];

interface Entry {
  date: string;
  number: number;
  attempt: number;
  spec: string;
  authorMs: number;
  palette: string;
  theme: string;
  /** Lot 34 : l'identifiant du circuit (il porte la version du générateur du jour). */
  trackId: string;
}
interface Golden {
  simVersion: number;
  generatorVersion: number;
  circuits: Entry[];
}

/** La version d'un vecteur : celle de son `trackId` dans le fichier si elle est plus ancienne que celle des golden (gelée), la dernière sinon ; une date absente du fichier : la référence. */
const versionOfEntry = (golden: Golden, date: string): number => {
  const old = golden.circuits.find((c) => c.date === date);
  if (!old) return versionDeReference(parseDay(date)!);
  const g = Number(/-g(\d+)/.exec(old.trackId)?.[1]);
  return g < golden.generatorVersion ? g : GENERATOR_VERSION;
};
const compute = (date: string, g: number): Entry => {
  const c = dailyCircuit(parseDay(date)!, 0, null, g);
  return { date, number: c.number, attempt: c.attempt, spec: c.spec, authorMs: c.authorMs, palette: c.palette, theme: c.theme, trackId: c.track.id };
};
/** Un vecteur d'une ancienne version : il ne change jamais. */
const frozen = (golden: Golden, date: string) => versionOfEntry(golden, date) < GENERATOR_VERSION;

if (process.env.UPDATE_GOLDEN) {
  const previous = JSON.parse(readFileSync(FILE, "utf8")) as Golden;
  const circuits = DATES.map((date) => {
    // Un vecteur nouveau prend la version de référence de sa date ; un vecteur du fichier garde la sienne s'il est gelé, sinon il suit la dernière.
    return compute(date, versionOfEntry(previous, date));
  });
  for (const entry of circuits) {
    const old = previous.circuits.find((c) => c.date === entry.date);
    const without = (e: Entry) => JSON.stringify({ ...e, trackId: undefined });
    if (old && frozen(previous, entry.date) && without(old) !== without(entry)) throw new Error(`le circuit du ${entry.date} (version ${versionOfEntry(previous, entry.date)}) a changé : une ancienne version ne change jamais`);
  }
  writeFileSync(FILE, JSON.stringify({ simVersion: SIM_VERSION, generatorVersion: GENERATOR_VERSION, circuits } satisfies Golden, null, 2) + "\n");
}

describe("circuits du jour de référence", () => {
  const golden = JSON.parse(readFileSync(FILE, "utf8")) as Golden;

  it("correspondent aux versions actuelles", () => {
    expect(golden.simVersion).toBe(SIM_VERSION);
    expect(golden.generatorVersion).toBe(GENERATOR_VERSION);
  });

  it("chaque vecteur porte la version de son générateur : 15 avant le 28/10/2026, 16 avant le 04/11/2026, 18 ensuite", () => {
    expect(golden.circuits.map((c) => c.date)).toEqual(DATES);
    for (const c of golden.circuits) {
      const g = versionDeReference(parseDay(c.date)!);
      expect(versionOfEntry(golden, c.date), c.date).toBe(g);
      expect(c.trackId).toBe(`jour-${c.date}-g${g}`);
    }
  });

  it("lot R11 : un jour que le registre ne nomme pas prend la dernière version, un jour qu'il nomme garde la sienne (les vecteurs d'avant le 27/10/2026 sont du registre)", () => {
    for (const c of golden.circuits) {
      const day = parseDay(c.date)!;
      const g = versionOfEntry(golden, c.date);
      if (g === GENERATOR_VERSION) expect(generatorVersionOf(day), c.date).toBe(GENERATOR_VERSION);
      else if (c.date <= "2026-10-26") expect(generatorVersionOf(day), c.date).toBe(g);
    }
  });

  it("lot 48 : les jours de Campagne de la dernière version roulent sur l'herbe de course, aucun vecteur d'une ancienne version n'en a", () => {
    for (const c of golden.circuits) {
      const turf = c.spec.split(" ").some((t) => /^[^@~]*\/[^@~]*z/.test(t.replace(/~./g, "")));
      if (frozen(golden, c.date)) expect(turf).toBe(false);
      else if (c.theme === "campagne") expect(turf).toBe(true);
    }
    expect(golden.circuits.filter((c) => !frozen(golden, c.date) && c.theme === "campagne").length).toBeGreaterThanOrEqual(2);
  });

  it("lot 49 : au moins un jour de la dernière version par thème", () => {
    const themes = new Set(golden.circuits.filter((c) => !frozen(golden, c.date)).map((c) => c.theme));
    expect([...themes].sort()).toEqual(["banquise", "campagne", "canyon", "col", "nuit", "rallye", "stade", "ville"]);
  });

  for (const entry of golden.circuits) {
    it(`${entry.date} : même circuit, même temps d'auteur, même thème et palette`, () => {
      expect(compute(entry.date, versionOfEntry(golden, entry.date))).toEqual(entry);
    });
  }
});
