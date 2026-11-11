import { CM, M } from "./constantes";
import type { Dir } from "./orientation";
import { PORTAIL_DEMI_H, PORTAIL_DEMI_L, PORTAIL_PROFONDEUR, boiteRepere, geo, type Paire, type Portail } from "./portails";
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
  /** Une surface de gravité (lot V1) : la toucher (pieds, tête, flanc ou course sur le mur) tourne la gravité vers elle. */
  gravite?: boolean;
}
/** Une orbe de gravité (lot V1) : la ramasser tourne la gravité vers `dir` (0 à 5 : +x, −x, +y, −y, +z, −z), la flèche de l'orbe. */
export interface Orbe {
  x: number;
  y: number;
  z: number;
  dir: Dir;
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
  /** Le départ : les pieds dans le MONDE (µm), le lacet, et l'orientation de départ (lot V1, 0 par défaut : la gravité vers le bas ; voir `orientation.ts`). */
  depart: { x: number; y: number; z: number; lacet: number; ori?: number };
  /** La zone d'arrivée : le chrono s'arrête dès que la boîte du joueur la touche. */
  arrivee: Boite | null;
  reprises: readonly Reprise[];
  gemmes: readonly { x: number; y: number; z: number }[];
  /** Au-dessous de cette hauteur (µm), on réapparaît au dernier point de reprise. */
  chute: number;
  /** Les orbes de gravité (lot V1), s'il y en a. */
  orbes?: readonly Orbe[];
  /** Les paires de portails (lot V1), s'il y en a. */
  portails?: readonly Paire[];
  /** Les limites du monde (lot V1) : sortir de cette boîte (pieds) ramène au dernier point de reprise, comme la chute. Sans elle, seule `chute` compte. */
  vide?: Boite;
  /** Sans index spatial (lot V2) : la référence exhaustive des tests, qui essaie toutes les boîtes. Jamais dans un niveau du jeu. */
  sansIndex?: boolean;
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


// ---------------------------------------------------------------- les niveaux de la gravité et des portails (lot V1)
/** Un bloc par ses bornes, en mètres (x0, y0, z0, x1, y1, z1). */
const bm = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, role: Role = "pierre", gravite = false): BlocNiveau => ({
  boite: { x0: x0 * M, y0: y0 * M, z0: z0 * M, x1: x1 * M, y1: y1 * M, z1: z1 * M },
  role,
  ...(gravite ? { gravite: true } : {}),
});
/** Un point en mètres. */
const pm = (x: number, y: number, z: number): { x: number; y: number; z: number } => ({ x: x * M, y: y * M, z: z * M });

/** Le mur d'un portail : une dalle de 1,2 m d'épaisseur derrière le plan (face avant sur le plan), percée de l'ouverture sur `PORTAIL_PROFONDEUR` — une poche vide fermée par 0,2 m de pierre. `demi` : demi-largeur du mur, `bas` et `haut` : ce qui reste sous et au-dessus du centre. */
export function murDePortail(p: Portail, demi: number, bas: number, haut: number, role: Role = "pierre"): BlocNiveau[] {
  const g = geo(p);
  const T = PORTAIL_PROFONDEUR + 20 * CM;
  const hw = PORTAIL_DEMI_L;
  const hh = PORTAIL_DEMI_H;
  const d = demi * M;
  const b = bas * M;
  const h = haut * M;
  const morceaux: [readonly [number, number], readonly [number, number], readonly [number, number]][] = [
    [[-d, -hw], [-b, h], [-T, 0]],
    [[hw, d], [-b, h], [-T, 0]],
    [[-hw, hw], [-b, -hh], [-T, 0]],
    [[-hw, hw], [hh, h], [-T, 0]],
    [[-hw, hw], [-hh, hh], [-T, -PORTAIL_PROFONDEUR]],
  ];
  return morceaux
    .filter(([rr, uu, nn]) => rr[1] > rr[0] && uu[1] > uu[0] && nn[1] > nn[0])
    .map(([rr, uu, nn]) => ({ boite: boiteRepere(g.centre, g.r, g.u, g.n, rr, uu, nn), role }));
}
const portail = (x: number, y: number, z: number, normale: Dir, haut: Dir): Portail => ({ x: x * M, y: y * M, z: z * M, normale, haut });
const PX: Dir = 0, MX: Dir = 1, PY: Dir = 2, MY: Dir = 3, PZ: Dir = 4, MZ: Dir = 5;

