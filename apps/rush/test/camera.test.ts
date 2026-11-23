import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { CAMERA_DEFAUT, CameraRush, facteurDeCadrage } from "../src/camera";
import { directionDeVisee, pointSurLeSol } from "../src/visee";

// La caméra et la visée au sol, sans navigateur : de la géométrie.
describe("la caméra : le cadrage de la cible (lot BR-A3 ; haute et lointaine aux lots BR0c et BR1)", () => {
  const ASPECT = 1920 / 1080;
  const poser = (cx: number, cz: number, golem: { x: number; z: number } | null, garder: Parameters<CameraRush["but"]>[5] = [], aspect = ASPECT) => {
    const r = new CameraRush();
    r.maj(0.016, CAMERA_DEFAUT, aspect, cx, cz, golem, garder);
    return r.camera;
  };
  const ndc = (c: PerspectiveCamera, x: number, y: number, z: number): [number, number] => {
    const p = new Vector3(x, y, z).project(c);
    return [p.x, p.y];
  };
  it("regarde le sol sous 33° avec un champ de 35° depuis 19 m, par défaut (lot BR-A3 : le cadrage de la cible ; 41°, 25°, 34 m avant)", () => {
    expect(CAMERA_DEFAUT).toEqual({ angle: 33, distance: 19, champ: 35 });
    const c = poser(0, 5, null);
    const dir = new Vector3();
    c.getWorldDirection(dir);
    expect(Math.round((Math.asin(-dir.y) * 180) / Math.PI)).toBe(33);
    expect(c.fov).toBe(35);
  });
  it("le chevalier (1,5 m) fait 9 à 13 % de la hauteur de l'écran à 16:9 : la taille qu'il a sur la cible (~12 %)", () => {
    const c = poser(0, 0, null);
    const [, bas] = ndc(c, 0, 0, 0);
    const [, haut] = ndc(c, 0, 1.5, 0);
    const part = (haut - bas) / 2; // la hauteur de l'écran vaut 2 en coordonnées d'écran
    expect(part).toBeGreaterThan(0.09);
    expect(part).toBeLessThan(0.13);
  });
  it("depuis le centre à 16:9 : le muret du nord et ce qui est AU-DELÀ (le décor hors aire de jeu, à 17 m) sont dans l'image, l'arène d'est en ouest à 8 m aussi", () => {
    const c = poser(0, 0, null);
    for (const [x, y, z] of [[0, 0, -11.4], [0, 0, -17], [-8, 0, 0], [8, 0, 0], [0, 0, 6]] as const) {
      const [sx, sy] = ndc(c, x, y, z);
      expect(Math.abs(sx)).toBeLessThan(1);
      expect(Math.abs(sy)).toBeLessThan(1);
    }
  });
  it("suit le chevalier à moitié : l'arène reste cadrée, le chevalier se promène dans l'image", () => {
    for (const [cx, cz] of [[0, 5], [-6, 2], [4, -3], [0, -9], [9, 6]] as const) {
      const c = poser(cx, cz, null);
      const [sx, sy] = ndc(c, cx, 0.8, cz);
      expect(Math.abs(sx)).toBeLessThan(0.9);
      expect(Math.abs(sy)).toBeLessThan(0.9);
    }
  });
  it("garde le golem entier (jusqu'au sommet de sa tête), son cercle et le chevalier dans l'image", () => {
    const golem = { x: 0, z: -3 };
    const garder = [{ x: 0, z: -3, haut: 5.1, r: 3 }, { x: 1, z: -2, r: 2.5 }];
    for (const [cx, cz] of [[0, 3], [0, -1], [3, 2], [-5, 5], [6, 8], [-8, 0]] as const) {
      const r = new CameraRush();
      r.maj(0.016, CAMERA_DEFAUT, ASPECT, cx, cz, golem, garder);
      const c = r.camera;
      for (const [x, y, z] of [[cx, 1.5, cz], [cx, 0, cz + 0.5], [0, 5.1, -3], [3, 0, -3], [-3, 0, -3], [0, 0, 0]] as const) {
        const [sx, sy] = ndc(c, x, y, z);
        expect(Math.abs(sx)).toBeLessThanOrEqual(1);
        expect(sy).toBeLessThanOrEqual(1.02);
        expect(sy).toBeGreaterThanOrEqual(-0.9);
      }
    }
  });
  it("ne recule pas quand tout tient déjà, et jamais de plus de 25 %", () => {
    const r = new CameraRush();
    const sans = r.but(CAMERA_DEFAUT, ASPECT, 0, 0, null, []);
    expect(sans.distance).toBeCloseTo(CAMERA_DEFAUT.distance, 5);
    const loin = r.but(CAMERA_DEFAUT, ASPECT, 0, 9, { x: 0, z: -11 }, [{ x: 0, z: -11, haut: 6.5, r: 3.2 }]);
    expect(loin.distance).toBeGreaterThanOrEqual(CAMERA_DEFAUT.distance);
    expect(loin.distance).toBeLessThanOrEqual(CAMERA_DEFAUT.distance * 1.25 + 1e-9);
  });
  it("un écran étroit (portrait) s'éloigne pour garder 11 m de sol dans la largeur", () => {
    const r = new CameraRush();
    const d = r.but(CAMERA_DEFAUT, 0.3, 0, 0, null, []).distance;
    expect(2 * d * Math.tan((CAMERA_DEFAUT.champ * Math.PI) / 360) * 0.3).toBeGreaterThanOrEqual(11 - 1e-9);
  });
  it("facteurDeCadrage vaut 1 quand tout tient", () => {
    const c = new PerspectiveCamera(25, ASPECT);
    c.position.set(0, 27, 24);
    c.lookAt(0, 0, 0);
    c.updateMatrixWorld(true);
    expect(facteurDeCadrage(c, [{ x: 0, z: 0 }])).toBe(1);
    expect(facteurDeCadrage(c, [{ x: -1, z: 0 }, { x: 1, z: 0 }])).toBe(1);
    expect(facteurDeCadrage(c, [{ x: -80, z: 0 }, { x: 80, z: 0 }])).toBeGreaterThan(1);
  });
  it("suit avec un amorti : une image ne suffit pas à rattraper un saut du chevalier", () => {
    const r = new CameraRush();
    r.maj(0.016, CAMERA_DEFAUT, ASPECT, 0, 0, null, []);
    const x0 = r.camera.position.x;
    r.maj(0.016, CAMERA_DEFAUT, ASPECT, 8, 0, null, []);
    expect(r.camera.position.x).toBeGreaterThan(x0);
    expect(r.camera.position.x).toBeLessThan(8 * 0.5);
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
