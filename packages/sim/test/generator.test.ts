import { describe, expect, it } from "vitest";
import {
  AUTHOR_MAX_MS,
  AUTHOR_MIN_MS,
  GENERATOR_VERSION,
  LAUNCH_DAY,
  PALETTES,
  bestPilotRun,
  composeSpec,
  dailyCircuit,
  dailyTrackId,
  decodeReplay,
  encodeReplay,
  formatDay,
  medalFor,
  medalsFor,
  paletteForDay,
  parseDay,
  replayRace,
  type DailyCircuit,
} from "../src/index";

// Soixante jours consécutifs depuis le lancement, puis une soixantaine d'autres espacés sur ~3 ans.
const DAYS = [
  ...Array.from({ length: 60 }, (_, i) => LAUNCH_DAY + i),
  ...Array.from({ length: 60 }, (_, i) => LAUNCH_DAY + 60 + i * 17),
];
const circuits = new Map<number, DailyCircuit>();
/** Temps de génération (ms) de chaque jour, mesuré au premier appel. */
const buildMs = new Map<number, number>();
const circuit = (day: number) => {
  let c = circuits.get(day);
  if (!c) {
    const t0 = performance.now();
    circuits.set(day, (c = dailyCircuit(day)));
    buildMs.set(day, performance.now() - t0);
  }
  return c;
};
const isWideKind = (k: string) => k === "wideL" || k === "wideR";

describe("circuit du jour : construction", () => {
  it("est déterministe : même jour, même circuit, au caractère près", () => {
    for (const day of [LAUNCH_DAY, LAUNCH_DAY + 1, LAUNCH_DAY + 400]) {
      const a = dailyCircuit(day);
      const b = dailyCircuit(day);
      expect(b.spec).toBe(a.spec);
      expect(b.authorMs).toBe(a.authorMs);
      expect(b.attempt).toBe(a.attempt);
    }
  });

  // Premier test qui génère les 120 jours (mis en cache pour les suivants) : temps large.
  it("donne des circuits différents d'un jour à l'autre", { timeout: 120_000 }, () => {
    const specs = new Set(DAYS.map((d) => circuit(d).spec));
    expect(specs.size).toBe(DAYS.length);
  });

  it("n'a jamais besoin du circuit de secours", () => {
    expect(DAYS.filter((d) => circuit(d).fallback)).toEqual([]);
  });

  it("respecte les règles : départ, arrivée, 2 à 4 points de contrôle, longueur, pas de croisement", () => {
    for (const day of DAYS) {
      const { track, spec } = circuit(day);
      const blocks = track.blocks;
      expect(blocks[0]!.mark, spec).toBe("start");
      expect(blocks[blocks.length - 1]!.mark, spec).toBe("finish");
      const checkpoints = blocks.filter((b) => b.mark === "checkpoint").length;
      expect(checkpoints).toBeGreaterThanOrEqual(2);
      expect(checkpoints).toBeLessThanOrEqual(4);
      expect(blocks.length).toBeGreaterThanOrEqual(25);
      expect(blocks.length).toBeLessThanOrEqual(60);
      // Une cellule par bloc (quatre pour un virage large) : pas d'auto-intersection.
      expect(track.cells.size).toBe(blocks.length + 3 * blocks.filter((b) => isWideKind(b.kind)).length);
    }
  });

  it("alterne les rythmes : jamais plus de deux virages d'affilée, jamais de plaque juste avant un virage", () => {
    for (const day of DAYS) {
      const kinds = circuit(day).track.blocks.map((b) => b.kind);
      const curve = (k?: string) => k === "curveL" || k === "curveR" || k === "wideL" || k === "wideR";
      for (let i = 0; i < kinds.length; i++) {
        if (curve(kinds[i]) && curve(kinds[i + 1])) expect(curve(kinds[i + 2]), `${day} @${i}`).toBe(false);
        if (kinds[i] === "boost") expect(curve(kinds[i + 1]), `${day} @${i}`).toBe(false);
      }
    }
  });

  it("a toujours un passage marquant (tremplin, chicane ou épingle) et, si tremplin, deux lignes droites pour atterrir", () => {
    for (const day of DAYS) {
      const kinds = circuit(day).track.blocks.map((b) => b.kind);
      const hasJump = kinds.includes("jump");
      const hasPair = kinds.some((k, i) => (k === "curveL" || k === "curveR") && (kinds[i + 1] === "curveL" || kinds[i + 1] === "curveR"));
      expect(hasJump || hasPair, circuit(day).spec).toBe(true);
      kinds.forEach((k, i) => {
        if (k === "jump") {
          expect(kinds[i + 1]).toBe("straight");
          expect(kinds[i + 2]).toBe("straight");
        }
      });
    }
  });

  it("varie les blocs : pentes, bosses, plaques et tremplins apparaissent sur la période", () => {
    const seen = new Set(DAYS.flatMap((d) => circuit(d).track.blocks.map((b) => b.kind)));
    for (const k of ["straight", "curveL", "curveR", "wideL", "wideR", "up", "down", "bump", "jump", "boost"]) expect(seen.has(k as never), k).toBe(true);
  });

  it("construit vite : temps de génération mesuré sur 60 jours consécutifs (moyenne < 0,5 s, pire < 1,5 s)", () => {
    const times = DAYS.slice(0, 60).map((d) => (circuit(d), buildMs.get(d)!));
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const worst = Math.max(...times);
    console.info(`[générateur] 60 jours consécutifs : moyenne ${mean.toFixed(0)} ms, pire ${worst.toFixed(0)} ms`);
    expect(mean).toBeLessThan(500);
    expect(worst).toBeLessThan(1500);
  });

  it("recommence avec une graine voisine quand une tentative échoue : la première tentative n'est pas toujours retenue", () => {
    const attempts = DAYS.map((d) => circuit(d).attempt);
    expect(attempts.some((a) => a > 0)).toBe(true);
    expect(Math.max(...attempts)).toBeLessThan(25);
    // composeSpec est lui-même déterministe et peut échouer proprement (null) sans lever d'erreur.
    expect(composeSpec(LAUNCH_DAY, 0)).toBe(composeSpec(LAUNCH_DAY, 0));
  });
});

