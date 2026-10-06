import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";

/** Voiture low-poly : modèle orienté vers +z (cap 0), origine au sol. `ghost` : version bleue translucide. */
export function createCarMesh(ghost = false): Group {
  const car = new Group();
  const mat = (color: number) =>
    new MeshStandardMaterial({ color, flatShading: true, ...(ghost ? { transparent: true, opacity: 0.42, depthWrite: false } : {}) });

  const body = new Mesh(new BoxGeometry(1.8, 0.55, 4.0), mat(ghost ? 0x57b4ff : 0xe8283a));
  body.position.y = 0.6;
  const cabin = new Mesh(new BoxGeometry(1.4, 0.5, 1.8), mat(ghost ? 0x2a4f7a : 0x1c2540));
  cabin.position.set(0, 1.1, -0.2);
  const spoiler = new Mesh(new BoxGeometry(1.7, 0.1, 0.5), mat(ghost ? 0x2a4f7a : 0x1c2540));
  spoiler.position.set(0, 1.15, -1.85);
  car.add(body, cabin, spoiler);

  const wheelGeo = new BoxGeometry(0.3, 0.7, 0.7);
  const wheelMat = mat(0x151515);
  for (const [x, z] of [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]] as const) {
    const w = new Mesh(wheelGeo, wheelMat);
    w.position.set(x, 0.35, z);
    car.add(w);
  }
  return car;
}
