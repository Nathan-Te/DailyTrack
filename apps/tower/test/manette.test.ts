import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { verifierEcrans } from "../../../packages/ui/test/ecransManette";
import { ECRANS_MANETTE } from "../src/manetteEcrans";

// Lot M1 : chaque écran de Tower déclare son action principale (`src/manette.ts`) et ce qu'il nomme existe encore.
describe("les menus de Tower à la manette", () => {
  it("chaque écran déclare son action principale, et les éléments nommés existent", () => {
    verifierEcrans(ECRANS_MANETTE, ["apps/tower/src", "apps/tower/index.html"]);
  });

  // Lot T7 : un nouvel écran de Tower s'ajoute à `ECRANS_MANETTE` — chaque écran du jeu (un voile `…-ecran`) a sa ligne, avec son action principale et, pour les écrans du lot T7, le retour par B.
  it("chaque voile `…-ecran` des sources a sa ligne dans ECRANS_MANETTE", () => {
    const dossier = join(__dirname, "../src");
    const code = readdirSync(dossier).filter((f) => f.endsWith(".ts")).map((f) => readFileSync(join(dossier, f), "utf8")).join("\n");
    // `classe: "voile …", attrs: { id: "pause-ecran" }` (écrans écrits à la main) et `creerEcran(racine, { id: "reglages", … })` (les écrans du cadre : `${id}-ecran`).
    const ids = new Set<string>([...code.matchAll(/classe: "voile[^"]*", attrs: \{ id: "([a-z]+-ecran)"/g)].map((m) => m[1]!));
    for (const m of code.matchAll(/creerEcran\(racine, \{ id: "([a-z]+)"/g)) ids.add(`${m[1]}-ecran`);
    expect([...ids].sort()).toEqual(["accueil-ecran", "aide-ecran", "archives-ecran", "classement-ecran", "fin-ecran", "pause-ecran", "reglages-ecran"]);
    for (const id of ids) expect(ECRANS_MANETTE.filter((e) => e.ecran.startsWith(`#${id}`)), id).toHaveLength(1);
  });

  it("les écrans du lot T7 se pilotent : Réglages et Archives ont B pour « ‹ TOWER » (la barre), la fin de partie ramène à l'accueil, la pause reprend", () => {
    const de = (id: string) => ECRANS_MANETTE.find((e) => e.ecran.startsWith(`#${id}`))!;
    expect(de("reglages-ecran").retour).toBeUndefined(); // B active la flèche « ‹ » de la barre, qui ferme l'écran
    expect(de("archives-ecran").retour).toBeUndefined();
    expect(de("fin-ecran").retour).toBe("#fin-accueil");
    expect(de("pause-ecran").retour).toBe("#pause-reprendre");
    expect(de("accueil-ecran").retour).toBeUndefined(); // B ne quitte pas Tower depuis son accueil
  });
});
