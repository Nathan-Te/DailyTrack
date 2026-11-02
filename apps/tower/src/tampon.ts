import { type Effet, estBonus } from "@cdj/tower-sim";

// Lot T9 — ce que le HUD dessine d'un effet, en données (pur, testé) : l'annonce d'un palier en TAMPON et la plaque « Suivante » marquée. **Affichage seulement** : rien n'en retourne dans la simulation.

/** Le tampon d'un palier : un bonus est vert, penché à gauche (−1), avec un point d'exclamation ; un malus est encre, penché à droite (+1), ombré terre cuite, avec des points de suspension. */
export interface Tampon {
  bonus: boolean;
  classe: "tampon--bonus" | "tampon--malus";
  /** La clé du texte (« LIERRE ! », « COUP DE VENT… ») dans les catalogues français et anglais. */
  cle: string;
  penche: -1 | 1;
  /** La ponctuation que le texte du catalogue doit porter. */
  ponctuation: "!" | "…";
}
export function tamponDe(effet: Effet): Tampon {
  const bonus = estBonus(effet);
  return { bonus, classe: bonus ? "tampon--bonus" : "tampon--malus", cle: `annonce.tampon.${effet}`, penche: bonus ? -1 : 1, ponctuation: bonus ? "!" : "…" };
}

/** La plaque « Suivante » : un bonus a un cadre vert épais ; un malus un cadre d'encre et une bande rayée en haut ; un macaron rond porte l'icône de l'effet ; la pièce dessinée y prend la couleur ou la taille de l'effet. */
export interface Plaque {
  cadre: "vert" | "encre" | null;
  bandeRayee: boolean;
  /** L'effet dont l'icône est dans le macaron (un écrou pour la pièce figée, un flocon pour la glissante), ou null sans effet. */
  macaron: Effet | null;
  piece: { echelle: number; bordEpais: boolean; givre: boolean; bande: boolean; liane: boolean };
}
export function plaqueDe(effet: Effet | null): Plaque {
  return {
    cadre: effet === null ? null : estBonus(effet) ? "vert" : "encre",
    bandeRayee: effet !== null && !estBonus(effet),
    macaron: effet,
    piece: { echelle: effet === "petite" ? 0.5 : 1, bordEpais: effet === "geante", givre: effet === "glissante", bande: effet === "figee", liane: effet === "lierre" },
  };
}
