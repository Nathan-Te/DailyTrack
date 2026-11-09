import { CylinderGeometry, DynamicDrawUsage, Group, InstancedMesh, LatheGeometry, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector2, Vector3, type BufferGeometry, type MeshToonMaterial, type ShaderMaterial } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { M } from "@cdj/rush-sim/constantes";
import { NB_GENRES_VASE } from "@cdj/rush-sim/niveau";
import type { VaseVivant } from "@cdj/rush-sim";
import { CALQUE_COQUE, coqueInstanciee, lisse, plat } from "./cel";
import { forme } from "./acteurs";
import { fusionner, placer, teindre } from "./formes";
import { MODELE_VASE, modele } from "./modeles";
import type { GenreEclat } from "./effets";

// Les VASES (lot BR5), **en mètres** : des jarres, des tonneaux et de petites caisses posés en groupes de 4 à 12, qui cèdent d'un coup. **DA figée : des formes simples** (une jarre de terre cuite à col étroit, un tonneau cerclé, une petite caisse à lattes).
// Trois tas instanciés (un par genre) : quelques appels de dessin pour des dizaines de vases. Quand l'un est brisé, ses voisins (à ~1,2 m) sursautent d'un petit coup et retombent : c'est le « retour » de la sensation, jamais lu par la simulation.
// Lot BR-A1 : les vases sont des MODÈLES (`modeles.ts` : jarre, tonneau, caisse) et chacun a ses ÉCLATS modélisés (`eclat_1` … `eclat_4`, chacun à sa place sur le vase) : à la casse, ils jaillissent de leur place vers
// l'extérieur, tournoient, rebondissent et s'enfoncent (`EclatsDeVases`, un tas instancié par forme d'éclat, éteint quand il est vide). Sans modèle, la forme procédurale et les seuls éclats en particules.

const TERRE = 0xc9733e;
const TERRE_CLAIRE = 0xe7a468;
const TERRE_SOMBRE = 0x8f4a25;
const BOIS = 0xb07a43;
const BOIS_CLAIR = 0xd9a65f;
const CERCLE = 0x3b2a1d;
const MAX_PAR_GENRE = 128;

/** Les éclats de chaque genre (jarre : de la terre cuite ; tonneau et caisse : du bois). */
export const ECLATS_VASE: readonly GenreEclat[] = ["jarre", "bois", "planche"];
/** La hauteur (m) de chaque genre : la caméra et les captures la lisent. */
export const HAUTEUR_VASE: readonly number[] = [0.82, 0.8, 0.6];

function jarre(): BufferGeometry {
  return fusionner([
    teindre(placer(new SphereGeometry(0.3, 14, 10), { y: 0.3, s: [1, 0.95, 1] }), TERRE),
    teindre(placer(new CylinderGeometry(0.31, 0.31, 0.07, 14), { y: 0.36 }), TERRE_CLAIRE),
    teindre(placer(new CylinderGeometry(0.12, 0.17, 0.2, 10), { y: 0.66 }), TERRE),
    teindre(placer(new CylinderGeometry(0.18, 0.15, 0.06, 10), { y: 0.79 }), TERRE_SOMBRE),
  ]);
}
function tonneau(): BufferGeometry {
  const profil = [new Vector2(0.001, 0), new Vector2(0.27, 0), new Vector2(0.35, 0.2), new Vector2(0.38, 0.4), new Vector2(0.35, 0.6), new Vector2(0.27, 0.8), new Vector2(0.001, 0.8)];
  return fusionner([
    teindre(new LatheGeometry(profil, 14), BOIS),
    teindre(placer(new TorusGeometry(0.355, 0.03, 4, 14), { y: 0.2, rx: Math.PI / 2 }), CERCLE),
    teindre(placer(new TorusGeometry(0.355, 0.03, 4, 14), { y: 0.6, rx: Math.PI / 2 }), CERCLE),
  ]);
}
function caisse(): BufferGeometry {
  return fusionner([
    teindre(placer(new RoundedBoxGeometry(0.6, 0.56, 0.6, 2, 0.05), { y: 0.28 }), BOIS_CLAIR),
    teindre(placer(new RoundedBoxGeometry(0.64, 0.07, 0.64, 1, 0.02), { y: 0.1 }), TERRE_SOMBRE),
    teindre(placer(new RoundedBoxGeometry(0.64, 0.07, 0.64, 1, 0.02), { y: 0.46 }), TERRE_SOMBRE),
  ]);
}

