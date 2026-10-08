import { describe, expect, it } from "vitest";
import {
  AUTHOR_MAX_MS,
  AUTHOR_MIN_MS,
  FAST_PEAK,
  GENERATOR_VERSION,
  daysFromCivil,
  PALETTES,
  THEMES,
  THEME_NAMES,
  bestPilotRun,
  isCurve,
  isWide,
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
  themeForDay,
  replayRace,
  type DailyCircuit,
} from "../src/index";

// Jours de test : ancrés sur le 06/10/2026, la date des essais des lots 4 à 8 (60 jours consécutifs validés par le pilote).
// Ils ne suivent pas `PREMIER_JOUR`, qui ne change que la numérotation : les circuits testés restent les mêmes.
const JOUR_TEST = daysFromCivil(2026, 10, 6);

// Soixante jours consécutifs depuis le lancement, puis une soixantaine d'autres espacés sur ~3 ans.
const DAYS = [
  ...Array.from({ length: 60 }, (_, i) => JOUR_TEST + i),
  ...Array.from({ length: 60 }, (_, i) => JOUR_TEST + 60 + i * 17),
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
/** Cellules occupées par un bloc : une pour un virage serré ou une droite, quatre pour un virage large, huit pour un virage ample. */
const cellsOf = (k: Parameters<typeof isCurve>[0]) => (k === "grandL" || k === "grandR" ? 8 : k === "wideL" || k === "wideR" ? 4 : 1);
const isTight = (k: Parameters<typeof isCurve>[0]) => isCurve(k) && !isWide(k);

describe("circuit du jour : construction", () => {
  it("est déterministe : même jour, même circuit, au caractère près", () => {
    for (const day of [JOUR_TEST, JOUR_TEST + 1, JOUR_TEST + 400]) {
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
      expect(blocks.length).toBeGreaterThanOrEqual(20);
      expect(blocks.length).toBeLessThanOrEqual(60);
      // Une cellule par bloc (quatre pour un virage large, huit pour un virage ample) : pas d'auto-intersection.
      expect(track.cells.size).toBe(blocks.reduce((n, b) => n + cellsOf(b.kind), 0));
    }
  });

  it("alterne les rythmes : jamais plus de deux virages d'affilée, jamais de plaque juste avant un virage", () => {
    for (const day of DAYS) {
      const kinds = circuit(day).track.blocks.map((b) => b.kind);
      const curve = (k?: string) => k !== undefined && isCurve(k as never);
      for (let i = 0; i < kinds.length; i++) {
        if (curve(kinds[i]) && curve(kinds[i + 1])) expect(curve(kinds[i + 2]), `${day} @${i}`).toBe(false);
        if (kinds[i] === "boost") expect(curve(kinds[i + 1]), `${day} @${i}`).toBe(false);
        if (kinds[i] === "turbo") expect(curve(kinds[i + 1]), `${day} @${i}`).toBe(false);
      }
    }
  });

  it("laisse deux lignes droites derrière chaque plaque d'accélération (sinon le virage suivant ne se prend pas à 48 m/s)", () => {
    const curve = (k?: string) => k !== undefined && isCurve(k as never);
    for (const day of DAYS) {
      const kinds = circuit(day).track.blocks.map((b) => b.kind);
      kinds.forEach((k, i) => {
        if (k !== "boost") return;
        // Les deux blocs qui suivent : des lignes droites ou, au pire, la fin du circuit.
        for (const next of [kinds[i + 1], kinds[i + 2]]) if (next !== undefined) expect(curve(next), `${day} @${i}`).toBe(false);
      });
    }
  });

  it("a toujours un passage marquant (tremplin, S large ou demi-tour) et, si tremplin, deux lignes droites pour atterrir", () => {
    for (const day of DAYS) {
      const kinds = circuit(day).track.blocks.map((b) => b.kind);
      const hasJump = kinds.includes("jump");
      const hasPair = kinds.some((k, i) => isCurve(k) && kinds[i + 1] !== undefined && isCurve(kinds[i + 1]!));
      expect(hasJump || hasPair, circuit(day).spec).toBe(true);
      kinds.forEach((k, i) => {
        if (k === "jump") {
          expect(kinds[i + 1]).toBe("straight");
          expect(kinds[i + 2]).toBe("straight");
        }
      });
    }
  });

  it("varie les blocs : pentes, bosses, plaques, rampes de saut et vides apparaissent sur la période (le tremplin J cède la place aux vrais sauts, lot 17)", () => {
    const seen = new Set(DAYS.flatMap((d) => circuit(d).track.blocks.map((b) => b.kind)));
    for (const k of ["straight", "curveL", "curveR", "wideL", "wideR", "grandL", "grandR", "up", "down", "bump", "kick", "gap", "boost", "turbo", "cut"]) expect(seen.has(k as never), k).toBe(true);
  });

  it("construit vite : temps de génération mesuré sur 60 jours consécutifs (moyenne < 0,8 s, pire < 2,5 s)", () => {
    const times = DAYS.slice(0, 60).map((d) => (circuit(d), buildMs.get(d)!));
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const worst = Math.max(...times);
    console.info(`[générateur] 60 jours consécutifs : moyenne ${mean.toFixed(0)} ms, pire ${worst.toFixed(0)} ms`);
    // Budget relevé à la retouche 18b : une cuve fait essayer au pilote les deux lignes (8 courses au lieu de 4), et la CI est ≈ 3 fois plus lente
    // que le conteneur de développement (193 ms ici, ≈ 610 ms en CI). Le serveur met le circuit en cache.
    expect(mean).toBeLessThan(800);
    expect(worst).toBeLessThan(2500);
  });

  it("recommence avec une graine voisine quand une tentative échoue : la première tentative n'est pas toujours retenue", () => {
    const attempts = DAYS.map((d) => circuit(d).attempt);
    expect(attempts.some((a) => a > 0)).toBe(true);
    expect(Math.max(...attempts)).toBeLessThan(25);
    // composeSpec est lui-même déterministe et peut échouer proprement (null) sans lever d'erreur.
    expect(composeSpec(JOUR_TEST, 0)).toBe(composeSpec(JOUR_TEST, 0));
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
    for (const day of [JOUR_TEST, JOUR_TEST + 3, JOUR_TEST + 29]) {
      const c = circuit(day);
      const run = bestPilotRun(c.track)!;
      expect(run.finishMs).toBe(c.authorMs);
      const result = replayRace(c.track, decodeReplay(encodeReplay(run.replay)));
      expect(result.finishMs).toBe(c.authorMs);
      expect(result.respawns).toBe(0);
    }
  });
});

describe("circuit du jour : largeurs de route et courbes amples (lot 12)", () => {
  const widthsOf = (c: DailyCircuit) => new Set(c.track.blocks.flatMap((b) => [b.w0, b.w1]));

  it("alterne au moins deux largeurs par circuit, toutes parmi 14, 20 et 26 m", () => {
    for (const day of DAYS) {
      const c = circuit(day);
      const widths = widthsOf(c);
      expect(widths.size, c.spec).toBeGreaterThanOrEqual(2);
      for (const w of widths) expect([14, 20, 26], c.spec).toContain(w);
    }
  });

  it("n'a jamais de marche de largeur : chaque bloc commence où le précédent finit ; seules les droites s'élargissent ou se resserrent", () => {
    for (const day of DAYS) {
      const { track, spec } = circuit(day);
      track.blocks.forEach((b, i) => {
        if (i > 0) expect(b.w0, `${spec} @${i}`).toBe(track.blocks[i - 1]!.w1);
        if (b.w0 !== b.w1) {
          expect(b.kind, `${spec} @${i}`).toBe("straight");
          expect(Math.abs(b.w1 - b.w0), `${spec} @${i}`).toBeLessThanOrEqual(6); // un seul cran à la fois : 14 ↔ 20 ↔ 26 m
        }
      });
    }
  });

  it("limite les virages serrés : deux au plus par circuit, jamais deux de suite, jamais sur la route large", () => {
    for (const day of DAYS) {
      const { track, spec } = circuit(day);
      const tight = track.blocks.filter((b) => isTight(b.kind));
      expect(tight.length, spec).toBeLessThanOrEqual(2);
      for (const b of tight) {
        expect(b.w0, `${spec} @${b.index}`).toBeLessThan(26);
        const next = track.blocks[b.index + 1];
        if (next) expect(isTight(next.kind), `${spec} @${b.index}`).toBe(false);
      }
    }
  });

  it("préfère les courbes amples : en moyenne, plus de virages larges ou amples que de virages serrés", () => {
    const blocks = DAYS.flatMap((d) => circuit(d).track.blocks);
    const wide = blocks.filter((b) => isWide(b.kind)).length;
    const tight = blocks.filter((b) => isTight(b.kind)).length;
    expect(wide).toBeGreaterThan(5 * tight);
    expect(blocks.some((b) => b.kind === "grandL")).toBe(true);
    expect(blocks.some((b) => b.kind === "grandR")).toBe(true);
  });

  it("la largeur dominante dépend du thème : Stade et Banquise plutôt larges, Rallye et Campagne plus étroits", () => {
    const mean = (theme: string) => {
      const widths = DAYS.map((d) => circuit(d)).filter((c) => c.theme === theme).flatMap((c) => c.track.blocks.map((b) => (b.w0 + b.w1) / 2));
      return widths.reduce((a, b) => a + b, 0) / widths.length;
    };
    // Écart d'au moins 2 m (3 m au lot 12 : les circuits du lot 15 ont un créneau de moins, donc moins de changements de largeur).
    expect(mean("stade")).toBeGreaterThan(mean("rallye") + 2);
    expect(mean("banquise")).toBeGreaterThan(mean("campagne") + 2);
    expect(mean("nuit")).toBeGreaterThan(mean("rallye"));
    expect(mean("nuit")).toBeLessThan(mean("stade"));
  });

  it("le passage signature de Campagne est un étranglement : la route se resserre jusqu'à 14 m avant un virage serré sur la terre", () => {
    const campagne = DAYS.map((d) => circuit(d)).filter((c) => c.theme === "campagne");
    expect(campagne.length).toBeGreaterThan(0);
    for (const c of campagne) {
      const pinch = c.track.blocks.find((b) => isTight(b.kind) && b.surface === "dirt" && b.w0 === 14);
      expect(pinch, c.spec).toBeDefined();
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
    const palettes = new Set(Array.from({ length: 40 }, (_, i) => paletteForDay(JOUR_TEST + i)));
    expect([...palettes].sort()).toEqual([...PALETTES].sort());
    expect(paletteForDay(JOUR_TEST)).toBe(paletteForDay(JOUR_TEST));
  });

  it("l'identifiant du circuit est une date et la version du générateur, accepté par les rediffusions", () => {
    const id = dailyTrackId(parseDay("2026-10-06")!);
    expect(id).toBe(`jour-2026-10-06-g${GENERATOR_VERSION}`);
    expect(id).toMatch(/^[a-z0-9_-]{1,32}$/);
    expect(formatDay(JOUR_TEST)).toBe("2026-10-06");
  });
});

describe("thèmes du jour", () => {
  const all = DAYS.map((d) => circuit(d));

  it("le thème vient de la date : même jour, même thème, et la palette est celle du thème", () => {
    for (const day of DAYS.slice(0, 20)) {
      expect(circuit(day).theme).toBe(themeForDay(day).name);
      expect(circuit(day).palette).toBe(THEMES[circuit(day).theme].palette);
      expect(paletteForDay(day)).toBe(circuit(day).palette);
    }
  });

  it("sur 60 jours consécutifs, chaque thème apparaît ; aucun circuit de secours, tous validés par le pilote dans la fenêtre", () => {
    const seen = new Set(DAYS.slice(0, 60).map((d) => circuit(d).theme));
    expect([...seen].sort()).toEqual([...THEME_NAMES].sort());
    for (const c of all) {
      expect(c.fallback, c.date).toBe(false);
      expect(c.authorMs, c.date).toBeGreaterThanOrEqual(AUTHOR_MIN_MS);
      expect(c.authorMs, c.date).toBeLessThanOrEqual(AUTHOR_MAX_MS);
    }
  });

  const blocksOf = (theme: string) => all.filter((c) => c.theme === theme).flatMap((c) => c.track.blocks);

  it("chaque thème a sa signature : virages relevés et turbos (stade), terre (rallye), glace (banquise), moteur coupé (nuit), herbe et terre (campagne)", () => {
    const stade = blocksOf("stade");
    expect(stade.some((b) => b.banked)).toBe(true);
    expect(stade.some((b) => b.kind === "turbo")).toBe(true);
    expect(stade.every((b) => b.surface === "road")).toBe(true);
    expect(blocksOf("rallye").some((b) => b.surface === "dirt")).toBe(true);
    expect(blocksOf("rallye").some((b) => b.kind === "kick" && b.surface === "dirt")).toBe(true); // saut sur la terre
    expect(blocksOf("banquise").some((b) => b.surface === "ice")).toBe(true);
    expect(blocksOf("nuit").some((b) => b.kind === "cut")).toBe(true);
    const campagne = blocksOf("campagne");
    expect(campagne.some((b) => b.surface === "dirt")).toBe(true);
    expect(campagne.some((b) => b.surface === "grass")).toBe(true);
    // Pas de glace ni d'herbe là où le thème n'en veut pas.
    expect(blocksOf("stade").concat(blocksOf("nuit")).every((b) => b.surface === "road")).toBe(true);
    expect(blocksOf("rallye").every((b) => b.surface === "road" || b.surface === "dirt")).toBe(true);
  });

  it("un moteur coupé est suivi d'un point de contrôle deux blocs plus loin (on vit sur son élan, pas jusqu'à l'arrivée)", () => {
    for (const c of all) {
      const blocks = c.track.blocks;
      blocks.forEach((b, i) => {
        if (b.kind !== "cut") return;
        expect(blocks[i + 1]!.kind, c.date).toBe("straight");
        expect(blocks[i + 2]!.mark, c.date).toBe("checkpoint");
      });
    }
  });

  it("un super turbo laisse cinq blocs sans virage derrière lui (il pousse 1,5 s jusqu'à 88 m/s)", () => {
    const curve = (k?: string) => k !== undefined && isCurve(k as never);
    for (const c of all) {
      const kinds = c.track.blocks.map((b) => b.kind);
      kinds.forEach((k, i) => {
        if (k !== "turbo") return;
        for (let j = 1; j <= 5; j++) if (kinds[i + j] !== undefined) expect(curve(kinds[i + j]), `${c.date} @${i + j}`).toBe(false);
      });
    }
  });

  it("un thème forcé donne un autre circuit, identifié à part, marqué comme essai, et reproductible", () => {
    const day = DAYS[3]!;
    const natural = circuit(day);
    const other = THEME_NAMES.find((n) => n !== natural.theme)!;
    const forced = dailyCircuit(day, 0, other);
    expect(forced.theme).toBe(other);
    expect(forced.forcedTheme).toBe(true);
    expect(natural.forcedTheme).toBe(false);
    expect(forced.track.id).toBe(`${dailyTrackId(day)}-${other}`);
    expect(forced.track.id).toMatch(/^[a-z0-9_-]{1,32}$/);
    expect(forced.palette).toBe(THEMES[other].palette);
    expect(dailyCircuit(day, 0, other).spec).toBe(forced.spec);
    expect(forced.spec).not.toBe(natural.spec);
    expect(forced.authorMs).toBeGreaterThanOrEqual(AUTHOR_MIN_MS);
    expect(forced.authorMs).toBeLessThanOrEqual(AUTHOR_MAX_MS);
    // Un nom inconnu est ignoré : on retombe sur le circuit du jour.
    expect(dailyCircuit(day, 0, "inconnu" as never).spec).toBe(natural.spec);
  });
});

describe("circuit du jour : portions rapides (lot 15)", () => {
  it("sur 60 dates, le pilote dépasse la pointe du plat de 30 % ou plus au moins une fois par circuit", () => {
    for (const day of DAYS.slice(0, 60)) {
      const c = circuit(day);
      const run = bestPilotRun(c.track)!;
      expect(run.maxSpeed, `${c.date} ${c.spec}`).toBeGreaterThanOrEqual(FAST_PEAK);
      expect(run.finishMs, c.date).toBe(c.authorMs);
    }
  }, 120_000);

  it("chaque circuit porte une portion rapide dans son texte : un super turbo ou une plaque (66 m/s, +37 % de la pointe)", () => {
    for (const day of DAYS) {
      const c = circuit(day);
      const tokens = c.spec.split(" ").map((t) => t.split("@")[0]!.split("/")[0]!);
      expect(tokens.includes("T") || tokens.includes("P"), c.spec).toBe(true);
    }
  });

  it("une plaque suivie d'une descente laisse deux blocs droits après la descente (pas de virage dans la poussée)", () => {
    for (const day of DAYS) {
      const kinds = circuit(day).track.blocks.map((b) => b.kind);
      kinds.forEach((k, i) => {
        if (k !== "boost") return;
        for (let j = 1; j <= 2; j++) if (kinds[i + j] !== undefined) expect(isCurve(kinds[i + j]!), `${formatDay(day)} @${i + j}`).toBe(false);
      });
    }
  });
});
