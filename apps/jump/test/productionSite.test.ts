import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { thawLevel, thawPublicLevel } from "@cdj/jump-sim";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { fichiersAvecPreuve, sansPreuve } from "../../../scripts/site.mjs";
import { readUrlOptions } from "../src/urlOptions";

// Lot R9 (plateforme) : la **vraie construction de production** de Jump (`VITE_PRODUCTION=1`, comme `deploy-site.yml`) ne publie ni la preuve de l'auteur
// (le champ `preuve` de chaque fichier figé : la renvoyer au serveur donnerait le temps de l'auteur, audit S-08 / S-16), ni `outils/` (`?semaine=`),
// ni `demo/` ; le jeu lit pourtant ces fichiers (`thawPublicLevel`) ; et l'adresse ne rouvre rien (`readUrlOptions(…, true)`).

const APP = join(__dirname, "..");
const NIVEAUX = join(APP, "public/levels");
let tmp = "";
let production = "";
let hors = "";

function construire(out: string, env: Record<string, string>): void {
  execFileSync("npx", ["vite", "build", "--logLevel", "error", "--outDir", out, "--emptyOutDir"], { cwd: APP, env: { ...process.env, VITE_PRODUCTION: "", ...env }, stdio: "pipe" });
}

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "jump-prod-"));
  production = join(tmp, "production");
  hors = join(tmp, "hors");
  construire(production, { VITE_PRODUCTION: "1" });
  construire(hors, {});
}, 240_000);
afterAll(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

const jours = () => readdirSync(NIVEAUX).filter((f) => f.endsWith(".json"));

/** Le site vu de `scripts/site.mjs` : la construction de Jump sous `jump/`. */
function commeSite(build: string, nom: string): string {
  const site = join(tmp, nom);
  mkdirSync(join(site, "jump"), { recursive: true });
  cpSync(build, join(site, "jump"), { recursive: true });
  return site;
}

describe("construction de production de Jump (lot R9)", () => {
  it("aucun fichier servi ne contient la preuve de l'auteur d'un jour", () => {
    expect(jours().length).toBeGreaterThan(5);
    const preuves = jours().map((f) => (JSON.parse(readFileSync(join(NIVEAUX, f), "utf8")) as { preuve: string }).preuve);
    for (const p of preuves) expect(p.length).toBeGreaterThan(100); // le dépôt, lui, la garde (le serveur s'en sert)
    // Chaque fichier publié : le même, sans `preuve` (octet pour octet pour le reste).
    for (const f of jours()) {
      const publie = readFileSync(join(production, "levels", f), "utf8");
      expect(publie, f).not.toContain("preuve");
      expect(publie, f).toBe(sansPreuve(readFileSync(join(NIVEAUX, f), "utf8")));
    }
    // Aucun octet du site : ni dans les niveaux, ni dans le code, ni dans les données (le contrôle de `scripts/site.mjs`, celui du déploiement).
    expect(fichiersAvecPreuve(commeSite(production, "site-production"), NIVEAUX)).toEqual([]);
  });

  it("le contrôle n'est pas vide : la construction hors production publie les fichiers du dépôt, preuve comprise", () => {
    for (const f of jours()) expect(readFileSync(join(hors, "levels", f), "utf8"), f).toBe(readFileSync(join(NIVEAUX, f), "utf8"));
    const fautifs = fichiersAvecPreuve(commeSite(hors, "site-hors"), NIVEAUX) as string[];
    expect(fautifs).toContain("jump/outils/");
    expect(fautifs.filter((f) => f.startsWith("jump/levels/")).length).toBe(jours().length);
  });

  it("le jeu lit les fichiers publiés : chaque niveau figé se vérifie sans sa preuve (forme, versions, empreinte, médailles), et le serveur, lui, l'exige", () => {
    for (const f of jours()) {
      const day = parseDay(f.replace(".json", ""))!;
      const publie = JSON.parse(readFileSync(join(production, "levels", f), "utf8")) as unknown;
      const level = thawPublicLevel(publie, day);
      expect(typeof level, `${f} : ${String(level)}`).toBe("object");
      if (typeof level === "string") continue;
      expect(level.replay).toBeUndefined();
      expect(level.code).toBeUndefined();
      // Le même niveau que celui du dépôt (preuve rejouée) : mêmes cases, même identifiant, mêmes médailles.
      const depot = thawLevel(JSON.parse(readFileSync(join(NIVEAUX, f), "utf8")) as unknown, day);
      expect(typeof depot).toBe("object");
      if (typeof depot === "string") continue;
      expect(level.ascii).toBe(depot.ascii);
      expect(level.id).toBe(depot.id);
      expect(level.medals).toEqual(depot.medals);
      expect(level.authorTicks).toBe(depot.authorTicks);
      // Le serveur n'accepte jamais un fichier sans preuve (`thawLevel`) : il garde celui du dépôt.
      expect(thawLevel(publie, day)).toBe("fichier incomplet");
    }
  });

  it("un fichier publié abîmé est refusé comme avant (empreinte, date, identifiant)", () => {
    const f = jours().at(-1)!;
    const day = parseDay(f.replace(".json", ""))!;
    const publie = JSON.parse(readFileSync(join(production, "levels", f), "utf8")) as Record<string, unknown>;
    expect(thawPublicLevel({ ...publie, grille: ["#10"] }, day)).toBe("empreinte du niveau");
    expect(thawPublicLevel(publie, day + 1)).toBe("autre date");
    expect(thawPublicLevel({ ...publie, id: "jour-2026-10-01-g1" }, day)).toBe("autre identifiant");
    expect(thawPublicLevel({ ...publie, preuve: 12 }, day)).toBe("fichier incomplet");
  });

  it("`outils/` (`?semaine=`) et `demo/` ne sont pas publiés ; le jeu les garde hors production", () => {
    for (const d of ["outils", "demo"]) {
      expect(existsSync(join(production, d)), d).toBe(false);
      expect(existsSync(join(hors, d)), d).toBe(true);
    }
    expect(existsSync(join(production, "outils/semaine-g13.json"))).toBe(false);
  });
});

describe("l'adresse ne rouvre rien en production (lot R9)", () => {
  const adresse = "?semaine=2026-11-01&generateur=14&solution&carnage=demo&debug";

  it("hors production : `?semaine=`, `&solution` et `?carnage=demo` existent (outils d'essai)", () => {
    expect(readUrlOptions("?semaine=2026-11-01&generateur=13")).toMatchObject({ semaine: parseDay("2026-11-01"), semaineG13: true });
    expect(readUrlOptions("?solution")).toMatchObject({ solution: true });
    expect(readUrlOptions("?module=cheminee&solution").module?.solution).toBe(true);
    expect(readUrlOptions("?carnage=demo")).toMatchObject({ carnageDemo: true });
  });

  it("production : `?semaine=`, `&generateur=`, `&solution` (niveau du jour et morceau) et `?carnage=demo` sont fermés, pas même `?debug` ne les rouvre", () => {
    const o = readUrlOptions(adresse, true);
    expect(o).toMatchObject({ semaine: null, semaineG13: false, semaineG14: false, solution: false, carnageDemo: false, debug: true, daily: true });
    expect(readUrlOptions("?module=cheminee&solution", true).module).toMatchObject({ id: "cheminee", solution: false });
    expect(readUrlOptions("?semaine=2026-11-01", true).gallery).toBe(false);
  });
});
