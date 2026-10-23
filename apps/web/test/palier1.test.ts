import { describe, expect, it } from "vitest";
import { Color } from "three";
import { CELL, THEMES, WALL_HEIGHT, dailyCircuit, daysFromCivil, parseTrack, themeForDay, type PaletteName, type ThemeName } from "@cdj/sim";
import { COLONNES_FEUX, FEUX_ETEINTS, etatFeux, type EtatFeux } from "../src/feux";
import { palierDemande } from "../src/access";
import { Builder } from "../src/meshKit";
import { PAS_DISTANCE, distanceSigns, signsFor } from "../src/signage";
import { PALETTE_DEFS } from "../src/trackMesh";
import { geometrieP1 } from "../src/scene/composerP1";
import { THEMES_C } from "../src/scene/lumiere";
import { FeuxDepart, ROUGE_PISTE, paletteP1, routeP } from "../src/scene/palier1";
import { MARQUE } from "../src/scene/pieces";
import { REBORDS_B, rebordB, type RebordB } from "../src/scene/piste";
import { gardeCorps, type TronconRebord } from "../src/scene/route";
import { SPONSORS, encreDe, rectSponsor, sponsorsDuTheme } from "../src/scene/sponsors";
import { LIVREE, ecartCouleurs } from "../src/voiture/livree";

// Lot 43 : le palier 1 en jeu — feux de départ, panneaux de distance, sponsors fictifs, l'orange réservé à la voiture, Stade et Nuit distincts, rebords
// légers, garde-corps de la Ville. Sans carte graphique : la géométrie du palier 1 (`geometrieP1`, sans DOM) et les règles pures. La pose (lot 37) de tous
// ces éléments est vérifiée par `decorPose.test.ts` ; les feux dans le vrai jeu, par `e2e/socle.spec.ts`.

/** Un circuit de chaque thème (thème imposé un jour du lot 37). */
function unParTheme() {
  return (Object.keys(THEMES) as ThemeName[]).map((theme) => {
    const day = daysFromCivil(2026, 10, 14);
    const c = dailyCircuit(day, 0, themeForDay(day).name === theme ? null : theme);
    return { theme, palette: c.palette, track: c.track };
  });
}

/** Luminance relative (WCAG) d'une couleur 0xRRGGBB. */
function lum(hex: number): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((hex >> 16) & 255) + 0.7152 * lin((hex >> 8) & 255) + 0.0722 * lin(hex & 255);
}
const contraste = (a: number, b: number) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);

/** Les couleurs (0xRRGGBB) des sommets d'un calque : `Builder` les garde en lumière linéaire. */
function couleurs(g: Builder): Set<number> {
  const out = new Set<number>();
  const c = new Color();
  for (let i = 0; i < g.col.length; i += 3) out.add(c.setRGB(g.col[i]!, g.col[i + 1]!, g.col[i + 2]!).getHex());
  return out;
}

