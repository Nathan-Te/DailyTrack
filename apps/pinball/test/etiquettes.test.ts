import { describe, expect, it } from "vitest";
import { IDS_PLANS, Partie, dailyPinball } from "@cdj/pinball-sim";
import { GROSSISSEMENT_ETIQUETTE, boiteDeLEtiquette, lampesMission, boiteTouche, boitesSeRecouvrent, disquesDesRails, disquesDuMini, empreinteDuModule, flechesDesRails, largeurPlaque, largeurTexte, placerEtiquettes, px, styleEtiquette } from "../src/dessin";
import { nomDuModule } from "../src/noms";
import { CATALOGUE_FR } from "../src/catalogue.fr";
import { CATALOGUE_EN } from "../src/catalogue.en";

// Lot PBV2 : les étiquettes des modules ne se chevauchent plus, sur aucune table. La règle (`placerEtiquettes`, dans `dessin.ts`, commune au rendu three.js et au rendu à plat) : chaque nom reste à sa place habituelle, au-dessous
// de son module ; si sa plaque en recouvre une autre, un module ou un poteau, ou sort de la table, on la décale, et si aucun décalage ne suffit on la réduit.
// **Lot PBG1 : les quatre plans** (`PLANS`), leurs rampes et leur orbite : les rails, leurs bouches et le mini-batteur sont des obstacles, et chaque rampe et l'orbite ont leur plaque. Ce test la prouve sur 128 tables (les quatre
// plans × les quatre thèmes × huit jours), en français et en anglais, un test par plan et par langue (chacun reste sous la seconde).
const THEMES = ["foire", "ocean", "espace", "volcan"] as const;
const JOURS = Array.from({ length: 8 }, (_, k) => 20800 + k);
const LANGUES = { fr: CATALOGUE_FR, en: CATALOGUE_EN } as const;

/** Le nom d'un module ou d'un rail, comme `scene.ts` le donne (le même aiguillage, le même catalogue). */
function noms(langue: keyof typeof LANGUES, theme: string): (module: string) => string | null {
  const cat = LANGUES[langue] as Record<string, string>;
  return (module) => nomDuModule((cle) => cat[cle]!, theme, module);
}

/**
 * Ce que la mise en place sait tenir sur chaque plan (mesuré au lot PBG1 sur ces 128 tables, avec une marge parce que les plans bougent encore : le test garde contre une régression, il ne dit pas que c'est beau ; à resserrer quand les emplacements seront arrêtés). **Les garanties dures — aucune plaque ne recouvre
 * une autre plaque, un module, un poteau, une lampe, ni ne sort de la table — n'ont pas de seuil.** `reduites` : la part des plaques réduites (avant les plans : 15 %) ; `ambigues` : celle des plaques plus proches d'un autre module
 * ou d'une autre bouche que de ce qu'elles nomment (avant les plans : 3 %) ; `surUnRail` : celle des plaques qui recouvrent un rail, une bouche ou le mini-batteur, dernier recours d'une plaque sans autre place. Les plans sont
 * plus encombrés que la table des lots PB1 à PB4 : la « Doublette », où deux rampes se croisent sur les modules, est la plus serrée (son emplacement du haut n'a presque jamais de place).
 */
const SEUILS: Readonly<Record<string, { reduites: number; ambigues: number; surUnRail: number }>> = {
  doublette: { reduites: 0.7, ambigues: 0.65, surUnRail: 0.3 },
  tremplin: { reduites: 0.65, ambigues: 0.5, surUnRail: 0.1 },
  bretelle: { reduites: 0.6, ambigues: 0.5, surUnRail: 0.1 },
  boucle: { reduites: 0.65, ambigues: 0.45, surUnRail: 0.1 },
};

