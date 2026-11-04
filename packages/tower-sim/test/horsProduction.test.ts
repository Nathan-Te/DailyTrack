import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { SITES_FICHES, TOWER_SITE } from "../../../scripts/site.mjs";

// Lot TP (remplace les gardes du lot T0) : Tower naît `off` et reste fermé tant que Nathan ne l'a pas ouvert (interrupteur du lot P), mais il est désormais **publié avec le site**, production comprise :
// la page dit « Bientôt » tant que le jeu est `off`, ses options d'essai sont fermées (règle R9, `urlOptions.ts`) et **la preuve de l'auteur n'est jamais publiée** (`scripts/site.mjs` la revérifie).
const lire = (chemin: string): string => readFileSync(new URL(`../../../${chemin}`, import.meta.url), "utf8");

describe("Tower sur la plateforme, fermé en production", () => {
  it("scripts/site.mjs publie Tower et vérifie qu'aucune preuve n'est publiée en production", () => {
    // Lot K1 : le dossier publié, ses jours et l'interdiction de la preuve viennent de la fiche (`config/jeux/tower.json`), plus d'une constante écrite dans le script.
    expect(TOWER_SITE).toEqual({ id: "tower", from: "apps/tower/dist", to: "tower", jours: "apps/tower/public/jours", preuveInterdite: true, temoin: false });
    expect((SITES_FICHES as { id: string }[]).map((s) => s.id)).toContain("tower");
    const site = lire("scripts/site.mjs");
    // Lot K4e : les sites d'une construction sont ceux des fiches, moins les jeux témoins en production (`retenirSites`).
    expect(site).toMatch(/for \(const part of sites\) cpSync\(join\(ROOT, part\.from\), join\(out, part\.to\)/);
    expect(site).toMatch(/if \(production\) \{[\s\S]*sites\.filter\(\(s\) => s\.preuveInterdite\)[\s\S]*fichiersAvecPreuveDeFiche\(out, site\)/);
  });

  it("les options d'essai restent fermées sur une construction de production (`?scenario`, `?debug`, `?tune`)", () => {
    expect(lire("apps/tower/src/urlOptions.ts")).toContain('import.meta.env.VITE_PRODUCTION === "1"');
  });

  it("Tower est au registre des jeux de l'API mais pas parmi les jeux publics : absent de la table `jeux`, son état est `off`", () => {
    expect(lire("apps/api/src/registre.generated.ts")).toContain("TOWER_GAME"); // lot K4e : le registre vient des fiches (un import par fiche, écrit par `npm run fiches`)
    expect(lire("packages/core/src/jeux.ts").toLowerCase()).not.toContain("tower");
  });
});
