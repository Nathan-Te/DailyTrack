import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { dailyGravity, Partie, terrainDuJour } from "../src/index";
import { piloter } from "../src/pilote";

// **Pas un seul flottant dans la simulation** (règle du lot GR1) : la partie, le générateur et la rediffusion ne manient que des entiers. Deux gardes : (1) le code — aucun littéral décimal, aucune racine ni transcendante,
// aucun arrondi de flottant, aucun texte converti en nombre décimal (`describePurity` interdit déjà `Math.sin`…, le hasard, les dates et `**`) ; (2) l'état — après une vraie partie, chaque nombre de la partie est un entier.
const SRC = new URL("../src", import.meta.url).pathname;
const sansCommentaires = (code: string): string =>
  code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").replace(/"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'/g, '""'))
    .join("\n");

describe("aucun flottant dans le code de la simulation", () => {
  const fichiers = readdirSync(SRC).filter((f) => f.endsWith(".ts"));
  it("contient des sources à vérifier", () => expect(fichiers.length).toBeGreaterThan(5));
  for (const f of fichiers) {
    it(`${f} : pas de littéral décimal, pas de Math.sqrt / round / fround / PI, pas de parseFloat ni toFixed`, () => {
      const code = sansCommentaires(readFileSync(join(SRC, f), "utf8"));
      expect(code).not.toMatch(/(?<![\w.])\d+\.\d+/); // 0.5, 1.35
      expect(code).not.toMatch(/(?<![\w.])\.\d+/); // .5
      expect(code).not.toMatch(/\d[eE][+-]?\d/); // 1e3
      expect(code).not.toMatch(/Math\.(sqrt|round|fround|PI|E\b|ceil)/);
      expect(code).not.toMatch(/parseFloat|toFixed|toPrecision|Number\.EPSILON/);
    });
  }
});

describe("tout l'état d'une partie est entier", () => {
  it("après une vraie partie (le pilote d'essai, 6 000 pas, tous les champs)", () => {
    const jour = daysFromCivil(2026, 11, 9);
    const { partie } = piloter(terrainDuJour(dailyGravity(jour)), 6000);
    const nombres: [string, unknown][] = [];
    const visiter = (nom: string, v: unknown): void => {
      if (typeof v === "number") nombres.push([nom, v]);
      else if (Array.isArray(v)) v.forEach((x, i) => visiter(`${nom}[${i}]`, x));
      else if (v && typeof v === "object" && nom !== "terrain") for (const [k, x] of Object.entries(v)) visiter(`${nom}.${k}`, x);
    };
    visiter("partie", partie);
    expect(nombres.length).toBeGreaterThan(100); // les pièces des morceaux chargés y sont
    for (const [nom, v] of nombres) expect(Number.isInteger(v), `${nom} = ${String(v)}`).toBe(true);
  });
  it("la copie d'une partie est indépendante et identique", () => {
    const p = new Partie(terrainDuJour(dailyGravity(daysFromCivil(2026, 11, 9))));
    for (let i = 0; i < 500; i++) p.avancer();
    const c = p.copier();
    expect(JSON.stringify(c.resultat())).toBe(JSON.stringify(p.resultat()));
    for (let i = 0; i < 300; i++) c.avancer();
    expect(p.tick).toBe(500);
    expect(c.tick).toBe(800);
  });
});
