import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { BASE, caracteresEcrits } from "../../../scripts/polices/caracteres.mjs";
import { cataloguesApplications } from "./applications";
import { CATALOGUE_COMMUN } from "../src/catalogue";
import { CATALOGUE_AMIS } from "../src/catalogue.amis";
import { CATALOGUE_RETOURS } from "../src/catalogue.retours";
import { caracteresCouverts } from "./woff2";

// Lot I1 (charte § 4) : les polices hébergées sur le site — woff2, sous-ensemble latin, `font-display: swap`, licence OFL à côté, et le
// français couvert (accents, œ, guillemets « », espaces insécables). Fichiers copiés des paquets @fontsource (scripts/polices.mjs).
// Lot B1 : ces fichiers d'origine sont dans `polices/originaux/` ; **les fichiers servis (`polices/*.woff2`) en sont la découpe aux caractères utilisés** (`node scripts/polices/decouper.mjs`,
// `polices/decoupe.json`). Le test garde : (1) les originaux (empreintes) ; (2) la découpe (empreintes, jamais plus gros) ; (3) qu'**aucun caractère utilisé n'a été perdu** par la découpe ;
// (4) que **chaque caractère des catalogues fr et en et des pages fixes existe dans la police qui l'affiche** ; (5) le français couvert.
const DIR = join(__dirname, "../polices");
const ORIGINAUX = join(DIR, "originaux");
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
      "Rubik Mono One 400-normal",
    ]);
    for (const s of SOURCES) {
      const data = readFileSync(join(ORIGINAUX, s.fichier));
      expect(data.toString("latin1", 0, 4), s.fichier).toBe("wOF2");
      expect(data.length, s.fichier).toBe(s.octets);
      expect(createHash("sha256").update(data).digest("hex"), s.fichier).toBe(s.sha256);
      expect(s.paquet, s.fichier).toMatch(/^@fontsource\/[a-z-]+@\d+\.\d+\.\d+$/);
    }
    expect(readdirSync(ORIGINAUX).filter((f) => f.endsWith(".woff2")).sort()).toEqual(SOURCES.map((s) => s.fichier).sort());
    expect(readdirSync(DIR).filter((f) => f.endsWith(".woff2")).sort(), "une police servie par original, rien d'autre").toEqual(SOURCES.map((s) => s.fichier).sort());
  });

  it("la découpe : chaque fichier servi est celui que `decoupe.json` décrit, et plus léger que son original", () => {
    const decoupe: { polices: { fichier: string; avant: number; apres: number; sha256: string }[] } = JSON.parse(readFileSync(join(DIR, "decoupe.json"), "utf8"));
    expect(decoupe.polices.map((p) => p.fichier).sort()).toEqual(SOURCES.map((s) => s.fichier).sort());
    for (const p of decoupe.polices) {
      const data = readFileSync(join(DIR, p.fichier));
      expect(data.toString("latin1", 0, 4), p.fichier).toBe("wOF2");
      expect(data.length, `${p.fichier} : relance \`node scripts/polices/decouper.mjs\``).toBe(p.apres);
      expect(createHash("sha256").update(data).digest("hex"), p.fichier).toBe(p.sha256);
      expect(p.apres, p.fichier).toBeLessThan(SOURCES.find((s) => s.fichier === p.fichier)!.octets);
    }
  });

  it("la découpe ne perd aucun caractère utilisé : tout ce que la base et le projet écrivent, et que l'original porte, est dans la police servie", () => {
    const ecrits = caracteresEcrits() as Map<string, string[]>;
    const voulus = [...new Set<string>([...(BASE as Set<string>), ...ecrits.keys()])];
    for (const s of SOURCES) {
      const original = caracteresCouverts(readFileSync(join(ORIGINAUX, s.fichier)));
      const servi = caracteresCouverts(readFileSync(join(DIR, s.fichier)));
      const perdus = voulus.filter((c) => original.has(c.codePointAt(0)!) && !servi.has(c.codePointAt(0)!));
      expect(perdus.map((c) => `${c} (U+${c.codePointAt(0)!.toString(16)}, lu dans ${(ecrits.get(c) ?? ["la base"])[0]})`), `${s.fichier} : un caractère utilisé n'est plus dans la police — relance \`node scripts/polices/decouper.mjs\``).toEqual([]);
    }
  });

  // Les polices du texte courant : Archivo (400, 600, 700) affiche toute chaîne d'un catalogue ; les polices d'affichage (Archivo Black, Rubik Mono One, Lilita One, Barlow Condensed, JetBrains
  // Mono) n'en montrent qu'une partie (titres, chiffres) mais sur le même jeu de caractères : on vérifie la base ci-dessus pour toutes, et les catalogues pour Archivo.
  /** Les signes qu'aucune police du site n'a (l'original d'Archivo ne les porte pas non plus) : le navigateur prend la police du système, comme avant la découpe. Un nouveau signe se décide ici, en le voyant. */
  const SIGNES_DU_SYSTEME = new Set([..."←→↗⟳⤓⚠✓✕●○▲▼≈≥ᵉ¼½‰µ²\u0300\u036f\uffff\u202f"]);
  it("chaque caractère des catalogues fr et en existe dans la police du texte courant (Archivo), ou est un signe connu du système — le message dit la clé et le caractère", async () => {
    const archivo = ["archivo-latin-400-normal.woff2", "archivo-latin-600-normal.woff2", "archivo-latin-700-normal.woff2"].map((f) => ({ f, cmap: caracteresCouverts(readFileSync(join(DIR, f))), original: caracteresCouverts(readFileSync(join(ORIGINAUX, f))) }));
    const catalogues: [string, Record<string, unknown>][] = [];
    const tous = [["commun", CATALOGUE_COMMUN], ["amis", CATALOGUE_AMIS], ["retours", CATALOGUE_RETOURS], ...(await cataloguesApplications())] as [string, { fr: Record<string, unknown>; en: Record<string, unknown> }][];
    for (const [nom, cat] of tous) for (const l of ["fr", "en"] as const) catalogues.push([`${nom} ${l}`, cat[l]]);
    const manquants: string[] = [];
    for (const [nom, cat] of catalogues) {
      for (const [cle, v] of Object.entries(cat)) {
        const textes = typeof v === "string" ? [v] : Object.values(v as object).map(String);
        for (const c of new Set(textes.join("").normalize("NFC"))) {
          const cp = c.codePointAt(0)!;
          if (cp < 0x20 || SIGNES_DU_SYSTEME.has(c) || cp > 0xffff) continue; // (emojis : jamais dans l'interface, charte § 6)
          for (const a of archivo) {
            if (a.cmap.has(cp)) continue;
            manquants.push(a.original.has(cp) ? `${nom} › ${cle} : « ${c} » (U+${cp.toString(16)}) manque à ${a.f} : relance \`node scripts/polices/decouper.mjs\`` : `${nom} › ${cle} : « ${c} » (U+${cp.toString(16)}) n'est dans aucune police : change le texte ou ajoute le signe à SIGNES_DU_SYSTEME`);
            break;
          }
        }
      }
    }
    expect(manquants).toEqual([]);
  });

  // Lot B1b : les images de partage et les icônes (scripts/images-partage.mjs) affichent « DU JOUR », « TRACK » et « JUMP » dans trois polices d'affichage : la découpe les couvre, sinon l'image
  // retomberait sur une police du système (le dessin lui-même refuse une police non chargée, mais pas un caractère absent d'une police chargée).
  it("le texte de l'image de partage est dans les polices qui le dessinent (Archivo Black, Barlow Condensed 800 italique, Lilita One)", () => {
    const html = readFileSync(join(__dirname, "../../../apps/portail/partage/images.html"), "utf8").replace(/<!--[\s\S]*?-->/g, "").replace(/<(style|script|title)[\s\S]*?<\/\1>/g, "");
    const texte = [...html.matchAll(/>([^<>]+)</g)].map((m) => m[1]!.trim()).join("");
    expect(texte.length, "le texte de l'image est lu").toBeGreaterThan(8);
    for (const f of ["archivo-black-latin-400-normal.woff2", "barlow-condensed-latin-800-italic.woff2", "lilita-one-latin-400-normal.woff2"]) {
      const couverts = caracteresCouverts(readFileSync(join(DIR, f)));
      expect([...new Set(texte.replace(/\s/g, ""))].filter((c) => !couverts.has(c.codePointAt(0)!)), `${f} : un caractère de l'image de partage manque (relance \`node scripts/polices/decouper.mjs\`)`).toEqual([]);
    }
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
