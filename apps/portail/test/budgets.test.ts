import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { POIDS_MAX } from "../../../scripts/images-partage.mjs";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { CLES_MESUREES, LIGNES_JUMP, LIGNES_TOWER, LIGNES_TRACK } from "../../../scripts/budgets.mjs";
import { HORS_JOB, lirePlafonds } from "../../../scripts/budgets-controle.mjs";
import { lireFichesBrutes } from "../../../scripts/fiches-brutes.mjs";

// Lot I6 (plateforme) : docs/plateforme/budgets.md est la référence des budgets. Lot R17 : c'est aussi la SEULE source des plafonds — le job « Budgets » de la CI
// (scripts/budgets-controle.mjs) les lit ici et les compare à `mesuresParLigne` (scripts/budgets.mjs) ; plus aucun test n'en écrit de copie. Ce test vérifie que le tableau et la mesure
// parlent des mêmes lignes (une ligne ajoutée au tableau sans mesure, ou l'inverse, échoue), que chaque ligne est cohérente (marge = budget − après), et qu'aucun spec ne ramène un plafond.
const ROOT = join(__dirname, "../../..");
const lire = (f: string) => readFileSync(join(ROOT, f), "utf8");
const nombre = (s: string) => Number(s.replace(/[\s ]/g, ""));

const doc = lire("docs/plateforme/budgets.md");
const plafonds: Record<string, number> = lirePlafonds(doc);
/** Les lignes du grand tableau (celles qui portent « avant », « après » et « marge »). */
const lignes = new Map(
  [...doc.matchAll(/^\| `([a-z.A-Z0-9]+)` \| [^|]+\| [^|]+\| ([\d\s]+) \| [^|]+\| ([\d\s]+)[^|]*\| ([\d\s]+) \|/gm)].map((m) => [m[1]!, { budget: nombre(m[2]!), apres: nombre(m[3]!), marge: nombre(m[4]!) }]),
);

describe("lot I6 / R17 : docs/plateforme/budgets.md, la référence et la seule source des plafonds", () => {
  it("chaque ligne du tableau a sa mesure dans le job « Budgets », et chaque mesure sa ligne", () => {
    const sansMesure = Object.keys(plafonds).filter((c) => !(c in HORS_JOB));
    expect(sansMesure.sort()).toEqual([...CLES_MESUREES].sort());
    for (const cle of Object.keys(HORS_JOB)) expect(plafonds[cle], `${cle} : ligne hors job, gardée ailleurs`).toBeGreaterThan(0);
    // Les lignes de Tower de la fiche (K1) sont toutes au tableau.
    for (const cle of LIGNES_TOWER as string[]) expect(plafonds[cle], cle).toBeGreaterThan(0);
    // Lots K1b et K1c : les lignes de Jump et de Track de leur fiche sont exactement les lignes `jump.*` et `track.*` du tableau.
    for (const [jeu, fiche] of [["jump", LIGNES_JUMP], ["track", LIGNES_TRACK]] as const)
      expect([...(fiche as string[])].sort(), `lignes de ${jeu} : sa fiche et le tableau`).toEqual(Object.keys(plafonds).filter((c) => c.startsWith(`${jeu}.`)).sort());
    // Lot K4e : chaque jeu des fiches (celles du dépôt et, en essai, du jeu fictif) a ses lignes au tableau — un jeu neuf obtient ses mesures d'office (`mesureJeuNeuf`).
    for (const f of lireFichesBrutes(ROOT) as { id: string; brut: unknown }[]) for (const cle of (f.brut as { budget: { lignes: string[] } }).budget.lignes) expect(plafonds[cle], `fiche « ${f.id} » : la ligne « ${cle} » manque à docs/plateforme/budgets.md`).toBeGreaterThan(0);
    // Les images de partage sont gardées par scripts/images-partage.mjs : même limite.
    expect(plafonds["partage.image"]).toBe(POIDS_MAX);
  });

  it("chaque ligne est cohérente : marge = budget − après, et l'après tient dans le budget", () => {
    expect(lignes.size).toBeGreaterThan(30);
    for (const [cle, l] of lignes) {
      expect(l.budget, cle).toBe(plafonds[cle]);
      expect(l.marge, cle).toBe(l.budget - l.apres);
      expect(l.apres, cle).toBeLessThanOrEqual(l.budget);
    }
  });

  it("aucun spec ni test ne garde de copie d'un plafond en octets : le contrôle est le job « Budgets »", () => {
    const plafondEnOctets = /\.(toBeLessThan|toBeLessThanOrEqual)\(\s*[\d_]{4,}/;
    const gardes = ["apps/web/e2e/perf.spec.ts", "apps/jump/e2e/poids.spec.ts", "apps/tower/e2e/poids.spec.ts", "apps/portail/test/construction.test.ts"];
    for (const f of gardes) {
      // (les deux délais de chargement d'un téléphone simulé de perf.spec.ts sont des millisecondes ; le fil du générateur de Jump « petit fichier » est une règle de composition, pas une ligne du tableau)
      const lignesDuFichier = lire(f).split("\n").filter((l) => plafondEnOctets.test(l) && !/\bfcp\b|readyMs|petit fichier/.test(l));
      expect(lignesDuFichier, `${f} : un plafond en octets (il vit dans docs/plateforme/budgets.md)`).toEqual([]);
    }
    expect(lire("packages/musique/test/poids.test.ts")).not.toContain("BUDGET_LECTEUR");
    expect(lire("apps/portail/test/construction.test.ts")).not.toContain("BUDGET_PREMIER_CHARGEMENT");
  });

  it("la CI : le job « Budgets » contrôle le tableau, et la fusion en dépend (verdict `test`)", () => {
    const ci = lire(".github/workflows/ci.yml");
    expect(ci).toContain("node scripts/budgets-controle.mjs");
    expect(ci).toMatch(/needs: \[scope, unit, zones, budgets, jeu-fictif\]/); // lot K4e : le jeu fictif bloque aussi la fusion
    expect(ci).toContain("name: Budgets");
  });
});
