import { describe, expect, it } from "vitest";
import { Euler, Matrix4, Mesh, Object3D, Quaternion, Raycaster, Vector3 } from "three";
import { createCarMesh } from "../src/carMesh";
import { CAMERAS, HOOD_CLEARANCE, HOOD_MAX_TILT, HOOD_MOUNT } from "../src/cameras";

// Vue capot : la caméra est un point de la carrosserie. On le prouve sur le vrai maillage de la voiture : des rayons partent de l'œil dans tout
// le champ de vision (le plus large que le jeu ouvre, écran très large), le regard incliné au maximum permis dans chaque sens ; aucune
// surface ne doit se trouver à moins de `HOOD_CLEARANCE` de profondeur (le plan proche est à 0,1 m), et le capot doit bien être visible.

const NEAR = 0.1;
const FOV_V_MAX = 108; // 78 + 14 (vitesse) + 7 (turbo) + une marge
const ASPECT_MAX = 2.4;

function carMeshes(): Mesh[] {
  const model = createCarMesh();
  // roues dans leurs positions extrêmes : braquées à fond, comprimées au maximum, puis détendues
  for (const droop of [-0.15, 0, 0.22]) {
    model.update({ forward: 30, steerAngle: 0.5, braking: true, droop: [droop, droop, droop, droop], dt: 0.016 });
  }
  model.group.updateMatrixWorld(true);
  const out: Mesh[] = [];
  model.group.traverse((o: Object3D) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
}

/** Plus petite profondeur (le long de l'axe du regard) d'une surface de la voiture dans le champ de vision, pour un regard donné. */
function nearestDepth(meshes: Mesh[], eye: Vector3, view: Quaternion): number {
  const ray = new Raycaster();
  ray.near = 0;
  ray.far = 3;
  const axis = new Vector3(0, 0, -1).applyQuaternion(view);
  const tanV = Math.tan((FOV_V_MAX * Math.PI) / 360);
  let nearest = Infinity;
  for (let iy = -4; iy <= 4; iy++) {
    for (let ix = -6; ix <= 6; ix++) {
      const dir = new Vector3((ix / 6) * tanV * ASPECT_MAX, (iy / 4) * tanV, -1).normalize().applyQuaternion(view);
      ray.set(eye, dir);
      const hit = ray.intersectObjects(meshes, false)[0];
      if (hit) nearest = Math.min(nearest, hit.distance * dir.dot(axis));
    }
  }
  return nearest;
}

describe("vue capot (clipping)", () => {
  const meshes = carMeshes();
  const eye = new Vector3(HOOD_MOUNT.x, HOOD_MOUNT.y, HOOD_MOUNT.z);
  const forward = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI); // la caméra regarde −z, la voiture avance vers +z

  const tilts: [string, Euler][] = [
    ["à plat", new Euler(0, 0, 0)],
    ["piqué", new Euler(-HOOD_MAX_TILT, 0, 0, "YXZ")],
    ["cabré", new Euler(HOOD_MAX_TILT, 0, 0, "YXZ")],
    ["roulis gauche", new Euler(0, 0, HOOD_MAX_TILT, "YXZ")],
    ["roulis droite", new Euler(0, 0, -HOOD_MAX_TILT, "YXZ")],
    ["lacet gauche", new Euler(0, HOOD_MAX_TILT, 0, "YXZ")],
    ["lacet droite", new Euler(0, -HOOD_MAX_TILT, 0, "YXZ")],
    ["piqué et roulis", new Euler(-HOOD_MAX_TILT * 0.7, 0, HOOD_MAX_TILT * 0.7, "YXZ")],
  ];

  for (const [name, tilt] of tilts) {
    it(`aucune surface de la voiture à moins de ${HOOD_CLEARANCE} m de profondeur dans le champ de vision (${name})`, () => {
      const view = forward.clone().multiply(new Quaternion().setFromEuler(tilt));
      const depth = nearestDepth(meshes, eye, view);
      expect(depth).toBeGreaterThanOrEqual(HOOD_CLEARANCE);
      expect(HOOD_CLEARANCE).toBeGreaterThan(NEAR * 1.4); // marge sur le plan proche (0,1 m) de la caméra du jeu
    });
  }

  it("l'œil est hors de la caisse : un rayon vers le bas rencontre le capot sans que l'œil soit à l'intérieur", () => {
    const ray = new Raycaster(eye, new Vector3(0, -1, 0), 0, 5);
    const hits = ray.intersectObjects(meshes, false);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.distance).toBeGreaterThanOrEqual(0.25); // le capot est sous l'œil, pas autour
    // et vers le haut ou vers l'avant : rien (ni toit, ni pare-brise, ni aileron)
    for (const dir of [new Vector3(0, 1, 0), new Vector3(0, 0, 1), new Vector3(0.3, 0.3, 1).normalize(), new Vector3(-0.3, 0.3, 1).normalize()]) {
      expect(new Raycaster(eye, dir, 0, 1).intersectObjects(meshes, false).filter((h) => h.distance < 0.25)).toEqual([]);
    }
  });

  it("le capot est dans l'image : à plat, il occupe le bas du champ de vision, sans masquer l'horizon", () => {
    const rig = CAMERAS[2]!;
    const tanV = Math.tan((rig.fov * Math.PI) / 360);
    const ray = new Raycaster();
    ray.far = 6;
    const hitsAt = (ny: number) => ray.intersectObjects(meshes, false).length > 0 || false;
    const covered = (ny: number): boolean => {
      ray.set(eye, new Vector3(0, ny * tanV, 1).normalize());
      return hitsAt(ny);
    };
    expect(covered(-0.95)).toBe(true); // bord bas de l'écran : le capot
    expect(covered(0)).toBe(false); // milieu : la route
    expect(covered(0.5)).toBe(false);
  });

  it("la matrice de montage est celle d'un point de la caisse (aucun retard, aucune dérive)", () => {
    const body = new Matrix4().compose(new Vector3(10, 2, -5), new Quaternion().setFromEuler(new Euler(-0.2, 1.1, 0.1, "YXZ")), new Vector3(1, 1, 1));
    const world = eye.clone().applyMatrix4(body);
    const back = world.clone().applyMatrix4(body.clone().invert());
    expect(back.distanceTo(eye)).toBeLessThan(1e-9);
  });
});
