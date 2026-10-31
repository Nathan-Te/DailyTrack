import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Lot TP (remplace les gardes du lot T0) : Tower naît `off` et reste fermé tant que Nathan ne l'a pas ouvert (interrupteur du lot P), mais il est désormais **publié avec le site**, production comprise :
// la page dit « Bientôt » tant que le jeu est `off`, ses options d'essai sont fermées (règle R9, `urlOptions.ts`) et **la preuve de l'auteur n'est jamais publiée** (`scripts/site.mjs` la revérifie).
const lire = (chemin: string): string => readFileSync(new URL(`../../../${chemin}`, import.meta.url), "utf8");

describe("Tower sur la plateforme, fermé en production", () => {
  it("scripts/site.mjs publie Tower et vérifie qu'aucune preuve n'est publiée en production", () => {
    const site = lire("scripts/site.mjs");
    expect(site).toContain('export const TOWER_SITE = { from: "apps/tower/dist", to: "tower" }');
    expect(site).toMatch(/cpSync\(join\(ROOT, TOWER_SITE\.from\), join\(out, TOWER_SITE\.to\)/);
    expect(site).toMatch(/if \(production\) \{[\s\S]*fichiersAvecPreuveTower\(out\)/);
  });

  it("les options d'essai restent fermées sur une construction de production (`?scenario`, `?debug`, `?tune`)", () => {
    expect(lire("apps/tower/src/urlOptions.ts")).toContain('import.meta.env.VITE_PRODUCTION === "1"');
  });

  it("Tower est au registre des jeux de l'API mais pas parmi les jeux publics : absent de la table `jeux`, son état est `off`", () => {
    expect(lire("apps/api/src/registry.ts")).toContain("TOWER_GAME");
    expect(lire("packages/core/src/jeux.ts").toLowerCase()).not.toContain("tower");
  });
});
