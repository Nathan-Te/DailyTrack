import { describe, expect, it } from "vitest";
import { MeshPhongMaterial, type Mesh } from "three";
import { HAUTEUR, LARGEUR, PLANS, RAYON, THEMES_PINBALL, Partie, dailyPinball } from "@cdj/pinball-sim";
import { ECHELLE_HAUTEUR, creerRails3d, hauteurBille, hauteurVue } from "../src/rails3d";

// Lot PBG1 : les rails en volume (`src/rails3d.ts`), construits sans navigateur. Ce que le test garde : trois maillages au plus pour toute la table (le coût de la 3D se mesure en appels de dessin), un nombre de triangles
// borné, des sommets finis et des normales unitaires, des rails qui restent sur la table et sous une hauteur raisonnable (ils ne passent pas devant les étiquettes), des matériaux Phong (jamais « Standard »), et la bille à la
// hauteur du rail.
const lire = (m: Mesh, nom: string): ArrayLike<number> => m.geometry.getAttribute(nom).array;

describe("les rails en volume (lot PBG1)", () => {
  for (const plan of PLANS) {
    for (const theme of THEMES_PINBALL) {
      it(`${plan.id}, ${theme} : au plus trois maillages, des triangles bornés, des sommets finis sur la table`, () => {
        const partie = new Partie(dailyPinball(20, undefined, theme, plan.id));
        const r = creerRails3d(theme, partie.table);
        const maillages = [r.opaque, r.translucide, r.rayonne].filter((m): m is Mesh => m !== null);
        expect(maillages.length).toBeGreaterThanOrEqual(2);
        expect(maillages.length).toBeLessThanOrEqual(3);
        expect(r.triangles).toBeGreaterThan(1500);
        expect(r.triangles).toBeLessThan(9000);
        let hMax = 0;
        for (const m of maillages) {
          const p = lire(m, "position");
          for (let i = 0; i < p.length; i += 3) {
            expect(Number.isFinite(p[i]! + p[i + 1]! + p[i + 2]!)).toBe(true);
            // sur la table, avec la marge du meuble
            expect(Math.abs(p[i]!)).toBeLessThan(LARGEUR / 2 + 10);
            expect(Math.abs(p[i + 2]!)).toBeLessThan(HAUTEUR / 2 + 10);
            hMax = Math.max(hMax, p[i + 1]!);
          }
          const n = lire(m, "normal");
          for (let i = 0; i < n.length; i += 3) expect(Math.hypot(n[i]!, n[i + 1]!, n[i + 2]!)).toBeCloseTo(1, 3);
          expect(lire(m, "color").length).toBe(p.length);
        }
        // le plus haut rail dessiné + son tube : jamais plus de 70 px au-dessus du plateau (au-delà, il passerait devant les étiquettes)
        expect(hMax).toBeLessThan(70);
        expect(r.opaque, "un rail opaque (supports, bords)").not.toBeNull();
        // le Phong, jamais le « Standard » (l'environnement échantillonné à chaque pixel coûte cher : lot PBV3)
        expect(r.opaque!.material).toBeInstanceOf(MeshPhongMaterial);
        if (r.translucide) expect(r.translucide.material).toBeInstanceOf(MeshPhongMaterial);
        for (const x of r.liberables) x.dispose();
      });
    }
  }

  it("la bille est au ras du plateau aux bouts d'un rail et à sa hauteur dessinée au milieu", () => {
    const partie = new Partie(dailyPinball(20, undefined, "foire", "doublette"));
    for (const rail of partie.table.rails) {
      expect(hauteurBille(rail, 0)).toBeCloseTo(RAYON, 6);
      expect(hauteurBille(rail, rail.len)).toBeCloseTo(RAYON, 6);
      const milieu = hauteurBille(rail, Math.round(rail.len / 2));
      expect(milieu).toBeCloseTo(RAYON + hauteurVue(rail.hauteur), 6);
      expect(hauteurVue(rail.hauteur)).toBeLessThan(rail.hauteur);
    }
    expect(ECHELLE_HAUTEUR).toBeGreaterThan(0.4);
    expect(ECHELLE_HAUTEUR).toBeLessThanOrEqual(1);
  });
});
