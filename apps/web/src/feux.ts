// Lot 43 — les feux de départ du portique (palier 1) : ce qu'ils montrent selon l'état du décompte. **Lecture seule** : l'affichage lit la phase et le
// temps restant du décompte, il ne change rien à la course (le départ reste celui de `main.ts`, au pas près). Pur, testé (`test/feux.test.ts`).

/** Ce que montrent les cinq colonnes de feux : `rouges` colonnes allumées en rouge (de gauche à droite), ou toutes au vert. */
export interface EtatFeux {
  rouges: number;
  vert: boolean;
}

/** Nombre de colonnes de feux sur le portique. */
export const COLONNES_FEUX = 5;

export const FEUX_ETEINTS: EtatFeux = { rouges: 0, vert: false };

/**
 * Les feux pendant une tentative : éteints au début du décompte, une colonne de plus en rouge à chaque cinquième du décompte (la dernière s'allume
 * avant la fin), puis toutes au vert au départ, et vertes jusqu'à la fin de la tentative. `restant` : secondes restantes du décompte (de `total` à 0).
 * Un décompte gelé (pause, podium du Salon) garde son état ; une tentative recommencée les éteint.
 */
export function etatFeux(phase: "countdown" | "racing" | "finished", restant: number, total: number): EtatFeux {
  if (phase !== "countdown") return { rouges: 0, vert: true };
  const ecoule = Math.max(0, total - restant);
  const rouges = Math.min(COLONNES_FEUX, Math.ceil((ecoule / total) * COLONNES_FEUX - 1e-9));
  return { rouges: Math.max(0, rouges), vert: false };
}

/** Deux états montrent-ils la même chose ? (on ne repeint les feux que s'ils changent) */
export const memesFeux = (a: EtatFeux, b: EtatFeux): boolean => a.rouges === b.rouges && a.vert === b.vert;
