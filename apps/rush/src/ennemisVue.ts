import { BoxGeometry, BufferGeometry, BufferAttribute, Color, ConeGeometry, CylinderGeometry, DoubleSide, DynamicDrawUsage, Group, InstancedMesh, LineBasicMaterial, LineSegments, Material, Matrix4, MeshBasicMaterial, Quaternion, RingGeometry, SphereGeometry, TorusGeometry, Vector3, type PerspectiveCamera } from "three";
import { MONSTRES_IDS, ANNONCE_PLONGEON, CHAMAN, CHAUVE, CRACHE_ANNONCE, CRACHEUR, GELATON, GELEE, PB_ANNONCE, PB_OUVERT, PLONGEON, PORTE_BOUCLIER, REPOS, TOTEM, TOTEM_ANNONCE, TOTEM_PERIODE, type Durees, type Monstre, type Partie, type Projectile } from "@cdj/rush-sim";
import { CAMERA_DEFAUT } from "./camera";
import { bornes, GEO, lerp, lisser, sortie, sph } from "./acteurs";
import { CALQUE_COQUE, coqueInstanciee, lisse, plat } from "./cel";
import { bloc, fusionner, placer, teindre } from "./formes";
import { BLANC, COULEURS, ENCRE } from "./palette";

// LES MONSTRES EN TAS (lot BR6). Jusqu'à 60 monstres et la salle d'épreuve à l'écran : aucun n'a son propre maillage — chaque TYPE est un tas instancié (un appel de dessin, un de plus pour la coque de contour de la basse qualité), ses PARTIES qui
// bougent séparément (les ailes de la chauve-souris, le bouclier du porte-bouclier, l'orbe du chaman) étant des tas à part qui reçoivent chacune leur matrice. Les gélatons de BR5 en étaient le premier exemple ; les gelées, les chauves-souris et les
// quatre nouveaux ennemis (cracheur, chaman, totem, porte-bouclier) les suivent. Les ÉLITES ont une taille ×1,5, une couronne et un halo d'or. Le bouclier posé par un chaman est une bulle bleue claire reliée au chaman par un trait.
// Les repères : le mètre ; les pieds à y = 0 ; l'avant d'un corps est +z (le yaw le tourne vers où il regarde).

/** Un tas instancié : la forme ombrée (elle porte une ombre) et sa coque de contour (basse qualité). */
export class Tas {
  readonly corps: InstancedMesh;
  readonly coque: InstancedMesh | null;
  readonly matiere: Material;
  private readonly c = new Color();
  n = 0;
  constructor(
    forme: BufferGeometry,
    readonly max: number,
    o: { matiere?: Material; coque?: boolean; ombre?: boolean; ordre?: number } = {},
  ) {
    this.matiere = o.matiere ?? plat(0xffffff, true);
    this.corps = new InstancedMesh(forme, this.matiere, max);
    this.corps.castShadow = o.ombre ?? true;
    this.corps.instanceMatrix.setUsage(DynamicDrawUsage);
    this.corps.frustumCulled = false;
    this.corps.count = 0;
    for (let i = 0; i < max; i++) this.corps.setColorAt(i, this.c.set(0xffffff));
    if (o.ordre !== undefined) this.corps.renderOrder = o.ordre;
    if (o.coque ?? true) {
      this.coque = new InstancedMesh(lisse(forme), coqueInstanciee(), max);
      this.coque.layers.set(CALQUE_COQUE);
      this.coque.instanceMatrix.setUsage(DynamicDrawUsage);
      this.coque.frustumCulled = false;
      this.coque.count = 0;
    } else this.coque = null;
  }
  debut(): void {
    this.n = 0;
  }
  /** Pose une instance : la matrice, et une couleur (un facteur de lumière blanc par défaut : l'éclair d'un coup). */
  poser(m: Matrix4, eclair = 0, couleur?: Color): void {
    if (this.n >= this.max) return;
    this.corps.setMatrixAt(this.n, m);
    this.coque?.setMatrixAt(this.n, m);
    this.corps.setColorAt(this.n, couleur ?? this.c.setScalar(1 + eclair * 2.2));
    this.n++;
  }
  fin(): void {
    this.corps.count = this.n;
    this.corps.instanceMatrix.needsUpdate = true;
    if (this.corps.instanceColor) this.corps.instanceColor.needsUpdate = true;
    if (this.coque) {
      this.coque.count = this.n;
      this.coque.instanceMatrix.needsUpdate = true;
    }
  }
  detruire(): void {
    this.corps.geometry.dispose();
    this.matiere.dispose();
    this.coque?.geometry.dispose();
    (this.coque?.material as Material | undefined)?.dispose();
  }
}

// --- Les formes (construites une fois) ---------------------------------------------------------------------------------------------------------------------------------------------------------------
/** Deux yeux (un blanc et une pupille chacun), fusionnés dans le corps (des sommets blancs et d'encre). */
function paireDYeux(ecart: number, y: number, z: number, r: number, pupille = 0.55): BufferGeometry[] {
  const f: BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    f.push(teindre(placer(new SphereGeometry(1, 8, 6), { x: s * ecart, y, z, s: r }), BLANC));
    f.push(teindre(placer(new SphereGeometry(1, 6, 4), { x: s * ecart, y: y - r * 0.1, z: z + r * 0.62, s: r * pupille }), ENCRE));
  }
  return f;
}
const cyl = (r: number, h: number, seg = 10): CylinderGeometry => new CylinderGeometry(r, r, h, seg);

