import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { A_CHOISIR, MOTIFS, etatPermis, fichierIllustration, identiteAChoisir, identiteComplete, lireFiche, projectionServeur, validerFiche, type FicheJeu } from "../src/fiche";
import { ENCRE_DU_MOTIF, fondDuMotif, slugDePolice, tonsDuMotif } from "../src/ficheSorties";

// Lot K5 (charte rév. 18, § 4, § 5 et § 9) — l'identité d'un jeu : sa police, son motif, son illustration, son panneau « Aujourd'hui ». Un jeu qui n'a pas une identité complète ne passe ni en `preview` ni en `on`.
const RACINE = resolve(__dirname, "..", "..", "..");
const { lireFichesBrutes } = (await import(/* @vite-ignore */ join(RACINE, "scripts/fiches-brutes.mjs"))) as typeof import("../../../scripts/fiches-brutes.mjs");
const fiches = (): FicheJeu[] => lireFichesBrutes(RACINE).map((f) => lireFiche(f.brut, f.id));
const brut = (id: string): Record<string, any> => JSON.parse(readFileSync(join(RACINE, "config/jeux", `${id}.json`), "utf8"));

/** Les jeux qui n'ont pas (encore) leur panneau « Aujourd'hui » : `identite.aujourdhui: false` n'est permis qu'ici, chaque ligne avec sa raison. */
const AUJOURDHUI_EXEMPTES: Record<string, string> = {
  blocks: "à fournir par la conversation du jeu",
  rush: "à fournir par la conversation du jeu",
  vertige: "à fournir par la conversation du jeu", // lot V1b : identité provisoire ; le panneau vient avec l'identité définitive (V4)
};

