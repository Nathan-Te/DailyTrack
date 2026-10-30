import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Lot T0 : Tower naît `off` et sa page d'essai n'est JAMAIS publiée en production (règle R9 : les options d'essai sont fermées). Deux gardes : l'assemblage du site
// (scripts/site.mjs) ne copie `apps/tower/dist` que hors production et refuse de la voir dans un site de production ; la page elle-même se tait sur une construction de
// production (`VITE_PRODUCTION=1`). Tower n'est ni dans le registre des jeux ni dans la liste des jeux publics : son état est donc `off`.
const lire = (chemin: string): string => readFileSync(new URL(`../../../${chemin}`, import.meta.url), "utf8");

describe("Tower hors production", () => {
  it("scripts/site.mjs ne publie l'essai que hors production, et le vérifie", () => {
    const site = lire("scripts/site.mjs");
    expect(site).toMatch(/if \(!production && existsSync\(join\(ROOT, ESSAI_TOWER\.from/);
    expect(site).toMatch(/if \(production && existsSync\(join\(out, ESSAI_TOWER\.to\)\)\) throw/);
  });

  it("la page d'essai se tait sur une construction de production", () => {
    const main = lire("apps/tower/src/main.ts");
    expect(main).toContain('import.meta.env.VITE_PRODUCTION === "1"');
    expect(main).toMatch(/if \(PRODUCTION\) \{\s*hud\.textContent = "Bientôt\."/);
  });

  it("Tower n'est ni dans le registre des jeux de l'API ni parmi les jeux publics : absent de la table `jeux`, son état est `off`", () => {
    expect(lire("apps/api/src/registry.ts").toLowerCase()).not.toContain("tower");
    expect(lire("packages/core/src/jeux.ts").toLowerCase()).not.toContain("tower");
  });
});
