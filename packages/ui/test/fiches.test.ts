import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ETIQUETTES_PROPRES } from "../src/composants";
import { rapportContraste } from "../src/contraste";
import { ETIQUETTES_FICHES } from "../src/fiches.generated";
import { COULEURS, POLICES, valeurJeton } from "../src/jetons";

// Lot K1 : le socle lit la fiche de chaque jeu qui en a une — les valeurs de son étiquette sont celles des jetons (les NOMS des jetons restent ceux de la charte), et le CSS écrit à la main
// pour ce jeu (étiquette, sélecteur d'amis) existe. Un jeu dont la fiche est ajoutée sans cette feuille échoue ici, au lieu de s'afficher sans couleur.

const RACINE = resolve(__dirname, "..", "..", "..");
// Lot K4e : les fiches du dépôt ET, en essai, celles de `CDJ_FICHES_SUPPLEMENTAIRES` (le jeu fictif de `scripts/jeu-fictif.mjs`).
const { lireFichesBrutes } = (await import(/* @vite-ignore */ join(RACINE, "scripts/fiches-brutes.mjs"))) as typeof import("../../../scripts/fiches-brutes.mjs");
const fiches = lireFichesBrutes(RACINE).map((f) => f.brut as { id: string; etiquette: { fond: string; coque: string; police: string; dessin: string } });
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

  it("Jump (lot K1b) : le jaune et la police de sa charte portent les valeurs de sa fiche ; sa coque est l'encre du socle (l'étiquette est un papier bordé d'encre)", () => {
    const j = fiches.find((f) => f.id === "jump")!;
    expect(COULEURS["jump-jaune"]).toBe(j.etiquette.fond);
    expect(POLICES["jump-police"]).toBe(j.etiquette.police);
    expect(valeurJeton("dj-encre")).toBe(j.etiquette.coque);
  });

  it("Track (lot K1c) : l'asphalte, la coque et la police de sa charte portent les valeurs de sa fiche", () => {
    const t = fiches.find((f) => f.id === "track")!;
    expect(COULEURS["track-asphalte"]).toBe(t.etiquette.fond);
    expect(COULEURS["track-coque"]).toBe(t.etiquette.coque);
    expect(POLICES["track-police"]).toBe(t.etiquette.police);
  });

  it("le texte de l'étiquette reste lisible sur son fond, pour chaque jeu (4,5:1) : de l'encre, sauf Track, sombre, qui écrit en clair", () => {
    for (const f of fiches) expect(rapportContraste(valeurJeton(f.id === "track" ? "track-texte" : "dj-encre"), f.etiquette.fond), f.id).toBeGreaterThanOrEqual(4.5);
  });

  it("chaque jeu a sa feuille : écrite à la main s'il a un dessin propre, tirée de sa fiche (`npm run fiches`) s'il est générique — et un dessin propre ne se déclare que dans `ETIQUETTES_PROPRES`", () => {
    for (const f of fiches) {
      if (f.etiquette.dessin === "propre") {
        expect(css("amis.css"), `.dj-amis-selecteur--${f.id} dans amis.css`).toContain(`.dj-amis-selecteur--${f.id} {`);
        expect(css("composants.css"), `.${f.id}-etiquette dans composants.css`).toContain(`.${f.id}-etiquette {`);
        expect(ETIQUETTES_PROPRES, `un dessin pour ${f.id} dans ETIQUETTES_PROPRES (composants.ts)`).toHaveProperty(f.id);
      } else {
        // Un jeu générique n'écrit aucune règle de style partagée : tout est dans les feuilles générées.
        expect(css("amis.generated.css"), `.dj-amis-selecteur--${f.id} dans amis.generated.css`).toContain(`.dj-amis-selecteur--${f.id} {`);
        expect(css("jeux.generated.css"), `.jeu-etiquette--${f.id} dans jeux.generated.css`).toContain(`.jeu-etiquette--${f.id} {`);
        expect(css("jeux.generated.css"), `.dj-cartouche--${f.id} dans jeux.generated.css`).toContain(`.dj-cartouche--${f.id} {`);
        expect(ETIQUETTES_PROPRES, `${f.id} est générique : pas de dessin propre`).not.toHaveProperty(f.id);
        expect(css("amis.css"), "aucune règle à la main pour un jeu générique").not.toContain(`.dj-amis-selecteur--${f.id} {`);
      }
    }
  });
});