// Le rapport de contraste WCAG de deux couleurs `#RRGGBB` (la même formule que `packages/ui/src/contraste.ts`, qu'un paquet pur ne peut pas importer).
const lum = (hex: string): number => {
  const c = [0, 1, 2].map((i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contraste = (a: string, b: string): number => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

describe("l'identité de chaque jeu", () => {
  it("un jeu qui n'a pas une identité complète ne passe ni en `preview` ni en `on` (`off` est toujours permis)", () => {
    const f = structuredClone(brut("blocks"));
    f.identite.motif = A_CHOISIR;
    const neuf = lireFiche(f, "blocks");
    expect(identiteAChoisir(neuf)).toEqual(["identite.motif"]);
    expect(identiteComplete(neuf)).toBe(false);
    expect(etatPermis(neuf, "off")).toBe(true);
    expect(etatPermis(neuf, "preview")).toBe(false);
    expect(etatPermis(neuf, "on")).toBe(false);
    for (const champ of ["police", "illustration"] as const) {
      const g = structuredClone(brut("blocks"));
      g.identite[champ] = A_CHOISIR;
      const fiche = lireFiche(g, "blocks");
      expect(identiteAChoisir(fiche), champ).toEqual([`identite.${champ}`]);
      expect(etatPermis(fiche, "preview"), champ).toBe(false);
      expect(etatPermis(fiche, "on"), champ).toBe(false);
    }
  });
  it("le serveur le sait : sa projection porte `identiteManque` (les champs « à choisir » ; l'administration refuse alors `preview` et `on`), et rien pour un jeu complet", () => {
    const f = structuredClone(brut("rush"));
    f.identite.illustration = A_CHOISIR;
    const [complet, incomplet] = projectionServeur([lireFiche(f, "rush"), lireFiche(brut("blocks"), "blocks")]).jeux;
    expect(incomplet).toMatchObject({ id: "rush", identiteManque: ["illustration"] });
    expect(complet).not.toHaveProperty("identiteManque");
    f.identite.police = A_CHOISIR;
    f.identite.motif = A_CHOISIR;
    expect(projectionServeur([lireFiche(f, "rush")]).jeux[0]).toMatchObject({ identiteManque: ["police", "motif", "illustration"] });
  });
  it("un champ d'identité qui manque est refusé par la fiche, et chaque valeur est contrôlée", () => {
    const cas = (modif: (f: Record<string, any>) => void): string => {
      const f = structuredClone(brut("blocks"));
      modif(f);
      return validerFiche(f, "blocks").join("\n");
    };
    expect(cas((f) => delete f.identite)).toContain("identite : objet attendu");
    expect(cas((f) => delete f.identite.police)).toContain("identite.police");
    expect(cas((f) => (f.identite.motif = "pois")).toString()).toContain("identite.motif");
    expect(cas((f) => (f.identite.illustration = "apps/rush/public/illustration.svg"))).toContain("identite.illustration"); // le fichier d'un autre jeu
    expect(cas((f) => (f.identite.illustration = "https://exemple.fr/x.svg"))).toContain("identite.illustration");
    expect(cas((f) => delete f.identite.aujourdhui)).toContain("identite.aujourdhui");
    expect(cas((f) => (f.identite.police = "Lilita One"))).toContain("etiquette.police : doit commencer par la police de l'identité"); // une seule voix
  });
  it("dans le dépôt : un jeu à l'identité incomplète est `off` au départ, et les motifs sont ceux de la charte", () => {
    for (const f of fiches()) {
      if (!identiteComplete(f)) expect(f.etatDepart, `${f.id} : identité à choisir`).toBe("off");
      if (f.identite.motif !== A_CHOISIR) expect(MOTIFS, f.id).toContain(f.identite.motif);
    }
  });
  it("`aujourdhui: false` n'est permis qu'aux jeux de la liste d'exemptions (chacun avec sa raison), et la liste n'en garde aucun qui fournit son panneau", () => {
    for (const f of fiches()) {
      if (f.temoin) continue; // le jeu témoin est le modèle du kit : il n'a pas de panneau propre
      if (!identiteComplete(f)) continue; // un jeu de départ (identité « à choisir ») ne peut pas être publié : l'exemption se décide avec son identité
      if (f.identite.aujourdhui === false) expect(AUJOURDHUI_EXEMPTES, `${f.id} : fournir le panneau « Aujourd'hui », ou s'inscrire à la liste d'exemptions`).toHaveProperty(f.id);
    }
    for (const [id, raison] of Object.entries(AUJOURDHUI_EXEMPTES)) {
      expect(raison, id).toBe("à fournir par la conversation du jeu");
      const f = fiches().find((x) => x.id === id);
      expect(f?.identite.aujourdhui, `${id} fournit son panneau : retire-le de la liste`).toBe(false);
    }
  });
  it("la police est hébergée sur le site (sous licence OFL, avec sa licence) ; l'illustration est un fichier SVG du jeu, sans script ni ressource extérieure", () => {
    const sources: { famille: string; licence: string }[] = JSON.parse(readFileSync(join(RACINE, "packages/ui/polices/sources.json"), "utf8"));
    for (const f of fiches()) {
      if (f.identite.police !== A_CHOISIR) {
        const s = sources.find((x) => x.famille === f.identite.police);
        expect(s, `${f.id} : la police « ${f.identite.police} » n'est pas hébergée (packages/ui/polices/sources.json)`).toBeDefined();
        expect(existsSync(join(RACINE, "packages/ui/polices", s!.licence)), `${f.id} : sa licence`).toBe(true);
      }
      const dessin = fichierIllustration(f);
      if (dessin === null) continue;
      expect(existsSync(join(RACINE, dessin)), `${f.id} : ${dessin} manque`).toBe(true);
      const svg = readFileSync(join(RACINE, dessin), "utf8");
      expect(svg, dessin).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
      expect(svg, `${dessin} : ni script, ni gestionnaire, ni lien extérieur`).not.toMatch(/<script|\son\w+=|href=|<image|<foreignObject|url\(/i);
      expect(svg, `${dessin} : ni opacité ni transparence`).not.toMatch(/opacity/i);
    }
  });
  it("la face de la police existe pour le kit (feuille complète) et pour le profil (découpe réduite) ; le portail du profil l'importe", () => {
    const profil = readFileSync(join(RACINE, "apps/portail/src/profil.ts"), "utf8");
    for (const f of fiches()) {
      if (f.identite.police === A_CHOISIR) continue;
      const slug = slugDePolice(f.identite.police);
      if (f.etiquette.dessin === "generique") expect(existsSync(join(RACINE, `packages/ui/src/polices/${slug}-400.css`)), `${f.id} : packages/ui/src/polices/${slug}-400.css`).toBe(true);
      if (fichierIllustration(f)) {
        expect(existsSync(join(RACINE, `packages/ui/src/polices-profil/${slug}-400.css`)), `${f.id} : packages/ui/src/polices-profil/${slug}-400.css (découpe « profil », node scripts/polices/decouper.mjs)`).toBe(true);
        expect(profil, `${f.id} : profil.ts importe la découpe « profil »`).toContain(`@cdj/ui/src/polices-profil/${slug}-400.css`);
      }
    }
  });
  it("le second ton d'un motif est la teinte du jeu assombrie d'un peu d'encre, et le texte d'encre reste lisible sur les deux (4,5:1)", () => {
    expect(readFileSync(join(RACINE, "packages/ui/src/jetons.css"), "utf8"), "l'encre du motif est le jeton --dj-encre").toContain(`--dj-encre: ${ENCRE_DU_MOTIF};`);
    for (const f of fiches()) {
      if (f.etiquette.dessin !== "generique" && fichierIllustration(f) === null) continue; // Track et Jump : cartes faites à la main, sans motif tiré de la fiche
      const [t1, t2] = tonsDuMotif(f.etiquette.fond);
      expect(t1).toBe(f.etiquette.fond.toUpperCase());
      expect(t2, f.id).not.toBe(t1);
      for (const ton of [t1, t2]) expect(contraste(ENCRE_DU_MOTIF, ton), `${f.id} : l'encre sur ${ton}`).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("chaque motif est un fond net : des arrêts francs, jamais un dégradé continu", () => {
    for (const motif of MOTIFS) {
      const fond = fondDuMotif(motif, ["#B8D8F4", "#AEC9E2"]);
      expect(fond, motif).toContain("#b8d8f4");
      if (motif === "uni") expect(fond).toBe("#b8d8f4");
      else expect(fond, motif).toMatch(/repeating-linear-gradient|linear-gradient\(45deg,#aec9e2 25%,transparent 25% 75%/);
    }
  });
});
