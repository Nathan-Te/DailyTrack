import { describe, expect, it } from "vitest";
import { LIGNES_D_ERREUR, choisirRun, extraireEchecs, verdictParJob } from "../../../scripts/attendre-ci.mjs";
import { decider } from "../../../scripts/ci-zones.mjs";
import { LIGNES_D_ECHEC, etapes, finDuJournal } from "../../../scripts/verifier.mjs";

// Lot R10 : les deux outils de l'agent — `npm run attendre-ci` (une commande bloquante et silencieuse, verdict par job, tests rouges et 20 lignes
// d'erreur au plus) et `npm run verifier` (les mêmes tests que la CI de PR, en local, une ligne par étape).
const horodate = (l: string) => `2026-10-26T00:12:03.1234567Z ${l}`;

describe("attendre-ci : quel run suivre", () => {
  const run = (id: number, event: string, created: string, sha = "abc") => ({ id, event, created_at: created, head_sha: sha });
  it("le run d'une PR pour ce commit, le plus récent ; à défaut le `push` ; rien si le commit n'a pas de run", () => {
    const runs = [run(1, "push", "2026-10-26T10:00:00Z"), run(2, "pull_request", "2026-10-26T09:00:00Z"), run(3, "pull_request", "2026-10-26T09:30:00Z"), run(4, "pull_request", "2026-10-26T11:00:00Z", "autre")];
    expect(choisirRun(runs, "abc")!.id).toBe(3);
    expect(choisirRun([run(1, "push", "2026-10-26T10:00:00Z")], "abc")!.id).toBe(1);
    expect(choisirRun(runs, "inconnu")).toBeNull();
    expect(choisirRun(undefined, "abc")).toBeNull();
  });
});

describe("attendre-ci : le verdict par job", () => {
  it("un symbole et une durée par job ; les jobs sautés sont comptés, pas listés", () => {
    const l = verdictParJob([
      { name: "unit (1/2)", conclusion: "success", started_at: "2026-10-26T00:00:00Z", completed_at: "2026-10-26T00:02:30Z" },
      { name: "e2e-pr (1/2)", conclusion: "failure", started_at: "2026-10-26T00:00:00Z", completed_at: "2026-10-26T00:04:00Z" },
      { name: "api-image", conclusion: "skipped", started_at: null, completed_at: null },
    ]);
    expect(l).toEqual(["✔ unit (1/2) (150 s)", "✘ e2e-pr (1/2) (240 s) — failure", "– 1 job(s) sauté(s) (rien à lancer pour ces fichiers)"]);
  });
});

describe("attendre-ci : ce qu'on lit d'un journal en échec", () => {
  const playwright = [
    "Running 3 tests using 1 worker",
    "  ✓  1 [chromium] › e2e/a.spec.ts:3:1 › passe (1.0s)",
    "  1) [chromium] › e2e/watch.spec.ts:239:1 › Salon (démo) : revoir le meilleur tour ──────────",
    "",
    "    Error: Démo Bouchon 40095 dans la liste",
    "    expect(received).toBe(expected) // Object.is equality",
    "    Expected: true",
    "  2) [chromium] › e2e/salon.spec.ts:10:1 › second ────",
    "    Error: boom",
    "##[error]Process completed with exit code 1.",
  ].map(horodate).join("\n");

  it("Playwright : le nom des tests rouges, puis l'erreur de chacun, sans horodatage", () => {
    const e = extraireEchecs(playwright);
    expect(e.tests).toEqual(["1) [chromium] › e2e/watch.spec.ts:239:1 › Salon (démo) : revoir le meilleur tour", "2) [chromium] › e2e/salon.spec.ts:10:1 › second"]);
    expect(e.erreur[0]).toContain("Error: Démo Bouchon");
    expect(e.erreur.join("\n")).toContain("Error: boom");
    expect(e.erreur.join("\n")).not.toMatch(/2026-10-26T/);
  });

  it("Vitest : le fichier et le test rouges ; la ligne `Process completed` n'est pas un test rouge", () => {
    const journal = [" FAIL  |sqlite| packages/sim/test/generator.test.ts > circuit du jour > construit vite", "AssertionError: expected 3594 to be less than 3500", "##[error]Process completed with exit code 1."].map(horodate).join("\n");
    const e = extraireEchecs(journal);
    expect(e.tests).toEqual(["packages/sim/test/generator.test.ts > circuit du jour > construit vite"]);
    expect(e.erreur[0]).toContain("AssertionError");
  });

  it(`jamais plus de ${LIGNES_D_ERREUR} lignes d'erreur, ni plus de 30 noms de tests`, () => {
    const beaucoup = Array.from({ length: 80 }, (_, i) => `  ${i + 1}) [chromium] › e2e/x${i}.spec.ts:1:1 › t${i}\n    Error: e${i}\n    ligne 2\n    ligne 3`).join("\n");
    const e = extraireEchecs(beaucoup);
    expect(e.erreur.length).toBeLessThanOrEqual(LIGNES_D_ERREUR);
    expect(e.tests.length).toBe(30);
    expect(e.autres).toBe(50);
  });
});

describe("verifier : les mêmes étapes que la CI", () => {
  it("docs seuls : aucune étape lourde ; sinon typecheck, tests unitaires choisis, puis construction et specs du jeu touché seulement", () => {
    expect(etapes(decider([["docs", "un-guide-que-personne-ne-lit.md"].join("/")]))).toEqual([]);
    const plan = etapes(decider(["apps/jump/src/hud.ts"])).map((e) => e.nom);
    expect(plan[0]).toBe("typecheck");
    expect(plan.some((n) => n.startsWith("tests unitaires (SQLite"))).toBe(true);
    expect(plan.some((n) => n.startsWith("e2e DailyJump"))).toBe(true);
    expect(plan.some((n) => n.startsWith("e2e DailyTrack"))).toBe(false);
  });

  it("--sans-e2e et --zones", () => {
    const d = decider(["apps/jump/src/hud.ts"]);
    expect(etapes(d, { sansE2e: true }).some((e) => e.nom.startsWith("e2e"))).toBe(false);
    const avec = etapes(d, { extra: { web: ["salon.spec.ts"], jump: [] } });
    expect(avec.find((e) => e.nom.startsWith("e2e DailyTrack"))!.args).toContain("e2e/salon.spec.ts");
  });

  it(`un échec ne montre que la fin du journal (${LIGNES_D_ECHEC} lignes), sans couleurs`, () => {
    const long = Array.from({ length: 200 }, (_, i) => `\u001b[31mligne ${i}\u001b[0m`).join("\n");
    const fin = finDuJournal(long).split("\n");
    expect(fin).toHaveLength(LIGNES_D_ECHEC);
    expect(fin.at(-1)).toBe("ligne 199");
  });
});
