import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { POIDS_MAX } from "../../../scripts/images-partage.mjs";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { CLES_MESUREES, LIGNES_JUMP, LIGNES_TOWER, LIGNES_TRACK } from "../../../scripts/budgets.mjs";
import { FAMILLES, HORS_JOB, KO, lireLignes, lirePlafonds, lireReleves, plafondKo } from "../../../scripts/budgets-controle.mjs";
import { lireFichesBrutes } from "../../../scripts/fiches-brutes.mjs";

// Lot I6 (plateforme) : docs/plateforme/budgets.md est la référence des budgets. Lot R17 : c'est aussi la SEULE source des plafonds — le job « Budgets » de la CI
// (scripts/budgets-controle.mjs) les lit ici et les compare à `mesuresParLigne` (scripts/budgets.mjs) ; plus aucun test n'en écrit de copie. Ce test vérifie que le tableau et la mesure
// parlent des mêmes lignes (une ligne ajoutée au tableau sans mesure, ou l'inverse, échoue), que chaque ligne est cohérente, et qu'aucun spec ne ramène un plafond.
// Lot B1 : les plafonds sont en Ko, posés une fois par la règle (famille : premier chargement +5 % et 2 Ko, à la demande +10 % et 1 Ko, polices et images +10 %) ; un plafond au-dessus de la règle est un
// relèvement de Nathan, écrit avec sa raison dans la section « Relèvements » de budgets.md.
const ROOT = join(__dirname, "../../..");
const lire = (f: string) => readFileSync(join(ROOT, f), "utf8");
const doc = lire("docs/plateforme/budgets.md");
const plafonds: Record<string, number> = lirePlafonds(doc);
const lignes = lireLignes(doc) as Record<string, { plafond: number; plafondKo: number; famille: keyof typeof FAMILLES; mesure: number }>;
const releves = lireReleves(doc) as Record<string, { date: string; de: number; a: number; raison: string }[]>;

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

  it("chaque ligne a sa famille ; son plafond est en Ko entiers et vaut la règle (mesure à la pose + marge), ou un relèvement de Nathan écrit avec sa raison", () => {
    expect(Object.keys(lignes).length).toBeGreaterThan(30);
    expect(Object.keys(lignes).sort()).toEqual(Object.keys(plafonds).sort());
    for (const [cle, l] of Object.entries(lignes)) {
      expect(Object.keys(FAMILLES), `${cle} : famille`).toContain(l.famille);
      expect(l.plafond, cle).toBe(l.plafondKo * KO);
      const regle = plafondKo(l.famille, l.mesure);
      expect(l.plafondKo, `${cle} : un plafond sous la règle (mesure + marge) n'a pas de raison d'être`).toBeGreaterThanOrEqual(regle);
      if (l.plafondKo > regle) {
        const dernier = (releves[cle] ?? []).at(-1);
        expect(dernier, `${cle} : ${l.plafondKo} Ko au-dessus de la règle (${regle} Ko) : un relèvement décidé par Nathan s'écrit dans « Relèvements » avec sa raison`).toBeDefined();
        expect(dernier!.a, `${cle} : le dernier relèvement écrit`).toBe(l.plafondKo);
        expect(dernier!.raison.length, `${cle} : la raison`).toBeGreaterThan(10);
      }
    }
    // Les familles de la règle : le premier chargement des applications ; les polices et images ; tout le reste « à la demande ».
    for (const cle of ["portail.premier", "track.jsCss", "track.js", "track.horsThree", "jump.jsCss", "tower.jsCss"]) expect(lignes[cle]!.famille, cle).toBe("premier");
    for (const [cle, l] of Object.entries(lignes)) if (cle.endsWith(".polices") || cle === "partage.image") expect(l.famille, cle).toBe("police");
    expect(Object.values(FAMILLES).map((f) => [f.pct, f.plancherKo])).toEqual([[5, 2], [10, 1], [10, 0]]);
  });

  it("la règle : mesure + 5 % et 2 Ko au moins (premier chargement), + 10 % et 1 Ko au moins (à la demande), + 10 % (polices et images), au Ko supérieur", () => {
    expect(plafondKo("premier", 296_956)).toBe(312);
    expect(plafondKo("premier", 35_189)).toBe(38); // 5 % = 1,8 Ko : le plancher de 2 Ko s'applique
    expect(plafondKo("premier", 39_633)).toBe(42);
    expect(plafondKo("premier", 382_856)).toBe(402);
    expect(plafondKo("demande", 149)).toBe(2); // 149 + 1 000 = 1 149 → 2 Ko
    expect(plafondKo("demande", 10_000)).toBe(11);
    expect(plafondKo("police", 100_000)).toBe(110);
    expect(plafondKo("premier", 40_000)).toBe(42); // pile : 40 000 + 2 000 = 42 000 → 42 Ko, pas 43
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
