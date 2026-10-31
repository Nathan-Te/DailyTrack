import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Lot 56 — l'ambiance sonore des thèmes a été retirée (décision de Nathan, 31/10/2026) : aucun reste ne doit réapparaître sans un lot qui la remette.
const SRC = new URL("../src/", import.meta.url);
function fichiers(dir: URL): URL[] {
  const sortie: URL[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) sortie.push(...fichiers(new URL(`${e.name}/`, dir)));
    else if (e.name.endsWith(".ts")) sortie.push(new URL(e.name, dir));
  }
  return sortie;
}

describe("aucun reste de l'ambiance sonore des thèmes", () => {
  it("ni code, ni recette, ni bus, ni réglage, ni texte", () => {
    const anciens = [/\bAMBIENCE\b/, /\bAMBIENCE_KINDS\b/, /\bambienceFor\b/, /\bambienceLevel\b/, /\bsetAmbience\b/, /\bbuildAmbience\b/, /\bAmbienceKind\b/, /\bambienceKind\b/, /\bAmbienceRecipe\b/, /\bbus\.ambience\b/, /reglages\.son\.ambiance/];
    for (const u of fichiers(SRC)) {
      const src = readFileSync(u, "utf8");
      for (const re of anciens) expect(src, `${u.pathname.split("/src/")[1]} : ${re}`).not.toMatch(re);
    }
    for (const l of ["fr", "en"]) expect(readFileSync(new URL(`catalogue.reglages.${l}.ts`, SRC), "utf8")).not.toMatch(/ambian|ambienc/i);
    expect(existsSync(new URL("son/ambiance/", SRC))).toBe(false);
  });
});