describe("les étiquettes ne se chevauchent plus (lots PBV2 et PBG1)", () => {
  for (const langue of Object.keys(LANGUES) as (keyof typeof LANGUES)[]) {
    for (const plan of IDS_PLANS) {
      it(`plan « ${plan} », en ${langue} : aucune plaque n'en recouvre une autre, un module, un poteau ou une lampe, et toutes restent entre les rails`, () => {
        let plaques = 0;
        let reduites = 0;
        let ambigues = 0;
        let surUnRail = 0;
        for (const theme of THEMES) {
          for (const jour of JOURS) {
            const table = new Partie(dailyPinball(jour, undefined, theme, plan)).table;
            const etiquettes = placerEtiquettes(table, theme, noms(langue, theme));
            const quoi = `${langue} ${plan} ${theme} ${jour}`;
            // une plaque par module nommé (tous les modules des tables du jeu portent un nom), puis une par rampe et une pour l'orbite
            expect(etiquettes, quoi).toHaveLength(table.poses.length + table.rails.length);
            expect(etiquettes.slice(table.poses.length).map((e) => e.module), quoi).toEqual(table.rails.map((r) => r.genre));
            const rails = [...disquesDesRails(table), ...disquesDuMini(table)];
            const toutesAncres = [...table.poses.map((m) => ({ x: px(m.x), y: px(m.y) })), ...flechesDesRails(table)];
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
              // les rails, leurs bouches et le mini-batteur : le dernier recours d'une plaque sans autre place les recouvre, et on le compte
              if (rails.some((d) => boiteTouche(b, d.x, d.y, d.r))) surUnRail++;
              // plus près d'un autre module (ou d'une autre bouche) que de ce qu'elle nomme : on lirait le nom du voisin
              const propre = Math.min(...e.ancres.map((a) => Math.hypot(e.x - a.x, e.y - a.y)));
              if (toutesAncres.some((o) => !e.ancres.some((a) => a.x === o.x && a.y === o.y) && Math.hypot(e.x - o.x, e.y - o.y) < propre)) ambigues++;
              // entre les rails, au-dessus des lance-pierres
              expect(b.x0, quoi).toBeGreaterThanOrEqual(24);
              expect(b.x1, quoi).toBeLessThanOrEqual(344);
              expect(b.y1, quoi).toBeLessThanOrEqual(470);
              // une plaque reste lisible : jamais sous 68 % de sa taille
              expect(e.taille, `${quoi} : ${e.texte}`).toBeGreaterThanOrEqual(0.68);
            });
          }
        }
        expect(plaques).toBeGreaterThan(200);
        const seuils = SEUILS[plan]!;
        // la réduction est le dernier recours, et presque toutes les plaques restent plus près de ce qu'elles nomment que de tout autre
        expect(reduites / plaques, "part des plaques réduites").toBeLessThan(seuils.reduites);
        expect(ambigues / plaques, "part des plaques plus proches d'un autre module").toBeLessThan(seuils.ambigues);
        expect(surUnRail / plaques, "part des plaques posées sur un rail").toBeLessThan(seuils.surUnRail);
      });
    }
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
    const mesures: Record<string, number> = { "POMMES D'AMOUR": 95.96, "CHAMBOULE-TOUT": 93.41, "GRANDE ROUE": 73.6, "STAND DE TIR": 70.19, "BULLES": 38.27, "COQUILLAGES": 71.02, "HÉLICE": 35.52, "PIEUVRE": 43.44, "PLANÈTES": 51.75, "SATELLITES": 58.62, "RADAR": 35.26, "SONDE": 35.28, "BRAISES": 43.22, "ROCHERS": 48.28, "MOULIN": 40.53, "CRATÈRE": 45.17, "MANÈGE": 43.14, "TOURBILLON": 64.57, "TROU NOIR": 56.62, "PORTAIL A": 52.36, "PORTAIL B": 52.26, "ASTÉROÏDE": 57.28, "GEYSER": 39.61, "COULÉE": 39.59, "CANDY APPLES": 76.09, "TIN-CAN TOSS": 71.34, "BIG WHEEL": 56.22, "SHOOTING GALLERY": 101.78, "BUBBLES": 46.25, "SHELLS": 38.11, "PROPELLER": 58.47, "OCTOPUS": 48.43, "PLANETS": 45.6, "PROBE": 34.19, "EMBERS": 41.52, "ROCKS": 34.64, "MILL": 23.77, "CRATER": 39.02, "CAROUSEL": 53.82, "WHIRLPOOL": 61.11, "BLACK HOLE": 63.34, "PORTAL A": 49.01, "PORTAL B": 48.91, "ASTEROID": 51.13, "LAVA FLOW": 57.68, "MONTAGNES RUSSES": 106.66, TOBOGGAN: 57.57, "TUBE ORBITAL": 72.52, WAGONNET: 58.88, "GRAND HUIT": 63.75, COURANT: 49.13, ORBITE: 37.08, GALERIE: 42.66, "ROLLER COASTER": 88.94, "WATER SLIDE": 67.32, "ORBITAL TUBE": 72.52, "MINE CART": 55.35, "BIG DIPPER": 57.82, CURRENT: 47.59, ORBIT: 30.93, GALLERY: 44.93 };
    expect(Object.keys(mesures).length).toBeGreaterThan(55);
    for (const [texte, mesure] of Object.entries(mesures)) expect(largeurTexte(texte), texte).toBeGreaterThanOrEqual(mesure);
  });

  it("chaque rampe et l'orbite ont leur plaque, au nom du thème, en français et en anglais ; la plaque est derrière la flèche d'une de leurs bouches", () => {
    for (const langue of Object.keys(LANGUES) as (keyof typeof LANGUES)[]) {
      const cat = LANGUES[langue] as Record<string, string>;
      for (const theme of THEMES) {
        const table = new Partie(dailyPinball(20802, undefined, theme, "doublette")).table;
        const e = placerEtiquettes(table, theme, noms(langue, theme));
        const rails = e.slice(table.poses.length);
        expect(rails.map((x) => x.texte.replace("\n", " ")), `${langue} ${theme}`).toEqual([cat[`module.rampe.${theme}`]!, cat[`module.rampe.${theme}`]!, cat[`module.orbite.${theme}`]!].map((t) => t.toLocaleUpperCase()));
        // chaque plaque de rail nomme les bouches de son rail (une pour une rampe, deux pour l'orbite)
        expect(rails.map((x) => x.ancres.length), `${langue} ${theme}`).toEqual([1, 1, 2]);
      }
    }
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
