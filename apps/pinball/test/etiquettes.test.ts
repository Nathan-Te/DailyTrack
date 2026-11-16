import { describe, expect, it } from "vitest";
import { Partie, dailyPinball } from "@cdj/pinball-sim";
import { GROSSISSEMENT_ETIQUETTE, boiteDeLEtiquette, lampesMission, boiteTouche, boitesSeRecouvrent, empreinteDuModule, largeurPlaque, largeurTexte, placerEtiquettes, px, styleEtiquette } from "../src/dessin";
import { CATALOGUE_FR } from "../src/catalogue.fr";
import { CATALOGUE_EN } from "../src/catalogue.en";

// Lot PBV2 : les étiquettes des modules ne se chevauchent plus, sur aucune table. La règle (`placerEtiquettes`, dans `dessin.ts`, commune au rendu three.js et au rendu à plat) : chaque nom reste à sa place habituelle, au-dessous
// de son module ; si sa plaque en recouvre une autre, un module ou un poteau, ou sort de la table, on la décale, et si aucun décalage ne suffit on la réduit. Ce test la prouve sur 120 tables (30 jours × 4 thèmes), en français et en anglais.
const THEMES = ["foire", "ocean", "espace", "volcan"] as const;
const JOURS = Array.from({ length: 30 }, (_, k) => 20800 + k);
const LANGUES = { fr: CATALOGUE_FR, en: CATALOGUE_EN } as const;

/** Le nom d'un module, comme `scene.ts` le donne (le même aiguillage, le même catalogue). */
function noms(langue: keyof typeof LANGUES, theme: string): (module: string) => string | null {
  const cat = LANGUES[langue] as Record<string, string>;
  return (module) =>
    module === "mini" ? cat[`module.bumpers.${theme}`]! : ["bumpers", "cibles", "spinner", "trou"].includes(module) ? cat[`module.${module}.${theme}`]! : ["manege", "tourbillon", "trouNoir", "portailA", "portailB", "asteroide", "geyser", "coulee"].includes(module) ? cat[`module.${module}`]! : null;
}

