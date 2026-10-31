import type { PieceKind } from "../lab/interface";
import { type Box8, pieceBoxes } from "../lab/pieces";
import type { Taille } from "./paliers";
import { boites, etendueDeBoites, sommetDeBoites } from "./sommet";

// Lot T5 — les tailles d'ESSAI des pièces (`?debug&tune`), à part de `sommet.ts` pour que le premier chargement (l'accueil, qui lit `sommet`) ne les porte pas. Une taille d'essai met à l'échelle les
// ARÊTES des boîtes (arrondies au huitième : deux boîtes voisines gardent leur arête commune) ; la moitié (2/4) et le double (8/4) restent exactement ce qu'ils étaient (`boites`).

/** Les tailles d'essai, en quarts de la taille normale. */
export interface Echelles {
  petite4: number;
  geante4: number;
}

const CACHE = new Map<string, Box8[]>();

/** Les boîtes d'une pièce à sa taille, avec les tailles d'essai éventuelles. Sans `echelles` (ou à leurs valeurs normales) : `boites`, au bit près. */
export function boitesE(kind: PieceKind, rot: number, taille: Taille = "normale", echelles?: Echelles): readonly Box8[] {
  const n4 = echelles && taille === "petite" && echelles.petite4 !== 2 ? echelles.petite4 : echelles && taille === "geante" && echelles.geante4 !== 8 ? echelles.geante4 : 0;
  if (!n4) return boites(kind, rot, taille);
  const cle = `${kind}${rot & 3}${taille}~${n4}`;
  let b = CACHE.get(cle);
  if (!b) {
    b = pieceBoxes(kind, rot & 3).map((x) => {
      const x0 = Math.round(((x.cx - x.hw) * n4) / 4);
      const x1 = Math.max(x0 + 1, Math.round(((x.cx + x.hw) * n4) / 4));
      const y0 = Math.round(((x.cy - x.hh) * n4) / 4);
      const y1 = Math.max(y0 + 1, Math.round(((x.cy + x.hh) * n4) / 4));
      return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: (x1 - x0) / 2, hh: (y1 - y0) / 2 };
    });
    CACHE.set(cle, b);
  }
  return b;
}

export const sommetPieceE = (kind: PieceKind, rot: number, y: number, angle: number, taille: Taille, echelles?: Echelles): number => sommetDeBoites(boitesE(kind, rot, taille, echelles), y, angle);
export const etenduePieceE = (kind: PieceKind, rot: number, x: number, angle: number, taille: Taille, echelles?: Echelles): { gauche: number; droite: number } => etendueDeBoites(boitesE(kind, rot, taille, echelles), x, angle);