export interface VasesVus {
  groupe: Group;
  /** Chaque image : pose les vases encore debout (les autres disparaissent), avec le rebond des voisins d'un vase brisé. */
  maj(vivants: readonly VaseVivant[], temps: number): void;
  /** Un vase vient de céder en (x, z) mètres : ses voisins à ~1,2 m sautent d'un petit coup, de plus en plus tard avec la distance. */
  secouer(x: number, z: number, temps: number): void;
  /** Lot BR-A1 : un vase de `genre` cède en (x, z) mètres, frappé vers (dx, dz) : ses éclats modélisés jaillissent. Rend `false` sans modèle (les particules seules). */
  briser(genre: number, x: number, z: number, dx: number, dz: number, temps: number): boolean;
  /** Le nombre d'éclats modélisés en vol (essais). */
  eclatsEnVol(): number;
  /** Le nombre d'instances posées par genre à la dernière image. */
  compte(): readonly number[];
  detruire(): void;
}

export function monterVases(): VasesVus {
  const groupe = new Group();
  const formes = [forme("jarre", "corps", jarre), forme("tonneau", "corps", tonneau), forme("caisse", "corps", caisse)];
  const debris = new EclatsDeVases();
  groupe.add(debris.groupe);
  const matieres: MeshToonMaterial[] = [];
  const coques: ShaderMaterial[] = [];
  const corps: InstancedMesh[] = [];
  const peaux: InstancedMesh[] = [];
  for (let g = 0; g < NB_GENRES_VASE; g++) {
    const matiere = plat(0xffffff, true);
    matieres.push(matiere);
    const c = new InstancedMesh(formes[g]!, matiere, MAX_PAR_GENRE);
    c.castShadow = true;
    c.receiveShadow = false;
    c.instanceMatrix.setUsage(DynamicDrawUsage);
    c.frustumCulled = false;
    c.count = 0;
    const coque = coqueInstanciee();
    coques.push(coque);
    const peau = new InstancedMesh(lisse(formes[g]!), coque, MAX_PAR_GENRE);
    peau.layers.set(CALQUE_COQUE);
    peau.instanceMatrix.setUsage(DynamicDrawUsage);
    peau.frustumCulled = false;
    peau.count = 0;
    corps.push(c);
    peaux.push(peau);
    groupe.add(c, peau);
  }
  /** Le début (secondes du jeu) du dernier sursaut de chaque vase, par identifiant. */
  const sursauts = new Map<number, number>();
  let derniers: readonly VaseVivant[] = [];
  const compte = [0, 0, 0];
  const m = new Matrix4();
  const q = new Quaternion();
  const p = new Vector3();
  const s = new Vector3(1, 1, 1);
  const axe = new Vector3(0, 1, 0);
  const axeX = new Vector3(1, 0, 0);
  const q2 = new Quaternion();
  return {
    groupe,
    maj(vivants, temps) {
      debris.maj(temps);
      derniers = vivants;
      compte.fill(0);
      for (const v of vivants) {
        if (v.id < 0) continue;
        const g = v.genre;
        const i = compte[g]!++;
        if (i >= MAX_PAR_GENRE) continue;
        let haut = 0;
        let incline = 0;
        const debut = sursauts.get(v.id);
        if (debut !== undefined) {
          const u = (temps - debut) / 0.34;
          if (u >= 1) sursauts.delete(v.id);
          else if (u > 0) {
            haut = Math.sin(u * Math.PI) * 0.2;
            incline = Math.sin(u * Math.PI * 2) * 0.16;
          }
        }
        q.setFromAxisAngle(axe, (v.id * 2.399) % (Math.PI * 2));
        q2.setFromAxisAngle(axeX, incline);
        q.multiply(q2);
        m.compose(p.set(v.x / M, haut, v.y / M), q, s);
        corps[g]!.setMatrixAt(i, m);
        peaux[g]!.setMatrixAt(i, m);
      }
      for (let g = 0; g < NB_GENRES_VASE; g++) {
        const n = Math.min(MAX_PAR_GENRE, compte[g]!);
        corps[g]!.count = peaux[g]!.count = n;
        corps[g]!.instanceMatrix.needsUpdate = peaux[g]!.instanceMatrix.needsUpdate = true;
      }
    },
    secouer(x, z, temps) {
      for (const v of derniers) {
        if (v.id < 0) continue;
        const d = Math.hypot(v.x / M - x, v.y / M - z);
        if (d < 0.05 || d > 1.3) continue;
        sursauts.set(v.id, temps + d * 0.06);
      }
    },
    briser: (genre, x, z, dx, dz, temps) => debris.lancer(genre, x, z, dx, dz, temps),
    eclatsEnVol: () => debris.enVol(),
    compte: () => compte,
    detruire() {
      debris.detruire();
      for (const f of formes) f.dispose();
      for (const x of [...matieres, ...coques]) x.dispose();
    },
  };
}

