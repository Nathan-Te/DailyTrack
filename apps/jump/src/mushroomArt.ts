import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from "three";
import type { Level } from "@cdj/jump-sim";
import { buildMushroomArt, mushroomPose, mushroomSquash } from "./mushroom";

// Les champignons rebonds (lot 23), **affichage seul** : un dôme violet sur un pied crème, tourné vers où il lance (`mushroomPose`), qui s'écrase vers son support au contact
// (`mushroomSquash`, plus fort pour un rebond renforcé) puis revient. Le rebond est signalé par l'événement `champignon` (`events.ts`, `mushroomHit` de la simulation) : la
// scène en garde seulement l'instant (`bounce`), le dessin se déduit de l'âge. Aucun état de jeu, aucune secousse de caméra ; statique, donc **jamais estompé** dans le carnage
// (comme les pics) ; une géométrie partagée par tous les champignons du niveau, un groupe chacun, construits une fois.

export interface MushroomStats {
  /** Pour chaque champignon (ordre de `level.mushrooms`) : son orientation dessinée (rotation en rad), l'échelle d'écrasement le long de son axe (1 : au repos) et si le dernier rebond était renforcé. */
  rotation: number[];
  squash: number[];
  boosted: boolean[];
  /** Nombre de rebonds vus depuis le début (mesure). */
  bounces: number;
}

export interface MushroomArt {
  readonly stats: MushroomStats;
  /** Un rebond vient d'avoir lieu (à l'instant `seconds` de l'horloge de la scène). */
  bounce(index: number, boost: boolean, seconds: number): void;
  /** Met les écrasements à l'heure `seconds` ; `animate` faux : retour tout droit. */
  update(seconds: number, animate: boolean): void;
}

/** Les champignons d'un niveau ; `null` s'il n'en a pas. */
export function createMushroomArt(world: Group, level: Level): MushroomArt | null {
  if (level.mushrooms.length === 0) return null;
  const art = buildMushroomArt();
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(art.pos, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(art.col, 3));
  geometry.setIndex(art.idx);
  const material = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const n = level.mushrooms.length;
  const stats: MushroomStats = { rotation: [], squash: Array(n).fill(1), boosted: Array(n).fill(false), bounces: 0 };
  const since: number[] = Array(n).fill(-Infinity);
  const groups = level.mushrooms.map((m) => {
    const pose = mushroomPose(m);
    // Le groupe porte la pose (origine : le milieu de la face du support) ; le maillage, lui, est écrasé le long de son axe (son « haut »).
    const g = new Group();
    g.position.set(pose.x, pose.y, 0.04);
    g.rotation.z = pose.rotation;
    const mesh = new Mesh(geometry, material);
    g.add(mesh);
    world.add(g);
    stats.rotation.push(pose.rotation);
    return mesh;
  });
  return {
    stats,
    bounce(index, boost, seconds) {
      if (index < 0 || index >= n) return;
      since[index] = seconds;
      stats.boosted[index] = boost;
      stats.bounces++;
    },
    update(seconds, animate) {
      for (let i = 0; i < n; i++) {
        const f = mushroomSquash(seconds - since[i]!, stats.boosted[i]!, animate);
        stats.squash[i] = f;
        // Écrasé, le chapeau s'élargit un peu (le volume se garde à peu près) ; au repos, l'échelle est exactement 1.
        groups[i]!.scale.set(f === 1 ? 1 : 1 + (1 - f) * 0.4, f, 1);
      }
    },
  };
}
