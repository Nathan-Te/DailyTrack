import { readFileSync } from "node:fs";
import { PIECE_KINDS, THEMES_TOWER, type ThemeTower } from "@cdj/tower-sim";
import { describe, expect, it } from "vitest";
import { ALTITUDE_MAX, ALTITUDE_REGISTRE, couleursDuTheme, DEMI_LARGEUR_CIEL, type DecorTheme, decalageParallaxe, formeValide, genresA, PARALLAXE, semerCiel, yPlan } from "../src/decorLogique";
import { DecorScene } from "../src/decorScene";
import { PALETTE_PORT, type PaletteTheme } from "@cdj/visuels/blocs";
import { PALETTES } from "@cdj/visuels/blocs/themes";
import { basDeVue, BAS_MIN, VUE_COURTE } from "../src/scene";
import { valeurJeton } from "@cdj/ui";
import { ENCRE } from "@cdj/visuels/blocs";
import { clarte } from "./_couleurs";

// Lot T9 — les décors : trois plans qui défilent à des vitesses différentes (parallaxe verticale), le registre d'altitude (un fond jamais vide, même à 50 m), le contraste des pièces sur TOUS les plans
// de TOUS les thèmes, la neige et les vagues qui s'arrêtent avec `prefers-reduced-motion`, des décors qui ne sont jamais dans le premier chargement. Tout est de l'affichage : aucun de ces tests ne touche une partie.
const DECORS: Record<ThemeTower, DecorTheme> = {
  port: (await import("../src/decorPort")).DECOR,
  chantier: (await import("../src/decorChantier")).DECOR,
  canyon: (await import("../src/decorCanyon")).DECOR,
  banquise: (await import("../src/decorBanquise")).DECOR,
  jungle: (await import("../src/decorJungle")).DECOR,
  nuit: (await import("../src/decorNuit")).DECOR,
};
const PALETTES_TOUTES: Record<ThemeTower, PaletteTheme> = { port: PALETTE_PORT, ...PALETTES };
const src = (f: string): string => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");

describe("la parallaxe verticale : trois plans et le sol, à des vitesses différentes", () => {
  it("lointain 0,2 · moyen 0,5 · proche 0,8 · sol 1 : de plus en plus vite, le sol reste dans le monde", () => {
    expect([...PARALLAXE]).toEqual([0.2, 0.5, 0.8, 1]);
    expect(decalageParallaxe(1, 40, -2.75)).toBe(0);
  });

  it("quand la caméra monte de Δ, un plan de parallaxe k défile à l'écran de k × Δ (le sol de Δ, comme les pièces)", () => {
    const yRef = -2.75;
    for (const k of PARALLAXE) {
      const ecran = (yBas: number): number => 5 + decalageParallaxe(k, yBas, yRef) - yBas; // un point du plan à 5 m dans le monde, vu depuis le bas de la vue
      const delta = 12;
      expect(ecran(yRef + delta) - ecran(yRef), `k = ${k}`).toBeCloseTo(-k * delta, 9);
    }
  });

  it("au départ de la partie (le bas de la vue au repos) le décor est tel que la planche le montre : aucun décalage", () => {
    for (const k of PARALLAXE) expect(decalageParallaxe(k, BAS_MIN, BAS_MIN)).toBe(0);
  });

  it("un élément posé par yPlan est à la hauteur voulue de l'écran quand le bas de la vue est à l'altitude voulue", () => {
    for (const k of [0.2, 0.5, 0.8]) for (const a of [20, 55, 120]) {
      const yRef = -2.75;
      expect(yPlan(k, a, yRef, 9.75) + decalageParallaxe(k, a, yRef) - a, `k = ${k}, a = ${a}`).toBeCloseTo(9.75, 9);
    }
  });

  it("DecorScene : chaque plan est décalé de (1 − k) × (montée de la caméra)", () => {
    const d = new DecorScene(DECORS.port, "port", BAS_MIN);
    d.maj(BAS_MIN + 30, BAS_MIN, 0, false);
    const plans = (d as unknown as { plans: { position: { y: number } }[] }).plans;
    expect(plans.map((p) => Number(p.position.y.toFixed(6)))).toEqual(PARALLAXE.map((k) => Number(((1 - k) * 30).toFixed(6))));
    d.dispose();
  });
});

