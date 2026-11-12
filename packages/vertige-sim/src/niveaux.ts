import { CM, M } from "./constantes";
import type { Dir } from "./orientation";
import { bm, faceAvecPlaque, MX, MY, murDePortail, PX, PY, pm, portail, PZ, MZ } from "./construction";
import type { Paire } from "./portails";
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
  /** Une surface de gravité (lot V1) : la toucher (pieds, tête, flanc ou course sur le mur) tourne la gravité vers elle. C'est le seul déclencheur, avec les portails (lot V2 : les orbes sont retirées). */
  gravite?: boolean;
}
export interface Reprise {
  /** Où il faut être (la position des pieds, au sol) pour que ce point devienne le point de reprise. */
  zone: Boite;
  x: number;
  y: number;
  z: number;
  lacet: number;
  /** L'orientation du repère du joueur à la reprise (lot V2 : un palier dit sa gravité) ; la zone ne compte alors que si la gravité du joueur est celle de ce repère. Sans elle : l'orientation du moment. */
  ori?: number;
}
/**
 * Un palier, côté simulation (lot V2) : le point où l'état du joueur est ramené à l'ÉTAT DE JONCTION CANONIQUE — au sol, au centre du palier, en course à pleine vitesse dans l'axe, le regard dans l'axe —, exact en entiers.
 * C'est ce qui rend les solutions des modules enchaînables telles quelles. Le mécanisme (« l'aimantation du palier ») est dans `consignes.md` ; les constantes de capture sont dans `jonctions.ts`.
 */
export interface Jonction {
  /** Les pieds au centre du palier, posés (µm, dans le monde) : la surface du palier plus POUSSEE. */
  x: number;
  y: number;
  z: number;
  /** L'orientation du repère du joueur au palier : sa direction (−z local) et sa gravité (−y local) s'en déduisent. */
  ori: number;
  /** Une partie qui capture cette jonction est finie (la sortie d'un module joué seul). */
  fin?: boolean;
}
export interface Niveau {
  /** Le nom du niveau : un scénario, ou `module` pour un module joué seul (lot V2, jamais rejoué par le serveur). */
  nom: NomNiveau | "module";
  blocs: readonly BlocNiveau[];
  /** Le départ : les pieds dans le MONDE (µm), le lacet, et l'orientation de départ (lot V1, 0 par défaut : la gravité vers le bas ; voir `orientation.ts`). */
  depart: { x: number; y: number; z: number; lacet: number; ori?: number; lance?: boolean };
  // `lance` (lot V2) : la partie commence dans l'état de jonction canonique (en course, pleine vitesse), comme après un palier.
  /** La zone d'arrivée : le chrono s'arrête dès que la boîte du joueur la touche. */
  arrivee: Boite | null;
  reprises: readonly Reprise[];
  gemmes: readonly { x: number; y: number; z: number }[];
  /** Au-dessous de cette hauteur (µm), on réapparaît au dernier point de reprise. */
  chute: number;
  /** Les paires de portails (lot V1), s'il y en a. */
  portails?: readonly Paire[];
  /** Les limites du monde (lot V1) : sortir de cette boîte (pieds) ramène au dernier point de reprise, comme la chute. Sans elle, seule `chute` compte. */
  vide?: Boite;
  /** Les paliers (lot V2) : à chaque passage de leur plan, dans l'état voulu, l'état est ramené à l'état canonique. */
  jonctions?: readonly Jonction[];
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
/** La salle de la gravité : des surfaces marquées (« rouge » à facettes violettes au rendu), qui ne se touchent jamais. À l'ouest un plafond (on saute dessous), un grand mur et un mur du nord ; à l'est un mur et un plafond ; le sol a deux plaques marquées qui ramènent la gravité vers le bas. */
function gravite(): Niveau {
  return {
    nom: "gravite",
    blocs: [
      // Le sol, en cinq morceaux : deux plaques marquées (le retour au sol), au pied des deux grands murs.
      bm(-30, -0.5, -20, -20, 0, 20),
      bm(-20, -0.5, -8, -15, 0, 8, "pierre", true),
      bm(-20, -0.5, -20, -15, 0, -8),
      bm(-20, -0.5, 8, -15, 0, 20),
      bm(-15, -0.5, -20, 15, 0, 20),
      bm(15, -0.5, -8, 19, 0, 8, "pierre", true),
      bm(15, -0.5, -20, 19, 0, -8),
      bm(15, -0.5, 8, 19, 0, 20),
      bm(19, -0.5, -20, 30, 0, 20),
      // À l'ouest : le plafond (on saute dessous), le grand mur, le mur du nord (1 à 2 m de vide entre deux surfaces marquées : elles ne se touchent pas).
      bm(-20, 3.0, -9, -6, 3.5, 8, "rouge", true),
      bm(-22, 0, -10, -21, 14, 8, "rouge", true),
      bm(-19, 0, -11, -6, 14, -10, "rouge", true),
      // À l'est : un mur et un plafond.
      bm(20, 0, -10, 21, 14, 8, "rouge", true),
      bm(6, 8, -10, 18, 8.5, 8, "rouge", true),
    ],
    depart: { ...pm(0, 0.001, 12), lacet: 0 },
    arrivee: null,
    reprises: [],
    gemmes: [],
    chute: -30 * M,
    vide: { x0: -60 * M, y0: -30 * M, z0: -60 * M, x1: 60 * M, y1: 80 * M, z1: 60 * M },
  };
}

/** La salle des portails : trois paires (droite, tournée d'un quart de tour, qui change la gravité) puis une plaque de sol marquée (retour au sol), en un court parcours. */
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
      // Le sol : une plaque marquée devant l'arrivée (on y revient en marchant sur le grand mur vers le bas).
      bm(-30, -0.5, -45, 41, 0, 15),
      bm(41, -0.5, -8, 45, 0, 0, "pierre", true),
      bm(41, -0.5, -45, 60, 0, -8),
      bm(41, -0.5, 0, 60, 0, 15),
      bm(45, -0.5, -8, 60, 0, 0),
      ...murDePortail(a1, 3, 1.2, 2.4),
      ...murDePortail(b1, 3, 1.2, 2.4),
      ...murDePortail(a2, 3, 1.2, 2.4),
      ...murDePortail(b2, 3, 1.2, 2.4),
      ...murDePortail(a3, 3, 1.2, 2.4),
      ...murDePortail(b3, 3, 3, 3), // la dalle du plafond, au-dessus du portail qui fait tomber vers l'ouest
      bm(38, 0, -20, 40, 16, 2, "sombre"), // le mur sur lequel on retombe (sa face est est à x = 40)
    ],
    depart: { ...pm(0, 0.001, 10), lacet: 0 },
    arrivee: { x0: 42.5 * M, y0: 0, z0: -6 * M, x1: 44.5 * M, y1: 2 * M, z1: -1 * M },
    reprises: [],
    gemmes: [],
    chute: -30 * M,
    portails: [{ a: a1, b: b1 }, { a: a2, b: b2 }, { a: a3, b: b3 }],
    vide: { x0: -60 * M, y0: -30 * M, z0: -80 * M, x1: 90 * M, y1: 80 * M, z1: 40 * M },
  };
}

