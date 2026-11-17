import { describe, expect, it } from "vitest";
import { MeshPhongMaterial, type Mesh } from "three";
import { HAUTEUR, LARGEUR, PLANS, RAYON, THEMES_PINBALL, Partie, dailyPinball } from "@cdj/pinball-sim";
import { UNITE } from "@cdj/pinball-sim";
import { empreinteDuModule } from "../src/dessin";
import { ECHELLE_HAUTEUR, creerRails3d, hauteurBille, hauteurVue } from "../src/rails3d";

// Lot PBG1 : les rails en volume (`src/rails3d.ts`), construits sans navigateur. Ce que le test garde : trois maillages au plus pour toute la table (le coût de la 3D se mesure en appels de dessin), un nombre de triangles
// borné, des sommets finis et des normales unitaires, des rails qui restent sur la table et sous une hauteur raisonnable (ils ne passent pas devant les étiquettes), des matériaux Phong (jamais « Standard »), et la bille à la
// hauteur du rail.
const lire = (m: Mesh, nom: string): ArrayLike<number> => m.geometry.getAttribute(nom).array;
/** La part de l'empreinte d'un module que les parties opaques d'un rail peuvent recouvrir (vues de la caméra par défaut). */
const COUVERTURE_MAX = 0.25;

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

  // LOT PBL1 : « les rails ne cachent plus la table — ce qui est sous un rail reste visible ».
  /** Combien du plateau les parties opaques des rails recouvrent, vues de la caméra par défaut (66° : un point à la hauteur h cache le sol à h / tan 66° ≈ 0,445 h plus haut sur la table), par module de la table : la part de son empreinte. */
  function couvertureOpaque(table: Partie["table"], theme: (typeof THEMES_PINBALL)[number]): { type: string; x: number; y: number; part: number }[] {
    const r = creerRails3d(theme, table);
    const grille = new Uint8Array(LARGEUR * HAUTEUR);
    if (r.opaque) {
      const pos = lire(r.opaque, "position");
      const idx = r.opaque.geometry.getIndex()!.array;
      const px = (i: number): number => pos[i * 3]! + LARGEUR / 2;
      const py = (i: number): number => pos[i * 3 + 2]! + HAUTEUR / 2 - pos[i * 3 + 1]! * 0.445;
      for (let t = 0; t < idx.length; t += 3) {
        const [a, b, c] = [idx[t]!, idx[t + 1]!, idx[t + 2]!];
        const x0 = Math.max(0, Math.floor(Math.min(px(a), px(b), px(c))));
        const x1 = Math.min(LARGEUR - 1, Math.ceil(Math.max(px(a), px(b), px(c))));
        const y0 = Math.max(0, Math.floor(Math.min(py(a), py(b), py(c))));
        const y1 = Math.min(HAUTEUR - 1, Math.ceil(Math.max(py(a), py(b), py(c))));
        const d = (px(b) - px(a)) * (py(c) - py(a)) - (px(c) - px(a)) * (py(b) - py(a));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            // un pixel est couvert si son centre est dans le triangle, ou si le triangle (très fin : un fût, un filet) passe dans le pixel
            const cx = x + 0.5;
            const cy = y + 0.5;
            if (Math.abs(d) < 1e-9) continue;
            const u = ((cx - px(a)) * (py(c) - py(a)) - (px(c) - px(a)) * (cy - py(a))) / d;
            const v = ((px(b) - px(a)) * (cy - py(a)) - (cx - px(a)) * (py(b) - py(a))) / d;
            if (u >= 0 && v >= 0 && u + v <= 1) grille[y * LARGEUR + x] = 1;
          }
        }
      }
    }
    const sortie = table.poses.map((m) => {
      const mx = m.x / UNITE;
      const my = m.y / UNITE;
      const rr = empreinteDuModule(m.type);
      let tous = 0;
      let couverts = 0;
      for (let y = Math.floor(my - rr); y <= Math.ceil(my + rr); y++) {
        for (let x = Math.floor(mx - rr); x <= Math.ceil(mx + rr); x++) {
          if ((x + 0.5 - mx) ** 2 + (y + 0.5 - my) ** 2 > rr * rr || x < 0 || y < 0 || x >= LARGEUR || y >= HAUTEUR) continue;
          tous++;
          couverts += grille[y * LARGEUR + x]!;
        }
      }
      return { type: m.type, x: mx, y: my, part: tous ? couverts / tous : 0 };
    });
    for (const x of r.liberables) x.dispose();
    return sortie;
  }

  for (const plan of PLANS) {
    for (const theme of THEMES_PINBALL) {
      it(`${plan.id}, ${theme} : un module sous un rail reste visible — les parties opaques n'en recouvrent jamais plus de ${Math.round(COUVERTURE_MAX * 100)} %, et le fond est translucide`, () => {
        const partie = new Partie(dailyPinball(20, undefined, theme, plan.id));
        for (const m of couvertureOpaque(partie.table, theme)) expect(m.part, `${m.type} (${m.x.toFixed(0)}, ${m.y.toFixed(0)})`).toBeLessThanOrEqual(COUVERTURE_MAX);
        const r = creerRails3d(theme, partie.table);
        // le fond du rail (ou du tube) est translucide : un tiers d'opacité au plus ; Volcan : aucune lueur (pas de maillage qui rayonne)
        expect(r.translucide, "un fond translucide").not.toBeNull();
        expect(((r.translucide!.material as MeshPhongMaterial).opacity), "opacité du fond").toBeLessThanOrEqual(0.34);
        if (theme === "volcan") expect(r.rayonne, "pas de lueur sur les rails du Volcan").toBeNull();
        for (const x of r.liberables) x.dispose();
      });
    }
  }
});
