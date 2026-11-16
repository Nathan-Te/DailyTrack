import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { dailyGravity, lireJourFige, seuilsDuRobot } from "../src/index";

// Lot GR5 — l'outil `npm run preparer:gravity` de bout en bout (le fichier écrit, la reprise, le refus d'une autre version, l'usage) ; la logique (jour infranchissable, motif) est `preparation.test.ts`.
const JOUR = daysFromCivil(2026, 11, 9);

describe("npm run preparer:gravity (l'outil)", () => {
  const racine = new URL("..", import.meta.url).pathname;
  const dossiers: string[] = [];
  afterEach(() => {
    for (const d of dossiers.splice(0)) rmSync(d, { recursive: true, force: true });
  });
  const lancer = (dossier: string, ...suite: string[]) => spawnSync("npm", ["run", "preparer:gravity", "--silent", "--", "--du", formatDay(JOUR), "--au", formatDay(JOUR), `--dossier=${dossier}`, ...suite], { cwd: racine, encoding: "utf8" });

  it("écrit le jour avec ses seuils, garde un fichier déjà préparé, refuse un fichier d'une autre version et dit le jour en échec", () => {
    const dossier = mkdtempSync(join(tmpdir(), "gravity-jours-"));
    dossiers.push(dossier);
    const fichier = join(dossier, `${formatDay(JOUR)}.json`);
    const premier = lancer(dossier);
    expect(premier.status, premier.stdout + premier.stderr).toBe(0);
    expect(premier.stdout).toMatch(/1 écrit\(s\)/);
    const ecrit = JSON.parse(readFileSync(fichier, "utf8"));
    expect(lireJourFige(ecrit)).not.toBeNull();
    expect(ecrit.seuils).toEqual(seuilsDuRobot(dailyGravity(JOUR)));
    const second = lancer(dossier);
    expect(second.status).toBe(0);
    expect(second.stdout).toMatch(/0 écrit\(s\).*1 déjà préparé/);
    // un fichier d'une autre version : refusé, même avec --forcer, et le fichier n'est pas touché
    writeFileSync(fichier, JSON.stringify({ ...ecrit, g: 2 }));
    const autre = lancer(dossier, "--forcer");
    expect(autre.status).toBe(1);
    expect(autre.stderr).toContain(`${formatDay(JOUR)} : fichier en g2`);
    expect(JSON.parse(readFileSync(fichier, "utf8")).g).toBe(2);
  });

  it("une plage mal écrite : usage, code 2", () => {
    const r = spawnSync("npm", ["run", "preparer:gravity", "--silent", "--", "--du", "n'importe quoi"], { cwd: racine, encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("Usage");
  });
});
