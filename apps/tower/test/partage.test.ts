import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { NomMedaille } from "@cdj/tower-sim";
import { CATALOGUE_TOWER } from "../src/catalogue";
import { coeursPartages, EMOJI_MEDAILLE, EMOJI_VIE, EMOJI_VIE_PERDUE, hauteurPartagee, ligneDePartage, textePartage } from "../src/partage";

// Lot T4 — la ligne à partager : `Du Jour · Tower #12 — 42,7 m — 🥇 — ❤️❤️🖤` (chaque médaille, chaque nombre de vies). Les émojis ne vivent que dans ce texte.
const TITRE = "Du Jour · Tower #12";
const base = { titre: TITRE, hauteurMm: 42_700, medaille: null as NomMedaille | null, vies: 3, total: 3, langue: "fr" as const };

describe("la ligne à partager de Tower", () => {
  it("le format du seed : titre — hauteur à une décimale — médaille — cœurs", () => {
    expect(ligneDePartage({ ...base, medaille: "or", vies: 2 })).toBe(`${TITRE} — 42,7 m — \u{1F947} — ${EMOJI_VIE}${EMOJI_VIE}${EMOJI_VIE_PERDUE}`);
  });

  it("chaque médaille a son émoji (le Diamant : la pierre) et rien quand il n'y a pas de médaille", () => {
    expect(EMOJI_MEDAILLE).toEqual({ bronze: "\u{1F949}", argent: "\u{1F948}", or: "\u{1F947}", auteur: "\u{1F48E}" });
    for (const m of ["bronze", "argent", "or", "auteur"] as const) expect(ligneDePartage({ ...base, medaille: m })).toContain(` — ${EMOJI_MEDAILLE[m]} — `);
    const sans = ligneDePartage(base);
    expect(sans).toBe(`${TITRE} — 42,7 m — ${EMOJI_VIE.repeat(3)}`);
    for (const e of Object.values(EMOJI_MEDAILLE)) expect(sans).not.toContain(e);
  });

  it("un cœur par vie restante, un cœur noir par vie perdue : 0, 1, 2 et 3 vies", () => {
    expect(coeursPartages(3, 3)).toBe(EMOJI_VIE.repeat(3));
    expect(coeursPartages(2, 3)).toBe(EMOJI_VIE.repeat(2) + EMOJI_VIE_PERDUE);
    expect(coeursPartages(1, 3)).toBe(EMOJI_VIE + EMOJI_VIE_PERDUE.repeat(2));
    expect(coeursPartages(0, 3)).toBe(EMOJI_VIE_PERDUE.repeat(3));
    for (const v of [0, 1, 2, 3]) expect(ligneDePartage({ ...base, medaille: "argent", vies: v }).endsWith(coeursPartages(v, 3))).toBe(true);
  });

  it("des vies hors des bornes ne sortent pas du total", () => {
    expect(coeursPartages(5, 3)).toBe(EMOJI_VIE.repeat(3));
    expect(coeursPartages(-1, 3)).toBe(EMOJI_VIE_PERDUE.repeat(3));
  });

  it("la hauteur est arrondie au dixième le plus proche, en entiers, dans le format de la langue", () => {
    expect(hauteurPartagee(42_650, "fr")).toBe("42,7 m");
    expect(hauteurPartagee(42_649, "fr")).toBe("42,6 m");
    expect(hauteurPartagee(0, "fr")).toBe("0,0 m");
    expect(hauteurPartagee(9_999, "fr")).toBe("10,0 m");
    expect(hauteurPartagee(42_700, "en")).toBe("42.7 m");
  });

  it("le texte complet : la ligne, puis le lien de la page sans paramètre ; rien d'identifiant (ni pseudo, ni rang)", () => {
    const texte = textePartage({ ...base, medaille: "bronze" }, { origin: "https://recette.playdujour.com", pathname: "/tower/" });
    expect(texte).toBe(`${ligneDePartage({ ...base, medaille: "bronze" })}\nhttps://recette.playdujour.com/tower/`);
    expect(texte).not.toMatch(/\?/);
  });

  it("le titre vient du catalogue, le même dans les deux langues", () => {
    expect(CATALOGUE_TOWER.fr["partage.titre"]).toBe("Du Jour · Tower #{numero}");
    expect(CATALOGUE_TOWER.en["partage.titre"]).toBe("Du Jour · Tower #{numero}");
  });

  it("les émojis ne vivent que dans partage.ts : ni dans les catalogues, ni dans le reste du code, ni dans les feuilles de style", () => {
    const SRC = join(__dirname, "../src");
    const emoji = /\p{Extended_Pictographic}/u;
    for (const l of ["fr", "en"] as const) for (const [k, v] of Object.entries(CATALOGUE_TOWER[l])) for (const x of typeof v === "string" ? [v] : Object.values(v)) expect(x, `${l} ${k}`).not.toMatch(emoji);
    for (const f of readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter((x) => /\.(ts|css)$/.test(x))) {
      const texte = readFileSync(join(SRC, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(texte, f).not.toMatch(emoji);
    }
  });
});
