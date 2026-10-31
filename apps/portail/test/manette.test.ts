import { describe, expect, it } from "vitest";
import { verifierEcrans } from "../../../packages/ui/test/ecransManette";
import { PAGES_MANETTE } from "../src/manette";

// Lot M1 : chaque page du portail déclare son action principale (`src/manette.ts`), et ce qu'elle nomme existe encore. L'administration n'en a pas (clavier et souris).
describe("les pages du portail à la manette", () => {
  it("chaque page déclare son action principale, et les éléments nommés existent", () => {
    expect(Object.keys(PAGES_MANETTE).sort()).toEqual(["accueil", "classement", "nouveautes", "profil"]);
    verifierEcrans(
      Object.values(PAGES_MANETTE).map((principal, i) => ({ ecran: `page-${i}`, principal })),
      ["apps/portail/src", "packages/ui/src/composants.ts"],
    );
  });

  it("les mentions légales restent sans script, et l'administration sans menu à la manette", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["../mentions-legales/index.html", "../legal/index.html"]) expect(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8")).not.toMatch(/<script\b/i);
    for (const f of ["admin.ts", "adminDiffusion.ts", "adminDonnees.ts", "adminGithub.ts", "adminJeux.ts"]) expect(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8")).not.toContain("manette");
  });
});
