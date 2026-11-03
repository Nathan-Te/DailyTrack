import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SUITES, navigateurDuProjet, projetDe, suiteDuProjet } from "../../../scripts/fiches-lecture.mjs";
import { commandesDUnePart, commandesDeConstruction, commandesDeConstructionDePr, commandesDeLaPartDePr, commandesDuPetitEnsemble, rassemblerRapports } from "../../../scripts/e2e-suite.mjs";

// Lot K4 (partie 1) : les étapes e2e de la CI viennent des fiches des jeux (scripts/e2e-suite.mjs) ; ces tests gardent le calcul, pas le workflow.
const ci = readFileSync(new URL("../../../.github/workflows/ci.yml", import.meta.url), "utf8");
// Les jobs e2e seulement : le contrôle de l'image du serveur (job `api-image`) vérifie les niveaux figés de Jump dans leur format propre (reste à généraliser avec le smoke des jeux neufs).
const code = ci.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
const e2eSeul = code.slice(code.indexOf("  e2e-parts:"), code.indexOf("  api-image:"));

describe("les suites e2e, lues dans les fiches", () => {
  it("chaque jeu a sa suite, son espace de travail et son projet Playwright ; Track, qui héberge les specs du portail, a le préfixe vide", () => {
    expect(SUITES.map((s) => [s.id, s.suite, s.espace, s.projet])).toEqual([
      ["track", "web", "@cdj/web", ""],
      ["jump", "jump", "@cdj/jump", "jump-"],
      ["tower", "tower", "@cdj/tower", "tower-"],
    ]);
    expect(SUITES.filter((s) => s.projet === "")).toHaveLength(1);
    expect(projetDe("web", "chromium")).toBe("chromium");
    expect(projetDe("jump", "firefox")).toBe("jump-firefox");
    expect(suiteDuProjet("tower-webkit")?.suite).toBe("tower");
    expect(suiteDuProjet("chromium")?.suite).toBe("web");
    expect(navigateurDuProjet("jump-chromium")).toBe("chromium");
    expect(navigateurDuProjet("firefox")).toBe("firefox");
  });

  it("la construction : la suite hôte et le petit ensemble construisent tout et le serveur ; un autre jeu se construit seul", () => {
    const tout = [{ cmd: "npm", args: ["run", "build"] }, { cmd: "npm", args: ["run", "build:node", "-w", "@cdj/api"] }];
    expect(commandesDeConstruction("web")).toEqual(tout);
    expect(commandesDeConstruction("navigateurs")).toEqual(tout);
    expect(commandesDeConstruction("jump")).toEqual([{ cmd: "npm", args: ["run", "build", "-w", "@cdj/jump"] }]);
    expect(() => commandesDeConstruction("inconnu")).toThrow(/inconnue/);
  });

  it("le petit ensemble : une commande par jeu, son projet, son rapport", () => {
    expect(commandesDuPetitEnsemble("webkit").map((c) => [c.args[3], c.args[5], c.rapport])).toEqual([
      ["@cdj/web", "--project=webkit", "report-webkit-web.zip"],
      ["@cdj/jump", "--project=jump-webkit", "report-webkit-jump.zip"],
      ["@cdj/tower", "--project=tower-webkit", "report-webkit-tower.zip"],
    ]);
  });

  it("une part de la CI complète : la liste de e2e-parts.mjs sur le projet du jeu, puis un test à la fois", () => {
    const c = commandesDUnePart("tower", "1/1", { partsOpt: ["--essentiel"], pwOpt: ["--grep-invert=@regression"] });
    expect(c.liste.args).toEqual(["scripts/e2e-parts.mjs", "1/1", "tower-chromium", "--essentiel"]);
    expect(c.test("/x/part.txt").args).toEqual(["run", "e2e", "-w", "@cdj/tower", "--", "--project=tower-chromium", "--workers=1", "--test-list", "/x/part.txt", "--grep-invert=@regression"]);
  });

  it("une part de PR : les suites qui ont des specs seulement ; la suite hôte construit tout, sinon chaque jeu se construit seul", () => {
    const m = { part: "1/1", web: "", jump: "a.spec.ts b.spec.ts", tower: "c.spec.ts" };
    expect(commandesDeLaPartDePr(m, "2").map((c) => [c.suite, c.rapport, c.specs])).toEqual([
      ["jump", "report-pr-jump-2.zip", ["jump/a.spec.ts", "jump/b.spec.ts"]],
      ["tower", "report-pr-tower-2.zip", ["tower/c.spec.ts"]],
    ]);
    expect(commandesDeConstructionDePr(m).map((c) => c.args.at(-1))).toEqual(["@cdj/jump", "@cdj/tower"]);
    expect(commandesDeConstructionDePr({ ...m, web: "x.spec.ts" }).map((c) => c.args.join(" "))).toEqual(["run build", "run build:node -w @cdj/api"]);
  });

  it("les rapports de tous les jeux sont rassemblés à plat dans un seul dossier", () => {
    const racine = mkdtempSync(join(tmpdir(), "e2e-suite-"));
    for (const app of ["web", "tower"]) {
      mkdirSync(join(racine, "apps", app, "blob-report"), { recursive: true });
      writeFileSync(join(racine, "apps", app, "blob-report", `report-${app}.zip`), app);
    }
    mkdirSync(join(racine, "apps", "jump"), { recursive: true });
    expect(rassemblerRapports(join(racine, "tous"), racine)).toBe(2);
    expect(readFileSync(join(racine, "tous", "report-tower.zip"), "utf8")).toBe("tower");
  });

  it("ci.yml n'écrit plus aucun jeu dans ses étapes e2e : il appelle le script, qui lit les fiches", () => {
    for (const mot of ["@cdj/jump", "@cdj/tower", "jump-chromium", "tower-chromium", "apps/jump/", "apps/tower/", "matrix.suite == 'jump'", "matrix.suite == 'tower'", "matrix.tower", "matrix.jump"]) expect(e2eSeul, mot).not.toContain(mot);
    for (const cmd of ["e2e-suite.mjs construire ", "e2e-suite.mjs part ", "e2e-suite.mjs petit-ensemble ", "e2e-suite.mjs construire-pr", "e2e-suite.mjs pr", "e2e-suite.mjs blobs "]) expect(e2eSeul, cmd).toContain(cmd);
  });
});
