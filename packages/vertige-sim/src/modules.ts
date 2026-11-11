import { CM, M, POUSSEE } from "./constantes";
import type { Commande } from "./course";
import { Partie } from "./course";
import type { BlocNiveau, Boite, Jonction, Niveau, Reprise } from "./niveaux";
import { appliquer, DIRS, dirDe, IDENTITE, mul, numeroOrientation, ORIENTATIONS, type Dir, type Mat, type V3 } from "./orientation";
import { boiteRepere, type Paire, type Portail } from "./portails";
import { compiler, lireSolution } from "./solution";

// Le format de module (lot V2) : un morceau de niveau, en DONNÉES, dont on connaît la solution. Le niveau du jour (lot V3) sera assemblé de modules ; ce lot construit la bibliothèque et ses preuves.
//   · **Le repère du module** : le PALIER D'ENTRÉE est à l'origine (le point de la surface du palier, au centre), la direction est −z, le haut est +y, la gravité vers −y (orientation 0). Les blocs sont en micromètres dans ce repère.
//     Le palier d'entrée n'a pas de bloc dans le module : c'est la dalle du palier de sortie du module d'avant (`dallePalier`), qui fait partie des blocs du module qui la porte.
//   · **Le palier de sortie** : sa position (le point de la surface, au centre) et son orientation (`ori`, 0 à 23 : celle du repère du joueur à ce palier ; sa direction est −z local et sa gravité −y local). Le module d'après
//     est placé par cette rotation et cette translation : le repère du joueur à la sortie devient son repère d'entrée.
//   · **L'état de jonction canonique** (`Partie.canoniser`) : à chaque palier, au sol, au centre, en course à pleine vitesse dans l'axe, le regard dans l'axe — exact en entiers (le mécanisme est « l'aimantation du palier »,
//     `consignes.md`). La solution d'un module part de cet état et y revient : les solutions s'enchaînent telles quelles, et le temps du robot d'un niveau est la somme de ceux de ses modules.
//   · **La solution** s'écrit dans le petit langage de `solution.ts`.
export type Mecanique = "course" | "saut" | "mur" | "saut-de-mur" | "dash" | "gravite" | "portail";
export interface Palier {
  /** Le point de la surface du palier, au centre (µm, dans le repère du module). Les pieds posés sont à `POUSSEE` au-dessus, le long du haut du palier. */
  x: number;
  y: number;
  z: number;
  /** L'orientation du repère du joueur au palier (0 à 23, `ORIENTATIONS`). */
  ori: number;
}
export interface Module {
  id: string;
  nom: string;
  /** Les blocs, dans le repère du module : tout ce que le module apporte, la dalle de son palier de sortie comprise, jamais celle d'entrée. */
  blocs: readonly BlocNiveau[];
  portails?: readonly Paire[];
  /** Toujours l'origine, orientation 0 (la règle du format, vérifiée par les tests). */
  entree: Palier;
  sortie: Palier;
  etiquettes: { mecaniques: readonly Mecanique[]; difficulte: 1 | 2 | 3 };
  /** La solution, dans le langage de `solution.ts` : de l'entrée à la sortie, exactement (aucun pas après la capture du palier de sortie). */
  solution: string;
}

/** La dalle d'un palier : 3 m de demi-largeur, 5 m derrière le centre et 6 m devant, un mètre d'épaisseur ; les obstacles d'un module commencent après. */
export const PALIER_DEMI_LARGEUR = 3 * M;
export const PALIER_ARRIERE = 5 * M;
export const PALIER_AVANT = 6 * M;
/** Les limites du monde d'un module ou d'un niveau : sa boîte englobante plus 14 m de chaque côté (sortir des limites, c'est tomber : retour au dernier palier). */
export const VIDE_MARGE = 14 * M;
/** Le départ d'un joueur au repos, avant le palier d'entrée (m). */
export const DEPART_RECUL = 9 * M;

export const palier = (x: number, y: number, z: number, ori = 0): Palier => ({ x: Math.round(x * M), y: Math.round(y * M), z: Math.round(z * M), ori });
export const ENTREE: Palier = { x: 0, y: 0, z: 0, ori: 0 };

