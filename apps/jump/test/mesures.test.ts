import { DEFAULT_JUMP_PARAMS, ESSAI_LEVEL, ESSAI_SOLUTION_CODE, decodeReplay, demoAttempts, encodeReplay, replayAttempt, replayFingerprint, stepAttempt, initialAttempt, fromRuns } from "@cdj/jump-sim";
import { describe, expect, it } from "vitest";
import { Carnage } from "../src/carnage";
import { DayMemory, MAX_DEATHS, MAX_LIVES, type KeyValue } from "../src/memory";
import { stainFor } from "../src/stains";

// Mesures du lot 3 (README) : coût d'un rejeu de l'essai, coût de la simulation du carnage, poids du stockage d'une journée chargée,
// coût du placement des taches. Les bornes sont vérifiées à chaque `npm test` (larges : une machine de CI lente ne doit pas échouer) ;
// `MESURES=1 npx vitest run apps/jump/test/mesures.test.ts --silent=false` affiche les valeurs.

const SOLUTION = decodeReplay(ESSAI_SOLUTION_CODE);
const lines: string[] = [];
const note = (label: string, value: string) => lines.push(`| ${label} | ${value} |`);
const ms = (v: number) => `${v.toFixed(2).replace(".", ",")} ms`;

class MemStore implements KeyValue {
  readonly map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

function timeIt(runs: number, f: () => void): number {
  f();
  const t0 = performance.now();
  for (let i = 0; i < runs; i++) f();
  return (performance.now() - t0) / runs;
}

describe("mesures du lot 3", () => {
  it("coût d'un rejeu de l'essai (2 595 pas), du rejeu avec empreinte, et d'un pas d'essai", () => {
    const replay = timeIt(40, () => replayAttempt(ESSAI_LEVEL, SOLUTION));
    const fingerprint = timeIt(40, () => replayFingerprint(ESSAI_LEVEL, SOLUTION));
    const inputs = fromRuns(SOLUTION.runs);
    const perStep = timeIt(40, () => {
      let s = initialAttempt(ESSAI_LEVEL);
      for (const b of inputs) s = stepAttempt(s, b, ESSAI_LEVEL, DEFAULT_JUMP_PARAMS);
    }) / inputs.length;
    note("Rejeu de la solution de l'essai (`replayAttempt`, 2 595 pas, découpage en vies compris)", ms(replay));
    note("Rejeu avec empreinte de tous les états (`replayFingerprint`)", ms(fingerprint));
    note("Un pas d'essai (`stepAttempt`, en moyenne sur la solution)", `${(perStep * 1000).toFixed(2).replace(".", ",")} µs`);
    note("Rediffusion de la solution (21,625 s)", `${Math.floor((ESSAI_SOLUTION_CODE.length * 6) / 8)} octets, ${ESSAI_SOLUTION_CODE.length} caractères base64url`);
    expect(replay).toBeLessThan(100);
  });

  it("simulation du carnage : 50, 150 et 300 vies qui courent toutes en même temps (copies de la solution), par pas", () => {
    for (const n of [50, 150, 300]) {
      const c = new Carnage(ESSAI_LEVEL, SOLUTION, new Array(n).fill(SOLUTION));
      // 600 pas (5 s), toutes les vies en course.
      for (let i = 0; i < 30; i++) c.step();
      const t0 = performance.now();
      for (let i = 0; i < 600; i++) c.step();
      const perStep = (performance.now() - t0) / 600;
      expect(c.running).toBe(n);
      note(`Carnage, ${n} vies en course : simulation d'un pas (1/120 s)`, `${ms(perStep)} (≈ ${ms(perStep * 2)} par image à 60 i/s)`);
      expect(perStep).toBeLessThan(n * 0.05);
    }
  });

  it("poids du stockage d'une journée chargée : 300 vies, 300 morts, un meilleur essai", () => {
    const store = new MemStore();
    const m = new DayMemory({ store, level: ESSAI_LEVEL, levelId: "essai", today: () => "2026-10-14" });
    const attempts = demoAttempts(ESSAI_LEVEL, SOLUTION, 99, { attempts: 60 });
    for (let k = 0; m.lives.length < MAX_LIVES || k < 2; k++) for (const a of attempts) m.recordEssai(a, false);
    m.recordEssai({ replay: SOLUTION, end: "arrivée" }, false);
    for (let i = 0; i < MAX_DEATHS; i++) m.recordDeath({ x: 123456 + i * 37, y: 98765 + i * 11, cause: 1 + (i % 3) }, false);
    const size = m.storedSize();
    const lifeBytes = m.lives.reduce((n, l) => n + l.code.length, 0) / m.lives.length;
    note("Stockage d'une journée chargée (300 vies, 300 morts, meilleur essai)", `${(size / 1024).toFixed(1).replace(".", ",")} ko (${size} caractères)`);
    note("Une vie stockée (rediffusion seule, en moyenne)", `${Math.round(lifeBytes)} caractères base64url`);
    // Relire une journée chargée (rejeu du meilleur essai compris).
    const load = timeIt(5, () => new DayMemory({ store, level: ESSAI_LEVEL, levelId: "essai", today: () => "2026-10-14" }));
    note("Relecture d'une journée chargée au chargement de la page", ms(load));
    expect(m.lives).toHaveLength(MAX_LIVES);
    expect(size).toBeLessThan(400 * 1024);
    void encodeReplay;
  });

  it("placement des taches : 300 morts au chargement", () => {
    const deaths = demoAttempts(ESSAI_LEVEL, SOLUTION, 7, { attempts: 120 }).flatMap((a) => replayAttempt(ESSAI_LEVEL, a.replay).deaths).slice(0, 300);
    const t = timeIt(5, () => deaths.forEach((d) => stainFor(ESSAI_LEVEL, d.x, d.y)));
    note(`Placement de ${deaths.length} taches (\`stainFor\`)`, ms(t));
    expect(t).toBeLessThan(500);
    if (process.env.MESURES) console.log(["| Mesure | Valeur |", "|---|---|", ...lines].join("\n"));
  });
});
