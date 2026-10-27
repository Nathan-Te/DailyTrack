import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Lot 36 : le jeu (apps/web) ne charge pas le générateur au premier écran — le circuit du jour se calcule dans un fil de travail. Pour que l'empaqueteur puisse l'écarter,
// les fichiers de `sim` dont le jeu a besoin dès le premier écran (physique, monde, rediffusion, thèmes, médailles, identifiants de jour…) ne doivent importer, de proche
// en proche, aucun des fichiers « lourds » ci-dessous. Une fonction légère qui s'y glisserait (par exemple `medalFor` dans `generator.ts`) ramènerait tout le générateur
// dans le premier chargement : `apps/web/e2e/perf.spec.ts` le verrait à la fin, ce test le dit à la source.
const SRC = join(import.meta.dirname, "../src");
const LOURDS = ["generator", "figures", "braking", "autopilot", "fictional", "circuits", "salonCircuit", "traps", "choices", "medalStats"];
// `index.ts` rassemble tout (les outils et le serveur importent par lui) ; `jump.ts` n'est tiré que par le pilote.
const EXCLUS = new Set(["index", ...LOURDS]);

const fichiers = readdirSync(SRC).filter((f) => f.endsWith(".ts")).map((f) => f.slice(0, -3));
const imports = (nom: string): string[] =>
  [...readFileSync(join(SRC, `${nom}.ts`), "utf8").matchAll(/^import\s+(?!type\b)[^;]*?from\s+"\.\/([^"]+)";/gms)].map((m) => m[1]!).filter((n) => !n.endsWith(".json")); // lot R11 : le registre des jours (données) n'est pas un module

function atteints(depart: string): Set<string> {
  const vus = new Set<string>();
  const file = [depart];
  while (file.length) {
    const f = file.pop()!;
    if (vus.has(f)) continue;
    vus.add(f);
    file.push(...imports(f));
  }
  return vus;
}

describe("lot 36 : ce que le premier écran du jeu importe ne tire pas le générateur", () => {
  it("les fichiers lourds existent (la liste n'est pas périmée)", () => {
    for (const f of LOURDS) expect(fichiers, f).toContain(f);
  });

  for (const f of fichiers.filter((x) => !EXCLUS.has(x))) {
    it(`${f}.ts n'importe, de proche en proche, aucun fichier lourd`, () => {
      const lourds = [...atteints(f)].filter((x) => LOURDS.includes(x));
      expect(lourds, `${f}.ts tire ${lourds.join(", ")}`).toEqual([]);
    });
  }
});
