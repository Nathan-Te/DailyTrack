import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { POIDS_MAX } from "../../../scripts/images-partage.mjs";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { CLES_MESUREES, LIGNES_JUMP, LIGNES_TOWER, LIGNES_TRACK, lignesDesJeuxNeufs, mesureJeuNeuf } from "../../../scripts/budgets.mjs";
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

  it("lot K8 : `budget.demande` — une ligne à la demande mesurée se déclare dans la fiche, sans toucher à scripts/budgets.mjs", () => {
    // Pinball et Rush : la ligne `rendu`, famille « à la demande », dans les lignes de leur fiche, au tableau et dans les mesures du job.
    for (const id of ["pinball", "rush"]) {
      const fiche = (lireFichesBrutes(ROOT) as { id: string; brut: { budget: { lignes: string[]; aLaDemande: string[]; demande?: { nom: string; prefixes: string[] }[] } } }[]).find((f) => f.id === id)!;
      expect(fiche.brut.budget.demande?.map((d) => d.nom), id).toEqual(["rendu"]);
      expect(fiche.brut.budget.lignes, id).toContain(`${id}.rendu`);
      expect(lignes[`${id}.rendu`]?.famille, `${id}.rendu`).toBe("demande");
      expect(CLES_MESUREES, id).toContain(`${id}.rendu`);
      // Un morceau à la demande ne compte jamais dans le premier chargement : ses préfixes sont aussi dans `aLaDemande`.
      for (const p of fiche.brut.budget.demande![0]!.prefixes) expect(fiche.brut.budget.aLaDemande, `${id} : ${p}`).toContain(p);
    }
    // Pour toute fiche : chaque ligne déclarée par `demande` est aussi dans `lignes` (et inversement, toute ligne au-delà des trois d'office est déclarée).
    for (const f of lireFichesBrutes(ROOT) as { id: string; brut: { budget: { lignes: string[]; demande?: { nom: string }[] } } }[]) {
      if (["track", "jump", "tower"].includes(f.id)) continue;
      const declarees = (f.brut.budget.demande ?? []).map((d) => `${f.id}.${d.nom}`);
      for (const cle of declarees) expect(f.brut.budget.lignes, f.id).toContain(cle);
      for (const cle of f.brut.budget.lignes) if (!["jsCss", "anglais", "polices"].includes(cle.slice(f.id.length + 1))) expect(declarees, `${cle} : une ligne au-delà des trois d'office se déclare dans budget.demande`).toContain(cle);
    }
    expect(lignesDesJeuxNeufs()).toContain("pinball.rendu");
  });

  it("lot K8 : `mesureJeuNeuf` mesure une ligne déclarée (somme gzip des JS et CSS aux préfixes), et le premier chargement ne la compte pas", () => {
    const tmp = mkdtempSync(join(tmpdir(), "budgets-k8-"));
    try {
      const dist = join(tmp, "dist/assets");
      mkdirSync(dist, { recursive: true });
      writeFileSync(join(tmp, "dist/index.html"), "<html></html>");
      const gros = "x".repeat(5000) + "abcdefghij".repeat(200);
      writeFileSync(join(dist, "main-aaaa.js"), "console.log(1);");
      writeFileSync(join(dist, "corps-aaaa.js"), gros);
      writeFileSync(join(dist, "corps-bbbb.css"), gros);
      writeFileSync(join(dist, "dessin-cccc.js"), gros);
      writeFileSync(join(dist, "autre-dddd.js"), gros);
      const fiche = { id: "fictif", app: "fictif", budgetALaDemande: ["corps-", "dessin-"], budgetDemande: [{ nom: "rendu", prefixes: ["corps-", "dessin-"] }, { nom: "vide", prefixes: ["rien-"] }] };
      const m = mesureJeuNeuf(fiche, dist);
      const sans = mesureJeuNeuf({ id: "fictif", app: "fictif", budgetALaDemande: ["corps-", "dessin-"] }, dist);
      expect(m.rendu).toBeGreaterThan(0);
      expect(m.vide).toBe(0);
      expect(m.jsCss).toBe(sans.jsCss); // la ligne mesurée ne change rien au premier chargement
      expect(sans.rendu).toBeUndefined();
      // `corps-` seul vaut moins que `corps-` + `dessin-` : la somme suit les préfixes.
      expect(mesureJeuNeuf({ ...fiche, budgetDemande: [{ nom: "rendu", prefixes: ["corps-"] }] }, dist).rendu).toBeLessThan(m.rendu);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("la CI : le job « Budgets » contrôle le tableau, et la fusion en dépend (verdict `test`)", () => {
    const ci = lire(".github/workflows/ci.yml");
    expect(ci).toContain("node scripts/budgets-controle.mjs");
    expect(ci).toMatch(/needs: \[scope, unit, zones, budgets, jeu-fictif, kit-bout-en-bout\]/); // lot K4e : le jeu fictif bloque aussi la fusion
    expect(ci).toContain("name: Budgets");
  });
});
