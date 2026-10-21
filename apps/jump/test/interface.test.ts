import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATALOGUE_COMMUN } from "@cdj/ui";
import { CATALOGUE_JUMP } from "../src/catalogue";
import "./francais";

// Lot I5 : les feuilles de Jump suivent la charte « Cartouches » (docs/plateforme/identite.md, § 5 et § 11) comme celles du socle et de Track : toute couleur et
// toute police viennent des jetons de @cdj/ui (`var(--…)`), jamais de valeur en dur ; ombres nettes (aucun flou) ; aucune transparence d'arrière-plan ni dégradé de
// fond (seuls les motifs : rayures du voile, stries de la coque). Une ombre de texte, une seule : celle des titres de Jump (`--jump-ombre-titre`, nette, papier).
const SRC = join(__dirname, "../src");
const feuilles = readdirSync(SRC).filter((f) => f.endsWith(".css"));

describe("feuilles de style de Jump", () => {
  it("les quatre feuilles du jeu existent", () => {
    expect(feuilles.sort()).toEqual(["ecrans.css", "hud.css", "interface.css", "outils.css"]);
  });

  for (const f of feuilles) {
    const texte = readFileSync(join(SRC, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    it(`${f} : jetons seulement (aucune couleur ni police en dur), aucune ombre floue, aucune translucidité ni dégradé de fond`, () => {
      expect(texte).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(texte).not.toMatch(/\b(rgba?|hsla?|oklch|color-mix)\(/);
      expect(texte).not.toMatch(/font-family:(?!\s*var\()/);
      expect(texte).not.toMatch(/\bopacity\s*:/);
      expect(texte).not.toMatch(/backdrop-filter|filter:\s*blur/);
      for (const m of texte.matchAll(/text-shadow:\s*([^;]+);/g)) expect(m[1], `${f} : ${m[1]}`).toBe("var(--jump-ombre-titre)");
      expect(texte).not.toMatch(/(?<!repeating-)linear-gradient\(/);
      expect(texte).not.toMatch(/radial-gradient\(/);
      for (const m of texte.matchAll(/box-shadow:\s*([^;]+);/g)) expect(m[1], `${f} : ${m[1]}`).not.toMatch(/-?\d+px\s+-?\d+px\s+[1-9]\d*px/);
    });
    it(`${f} : aucun émoji`, () => {
      expect(texte, f).not.toMatch(/\p{Extended_Pictographic}/u);
    });
  }
});

describe("catalogues de Jump", () => {
  // Chaque clé écrite en toutes lettres dans le code (`t("…")`, `lier(…, "…")`, `data-t="…"`) existe dans le catalogue du jeu ou le catalogue commun : une clé
  // absente s'afficherait telle quelle. (La parité fr / en est vérifiée par packages/ui/test/catalogues.test.ts.)
  const cles = new Set([...Object.keys(CATALOGUE_JUMP.fr), ...Object.keys(CATALOGUE_COMMUN.fr)]);
  const sources = [...readdirSync(SRC).filter((f) => f.endsWith(".ts") && !f.startsWith("catalogue")).map((f) => join(SRC, f)), join(__dirname, "../index.html")];
  it("chaque clé appelée par le code existe", () => {
    const absentes: string[] = [];
    for (const fichier of sources) {
      const texte = readFileSync(fichier, "utf8");
      const motifs = [/\bt\(\s*"([a-z][\w.]*)"/g, /\blier\([^,]+,\s*"([a-z][\w.]*)"/g, /\sdata-t(?:-[a-z-]+)?="([a-z][\w.]*)"/g, /\bcle:\s*"([a-z][\w.]*)"/g];
      for (const re of motifs) for (const m of texte.matchAll(re)) if (!cles.has(m[1]!)) absentes.push(`${fichier.split("/").pop()} : ${m[1]}`);
    }
    expect(absentes).toEqual([]);
  });

  it("nom affiché « Jump » partout (plus « DailyJump » dans l'interface) ; titre « Jump — Du Jour »", () => {
    for (const l of ["fr", "en"] as const) {
      for (const [k, v] of Object.entries(CATALOGUE_JUMP[l])) for (const x of typeof v === "string" ? [v] : Object.values(v)) expect(x, `${l} ${k}`).not.toMatch(/DailyJump/);
      expect(CATALOGUE_JUMP[l]["page.titre"]).toBe("Jump — Du Jour");
    }
    expect(readFileSync(join(__dirname, "../index.html"), "utf8")).not.toMatch(/DailyJump/);
  });

  it("aucun émoji dans l'interface : seulement dans la ligne à partager (share.ts)", () => {
    for (const l of ["fr", "en"] as const) for (const [k, v] of Object.entries(CATALOGUE_JUMP[l])) for (const x of typeof v === "string" ? [v] : Object.values(v)) expect(x, `${l} ${k}`).not.toMatch(/\p{Extended_Pictographic}/u);
    for (const f of readdirSync(SRC).filter((x) => x.endsWith(".ts") && !["share.ts", "dailyInfo.ts", "tune.ts"].includes(x))) {
      const code = readFileSync(join(SRC, f), "utf8").replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
      expect(code, f).not.toMatch(/["'`][^"'`\n]*\p{Extended_Pictographic}/u);
    }
  });
});
