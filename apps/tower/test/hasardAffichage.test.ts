import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { COMMANDE, empreinteVue, Partie, type Rapier, SCENARIO_ESSAI } from "@cdj/tower-sim";
import { chargerRapier } from "@cdj/tower-sim/rapier";
import { graineDePiece, hasardAffichage } from "../src/hasardAffichage";
import { Clignotement } from "../src/expression";

// Lot T5 — le hasard d'AFFICHAGE est séparé de la simulation : reproductible par sa graine, jamais `Math.random`, aucun import de la simulation ; en tirer ne change pas une partie.
let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});
const SRC = join(__dirname, "../src");

describe("le hasard d'affichage", () => {
  it("une graine donne toujours la même suite, dans [0, 1), et deux graines donnent deux suites", () => {
    const a = hasardAffichage(42);
    const b = hasardAffichage(42);
    const suite = Array.from({ length: 200 }, () => a());
    expect(Array.from({ length: 200 }, () => b())).toEqual(suite);
    expect(suite.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(new Set(suite).size).toBeGreaterThan(190);
    const c = hasardAffichage(43);
    expect(Array.from({ length: 200 }, () => c())).not.toEqual(suite);
    expect(graineDePiece(1, 0)).not.toBe(graineDePiece(2, 0));
    expect(graineDePiece(1, 0)).not.toBe(graineDePiece(1, 1));
  });

  it("n'importe rien de la simulation ni du socle, et ne lit ni `Math.random` ni l'horloge", () => {
    const code = readFileSync(join(SRC, "hasardAffichage.ts"), "utf8").replace(/\/\/.*$/gm, "");
    expect(code).not.toMatch(/^\s*import\b/m);
    expect(code).not.toMatch(/Math\.random|Date\.now|new Date|performance\./);
    // Aucun module du lot ne tire `Math.random` : tout le hasard visible passe par ce générateur (graines fixes).
    for (const f of readdirSync(SRC).filter((x) => x.endsWith(".ts"))) {
      if (["jour.ts", "preparation.ts"].includes(f)) continue;
      const src = readFileSync(join(SRC, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      if (/(secousse|gerbe|chute|expression|yeux|panique|sons|sonsLogique|scene)\.ts$/.test(f)) expect(src, f).not.toMatch(/Math\.random/);
    }
  });

  it("tirer des nombres d'affichage ne change pas une partie : la même partie, avec ou sans tirages, est identique au bit près", () => {
    const jouer = (tirages: boolean): string => {
      const h = hasardAffichage(7);
      const clic = new Clignotement(hasardAffichage(9));
      const p = new Partie(R, SCENARIO_ESSAI);
      for (let k = 0; k < 1200 && p.etape !== "fini"; k++) {
        if (tirages) {
          h();
          clic.valeur(k / 60, 2);
        }
        p.avancer(k % 23 === 0 ? COMMANDE.GAUCHE : k % 31 === 0 ? COMMANDE.TOURNER : k % 4 === 0 ? COMMANDE.DESCENDRE : 0);
      }
      const e = empreinteVue(p.vue());
      p.dispose();
      return e;
    };
    expect(jouer(true)).toBe(jouer(false));
  });

  it("le clignement vient de ce générateur : reproductible, 140 ms, plus fréquent quand la pièce panique", () => {
    const suite = (graine: number, niveau: 0 | 2): number[] => {
      const c = new Clignotement(hasardAffichage(graine));
      const out: number[] = [];
      for (let ms = 0; ms < 30_000; ms += 10) out.push(c.valeur(ms / 1000, niveau));
      return out;
    };
    expect(suite(5, 0)).toEqual(suite(5, 0));
    const clignements = (v: number[]): number => v.filter((x, i) => x > 0 && (v[i - 1] ?? 0) === 0).length;
    expect(clignements(suite(5, 0))).toBeGreaterThan(3);
    expect(clignements(suite(5, 2))).toBeGreaterThan(clignements(suite(5, 0)));
    expect(Math.max(...suite(5, 0))).toBeLessThanOrEqual(1);
    // Un clignement dure 140 ms au plus : 14 échantillons de 10 ms.
    const v = suite(5, 0);
    let plusLong = 0;
    let courant = 0;
    for (const x of v) {
      courant = x > 0 ? courant + 1 : 0;
      plusLong = Math.max(plusLong, courant);
    }
    expect(plusLong).toBeLessThanOrEqual(15);
  });
});
