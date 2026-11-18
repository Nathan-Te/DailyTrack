import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { THEMES } from "@cdj/visuels/plateformes";
import { THEMES_GRAVITY } from "@cdj/gravity-sim";
import { CATALOGUE_GRAVITY } from "../src/catalogue";
import { DEFINITION } from "../src/definition";
import { MEDAILLES_DU_PANNEAU } from "../src/panneau";

// Lot GR4 — l'identité et les textes : le panneau « Aujourd'hui » est lisible (4,5:1), l'illustration respecte la charte, « Comment jouer » est complet dans les deux langues.
const lire = (chemin: string): string => readFileSync(new URL(chemin, import.meta.url), "utf8");
const lum = (hex: string): number => {
  const c = [0, 1, 2].map((i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contraste = (a: string, b: string): number => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const hex = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
const jeton = (nom: string): string => new RegExp(`${nom}:\\s*(#[0-9A-Fa-f]{6})`).exec(lire("../../../packages/ui/src/jetons.css"))![1]!;

describe("« Gravity » : le panneau « Aujourd'hui »", () => {
  it("le texte papier se lit (4,5:1) sur la teinte sombre de chacun des cinq thèmes", () => {
    for (const id of THEMES_GRAVITY) expect(contraste(hex(THEMES[id].tiles.rimBottom), jeton("--dj-papier")), id).toBeGreaterThanOrEqual(4.5);
  });
  it("le texte des cases de médailles se lit (4,5:1) : l'encre sur le bronze, l'argent et l'or, le texte Diamant sur le Diamant", () => {
    const fond = { bronze: "--dj-bronze", argent: "--dj-argent", or: "--dj-or", diamant: "--dj-diamant" } as const;
    for (const m of MEDAILLES_DU_PANNEAU) expect(contraste(jeton(fond[m.classe]), jeton(m.classe === "diamant" ? "--dj-diamant-texte" : "--dj-encre")), m.classe).toBeGreaterThanOrEqual(4.5);
  });
  it("lot GR5 : il ne fait rien de plus au premier chargement : son morceau est demandé par `import()` quand le kit l'appelle, jamais importé en tête, et la scène ne le lit plus", () => {
    expect(lire("../src/definition.ts")).toContain('import("./panneau")');
    expect(lire("../src/scene.ts")).not.toMatch(/from ["']\.\/panneau["']/);
    for (const f of ["main.ts", "definition.ts", "fiche.ts"]) expect(lire(`../src/${f}`), f).not.toMatch(/from ["']\.\/panneau["']/);
    expect(lire("../src/panneau.ts")).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML/);
  });
});

describe("« Gravity » : l'illustration", () => {
  const svg = lire("../public/illustration.svg");
  it("un SVG aux aplats bordés d'encre, sans opacité ni ressource, aux couleurs de la charte et de la DA du jeu", () => {
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="96" height="80" viewBox="0 0 96 80">/);
    expect(svg).not.toMatch(/opacity|href=|url\(|<script|<image/i);
    expect(svg).toContain("#2A1E16"); // l'encre
    expect(svg).toContain("#FFD23F"); // le cube jaune
    expect(svg).toContain("#4FC3DC"); // la gemme Diamant
    expect(svg).not.toMatch(/#FF3B3B/i); // le rouge est réservé aux dangers
  });
});

describe("« Gravity » : les textes", () => {
  it("« Comment jouer » : les trois pas, les six blocs, les trois modes de vol et les portails de vitesse (lot GR6), le bouclier, l'aimant et le multiplicateur — dans les deux langues, sans texte à remplacer", () => {
    expect(DEFINITION.aide).toHaveLength(19); // lot GR7 : + les trois dangers
    expect(DEFINITION.aide).toEqual(expect.arrayContaining(["aide.mode.avion", "aide.mode.onde", "aide.mode.ressort", "aide.vitesse", "aide.danger.scies", "aide.danger.fragiles", "aide.danger.lasers"]));
    for (const langue of ["fr", "en"] as const) {
      const c = CATALOGUE_GRAVITY[langue] as Record<string, string>;
      for (const cle of DEFINITION.aide) {
        expect(c[cle], `${langue} ${cle}`).toBeTruthy();
        expect(c[cle], `${langue} ${cle}`).not.toMatch(/à remplacer|to replace/i);
      }
    }
  });
  it("chaque thème a sa réplique d'accueil, son nom et sa mécanique, en français et en anglais ; celle du thème de la maquette est mot pour mot", () => {
    for (const langue of ["fr", "en"] as const) {
      const c = CATALOGUE_GRAVITY[langue] as Record<string, string>;
      for (const id of THEMES_GRAVITY) for (const cle of [`accueil.phrase.${id}`, `theme.${id}`, `theme.${id}.meca`]) expect(c[cle], `${langue} ${cle}`).toBeTruthy();
    }
    expect((CATALOGUE_GRAVITY.fr as Record<string, string>)["accueil.phrase.foret"]).toBe("Le sol, le plafond : même combat. Tant que tu touches quelque chose.");
  });
  it("lot GR6 : chaque mode a son nom et sa consigne, chaque portail de vitesse son annonce — en français et en anglais, courts", () => {
    for (const langue of ["fr", "en"] as const) {
      const c = CATALOGUE_GRAVITY[langue] as Record<string, string>;
      for (const mode of ["gravite", "avion", "onde", "ressort"]) for (const cle of [`mode.${mode}`, `mode.${mode}.consigne`]) expect(c[cle], `${langue} ${cle}`).toBeTruthy();
      for (const v of ["lent", "v1", "v2", "v3"]) expect(c[`portail.${v}`], `${langue} portail.${v}`).toBeTruthy();
      for (const cle of ["aide.mode.avion", "aide.mode.onde", "aide.mode.ressort", "aide.vitesse", "aide.danger.scies", "aide.danger.fragiles", "aide.danger.lasers"]) expect(c[cle]!.length, `${langue} ${cle}`).toBeLessThan(150); // « comment jouer » reste court
    }
  });
  it("le panneau, le bilan de la mort et les causes ont leurs textes (les mêmes clés en français et en anglais)", () => {
    const fr = CATALOGUE_GRAVITY.fr as Record<string, string>;
    const en = CATALOGUE_GRAVITY.en as Record<string, string>;
    for (const cle of Object.keys(fr).filter((k) => /^(aujourdhui|bilan|mort|hud)\./.test(k))) {
      expect(fr[cle], cle).toBeTruthy();
      expect(en[cle], cle).toBeTruthy();
    }
    expect(Object.keys(fr).filter((k) => /^bilan\./.test(k))).toHaveLength(6);
  });
  it("lot GR5 : « À remplacer » n'est plus ni dans le fichier français ni dans un texte visible (le test des mentions légales traite Gravity comme livré : `apps/portail/test/mentions.test.ts`)", () => {
    expect(lire("../src/catalogue.fr.ts")).not.toMatch(/À remplacer/);
    for (const v of Object.values(CATALOGUE_GRAVITY.fr)) expect(v).not.toMatch(/À remplacer/);
  });
});
