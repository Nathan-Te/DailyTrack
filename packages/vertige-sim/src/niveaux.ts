import { CM, M } from "./constantes";
import type { NomNiveau } from "./noms";

// Les niveaux : un monde de BLOCS ALIGNÉS SUR LES AXES (la simulation ne connaît rien d'autre), écrits en centimètres (centre et taille, comme la maquette), rangés en micromètres. Les décors qui ne
// bloquent pas (nuages, îlots lointains, bannières, braseros, le cadre qui tourne) sont l'affaire du rendu : un objet de travers n'a jamais de collision. Trois niveaux : le parcours de la maquette
// (sans le portail), l'arène du bac à sable et le long mur.

/** La matière d'un bloc, pour le rendu seulement (la couleur du style). */
export type Role = "pierre" | "sombre" | "rouge";

export interface Boite {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
}
export interface BlocNiveau {
  boite: Boite;
  role: Role;
}
export interface Reprise {
  /** Où il faut être (la position des pieds, au sol) pour que ce point devienne le point de reprise. */
  zone: Boite;
  x: number;
  y: number;
  z: number;
  lacet: number;
}
export interface Niveau {
  nom: NomNiveau;
  blocs: readonly BlocNiveau[];
  depart: { x: number; y: number; z: number; lacet: number };
  /** La zone d'arrivée : le chrono s'arrête dès que la boîte du joueur la touche. */
  arrivee: Boite | null;
  reprises: readonly Reprise[];
  gemmes: readonly { x: number; y: number; z: number }[];
  /** Au-dessous de cette hauteur (µm), on réapparaît au dernier point de reprise. */
  chute: number;
}

/** Un bloc : centre et taille en centimètres. */
const bloc = (cx: number, cy: number, cz: number, w: number, h: number, d: number, role: Role = "pierre"): BlocNiveau => ({
  boite: { x0: cx * CM - (w * CM) / 2, y0: cy * CM - (h * CM) / 2, z0: cz * CM - (d * CM) / 2, x1: cx * CM + (w * CM) / 2, y1: cy * CM + (h * CM) / 2, z1: cz * CM + (d * CM) / 2 },
  role,
});
/** Une boîte par ses bornes, en centimètres. */
const zone = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Boite => ({ x0: x0 * CM, y0: y0 * CM, z0: z0 * CM, x1: x1 * CM, y1: y1 * CM, z1: z1 * CM });
/** Un pilier (haut en centimètres) coiffé de son tapis rouge, qui est solide : il fait 30 cm de plus. */
const pilier = (x: number, z: number, haut: number): BlocNiveau[] => [bloc(x, haut - 1500, z, 300, 3000, 300), bloc(x, haut + 15, z, 330, 30, 330, "rouge")];
const point = (x: number, y: number, z: number) => ({ x: x * CM, y, z: z * CM });

function parcours(): Niveau {
  return {
    nom: "parcours",
    blocs: [
      bloc(0, -100, 400, 1000, 200, 1200), // le départ
      bloc(-700, 400, 200, 400, 1400, 800),
      bloc(-700, 1140, 200, 460, 80, 860, "sombre"),
      ...pilier(0, -600, 0),
      ...pilier(60, -1200, 100),
      ...pilier(250, -1800, 200),
      bloc(460, 400, -2900, 120, 1000, 1500, "sombre"), // le mur à longer, sans sol dessous
      bloc(200, -100, -4100, 600, 200, 600), // l'atterrissage
      bloc(200, -100, -5300, 500, 200, 500), // la dernière plateforme, après le trou du dash
    ],
    depart: { ...point(0, 1000, 700), lacet: 0 },
    arrivee: zone(-50, 0, -5550, 450, 350, -5380),
    reprises: [{ zone: zone(-100, -50, -5600, 500, 100, -3800), ...point(200, 0, -4000), lacet: 0 }],
    gemmes: [point(60, 2400000, -1200), point(340, 4200000, -2900), point(200, 2200000, -4700)],
    chute: -30 * M,
  };
}

function bacASable(): Niveau {
  const blocs: BlocNiveau[] = [bloc(0, -100, 0, 1400, 200, 1400)];
  // À l'est, cinq trous de 2, 4, 6, 8 et 10 m (le dernier se passe au dash), puis la plateforme d'arrivée.
  let x = 700;
  for (const trou of [200, 400, 600, 800, 1000]) {
    blocs.push(bloc(x + trou + 200, -100, 0, 400, 200, 600));
    x += trou + 400;
  }
  blocs.push(bloc(x + 400 + 500, -100, 0, 1000, 200, 800));
  // Au nord, six marches de 50 cm à 3 m, puis un palier.
  [50, 100, 150, 200, 250, 300].forEach((h, i) => blocs.push(bloc(0, (h - 100) / 2, -850 - 300 * i, 600, h + 100, 300)));
  blocs.push(bloc(0, 200, -3050, 600, 200, 600));
  // À l'ouest, deux murs face à face au-dessus du vide (à courir et à sauter de l'un à l'autre), puis une plateforme.
  blocs.push(bloc(-1000, 600, -1800, 100, 1400, 3000, "sombre"), bloc(-1600, 600, -1800, 100, 1400, 3000, "sombre"));
  blocs.push(bloc(-1300, -100, -3700, 1400, 200, 800));
  const fin = x + 400 + 500;
  return { nom: "bac-a-sable", blocs, depart: { ...point(0, 1000, 300), lacet: 0 }, arrivee: zone(fin + 100, 0, -400, fin + 500, 350, 400), reprises: [], gemmes: [], chute: -30 * M };
}

function mur(): Niveau {
  return {
    nom: "mur",
    blocs: [
      bloc(0, -100, 0, 800, 200, 800),
      bloc(700, 600, -1000, 120, 1400, 2400, "sombre"), // le mur : 24 m, du vide dessous
      bloc(300, -100, -2900, 1000, 200, 800), // la plateforme de l'autre côté
    ],
    depart: { ...point(0, 1000, 250), lacet: 0 },
    arrivee: zone(-200, 0, -3300, 800, 350, -3000),
    reprises: [],
    gemmes: [],
    chute: -30 * M,
  };
}

const CACHE = new Map<NomNiveau, Niveau>();
/** Le niveau de ce nom (construit une fois). */
export function niveau(nom: NomNiveau): Niveau {
  let n = CACHE.get(nom);
  if (!n) {
    n = nom === "parcours" ? parcours() : nom === "bac-a-sable" ? bacASable() : mur();
    CACHE.set(nom, n);
  }
  return n;
}