describe("feux de départ : ils suivent le décompte (lecture seule)", () => {
  it("éteints au début, une colonne de plus à chaque cinquième du décompte, toutes avant la fin, vertes au départ", () => {
    expect(etatFeux("countdown", 3, 3)).toEqual(FEUX_ETEINTS);
    const vus: number[] = [];
    for (let t = 3; t > 0; t -= 0.05) vus.push(etatFeux("countdown", t, 3).rouges);
    expect(vus.slice(1).every((n, i) => n >= vus[i]!)).toBe(true);
    expect([...new Set(vus)]).toEqual([0, 1, 2, 3, 4, 5]);
    expect(etatFeux("countdown", 0.01, 3)).toEqual({ rouges: COLONNES_FEUX, vert: false });
    expect(etatFeux("racing", 0, 3)).toEqual({ rouges: 0, vert: true });
    expect(etatFeux("finished", 0, 3).vert).toBe(true);
  });

  it("le portique de départ porte cinq colonnes de deux feux ; les repeindre ne touche que leurs sommets", () => {
    const track = parseTrack("feux", "S/n@start S S L2 S S@finish");
    const g = geometrieP1(track, "stade", { headless: true });
    const feux = g.feux!;
    expect(feux.vide).toBe(false);
    const col = Float32Array.from(g.calques.lumineux.col);
    const avant = Float32Array.from(col);
    const lin = (hex: number): [number, number, number] => {
      const c = new Color(hex);
      return [c.r, c.g, c.b];
    };
    const etat: EtatFeux = { rouges: 2, vert: false };
    const plage = feux.peindre(col, etat, lin)!;
    expect(plage[1]).toBeGreaterThan(plage[0]);
    for (let i = 0; i < col.length; i++) if (i < plage[0] || i >= plage[1]) expect(col[i]).toBe(avant[i]);
    // Deux colonnes rouges, trois éteintes : deux couleurs dans la plage des feux.
    const vues = new Set<number>();
    const c = new Color();
    for (let i = plage[0]; i < plage[1]; i += 3) vues.add(c.setRGB(col[i]!, col[i + 1]!, col[i + 2]!).getHex());
    expect(vues.size).toBe(2);
    // Un à un de gauche à droite : la première colonne allumée est à gauche du pilote (cap +z : sa gauche est vers +x, la caméra regarde vers +z).
    feux.peindre(col, { rouges: 1, vert: false }, lin);
    const pos = g.calques.lumineux.pos;
    const xs: number[] = [];
    const xsRouges: number[] = [];
    for (let i = plage[0]; i < plage[1]; i += 3) {
      xs.push(pos[i]!);
      if (col[i]! > 0.5) xsRouges.push(pos[i]!); // rouge allumé (linéaire ≈ 1), l'éteint est sombre (≈ 0,02)
    }
    const milieu = (Math.min(...xs) + Math.max(...xs)) / 2;
    expect(xsRouges.length).toBeGreaterThan(0);
    expect(Math.min(...xsRouges)).toBeGreaterThan(milieu + 1.5);
    feux.peindre(col, { rouges: 0, vert: true }, lin);
    const verts = new Set<number>();
    for (let i = plage[0]; i < plage[1]; i += 3) verts.add(c.setRGB(col[i]!, col[i + 1]!, col[i + 2]!).getHex());
    expect(verts.size).toBe(1);
  });

  it("les feux sont lus par l'affichage seulement : FeuxDepart ne connaît que des couleurs", () => {
    expect(Object.getOwnPropertyNames(FeuxDepart.prototype).sort()).toEqual(["constructor", "peindre", "poser", "vide"]);
  });
});

describe("l'orange est à la voiture seule (ΔE 2000 > 12)", () => {
  it("chaque élément de piste de chaque thème : route, rebords, vibreurs, plaques, portes, panneaux, feux, sol — sauf la livrée de la marque sur le portique", () => {
    for (const { theme, palette, track } of unParTheme()) {
      const g = geometrieP1(track, palette, { headless: true });
      const vues = new Set([...couleurs(g.calques.route), ...couleurs(g.calques.solide), ...couleurs(g.calques.lumineux)]);
      vues.add(Number.parseInt(paletteP1(palette, PALETTE_DEFS[palette]).floorA.slice(1), 16));
      vues.add(Number.parseInt(THEMES_C[palette].sol[0].slice(1), 16));
      // La livrée orange de la marque (portique de départ, en hauteur) est la seule exception : la couleur exacte, nulle part ailleurs.
      vues.delete(MARQUE.livree);
      const proches = [...vues].filter((c) => ecartCouleurs(LIVREE.orange, c) <= 12).map((c) => c.toString(16));
      expect(proches, `${theme} : couleurs trop proches de l'orange de la voiture`).toEqual([]);
    }
  }, 60_000);

  it("la livrée orange de la marque n'est que sur le portique de départ, à plus de 4 m au-dessus de la route", () => {
    for (const { theme, palette, track } of unParTheme()) {
      const g = geometrieP1(track, palette, { headless: true });
      const depart = track.blocks[0]!;
      const c = new Color();
      for (const b of [g.calques.route, g.calques.solide, g.calques.lumineux]) {
        for (let i = 0; i < b.col.length; i += 3) {
          if (c.setRGB(b.col[i]!, b.col[i + 1]!, b.col[i + 2]!).getHex() !== MARQUE.livree) continue;
          expect(b.pos[i + 1]! - depart.y0, `${theme} : la livrée est en hauteur`).toBeGreaterThan(4);
          expect(Math.floor(b.pos[i]! / CELL) === depart.cx && Math.floor(b.pos[i + 2]! / CELL) === depart.cz, `${theme} : la livrée est sur le portique`).toBe(true);
        }
      }
    }
  }, 60_000);

  it("le rouge de la piste et les sponsors s'écartent de l'orange", () => {
    expect(ecartCouleurs(LIVREE.orange, ROUGE_PISTE)).toBeGreaterThan(12);
    for (const s of SPONSORS) for (const c of [s.fond, encreDe(s)]) expect(ecartCouleurs(LIVREE.orange, c), s.nom).toBeGreaterThan(12);
  });
});

