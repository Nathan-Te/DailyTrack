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
      expect(Object.keys(cat.fr).length, nom).toBeGreaterThanOrEqual(3); // lot I6 : les catalogues des aperçus de partage ont 3 clés
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

  // Lot I5 : la règle vaut **dans une application** (ses catalogues de zone et le catalogue commun, réunis par un même traducteur : le premier
  // gagnerait en silence) ; deux applications différentes (Track, Jump) peuvent avoir la même clé, elles ne partagent jamais un traducteur.
  it("aucune clé n'est définie dans deux catalogues d'une même application, ni dans une application et le catalogue commun", () => {
    const application = (nom: string) => nom.split(" (")[0]!;
    const [commun, ...applis] = TOUS;
    for (const app of new Set(applis.map(([nom]) => application(nom)))) {
      const vues = new Map<string, string>();
      for (const [nom, cat] of [commun!, ...applis.filter(([n]) => application(n) === app)]) {
        for (const cle of Object.keys(cat.fr)) {
          expect(vues.get(cle), `${cle} : ${nom} et ${vues.get(cle)}`).toBeUndefined();
          vues.set(cle, nom);
        }
      }
    }
  });

  it("lot I5 : les répliques de Jump n'ont qu'une source, le catalogue commun (aucune application n'en définit)", () => {
    const communes = Object.keys(CATALOGUE_COMMUN.fr).filter((c) => c.startsWith("jump.replique."));
    expect(communes.length).toBeGreaterThanOrEqual(5);
    for (const [nom, cat] of TOUS.slice(1)) expect(Object.keys(cat.fr).filter((c) => /replique/i.test(c)), nom).toEqual([]);
    // Et aucune réplique recopiée mot pour mot sous une autre clé.
    for (const cle of communes) {
      for (const [nom, cat] of TOUS.slice(1)) {
        for (const l of ["fr", "en"] as const) expect(Object.values(cat[l]).includes(CATALOGUE_COMMUN[l][cle as keyof (typeof CATALOGUE_COMMUN)["fr"]]), `${nom} ${l} : ${cle} en double`).toBe(false);
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
