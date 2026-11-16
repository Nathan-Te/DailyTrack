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
  it("il ne fait rien de plus au premier chargement : la scène l'exporte, le premier chargement ne l'importe pas", () => {
    expect(lire("../src/scene.ts")).toContain('from "./panneau"');
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
  it("« Comment jouer » : les trois pas, les six blocs, le bouclier, l'aimant et le multiplicateur — dans les deux langues, sans texte à remplacer", () => {
    expect(DEFINITION.aide).toHaveLength(12);
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
  it("le panneau, le bilan de la mort et les causes ont leurs textes (les mêmes clés en français et en anglais)", () => {
    const fr = CATALOGUE_GRAVITY.fr as Record<string, string>;
    const en = CATALOGUE_GRAVITY.en as Record<string, string>;
    for (const cle of Object.keys(fr).filter((k) => /^(aujourdhui|bilan|mort|hud)\./.test(k))) {
      expect(fr[cle], cle).toBeTruthy();
      expect(en[cle], cle).toBeTruthy();
    }
    expect(Object.keys(fr).filter((k) => /^bilan\./.test(k))).toHaveLength(6);
  });
  it("« À remplacer » reste dans le fichier français (le test des mentions légales traite le jeu en squelette tant que ses mentions ne sont pas faites) mais dans aucun texte visible", () => {
    expect(lire("../src/catalogue.fr.ts")).toMatch(/À remplacer/);
    for (const v of Object.values(CATALOGUE_GRAVITY.fr)) expect(v).not.toMatch(/À remplacer/);
  });
});
