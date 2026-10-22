import { describe, expect, it } from "vitest";
import { BufferAttribute, Mesh, type Object3D } from "three";
import { AXLE_FRONT, HALF_TRACK } from "@cdj/sim";
import { WHEEL_RADIUS, createCarMesh } from "../src/carMesh";

// Lot 40, partie 1 : la voiture du lot 9b en six maillages (caisse, feux, une roue complète par roue), à l'image identique (captures :
// e2e/captures-lot40.spec.ts) ; le fantôme simple du Salon en reste un.

const maillages = (o: Object3D): Mesh[] => {
  const out: Mesh[] = [];
  o.traverse((x) => {
    if ((x as Mesh).isMesh) out.push(x as Mesh);
  });
  return out;
};
const pose = (p: Partial<{ forward: number; steerAngle: number; braking: boolean }> = {}) => ({ forward: 0, steerAngle: 0, braking: false, droop: [0, 0, 0, 0] as const, dt: 1 / 60, ...p });

describe("voiture en six maillages (lot 40)", () => {
  it("six maillages pour la voiture, le fantôme du jour et la voiture regardée ; un seul pour le fantôme simple du Salon", () => {
    expect(maillages(createCarMesh().group)).toHaveLength(6);
    expect(maillages(createCarMesh(true).group)).toHaveLength(6);
    expect(maillages(createCarMesh(true, 0xff4fa3, false, true).group)).toHaveLength(6);
    expect(maillages(createCarMesh(true, 0xff4fa3, true).group)).toHaveLength(1);
  });

  it("une roue = un maillage : elle braque (avant seulement), suit le débattement, tourne avec la vitesse (dans le shader : un angle commun)", () => {
    const car = createCarMesh();
    const roues = maillages(car.group).slice(2);
    expect(roues.map((r) => [r.position.x, r.position.z])).toEqual([
      [HALF_TRACK, AXLE_FRONT],
      [-HALF_TRACK, AXLE_FRONT],
      [HALF_TRACK, roues[2]!.position.z],
      [-HALF_TRACK, roues[3]!.position.z],
    ]);
    car.update({ ...pose({ forward: 20, steerAngle: 0.3 }), droop: [0.1, 0, -0.5, 0] });
    expect(roues.map((r) => r.rotation.y)).toEqual([0.3, 0.3, 0, 0]);
    expect(roues[0]!.position.y).toBeCloseTo(WHEEL_RADIUS - 0.1);
    expect(roues[2]!.position.y).toBeCloseTo(WHEEL_RADIUS + 0.15); // compression bornée
    // Tout ce qui tourne est marqué ; l'étrier et le disque, non. Le matériau d'ombre tourne avec la roue.
    const spin = roues[0]!.geometry.getAttribute("aSpin") as BufferAttribute;
    const marques = Array.from(spin.array as Float32Array);
    expect(marques.some((s) => s === 1)).toBe(true);
    expect(marques.some((s) => s === 0)).toBe(true);
    expect(roues[0]!.customDepthMaterial).toBeDefined();
    expect(roues.every((r) => r.material === roues[0]!.material)).toBe(true);
  });

  it("les feux stop s'allument au freinage (couleur réécrite seulement quand le frein change)", () => {
    const car = createCarMesh();
    const feux = maillages(car.group)[1]!;
    const couleurs = feux.geometry.getAttribute("color") as BufferAttribute;
    const dernier = couleurs.count - 1;
    const rouge = () => couleurs.getX(dernier);
    const eteint = rouge();
    const version = couleurs.version;
    car.update(pose());
    expect(couleurs.version).toBe(version);
    car.update(pose({ braking: true }));
    expect(rouge()).toBeGreaterThan(eteint * 5);
    car.update(pose());
    expect(rouge()).toBeCloseTo(eteint);
  });
});
