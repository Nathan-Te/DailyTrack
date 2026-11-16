import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { NORME, QUART, TOUR, dailyPinball, jouerRobot, racine, sinus, cosinus } from "../src/index";

// **Pas un seul flottant dans la simulation** (règle du lot PB1) : la partie, le générateur et la rediffusion ne manient que des entiers. Deux gardes : (1) le code — aucun littéral décimal, aucune racine ni transcendante,
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
  it("contient des sources à vérifier", () => expect(fichiers.length).toBeGreaterThan(8));
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
  it.each(["foire", "ocean", "espace", "volcan"] as const)("après une vraie partie sur la table du thème %s (le robot, 20 000 pas, tous les champs, éléments des thèmes compris)", (theme) => {
    const { partie } = jouerRobot(dailyPinball(daysFromCivil(2026, 11, 9), undefined, theme), 1, { maxTicks: 20000 });
    const nombres: [string, unknown][] = [];
    const visiter = (nom: string, v: unknown): void => {
      if (typeof v === "number") nombres.push([nom, v]);
      else if (Array.isArray(v)) v.forEach((x, i) => visiter(`${nom}[${i}]`, x));
      else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) visiter(`${nom}.${k}`, x);
    };
    visiter("partie", partie);
    expect(nombres.length).toBeGreaterThan(150); // la table, les éléments et la bille
    for (const [nom, v] of nombres) expect(Number.isInteger(v), `${nom} = ${String(v)}`).toBe(true);
  });
});

describe("la racine et les sinus entiers", () => {
  it("la racine entière est la partie entière de la racine, pour tout entier de 0 à 2^53", () => {
    for (let n = 0; n < 5000; n++) expect(racine(n)).toBe(Math.floor(Math.sqrt(n)));
    let n = 12345;
    for (let i = 0; i < 4000; i++) {
      n = (n * 48271) % 2147483647; // un petit générateur, pas de hasard
      const v = n * 4194304 + (n % 4194304);
      const r = racine(v);
      expect(r * r <= v && (r + 1) * (r + 1) > v, `racine(${v}) = ${r}`).toBe(true);
    }
    expect(racine(2 ** 53 - 1)).toBe(94906265);
  });
  it("la table des sinus suit le sinus à 2 unités de 16 384 près, sur tout le cercle", () => {
    let pire = 0;
    for (let a = -TOUR; a <= 2 * TOUR; a += 7) {
      const attendu = Math.round(Math.sin((a * 2 * Math.PI) / TOUR) * NORME);
      pire = Math.max(pire, Math.abs(sinus(a) - attendu));
      pire = Math.max(pire, Math.abs(cosinus(a) - Math.round(Math.cos((a * 2 * Math.PI) / TOUR) * NORME)));
    }
    expect(pire).toBeLessThanOrEqual(2);
    expect(sinus(0)).toBe(0);
    expect(sinus(QUART)).toBe(NORME);
    expect(sinus(2 * QUART)).toBe(0);
    expect(sinus(3 * QUART)).toBe(-NORME);
    expect(cosinus(0)).toBe(NORME);
  });
});
