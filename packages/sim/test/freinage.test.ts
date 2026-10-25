import { describe, expect, it } from "vitest";
import {
  BASCULE_LOT_34,
  FAST_APPROACH,
  GENERATOR_BEFORE_34,
  GENERATOR_VERSION,
  BASCULE_LOT_48,
  MAX_BRAKING_ADD,
  SIGNATURE_FIGURE,
  TRAP_SLACK,
  approachAfter,
  bestPilotRun,
  brakingDeficit,
  composeFigures,
  dailyCircuit,
  dailyTrackId,
  generatorVersionOf,
  humanRun,
  isCurve,
  parseToken,
  salonCircuit,
  secureBraking,
  themeByName,
  turnReports,
  type DailyCircuit,
} from "../src/index";

// Lot 34 — freinage possible après un boost. Règles du générateur v16 (à partir du 28/10/2026), chacune comptée ici et mesurée par
// `npm run measure:generator` (section 3 : virages-pièges et contacts du pilote « humain correct », v15 contre v16 ; README du lot).

const AFTER = Array.from({ length: 24 }, (_, i) => BASCULE_LOT_34 + 4 + i * 5);
const circuits = new Map<number, DailyCircuit>();
const circuit = (day: number) => {
  let c = circuits.get(day);
  if (!c) circuits.set(day, (c = dailyCircuit(day)));
  return c;
};

describe("versionnement par date (lot 34)", () => {
  it("les jours d'avant la bascule gardent le générateur v15, les suivants v16 jusqu'à la bascule du lot 48, puis le Salon et les jours d'après la dernière version", () => {
    expect(GENERATOR_BEFORE_34).toBe(15);
    expect(GENERATOR_VERSION).toBe(17); // lot 48 : l'herbe de course, à partir du 04/11/2026
    expect(generatorVersionOf(BASCULE_LOT_34 - 1)).toBe(15);
    expect(generatorVersionOf(BASCULE_LOT_34)).toBe(16);
    expect(dailyTrackId(BASCULE_LOT_34 - 1)).toBe("jour-2026-10-27-g15");
    expect(dailyTrackId(BASCULE_LOT_34, "ville", 2)).toBe("jour-2026-10-28-g16-v2-ville");
    expect(generatorVersionOf(BASCULE_LOT_48 - 1)).toBe(16);
    expect(generatorVersionOf(BASCULE_LOT_48)).toBe(17);
    expect(dailyTrackId(BASCULE_LOT_48 - 1)).toBe("jour-2026-11-03-g16");
    expect(dailyTrackId(BASCULE_LOT_48)).toBe("jour-2026-11-04-g17");
    expect(salonCircuit(2_946_000).id).toBe("salon-2946000-g17");
  });

  it("une date d'avant la bascule rejoue son circuit v15 même si l'on impose la dernière version (sinon ce ne serait pas le même jour)", () => {
    const day = BASCULE_LOT_34 - 2;
    const old = dailyCircuit(day);
    expect(old.track.id).toBe(dailyTrackId(day));
    expect(old.track.id.endsWith("-g15")).toBe(true);
    // La v16 sur cette date serait un autre circuit, sous un autre identifiant : jamais servi pour ce jour.
    expect(dailyCircuit(day, 0, null, 16).track.id.endsWith("-g16")).toBe(true);
  }, 30_000);
});

describe("modèle de freinage (braking.ts)", () => {
  it("un serré derrière un super turbo et cinq droites ne se freine pas ; derrière trois droites ordinaires, si", () => {
    expect(brakingDeficit(approachAfter(["S", "T", "S", "S", "S", "S", "S"]), "L")).toBeGreaterThan(0);
    expect(brakingDeficit(approachAfter(["S", "P", "S", "S", "S"]), "R")).toBeGreaterThan(0);
    expect(brakingDeficit(approachAfter(["S", "S", "S"]), "L")).toBeLessThanOrEqual(0);
    // Un virage abordé à sa vitesse (deux virages enchaînés) n'est pas un freinage.
    expect(brakingDeficit(approachAfter(["S", "L2"]), "R2")).toBe(-Infinity);
  });

  it("la distance se calcule à partir de la vitesse : plus de droites derrière un super turbo que derrière une plaque", () => {
    const fix = (before: string[], turn: string) => secureBraking(before, ["S", turn, "S"], { escape: false, allowTrap: false })!;
    // Un enchaînement technique sous la pointe du plat n'est pas touché (l'intention de la figure).
    expect(secureBraking(["S", "S", "L2"], ["R", "S"], { escape: false, allowTrap: false })!.added).toBe(0);
    const turbo = fix(["S", "T", "S", "S", "S", "S"], "L");
    const pad = fix(["S", "P", "S", "S"], "L");
    expect(turbo.added).toBeGreaterThan(pad.added);
    expect(pad.added).toBeGreaterThan(0);
    for (const f of [turbo, pad]) {
      const at = f.tokens.indexOf("L");
      expect(brakingDeficit(approachAfter([...(f === turbo ? ["S", "T", "S", "S", "S", "S"] : ["S", "P", "S", "S"]), ...f.tokens.slice(0, at)]), "L")).toBeLessThanOrEqual(0);
    }
  });

  it("le seul virage-piège permis est gardé tel quel ; au-delà de MAX_BRAKING_ADD droites, la variante est refusée", () => {
    const kept = secureBraking(["S", "T", "S", "S", "S", "S"], ["S", "L", "S"], { escape: false, allowTrap: true })!;
    expect(kept.kept).toBe(1);
    expect(kept.added).toBe(0);
    expect(kept.tokens).toEqual(["S", "L", "S"]);
    // Un serré sur la glace juste derrière un super turbo : trop loin du compte.
    expect(secureBraking(["S", "T"], ["L/g", "S"], { escape: false, allowTrap: false })).toBeNull();
    expect(MAX_BRAKING_ADD).toBe(4);
  });

  it("un virage abordé vite reçoit le bas-côté du thème (lui et le bloc qui le suit), jamais un virage relevé", () => {
    const f = secureBraking(["S", "P", "S", "S", "S", "S", "S"], ["S", "L2", "S", "R2/b", "S"], { escape: true, allowTrap: false })!;
    expect(f.escapes).toEqual([1, 2]);
  });
});

