import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { JUMP_THEME_NAMES } from "@cdj/jump-sim";
import { describe, expect, it } from "vitest";
import { SCENES } from "../src/scenes";

// « Rien dans le premier chargement d'aucun jeu » : depuis l'entrée de chaque application, en ne suivant que les imports statiques (pas `import()`, pas `import type`), on n'atteint
// jamais le lecteur, sa logique, le panneau ni le catalogue de la musique — seulement `@cdj/musique/branche`, qui n'importe que des types.
const ROOT = join(__dirname, "../../..");
const ALIAS: Record<string, string> = {
  "@cdj/musique/branche": "packages/musique/src/branche.ts",
  "@cdj/ui": "packages/ui/src/index.ts",
  "@cdj/profile": "packages/profile/src/index.ts",
  "@cdj/core": "packages/core/src/index.ts",
  "@cdj/clock": "packages/clock/src/index.ts",
  "@cdj/sim": "packages/sim/src/index.ts",
  "@cdj/jump-sim": "packages/jump-sim/src/index.ts",
  "@cdj/tower-sim": "packages/tower-sim/src/index.ts",
};

function fichier(base: string, spec: string): string | null {
  const cible = ALIAS[spec] ? join(ROOT, ALIAS[spec]!) : spec.startsWith(".") ? resolve(dirname(base), spec) : null;
  if (!cible) return null;
  for (const c of [cible, `${cible}.ts`, join(cible, "index.ts")]) if (existsSync(c) && /\.ts$/.test(c)) return c;
  return null;
}

/** Les modules atteints depuis `entree` par des imports statiques de valeurs. */
function atteints(entree: string): Set<string> {
  const vus = new Set<string>();
  const pile = [join(ROOT, entree)];
  while (pile.length > 0) {
    const f = pile.pop()!;
    if (vus.has(f)) continue;
    vus.add(f);
    const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    for (const m of code.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?from\s+)?"([^"]+)"/g)) {
      const suite = fichier(f, m[1]!);
      if (suite) pile.push(suite);
    }
  }
  return vus;
}

const INTERDITS = ["packages/musique/src/lecteur.ts", "packages/musique/src/logique.ts", "packages/musique/src/navigateur.ts", "packages/musique/src/demarrage.ts", "packages/musique/src/index.ts", "packages/ui/src/panneauMusique.ts", "packages/ui/src/catalogue.musique.ts"];

describe("rien de la musique dans le premier chargement", () => {
  for (const [nom, entree] of [["Track", "apps/web/src/main.ts"], ["Jump", "apps/jump/src/main.ts"], ["Tower", "apps/tower/src/main.ts"], ["portail", "apps/portail/src/portail.ts"]] as const) {
    it(`${nom} : le graphe statique de ${entree} n'atteint ni le lecteur, ni sa logique, ni le panneau`, () => {
      const vus = [...atteints(entree)].map((f) => f.slice(ROOT.length + 1));
      expect(vus.length).toBeGreaterThan(3);
      for (const interdit of INTERDITS) expect(vus, interdit).not.toContain(interdit);
    });
  }

  it("le branchement n'importe que des types, et le socle (`index.ts`) n'exporte ni le panneau ni son catalogue", () => {
    const branche = readFileSync(join(ROOT, "packages/musique/src/branche.ts"), "utf8");
    for (const m of branche.matchAll(/(?:^|\n)import\s+([^;]*?)\s+from\s+"([^"]+)"/g)) expect(m[1], m[2]).toMatch(/^type\b/);
    expect(branche).toMatch(/import\("\.\/demarrage"\)/);
    const ui = readFileSync(join(ROOT, "packages/ui/src/index.ts"), "utf8");
    expect(ui).not.toMatch(/panneauMusique|catalogue\.musique/);
  });

  it("chaque jeu se branche en une ligne, par `@cdj/musique/branche`, jamais par l'index du paquet", () => {
    for (const [fichierJeu, jeu] of [["apps/web/src/main.ts", "track"], ["apps/jump/src/main.ts", "jump"], ["apps/tower/src/main.ts", "tower"]] as const) {
      const code = readFileSync(join(ROOT, fichierJeu), "utf8");
      expect(code, fichierJeu).toContain('from "@cdj/musique/branche"');
      expect(code, fichierJeu).toMatch(new RegExp(`brancherMusique\\("${jeu}"`));
      expect(code, fichierJeu).not.toMatch(/from "@cdj\/musique"/);
    }
  });
});

// Lot « musique » : les scènes de la musique de Jump sont **ses thèmes** : un thème ajouté à Jump sans sa ligne de `SCENES` fait échouer ce test. (Il vit ici, avec le test du premier chargement,
// et non dans un fichier à part de `apps/jump/test/` : une PR de Jump ne doit pas gagner une seconde de tests de plus, `apps/web/test/ciZones.test.ts`. Track et Tower ont le leur,
// `apps/web|tower/test/musiqueScenes.test.ts`.)
describe("la musique de Jump : une scène par thème", () => {
  it("les scènes connues de Jump sont `menu` et un `theme:<code>` par thème de niveaux", () => {
    expect([...SCENES.jump]).toEqual(["menu", ...JUMP_THEME_NAMES.map((n) => `theme:${n}`)]);
  });

  it("main.ts annonce `menu` à l'accueil et `theme:<thème du niveau>` sinon (à chaque changement d'écran : `syncPause`)", () => {
    const code = readFileSync(join(ROOT, "apps/jump/src/main.ts"), "utf8");
    expect(code).toMatch(/musique\.scene\(homeOpen\(\) \? "menu" : `theme:\$\{theme\.name\}`\)/);
  });
});
