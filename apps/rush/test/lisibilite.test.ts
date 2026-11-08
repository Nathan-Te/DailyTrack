import { describe, expect, it } from "vitest";
import { BOSS_IDS } from "@cdj/rush-sim";
import { PIERRE, PIERRE_CLAIRE, PIERRE_POING, PIERRE_SOMBRE, PIERRE_TETE } from "../src/acteurs";
import { DOMINANTES_BOSS } from "../src/bosses";
import { ALPHAS_JOUEUR } from "../src/competencesVue";
import { ALPHAS_ANNONCE } from "../src/effets";
import { GELATON_COULEUR } from "../src/gelatons";
import { COULEURS, PALETTES } from "../src/palette";

// La LISIBILITÉ sur chaque thème (lot BR1) : le golem, les ennemis, le chevalier et les cercles d'annonce se détachent du sol de CHAQUE thème. Sans navigateur : l'écart de couleur CIELAB (ΔE76, un écart de 2,3 se voit à peine,
// au-delà de 25 la couleur est franchement autre) entre chaque ton de sol et la couleur de base de chaque personnage. Le cercle d'annonce est le corail mélangé à 55 % sur le sol (il est translucide).
const lin = (v: number): number => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
export function lab(hex: number): [number, number, number] {
  const r = lin((hex >> 16) & 255);
  const g = lin((hex >> 8) & 255);
  const b = lin(hex & 255);
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const ecart = (a: number, b: number): number => {
  const x = lab(a);
  const y = lab(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};
const melange = (a: number, b: number, t: number): number => {
  const c = (s: number): number => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
};
const plusPetit = (couleur: number, p: (typeof PALETTES)[string]): number => Math.min(ecart(couleur, p.sol), ecart(couleur, p.sol2));

describe("la lisibilité sur chaque thème (lot BR1)", () => {
  it("il y a trois thèmes", () => {
    expect(Object.keys(PALETTES).sort()).toEqual(["carriere", "prairie", "sousbois"]);
  });
  for (const [nom, p] of Object.entries(PALETTES)) {
    describe(nom, () => {
      it("le golem (ses pierres principales) se détache nettement du sol : écart ≥ 40", () => {
        for (const [pierre, c] of Object.entries({ PIERRE, PIERRE_SOMBRE, PIERRE_POING, PIERRE_CLAIRE, PIERRE_TETE })) expect(plusPetit(c.couleur, p), `${pierre} sur ${nom}`).toBeGreaterThanOrEqual(40);
      });
      it("la gelée et la chauve-souris se détachent du sol : écart ≥ 25", () => {
        expect(plusPetit(COULEURS.gelee, p), "gelée").toBeGreaterThanOrEqual(25);
        expect(plusPetit(COULEURS.chauve, p), "chauve-souris").toBeGreaterThanOrEqual(25);
      });
      it("l'armure du chevalier se détache du sol : écart ≥ 25", () => {
        expect(plusPetit(COULEURS.armure, p)).toBeGreaterThanOrEqual(25);
      });
      it("le cercle d'annonce (corail à 55 % sur le sol) se détache du sol : écart ≥ 25", () => {
        for (const sol of [p.sol, p.sol2]) expect(ecart(melange(sol, COULEURS.corail, 0.55), sol)).toBeGreaterThanOrEqual(25);
      });
      it("les murs bas se distinguent du sol (on ne les prend pas pour du chemin)", () => {
        expect(plusPetit(p.mur, p)).toBeGreaterThanOrEqual(25);
      });
    });
  }
});

// Lot BR3 : les CINQ boss et les nouvelles annonces (bande, spores, nuage, anneau d'invocation) sur chaque thème. Même mesure : l'écart de couleur CIELAB (ΔE76) contre les DEUX tons du sol ; une annonce translucide est mélangée au sol à sa transparence.
describe("la lisibilité des cinq boss et de leurs annonces sur chaque thème (lot BR3)", () => {
  it("il y a cinq boss, chacun avec ses couleurs dominantes", () => {
    expect(BOSS_IDS).toHaveLength(5);
    expect(DOMINANTES_BOSS).toHaveLength(5);
    for (const d of DOMINANTES_BOSS) expect(d.length).toBeGreaterThanOrEqual(1);
  });
  for (const [nom, p] of Object.entries(PALETTES)) {
    describe(nom, () => {
      it("chaque boss : sa couleur dominante (et ses autres grandes masses) tranche sur les deux tons du sol, écart ≥ 40 comme le golem", () => {
        BOSS_IDS.forEach((id, k) => DOMINANTES_BOSS[k]!.forEach((c, i) => expect(plusPetit(c, p), `${id} (couleur ${i}) sur ${nom}`).toBeGreaterThanOrEqual(40)));
      });
      const opaque = ALPHAS_ANNONCE.fond + ALPHAS_ANNONCE.rempli; // le disque rempli, juste avant l'impact
      const cercle = (sol: number): number => ecart(melange(sol, COULEURS.corail, opaque), sol);
      it("la bande d'annonce (corail, les transparences du cercle) tranche au moins autant que le cercle actuel, et le liseré aussi", () => {
        for (const sol of [p.sol, p.sol2]) {
          const bande = ecart(melange(sol, COULEURS.corail, opaque), sol); // la même couleur et les mêmes transparences que le cercle : le même écart
          expect(bande).toBeGreaterThanOrEqual(cercle(sol));
          expect(bande).toBeGreaterThanOrEqual(25);
          expect(ecart(melange(sol, COULEURS.corailClair, ALPHAS_ANNONCE.bord), sol), "liseré").toBeGreaterThanOrEqual(25);
        }
      });
      it("le nuage de spores (vert-jaune sombre, PAS corail) tranche sur le sol : le corps ≥ 30, son liseré ≥ 40 ; il n'est pas rouge", () => {
        for (const sol of [p.sol, p.sol2]) {
          expect(ecart(melange(sol, COULEURS.spores, 0.72), sol), "corps du nuage").toBeGreaterThanOrEqual(30);
          expect(ecart(melange(sol, COULEURS.sporesLisere, 0.92), sol), "liseré du nuage").toBeGreaterThanOrEqual(40);
        }
        const [, a] = lab(COULEURS.spores);
        expect(a, "le nuage est vert (a* < 0), jamais rouge").toBeLessThan(0);
      });
      it("l'anneau d'invocation (violet, PAS un danger) se lit sur le sol : liseré ≥ 40 ; il n'est pas dans la famille du corail", () => {
        for (const sol of [p.sol, p.sol2]) expect(ecart(melange(sol, COULEURS.invocationClair, ALPHAS_ANNONCE.bord), sol)).toBeGreaterThanOrEqual(40);
        expect(ecart(COULEURS.invocationClair, COULEURS.corail)).toBeGreaterThanOrEqual(40);
      });
    });
  }
});

// Lot BR5 : ce qui est au JOUEUR se lit sur chaque thème sans jamais ressembler à un danger — le cercle d'atterrissage du bond (cyan), les gélatons (bleus, distincts des gelées vertes), la recharge (violet), le cœur (rose). Même mesure : ΔE76 contre les deux tons du sol.
describe("la lisibilité des compétences et du butin sur chaque thème (lot BR5)", () => {
  const teinte = (c: number): number => {
    const [, a, b] = lab(c);
    return (Math.atan2(b, a) * 180) / Math.PI;
  };
  const ecartTeinte = (a: number, b: number): number => Math.abs(((teinte(a) - teinte(b) + 540) % 360) - 180);
  it("rien de ce qui est au joueur n'est de la famille du corail (le rouge reste réservé au danger)", () => {
    for (const [nom, c] of Object.entries({ joueur: COULEURS.joueur, joueurClair: COULEURS.joueurClair, recharge: COULEURS.recharge, lame: COULEURS.lame, bouclier: COULEURS.bouclier, gelaton: GELATON_COULEUR })) {
      expect(ecart(c, COULEURS.corail), nom).toBeGreaterThanOrEqual(40);
      expect(ecartTeinte(c, COULEURS.corail), `${nom} : la teinte s'écarte d'au moins 45° de celle du corail`).toBeGreaterThanOrEqual(45);
    }
    expect(ecart(COULEURS.joueurClair, COULEURS.corailClair)).toBeGreaterThanOrEqual(40);
  });
  for (const [nom, p] of Object.entries(PALETTES)) {
    describe(nom, () => {
      const opaque = ALPHAS_JOUEUR.fond + ALPHAS_JOUEUR.rempli;
      it("le cercle d'atterrissage du bond (cyan translucide, son liseré) tranche sur le sol : disque ≥ 25, liseré ≥ 25", () => {
        for (const sol of [p.sol, p.sol2]) {
          expect(ecart(melange(sol, COULEURS.joueur, opaque), sol), "disque").toBeGreaterThanOrEqual(25);
          expect(ecart(melange(sol, COULEURS.joueurClair, ALPHAS_JOUEUR.bord), sol), "liseré").toBeGreaterThanOrEqual(25);
        }
      });
      it("les gélatons (bleus) tranchent sur le sol (≥ 25) et ne se confondent pas avec les gelées (≥ 25)", () => {
        expect(plusPetit(GELATON_COULEUR, p), "gélaton").toBeGreaterThanOrEqual(25);
        expect(ecart(GELATON_COULEUR, COULEURS.gelee), "gélaton contre gelée").toBeGreaterThanOrEqual(25);
      });
      it("la recharge (violet) et le cœur (rose) tranchent sur le sol (≥ 25)", () => {
        expect(plusPetit(COULEURS.recharge, p), "recharge").toBeGreaterThanOrEqual(25);
        expect(plusPetit(COULEURS.coeur, p), "cœur").toBeGreaterThanOrEqual(25);
      });
    });
  }
});

// Lot BR6 : les quatre nouveaux ennemis (cracheur, chaman, totem, porte-bouclier), la couronne des élites et le projectile du cracheur tranchent sur les DEUX tons du sol de CHAQUE thème : écart ≥ 40 (ΔE76), comme le golem et les boss. Leurs annonces au sol
// (la ligne du cracheur, le cône du porte-bouclier) sont des BANDES et des SECTEURS du cercle d'annonce : la même couleur corail aux mêmes transparences (`ALPHAS_ANNONCE`), donc le même écart que le cercle (testé plus haut).
describe("la lisibilité des quatre nouveaux ennemis sur chaque thème (lot BR6)", () => {
  const DOMINANTES: Record<string, number[]> = {
    cracheur: [COULEURS.cracheur],
    chaman: [COULEURS.chaman, COULEURS.chamanSombre],
    totem: [COULEURS.totemBois, COULEURS.totemSarcelle],
    "porte-bouclier": [COULEURS.pbCorps, COULEURS.pbBouclier, COULEURS.pbBord],
    elite: [COULEURS.elite],
    projectile: [COULEURS.projectile],
  };
  for (const [nom, p] of Object.entries(PALETTES)) {
    describe(nom, () => {
      for (const [id, couleurs] of Object.entries(DOMINANTES)) {
        it(`${id} : écart ≥ 40 contre les deux tons du sol`, () => {
          couleurs.forEach((c, i) => expect(plusPetit(c, p), `${id} (couleur ${i}) sur ${nom}`).toBeGreaterThanOrEqual(40));
        });
      }
      it("les nouveaux ennemis ne sont pas rouges (le rouge est réservé au danger) : aucune dominante ne tire vers la teinte du corail", () => {
        const rouge = (c: number): boolean => {
          const r = (c >> 16) & 255;
          const g = (c >> 8) & 255;
          const b = c & 255;
          return r > 190 && g < 110 && b < 110;
        };
        for (const couleurs of Object.values(DOMINANTES)) for (const c of couleurs) expect(rouge(c)).toBe(false);
      });
    });
  }
});
