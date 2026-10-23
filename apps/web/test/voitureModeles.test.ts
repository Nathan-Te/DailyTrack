import { describe, expect, it } from "vitest";
import { Box3, Euler, Mesh, Quaternion, Raycaster, Vector3, type Object3D } from "three";
import { AXLE_FRONT, AXLE_REAR, HALF_TRACK, THEME_NAMES, THEMES } from "@cdj/sim";
import { HOOD_CLEARANCE, HOOD_MAX_TILT, HOOD_MOUNT } from "../src/cameras";
import { WHEEL_RADIUS } from "../src/carMesh";
import { ROUGE_PISTE, paletteP1, vibreursP1 } from "../src/scene/palier1";
import { PALETTE_DEFS } from "../src/trackMesh";
import { LIVREE, PALETTE, ecartCouleurs, livreeDe, luminance } from "../src/voiture/livree";
import { MATERIAUX_2 } from "../src/voiture/materiaux2";
import { construireFantome, construireVoiture, type PlanVoiture } from "../src/voiture/modele";
import { PLAN_A } from "../src/voiture/modeleA";
import { PLAN_B } from "../src/voiture/modeleB";
import { PLAN_C } from "../src/voiture/modeleC";
import { PLAN_CIVILE } from "../src/voiture/modeleCivile";

// Lot 40, partie 2 : les trois modèles proposés (vitrine) tiennent le cahier des charges du README 38b § 6 — six maillages au plus, ≈ 2 000
// triangles au palier 1 et 4 000 à 6 000 aux paliers 2 et 3, un fantôme simple d'un maillage (≈ 400 triangles), les roues aux points de
// contact de la simulation, rien hors de la silhouette (le centre de l'écran reste à la voiture), la vue capot dégagée ; la palette se détache
// de chaque élément de piste.

const PLANS: PlanVoiture[] = [PLAN_CIVILE, PLAN_A, PLAN_B, PLAN_C];
const maillages = (o: Object3D): Mesh[] => {
  const out: Mesh[] = [];
  o.traverse((x) => {
    if ((x as Mesh).isMesh) out.push(x as Mesh);
  });
  return out;
};

describe("les trois modèles (lot 40)", () => {
  for (const plan of PLANS) {
    describe(plan.nom, () => {
      const p1 = construireVoiture(plan, { palier: 1, couleur: LIVREE.orange, numero: "8" });
      const p2 = construireVoiture(plan, { palier: 2, couleur: LIVREE.orange, numero: "8", materiaux: MATERIAUX_2 });

      it("six maillages au plus ; ≤ 4 000 triangles au palier 1, ≤ 12 000 aux paliers 2 et 3 (plafonds relevés du lot 40c)", () => {
        for (const v of [p1, p2]) expect(maillages(v.group).length).toBeLessThanOrEqual(6);
        expect(p1.triangles).toBeGreaterThan(1500);
        expect(p1.triangles).toBeLessThanOrEqual(4000);
        expect(p2.triangles).toBeGreaterThan(p1.triangles);
        expect(p2.triangles).toBeLessThanOrEqual(12000);
      });

      it("le fantôme : un maillage, ≈ 400 triangles, translucide", () => {
        const f = construireFantome(plan, 0xff4fa3);
        const m = maillages(f.group);
        expect(m).toHaveLength(1);
        expect(f.triangles).toBeGreaterThan(300);
        expect(f.triangles).toBeLessThan(460);
        expect((m[0]!.material as { transparent: boolean }).transparent).toBe(true);
      });

      it("les roues sont aux points de contact de la simulation, braquent à l'avant et suivent le débattement", () => {
        const roues = maillages(p2.group).slice(2);
        expect(roues.map((r) => [r.position.x, r.position.y, r.position.z])).toEqual([
          [HALF_TRACK, WHEEL_RADIUS, AXLE_FRONT],
          [-HALF_TRACK, WHEEL_RADIUS, AXLE_FRONT],
          [HALF_TRACK, WHEEL_RADIUS, -AXLE_REAR],
          [-HALF_TRACK, WHEEL_RADIUS, -AXLE_REAR],
        ]);
        p2.update({ forward: 20, steerAngle: 0.25, braking: true, droop: [0.05, 0, 0, 0], dt: 1 / 60 });
        expect(roues.map((r) => r.rotation.y)).toEqual([0.25, 0.25, 0, 0]);
        expect(roues[0]!.position.y).toBeCloseTo(WHEEL_RADIUS - 0.05);
      });

      // Longueur : la GT et le proto sont plus longs que la voiture d'aujourd'hui (4,6 et 4,7 m contre 4,3 m) ; la boîte de la simulation ne change pas.
      it("rien ne déborde de la silhouette : |x| ≤ 1,06 m, longueur ≤ 4,75 m, hauteur ≤ 1,4 m", () => {
        const v = construireVoiture(plan, { palier: 2, couleur: LIVREE.orange, numero: "8", materiaux: MATERIAUX_2 });
        v.group.updateMatrixWorld(true);
        const b = new Box3().setFromObject(v.group, true);
        expect(Math.max(-b.min.x, b.max.x)).toBeLessThanOrEqual(1.06);
        expect(b.max.z - b.min.z).toBeLessThanOrEqual(4.75);
        expect(b.max.y).toBeLessThanOrEqual(1.4);
        expect(b.min.y).toBeGreaterThanOrEqual(0);
      });

      it("vue capot : rien à moins de HOOD_CLEARANCE dans le champ de vision, le regard incliné au maximum", () => {
        p2.group.updateMatrixWorld(true);
        const m = maillages(p2.group);
        const eye = new Vector3(HOOD_MOUNT.x, HOOD_MOUNT.y, HOOD_MOUNT.z);
        const avant = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI);
        const tanV = Math.tan((108 * Math.PI) / 360);
        for (const tilt of [new Euler(0, 0, 0), new Euler(-HOOD_MAX_TILT, 0, 0, "YXZ"), new Euler(HOOD_MAX_TILT, 0, 0, "YXZ"), new Euler(0, 0, HOOD_MAX_TILT, "YXZ"), new Euler(0, HOOD_MAX_TILT, 0, "YXZ")]) {
          const vue = avant.clone().multiply(new Quaternion().setFromEuler(tilt));
          const axe = new Vector3(0, 0, -1).applyQuaternion(vue);
          let proche = Infinity;
          for (let iy = -4; iy <= 4; iy++) {
            for (let ix = -6; ix <= 6; ix++) {
              const dir = new Vector3((ix / 6) * tanV * 2.4, (iy / 4) * tanV, -1).normalize().applyQuaternion(vue);
              const hit = new Raycaster(eye, dir, 0, 3).intersectObjects(m, false)[0];
              if (hit) proche = Math.min(proche, hit.distance * dir.dot(axe));
            }
          }
          expect(proche).toBeGreaterThanOrEqual(HOOD_CLEARANCE);
        }
        // Le capot est sous l'œil (on le voit en bas de l'écran), pas autour.
        const bas = new Raycaster(eye, new Vector3(0, -1, 0), 0, 5).intersectObjects(m, false)[0];
        expect(bas?.distance).toBeGreaterThanOrEqual(0.25);
      });

      it("les feux stop s'allument au freinage", () => {
        const v = construireVoiture(plan, { palier: 1, couleur: LIVREE.orange, numero: "8" });
        const feux = maillages(v.group)[1]!;
        const c = feux.geometry.getAttribute("color");
        const dernier = c.count - 1;
        const avant = c.getX(dernier);
        v.update({ forward: 0, steerAngle: 0, braking: true, droop: [0, 0, 0, 0], dt: 1 / 60 });
        expect(c.getX(dernier)).toBeGreaterThan(avant * 3);
      });
    });
  }
});

