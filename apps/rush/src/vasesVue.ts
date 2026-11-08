import { CylinderGeometry, DynamicDrawUsage, Group, InstancedMesh, LatheGeometry, Matrix4, Quaternion, SphereGeometry, TorusGeometry, Vector2, Vector3, type BufferGeometry, type MeshToonMaterial, type ShaderMaterial } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { M } from "@cdj/rush-sim/constantes";
import { NB_GENRES_VASE } from "@cdj/rush-sim/niveau";
import type { VaseVivant } from "@cdj/rush-sim";
import { CALQUE_COQUE, coqueInstanciee, lisse, plat } from "./cel";
import { fusionner, placer, teindre } from "./formes";
import type { GenreEclat } from "./effets";

// Les VASES (lot BR5), **en mètres** : des jarres, des tonneaux et de petites caisses posés en groupes de 4 à 12, qui cèdent d'un coup. **DA figée : des formes simples** (une jarre de terre cuite à col étroit, un tonneau cerclé, une petite caisse à lattes).
// Trois tas instanciés (un par genre) : quelques appels de dessin pour des dizaines de vases. Quand l'un est brisé, ses voisins (à ~1,2 m) sursautent d'un petit coup et retombent : c'est le « retour » de la sensation, jamais lu par la simulation.

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
  /** Le nombre d'instances posées par genre à la dernière image. */
  compte(): readonly number[];
  detruire(): void;
}

export function monterVases(): VasesVus {
  const groupe = new Group();
  const formes = [jarre(), tonneau(), caisse()];
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
    compte: () => compte,
    detruire() {
      for (const f of formes) f.dispose();
      for (const x of [...matieres, ...coques]) x.dispose();
    },
  };
}
