import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGUES } from "./applications";
// Chemin calculé : le script du dépôt (scripts/traductions.ts) n'entre pas dans le projet TypeScript de packages/ui.
const { CATALOGUES_RELUS, FICHIER_TRADUCTIONS, documentTraductions } = (await import(/* @vite-ignore */ join(__dirname, "../../../scripts/traductions.ts"))) as {
  CATALOGUES_RELUS: [string, string, { fr: Record<string, unknown> }][];
  FICHIER_TRADUCTIONS: string;
  documentTraductions: () => string;
};

// Lot I6 (plateforme) : docs/plateforme/traductions.md, la relecture des traductions pour Nathan, est produit par `npm run traductions` à partir des
// catalogues ; ce test échoue si le fichier du dépôt n'est pas à jour (un catalogue changé sans relancer la commande) ou si un catalogue y manque.
const ROOT = join(__dirname, "../../..");

describe("lot I6 : la relecture des traductions (docs/plateforme/traductions.md)", () => {
  it("relit exactement les catalogues de packages/ui/test/applications.ts, plus le catalogue commun", () => {
    expect(CATALOGUES_RELUS.map(([nom]) => nom).sort()).toEqual(["packages/ui (commun)", ...CATALOGUES.map(([nom]) => nom)].sort());
  });

  it("le fichier du dépôt est à jour (sinon : npm run traductions)", () => {
    const attendu = documentTraductions();
    expect(readFileSync(join(ROOT, FICHIER_TRADUCTIONS), "utf8") === attendu, `${FICHIER_TRADUCTIONS} n'est pas à jour : npm run traductions`).toBe(true);
    // Chaque clé de chaque catalogue y a sa ligne, avec son anglais.
    const total = CATALOGUES_RELUS.reduce((n, [, , c]) => n + Object.keys(c.fr).length, 0);
    expect(attendu.split("\n").filter((l) => l.startsWith("| `")).length).toBe(total);
    expect(total).toBeGreaterThan(500);
  });
});
