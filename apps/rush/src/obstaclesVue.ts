import { ConeGeometry, Group, SphereGeometry, type BufferGeometry } from "three";
import { M } from "@cdj/rush-sim/constantes";
import { OBSTACLE_RONCES, centreDeCase, type Niveau } from "@cdj/rush-sim/niveau";
import type { ObstacleVivant } from "@cdj/rush-sim";
import { piece } from "./cel";
import { aleatoire, bloc, fusionner, placer, teindre } from "./formes";
import type { PaletteMonde } from "./palette";

// Les OBSTACLES cassables du chemin (lot BR1b), **en mètres** : des ronces (1 coup) et des caisses (2 coups), une forme par case occupée, posée sur le chemin. **DA figée jusqu'à BR-A : des formes simples.** Ils restent bas
// (1,2 m au plus : on voit par-dessus) ; ils tremblent sous un coup, et disparaissent quand la simulation les retire (les éclats de `corps.ts` font le reste). Un obstacle est un groupe, créé une fois par le niveau.

const RONCE = 0x3d6b2c;
const RONCE_SOMBRE = 0x2a4a22;
const EPINE = 0x9a3b4a;

function ronce(graine: number): BufferGeometry {
  const rnd = aleatoire(graine);
  const parts: BufferGeometry[] = [];
  for (let k = 0; k < 7; k++) {
    const a = rnd() * Math.PI * 2;
    const d = 0.15 + rnd() * 0.65;
    const h = 0.7 + rnd() * 0.5;
    parts.push(teindre(placer(new ConeGeometry(0.2 + rnd() * 0.12, h, 5), { x: Math.cos(a) * d, z: Math.sin(a) * d, y: h / 2, rx: (rnd() - 0.5) * 0.5, rz: (rnd() - 0.5) * 0.5 }), k % 2 ? RONCE : RONCE_SOMBRE));
  }
  for (let k = 0; k < 4; k++) {
    const a = rnd() * Math.PI * 2;
    parts.push(teindre(placer(new SphereGeometry(0.1, 6, 4), { x: Math.cos(a) * 0.55, z: Math.sin(a) * 0.55, y: 0.5 + rnd() * 0.4 }), EPINE));
  }
  return fusionner(parts);
}

export interface ObstaclesVus {
  groupe: Group;
  /** Chaque image : montre les obstacles encore debout, fait trembler ceux qui viennent d'être touchés. */
  maj(vivants: readonly ObstacleVivant[], temps: number): void;
}

export function monterObstacles(niveau: Niveau, a: PaletteMonde): ObstaclesVus {
  const groupe = new Group();
  const vus = new Map<number, { g: Group; base: number }>();
  niveau.obstacles.forEach((o, id) => {
    const g = new Group();
    o.cases.forEach((k, i) => {
      const [x, y] = centreDeCase(niveau, k);
      const geo =
        o.genre === OBSTACLE_RONCES
          ? ronce(1000 + id * 17 + i)
          : bloc(1.45, 0.95 + (i % 3) * 0.1, 1.45, { couleur: a.bois, dessus: a.bois2, variation: 0.12, graine: 700 + id * 13 + i, rayon: 0.12, irregulier: 0.05, segments: 1 });
      const p = piece(geo, 0xffffff, true, true);
      p.groupe.position.set(x / M, 0, y / M);
      p.groupe.rotation.y = ((id * 31 + i * 57) % 100) / 100 * 0.6 - 0.3;
      g.add(p.groupe);
    });
    groupe.add(g);
    vus.set(id, { g, base: 1 });
  });
  return {
    groupe,
    maj(vivants, temps) {
      const debout = new Set<number>();
      for (const o of vivants) {
        debout.add(o.id);
        const v = vus.get(o.id);
        if (!v) continue;
        v.g.visible = true;
        const t = o.flash > 0 ? Math.sin(temps * 70) * 0.05 * (o.flash / 7) : 0;
        v.g.scale.set(1 + t, 1 - Math.abs(t) * 1.5, 1 + t);
      }
      for (const [id, v] of vus) if (!debout.has(id)) v.g.visible = false;
    },
  };
}
