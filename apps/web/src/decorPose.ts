// Pose du décor (lot 37) : le relevé de ce que le rendu plante au bord de la piste, pour pouvoir vérifier sans rendu qu'il y a bien un appui
// sous chaque élément et rien dans le passage de la voiture. Pur (aucun DOM) ; présentation seule : jamais rien dans `sim`.
//
// Chaque fonction qui pose un élément (panneau, arche, porte, poteau, tribune, décor) est appelée telle quelle ; quand un `PoseLog` est donné,
// on mesure la boîte englobante des formes qu'elle vient de construire (`Builder.mark` / `boxSince`) et on la note avec ce que l'élément est
// (type, partie, appui voulu). Sans `PoseLog` (le jeu), rien n'est mesuré : le même code, le même résultat.
import type { Box, Builder, BuilderMark } from "./meshKit";

/** Ce qu'est un élément : chaque type a UN rôle (signaler, marquer, habiller), sinon il n'a rien à faire dans la scène. */
export type PoseKind = "poteau" | "panneau" | "arche-depart" | "arche-arrivee" | "arche-vitesse" | "porte" | "tribune" | "decor" | "lampadaire" | "sponsor";

export type Role = "signaler" | "marquer" | "habiller";

export const ROLES: Record<PoseKind, Role> = {
  poteau: "signaler", // borne au bord d'une portion rapide : on lit la vitesse
  panneau: "signaler", // virage, saut, cuve à venir
  "arche-vitesse": "signaler", // portion rapide
  "arche-depart": "marquer",
  "arche-arrivee": "marquer",
  porte: "marquer", // point de contrôle
  tribune: "habiller", // départ
  decor: "habiller", // hors de la piste, selon le thème
  lampadaire: "habiller", // Ville : mobilier de rue sur le rebord ; Nuit (lot 43) : l'éclairage de piste
  sponsor: "habiller", // lot 43 : panneaux de sponsors fictifs sur les rebords du départ et de l'arrivée
};

/**
 * Partie d'un élément : un `pied` touche son appui ; un `surplomb` (poutre, plaque, voile, toit) est porté par les pieds de son groupe et peut
 * passer au-dessus de la route, à `PASSAGE_HAUT` au moins.
 */
export type PosePart = "pied" | "surplomb";

/** Appui d'un pied : le sol lointain (`track.voidY − FALL_DEPTH`), ou le chapeau du rebord d'un bloc fermé (route + hauteur du rebord). */
export type Appui = "sol" | "rebord";

export interface Pose {
  kind: PoseKind;
  part: PosePart;
  /** Appui d'un pied (un surplomb n'en a pas). */
  appui: Appui;
  /** Les parties d'une même structure (deux pieds et une poutre) portent le même groupe. */
  group: number;
  /** Boîte englobante (m). Un pied pose sa base à `y0`. */
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  /** Triangles construits. */
  tris: number;
  /** Bloc qui porte l'élément (le rebord, la route) ; −1 pour un élément posé au sol. */
  block: number;
  /** Thème ou style (décor) : pour les comptes par thème. */
  style: string;
}

/** Hauteur (m) au-dessus de la route sous laquelle rien ne passe : la caméra « loin » est à 4,2 m, plus une marge. C'est le passage et la cheminée de la caméra. */
export const PASSAGE_HAUT = 4.6;
/** Écart toléré (m) entre la base d'un pied et la hauteur de son appui. */
export const TOLERANCE_APPUI = 0.05;
/** Marge (m) entre un pied et la surface roulante (route, bas-côté) : il est tout entier dehors. */
export const MARGE_PASSAGE = 0.1;
/** Largeur (m) du chapeau d'un rebord, au-delà du bord de la route (voir `addRoad`). */
export const CHAPEAU = 0.6;

/** Marge (m) entre un élément posé au sol et la surface roulante : assez pour ne jamais frôler la route ni masquer le regard vers elle. */
export const MARGE_DECOR = 1;

/** Boîte englobante de ce que les constructeurs ont construit depuis leurs repères, avec le nombre de triangles ; `null` si rien (constructeur muet). */
function mesurer(builders: readonly Builder[], marks: readonly BuilderMark[]): { box: Box | null; tris: number } {
  let box: Box | null = null;
  let tris = 0;
  builders.forEach((b, i) => {
    const bb = b.boxSince(marks[i]!);
    tris += (b.pos.length - marks[i]!.pos) / 9;
    if (!bb) return;
    box = box ? { x0: Math.min(box.x0, bb.x0), y0: Math.min(box.y0, bb.y0), z0: Math.min(box.z0, bb.z0), x1: Math.max(box.x1, bb.x1), y1: Math.max(box.y1, bb.y1), z1: Math.max(box.z1, bb.z1) } : bb;
  });
  return { box, tris };
}

export type PoseMeta = Pick<Pose, "kind" | "part" | "appui" | "group" | "block" | "style">;

export class PoseLog {
  readonly poses: Pose[] = [];
  private groups = 0;

  /** Un nouveau numéro de groupe pour les parties d'une même structure. */
  group(): number {
    return ++this.groups;
  }

  /** Note une pose. */
  push(meta: PoseMeta, box: Box, tris: number) {
    this.poses.push({ ...meta, ...box, tris });
  }
}

/**
 * Construit un élément : `run` construit ses formes dans `builders`. Avec un relevé (tests), la boîte de ce qui a été construit est notée ; avec
 * `accepter` (le jeu), l'élément est retiré s'il est refusé (`rollback` : ses tirages au sort ont été consommés, le reste du décor ne bouge pas).
 * Sans relevé ni `accepter`, `run` est simplement appelé.
 */
export function placed(log: PoseLog | undefined, meta: PoseMeta, builders: readonly Builder[], run: () => void, accepter?: (box: Box) => boolean): boolean {
  if (!log && !accepter) {
    run();
    return true;
  }
  const marks = builders.map((b) => b.mark());
  run();
  const { box, tris } = mesurer(builders, marks);
  if (!box) return true;
  if (accepter && !accepter(box)) {
    builders.forEach((b, i) => b.rollback(marks[i]!));
    return false;
  }
  log?.push(meta, box, tris);
  return true;
}
