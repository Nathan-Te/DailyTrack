import { Euler, Quaternion, Vector3, type Object3D } from "three";

// Orientation de la voiture à l'écran (lot 18) : la caisse penche comme le sol (suspension : tangage et roulis, en pentes) et, sur la
// paroi d'une cuve, elle s'incline avec la **normale de la surface** (jusqu'à la verticale). La normale est lissée : la voiture ne bascule
// pas d'un coup à l'entrée ou à la sortie d'une paroi. Présentation seule : lit l'état de la voiture, ne le modifie jamais.

const UP = new Vector3(0, 1, 0);

/** Vitesse de rattrapage de la normale affichée (1/s) : un quart de seconde pour suivre une paroi. */
const FOLLOW = 12;
/** Part du roulis de la voiture que la caméra suit : elle penche avec la paroi sans se coucher (lisibilité). */
export const CAMERA_ROLL_FOLLOW = 0.6;

export class CarPose {
  /** Normale affichée (lissée). */
  readonly up = new Vector3(0, 1, 0);
  /** « Haut » de la caméra : entre la verticale du monde et la normale de la voiture. */
  readonly cameraUp = new Vector3(0, 1, 0);
  private readonly target = new Vector3();
  private readonly tilt = new Quaternion();
  private readonly turn = new Quaternion();
  private readonly euler = new Euler();

  /** Inclinaison actuelle (0 à plat, 1 à la verticale). */
  get lean(): number {
    return Math.sqrt(Math.max(0, 1 - this.up.y * this.up.y));
  }

  /** Remet la normale à la verticale (reprise, nouvel essai). */
  reset(): void {
    this.up.set(0, 1, 0);
    this.cameraUp.set(0, 1, 0);
  }

  /** Suit la normale `(nx, ny, nz)` de la surface (dt en secondes ; `snap` : sans lissage). */
  follow(nx: number, ny: number, nz: number, dt: number, snap = false): void {
    this.target.set(nx, ny, nz);
    if (this.target.lengthSq() < 1e-9) this.target.set(0, 1, 0);
    this.target.normalize();
    this.up.lerp(this.target, snap ? 1 : 1 - Math.exp(-FOLLOW * dt)).normalize();
    this.cameraUp.copy(UP).lerp(this.up, CAMERA_ROLL_FOLLOW).normalize();
  }

  /** Pose `obj` : cap `yaw`, tangage et roulis en pentes (suspension), puis inclinaison de la surface. */
  apply(obj: Object3D, pitchSlope: number, yaw: number, rollSlope: number): void {
    const flat = Math.abs(this.up.x) + Math.abs(this.up.z) < 1e-5;
    if (flat) {
      obj.rotation.set(-Math.atan(pitchSlope), yaw, Math.atan(rollSlope), "YXZ");
      return;
    }
    this.euler.set(-Math.atan(pitchSlope), yaw, Math.atan(rollSlope), "YXZ");
    this.turn.setFromEuler(this.euler);
    // Le « haut » du monde devient la normale ; l'axe de la rotation est l'avance de la route (la normale lui est perpendiculaire).
    this.tilt.setFromUnitVectors(UP, this.up);
    obj.quaternion.copy(this.tilt).multiply(this.turn);
  }
}