// ---------------------------------------------------------------- la géométrie des repères
const dir = (m: Mat, v: V3): V3 => appliquer(m, v);
const ajouter = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/** Une boîte transformée par une rotation (les 24 rotations du cube : les coins se transforment, la boîte reste alignée sur les axes) puis une translation. */
export function transformerBoite(b: Boite, R: Mat, T: V3): Boite {
  const a = appliquer(R, [b.x0, b.y0, b.z0]);
  const z = appliquer(R, [b.x1, b.y1, b.z1]);
  return { x0: Math.min(a[0], z[0]) + T[0], y0: Math.min(a[1], z[1]) + T[1], z0: Math.min(a[2], z[2]) + T[2], x1: Math.max(a[0], z[0]) + T[0], y1: Math.max(a[1], z[1]) + T[1], z1: Math.max(a[2], z[2]) + T[2] };
}
export function transformerPortail(p: Portail, R: Mat, T: V3): Portail {
  const c = ajouter(appliquer(R, [p.x, p.y, p.z]), T);
  return { x: c[0], y: c[1], z: c[2], normale: dirDe(dir(R, DIRS[p.normale]!)) as Dir, haut: dirDe(dir(R, DIRS[p.haut]!)) as Dir };
}

/** Les vecteurs d'un repère de palier (le repère du joueur à ce palier, dans le repère du module) : direction (−z local), droite (+x), haut (+y). */
export function reperePalier(ori: number): { dir: V3; droite: V3; haut: V3 } {
  const m = ORIENTATIONS[ori]!;
  return { dir: dir(m, [0, 0, -1]), droite: dir(m, [1, 0, 0]), haut: dir(m, [0, 1, 0]) };
}

/** La dalle d'un palier, dans le repère du module : centrée sur le point de la surface, le dessus à la surface. `derriere` : de la place en plus derrière (le départ d'un niveau). */
export function dallePalier(p: Palier, derriere = 0, role: BlocNiveau["role"] = "pierre"): BlocNiveau {
  const r = reperePalier(p.ori);
  return {
    boite: boiteRepere([p.x, p.y, p.z], r.droite, r.haut, r.dir, [-PALIER_DEMI_LARGEUR, PALIER_DEMI_LARGEUR], [-M, 0], [-PALIER_ARRIERE - derriere, PALIER_AVANT]),
    role,
  };
}

/** Les pieds posés d'un palier (µm, dans le repère donné) : le point de la surface plus POUSSEE le long du haut. */
export function piedsDuPalier(p: Palier, R: Mat = IDENTITE, T: V3 = [0, 0, 0]): V3 {
  const h = reperePalier(p.ori).haut;
  return ajouter(appliquer(R, [p.x + h[0] * POUSSEE, p.y + h[1] * POUSSEE, p.z + h[2] * POUSSEE]), T);
}

/** La zone où l'on est « sur le palier » (les pieds, au sol) : la dalle, épaissie de 30 cm de part et d'autre de la surface. */
function zoneDuPalier(dalle: Boite, surface: V3, haut: V3): Boite {
  const z = { ...dalle };
  const axe = haut[0] !== 0 ? "x" : haut[1] !== 0 ? "y" : "z";
  const i = axe === "x" ? 0 : axe === "y" ? 1 : 2;
  z[`${axe}0` as "x0"] = surface[i]! - 300_000;
  z[`${axe}1` as "x1"] = surface[i]! + 300_000;
  return z;
}

/** Un palier (placé par `R` et `T`) comme point de passage et comme jonction. */
function palierPlace(p: Palier, R: Mat, T: V3, fin = false): { reprise: Reprise; jonction: Jonction; dalle: Boite } {
  const surface = ajouter(appliquer(R, [p.x, p.y, p.z]), T);
  const Rp = mul(R, ORIENTATIONS[p.ori]!);
  const ori = numeroOrientation(Rp);
  const haut = appliquer(Rp, [0, 1, 0]);
  const pieds: V3 = [surface[0] + haut[0] * POUSSEE, surface[1] + haut[1] * POUSSEE, surface[2] + haut[2] * POUSSEE];
  const dalle = transformerBoite(dallePalier({ x: p.x, y: p.y, z: p.z, ori: p.ori }).boite, R, T);
  return {
    reprise: { zone: zoneDuPalier(dalle, surface, haut), x: pieds[0], y: pieds[1], z: pieds[2], lacet: 0, ori },
    jonction: { x: pieds[0], y: pieds[1], z: pieds[2], ori, ...(fin ? { fin: true } : {}) },
    dalle,
  };
}