export function formeGelee(): BufferGeometry {
  return fusionner([placer(GEO.geleeD.clone(), { s: [1.5, 1.2, 1.5] }), ...paireDYeux(0.23, 0.39, 0.6, 0.095, 0.58)]);
}
export function formeChauve(): BufferGeometry {
  return fusionner([GEO.chauve.clone()]);
}
/** Les yeux de la chauve-souris : un tas à part, pour que l'annonce du plongeon les rougisse (le danger). */
export function formeYeuxChauve(): BufferGeometry {
  return fusionner(paireDYeux(0.11, 0.06, 0.24, 0.07));
}
/** Le cracheur : un crapaud orangé, large bouche sombre devant, deux yeux sur tiges, trois piquants au dos. */
export function formeCracheur(): BufferGeometry {
  const f: BufferGeometry[] = [
    teindre(placer(sph(0.42, 16, 10), { y: 0.4, s: [1, 0.88, 1.05] }), COULEURS.cracheur),
    teindre(placer(sph(0.3, 12, 8), { y: 0.3, z: 0.16, s: [1, 0.78, 0.85] }), COULEURS.cracheurClair),
    teindre(placer(sph(0.2, 10, 8), { y: 0.36, z: 0.4, s: [1.25, 0.5, 0.55] }), COULEURS.cracheurBouche),
  ];
  for (const s of [-1, 1]) {
    f.push(teindre(placer(cyl(0.05, 0.26, 6), { x: s * 0.2, y: 0.78, z: 0.1 }), COULEURS.cracheur));
    f.push(teindre(placer(new SphereGeometry(1, 8, 6), { x: s * 0.2, y: 0.96, z: 0.13, s: 0.14 }), BLANC));
    f.push(teindre(placer(new SphereGeometry(1, 6, 4), { x: s * 0.2, y: 0.95, z: 0.26, s: 0.07 }), ENCRE));
  }
  for (const [x, z] of [[0, -0.28], [-0.22, -0.2], [0.22, -0.2]] as const) f.push(teindre(placer(new ConeGeometry(0.07, 0.24, 5), { x, y: 0.78, z, rx: -0.5 }), COULEURS.cracheurClair));
  return fusionner(f);
}
/** Le chaman : une robe vert-de-gris en cône, une capuche à pointe, un visage d'ombre aux yeux jaunes, un bâton de bois ; l'orbe est un tas à part. */
export function formeChaman(): BufferGeometry {
  const f: BufferGeometry[] = [
    teindre(placer(new ConeGeometry(0.42, 1.0, 14), { y: 0.5 }), COULEURS.chaman),
    teindre(placer(new SphereGeometry(0.29, 14, 10), { y: 1.08, s: [1, 0.95, 1.05] }), COULEURS.chamanSombre),
    teindre(placer(new ConeGeometry(0.2, 0.36, 8), { y: 1.42, z: -0.08, rx: -0.45 }), COULEURS.chamanSombre),
    teindre(placer(sph(0.16, 10, 8), { y: 1.06, z: 0.18, s: [1.05, 1.05, 0.7] }), ENCRE),
    teindre(placer(cyl(0.035, 1.7, 6), { x: 0.44, y: 0.85, z: 0.12 }), COULEURS.totemBois),
    teindre(placer(new TorusGeometry(0.12, 0.03, 6, 12), { x: 0.44, y: 1.68, z: 0.12, rx: Math.PI / 2 }), COULEURS.totemOcre),
    teindre(placer(new BoxGeometry(0.86, 0.1, 0.5), { y: 0.05, s: [0.9, 1, 0.9] }), COULEURS.chamanSombre),
  ];
  for (const s of [-1, 1]) f.push(teindre(placer(new SphereGeometry(1, 6, 4), { x: s * 0.08, y: 1.08, z: 0.3, s: 0.05 }), 0xffe27a));
  return fusionner(f);
}
/** L'orbe du chaman et la lueur du totem : une sphère unie qu'on teint et qu'on grossit à la pose. */
export const formeLueur = (): BufferGeometry => new SphereGeometry(1, 10, 8);
/** Le totem : un socle de pierre, un fût de bois aux bandes ocre, un grand visage sarcelle aux yeux clairs, deux cornes ocre. */
export function formeTotem(): BufferGeometry {
  const f: BufferGeometry[] = [
    bloc(1.05, 0.4, 1.05, { couleur: COULEURS.totemPierre, dessus: 0x8a7a68, variation: 0.03, irregulier: 0, graine: 11, rayon: 0.1 }),
    teindre(placer(cyl(0.4, 0.85, 12), { y: 0.82 }), COULEURS.totemBois),
    teindre(placer(new TorusGeometry(0.41, 0.06, 6, 14), { y: 0.62, rx: Math.PI / 2 }), COULEURS.totemOcre),
    teindre(placer(new TorusGeometry(0.41, 0.06, 6, 14), { y: 1.1, rx: Math.PI / 2 }), COULEURS.totemOcre),
    bloc(0.86, 0.62, 0.86, { couleur: COULEURS.totemSarcelle, dessus: 0x3fb0a6, variation: 0.03, irregulier: 0, graine: 12, rayon: 0.12 }),
    teindre(placer(new ConeGeometry(0.12, 0.5, 6), { x: -0.38, y: 2.1, rz: 0.55 }), COULEURS.totemOcre),
    teindre(placer(new ConeGeometry(0.12, 0.5, 6), { x: 0.38, y: 2.1, rz: -0.55 }), COULEURS.totemOcre),
    teindre(placer(new BoxGeometry(0.38, 0.1, 0.1), { y: 1.5, z: 0.43 }), ENCRE),
  ];
  // le grand visage est posé plus haut que le fût : il faut le remonter (le bloc est centré à l'origine)
  f[4] = placer(f[4]!, { y: 1.75 });
  f[7] = placer(f[7]!, { y: 0.32 });
  for (const s of [-1, 1]) {
    f.push(teindre(placer(new SphereGeometry(1, 8, 6), { x: s * 0.22, y: 1.85, z: 0.42, s: 0.11, }), 0xf4f1e0));
    f.push(teindre(placer(new SphereGeometry(1, 6, 4), { x: s * 0.22, y: 1.84, z: 0.5, s: 0.05 }), ENCRE));
  }
  return fusionner(f);
}
/** Le porte-bouclier : un colosse trapu d'ardoise (jambes, torse, casque à crête ocre, bras) ; le bouclier est un tas à part, qui se tourne de son côté. */
export function formePorteBouclier(): BufferGeometry {
  const f: BufferGeometry[] = [
    teindre(placer(new BoxGeometry(0.3, 0.5, 0.34), { x: -0.22, y: 0.25 }), COULEURS.pbBord),
    teindre(placer(new BoxGeometry(0.3, 0.5, 0.34), { x: 0.22, y: 0.25 }), COULEURS.pbBord),
    placer(bloc(1.0, 0.72, 0.7, { couleur: COULEURS.pbCorps, dessus: 0x5a6a88, variation: 0.03, irregulier: 0, graine: 21, rayon: 0.16 }), { y: 0.88 }),
    teindre(placer(sph(0.3, 14, 10), { y: 1.48, s: [1, 0.95, 1] }), COULEURS.pbCorps),
    teindre(placer(new ConeGeometry(0.1, 0.42, 5), { y: 1.9, z: -0.05, rx: -0.2 }), COULEURS.totemOcre),
    teindre(placer(new BoxGeometry(0.36, 0.08, 0.14), { y: 1.5, z: 0.26 }), ENCRE),
    teindre(placer(sph(0.17, 8, 6), { x: -0.6, y: 1.0, z: 0.08 }), COULEURS.pbCorps),
    teindre(placer(sph(0.17, 8, 6), { x: 0.6, y: 1.0, z: 0.08 }), COULEURS.pbCorps),
  ];
  for (const s of [-1, 1]) f.push(teindre(placer(new SphereGeometry(1, 6, 4), { x: s * 0.08, y: 1.5, z: 0.3, s: 0.035 }), BLANC));
  return fusionner(f);
}
/** Le grand bouclier, dessiné autour de l'origine, tourné vers +z : un disque d'acier cerclé d'ardoise, un ombon doré. Posé à ~0,8 m devant le corps. */
export function formeBouclierPB(): BufferGeometry {
  return fusionner([
    teindre(placer(cyl(0.7, 0.14, 20), { rx: Math.PI / 2 }), COULEURS.pbBord),
    teindre(placer(cyl(0.6, 0.18, 20), { z: 0.03, rx: Math.PI / 2 }), COULEURS.pbBouclier),
    teindre(placer(sph(0.17, 10, 8), { z: 0.13, s: [1, 1, 0.7] }), COULEURS.totemOcre),
    teindre(placer(new BoxGeometry(0.1, 0.9, 0.06), { z: 0.13 }), COULEURS.pbBord),
    teindre(placer(new BoxGeometry(0.9, 0.1, 0.06), { z: 0.13 }), COULEURS.pbBord),
  ]);
}
/** La couronne d'un élite : un anneau d'or à cinq pointes, au-dessus du monstre. */
export function formeCouronne(): BufferGeometry {
  const f: BufferGeometry[] = [teindre(placer(new TorusGeometry(0.3, 0.05, 6, 16), { rx: Math.PI / 2 }), COULEURS.elite)];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    f.push(teindre(placer(new ConeGeometry(0.07, 0.24, 5), { x: Math.cos(a) * 0.3, y: 0.14, z: Math.sin(a) * 0.3 }), COULEURS.elite));
  }
  return fusionner(f);
}