/**
 * Le cube (pour les tests et le golden, aussi jouable) : une salle de 24 m fermée dont chaque face est une plaque marquée entourée d'un liseré de 40 cm qui ne l'est pas (les plaques ne se touchent jamais). On touche
 * la plaque d'une face : la gravité tourne vers elle. Le tour des six directions se fait par des faces voisines : le sol (départ), l'est, le nord… voir `CUBE_ORDRE`.
 */
function cube(): Niveau {
  const interieur: [number, number][] = [[-12, 12], [0, 24], [-12, 12]];
  const blocs: BlocNiveau[] = [];
  for (const axe of [0, 1, 2] as const) for (const signe of [-1, 1] as const) blocs.push(...faceAvecPlaque(axe, signe, interieur, 0.4));
  return {
    nom: "cube",
    blocs,
    depart: { ...pm(-6, 0.001, 0), lacet: 0 },
    arrivee: null,
    reprises: [],
    gemmes: [],
    chute: -30 * M,
    vide: { x0: -40 * M, y0: -30 * M, z0: -40 * M, x1: 40 * M, y1: 80 * M, z1: 40 * M },
  };
}
/** Le centre des faces du cube, dans l'ordre qui visite les six directions de la gravité par des faces voisines : est (+x), nord… (le sol est celui du départ). Des points du monde, en mètres. */
export const CUBE_ORDRE: readonly [number, number, number][] = [
  [12, 12, 0], // la face est : la gravité va vers +x
  [0, 12, 12], // la face sud (+z)
  [-12, 12, 0], // la face ouest (−x)
  [0, 12, -12], // la face nord (−z)
  [0, 24, 0], // le plafond (+y)
];

// Les niveaux construits ailleurs (lot V2 : l'enchaînement de modules s'enregistre ici quand son fichier est chargé). Ce fichier n'importe donc jamais la bibliothèque de modules : il est dans les dépendances du premier chargement
// du jeu (budget `vertige.jsCss`), la bibliothèque n'y est pas.
const AILLEURS = new Map<NomNiveau, () => Niveau>();
export function enregistrerNiveau(nom: NomNiveau, construire: () => Niveau): void {
  AILLEURS.set(nom, construire);
}
const CACHE = new Map<NomNiveau, Niveau>();
/** Le niveau de ce nom (construit une fois). */
export function niveau(nom: NomNiveau): Niveau {
  let n = CACHE.get(nom);
  if (!n) {
    n = nom === "parcours" ? parcours() : nom === "bac-a-sable" ? bacASable() : nom === "mur" ? mur() : nom === "gravite" ? gravite() : nom === "portails" ? portails() : nom === "cube" ? cube() : (AILLEURS.get(nom) ?? (() => { throw new Error(`niveau « ${nom} » non chargé : importer son fichier (enchainement.ts)`); }))();
    CACHE.set(nom, n);
  }
  return n;
}
