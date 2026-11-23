import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rapportContraste } from "@cdj/ui/src/contraste";
import { couleurValide, fondDuTheme } from "../src/jeu/peau";

// Lot « écrans du kit » — la peau d'un jeu : ce qui est pur (validation des couleurs, décor par thème) et la feuille des écrans (jetons seulement, échelle d'espacement). Le DOM est essayé par `apps/cibles/e2e/ecrans-kit.spec.ts`.
const ROOT = join(__dirname, "../../..");
const lire = (f: string) => readFileSync(join(ROOT, f), "utf8");
const sansCommentaires = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("la peau d'un jeu", () => {
  it("une couleur de la peau est un #RRGGBB : tout le reste est refusé (jamais une donnée dans une feuille)", () => {
    for (const bonne of ["#9ED9BE", "#000000", "#ffffff", "#0aF3c9"]) expect(couleurValide(bonne), bonne).toBe(true);
    for (const mauvaise of ["9ED9BE", "#FFF", "#12345G", "#1234567", "rgb(0,0,0)", "red", "url(x)", "#fff; background: red", "", null, undefined, 12]) expect(couleurValide(mauvaise), String(mauvaise)).toBe(false);
  });
  it("le décor d'un thème : celui que la définition donne s'il est valide, sinon rien (le décor de la fiche)", () => {
    expect(fondDuTheme(undefined, "port")).toBeNull();
    expect(fondDuTheme({}, "port")).toBeNull();
    const peau = { fond: (theme: string) => (theme === "nuit" ? { ciel: "#1B2A4A", sol: "#101A30" } : { ciel: "bleu", sol: "#101A30" }) };
    expect(fondDuTheme(peau, "nuit")).toEqual({ ciel: "#1B2A4A", sol: "#101A30" });
    expect(fondDuTheme(peau, "port")).toBeNull(); // une couleur refusée : tout le décor est refusé, jamais la moitié
  });
});

describe("les feuilles des écrans du kit (jeu.css : l'accueil, premier chargement ; ecrans.css : les autres écrans, à la demande)", () => {
  const css = sansCommentaires(lire("packages/kit/src/jeu/jeu.css")) + sansCommentaires(lire("packages/kit/src/jeu/ecrans.css"));
  it("jetons seulement : aucune couleur, police, ombre floue ni translucidité écrite en dur", () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(rgba?|hsla?|oklch|color-mix)\(/);
    expect(css).not.toMatch(/font-family:(?!\s*var\()/);
    for (const m of css.matchAll(/box-shadow:\s*([^;]+);/g)) expect(m[1], m[1]).not.toMatch(/-?\d+px\s+-?\d+px\s+[1-9]\d*px/);
  });
  it("l'échelle d'espacement : chaque `gap` vient d'un jeton d'espacement (`--dj-espace-*`) ou de l'échelle des écrans (`--jeu-esp-*`), jamais d'une longueur écrite en dur", () => {
    const ecarts = [...css.matchAll(/(?:^|[\s;{])(?:row-|column-)?gap:\s*([^;]+);/g)].map((m) => m[1]!);
    expect(ecarts.length).toBeGreaterThan(10);
    for (const e of ecarts) for (const v of e.split(/\s+/)) expect(v, `gap : ${e}`).toMatch(/^var\(--(dj-espace|jeu-esp)-[a-z0-9]+\)$|^0$/);
  });
  it("`ecrans.css` n'est importée que par le morceau de la partie (importée par deux morceaux elle ferait un morceau à part, compté dans le premier chargement)", () => {
    const importeurs = ["aide", "reglages", "classement", "partie", "index", "retours", "version", "donnees", "session", "source", "i18n"].filter((f) => /import\s+"\.\/ecrans\.css"/.test(lire(`packages/kit/src/jeu/${f}.ts`)));
    expect(importeurs).toEqual(["partie"]);
  });
  it("l'échelle est définie une fois, sur les jetons, et un écran de jeu n'a jamais de bouton collé : le gap d'une rangée de boutons est `--jeu-esp-boutons`", () => {
    expect(css).toMatch(/--jeu-esp-boutons:\s*var\(--dj-espace-3\)/);
    expect(css).toMatch(/\.jeu-secondaires\s*\{[^}]*gap:\s*var\(--jeu-esp-boutons\)/);
    expect(css).toMatch(/\.jeu-secondaires\s*>\s*\*\s*\{[^}]*min-height:\s*var\(--dj-cible\)/); // 44 px
  });
  it("la peau vient de la fiche : la feuille générée porte la coque du jeu, et la feuille des écrans ne nomme aucun jeu", () => {
    const gen = lire("packages/ui/src/identites/cibles.generated.css"); // lot K5 : la peau de chaque jeu est dans son fichier (alias `identite-du-jeu.css`)
    expect(gen).toMatch(/\.jeu-etiquette--cibles\s*\{[^}]*--jeu-fond:[^}]*--jeu-coque:[^}]*--jeu-police:/);
    for (const jeu of ["track", "jump", "tower", "cibles", "blocks", "rush"]) expect(css, jeu).not.toMatch(new RegExp(`\\b${jeu}\\b`, "i"));
  });
});

// Lot PA1c — la surimpression pour une scène claire (`hud: "surimpression-claire"`) : l'encre sur le papier, lisible au contraste AA ; le kit donne la classe, le jeu ne retouche rien.
describe("la surimpression pour une scène claire (lot PA1c)", () => {
  const css = sansCommentaires(lire("packages/kit/src/jeu/ecrans.css"));
  const jeton = (nom: string): string => new RegExp(`--dj-${nom}:\\s*(#[0-9A-Fa-f]{6})`).exec(lire("packages/ui/src/jetons.css"))![1]!;
  it("la variante écrit le texte en encre et son ombre en papier (la base : papier, ombre d'encre) ; jetons seulement", () => {
    expect(css).toMatch(/\.jeu-surimpression--clair\s*\{\s*color:\s*var\(--dj-encre\);\s*\}/);
    expect(css).toMatch(/\.jeu-surimpression--clair \.jeu-surimpression__valeur\s*\{\s*text-shadow:\s*3px 3px 0 var\(--dj-papier\);\s*\}/);
    expect(css).toMatch(/\.jeu-surimpression\s*\{[^}]*color:\s*var\(--dj-papier\)/);
    expect(css).toMatch(/\.jeu-surimpression__valeur\s*\{[^}]*text-shadow:\s*3px 3px 0 var\(--dj-encre\)/);
  });
  it("le texte d'encre sur son ombre de papier atteint 4,5:1 (AA), comme le papier sur l'encre de la variante d'origine", () => {
    expect(rapportContraste(jeton("encre"), jeton("papier"))).toBeGreaterThanOrEqual(4.5);
  });
  it("le kit pose la classe pour `hud: \"surimpression-claire\"`, jamais pour `\"surimpression\"`, et le type la permet", () => {
    const partie = lire("packages/kit/src/jeu/partie.ts");
    expect(partie).toContain('def.hud === "surimpression" || def.hud === "surimpression-claire" ? creerSurimpression(def.hud === "surimpression-claire")');
    expect(lire("packages/kit/src/jeu/surimpression.ts")).toContain('claire ? "jeu-surimpression jeu-surimpression--clair" : "jeu-surimpression"');
    expect(lire("packages/kit/src/jeu/types.ts")).toContain('hud?: "barre" | "surimpression" | "surimpression-claire"');
  });
});
