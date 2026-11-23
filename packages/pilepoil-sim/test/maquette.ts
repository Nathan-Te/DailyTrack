import { readFileSync } from "node:fs";

// La simulation de la maquette validée (`docs/pilepoil/maquettes/pile-poil-maquette-jouable.html`), lue telle quelle : le script de la page jusqu'au rendu, exécuté avec une adresse et un stockage vides.
// C'est la référence des tests : la simulation du jeu doit redonner ses jauges, ses points et ses scores (la maquette n'a pas de fin de jauge sans appui : les essais appuient toujours à temps).
const page = readFileSync(new URL("../../../docs/pilepoil/maquettes/pile-poil-maquette-jouable.html", import.meta.url), "utf8");
const script = page.slice(page.indexOf("<script>") + 8, page.indexOf("// Rendu (Canvas 2D)"));

interface EtatMaquette {
  score: number;
  fini: boolean;
  pas: number;
  pause: number;
  i: number;
  x: number;
  appuis: number[];
  resultats: { points: number; bonus: number; sorte: string }[];
  jauges: unknown[];
}
export interface Maquette {
  DEFAUT: Record<string, number>;
  SINUS: number[];
  tirerJauges(graine: number, r: Record<string, number>): { demi: number; centre: number; vitesse: number; depart: number; sens: number; bouge: boolean; phase: number }[];
  nouvellePartie(graine: number, r: Record<string, number>): EtatMaquette;
  entrerJauge(e: EtatMaquette): void;
  centreCible(e: EtatMaquette, j: unknown): number;
  pas(e: EtatMaquette): void;
  appuyer(e: EtatMaquette): unknown;
  rejouer(graine: number, r: Record<string, number>, appuis: number[]): number;
}

const vide = { getItem: () => null, setItem: () => undefined };
export const MAQUETTE = new Function("location", "localStorage", `${script}\nreturn { DEFAUT, SINUS, tirerJauges, nouvellePartie, entrerJauge, centreCible, pas, appuyer, rejouer };`)({ search: "" }, vide) as Maquette;
