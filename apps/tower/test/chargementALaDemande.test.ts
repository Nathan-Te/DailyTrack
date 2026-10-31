import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Lot T4 — le chargement à la demande : le premier chargement est l'accueil seul (interface, identité, lecture du serveur, catalogues). Il n'embarque ni Three.js, ni la simulation (la partie), ni Rapier,
// ni la scène, le HUD, la pause ou l'arrivée. Ce test suit les imports STATIQUES de `main.ts` dans le code source (les `import()` à la demande ne comptent pas) ; la mesure des octets, sur la construction,
// est `e2e/poids.spec.ts`.
const SRC = join(__dirname, "../src");
const AU_DEMARRAGE = ["main.ts"];
/** Les modules de la partie : chargés avec le jeu, jamais avec l'accueil. */
const DU_JEU = ["jeu.ts", "scene.ts", "hud.ts", "fin.ts", "pause.ts", "entrees.ts", "apercuPiece.ts", "fantomeRejeu.ts", "fantomeLocal.ts", "tune.ts", "debug.ts", "botDemande.ts", "botWorker.ts", "jour.ts", "preparation.ts", "palettes.ts", "commentJouer.ts", "partageDom.ts", "moteurs.ts", "jeuSuivant.ts", "interrupteur.ts", "panique.ts", "expression.ts", "yeux.ts", "formes.ts", "evenements.ts", "sons.ts", "sonsLogique.ts", "reglagesSons.ts", "reglagesEssai.ts", "classable.ts", "curseurs.ts", "secousse.ts", "gerbe.ts", "chute.ts", "profondeurs.ts", "mouvement.ts", "hasardAffichage.ts", "iconesEffet.ts"];

function statiques(fichier: string): string[] {
  const code = readFileSync(join(SRC, fichier), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const out: string[] = [];
  // `import … from "x"` et `import "x"` (jamais `import type`, ni `import("x")`) ; `export … from "x"` compte aussi.
  for (const m of code.matchAll(/^\s*(?:import|export)\s+(type\s+)?(?:[^"'()]*?\sfrom\s+)?["']([^"']+)["']/gm)) if (!m[1]) out.push(m[2]!);
  return out;
}

/** Les valeurs (pas les types) que `fichier` importe de `@cdj/tower-sim`. */
function valeursDeLaSimulation(fichier: string): string[] {
  const code = readFileSync(join(SRC, fichier), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const out: string[] = [];
  for (const m of code.matchAll(/^\s*import\s+(?!type\s)\{([^}]*)\}\s*from\s*["']@cdj\/tower-sim["']/gm)) for (const nom of m[1]!.split(",").map((x) => x.trim()).filter(Boolean)) if (!nom.startsWith("type ")) out.push(nom);
  return out;
}

function graphe(): { fichiers: Set<string>; externes: Set<string> } {
  const fichiers = new Set<string>();
  const externes = new Set<string>();
  const file = [...AU_DEMARRAGE];
  while (file.length) {
    const f = file.shift()!;
    if (fichiers.has(f)) continue;
    fichiers.add(f);
    for (const spec of statiques(f)) {
      if (spec.startsWith(".")) {
        const cible = resolve(dirname(join(SRC, f)), spec);
        const rel = cible.slice(SRC.length + 1);
        if (/\.(css)$/.test(rel)) continue;
        file.push(/\.ts$/.test(rel) ? rel : `${rel}.ts`);
      } else externes.add(spec);
    }
  }
  return { fichiers, externes };
}

describe("lot T4 : le premier chargement est l'accueil seul", () => {
  const { fichiers, externes } = graphe();

  it("le graphe d'imports statiques part de main.ts et atteint l'accueil", () => {
    expect([...fichiers]).toEqual(expect.arrayContaining(["main.ts", "accueil.ts", "session.ts", "envoi.ts", "apiTower.ts", "records.ts", "i18n.ts"]));
  });

  it("aucun module de la scène, de la partie, du HUD, de la pause ou de l'arrivée dans le premier chargement", () => {
    for (const f of DU_JEU) expect([...fichiers], f).not.toContain(f);
  });

  it("ni Three.js, ni la physique, ni la partie : de la simulation, seulement trois constantes (les listes des effets, des thèmes et des tirages de `?effet=`, `?theme=`, `?tirage=`)", () => {
    expect([...externes].filter((e) => e === "three" || e.startsWith("three/") || e.includes("rapier") || e === "@dimforge/rapier2d-deterministic-compat")).toEqual([]);
    expect([...externes].filter((e) => e.startsWith("@cdj/tower-sim/"))).toEqual([]);
    const valeurs = [...fichiers].flatMap((f) => valeursDeLaSimulation(f).map((v) => `${f} : ${v}`));
    expect(valeurs.sort()).toEqual(["urlOptions.ts : EFFETS", "urlOptions.ts : THEMES_TOWER", "urlOptions.ts : TIRAGES_MAX"]);
  });

  it("le jeu, la physique et le contenu du jour sont chargés par import() depuis l'accueil, et eux seuls", () => {
    const accueil = readFileSync(join(SRC, "accueil.ts"), "utf8");
    expect(accueil).toMatch(/import\("\.\/jeu"\)/);
    expect(accueil).toMatch(/import\("@cdj\/tower-sim\/rapier"\)/);
    expect(accueil).toMatch(/import\("\.\/preparation"\)/);
    // Le préchargement commence dès que l'accueil est affiché : avant tout clic sur JOUER.
    expect(accueil.indexOf("let pre = precharger()")).toBeGreaterThan(0);
    expect(accueil.indexOf("let pre = precharger()")).toBeLessThan(accueil.indexOf('jouer.addEventListener("click"'));
  });

  it("JOUER attend ce qui manque, avec une ligne d'attente courte, et redemande ce qui a échoué", () => {
    const accueil = readFileSync(join(SRC, "accueil.ts"), "utf8");
    expect(accueil).toContain('t("accueil.attente")');
    expect(accueil).toMatch(/await Promise\.all\(\[pre\.jeu, pre\.rapier\]\)/);
    expect(accueil).toContain("pre = precharger()");
  });
});