// --- Les attitudes (pures, testées) ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface Attitude {
  /** L'échelle du corps (x/z et y), la hauteur du saut et le tremblement, en mètres ; `pop` : l'apparition de 0 à 1. */
  sy: number;
  y: number;
  tremble: number;
  pop: number;
}
/** La gelée : elle s'écrase (annonce), bondit, se repose, titube ; comme le gélaton, en plus grand et plus haut. */
export function attitudeGelee(m: Pick<Monstre, "t" | "gel" | "age">, temps: number, tick: number, d: Pick<Durees, "geleeAnnonce" | "geleeBond" | "geleeCycle">): Attitude {
  const A = d.geleeAnnonce;
  const B = d.geleeBond;
  let sy = 1;
  let y = 0;
  let tremble = 0;
  if (m.gel > 0) sy = 1 + Math.sin(temps * 30) * 0.06;
  else if (m.t < A) {
    const u = m.t / A;
    sy = 1 - 0.3 * Math.sin(Math.min(1, u * 1.25) * Math.PI * 0.5);
    if (u > 0.7) tremble = Math.sin(temps * 80) * 0.035;
  } else if (m.t < A + B) {
    const u = (m.t - A) / B;
    y = Math.sin(Math.PI * u) * 0.95;
    sy = 0.72 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.3));
  } else {
    const u = (m.t - A - B) / Math.max(1, d.geleeCycle - A - B);
    sy = 1 - 0.3 * Math.exp(-u * 4) * Math.cos(u * 14);
  }
  const ap = bornes((tick - m.age) / 18, 0, 1);
  return { sy, y, tremble, pop: ap < 1 ? sortie(ap) * (1 + 0.25 * Math.sin(ap * Math.PI)) : 1 };
}
export function attitudeGelaton(m: Pick<Monstre, "t" | "gel" | "age">, temps: number, tick: number, d: Pick<Durees, "gelatonAnnonce" | "gelatonBond" | "gelatonCycle">): Attitude {
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
  const ap = bornes((tick - m.age) / 14, 0, 1);
  return { sy, y, tremble, pop: ap < 1 ? sortie(ap) * (1 + 0.25 * Math.sin(ap * Math.PI)) : 1 };
}
/** Le cracheur : il gonfle pendant la visée (le projectile se prépare dans sa gorge), se dégonfle après le tir, et se balance en marchant. Rend l'échelle (x/z, y, z) et la hauteur. */
export function attitudeCracheur(m: Pick<Monstre, "t" | "gel" | "etat" | "age">, temps: number, tick: number, annonce: number): Attitude & { gonfle: number } {
  let sy = 1;
  let gonfle = 0;
  let y = 0;
  if (m.gel > 0) sy = 1 + Math.sin(temps * 30) * 0.06;
  else if (m.etat === ANNONCE_PLONGEON) {
    gonfle = lisser(0, 1, m.t / Math.max(1, annonce));
    sy = 1 - 0.1 * gonfle;
  } else if (m.etat === REPOS) {
    sy = 1 - 0.18 * Math.exp(-m.t / 8) * Math.cos(m.t * 0.5);
  } else y = Math.abs(Math.sin(temps * 6 + m.age)) * 0.05;
  const ap = bornes((tick - m.age) / 16, 0, 1);
  return { sy, y, tremble: gonfle > 0.8 ? Math.sin(temps * 70) * 0.03 : 0, pop: ap < 1 ? sortie(ap) : 1, gonfle };
}
/** La hauteur de l'orbe du chaman et sa taille : elle flotte, et palpite au pulse de l'aura (`t` : les ticks depuis le dernier). */
export function orbeDuChaman(m: Pick<Monstre, "t">, temps: number, pas: number): { y: number; r: number } {
  const u = bornes(m.t / Math.max(1, pas), 0, 1);
  const pulse = u < 0.2 ? Math.sin((u / 0.2) * Math.PI) : 0;
  return { y: 1.72 + Math.sin(temps * 3 + m.t * 0.01) * 0.06, r: 0.13 + pulse * 0.1 };
}

