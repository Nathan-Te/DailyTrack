import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { VARIANTE } from "@cdj/blocks-sim";

// Lot B4 — « Blocks » est un jeu d'ARCADE (règle A3, `docs/regles/racine/publication-des-jeux.md`) : sa section « Arcade » à l'accueil, son onglet après le séparateur « Arcade » de `/classement/`, jamais dans le
// cumul, la journée parfaite, la série ni la ligne de partage du portail. Ce fichier garde l'accord de la fiche et de ce que le portail lit (sa projection) ; la logique des onglets et de la section est celle du portail (ses tests, avec Tower et Blocks) ;
// le parcours avec le vrai serveur (`/api/portail/jour`, le cumul, la série) est dans `apps/api/test/blocksArcade.test.ts` et `apps/blocks/e2e/arcade.spec.ts`. Les pages du portail elles-mêmes sont à la plateforme.
const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/blocks.json", import.meta.url), "utf8")) as {
  categorie: string;
  categorieDepuis?: string;
  classement: { cumul: boolean; colonnes: { nom: string; sens: string }[] };
};

describe("Blocks est d'arcade, dès sa naissance", () => {
  it("la fiche : catégorie arcade (sans `categorieDepuis` : il naît dans sa catégorie), hors cumul", () => {
    expect(fiche.categorie).toBe("arcade");
    expect(fiche.categorieDepuis).toBeUndefined();
    expect(fiche.classement.cumul).toBe(false);
  });
  it("la projection que le portail lit (`config/jeux/projections/portail.json`, écrite par `npm run fiches`) dit la même chose : arcade, hors cumul — c'est elle qui range son onglet de classement après le séparateur « Arcade » et sa cartouche dans la section Arcade de l'accueil", () => {
    const projection = JSON.parse(readFileSync(new URL("../../../config/jeux/projections/portail.json", import.meta.url), "utf8")) as { jeux: { id: string; categorie?: string; cumul?: boolean }[] };
    const blocks = projection.jeux.find((j) => j.id === "blocks")!;
    expect(blocks.categorie).toBe("arcade");
    expect(blocks.cumul).toBe(false);
    // Les jeux du jour, eux, n'ont pas de catégorie d'arcade : seul un jeu d'arcade se range après le séparateur.
    for (const j of projection.jeux.filter((x) => x.id === "track" || x.id === "jump")) expect(j.categorie ?? "jour").toBe("jour");
  });
});

describe("le départage du classement : score ↓, puis combo maximal ↓, puis le premier arrivé", () => {
  it("la fiche : score ↓, combo ↓, puis les deux départages de la plateforme (`submitted_at` ↑ : le premier arrivé, `player_id` ↑)", () => {
    expect(fiche.classement.colonnes).toEqual([
      { nom: "score", sens: "desc" },
      { nom: "combo", sens: "desc" },
      { nom: "submitted_at", sens: "asc" },
      { nom: "player_id", sens: "asc" },
    ]);
  });
  it("le jeu envoie ces deux colonnes dans cet ordre : `[score, combo maximal]`", () => {
    expect(VARIANTE.fiche.colonnes.map((c) => [c.nom, c.sens])).toEqual([["score", "desc"], ["combo", "desc"]]);
    expect(VARIANTE.score({ score: 4582, combo: 7 })).toEqual([4582, 7]);
  });
});
