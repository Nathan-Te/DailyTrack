import * as THREE from "three";

// L'habillage : « Lumière douce », le seul rendu du jeu (lot V1 : le style « Cartouche » et les mains procédurales ont été retirés) — matériaux standard à facettes, ombres douces, brume, halo, couleurs ACES. Un maillage
// est « habillé » une fois avec un rôle (pierre, rouge…). Rien ici n'est de la simulation.
export type RoleMat = "pierre" | "sombre" | "rouge" | "bois" | "or" | "flamme" | "nuage" | "portail" | "surface" | "orbe";

const PALETTE: Record<RoleMat, string> = {
  pierre: "#ECE3DA",
  sombre: "#C4B6BF",
  rouge: "#D9443A",
  bois: "#6B4A33",
  or: "#F4C24B",
  flamme: "#FFB347",
  nuage: "#FFFFFF",
  portail: "#FF7A9C",
  // Une surface de gravité : un bleu-violet lumineux, que l'on reconnaît de loin ; une orbe : un turquoise.
  surface: "#7B6CF0",
  orbe: "#5FE0D2",
};

export class Habillage {
  private readonly mats = {} as Record<RoleMat, THREE.Material>;
  private readonly geometries: THREE.BufferGeometry[] = [];

  constructor() {
    for (const [role, c] of Object.entries(PALETTE) as [RoleMat, string][]) {
      const lumineux = role === "or" || role === "flamme" || role === "portail" || role === "surface" || role === "orbe";
      this.mats[role] =
        role === "flamme" || role === "portail"
          ? new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(role === "portail" ? 1.6 : 2.2), toneMapped: false })
          : new THREE.MeshStandardMaterial({ color: c, roughness: role === "or" ? 0.35 : 0.95, metalness: role === "or" ? 0.2 : 0, flatShading: true, emissive: lumineux ? c : "#000000", emissiveIntensity: role === "surface" || role === "orbe" ? 0.7 : lumineux ? 0.45 : 0, side: role === "rouge" ? THREE.DoubleSide : THREE.FrontSide });
    }
  }

  /** Habille un maillage : son matériau selon son rôle. */
  habiller<M extends THREE.Mesh>(mesh: M, role: RoleMat): M {
    mesh.material = this.mats[role];
    this.geometries.push(mesh.geometry);
    return mesh;
  }

  materiau(role: RoleMat): THREE.Material {
    return this.mats[role];
  }

  dispose(): void {
    for (const m of Object.values(this.mats)) m.dispose();
    for (const g of this.geometries) g.dispose();
  }
}
