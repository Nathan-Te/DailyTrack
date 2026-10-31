import type { VuePartie, VuePiece } from "@cdj/tower-sim";

// Des vues de partie écrites à la main, pour tester l'affichage (panique, événements) sans lancer la physique.
export function piece(id: number, p: Partial<VuePiece> = {}): VuePiece {
  return { id, kind: "O", rot: 0, etat: "libre", x: 0, y: 1, angle: 0, endormie: true, taille: "normale", effet: null, soudee: false, fixe: false, ...p };
}

export function vue(tick: number, pieces: VuePiece[], p: Partial<VuePartie> = {}): VuePartie {
  const active = pieces.find((x) => x.etat === "active");
  return {
    tick,
    phase: "jeu",
    pieces,
    active: active ? active.id : -1,
    suivante: null,
    numero: pieces.length,
    total: 40,
    vies: 3,
    posees: pieces.filter((x) => x.etat === "libre").length,
    tombees: pieces.filter((x) => x.etat === "perdue").length,
    hauteurMm: 0,
    hauteurMaxMm: 0,
    palier: null,
    declenches: 0,
    dernierEffet: null,
    effetSuivant: null,
    ...p,
  };
}
