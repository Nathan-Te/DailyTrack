import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dureesDeLEnvironnement, ecarts, mesurerDurees, sourceDeLaNuit, superposer, validerDurees } from "../../../scripts/durees-e2e.mjs";
import { assignParts, durees, specFiles } from "../../../scripts/e2e-parts.mjs";

// Lot R16 : les parts de la CI complète et de main sont composées avec les durées mesurées la nuit (artefact `durees-e2e`) ; durees.json du dépôt reste le repli.
const RACINE = new URL("../../..", import.meta.url).pathname;
const test_ = (projectName: string, durations: number[], status = "expected") => ({ projectName, status, results: durations.map((duration) => ({ duration })) });
const rapport = {
  suites: [
    {
      file: "salon.spec.ts",
      specs: [
        { file: "salon.spec.ts", tags: [], tests: [test_("chromium", [40_000, 12_000], "flaky")] }, // relancé : seul le dernier essai compte
        { file: "salon.spec.ts", tags: ["regression"], tests: [test_("chromium", [30_000])] },
        { file: "salon.spec.ts", tags: [], tests: [test_("firefox", [99_000])] }, // un autre navigateur : ignoré
      ],
    },
    { file: "vitesse.spec.ts", specs: [{ file: "vitesse.spec.ts", tags: [], tests: [test_("chromium", [5_000]), test_("chromium", [600_000, 600_000], "unexpected")] }] },
    { file: "mobile.spec.ts", specs: [{ file: "mobile.spec.ts", tags: [], tests: [test_("jump-chromium", [45_400])] }] },
    { file: "partie.spec.ts", suites: [{ title: "x", specs: [{ file: "partie.spec.ts", tags: [], tests: [test_("tower-chromium", [12_600])] }] }] },
  ],
};

