// Lot T0 — l'interface commune aux deux moteurs de l'essai (A : maison, en entiers ; B : Rapier 2D déterministe).
// Unités : le MÈTRE, une case = 1 m. Les entrées sont des ENTIERS en huitièmes de mètre (`x8`, `y8`, `vx8`, `vy8`) : exactes dans les deux
// moteurs (A les range en virgule fixe, B les divise par 8, une division par une puissance de deux est exacte).
// Les sorties (`snapshot`) sont en mètres et en radians, en nombres à virgule flottante : pour A ils viennent d'entiers par des opérations
// exactes (÷ 2^16 ; × une constante), pour B de Rapier (f32 élargis en f64) ; l'empreinte (`empreinte.ts`) hache leurs octets.

export type PieceKind = "I" | "O" | "T" | "L" | "J" | "S" | "Z";
export const PIECE_KINDS: readonly PieceKind[] = ["I", "O", "T", "L", "J", "S", "Z"];

/** Les réglages du monde : tous entiers (les « centièmes » évitent d'écrire un flottant dans une entrée). */
export interface WorldConfig {
  /** Pas fixe, en Hz (60 pour l'essai). */
  hz: number;
  /** Gravité, en cm/s² (981 = 9,81 m/s²), vers le bas. */
  gravityCm: number;
  /** Frottement, en centièmes (60 = 0,60), le même pour les pièces et la plateforme. */
  frictionPct: number;
  /** Rebond, en centièmes (0 = aucun). */
  restitutionPct: number;
  /** Itérations du solveur de contacts par pas. */
  iterations: number;
  /** Mise en sommeil permise ? */
  sleep: boolean;
  /** Demi-largeur de la plateforme, en huitièmes de mètre (24 = plateforme de 6 m). Son dessus est à y = 0. */
  platformHalf8: number;
}

export const DEFAULT_CONFIG: WorldConfig = {
  hz: 60,
  gravityCm: 981,
  frictionPct: 60,
  restitutionPct: 0,
  iterations: 30,
  sleep: true,
  platformHalf8: 24,
};

/** Une pièce à ajouter : forme, quart de tour (0..3, appliqué à la création, sans angle), position du CENTRE DE MASSE et vitesse. */
export interface PieceSpec {
  kind: PieceKind;
  rot: number;
  x8: number;
  y8: number;
  vx8: number;
  vy8: number;
}

export interface PieceState {
  id: number;
  /** Position du centre de masse, en mètres. */
  x: number;
  y: number;
  /** Angle, en radians (sens trigonométrique). */
  angle: number;
  asleep: boolean;
  /** Tombée sous le niveau de la plateforme (perdue : son état est gelé). */
  lost: boolean;
}

export interface Snapshot {
  tick: number;
  pieces: PieceState[];
}

/** Un monde en cours. L'objet est propre à chaque moteur ; seul le moteur sait le lire. */
export interface World {
  readonly tick: number;
}

export interface Engine {
  readonly name: "A" | "B";
  readonly label: string;
  createWorld(config: WorldConfig): World;
  /** Ajoute une pièce ; rend son identifiant (0, 1, 2… dans l'ordre d'ajout). */
  addPiece(world: World, spec: PieceSpec): number;
  /** Un pas de simulation. */
  step(world: World): void;
  snapshot(world: World): Snapshot;
  /** Copie profonde du monde (pour le bot : essayer une pièce sans toucher à la tour). A : copie des tableaux ; B : instantané binaire de Rapier. */
  clone(world: World): World;
  /** Nombre de pièces éveillées (qui bougent encore, au sens du moteur). */
  awake(world: World): number;
  /** Libère le monde (B : mémoire WebAssembly). */
  dispose(world: World): void;
}

/** Sous ce niveau (en mètres), une pièce est « tombée » : une vie dans le jeu, gelée dans l'essai. */
export const LOST_Y = -4;