describe("circuit du jour : validation par le pilote", () => {
  it("chaque circuit est finissable par le pilote, sans chute, dans la fenêtre de durée visée", () => {
    for (const day of DAYS) {
      const c = circuit(day);
      expect(c.authorMs, c.date).toBeGreaterThanOrEqual(AUTHOR_MIN_MS);
      expect(c.authorMs, c.date).toBeLessThanOrEqual(AUTHOR_MAX_MS);
    }
  });

  it("le temps de l'auteur se rejoue exactement : la rediffusion du pilote redonne ce temps", () => {
    for (const day of [LAUNCH_DAY, LAUNCH_DAY + 3, LAUNCH_DAY + 29]) {
      const c = circuit(day);
      const run = bestPilotRun(c.track)!;
      expect(run.finishMs).toBe(c.authorMs);
      const result = replayRace(c.track, decodeReplay(encodeReplay(run.replay)));
      expect(result.finishMs).toBe(c.authorMs);
      expect(result.respawns).toBe(0);
    }
  });
});

describe("médailles", () => {
  const medals = medalsFor(35_000);

  it("sont croissantes et partent du temps de l'auteur", () => {
    expect(medals.author).toBe(35_000);
    expect(medals.author).toBeLessThan(medals.gold);
    expect(medals.gold).toBeLessThan(medals.silver);
    expect(medals.silver).toBeLessThan(medals.bronze);
    expect(medals.gold).toBe(37_800);
  });

  it("attribuent la meilleure médaille atteinte, bornes comprises", () => {
    expect(medalFor(34_999, medals)).toBe("author");
    expect(medalFor(35_000, medals)).toBe("author");
    expect(medalFor(35_001, medals)).toBe("gold");
    expect(medalFor(medals.gold, medals)).toBe("gold");
    expect(medalFor(medals.gold + 1, medals)).toBe("silver");
    expect(medalFor(medals.silver, medals)).toBe("silver");
    expect(medalFor(medals.bronze, medals)).toBe("bronze");
    expect(medalFor(medals.bronze + 1, medals)).toBeNull();
  });
});

describe("palette et identifiant", () => {
  it("la palette dépend du jour, et toutes servent sur un mois", () => {
    const palettes = new Set(Array.from({ length: 40 }, (_, i) => paletteForDay(LAUNCH_DAY + i)));
    expect([...palettes].sort()).toEqual([...PALETTES].sort());
    expect(paletteForDay(LAUNCH_DAY)).toBe(paletteForDay(LAUNCH_DAY));
  });

  it("l'identifiant du circuit est une date et la version du générateur, accepté par les rediffusions", () => {
    const id = dailyTrackId(parseDay("2026-10-06")!);
    expect(id).toBe(`jour-2026-10-06-g${GENERATOR_VERSION}`);
    expect(id).toMatch(/^[a-z0-9_-]{1,32}$/);
    expect(formatDay(LAUNCH_DAY)).toBe("2026-10-06");
  });
});