function englobante(blocs: readonly BlocNiveau[]): Boite {
  const b = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const { boite } of blocs) {
    b.x0 = Math.min(b.x0, boite.x0);
    b.y0 = Math.min(b.y0, boite.y0);
    b.z0 = Math.min(b.z0, boite.z0);
    b.x1 = Math.max(b.x1, boite.x1);
    b.y1 = Math.max(b.y1, boite.y1);
    b.z1 = Math.max(b.z1, boite.z1);
  }
  return b;
}
/** Les limites du monde d'une liste de blocs : leur boîte englobante, plus `VIDE_MARGE`. */
export function videDe(blocs: readonly BlocNiveau[]): Boite {
  const b = englobante(blocs);
  return { x0: b.x0 - VIDE_MARGE, y0: b.y0 - VIDE_MARGE, z0: b.z0 - VIDE_MARGE, x1: b.x1 + VIDE_MARGE, y1: b.y1 + VIDE_MARGE, z1: b.z1 + VIDE_MARGE };
}

const HORS_DE_PORTEE = -1_000_000 * M;

// ---------------------------------------------------------------- un module, joué seul
/**
 * Le niveau d'un module joué seul : sa dalle d'entrée devant, ses blocs, deux paliers (l'entrée et la sortie) qui sont des points de passage et des jonctions, la capture de la sortie finit la partie.
 * `lance` : la partie commence dans l'état de jonction canonique, au palier d'entrée (le robot, la galerie « Voir la solution ») ; sinon le joueur part au repos, à `DEPART_RECUL` derrière lui (la galerie « Jouer »).
 */
export function niveauDuModule(m: Module, opts: { lance?: boolean } = {}): Niveau {
  const entree = palierPlace(m.entree, IDENTITE, [0, 0, 0]);
  const sortie = palierPlace(m.sortie, IDENTITE, [0, 0, 0], true);
  const blocs = [dallePalier(m.entree, 6 * M), ...m.blocs];
  const pieds = piedsDuPalier(m.entree);
  return {
    nom: "module",
    blocs,
    depart: opts.lance ? { x: pieds[0], y: pieds[1], z: pieds[2], lacet: 0, lance: true } : { x: pieds[0], y: pieds[1], z: pieds[2] + DEPART_RECUL, lacet: 0 },
    arrivee: null,
    reprises: [entree.reprise, sortie.reprise],
    jonctions: [entree.jonction, sortie.jonction],
    gemmes: [],
    chute: HORS_DE_PORTEE,
    portails: m.portails ? [...m.portails] : undefined,
    vide: videDe(blocs),
  };
}

/** Rejoue des commandes sur un niveau jusqu'à sa fin. */
function jouerJusquaLaFin(niveau: Niveau, commandes: readonly Commande[]): Partie {
  const p = new Partie(niveau);
  for (let i = 0; i < commandes.length && !p.finie; i++) p.avancer(commandes[i]!);
  return p;
}

/** Les commandes d'un module : sa solution compilée, SANS couper (pour vérifier qu'elle ne dépasse pas la capture de sa sortie). */
export const commandesDuModule = (m: Module): Commande[] => compiler(lireSolution(m.solution));

/**
 * Le robot d'un module : sa solution rejouée de l'état canonique d'entrée jusqu'à la capture de la sortie. `commandes` : celles qui servent (coupées à la capture), `ticks` : le temps du robot du module (en pas de 1/120 s,
 * 0 si la solution n'arrive pas), `partie` : l'état à la fin.
 */
export function robotDuModule(m: Module): { commandes: Commande[]; ticks: number; arrive: boolean; partie: Partie } {
  const niveau = niveauDuModule(m, { lance: true });
  const p = jouerJusquaLaFin(niveau, commandesDuModule(m));
  const arrive = p.fin >= 0;
  return { commandes: commandesDuModule(m).slice(0, p.tick), ticks: arrive ? p.tick : 0, arrive, partie: p };
}

// ---------------------------------------------------------------- les modules, assemblés
export interface Placement {
  module: Module;
  /** La rotation et la translation du repère du module dans le monde. */
  R: Mat;
  T: V3;
  /** Le palier de sortie dans le monde : les pieds posés, l'orientation (index), et le pas auquel le robot y arrive. */
  sortiePieds: V3;
  sortieOri: number;
}
export interface Enchainement {
  niveau: Niveau;
  placements: readonly Placement[];
  /** La solution entière : le départ au repos jusqu'au premier palier, chaque module, puis la course jusqu'à l'arrivée. */
  solution: Commande[];
  /** Le pas où le robot capture chaque palier (le premier, celui du départ, puis chaque sortie) et le pas de l'arrivée. */
  paliersRobot: number[];
  arriveeRobot: number;
}

