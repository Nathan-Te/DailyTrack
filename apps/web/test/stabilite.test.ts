import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Lot R3 (plateforme) : la liste des preuves de stabilité (`e2e/stabilite.json`, rejouée par .github/workflows/stabilite.yml) nomme de vrais
// tests, au moins 30 passages de suite, sans relance.
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const list = JSON.parse(read("../../../e2e/stabilite.json")) as { repetitions: number; tests: { jeu: string; fichier: string; titre: string; navigateur: string }[] };
const wf = read("../../../.github/workflows/stabilite.yml");

describe("preuves de stabilité", () => {
  it("au moins 30 passages de suite, sans relance", () => {
    expect(list.repetitions).toBeGreaterThanOrEqual(30);
    expect(wf).toContain("--retries=0");
    expect(wf).toContain('--repeat-each="$N"');
  });

  it("chaque entrée nomme un spec qui existe, un navigateur connu, un titre présent dans le fichier", () => {
    expect(list.tests.length).toBeGreaterThan(0);
    for (const t of list.tests) {
      const path = new URL(`../../${t.jeu === "jump" ? "jump" : "web"}/e2e/${t.fichier}`, import.meta.url);
      expect(["web", "jump"], t.fichier).toContain(t.jeu);
      expect(["chromium", "firefox", "webkit"], t.fichier).toContain(t.navigateur);
      expect(existsSync(path), t.fichier).toBe(true);
      if (t.titre) expect(readFileSync(path, "utf8"), `${t.fichier} › ${t.titre}`).toContain(t.titre);
      // Lot R13 : Firefox et WebKit ne lancent que le petit ensemble `@navigateurs` ; une preuve sur l'un d'eux nomme un spec qui en a.
      if (t.navigateur !== "chromium") expect(readFileSync(path, "utf8"), `${t.fichier} : aucun test @navigateurs`).toContain("@navigateurs");
    }
  });

  it("le workflow se lance quand la liste change, et à la demande", () => {
    expect(wf).toContain("- e2e/stabilite.json");
    expect(wf).toContain("workflow_dispatch:");
  });
});
