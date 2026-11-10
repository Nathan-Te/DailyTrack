import * as THREE from "three";
import type { StyleVertige } from "./confort";

// L'habillage : les deux styles de la maquette. « Lumière douce » (matériaux standard à facettes, ombres douces, brume, halo, couleurs ACES) et « Cartouche » (aplats éclairés en trois tons et contour d'encre, comme
// Tower, Blocks et Rush). Un maillage est « habillé » une fois avec un rôle (pierre, rouge…) ; changer de style change ses matériaux et montre ou cache son contour. Rien ici n'est de la simulation.
export type RoleMat = "pierre" | "sombre" | "rouge" | "bois" | "or" | "flamme" | "nuage" | "portail" | "gant" | "peau";

const PALETTE: Record<StyleVertige, Record<RoleMat, string>> = {
  doux: { pierre: "#ECE3DA", sombre: "#C4B6BF", rouge: "#D9443A", bois: "#6B4A33", or: "#F4C24B", flamme: "#FFB347", nuage: "#FFFFFF", portail: "#FF7A9C", gant: "#3A302B", peau: "#E8A27C" },
  cartouche: { pierre: "#E3D6BC", sombre: "#B9A98F", rouge: "#C2401F", bois: "#6B4A33", or: "#E8B23A", flamme: "#E8B23A", nuage: "#FFF6E0", portail: "#E46FA0", gant: "#2A1E16", peau: "#F1C7A3" },
};
const ENCRE = "#2A1E16";

/** Le dégradé de trois tons des aplats de « Cartouche ». */
function degrade(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

interface Habille {
  mesh: THREE.Mesh;
  role: RoleMat;
  contour: THREE.Mesh | null;
}

export class Habillage {
  style: StyleVertige;
  private readonly habilles: Habille[] = [];
  private readonly mats: Record<StyleVertige, Record<RoleMat, THREE.Material>>;
  private readonly encre = new THREE.MeshBasicMaterial({ color: ENCRE, side: THREE.BackSide });
  private readonly gradient = degrade();

  constructor(style: StyleVertige) {
    this.style = style;
    const fabrique = (s: StyleVertige): Record<RoleMat, THREE.Material> => {
      const m = {} as Record<RoleMat, THREE.Material>;
      for (const [role, c] of Object.entries(PALETTE[s]) as [RoleMat, string][]) {
        const lumineux = role === "or" || role === "flamme" || role === "portail";
        if (s === "doux") {
          m[role] =
            role === "flamme" || role === "portail"
              ? new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(role === "portail" ? 1.6 : 2.2), toneMapped: false })
              : new THREE.MeshStandardMaterial({ color: c, roughness: role === "or" ? 0.35 : 0.95, metalness: role === "or" ? 0.2 : 0, flatShading: true, emissive: lumineux ? c : "#000000", emissiveIntensity: lumineux ? 0.45 : 0, side: role === "rouge" ? THREE.DoubleSide : THREE.FrontSide });
        } else {
          m[role] = lumineux ? new THREE.MeshBasicMaterial({ color: c }) : new THREE.MeshToonMaterial({ color: c, gradientMap: this.gradient, side: role === "rouge" ? THREE.DoubleSide : THREE.FrontSide });
        }
      }
      return m;
    };
    this.mats = { doux: fabrique("doux"), cartouche: fabrique("cartouche") };
  }

  /** Habille un maillage : son matériau selon le style, et son contour d'encre (une coque légèrement plus grande, vue de l'intérieur) pour « Cartouche ». */
  habiller<M extends THREE.Mesh>(mesh: M, role: RoleMat, contour = true): M {
    mesh.material = this.mats[this.style][role];
    let c: THREE.Mesh | null = null;
    if (contour) {
      c = new THREE.Mesh(mesh.geometry, this.encre);
      mesh.geometry.computeBoundingBox();
      const t = new THREE.Vector3();
      mesh.geometry.boundingBox!.getSize(t);
      const e = Math.min(0.07, 0.35 * Math.min(t.x || 1, t.y || 1, t.z || 1));
      c.scale.set((t.x + e) / Math.max(t.x, 0.01), (t.y + e) / Math.max(t.y, 0.01), (t.z + e) / Math.max(t.z, 0.01));
      c.visible = this.style === "cartouche";
      c.castShadow = false;
      mesh.add(c);
    }
    this.habilles.push({ mesh, role, contour: c });
    return mesh;
  }

  appliquer(style: StyleVertige): void {
    this.style = style;
    for (const h of this.habilles) {
      h.mesh.material = this.mats[style][h.role];
      if (h.contour) h.contour.visible = style === "cartouche";
    }
  }

  dispose(): void {
    for (const s of ["doux", "cartouche"] as const) for (const m of Object.values(this.mats[s])) m.dispose();
    this.encre.dispose();
    this.gradient.dispose();
    for (const h of this.habilles) h.mesh.geometry.dispose();
  }
}
