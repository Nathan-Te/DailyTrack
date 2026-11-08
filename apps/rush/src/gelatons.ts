import { Color, DynamicDrawUsage, InstancedMesh, Matrix4, MeshToonMaterial, Quaternion, SphereGeometry, Vector3, type BufferGeometry, type ShaderMaterial } from "three";
import type { Durees, Monstre } from "@cdj/rush-sim";
import { CALQUE_COQUE, coqueInstanciee, lisse, plat } from "./cel";
import { bornes, geleeDome, sortie } from "./acteurs";
import { fusionner, placer, teindre } from "./formes";
import { BLANC, ENCRE } from "./palette";

// Les GÉLATONS (lot BR5) : de petites gelées bleues en meute (6 à 12), un coup chacun, qui se jettent sur le chevalier. Jusqu'à 80 à l'écran : chacun n'a pas son maillage — **un seul tas instancié** (un appel de dessin, un de plus pour l'ombre en haute
// qualité, un pour la coque de contour en basse), dôme et yeux fusionnés en une forme. Le corps lit la simulation : s'écrase à l'annonce, bondit, se repose, titube, s'écrase sous un coup (comme la gelée, plus vite).
export const MAX_GELATONS = 96;
/** Le bleu des gélatons : bien distinct du vert des gelées, et contrasté contre les deux tons du sol de chaque thème (`test/lisibilite.test.ts`). */
export const GELATON_COULEUR = 0x3f8fe0;
export const GELATON_CLAIRE = 0xb9dcff;

/** Le dôme d'un gélaton (un dôme écrasé de la gelée, plus petit) et ses deux yeux, fusionnés : ~30 cm de rayon une fois mis à l'échelle (0,62). */
export function formeGelaton(): BufferGeometry {
  const yeux: BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    yeux.push(teindre(placer(new SphereGeometry(1, 6, 4), { x: s * 0.23, y: 0.39, z: 0.56, s: 0.1 }), BLANC));
    yeux.push(teindre(placer(new SphereGeometry(1, 5, 3), { x: s * 0.23, y: 0.385, z: 0.64, s: 0.055 }), ENCRE));
  }
  return fusionner([placer(geleeDome(GELATON_COULEUR, GELATON_CLAIRE, 12, 5), { s: [1.5, 1.2, 1.5] }), ...yeux]);
}

/** L'attitude d'un gélaton d'après son état : l'échelle (largeur/hauteur) et la hauteur du saut, en mètres. Pure : testée. */
export function attitudeGelaton(m: Pick<Monstre, "t" | "gel" | "age">, temps: number, tick: number, d: Pick<Durees, "gelatonAnnonce" | "gelatonBond" | "gelatonCycle">): { sy: number; y: number; tremble: number; pop: number } {
  const A = d.gelatonAnnonce;
  const B = d.gelatonBond;
  let sy = 1;
  let y = 0;
  let tremble = 0;
  if (m.gel > 0) sy = 1 + Math.sin(temps * 34) * 0.07;
  else if (m.t < A) {
    const u = m.t / A;
    sy = 1 - 0.32 * Math.sin(Math.min(1, u * 1.25) * Math.PI * 0.5);
    if (u > 0.65) tremble = Math.sin(temps * 90) * 0.03;
  } else if (m.t < A + B) {
    const u = (m.t - A) / B;
    y = Math.sin(Math.PI * u) * 0.8;
    sy = 0.72 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.3));
  } else {
    const u = (m.t - A - B) / Math.max(1, d.gelatonCycle - A - B);
    sy = 1 - 0.3 * Math.exp(-u * 4) * Math.cos(u * 14);
  }
  const apparition = bornes((tick - m.age) / 14, 0, 1);
  return { sy, y, tremble, pop: apparition < 1 ? sortie(apparition) * (1 + 0.25 * Math.sin(apparition * Math.PI)) : 1 };
}

/** Le tas instancié des gélatons (la coque de contour de la basse qualité : `coqueInstanciee` de `cel.ts`). */
export class Gelatons {
  readonly corps: InstancedMesh;
  readonly coque: InstancedMesh;
  readonly matiere: MeshToonMaterial;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly axe = new Vector3(0, 1, 0);
  private readonly c = new Color();
  private readonly coque0: ShaderMaterial;
  /** Les instances posées cette image. */
  n = 0;
  constructor() {
    const forme = formeGelaton();
    this.matiere = plat(0xffffff, true);
    this.corps = new InstancedMesh(forme, this.matiere, MAX_GELATONS);
    this.corps.castShadow = true;
    this.corps.instanceMatrix.setUsage(DynamicDrawUsage);
    this.corps.frustumCulled = false;
    this.corps.count = 0;
    for (let i = 0; i < MAX_GELATONS; i++) this.corps.setColorAt(i, this.c.set(0xffffff));
    this.coque0 = coqueInstanciee();
    this.coque = new InstancedMesh(lisse(forme), this.coque0, MAX_GELATONS);
    this.coque.layers.set(CALQUE_COQUE);
    this.coque.instanceMatrix.setUsage(DynamicDrawUsage);
    this.coque.frustumCulled = false;
    this.coque.count = 0;
  }
  debut(): void {
    this.n = 0;
  }
  /** Pose un gélaton en (x, z) mètres, tourné de `yaw`, avec son attitude ; `eclair` (0 à 1) l'éclaircit. */
  poser(x: number, z: number, yaw: number, a: { sy: number; y: number; tremble: number; pop: number }, eclair: number, ecrase: number): void {
    if (this.n >= MAX_GELATONS) return;
    const k = 0.62 * a.pop;
    const sy = a.sy * (1 - ecrase);
    this.q.setFromAxisAngle(this.axe, yaw);
    this.p.set(x + a.tremble, a.y, z);
    this.s.set((k / Math.sqrt(sy)) * (1 + ecrase * 0.55), k * sy, (k / Math.sqrt(sy)) * (1 + ecrase * 0.55));
    this.m.compose(this.p, this.q, this.s);
    this.corps.setMatrixAt(this.n, this.m);
    this.coque.setMatrixAt(this.n, this.m);
    this.corps.setColorAt(this.n, this.c.setScalar(1 + eclair * 2.2));
    this.n++;
  }
  fin(): void {
    this.corps.count = this.coque.count = this.n;
    this.corps.instanceMatrix.needsUpdate = this.coque.instanceMatrix.needsUpdate = true;
    if (this.corps.instanceColor) this.corps.instanceColor.needsUpdate = true;
  }
  detruire(): void {
    this.corps.geometry.dispose();
    this.matiere.dispose();
    this.coque0.dispose();
  }
}