describe("Stade et Nuit se distinguent d'un coup d'œil (chiffré)", () => {
  it("ciel, route et lumière du palier 1 : de vrais écarts de luminance", () => {
    const s = THEMES_C.stade;
    const n = THEMES_C.nuit;
    const route = (p: PaletteName) => paletteP1(p, PALETTE_DEFS[p]).road[0];
    // Ciel : l'horizon du Stade (c4e6ff, luminance 0,77) contre celui de la Nuit (10193e, 0,01) ; le zénith aussi.
    expect(lum(s.ciel[2]) - lum(n.ciel[2])).toBeGreaterThan(0.7);
    expect(lum(s.ciel[0]) / Math.max(lum(n.ciel[0]), 1e-4)).toBeGreaterThan(50);
    // Route : un gris (47464c) contre un bleu nuit (1d2030) : contraste de luminance 1,73 (et sous la lumière de chaque thème, bien plus).
    expect(contraste(route("stade"), route("nuit"))).toBeGreaterThan(1.6);
    // Lumière : soleil de midi contre lune (intensité ×9), ciel (hémisphère ×4).
    expect(s.soleil[1] / n.soleil[1]).toBeGreaterThan(9);
    expect(s.hemi[2] / n.hemi[2]).toBeGreaterThan(4);
    expect(n.lampes).toBeDefined();
    expect(s.lampes).toBeUndefined();
  });
});

describe("panneaux de distance avant les virages serrés", () => {
  const piste = parseTrack("distance", "S/n@start S S S S L S S S R3 S S S@finish");
  const panneaux = signsFor(piste);

  it("3, 2 puis 1 barres, tous les PAS_DISTANCE m en remontant depuis le panneau du virage, du même côté, sur des blocs droits fermés", () => {
    const d = distanceSigns(piste, panneaux);
    const serre = panneaux.find((s) => s.severity === 3)!;
    const avant = d.filter((x) => x.hazard === serre.hazard);
    expect(avant.map((x) => x.barres)).toEqual([1, 2, 3]);
    for (const x of avant) {
      expect(x.side).toBe(serre.side);
      const b = piste.blocks[x.block]!;
      expect(b.kind).toBe("straight");
      expect(b.mark).toBeUndefined();
      // Distance le long de la piste (blocs droits de CELL m) jusqu'au panneau du virage.
      const ecart = (serre.block - x.block) * CELL + serre.q - x.q;
      expect(ecart).toBeCloseTo(PAS_DISTANCE * x.barres, 6);
    }
  });

  it("aucun avant un virage large ou ample, ni au départ ; calculés sans le générateur", () => {
    const larges = parseTrack("larges", "S/n@start S S S S L3 S S S S@finish");
    expect(distanceSigns(larges)).toEqual([]);
    for (const x of distanceSigns(piste)) expect(piste.blocks[x.block]!.mark).not.toBe("start");
  });

  it("dans le jeu : posés au palier 1, comptés", () => {
    const g = geometrieP1(piste, "stade", { headless: true });
    expect(g.distances).toBe(distanceSigns(piste).length);
    expect(g.distances).toBeGreaterThan(0);
  });
});

