import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGUE_COMMUN } from "../src/catalogue";
import { parametresDe, type Catalogue } from "../src/i18n";
import { cataloguesApplications } from "./applications";

// Lot I1 : parité des catalogues (mêmes clés en fr et en, aucune valeur vide, mêmes paramètres des deux côtés), pour le catalogue commun et
// celui de chaque application (liste : test/applications.ts) ; chaque code d'erreur du serveur est traduit dans les deux langues.
const ROOT = join(__dirname, "../../..");
const TOUS: [string, { fr: Catalogue; en: Catalogue }][] = [["packages/ui (commun)", CATALOGUE_COMMUN], ...(await cataloguesApplications())];

describe("catalogues de traduction", () => {
  for (const [nom, cat] of TOUS) {
    it(`${nom} : mêmes clés, aucune valeur vide, mêmes paramètres, mêmes formes plurielles`, () => {
      expect(Object.keys(cat.en).sort(), nom).toEqual(Object.keys(cat.fr).sort());
      expect(Object.keys(cat.fr).length, nom).toBeGreaterThan(3);
      for (const cle of Object.keys(cat.fr)) {
        expect(cle, nom).toMatch(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+)+$/);
        for (const l of ["fr", "en"] as const) {
          const v = cat[l][cle]!;
          const textes = typeof v === "string" ? [v] : Object.values(v);
          for (const x of textes) expect(String(x).trim(), `${nom} ${l} ${cle}`).not.toBe("");
          if (typeof v !== "string") expect(v.other, `${nom} ${l} ${cle} : forme « other » obligatoire`).toBeTruthy();
        }
        expect(parametresDe(cat.en[cle]!), `${nom} ${cle}`).toEqual(parametresDe(cat.fr[cle]!));
        expect(typeof cat.en[cle], `${nom} ${cle} : pluriel des deux côtés ou d'aucun`).toBe(typeof cat.fr[cle]);
      }
    });
  }

  it("aucune clé n'est définie dans deux catalogues (le premier gagnerait en silence)", () => {
    const vues = new Map<string, string>();
    for (const [nom, cat] of TOUS) {
      for (const cle of Object.keys(cat.fr)) {
        expect(vues.get(cle), `${cle} : ${nom} et ${vues.get(cle)}`).toBeUndefined();
        vues.set(cle, nom);
      }
    }
  });

  it("chaque code d'erreur du serveur (apps/api/src/codesErreur.ts) est traduit en français et en anglais, et rien d'autre", async () => {
    // Import par chemin calculé : le module du serveur n'entre pas dans le projet TypeScript de packages/ui.
    const chemin = join(ROOT, "apps/api/src/codesErreur.ts");
    const { CODES_ERREUR } = (await import(/* @vite-ignore */ chemin)) as { CODES_ERREUR: Record<string, { status: number }> };
    const codes = Object.keys(CODES_ERREUR).sort();
    expect(codes.length).toBeGreaterThan(40);
    const traduits = Object.keys(CATALOGUE_COMMUN.fr).filter((k) => k.startsWith("erreur.")).map((k) => k.slice("erreur.".length)).sort();
    expect(traduits).toEqual(codes);
    for (const code of codes) for (const l of ["fr", "en"] as const) expect((CATALOGUE_COMMUN[l] as Catalogue)[`erreur.${code}`], `${l} ${code}`).toBeTruthy();
    expect(readFileSync(chemin, "utf8")).toContain("erreur.<code>");
  });
});