// --- Les éclats modélisés (lot BR-A1) ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** Le nombre d'éclats en vol au plus, par forme d'éclat (genre × numéro). */
const MAX_ECLATS_PAR_FORME = 24;
/** La vie d'un éclat (s), la gravité (m/s²). */
const VIE_ECLAT = 1.5;
const GRAVITE_ECLAT = 15;

interface EclatVole {
  forme: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** L'axe et la vitesse de rotation (rad/s), l'orientation courante. */
  axe: Vector3;
  vrot: number;
  q: Quaternion;
  debut: number;
  rebonds: number;
}

/** Les éclats des vases brisés : chaque forme d'éclat est un tas instancié, éteint quand il est vide. Une pure sensation : la simulation n'en sait rien. */
export class EclatsDeVases {
  readonly groupe = new Group();
  /** Pour chaque forme : son genre de vase, sa place sur le vase (m), son tas et sa coque. */
  private readonly formes: { genre: number; place: Vector3; corps: InstancedMesh; coque: InstancedMesh }[] = [];
  private readonly vols: EclatVole[] = [];
  private dernier = -1;
  private readonly matiere = plat(0xffffff, true);
  private readonly coque = coqueInstanciee();
  private readonly m = new Matrix4();
  private readonly s = new Vector3();
  private readonly p = new Vector3();
  private readonly dq = new Quaternion();
  private graine = 1;

