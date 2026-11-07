import { describe, expect, it } from "vitest";
import { verifierEcrans } from "../../../packages/ui/test/ecransManette";
import { ECRAN_MANETTE_FEUILLE } from "../../../packages/ui/src/amis";
import { ECRAN_MANETTE_RETOUR } from "../../../packages/ui/src/retours";
import { ECRAN_CLOCHE, ECRAN_FEUILLE, ECRAN_RETOUR, PAGES_MANETTE, optionsPage } from "../src/manette";

// Lot M1 : chaque page du portail déclare son action principale (`src/manette.ts`), et ce qu'elle nomme existe encore. L'administration n'en a pas (clavier et souris).
describe("les pages du portail à la manette", () => {
  it("chaque page déclare son action principale, et les éléments nommés existent", () => {
    expect(Object.keys(PAGES_MANETTE).sort()).toEqual(["accueil", "amis", "classement", "groupe", "messages", "nouveautes", "profil"]);
    verifierEcrans(
      Object.values(PAGES_MANETTE).map((principal, i) => ({ ecran: `page-${i}`, principal })),
      ["apps/portail/src", "packages/ui/src/composants.ts", "packages/ui/src/amis.ts", "packages/ui/src/retours.ts"],
    );
  });

  it("lot F2 : la feuille d'un joueur est dans le menu du classement et (lot U3) de « Amis et groupes » seulement, et c'est la ligne du socle", () => {
    expect(ECRAN_FEUILLE).toEqual(ECRAN_MANETTE_FEUILLE);
    expect(optionsPage("classement").ecrans).toContainEqual(ECRAN_FEUILLE);
    expect(optionsPage("amis").ecrans).toContainEqual(ECRAN_FEUILLE);
    for (const page of ["accueil", "groupe", "messages", "nouveautes", "profil"] as const) expect(optionsPage(page).ecrans).not.toContainEqual(ECRAN_FEUILLE);
    // « Mes amis » : le champ du pseudo, ou « Accepter » quand une invitation est affichée.
    expect(PAGES_MANETTE.amis).toContain(".dj-carte-invitation");
    expect(PAGES_MANETTE.amis).toContain(".dj-ajout-ami__champ");
  });

  it("lot U1 : la feuille de la cloche est dans le menu de l'accueil seulement (A ouvre la ligne, B ferme), et ce qu'elle nomme existe", () => {
    expect(optionsPage("accueil").ecrans).toContainEqual(ECRAN_CLOCHE);
    for (const page of ["amis", "classement", "groupe", "messages", "nouveautes", "profil"] as const) expect(optionsPage(page).ecrans).not.toContainEqual(ECRAN_CLOCHE);
    verifierEcrans([ECRAN_CLOCHE], ["apps/portail/src"]);
  });

  it("lot C1 : le dialogue « Un bug ? Une idée ? » est dans le menu de toutes les pages, et c'est la ligne du socle", () => {
    expect(ECRAN_RETOUR).toEqual(ECRAN_MANETTE_RETOUR);
    for (const page of Object.keys(PAGES_MANETTE) as (keyof typeof PAGES_MANETTE)[]) expect(optionsPage(page).ecrans).toContainEqual(ECRAN_RETOUR);
  });

  it("les mentions légales restent sans script, et l'administration sans menu à la manette", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["../mentions-legales/index.html", "../legal/index.html"]) expect(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8")).not.toMatch(/<script\b/i);
    for (const f of ["admin.ts", "adminDiffusion.ts", "adminDonnees.ts", "adminGithub.ts", "adminJeux.ts"]) expect(readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8")).not.toContain("manette");
  });
});