/** Les couleurs d'une pose : le facteur de lumière d'un élite (un peu plus chaud) et l'éclair d'un coup. */
const CHAUD = new Color(1.18, 1.05, 0.82);

export interface OptionsTas {
  elite: boolean;
}

/** Combien de monstres de chaque type un tas porte au plus (au-delà, les plus loin ne sont pas dessinés). */
export const MAX_PAR_TYPE = { gelee: 64, gelaton: 96, chauve: 48, cracheur: 40, chaman: 24, totem: 12, pb: 32, elites: 24, bulles: 64, lueurs: 48 } as const;

/**
 * L'ensemble des tas de monstres, du rendu d'une image : `debut()`, un `poser` par monstre vu (et ses pièces), `fin()`. Il dessine aussi les couronnes et les halos des élites, les bulles et les traits du chaman, les projectiles et les lueurs.
 */
export class MonstresVus {
  readonly groupe = new Group();
  private readonly gelee = new Tas(formeGelee(), MAX_PAR_TYPE.gelee);
  private readonly gelaton = new Tas(fusionner([placer(GEO.geleeD.clone(), { s: [1.5, 1.2, 1.5] }), ...paireDYeux(0.23, 0.39, 0.56, 0.1)]), MAX_PAR_TYPE.gelaton);
  private readonly chauve = new Tas(formeChauve(), MAX_PAR_TYPE.chauve);
  private readonly aileG = new Tas(GEO.aileG, MAX_PAR_TYPE.chauve);
  private readonly aileD = new Tas(GEO.aileD, MAX_PAR_TYPE.chauve);
  private readonly yeuxChauve: Tas;
  private readonly cracheur = new Tas(formeCracheur(), MAX_PAR_TYPE.cracheur);
  private readonly chaman = new Tas(formeChaman(), MAX_PAR_TYPE.chaman);
  private readonly totem = new Tas(formeTotem(), MAX_PAR_TYPE.totem);
  private readonly pb = new Tas(formePorteBouclier(), MAX_PAR_TYPE.pb);
  private readonly bouclier = new Tas(formeBouclierPB(), MAX_PAR_TYPE.pb);
  private readonly couronnes = new Tas(formeCouronne(), MAX_PAR_TYPE.elites, { coque: false, ombre: false });
  private readonly halos: Tas;
  private readonly bulles: Tas;
  private readonly lueurs: Tas;
  private readonly liens: LineSegments;
  private readonly liensPos: Float32Array;
  private nLiens = 0;
  private readonly tous: Tas[];
  // Les matrices de travail.
  private readonly base = new Matrix4();
  private readonly loc = new Matrix4();
  private readonly mat = new Matrix4();
  private readonly q = new Quaternion();
  private readonly qy = new Quaternion();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly axeY = new Vector3(0, 1, 0);
  private readonly axeX = new Vector3(1, 0, 0);
  private readonly axeZ = new Vector3(0, 0, 1);
  private readonly c = new Color();