describe("générateur v16 : la règle tient sur les circuits du jour d'après la bascule", () => {
  it("chaque virage abordé vite (hors cuve) se freine à temps (modèle statique), sauf au plus un, dans le passage signature ou en Ville", () => {
    for (const day of AFTER) {
      const c = circuit(day);
      const theme = themeByName(c.theme)!;
      const tokens = c.spec.split(" ");
      const traps: number[] = [];
      for (let i = 1; i < tokens.length; i++) {
        const p = parseToken(tokens[i]!);
        if (!isCurve(p.kind) || p.cuve) continue;
        const a = approachAfter(tokens.slice(0, i));
        if ((a.boosted || Math.max(a.peak, a.v) > FAST_APPROACH) && brakingDeficit(a, tokens[i]!) > 0) traps.push(i);
      }
      expect(traps.length, c.spec).toBeLessThanOrEqual(1);
      for (const i of traps) {
        const owner = c.figures.find((f) => i >= f.from && i < f.to)?.name;
        expect(theme.name === "ville" || owner === SIGNATURE_FIGURE[theme.signature], `${c.date} ${c.theme} : ${owner}`).toBe(true);
      }
      const braking = composeFigures(day, c.attempt, theme, 0)!.braking;
      expect(braking.kept).toBeLessThanOrEqual(1);
    }
  }, 120_000);

  it("les virages abordés vite ont le bas-côté du thème quand il en a un (ni vide, ni Ville) et qu'ils ne sont pas relevés", () => {
    let fast = 0;
    for (const day of AFTER) {
      const c = circuit(day);
      const theme = themeByName(c.theme)!;
      if (theme.shoulder.kind === "void" || theme.shoulder.share === 0) continue;
      const tokens = c.spec.split(" ");
      for (let i = 1; i < tokens.length - 1; i++) {
        const b = c.track.blocks[i]!;
        if (!isCurve(b.kind) || b.cuve || b.banked || b.open) continue;
        const a = approachAfter(tokens.slice(0, i));
        if (!(brakingDeficit(a, tokens[i]!) > -Infinity && (a.boosted || Math.max(a.peak, a.v) > FAST_APPROACH))) continue;
        if (c.track.blocks[i - 1]!.kind === "gap") continue;
        fast++;
        expect(b.shoulder, `${c.date} ${c.theme} bloc ${i} : ${tokens[i]}`).not.toBeNull();
      }
    }
    expect(fast).toBeGreaterThan(10);
  }, 120_000);

  it("mesure dynamique : au plus un virage-piège par circuit, et le pilote « humain correct » touche moins les murs qu'en v15", () => {
    const sample = AFTER.slice(0, 8);
    let before = 0;
    let after = 0;
    for (const day of sample) {
      const c = circuit(day);
      const run = bestPilotRun(c.track)!;
      const reports = turnReports(c.track, run);
      expect(reports.filter((r) => r.trap).length, c.spec).toBeLessThanOrEqual(1);
      for (const r of reports.filter((t) => t.trap)) expect(r.slack).toBeLessThan(TRAP_SLACK);
      after += humanRun(c.track, run).contacts;
      const old = dailyCircuit(day, 0, null, 15);
      before += humanRun(old.track, bestPilotRun(old.track)!).contacts;
    }
    // Mesuré sur 156 circuits (README) : 2,36 → 0,49 contacts par circuit. Ici, sur 8 dates : au moins deux fois moins.
    expect(after * 2).toBeLessThanOrEqual(before);
  }, 240_000);

  it("temps de l'auteur toujours dans la fenêtre 30–40 s", () => {
    for (const day of AFTER) {
      const c = circuit(day);
      expect(c.fallback).toBe(false);
      expect(c.authorMs).toBeGreaterThanOrEqual(30_000);
      expect(c.authorMs).toBeLessThanOrEqual(40_000);
    }
  }, 120_000);
});
