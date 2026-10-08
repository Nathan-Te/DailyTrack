import { describe, expect, it } from "vitest";
import { Object3D, Vector3 } from "three";
import { CarPose } from "../src/carPose";

describe("orientation de la voiture sur une paroi", () => {
  it("à plat : l'orientation d'avant (tangage, cap, roulis)", () => {
    const pose = new CarPose();
    const obj = new Object3D();
    pose.follow(0, 1, 0, 0.016);
    pose.apply(obj, 0.1, 0.5, -0.05);
    expect(obj.rotation.y).toBeCloseTo(0.5, 9);
    expect(obj.rotation.x).toBeCloseTo(-Math.atan(0.1), 9);
    expect(obj.rotation.z).toBeCloseTo(Math.atan(-0.05), 9);
    expect(pose.lean).toBe(0);
  });

  it("sur la paroi verticale, le haut de la voiture est la normale et le cap reste le long de la paroi", () => {
    const pose = new CarPose();
    const obj = new Object3D();
    // Paroi gauche d'une route qui va vers +z : la normale pointe vers l'axe, donc vers −x.
    pose.follow(-1, 0, 0, 1, true);
    pose.apply(obj, 0, 0, 0);
    obj.updateMatrixWorld();
    const up = new Vector3(0, 1, 0).applyQuaternion(obj.quaternion);
    const fwd = new Vector3(0, 0, 1).applyQuaternion(obj.quaternion);
    expect(up.x).toBeCloseTo(-1, 9);
    expect(fwd.z).toBeCloseTo(1, 9);
    expect(Math.abs(fwd.x) + Math.abs(fwd.y)).toBeLessThan(1e-9);
    expect(pose.lean).toBeCloseTo(1, 9);
  });

  it("la normale affichée est lissée, et la caméra ne suit qu'une partie du roulis", () => {
    const pose = new CarPose();
    pose.follow(-1, 0, 0, 0.016);
    expect(pose.lean).toBeGreaterThan(0);
    expect(pose.lean).toBeLessThan(0.5); // pas de bascule d'un coup
    for (let i = 0; i < 120; i++) pose.follow(-1, 0, 0, 0.016);
    expect(pose.lean).toBeGreaterThan(0.99);
    const camLean = Math.sqrt(1 - pose.cameraUp.y * pose.cameraUp.y);
    expect(camLean).toBeGreaterThan(0.4);
    expect(camLean).toBeLessThan(0.95);
    for (let i = 0; i < 240; i++) pose.follow(0, 1, 0, 0.016);
    expect(pose.lean).toBeLessThan(0.01);
  });
});
