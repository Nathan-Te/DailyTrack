import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { caracteresCouverts } from "./woff2";

// Lot I1 (charte § 4) : les polices hébergées sur le site — woff2, sous-ensemble latin, `font-display: swap`, licence OFL à côté, et le
// français couvert (accents, œ, guillemets « », espaces insécables). Fichiers copiés des paquets @fontsource (scripts/polices.mjs).
const DIR = join(__dirname, "../polices");
const CSS = join(__dirname, "../src/polices");
type Source = { fichier: string; famille: string; paquet: string; licence: string; octets: number; sha256: string };
const SOURCES: Source[] = JSON.parse(readFileSync(join(DIR, "sources.json"), "utf8"));

/** Le français : lettres accentuées, ligatures, guillemets, apostrophe typographique, espace insécable, et la ponctuation des interfaces. */
const FRANCAIS = [..."aàâäbcçdeéèêëfghiîïjklmnoôöpqrstuùûüvwxyÿzæœAÀÂÄBCÇDEÉÈÊËFGHIÎÏJKLMNOÔÖPQRSTUÙÛÜVWXYZÆŒ0123456789«»’'°·…€:;!?,.-–—()/ "];
/** Écarts connus, vérifiés ici pour qu'un changement de police se voie : Ÿ (U+0178) est dans le sous-ensemble « latin-ext » (rarissime en
 *  français) ; Lilita One n'a pas d'espace insécable (le navigateur prend celle de la police de repli, une espace de même rôle). */
const MANQUES_ADMIS: Record<string, string[]> = { "Lilita One": [" "] };

describe("polices hébergées", () => {
  it("les familles et graisses de la charte, en woff2 du sous-ensemble latin, empreintes vérifiées", () => {
    expect(SOURCES.map((s) => `${s.famille} ${s.fichier.replace(/^.*-latin-|\.woff2$/g, "")}`)).toEqual([
      "Archivo Black 400-normal",
      "Archivo 400-normal",
      "Archivo 600-normal",
      "Archivo 700-normal",
      "JetBrains Mono 500-normal",
      "JetBrains Mono 700-normal",
      "Barlow Condensed 600-normal",
      "Barlow Condensed 700-italic",
      "Barlow Condensed 800-italic",
      "Lilita One 400-normal",
    ]);
    for (const s of SOURCES) {
      const data = readFileSync(join(DIR, s.fichier));
      expect(data.toString("latin1", 0, 4), s.fichier).toBe("wOF2");
      expect(data.length, s.fichier).toBe(s.octets);
      expect(createHash("sha256").update(data).digest("hex"), s.fichier).toBe(s.sha256);
      expect(s.paquet, s.fichier).toMatch(/^@fontsource\/[a-z-]+@\d+\.\d+\.\d+$/);
    }
    expect(readdirSync(DIR).filter((f) => f.endsWith(".woff2")).sort()).toEqual(SOURCES.map((s) => s.fichier).sort());
  });

  it("une licence SIL OFL à côté de chaque famille", () => {
    for (const s of SOURCES) {
      expect(existsSync(join(DIR, s.licence)), s.licence).toBe(true);
      expect(readFileSync(join(DIR, s.licence), "utf8"), s.licence).toContain("SIL Open Font License, Version 1.1");
    }
  });

  it("le français est couvert (accents, œ, « », ’, espace insécable), aux écarts connus près", () => {
    for (const s of SOURCES) {
      const couverts = caracteresCouverts(readFileSync(join(DIR, s.fichier)));
      const manquants = FRANCAIS.filter((c) => !couverts.has(c.codePointAt(0)!));
      expect(manquants, s.fichier).toEqual(MANQUES_ADMIS[s.famille] ?? []);
      // Aucune n'a l'espace fine insécable (U+202F) : formatNombre la remplace (formats.ts).
      expect(couverts.has(0x202f), s.fichier).toBe(false);
    }
  });

  it("une feuille par face (famille, graisse, style) : font-display swap, woff2 seulement, unicode-range latin, chaque fichier déclaré une fois", () => {
    const declares: string[] = [];
    for (const f of readdirSync(CSS)) {
      const css = readFileSync(join(CSS, f), "utf8");
      const faces = css.match(/@font-face\s*{[^}]*}/g) ?? [];
      expect(faces.length, f).toBe(1);
      for (const face of faces) {
        expect(face, f).toContain("font-display: swap;");
        expect(face, f).toContain("U+0152-0153");
        const url = /url\("\.\.\/\.\.\/polices\/([^"]+\.woff2)"\) format\("woff2"\)/.exec(face);
        expect(url, f).not.toBeNull();
        declares.push(url![1]!);
        const s = SOURCES.find((x) => x.fichier === url![1]);
        expect(face, f).toContain(`font-family: "${s!.famille}";`);
      }
      expect(css, f).not.toMatch(/https?:/);
    }
    expect(declares.sort()).toEqual(SOURCES.map((s) => s.fichier).sort());
  });
});