describe("la palette de 8 couleurs (lot 40)", () => {
  it("8 couleurs distinctes, l'orange de Track d'abord (couleur par défaut)", () => {
    expect(PALETTE).toHaveLength(8);
    expect(PALETTE[0]!.hex).toBe(0xe8552d);
    expect(new Set(PALETTE.map((c) => c.hex)).size).toBe(8);
    for (const a of PALETTE) for (const b of PALETTE) if (a !== b) expect(ecartCouleurs(a.hex, b.hex)).toBeGreaterThan(10);
  });

  it("chaque couleur se détache des éléments de piste de chaque thème (route, rebords, vibreurs, plaques, portes, sol : ΔE 2000 > 12)", () => {
    // Lot 43 : la scène est le palier 1, dont l'orange est retiré (`palier1.ts`) : l'orange de Track n'a plus d'exception — les vibreurs orange du Rallye
    // et rouge-orangé de la Campagne, le rouge vif des vibreurs et du super turbo (ΔE 11) sont passés au cramoisi de la piste.
    for (const theme of THEME_NAMES) {
      const pal = THEMES[theme].palette;
      const p = paletteP1(pal, PALETTE_DEFS[pal]);
      const elements = [...p.road, p.wallA, p.wallB, ...p.fence, ...vibreursP1(pal), p.boost, ROUGE_PISTE, p.checkpoint, Number.parseInt(p.floorA.slice(1), 16)];
      for (const c of PALETTE) for (const e of elements) expect(ecartCouleurs(c.hex, e), `${c.nom} / ${theme} ${e.toString(16)}`).toBeGreaterThan(12);
    }
  });

  it("assez claires pour la Nuit (luminance ≥ 0,08) ; les bandes et le numéro s'adaptent à la clarté de la caisse", () => {
    for (const c of PALETTE) expect(luminance(c.hex), c.nom).toBeGreaterThanOrEqual(0.08);
    expect(livreeDe(LIVREE.orange).bandes).toEqual([LIVREE.creme, LIVREE.asphalte]);
    expect(livreeDe(0xc9a0dc).bandes).toEqual([LIVREE.asphalte]);
    expect(livreeDe(0x1e3a2c).bandes).toEqual([LIVREE.creme]);
    for (const c of PALETTE) {
      const l = livreeDe(c.hex);
      expect(ecartCouleurs(l.plaque, l.chiffres)).toBeGreaterThan(40);
      for (const b of l.bandes) expect(ecartCouleurs(b, c.hex), c.nom).toBeGreaterThan(15);
    }
  });
});