/**
 * Assemble des modules bout à bout : le palier d'entrée du premier est à l'origine du monde ; le palier de sortie de chacun devient l'entrée du suivant (rotation et translation). Le niveau a un palier de départ (la
 * dalle, au repos, 4,5 m derrière son centre, plus 7 m de dalle derrière) et une zone d'arrivée à 4 à 6 m devant le dernier palier. Le robot (la solution de chaque module, la course du départ et de l'arrivée) est construit
 * ici : le niveau n'est jamais assemblé sans que sa solution l'ait été.
 */
export function assembler(modules: readonly Module[], nom: Niveau["nom"] = "enchainement"): Enchainement {
  const blocs: BlocNiveau[] = [];
  const reprises: Reprise[] = [];
  const jonctions: Jonction[] = [];
  const portails: Paire[] = [];
  const placements: Placement[] = [];
  const depart = palierPlace(ENTREE, IDENTITE, [0, 0, 0]);
  blocs.push(dallePalier(ENTREE, 7 * M));
  reprises.push(depart.reprise);
  jonctions.push(depart.jonction);
  let R: Mat = IDENTITE;
  let T: V3 = [0, 0, 0];
  for (const m of modules) {
    for (const b of m.blocs) blocs.push({ ...b, boite: transformerBoite(b.boite, R, T) });
    for (const p of m.portails ?? []) portails.push({ a: transformerPortail(p.a, R, T), b: transformerPortail(p.b, R, T) });
    const sortie = palierPlace(m.sortie, R, T);
    reprises.push(sortie.reprise);
    jonctions.push(sortie.jonction);
    placements.push({ module: m, R, T, sortiePieds: [sortie.jonction.x, sortie.jonction.y, sortie.jonction.z], sortieOri: sortie.jonction.ori });
    // Le repère du joueur à la sortie devient celui du module d'après.
    const surface = ajouter(appliquer(R, [m.sortie.x, m.sortie.y, m.sortie.z]), T);
    R = mul(R, ORIENTATIONS[m.sortie.ori]!);
    T = surface;
  }
  // La zone d'arrivée : devant le dernier palier, de 4 à 6 m, de la dalle au-dessus de la tête.
  const rr = { droite: appliquer(R, [1, 0, 0]), haut: appliquer(R, [0, 1, 0]), dir: appliquer(R, [0, 0, -1]) };
  const arrivee = boiteRepere(T, rr.droite, rr.haut, rr.dir, [-PALIER_DEMI_LARGEUR, PALIER_DEMI_LARGEUR], [0, 2.5 * M], [4 * M, 6 * M]);
  const pieds = piedsDuPalier(ENTREE);
  const niveau: Niveau = {
    nom,
    blocs,
    depart: { x: pieds[0], y: pieds[1], z: pieds[2] + DEPART_RECUL, lacet: 0 },
    arrivee,
    reprises,
    jonctions,
    gemmes: [],
    chute: HORS_DE_PORTEE,
    ...(portails.length > 0 ? { portails } : {}),
    vide: videDe(blocs),
  };
  // Le robot : la course du départ jusqu'au premier palier, chaque module, la course de l'arrivée.
  const solution: Commande[] = [];
  const paliersRobot: number[] = [];
  const essai = new Partie(niveau);
  const avancer = (c: Commande): void => {
    essai.avancer(c);
    solution.push(c);
  };
  let capturees = 0;
  const course: Commande = { k: 1, dl: 0, dt: 0 };
  while (essai.captures === capturees && essai.tick < 3000) avancer(course);
  paliersRobot.push(essai.tick);
  capturees = essai.captures;
  for (const m of modules) {
    for (const c of robotDuModule(m).commandes) avancer(c);
    paliersRobot.push(essai.tick);
    capturees = essai.captures;
  }
  while (!essai.finie && essai.tick < 20_000) avancer(course);
  return { niveau, placements, solution, paliersRobot, arriveeRobot: essai.fin };
}

/** Les écarts (en micromètres) d'une liste de blocs avec ses voisins : utilitaire des tests. */
export const metres = (v: number): number => v / M;
export const centimetres = (v: number): number => v / CM;
