// Lot V2 — la logique de la galerie des circuits à venir (`?debug&galerie=30`), pure et testée (`test/galerie.test.ts`) : pour un jour et une version du générateur, ce
// que la carte montre (biome, rythme, temps du pilote, motifs repérés) et le plan du circuit (cellules de la grille, chacune avec son élément).
import { MOTIF_BOOST_SERRE, THEMES, blockCells, dailyCircuit, elementsOf, formatDay, motifs, motifsBoostSerre, parseToken, rythmeDuJour, type Element, type Track } from "@cdj/sim";

/** Une cellule du plan : sa place sur la grille, l'élément de son bloc, et si le bloc fait partie du motif « boost → longue → serré ». */
export interface CellulePlan {
  x: number;
  z: number;
  element: Element | "depart" | "arrivee";
  motif: boolean;
}

export interface CarteGalerie {
  date: string;
  version: number;
  biome: string;
  rythme: string | null;
  /** Temps du pilote (ms) : celui qui fait les médailles. */
  pilotMs: number;
  /** Temps de l'auteur affiché aux joueurs (ms). */
  auteurMs: number;
  /** Motifs « boost → longue ligne droite → virage serré ». */
  motif: number;
  /** Suites de trois éléments partagées avec le circuit de la veille (même version). */
  communsVeille: string[];
  suites: Set<string>;
  plan: CellulePlan[];
  secours: boolean;
}

/** Les blocs du motif « boost → longue → serré » : de la poussée au virage serré compris (mêmes règles que `motifsBoostSerre`). */
export function blocsDuMotif(tokens: readonly string[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < tokens.length; i++) {
    const avant = tokens.slice(0, i + 1);
    if (motifsBoostSerre(avant) > motifsBoostSerre(avant.slice(0, -1))) {
      // Le virage `i` termine un motif : on remonte jusqu'à la poussée.
      let j = i - 1;
      while (j >= 0 && !/^[PT](\/|@|$)/.test(tokens[j]!)) j--;
      for (let k = Math.max(0, j); k <= i; k++) out.add(k);
    }
  }
  return out;
}

/** L'élément d'un bloc pour le plan (comme `elementsOf`, bloc par bloc). */
function elementDuBloc(token: string, index: number, n: number): CellulePlan["element"] {
  if (index === 0) return "depart";
  if (index === n - 1) return "arrivee";
  return elementsOf(token)[0] ?? "droite";
}

/** Le plan d'un circuit : chaque cellule de la grille qu'il occupe (un virage large ou ample en occupe plusieurs). */
export function planDuCircuit(track: Track, spec: string): CellulePlan[] {
  const tokens = spec.split(" ").filter(Boolean);
  const motif = blocsDuMotif(tokens);
  const out: CellulePlan[] = [];
  track.blocks.forEach((b, i) => {
    const element = elementDuBloc(tokens[i] ?? "S", i, track.blocks.length);
    for (const [x, z] of blockCells(b.cx, b.cz, b.dir, parseToken(tokens[i] ?? "S").kind).cells) out.push({ x, z, element, motif: motif.has(i) });
  });
  return out;
}

/** La carte d'un jour pour une version (`veille` : la carte de la veille, même version, pour les suites partagées). */
export function carteDuJour(day: number, version: number, veille?: CarteGalerie | null): CarteGalerie {
  const c = dailyCircuit(day, 0, null, version);
  const suites = c.spec ? motifs(c.spec, 3) : new Set<string>();
  return {
    date: formatDay(day),
    version,
    biome: THEMES[c.theme].label,
    rythme: rythmeDuJour(day, version, c.theme),
    pilotMs: c.authorMs,
    auteurMs: c.medals.author,
    motif: c.spec ? motifsBoostSerre(c.spec.split(" ")) : 0,
    communsVeille: veille ? [...suites].filter((s) => veille.suites.has(s)) : [],
    suites,
    plan: c.spec ? planDuCircuit(c.track, c.spec) : [],
    secours: c.fallback,
  };
}

export { MOTIF_BOOST_SERRE };
