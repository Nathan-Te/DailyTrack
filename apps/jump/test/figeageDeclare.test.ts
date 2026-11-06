import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Lot 33 (incident du 06/11/2026) : **l'outil de figeage (`freeze:days`) écrit le niveau que la production sert**. Lancé dans Node, il ne déclarait pas à la simulation les niveaux déjà figés d'un
// ancien générateur (la construction du jeu le fait, pas l'outil) : le thème et la variété des jours qui suivent étaient calculés sans eux, et les fichiers du 03 au 06/11/2026 n'étaient pas les niveaux
// servis. Ce test lance l'outil pour de vrai (comme « Mettre en production ») sur les fichiers d'avant le 03/11 et exige l'empreinte du fichier committé, que le serveur d'avant servait.

const DEPOT = join(import.meta.dirname, "../../..");
const NIVEAUX = join(import.meta.dirname, "../public/levels");

describe("freeze:days déclare les niveaux déjà figés avant de générer", () => {
  it("le fichier qu'il écrit pour le 03/11/2026 est celui du dépôt (même empreinte, même identifiant, mêmes médailles)", () => {
    const dossier = mkdtempSync(join(tmpdir(), "figeage-"));
    try {
      for (const f of readdirSync(NIVEAUX)) if (/^\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(0, 10) <= "2026-11-02") copyFileSync(join(NIVEAUX, f), join(dossier, f));
      const sortie = join(dossier, "outil.mjs");
      execFileSync(join(DEPOT, "node_modules/.bin/esbuild"), ["tools/freeze-days.ts", "--bundle", "--platform=node", "--format=esm", "--target=node22", `--outfile=${sortie}`, "--log-level=warning"], { cwd: join(DEPOT, "apps/jump") });
      execFileSync(process.execPath, [sortie, "2026-11-03", `--dir=${dossier}`], { cwd: join(DEPOT, "apps/jump"), stdio: "pipe" });
      const ecrit = JSON.parse(readFileSync(join(dossier, "2026-11-03.json"), "utf8")) as { hash: string; id: string; medailles: unknown; auteur: number };
      const depot = JSON.parse(readFileSync(join(NIVEAUX, "2026-11-03.json"), "utf8")) as typeof ecrit;
      expect(ecrit.hash).toBe(depot.hash);
      expect(ecrit.id).toBe(depot.id);
      expect(ecrit.medailles).toEqual(depot.medailles);
      expect(ecrit.auteur).toBe(depot.auteur);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  }, 120_000);
});