describe("le registre d'altitude : le fond n'est jamais vide", () => {
  it("les zones se suivent sans trou, le décor change à 15 m, jusqu'au bout du ciel semé, et changent de genres avec l'altitude", () => {
    for (const th of THEMES_TOWER) {
      const z = DECORS[th].zones;
      expect(z[0]!.de, th).toBe(0);
      expect(z[1]!.de, `${th} : au-dessus de ${ALTITUDE_REGISTRE} m le décor change`).toBe(ALTITUDE_REGISTRE);
      for (let i = 1; i < z.length; i++) expect(z[i]!.de, th).toBe(z[i - 1]!.a);
      expect(z[z.length - 1]!.a, th).toBeGreaterThan(ALTITUDE_MAX);
      expect(genresA(z, 20).join(), `${th} : le bas du registre et le haut ne sont pas faits des mêmes genres`).not.toBe(genresA(z, 120).join());
      expect(genresA(z, 5).join(), `${th} : sous ${ALTITUDE_REGISTRE} m, seulement des nuages hauts`).toBe("nuageHaut");
    }
  });

  it("le ciel est semé sans hasard de jeu : deux semis du même thème sont identiques, deux thèmes ne le sont pas", () => {
    for (const th of THEMES_TOWER) expect(semerCiel(th, DECORS[th].zones)).toEqual(semerCiel(th, DECORS[th].zones));
    expect(semerCiel("port", DECORS.port.zones)).not.toEqual(semerCiel("nuit", DECORS.port.zones));
    const logique = src("decorLogique.ts");
    expect(logique).not.toMatch(/Math\.random|Date\.now|performance\.now/);
    expect(logique).toMatch(/hasardAffichage/);
  });

  it("à toute hauteur de tour de 0 à 70 m, au moins 3 éléments du ciel semé sont à l'écran (paysage) — une tour de 50 m n'a jamais un fond vide", () => {
    for (const th of THEMES_TOWER) {
      const items = semerCiel(th, DECORS[th].zones);
      for (let h = 0; h <= 70; h += 1) {
        const yBas = basDeVue(h, VUE_COURTE);
        const visibles = items.filter((it) => {
          // Le décalage de la parallaxe est compris : à l'écran, l'élément est à k × (a − yBas) + 9,75 m du bas.
          const k = PARALLAXE[it.plan]!;
          const rel = k * (it.a - yBas) + 9.75;
          return rel >= 0 && rel <= VUE_COURTE && Math.abs(it.x) <= DEMI_LARGEUR_CIEL;
        });
        expect(visibles.length, `${th}, tour de ${h} m`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("tous les éléments du ciel sont dans la largeur semée et leurs hauteurs vont du pied de la tour jusqu'à 160 m", () => {
    for (const th of THEMES_TOWER) {
      const items = semerCiel(th, DECORS[th].zones);
      expect(Math.max(...items.map((i) => Math.abs(i.x))), th).toBeLessThanOrEqual(DEMI_LARGEUR_CIEL + 4);
      expect(Math.min(...items.map((i) => i.a)), th).toBeLessThan(6);
      expect(Math.max(...items.map((i) => i.a)), th).toBeGreaterThan(ALTITUDE_MAX - 12);
    }
  });
});

describe("chaque décor : des aplats bien formés, en nombre raisonnable", () => {
  it("toutes les formes sont valides, les couleurs unies (#RRGGBB), et chaque plan a de quoi dessiner", () => {
    for (const th of THEMES_TOWER) {
      const d = DECORS[th];
      expect(d.plans.length, th).toBe(4);
      const formes = [...d.plans.flatMap((p) => [...p.centre, ...p.repete]), ...d.anims.flatMap((a) => a.formes)];
      expect(formes.length, th).toBeGreaterThan(20);
      expect(formes.length, th).toBeLessThan(400);
      for (const f of formes) {
        expect(formeValide(f), `${th} : ${JSON.stringify(f)}`).toBe(true);
        expect(f.c, th).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
      expect(d.plans[0].repete.length + d.plans[0].centre.length, `${th} : le lointain`).toBeGreaterThan(3);
      expect(d.anims.length, `${th} : quelques animations lentes`).toBeGreaterThanOrEqual(2);
      expect(d.bandes.map((b) => b.de), `${th} : les bandes du ciel haut montent`).toEqual([...d.bandes.map((b) => b.de)].sort((a, b) => a - b));
    }
  });
});

describe("le contraste des pièces sur chaque plan de chaque thème", () => {
  /** Une surface de plus de 2 500 px² (≈ 6 m², plus qu'une pièce) est un fond : les petites choses (étoiles, fenêtres, traits) et les objets du ciel (une montgolfière, un avion, des oiseaux) ne le sont pas. */
  const AIRE_FOND = 2500;
  const objet = (plan: string): boolean => /montgolfiere|avion|oiseaux|perroquet|vautour|chauve/.test(plan);
  it("chaque pièce garde au moins 3 de différence de clarté (L*) avec chaque fond du lointain, du moyen, du proche, du sol, du ciel haut et du ciel semé", () => {
    for (const th of THEMES_TOWER) {
      const fonds = couleursDuTheme(DECORS[th]).filter((c) => c.aire >= AIRE_FOND && !objet(c.plan));
      expect(fonds.length, th).toBeGreaterThan(3);
      const palette = PALETTES_TOUTES[th];
      for (const kind of PIECE_KINDS) for (const [nom, fond] of [["ciel", palette.ciel], ["sol", palette.sol]] as const) {
        expect(Math.abs(clarte(palette.pieces[kind]) - clarte(fond)), `${th} : ${kind} sur le ${nom}`).toBeGreaterThanOrEqual(th === "port" ? 3 : 7);
      }
      for (const kind of PIECE_KINDS) for (const f of fonds) {
        const ecart = Math.abs(clarte(PALETTES_TOUTES[th].pieces[kind]) - clarte(f.c));
        expect(ecart, `${th} : la pièce ${kind} (${PALETTES_TOUTES[th].pieces[kind]}) sur ${f.c} (${f.plan})`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("le mouvement réduit coupe les animations du décor", () => {
  it("avec prefers-reduced-motion rien ne bouge : le décor est à sa place de repos à tout instant ; sans, il bouge", () => {
    for (const th of THEMES_TOWER) {
      const d = new DecorScene(DECORS[th], th, BAS_MIN);
      const groupes = (d as unknown as { anims: { groupe: { position: { x: number; y: number }; visible: boolean } }[] }).anims.map((a) => a.groupe);
      const etat = (t: number, reduit: boolean): string => {
        d.maj(BAS_MIN, BAS_MIN, t, reduit);
        return JSON.stringify(groupes.map((g) => [g.position.x, g.position.y, g.visible]));
      };
      expect(etat(1.7, true), th).toBe(etat(0, true));
      expect(etat(23.9, true), th).toBe(etat(0, true));
      expect(etat(1.7, false), th).not.toBe(etat(0, true));
      d.dispose();
    }
  });
});

describe("les décors sortent du premier chargement", () => {
  it("les modules à la demande n'importent pas la palette (cela la sortirait du premier chargement) ; leur encre est celle de la charte", () => {
    expect(ENCRE).toBe(valeurJeton("dj-encre"));
    for (const f of ["decorScene.ts", "habits.ts", "taquetFx.ts", "polygones.ts", "decorLogique.ts"]) expect(src(f), f).not.toMatch(/from "\.\/palette"/);
  });

  it("la palette n'a plus de décor ; le jeu ne les importe que par import() ; aucun module de décor n'est importé statiquement", () => {
    for (const th of THEMES_TOWER) expect(Object.keys(PALETTES_TOUTES[th]).sort(), th).toEqual(["ciel", "pieces", "pilier", "plateforme", "plateformeReflet", "sol", "vague"]);
    for (const f of ["main.ts", "accueil.ts", "jeu.ts", "scene.ts", "palette.ts", "preparation.ts"]) {
      expect(src(f), f).not.toMatch(/^import (?!type )[^\n]*from "\.\/decor(Scene|Logique|Port|Chantier|Canyon|Banquise|Jungle|Nuit)"/m);
    }
    const decors = src("decors.ts");
    for (const th of ["Port", "Chantier", "Canyon", "Banquise", "Jungle", "Nuit"]) expect(decors).toMatch(new RegExp(`import\\("\\./decor${th}"\\)`));
    expect(decors).toMatch(/import\("\.\/decorScene"\)/);
  });
});
