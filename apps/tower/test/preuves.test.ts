import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { nettoyerDossier, retirerPreuve, sansPreuveEnProduction } from "../preuves";

// Lot T3 — règle R9 : la preuve de l'auteur ne quitte jamais le serveur. La construction de production retire le champ `preuve` de tout fichier de jour publié ; hors production il reste (`?bot`).
const FIXTURE = new URL("../../../packages/tower-sim/test/fixtures/jours/2026-11-06.json", import.meta.url).pathname;
const TEXTE = readFileSync(FIXTURE, "utf8");

describe("retirerPreuve", () => {
  it("le fichier préparé a une preuve ; sans elle, c'est le même texte moins la ligne `preuve`, et le reste n'a pas bougé", () => {
    expect(TEXTE).toContain('"preuve"');
    const propre = retirerPreuve(TEXTE);
    expect(propre).not.toContain("preuve");
    const avant = JSON.parse(TEXTE) as Record<string, unknown>;
    const apres = JSON.parse(propre) as Record<string, unknown>;
    delete avant.preuve;
    expect(apres).toEqual(avant);
    expect(propre.endsWith('"bronze": ' + (apres.medailles as { bronze: number }).bronze + " }\n}\n")).toBe(true);
  });
  it("un fichier sans preuve (un jour seulement figé) est rendu tel quel", () => {
    const propre = retirerPreuve(TEXTE);
    expect(retirerPreuve(propre)).toBe(propre);
  });
});

describe("le greffon de construction", () => {
  const dossierDeSortie = (): string => {
    const racine = mkdtempSync(`${tmpdir()}/tower-dist-`);
    mkdirSync(`${racine}/dist/jours`, { recursive: true });
    copyFileSync(FIXTURE, `${racine}/dist/jours/2026-11-06.json`);
    writeFileSync(`${racine}/dist/jours/2026-11-07.json`, retirerPreuve(TEXTE));
    return racine;
  };
  const lancer = (racine: string, production: boolean): void => {
    const plugin = sansPreuveEnProduction() as unknown as { configResolved(c: unknown): void; closeBundle(): void };
    plugin.configResolved({ env: { VITE_PRODUCTION: production ? "1" : "" }, root: racine, build: { outDir: "dist" } });
    plugin.closeBundle();
  };

  it("en production : plus aucune preuve dans `jours/`", () => {
    const racine = dossierDeSortie();
    lancer(racine, true);
    for (const f of ["2026-11-06.json", "2026-11-07.json"]) expect(readFileSync(`${racine}/dist/jours/${f}`, "utf8")).not.toContain("preuve");
  });
  it("hors production (aperçu, local) : la preuve reste, pour `?bot`", () => {
    const racine = dossierDeSortie();
    lancer(racine, false);
    expect(readFileSync(`${racine}/dist/jours/2026-11-06.json`, "utf8")).toContain('"preuve"');
  });
  it("nettoyerDossier rend les fichiers changés, et ne touche pas à un dossier absent", () => {
    const racine = dossierDeSortie();
    expect(nettoyerDossier(`${racine}/dist/jours`)).toEqual(["2026-11-06.json"]);
    expect(nettoyerDossier(`${racine}/rien`)).toEqual([]);
  });
});