describe("sponsors fictifs", () => {
  it("6 à 10 noms inventés, distincts, chacun sa case de l'atlas ; chaque thème les pose dans son ordre", () => {
    expect(SPONSORS.length).toBeGreaterThanOrEqual(6);
    expect(SPONSORS.length).toBeLessThanOrEqual(10);
    expect(new Set(SPONSORS.map((s) => s.nom)).size).toBe(SPONSORS.length);
    const rects = SPONSORS.map((_, i) => rectSponsor(i).join(","));
    expect(new Set(rects).size).toBe(SPONSORS.length);
    for (const p of Object.keys(PALETTE_DEFS) as PaletteName[]) expect([...sponsorsDuTheme(p)].sort()).toEqual(SPONSORS.map((_, i) => i));
  });

  it("discrets : moins contrastés que les panneaux de course, et plus petits", () => {
    // Le panneau de virage le moins contrasté (orange et encre) contre le sponsor le plus contrasté.
    const panneau = Math.min(contraste(0xffc61a, MARQUE.encre), contraste(0xff8a1a, MARQUE.encre), contraste(ROUGE_PISTE, MARQUE.papier));
    const panneauCuve = contraste(0x1f6fd0, MARQUE.papier);
    for (const s of SPONSORS) expect(contraste(s.fond, encreDe(s)), s.nom).toBeLessThan(Math.min(panneau, panneauCuve));
    // Les affiches du palier 1 : 0,5 m de haut au plus (la plaque d'un panneau de virage en fait 1,7).
    const track = parseTrack("sponsors", "S/n@start S S L2 S S@finish");
    const g = geometrieP1(track, "stade", { headless: true });
    const pos = g.calques.affiches.pos;
    expect(pos.length).toBeGreaterThan(0);
    for (let i = 0; i < pos.length; i += 18) {
      const ys = [pos[i + 1]!, pos[i + 4]!, pos[i + 7]!, pos[i + 10]!, pos[i + 13]!, pos[i + 16]!];
      expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(0.81);
    }
  });
});

describe("rebords du palier 1 : le profil du thème, léger", () => {
  const t: TronconRebord = { a: [0, 0, 0], b: [0, 0, 32], dehors: [1, 0], cote: "left", s: 0, longueur: 32, couleurs: [0x1e1b19, 0xf4f1e6], bande: false, hauteur: 1.4 };
  it("au plus 2 triangles par mètre (le lot 38 en dessinait jusqu'à 14), sauf la congère de la Banquise, qui garde le béton au palier 1", () => {
    for (const sorte of ["beton", "pneus", "bois", "roche", "glissiere"] as RebordB[]) {
      const g = new Builder();
      rebordB("stade", sorte, { leger: true })(g, t, new Builder());
      expect(g.pos.length / 9 / 32, sorte).toBeLessThanOrEqual(2);
      expect(g.pos.length, sorte).toBeGreaterThan(0);
    }
    expect(REBORDS_B.neige).toBe("neige");
  });

  it("la Ville garde son muret bas et son garde-corps jusqu'à la hauteur de la simulation (lot 37, porté dans la route du palier 1)", () => {
    const g = new Builder();
    gardeCorps(g, { ...t, hauteur: 0.8 });
    const ys = g.pos.filter((_, i) => i % 3 === 1);
    expect(Math.max(...ys)).toBeCloseTo(WALL_HEIGHT, 6);
    expect(Math.min(...ys)).toBeCloseTo(0.8, 6);
    const ville = parseTrack("ville", "S/n@start S S S@finish");
    const pal = paletteP1("ville", PALETTE_DEFS.ville);
    expect(pal.wallHeight).toBe(0.8);
    expect(pal.barrier).toBe("garde-corps");
    const route = geometrieP1(ville, "ville", { headless: true }).calques.route;
    const haut = Math.max(...route.pos.filter((_, i) => i % 3 === 1));
    expect(haut - ville.blocks[1]!.y0).toBeCloseTo(WALL_HEIGHT, 1);
    expect(routeP("ville").rebord).toBeTypeOf("function");
  });
});

describe("?palier=existant : recette et aperçus seulement", () => {
  it("l'ancienne scène se demande par l'adresse hors production ; jamais en production ; tout autre palier est ignoré", () => {
    expect(palierDemande("?palier=existant", false)).toBe("existant");
    expect(palierDemande("?palier=existant", true)).toBeNull();
    expect(palierDemande("?palier=P2", false)).toBeNull();
    expect(palierDemande("", false)).toBeNull();
  });
});