  constructor() {
    const yeux = new MeshBasicMaterial({ vertexColors: true });
    this.yeuxChauve = new Tas(formeYeuxChauve(), MAX_PAR_TYPE.chauve, { matiere: yeux, coque: false, ombre: false });
    const lueur = new MeshBasicMaterial({ fog: false });
    this.lueurs = new Tas(formeLueur(), MAX_PAR_TYPE.lueurs, { matiere: lueur, coque: false, ombre: false });
    const halo = new RingGeometry(0.82, 1, 28);
    halo.rotateX(-Math.PI / 2);
    this.halos = new Tas(halo, MAX_PAR_TYPE.elites, { matiere: new MeshBasicMaterial({ color: COULEURS.elite, transparent: true, opacity: 0.85, depthWrite: false, side: DoubleSide, fog: false }), coque: false, ombre: false, ordre: 2 });
    this.bulles = new Tas(new SphereGeometry(1, 14, 10), MAX_PAR_TYPE.bulles, { matiere: new MeshBasicMaterial({ color: COULEURS.bulle, transparent: true, opacity: 0.26, depthWrite: false, fog: false }), coque: false, ombre: false, ordre: 3 });
    this.liensPos = new Float32Array(MAX_PAR_TYPE.bulles * 6);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(this.liensPos, 3).setUsage(DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.liens = new LineSegments(g, new LineBasicMaterial({ color: COULEURS.bulle, transparent: true, opacity: 0.8, fog: false }));
    this.liens.frustumCulled = false;
    this.liens.renderOrder = 3;
    this.tous = [this.gelee, this.gelaton, this.chauve, this.aileG, this.aileD, this.yeuxChauve, this.cracheur, this.chaman, this.totem, this.pb, this.bouclier, this.couronnes, this.halos, this.bulles, this.lueurs];
    for (const t of this.tous) {
      this.groupe.add(t.corps);
      if (t.coque) this.groupe.add(t.coque);
    }
    this.groupe.add(this.liens);
  }

  debut(): void {
    for (const t of this.tous) t.debut();
    this.nLiens = 0;
  }
  /** Termine l'image : les tas prennent leurs nouveaux comptes, les traits du chaman leurs sommets. */
  fin(): void {
    for (const t of this.tous) t.fin();
    const a = this.liens.geometry.getAttribute("position");
    a.needsUpdate = true;
    this.liens.geometry.setDrawRange(0, this.nLiens * 2);
  }

  /** Compose `fin` = base × (translation, rotation, échelle locales). */
  private partie(tas: Tas, x: number, y: number, z: number, ry: number, rx: number, rz: number, sx: number, sy: number, sz: number, eclair: number, couleur?: Color): void {
    this.p.set(x, y, z);
    this.q.setFromAxisAngle(this.axeY, ry);
    if (rx !== 0) this.q.multiply(this.qy.setFromAxisAngle(this.axeX, rx));
    if (rz !== 0) this.q.multiply(this.qy.setFromAxisAngle(this.axeZ, rz));
    this.s.set(sx, sy, sz);
    this.loc.compose(this.p, this.q, this.s);
    this.mat.multiplyMatrices(this.base, this.loc);
    tas.poser(this.mat, eclair, couleur);
  }

  /**
   * Pose un monstre : (mx, mz) en mètres, `yaw` où il regarde, `eclair` (0 à 1) l'éclair d'un coup, `ecrase` l'écrasement sous un coup, `r` le facteur de taille (un élite : 1,5). Rend la hauteur de son ombre (la chauve-souris vole).
   */
  poserMonstre(m: Monstre, partie: Partie, mx: number, mz: number, yaw: number, eclair: number, ecrase: number, temps: number): void {
    const taille = m.elite === 1 ? partie.reglages.eliteTaille / 100 : 1;
    const d = partie.dureesDe(m);
    const tick = partie.tick;
    this.q.setFromAxisAngle(this.axeY, yaw);
    const couleur = m.elite === 1 ? this.c.copy(CHAUD).multiplyScalar(1 + eclair * 2.2) : undefined;
    const e = eclair;
    switch (m.type) {
      case GELEE: {
        const a = attitudeGelee(m, temps, tick, d);
        const k = taille * a.pop;
        const sy = a.sy * (1 - ecrase);
        const l = (k / Math.sqrt(sy)) * (1 + ecrase * 0.55);
        this.baseEn(mx + a.tremble, a.y, mz, yaw, 1);
        this.partie(this.gelee, 0, 0, 0, 0, 0, 0, l, k * sy, l, e, couleur);
        break;
      }
      case GELATON: {
        const a = attitudeGelaton(m, temps, tick, d);
        const k = 0.62 * taille * a.pop;
        const sy = a.sy * (1 - ecrase);
        const l = (k / Math.sqrt(sy)) * (1 + ecrase * 0.55);
        this.baseEn(mx + a.tremble, a.y, mz, yaw, 1);
        this.partie(this.gelaton, 0, 0, 0, 0, 0, 0, l, k * sy, l, e, couleur);
        break;
      }
      case CHAUVE: {
        const bat = temps * (m.etat === PLONGEON ? 6 : 17) + ((m.id * 0.37) % 7) * 5;
        let volet = Math.sin(bat) * 0.8;
        let tangage = 0;
        let hauteur = 1.25 + Math.sin(temps * 3 + m.id) * 0.1;
        let echelle = 1.1;
        let tremble = 0;
        if (m.etat === ANNONCE_PLONGEON) {
          tremble = Math.sin(temps * 70) * 0.05;
          echelle = 1.1 * (1 + 0.18 * Math.min(1, m.t / (d.chauveAnnonce * 0.4)));
          volet = Math.sin(bat * 1.5) * 1.05;
          hauteur += 0.18;
        } else if (m.etat === PLONGEON) {
          volet = 1.2;
          tangage = 0.6;
          hauteur = 1.25 - 0.55 * Math.sin(Math.PI * Math.min(1, m.t / d.chauvePlongeon));
        } else if (m.etat === REPOS) {
          volet = Math.sin(temps * 9) * 0.5;
          tangage = Math.sin(temps * 6) * 0.25;
          hauteur -= 0.25;
        }
        const ap = bornes((tick - m.age) / 14, 0, 1);
        const k = taille * echelle * sortie(ap);
        this.baseEn(mx, hauteur * taille, mz, yaw, 1);
        // le corps, ses yeux (rougis à l'annonce) et les deux ailes autour de l'épaule
        this.partie(this.chauve, tremble, 0, 0, 0, tangage, 0, k, k, k, e, couleur);
        const rouge = m.etat === ANNONCE_PLONGEON ? this.c.set(COULEURS.danger).multiplyScalar(1.2) : undefined;
        this.partie(this.yeuxChauve, tremble, 0, 0, 0, tangage, 0, k, k * (m.etat === ANNONCE_PLONGEON ? 1 : 1 - clignote(temps, m.id) * 0.9), k, 0, rouge);
        this.pivotAile(this.aileG, -1, volet, k, tremble, tangage, e, couleur);
        this.pivotAile(this.aileD, 1, volet, k, tremble, tangage, e, couleur);
        break;
      }
      case CRACHEUR: {
        const a = attitudeCracheur(m, temps, tick, CRACHE_ANNONCE);
        const k = taille * a.pop;
        const sy = a.sy * (1 - ecrase);
        const l = (1 + a.gonfle * 0.3) * (1 + ecrase * 0.55);
        this.baseEn(mx + a.tremble, a.y, mz, yaw, 1);
        this.partie(this.cracheur, 0, 0, 0, 0, 0, 0, k * l, k * sy * (1 + a.gonfle * 0.12), k * l * (1 + a.gonfle * 0.2), e, couleur);
        break;
      }
      case CHAMAN: {
        const ap = bornes((tick - m.age) / 16, 0, 1);
        const k = taille * sortie(ap) * (1 - ecrase * 0.4);
        const fuite = m.gel > 0 ? Math.sin(temps * 30) * 0.05 : Math.abs(Math.sin(temps * 5 + m.id)) * 0.04;
        this.baseEn(mx, fuite, mz, yaw, 1);
        this.partie(this.chaman, 0, 0, 0, 0, 0, 0, k, k * (1 + ecrase * 0.3), k, e, couleur);
        const o = orbeDuChaman(m, temps, 40);
        // l'orbe suit le bâton (à 0,44 m à droite, 0,12 m devant)
        this.orbe(mx, o.y * taille + fuite, mz, yaw, 0.44 * taille, 0.12 * taille, o.r * taille * sortie(ap), COULEURS.orbe, 1.5);
        break;
      }
      case TOTEM: {
        const ap = bornes((tick - m.age) / 18, 0, 1);
        const k = taille * (ap < 1 ? sortie(ap) : 1);
        const annonce = m.etat === ANNONCE_PLONGEON ? lisser(0, 1, (m.t - (TOTEM_PERIODE - TOTEM_ANNONCE)) / TOTEM_ANNONCE) : 0;
        const tremble = annonce > 0.5 ? Math.sin(temps * 90) * 0.015 : 0;
        this.baseEn(mx + tremble, 0, mz, yaw, 1);
        this.partie(this.totem, 0, 0, 0, 0, 0, 0, k, k * (1 - ecrase * 0.12), k, e, couleur);
        // la lueur violette au sommet : couvée au repos, vive pendant l'annonce de la naissance
        this.orbe(mx, 2.45 * taille, mz, yaw, 0, 0, taille * (0.17 + annonce * 0.22) * k, COULEURS.invocation, 1.2 + annonce * 1.4);
        break;
      }
      case PORTE_BOUCLIER: {
        const ap = bornes((tick - m.age) / 18, 0, 1);
        const k = taille * sortie(ap) * (1 - ecrase * 0.2);
        const ouvert = m.vuln > 0 || m.etourdi > 0;
        // le corps regarde le chevalier, le bouclier là où la simulation le tient (`face`)
        const yf = Math.PI / 2 - (m.face * Math.PI * 2) / 128;
        const marche = m.etat === 0 && m.gel === 0 ? Math.abs(Math.sin(temps * 4 + m.id)) * 0.05 : 0;
        // le coup de bouclier : le bouclier recule (anticipation) puis claque vers l'avant
        let avance = 0.8;
        if (m.etat === ANNONCE_PLONGEON) {
          const u = bornes(m.t / Math.max(1, PB_ANNONCE), 0, 1);
          avance = u < 0.75 ? lerp(0.8, 0.35, lisser(0, 0.75, u)) : lerp(0.35, 1.25, lisser(0.75, 1, u));
        }
        const baisse = ouvert ? bornes(m.vuln / Math.max(1, PB_OUVERT), 0, 1) : 0;
        this.baseEn(mx, marche, mz, yaw + (ouvert ? Math.sin(temps * 9) * 0.06 : 0), 1);
        this.partie(this.pb, 0, 0, 0, 0, ouvert ? 0.18 : 0, 0, k, k, k, e, couleur);
        // (le bouclier est posé en repère du monde : il suit `face`, pas le corps)
        this.baseEn(mx, marche, mz, yf, 1);
        this.partie(this.bouclier, 0, (0.95 - baisse * 0.35) * k, avance * k, 0, baisse * 1.0, 0, k, k, k, e, couleur);
        break;
      }
    }
    if (m.elite === 1) this.marquerElite(m, mx, mz, taille, temps, partie);
    if (m.prot > 0) this.bulle(m, mx, mz, taille, partie, temps);
  }

  /** La base d'un monstre : (x, y, z), tourné de `yaw`, à l'échelle `s`. */
  private baseEn(x: number, y: number, z: number, yaw: number, s: number): void {
    this.p.set(x, y, z);
    this.q.setFromAxisAngle(this.axeY, yaw);
    this.s.set(s, s, s);
    this.base.compose(this.p, this.q, this.s);
  }

  private pivotAile(tas: Tas, cote: -1 | 1, volet: number, k: number, tremble: number, tangage: number, eclair: number, couleur?: Color): void {
    // l'épaule est à 0,22 m du centre ; l'aile tourne autour de z ; le tout suit le tangage du corps
    this.p.set(tremble + cote * 0.22 * k, 0.05 * k, 0);
    this.q.setFromAxisAngle(this.axeX, tangage);
    this.qy.setFromAxisAngle(this.axeZ, cote * -volet);
    this.q.multiply(this.qy);
    this.s.set(k, k, k);
    this.loc.compose(this.p, this.q, this.s);
    this.mat.multiplyMatrices(this.base, this.loc);
    tas.poser(this.mat, eclair, couleur);
  }

  /** Une lueur (l'orbe du chaman, le sommet du totem, un projectile) : une sphère unie en (x, y, z) monde, décalée de (dx, dz) dans le repère du corps. */
  private orbe(mx: number, y: number, mz: number, yaw: number, dx: number, dz: number, rayon: number, couleur: number, intensite: number): void {
    const sx = Math.sin(yaw);
    const cz = Math.cos(yaw);
    this.p.set(mx + dx * cz + dz * sx, y, mz - dx * sx + dz * cz);
    this.q.identity();
    this.s.set(rayon, rayon, rayon);
    this.mat.compose(this.p, this.q, this.s);
    this.lueurs.poser(this.mat, 0, this.c.set(couleur).multiplyScalar(intensite));
  }

  /** Une couronne d'or au-dessus de l'élite et un halo d'or sous ses pieds. */
  private marquerElite(m: Monstre, mx: number, mz: number, taille: number, temps: number, partie: Partie): void {
    const haut = (m.type === CHAUVE ? 1.25 + 0.7 : m.type === TOTEM ? 2.7 : m.type === CHAMAN ? 1.9 : m.type === PORTE_BOUCLIER ? 2.2 : m.type === CRACHEUR ? 1.2 : 0.9) * taille + (m.type === CHAUVE ? 0 : 0.1);
    this.p.set(mx, haut + Math.sin(temps * 3 + m.id) * 0.05, mz);
    this.q.setFromAxisAngle(this.axeY, temps * 1.2);
    this.s.setScalar(taille);
    this.mat.compose(this.p, this.q, this.s);
    this.couronnes.poser(this.mat, 0, this.c.set(0xffffff).multiplyScalar(1.4));
    if (m.type === CHAUVE) return;
    const r = (partie.rayonM(m) / 4096) * 1.5 + 0.1 + Math.sin(temps * 4 + m.id) * 0.03;
    this.p.set(mx, 0.04, mz);
    this.q.identity();
    this.s.set(r, 1, r);
    this.mat.compose(this.p, this.q, this.s);
    this.halos.poser(this.mat);
  }

  /** Le bouclier du chaman : une bulle claire autour de l'allié protégé, et un trait jusqu'au chaman (`lien`) quand il est vu. */
  private bulle(m: Monstre, mx: number, mz: number, taille: number, partie: Partie, temps: number): void {
    const r = (partie.rayonM(m) / 4096) * 1.35 + 0.18;
    const haut = m.type === CHAUVE ? 1.25 : m.type === PORTE_BOUCLIER ? 1.0 : m.type === TOTEM ? 1.1 : 0.5;
    this.p.set(mx, haut * taille, mz);
    this.q.identity();
    const pulse = 1 + Math.sin(temps * 7 + m.id) * 0.04;
    this.s.set(r * pulse, r * pulse * (m.type === TOTEM || m.type === CHAMAN ? 1.8 : 1.1), r * pulse);
    this.mat.compose(this.p, this.q, this.s);
    this.bulles.poser(this.mat);
    // le lien : du centre de la bulle à l'orbe du chaman, s'il est dans la partie
    if (this.nLiens < MAX_PAR_TYPE.bulles && m.lien > 0) {
      const ch = this.chamans?.get(m.lien);
      if (ch) {
        const o = this.nLiens * 6;
        this.liensPos[o] = mx;
        this.liensPos[o + 1] = haut * taille;
        this.liensPos[o + 2] = mz;
        this.liensPos[o + 3] = ch.x;
        this.liensPos[o + 4] = 1.7;
        this.liensPos[o + 5] = ch.z;
        this.nLiens++;
      }
    }
  }
  /** Où sont les chamans de l'image (identifiant → position en mètres), rempli par l'appelant avant les poses. */
  chamans: Map<number, { x: number; z: number }> | null = null;

  /** Un projectile de cracheur : une boule orange vive à hauteur de poitrine, qui palpite. */
  poserProjectile(q: Projectile, mx: number, mz: number, temps: number): void {
    const r = (q.elite === 1 ? 0.3 : 0.2) * (1 + Math.sin(temps * 24 + q.id) * 0.1);
    this.orbe(mx, 0.75, mz, 0, 0, 0, r, COULEURS.projectile, 1.5);
  }

  detruire(): void {
    for (const t of this.tous) t.detruire();
    this.liens.geometry.dispose();
    (this.liens.material as Material).dispose();
  }
}

/** Le clignement d'une chauve-souris : 0 (ouvert) à 1 (fermé), toutes les ~3 s, décalé par `graine`. */
function clignote(temps: number, graine: number): number {
  const t = (temps + graine * 1.7) % 3.1;
  return t < 0.12 ? Math.sin((t / 0.12) * Math.PI) : 0;
}


// --- `?scenario=bestiaire-monstres` (lot BR6) : la caméra fixe et les étiquettes --------------------------------------------------------------------------------------------------------------------------------
/** La largeur à garder dans l'image (mètres) : sept monstres espacés de 1,9 m, leurs bras et leurs halos. */
const LARGEUR_BESTIAIRE_MONSTRES = 19.5;
/** La caméra du bestiaire des monstres : la plongée du jeu, assez loin pour que les sept tiennent dans la largeur de l'écran. Pure. */
export function cameraDuBestiaireMonstres(aspect: number): { distance: number; regard: [number, number, number]; position: [number, number, number] } {
  const phi = (CAMERA_DEFAUT.angle * Math.PI) / 180;
  const demi = Math.tan((CAMERA_DEFAUT.champ * Math.PI) / 360);
  const distance = Math.max(CAMERA_DEFAUT.distance * 0.6, LARGEUR_BESTIAIRE_MONSTRES / 2 / (demi * Math.max(0.3, aspect)));
  const regard: [number, number, number] = [0, 0.8, -1.4];
  return { distance, regard, position: [regard[0], regard[1] + Math.sin(phi) * distance, regard[2] + Math.cos(phi) * distance] };
}

/** Le nom de chaque monstre écrit sous lui (les deux rangées : le monstre, puis son élite). */
export function etiquettesDuBestiaire(hote: HTMLElement, t: (cle: string) => string): { maj(partie: Partie, camera: PerspectiveCamera, zone: { width: number; height: number }): void; detruire(): void } {
  const liste = new Map<number, HTMLElement>();
  const p = new Vector3();
  return {
    maj(partie, camera, zone) {
      for (const m of partie.monstres) {
        let e = liste.get(m.id);
        if (!e) {
          e = document.createElement("div");
          e.className = "rush-etiquette";
          e.dataset.monstre = MONSTRES_IDS[m.type] ?? "";
          e.textContent = t(`monstre.nom.${MONSTRES_IDS[m.type] ?? "gelee"}`) + (m.elite === 1 ? ` · ${t("monstre.elite")}` : "");
          hote.append(e);
          liste.set(m.id, e);
        }
        p.set(m.x / 4096, 0, m.y / 4096 + 0.9).project(camera);
        e.style.transform = `translate(${((p.x + 1) / 2) * zone.width}px, ${((1 - p.y) / 2) * zone.height}px) translate(-50%, 0)`;
      }
    },
    detruire() {
      for (const e of liste.values()) e.remove();
    },
  };
}