describe("durées mesurées la nuit (lot R16)", () => {
  it("mesure : dernier essai seulement, l'Essentiel sans @regression, un fichier en échec laissé de côté, un jeu par projet", () => {
    const m = mesurerDurees(rapport);
    expect(m.web).toEqual({ secondes: { "salon.spec.ts": 42 }, essentiel: { "salon.spec.ts": 12 } });
    expect(m.jump).toEqual({ secondes: { "mobile.spec.ts": 45 }, essentiel: { "mobile.spec.ts": 45 } });
    expect(m.tower!.secondes).toEqual({ "partie.spec.ts": 13 });
    expect(validerDurees(m)).toEqual(m);
  });

  it("une donnée abîmée est refusée (jeu, nom de spec, durée), et `E2E_DUREES` illisible vaut « rien » pour toutes les parts", () => {
    for (const brut of [null, [], { autre: { secondes: {}, essentiel: {} } }, { web: { secondes: { "../x.spec.ts": 1 }, essentiel: {} } }, { web: { secondes: { "a.spec.ts": -1 }, essentiel: {} } }, { web: { secondes: { "a.spec.ts": 1.5 }, essentiel: {} } }, { web: { secondes: { "a.spec.ts": 9_999 }, essentiel: {} } }, { web: { secondes: {} } }]) {
      expect(() => validerDurees(brut), JSON.stringify(brut)).toThrow();
    }
    expect(dureesDeLEnvironnement("", "web")).toBeNull();
    expect(dureesDeLEnvironnement("{pas du json", "web")).toBeNull();
    expect(dureesDeLEnvironnement(JSON.stringify({ web: { secondes: { "a.spec.ts": 1 }, essentiel: { "a.spec.ts": 0 } } }), "web", { essentiel: true })).toEqual({ "a.spec.ts": 0 });
  });

  it("une durée n'est qu'un poids : avec n'importe quelles durées mesurées, chaque spec du dépôt est dans exactement une part", () => {
    const fichiers = specFiles();
    const base = durees();
    const bizarres = Object.fromEntries(fichiers.slice(0, 20).map((f, i) => [f, (i * 37) % 900]));
    for (const mesure of [null, bizarres, { "fantome-inexistant.spec.ts": 3_000 }]) {
      const parts = assignParts(fichiers, superposer(base, mesure), 8);
      expect(parts.flatMap((p) => p.files).sort()).toEqual([...fichiers].sort());
    }
  });

  it("la commande de la part lit `E2E_DUREES` : les 8 parts, avec la même chaîne, couvrent tous les specs une seule fois", () => {
    const env = { PATH: process.env.PATH ?? "", E2E_DUREES: JSON.stringify({ web: { secondes: { "thumbnails.spec.ts": 100, "salon.spec.ts": 900 }, essentiel: {} } }) };
    const vus: string[] = [];
    for (let i = 1; i <= 8; i++) {
      const r = spawnSync(process.execPath, ["scripts/e2e-parts.mjs", `${i}/8`, "chromium"], { cwd: RACINE, env, encoding: "utf8" });
      expect(r.status).toBe(0);
      expect(r.stderr).toContain("durées mesurées la nuit pour 2 spec(s) de web");
      vus.push(...r.stdout.trim().split("\n").map((l) => l.replace("[chromium] › ", "")));
    }
    expect(vus.sort()).toEqual(specFiles().sort());
  });

  it("seul un run de NUIT de ci.yml sur main, avec un artefact non expiré, est une source", async () => {
    const reponses: Record<string, unknown> = {
      "/repos/x/y/actions/workflows/ci.yml/runs?event=schedule&branch=main&status=completed&per_page=5": {
        workflow_runs: [
          { id: 1, event: "pull_request", head_branch: "main", path: ".github/workflows/ci.yml" },
          { id: 2, event: "schedule", head_branch: "branche", path: ".github/workflows/ci.yml" },
          { id: 3, event: "schedule", head_branch: "main", path: ".github/workflows/ci.yml" },
          { id: 4, event: "schedule", head_branch: "main", path: ".github/workflows/ci.yml" },
        ],
      },
      "/repos/x/y/actions/runs/3/artifacts?name=durees-e2e": { artifacts: [{ name: "durees-e2e", expired: true }] },
      "/repos/x/y/actions/runs/4/artifacts?name=durees-e2e": { artifacts: [{ name: "durees-e2e", expired: false }] },
    };
    const lus: string[] = [];
    const lire = async (chemin: string) => (lus.push(chemin), reponses[chemin] ?? { artifacts: [] });
    expect(await sourceDeLaNuit("x/y", "t", lire)).toBe("4");
    expect(lus.some((c) => c.includes("/runs/1/") || c.includes("/runs/2/"))).toBe(false);
    expect(await sourceDeLaNuit("x/y", "t", async () => ({ workflow_runs: [] }))).toBe("");
  });

  it("les écarts nommés : au moins 30 s et 25 %, et les specs absents du dépôt", () => {
    expect(ecarts({ a: 100, b: 100, c: 10 }, { a: 140, b: 120, c: 30, d: 5 })).toEqual([
      { nom: "a", depot: 100, mesure: 140 },
      { nom: "d", depot: null, mesure: 5 },
    ]);
  });

  it("ci.yml : la nuit publie l'artefact, `scope` le lit hors PR (lecture seule) et toutes les parts reçoivent la même chaîne", () => {
    const ci = readFileSync(`${RACINE}.github/workflows/ci.yml`, "utf8");
    expect(ci).toMatch(/ {2}scope:\n(?:.*\n){0,3}\s+permissions:\n\s+contents: read\n\s+actions: read\n/);
    expect(ci).toContain("durees: ${{ steps.durees.outputs.durees }}");
    expect(ci).toContain("if: steps.scope.outputs.mode != 'pr'");
    expect(ci).toContain("E2E_DUREES: ${{ needs.scope.outputs.durees }}");
    expect(ci).toMatch(/if: always\(\) && env\.MODE == 'nuit' && env\.RAPPORTS == 'true'[^\n]*\n\s+with:\n\s+name: durees-e2e\n/);
    // Le bouton appelle ci.yml : il lui accorde la lecture des runs, rien de plus.
    const prod = readFileSync(`${RACINE}.github/workflows/production.yml`, "utf8");
    expect(prod).toMatch(/ {2}ci:\n(?:.*\n){0,4}\s+permissions:\n\s+contents: read\n\s+actions: read\n\s+uses: \.\/\.github\/workflows\/ci\.yml/);
  });
});