/** La salle de la gravité : à l'ouest les SURFACES (un plafond et deux murs marqués), à l'est les ORBES (une flèche chacune), un sol entre les deux. */
function gravite(): Niveau {
  return {
    nom: "gravite",
    blocs: [
      bm(-30, -0.5, -20, 30, 0, 20),
      // Les surfaces de gravité : le plafond (on saute dessous), le mur de l'ouest, et le mur du nord qui lui est perpendiculaire.
      bm(-20, 3.0, -10, -6, 3.5, 8, "rouge", true),
      bm(-22, 0, -10, -21, 14, 8, "rouge", true),
      bm(-21, 0, -11, -6, 14, -10, "rouge", true),
      // Les orbes : un mur et un plafond ordinaires, qu'une orbe fait atteindre.
      bm(20, 0, -10, 21, 14, 8, "sombre"),
      bm(6, 8, -10, 18, 8.5, 8, "sombre"),
    ],
    depart: { ...pm(0, 0.001, 12), lacet: 0 },
    arrivee: null,
    reprises: [],
    gemmes: [],
    chute: -30 * M,
    orbes: [
      { ...pm(8, 0.9, -4), dir: PX }, // vers l'est : le mur de l'est
      { ...pm(12, 0.9, 6), dir: PY }, // vers le haut : le plafond de l'est
      { ...pm(12, 7.1, 0), dir: MY }, // sur ce plafond : retour au sol
      { ...pm(19.1, 6, 0), dir: MY }, // sur le mur de l'est : retour au sol
    ],
    vide: { x0: -60 * M, y0: -30 * M, z0: -60 * M, x1: 60 * M, y1: 80 * M, z1: 60 * M },
  };
}

/** La salle des portails : trois paires (droite, tournée d'un quart de tour, qui change la gravité) et une orbe, en un court parcours. */
function portails(): Niveau {
  const a1 = portail(-6, 1.2, -6, PZ, PY);
  const b1 = portail(14, 1.2, -20, PZ, PY);
  const a2 = portail(14, 1.2, -10, MZ, PY);
  const b2 = portail(26, 1.2, -10, PX, PY);
  const a3 = portail(34, 1.2, -10, MX, PY);
  const b3 = portail(46, 12, -10, MY, PX);
  return {
    nom: "portails",
    blocs: [
      bm(-30, -0.5, -45, 60, 0, 15),
      ...murDePortail(a1, 3, 1.2, 2.4),
      ...murDePortail(b1, 3, 1.2, 2.4),
      ...murDePortail(a2, 3, 1.2, 2.4),
      ...murDePortail(b2, 3, 1.2, 2.4),
      ...murDePortail(a3, 3, 1.2, 2.4),
      ...murDePortail(b3, 3, 3, 3), // la dalle du plafond, au-dessus du portail qui fait tomber vers l'ouest
      bm(38, 0, -20, 40, 16, 2, "sombre"), // le mur sur lequel on retombe (sa face est est à x = 40)
    ],
    depart: { ...pm(0, 0.001, 10), lacet: 0 },
    arrivee: { x0: 41 * M, y0: 0, z0: -6 * M, x1: 44 * M, y1: 2 * M, z1: -1 * M },
    reprises: [],
    gemmes: [],
    chute: -30 * M,
    orbes: [{ ...pm(40.9, 5.5, -3), dir: MY }], // sur le mur : retour au sol, devant l'arrivée
    portails: [{ a: a1, b: b1 }, { a: a2, b: b2 }, { a: a3, b: b3 }],
    vide: { x0: -60 * M, y0: -30 * M, z0: -80 * M, x1: 90 * M, y1: 80 * M, z1: 40 * M },
  };
}

/** Le cube (pour les tests et le golden, aussi jouable) : une salle de 24 m fermée, avec une orbe sur chaque face qui envoie vers la suivante — les six directions de gravité à la suite. */
function cube(): Niveau {
  return {
    nom: "cube",
    blocs: [
      bm(-13, -1, -13, 13, 0, 13),
      bm(-13, 24, -13, 13, 25, 13),
      bm(12, 0, -13, 13, 24, 13),
      bm(-13, 0, -13, -12, 24, 13),
      bm(-12, 0, 12, 12, 24, 13),
      bm(-12, 0, -13, 12, 24, -12),
    ],
    depart: { ...pm(-6, 0.001, 0), lacet: 0 },
    arrivee: null,
    reprises: [],
    gemmes: [],
    chute: -30 * M,
    orbes: [
      { ...pm(6, 0.9, 0), dir: PX },
      { ...pm(11.1, 12, 0), dir: PY },
      { ...pm(0, 23.1, 0), dir: MX },
      { ...pm(-11.1, 12, 0), dir: PZ },
      { ...pm(0, 12, 11.1), dir: MZ },
      { ...pm(0, 12, -11.1), dir: MY },
    ],
    vide: { x0: -40 * M, y0: -30 * M, z0: -40 * M, x1: 40 * M, y1: 80 * M, z1: 40 * M },
  };
}

const CACHE = new Map<NomNiveau, Niveau>();
/** Le niveau de ce nom (construit une fois). */
export function niveau(nom: NomNiveau): Niveau {
  let n = CACHE.get(nom);
  if (!n) {
    n = nom === "parcours" ? parcours() : nom === "bac-a-sable" ? bacASable() : nom === "mur" ? mur() : nom === "gravite" ? gravite() : nom === "portails" ? portails() : cube();
    CACHE.set(nom, n);
  }
  return n;
}
