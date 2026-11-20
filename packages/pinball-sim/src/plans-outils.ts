import { NORME, TOUR } from "./constantes";
import { cosinus, div, sinus } from "./entiers";
import type { Module } from "./generateur";
import type { DefPorte, DefRail, Emplacement, Plan } from "./plans";

// Les outils d'écriture des plans (lots PBG1, PBL2 et PBT0) : l'élément du thème, le trou, l'orbite, la porte de l'orbite, et **le miroir** d'un plan. Un fichier à part pour que `plans.ts` (qui tire les plans) et
// `plans-essai.ts` (les plans d'essai du lot PBT0) les partagent sans import circulaire.

/** L'emplacement de l'élément du thème : le manège, le tourbillon, le trou noir ou — au Volcan — la coulée (par défaut) ou le geyser (`volcan: "geyser"` : lot PBL2, le geyser au centre est un tir que les trois plans à emplacements bas n'offraient pas ; la coulée prend alors un emplacement du haut). */
export const theme = (x: number, y: number, volcan: Module = "coulee"): Emplacement => ({ x, y, permis: ["manege"], fixe: { foire: "manege", ocean: "tourbillon", espace: "trouNoir", volcan } });
/** Le trou : toujours là, dans tous les thèmes (la Pieuvre de l'océan) ; il servira de verrou au lot suivant. */
export const trou = (x: number, y: number): Emplacement => ({ x, y, permis: ["trou"] });

/**
 * L'orbite : un couloir le long de l'arc du haut (rayon `r` px autour de (196,25 ; 205)), de la bouche gauche (`xg`, `y`) à la bouche droite (`xd`, `y`). Les bouches regardent vers le haut : la bille qui y monte assez vite
 * fait le tour et sort de l'autre côté. **Lot PBL2 : une bouche s'ouvre dans la direction d'un tir** (`ag`, `ad` : degrés à partir de la verticale, positif vers la droite de l'écran — la bouche gauche regarde vers le haut et
 * la gauche, la bouche droite vers le haut et la droite), pour que la bille frappée par un batteur la franchisse de face : la fenêtre de tir (`tir.ts`).
 */
export function orbite(xg: number, xd: number, y: number, r: number, hauteur: number, ag = 0, ad = 0, yd = y): DefRail {
  const arc = (a: number): [number, number] => {
    // `a` en degrés, de 180 (à gauche) à 0 (à droite) ; les sinus et cosinus sont ceux des multiples de 20° : écrits ici, tout en entiers
    const t: Record<number, [number, number]> = { 180: [-1000, 0], 160: [-940, 342], 140: [-766, 643], 120: [-500, 866], 100: [-174, 985], 80: [174, 985], 60: [500, 866], 40: [766, 643], 20: [940, 342], 0: [1000, 0] };
    const [c, s] = t[a]!;
    return [196 + Math.trunc((c * r) / 1000), 205 - Math.trunc((s * r) / 1000)];
  };
  // le deuxième point de chaque bout : 44 px plus loin dans la direction de la bouche
  const vers = (x: number, y: number, a: number): [number, number] => [x + Math.trunc((44 * sinus(div(a * TOUR, 360))) / NORME), y - Math.trunc((44 * cosinus(div(a * TOUR, 360))) / NORME)];
  return {
    genre: "orbite",
    points: [[xg, y], vers(xg, y, ag), ...[160, 140, 120, 100, 80, 60, 40, 20].map(arc), vers(xd, yd, ad), [xd, yd]],
    hauteur,
    demiPorte: 17,
    orb: [xg, xd, y, r, hauteur, ag, ad, yd],
  };
}

/**
 * **La porte de l'orbite** (lot PBL2) : un battant qui ferme la bouche d'une orbite et la transforme en passage payant. Le passage (deux murs, un battant) est posé juste derrière la bouche (`x`, `y`, direction `angle`),
 * le battant à `ecart` px d’elle (26 : la bouche prend la bille dès qu’elle est à moins de son rayon de la ligne de la bouche, 9 px ; un battant plus près ne serait jamais franchi avant la prise) : fermé, il est un mur et la bouche est hors de portée de ce côté ; ouvert, la bille qui le franchit rapporte 4 000, fait avancer la mission d'un cran, puis est prise par l'orbite.
 * L'autre bouche reste libre : sur une table sans banque de cibles, c'est l'orbite prise par elle qui ouvre la porte.
 */
export function porteDeLOrbite(x: number, y: number, angle: number, largeur: number, profondeur = 36): DefPorte {
  const a = div(angle * TOUR, 360);
  const ecart = 26;
  return { x: x - Math.trunc((ecart * sinus(a)) / NORME), y: y + Math.trunc((ecart * cosinus(a)) / NORME), angle, largeur, profondeur };
}


/** Le côté gauche-droite de la table : l'axe est à x = 184 (`AXE`), un point `x` a pour image `368 − x` (les batteurs : 112 et 256). */
const MX = 368;

/**
 * **Le miroir d'un plan** (lot PBT0) : le même plan retourné gauche-droite, identifiant `<id>m`. Les emplacements, les points des rampes, la porte (son angle change de signe) en sont l'image dans l'axe ; le mini-batteur
 * change de côté (son pivot est déjà donné dans le repère du côté gauche) ; **l'orbite est refaite** par `orbite()` avec les bouches échangées — le châssis n'est pas symétrique dans l'axe (l'arc est centré à x = 196,25),
 * l'image des points de l'arc sortirait de la table — ; l'aiguillage ne change pas (sa place est en ‰ de la rampe). C'est le moyen de doubler la variété sans rien empiler : les tests de tir et de visibilité passent dans les deux sens.
 */
export function miroirDePlan(plan: Plan, id: string = `${plan.id}m`): Plan {
  const emplacements: Emplacement[] = plan.emplacements.map((e) => ({ ...e, x: MX - e.x }));
  const rampes: DefRail[] = plan.rampes.map((r) => ({ ...r, points: r.points.map(([x, y]) => [MX - x, y] as const) }));
  let orbiteM: DefRail | null = null;
  if (plan.orbite) {
    const o = plan.orbite;
    if (o.orb) {
      const [xg, xd, y, r, hauteur, ag, ad, yd] = o.orb;
      orbiteM = { ...orbite(MX - xd, MX - xg, yd, r, hauteur, -ad, -ag, y), demiPorte: o.demiPorte };
    } else orbiteM = { ...o, points: o.points.map(([x, y]) => [MX - x, y] as const).reverse() };
  }
  return {
    id,
    ...(plan.idee ? { idee: plan.idee } : {}),
    emplacements,
    rampes,
    orbite: orbiteM,
    ...(plan.mini ? { mini: { ...plan.mini, cote: (1 - plan.mini.cote) as 0 | 1 } } : {}),
    ...(plan.porte ? { porte: { ...plan.porte, x: MX - plan.porte.x, angle: -plan.porte.angle } } : {}),
    ...(plan.aiguillage ? { aiguillage: plan.aiguillage } : {}),
  };
}