describe("les étiquettes ne se chevauchent plus (lot PBV2)", () => {
  for (const langue of Object.keys(LANGUES) as (keyof typeof LANGUES)[]) {
    it(`sur 120 tables, en ${langue} : aucune plaque n'en recouvre une autre, un module ou un poteau, et toutes restent entre les rails`, () => {
      let plaques = 0;
      let reduites = 0;
      let ambigues = 0;
      for (const theme of THEMES) {
        for (const jour of JOURS) {
          const table = new Partie(dailyPinball(jour, undefined, theme)).table;
          const etiquettes = placerEtiquettes(table, theme, noms(langue, theme));
          const quoi = `${langue} ${theme} ${jour}`;
          // une plaque par module nommé (tous les modules des tables du jeu portent un nom)
          expect(etiquettes, quoi).toHaveLength(table.poses.length);
          etiquettes.forEach((e, i) => {
            plaques++;
            if (e.taille < 1) reduites++;
            const b = boiteDeLEtiquette(e);
            // contre les autres plaques
            for (let k = i + 1; k < etiquettes.length; k++) expect(boitesSeRecouvrent(b, boiteDeLEtiquette(etiquettes[k]!)), `${quoi} : ${e.texte} / ${etiquettes[k]!.texte}`).toBe(false);
            // contre tous les modules (leur empreinte, la sienne comprise) et les poteaux
            for (const m of table.poses) expect(boiteTouche(b, px(m.x), px(m.y), empreinteDuModule(m.type)), `${quoi} : ${e.texte} / ${m.type}`).toBe(false);
            for (const p of table.poteaux) expect(boiteTouche(b, px(p.x), px(p.y), px(p.r)), `${quoi} : ${e.texte} / poteau`).toBe(false);
            for (const but of [3, 4, 5]) for (const l of lampesMission(table, theme, but)) expect(boiteTouche(b, l.x, l.y, 5.5), `${quoi} : ${e.texte} / lampe de la mission`).toBe(false);
            for (const v of table.voies) expect(boiteTouche(b, px(v.x), px(v.y) + 24, 6), `${quoi} : ${e.texte} / lampe de couloir`).toBe(false);
            // plus près d'un autre module que du sien : on lirait le nom du voisin (rare, et jamais en dessous de la moitié de la distance)
            const propre = Math.hypot(e.x - px(table.poses[i]!.x), e.y - px(table.poses[i]!.y));
            if (table.poses.some((o, k) => k !== i && Math.hypot(e.x - px(o.x), e.y - px(o.y)) < propre)) ambigues++;
            // entre les rails, au-dessus des lance-pierres
            expect(b.x0, quoi).toBeGreaterThanOrEqual(24);
            expect(b.x1, quoi).toBeLessThanOrEqual(344);
            expect(b.y1, quoi).toBeLessThanOrEqual(470);
            // une plaque reste lisible : jamais sous 68 % de sa taille
            expect(e.taille, `${quoi} : ${e.texte}`).toBeGreaterThanOrEqual(0.68);
          });
        }
      }
      expect(plaques).toBeGreaterThan(600);
      // la réduction est le dernier recours : la plupart des plaques gardent leur taille entière
      expect(reduites / plaques, "part des plaques réduites").toBeLessThan(0.15);
      // et presque toutes restent plus près de leur module que de tout autre
      expect(ambigues / plaques, "part des plaques plus proches d'un autre module").toBeLessThan(0.03);
    });
  }

  it("la mise en place ne dépend que de la table et des textes (deux appels, même résultat)", () => {
    const table = new Partie(dailyPinball(20801, undefined, "foire")).table;
    const a = placerEtiquettes(table, "foire", noms("fr", "foire"));
    expect(placerEtiquettes(table, "foire", noms("fr", "foire"))).toEqual(a);
  });

  it("l'ancienne collision est réglée : « POMMES D'AMOUR » ne se colle plus à « GRANDE ROUE » (Fête foraine, le jour de la capture du PBV1)", () => {
    const table = new Partie(dailyPinball(20850, undefined, "foire")).table;
    const e = placerEtiquettes(table, "foire", noms("fr", "foire"));
    const pommes = e.find((x) => x.texte.replace("\n", " ") === "POMMES D'AMOUR");
    const roue = e.find((x) => x.texte.replace("\n", " ") === "GRANDE ROUE");
    if (pommes && roue) expect(boitesSeRecouvrent(boiteDeLEtiquette(pommes), boiteDeLEtiquette(roue))).toBe(false);
  });

  it("l'estimation de la largeur d'un texte est prudente : jamais en dessous de ce qu'une police large (DejaVu Sans gras) mesure", () => {
    // la largeur de chaque nom (fr et en) au gras 9 px de DejaVu Sans, la police de repli la plus large du conteneur d'essai (Chromium de Playwright ; Liberation Sans et la police du jeu sont plus étroites) : l'estimation doit la couvrir
    const mesures: Record<string, number> = { "POMMES D'AMOUR": 95.96, "CHAMBOULE-TOUT": 93.41, "GRANDE ROUE": 73.6, "STAND DE TIR": 70.19, "BULLES": 38.27, "COQUILLAGES": 71.02, "HÉLICE": 35.52, "PIEUVRE": 43.44, "PLANÈTES": 51.75, "SATELLITES": 58.62, "RADAR": 35.26, "SONDE": 35.28, "BRAISES": 43.22, "ROCHERS": 48.28, "MOULIN": 40.53, "CRATÈRE": 45.17, "MANÈGE": 43.14, "TOURBILLON": 64.57, "TROU NOIR": 56.62, "PORTAIL A": 52.36, "PORTAIL B": 52.26, "ASTÉROÏDE": 57.28, "GEYSER": 39.61, "COULÉE": 39.59, "CANDY APPLES": 76.09, "TIN-CAN TOSS": 71.34, "BIG WHEEL": 56.22, "SHOOTING GALLERY": 101.78, "BUBBLES": 46.25, "SHELLS": 38.11, "PROPELLER": 58.47, "OCTOPUS": 48.43, "PLANETS": 45.6, "PROBE": 34.19, "EMBERS": 41.52, "ROCKS": 34.64, "MILL": 23.77, "CRATER": 39.02, "CAROUSEL": 53.82, "WHIRLPOOL": 61.11, "BLACK HOLE": 63.34, "PORTAL A": 49.01, "PORTAL B": 48.91, "ASTEROID": 51.13, "LAVA FLOW": 57.68 };
    expect(Object.keys(mesures).length).toBeGreaterThan(40);
    for (const [texte, mesure] of Object.entries(mesures)) expect(largeurTexte(texte), texte).toBeGreaterThanOrEqual(mesure);
  });

  it("chaque thème a son style de plaque : encre, bois, métal riveté, pierre gravée", () => {
    expect(THEMES.map(styleEtiquette)).toEqual(["encre", "bois", "metal", "pierre"]);
    for (const t of THEMES) expect(largeurPlaque("ABC", styleEtiquette(t))).toBeGreaterThan(largeurTexte("ABC"));
  });

  it("le grossissement des plaques est celui du curseur par défaut (140 %) avec la perspective", () => {
    expect(GROSSISSEMENT_ETIQUETTE).toBeGreaterThanOrEqual(1.4);
    expect(GROSSISSEMENT_ETIQUETTE).toBeLessThanOrEqual(1.5);
  });
});
