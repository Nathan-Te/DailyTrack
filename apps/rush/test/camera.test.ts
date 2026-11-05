import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { CAMERA_DEFAUT, CameraRush, decalageDevant, facteurDeCadrage } from "../src/camera";
import { directionDeVisee, pointSurLeSol } from "../src/visee";

// La caméra et la visée au sol, sans navigateur : de la géométrie.
describe("la caméra basse", () => {
  const ASPECT = 844 / 390;
  const poser = (cx: number, cz: number, golem: { x: number; z: number } | null, garder: Parameters<CameraRush["but"]>[5] = []) => {
    const r = new CameraRush();
    r.maj(0.016, CAMERA_DEFAUT, ASPECT, cx, cz, golem, garder);
    return r.camera;
  };
  const ndc = (c: PerspectiveCamera, x: number, y: number, z: number): [number, number] => {
    const p = new Vector3(x, y, z).project(c);
    return [p.x, p.y];
  };
  it("regarde le sol sous 40° avec un champ de 35°, par défaut", () => {
    expect(CAMERA_DEFAUT).toEqual({ angle: 40, distance: 14, champ: 35 });
    const c = poser(0, 5, null);
    const dir = new Vector3();
    c.getWorldDirection(dir);
    expect(Math.round((Math.asin(-dir.y) * 180) / Math.PI)).toBe(40);
    expect(c.fov).toBe(35);
  });
  it("cadre le chevalier dans le tiers inférieur de l'écran", () => {
    for (const [cx, cz] of [[0, 5], [-6, 2], [4, -3]] as const) {
      const c = poser(cx, cz, null);
      const [, y] = ndc(c, cx, 0.9, cz);
      expect(y).toBeLessThan(-0.2); // sous le milieu
      expect(y).toBeGreaterThan(-0.75); // et bien dans l'image
    }
  });
  it("le décalage devant le chevalier croît avec la distance", () => {
    expect(decalageDevant(40, 35, 14)).toBeGreaterThan(1.5);
    expect(decalageDevant(40, 35, 20)).toBeGreaterThan(decalageDevant(40, 35, 14));
  });
  it("garde le golem entier (jusqu'au sommet de sa tête), son cercle et le chevalier dans l'image quand ils sont à moins de 7 m ; plus loin, au moins le chevalier et le pied du golem", () => {
    const golem = { x: 0, z: -3 };
    const garder = [{ x: 0, z: -3, haut: 5.1, r: 3 }, { x: 1, z: -2, r: 2.5 }];
    for (const [cx, cz] of [[0, 3], [0, -1], [3, 2], [-5, 5], [6, 8], [-8, 0]] as const) {
      const proche = Math.hypot(cx - golem.x, cz - golem.z) <= 7;
      const r = new CameraRush();
      r.maj(0.016, CAMERA_DEFAUT, ASPECT, cx, cz, golem, garder);
      const c = r.camera;
      const points: [number, number, number][] = [[cx, 1.9, cz], [cx, 0, cz + 0.5], [0, 0, -3 + 3], [3, 0, -3], [-3, 0, -3]];
      if (proche) points.push([0, 5.1, -3], [0, 0, -0.8]);
      for (const [x, y, z] of points) {
        const [sx, sy] = ndc(c, x, y, z);
        expect(Math.abs(sx)).toBeLessThanOrEqual(1);
        expect(sy).toBeLessThanOrEqual(1.02); // le recul est plafonné (×1,5) : au pire la tête touche le bord
        expect(sy).toBeGreaterThanOrEqual(-0.78);
      }
    }
  });
  it("le chevalier reste dans le tiers inférieur quand le golem tient au-dessus de lui", () => {
    const golem = { x: 0, z: -3 };
    const c = poser(0, 1, golem, [{ x: 0, z: -3, haut: 5.8, r: 2.2 }]);
    const [, y] = ndc(c, 0, 0.9, 1);
    expect(y).toBeLessThan(-0.1);
  });
  it("ne recule pas quand tout tient déjà, et jamais de plus de 50 %", () => {
    const r = new CameraRush();
    const sans = r.but(CAMERA_DEFAUT, ASPECT, 0, 0, null, []);
    expect(sans.distance).toBeCloseTo(14, 5);
    const loin = r.but(CAMERA_DEFAUT, ASPECT, 0, 9, { x: 0, z: -9 }, [{ x: 0, z: -9, haut: 5.8, r: 2.2 }]);
    expect(loin.distance).toBeGreaterThan(14);
    expect(loin.distance).toBeLessThanOrEqual(14 * 1.5 + 1e-9);
  });
  it("un écran étroit (portrait) s'éloigne pour garder 11 m de sol dans la largeur", () => {
    const r = new CameraRush();
    expect(r.but(CAMERA_DEFAUT, 0.5, 0, 0, null, []).distance).toBeGreaterThan(30);
  });
  it("facteurDeCadrage vaut 1 quand tout tient", () => {
    const c = new PerspectiveCamera(35, ASPECT);
    c.position.set(0, 9, 11);
    c.lookAt(0, 0, 0);
    c.updateMatrixWorld(true);
    expect(facteurDeCadrage(c, [{ x: 0, z: 0 }])).toBe(1);
    expect(facteurDeCadrage(c, [{ x: -1, z: 0 }, { x: 1, z: 0 }])).toBe(1);
    expect(facteurDeCadrage(c, [{ x: -40, z: 0 }, { x: 40, z: 0 }])).toBeGreaterThan(1);
  });
  it("suit avec un amorti : une image ne suffit pas à rattraper un saut du chevalier", () => {
    const r = new CameraRush();
    r.maj(0.016, CAMERA_DEFAUT, ASPECT, 0, 0, null, []);
    const x0 = r.camera.position.x;
    r.maj(0.016, CAMERA_DEFAUT, ASPECT, 8, 0, null, []);
    expect(r.camera.position.x).toBeGreaterThan(x0);
    expect(r.camera.position.x).toBeLessThan(8);
  });
});

describe("la visée au sol", () => {
  const camera = new PerspectiveCamera(35, 2);
  camera.position.set(0, 9, 11);
  camera.lookAt(0, 0, 0);
  it("le centre de l'écran vise le point regardé ; la droite de l'écran est +x, le haut de l'écran est −z", () => {
    const c = pointSurLeSol(camera, 0, 0)!;
    expect([Math.round(c.x * 100) / 100, Math.round(c.z * 100) / 100]).toEqual([0, 0]);
    expect(pointSurLeSol(camera, 0.5, 0)!.x).toBeGreaterThan(0.5);
    expect(pointSurLeSol(camera, 0, 0.5)!.z).toBeLessThan(-0.5);
    expect(pointSurLeSol(camera, 0, -0.5)!.z).toBeGreaterThan(0.5);
  });
  it("un rayon au-dessus de l'horizon ne touche pas le sol", () => {
    expect(pointSurLeSol(camera, 0, 3)).toBeNull();
  });
  it("les 32 directions : 0 vers +x, 8 vers le bas de l'écran (+z), 16 vers −x, 24 vers le haut", () => {
    expect([directionDeVisee(1, 0), directionDeVisee(0, 1), directionDeVisee(-1, 0), directionDeVisee(0, -1)]).toEqual([0, 8, 16, 24]);
    const vues = new Set<number>();
    for (let a = 0; a < 360; a += 2) vues.add(directionDeVisee(Math.cos((a * Math.PI) / 180), Math.sin((a * Math.PI) / 180)));
    expect(vues.size).toBe(32);
    expect(directionDeVisee(1, -0.01)).toBe(0);
  });
});