  constructor() {
    MODELE_VASE.forEach((nom, genre) => {
      const md = modele(nom);
      if (!md) return;
      for (const [cle, pc] of md.pieces) {
        if (!cle.startsWith("eclat_")) continue;
        const corps = new InstancedMesh(pc.geo, this.matiere, MAX_ECLATS_PAR_FORME);
        corps.castShadow = true;
        corps.instanceMatrix.setUsage(DynamicDrawUsage);
        corps.frustumCulled = false;
        corps.count = 0;
        corps.visible = false;
        const coque = new InstancedMesh(lisse(pc.geo), this.coque, MAX_ECLATS_PAR_FORME);
        coque.layers.set(CALQUE_COQUE);
        coque.instanceMatrix.setUsage(DynamicDrawUsage);
        coque.frustumCulled = false;
        coque.count = 0;
        coque.visible = false;
        this.formes.push({ genre, place: new Vector3(pc.pivot[0], pc.pivot[1], pc.pivot[2]), corps, coque });
        this.groupe.add(corps, coque);
      }
    });
  }
  /** Un nombre de 0 à 1 (le hasard des éclats : une suite fixe, jamais lue par la simulation). */
  private hasard(): number {
    this.graine = (Math.imul(this.graine, 1103515245) + 12345) >>> 0;
    return (this.graine >>> 8) / 16777216;
  }
  /** Lance les éclats d'un vase de `genre` brisé en (x, z), frappé vers (dx, dz). Rend `false` s'il n'a pas d'éclats modélisés. */
  lancer(genre: number, x: number, z: number, dx: number, dz: number, temps: number): boolean {
    let lance = false;
    const yaw = this.hasard() * Math.PI * 2;
    const c = Math.cos(yaw);
    const sn = Math.sin(yaw);
    this.formes.forEach((f, i) => {
      if (f.genre !== genre) return;
      lance = true;
      // la place de l'éclat sur le vase, tournée d'un angle au hasard ; il part vers l'extérieur, un peu dans le sens du coup, et monte
      const px = f.place.x * c + f.place.z * sn;
      const pz = -f.place.x * sn + f.place.z * c;
      const l = Math.hypot(px, pz) || 1;
      const v = 2.2 + this.hasard() * 2.2;
      const axe = new Vector3(this.hasard() - 0.5, this.hasard() - 0.5, this.hasard() - 0.5).normalize();
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
      this.vols.push({ forme: i, x: x + px, y: f.place.y, z: z + pz, vx: (px / l) * v + dx * 2.2, vy: 2.6 + this.hasard() * 2.4, vz: (pz / l) * v + dz * 2.2, axe, vrot: 6 + this.hasard() * 8, q, debut: temps, rebonds: 0 });
    });
    const max = MAX_ECLATS_PAR_FORME * Math.max(1, this.formes.length);
    if (this.vols.length > max) this.vols.splice(0, this.vols.length - max);
    return lance;
  }
  /** Chaque image : les éclats tombent, tournoient, rebondissent, puis rapetissent et s'enfoncent sur la fin. */
  maj(temps: number): void {
    const dt = this.dernier < 0 ? 0 : Math.min(0.05, Math.max(0, temps - this.dernier));
    this.dernier = temps;
    for (const f of this.formes) f.corps.count = f.coque.count = 0;
    let w = 0;
    for (const e of this.vols) {
      const age = temps - e.debut;
      if (age > VIE_ECLAT || age < 0) continue;
      this.vols[w++] = e;
      if (e.rebonds < 2) {
        e.vy -= GRAVITE_ECLAT * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.z += e.vz * dt;
        if (e.y < 0.03) {
          e.y = 0.03;
          e.rebonds++;
          e.vy = e.rebonds < 2 ? -e.vy * 0.32 : 0;
          e.vx *= 0.45;
          e.vz *= 0.45;
          e.vrot *= 0.4;
        }
        e.q.premultiply(this.dq.setFromAxisAngle(e.axe, e.vrot * dt));
      }
      const fin = Math.min(1, Math.max(0, (age - (VIE_ECLAT - 0.35)) / 0.35));
      const k = 1 - fin;
      const f = this.formes[e.forme]!;
      if (f.corps.count >= MAX_ECLATS_PAR_FORME) continue;
      this.m.compose(this.p.set(e.x, e.y - fin * 0.08, e.z), e.q, this.s.set(k, k, k));
      f.corps.setMatrixAt(f.corps.count++, this.m);
      f.coque.setMatrixAt(f.coque.count++, this.m);
    }
    this.vols.length = w;
    for (const f of this.formes) {
      f.corps.visible = f.coque.visible = f.corps.count > 0;
      f.corps.instanceMatrix.needsUpdate = f.coque.instanceMatrix.needsUpdate = true;
    }
  }
  /** Le nombre d'éclats en vol. */
  enVol(): number {
    return this.vols.length;
  }
  detruire(): void {
    this.matiere.dispose();
    this.coque.dispose();
  }
}
