import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { rapportContraste } from "../src/contraste";
import { ETIQUETTES_FICHES } from "../src/fiches.generated";
import { COULEURS, POLICES, valeurJeton } from "../src/jetons";

// Lot K1 : le socle lit la fiche de chaque jeu qui en a une — les valeurs de son étiquette sont celles des jetons (les NOMS des jetons restent ceux de la charte), et le CSS écrit à la main
// pour ce jeu (étiquette, sélecteur d'amis) existe. Un jeu dont la fiche est ajoutée sans cette feuille échoue ici, au lieu de s'afficher sans couleur.

const RACINE = resolve(__dirname, "..", "..", "..");
const fiches = readdirSync(join(RACINE, "config/jeux"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(join(RACINE, "config/jeux", f), "utf8")) as { id: string; etiquette: { fond: string; coque: string; police: string; dessin: string } });
const css = (f: string) => readFileSync(join(RACINE, "packages/ui/src", f), "utf8");

describe("le socle lit les fiches", () => {
  it("la vue générée contient chaque fiche, et ses valeurs sont celles de la fiche", () => {
    expect(Object.keys(ETIQUETTES_FICHES).sort()).toEqual(fiches.map((f) => f.id).sort());
    for (const f of fiches) expect(ETIQUETTES_FICHES[f.id as keyof typeof ETIQUETTES_FICHES], f.id).toEqual(f.etiquette);
  });

  it("Tower : les jetons de sa charte portent les valeurs de sa fiche", () => {
    const t = fiches.find((f) => f.id === "tower")!;
    expect(COULEURS["tower-menthe"]).toBe(t.etiquette.fond);
    expect(COULEURS["tower-coque"]).toBe(t.etiquette.coque);
    expect(POLICES["tower-police"]).toBe(t.etiquette.police);
  });

  it("le texte d'encre reste lisible sur le fond de l'étiquette de chaque jeu (4,5:1)", () => {
    for (const f of fiches) expect(rapportContraste(valeurJeton("dj-encre"), f.etiquette.fond), f.id).toBeGreaterThanOrEqual(4.5);
  });

  it("chaque jeu a sa feuille : le sélecteur d'amis et, s'il a un dessin propre, son étiquette", () => {
    for (const f of fiches) {
      expect(css("amis.css"), `.dj-amis-selecteur--${f.id} dans amis.css`).toContain(`.dj-amis-selecteur--${f.id} {`);
      if (f.etiquette.dessin === "propre") expect(css("composants.css"), `.${f.id}-etiquette dans composants.css`).toContain(`.${f.id}-etiquette {`);
    }
  });
});
