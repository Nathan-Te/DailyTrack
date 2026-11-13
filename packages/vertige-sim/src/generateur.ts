import type { NomNiveau } from "./noms";
import type { Seuils } from "./medailles";

// Le contenu du jour (lot V3). **Pure** : rien ne vient d'une horloge. Ce fichier ne porte que la FORME du contenu et son empreinte (il est dans le premier chargement du jeu) ; le générateur lui-même (`dailyVertige`, version 2 :
// des modules de la bibliothèque, posés bout à bout) est dans `niveauDuJour.ts`, qui importe la bibliothèque et ne se charge donc qu'à la demande (point d'entrée `@cdj/vertige-sim/modules`).
export interface Contenu {
  jour: number;
  /** La version du générateur qui l'a produit. */
  g: number;
  /** « jour » : un niveau assemblé de modules (`modules`) ; sinon un niveau nommé (version 1 : le parcours de la maquette). */
  niveau: NomNiveau | "jour";
  /** Les clés des modules posés bout à bout (`variantes.ts` : `saut-1`, `mur-1~`, `dash-2/l`…), de l'entrée à l'arrivée. */
  modules?: readonly string[];
  /** Le temps du robot (pas de 1/120 s), de son premier mouvement à l'arrivée : le Diamant (`medailles.ts`). */
  ticksRobot?: number;
  /** Les seuils des médailles écrits dans le fichier du jour (règle « un jour figé fige aussi ses seuils »). Absents : `seuilsDe(ticksRobot)`. */
  seuilsFiges?: Seuils;
}

export class ErreurGenerateur extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurGenerateur";
  }
}

/** L'empreinte du contenu (FNV-1a 32 bits sur ses entiers, le nom du niveau, les clés de ses modules et le temps du robot) : un texte de huit hexadécimaux. Les seuils figés n'y entrent pas (ils ont leur propre empreinte, `vertige-empreintes.ts`). */
export function empreinteContenu(contenu: Contenu): string {
  let h = 0x811c9dc5;
  const octet = (n: number): void => {
    h = Math.imul(h ^ (n & 0xff), 0x01000193) >>> 0;
  };
  const entier = (n: number): void => {
    octet(n);
    octet(n >>> 8);
    octet(n >>> 16);
  };
  const texte = (t: string): void => {
    for (let i = 0; i < t.length; i++) octet(t.charCodeAt(i));
    octet(0);
  };
  entier(contenu.jour);
  entier(contenu.g);
  texte(contenu.niveau);
  for (const m of contenu.modules ?? []) texte(m);
  if (contenu.ticksRobot !== undefined) entier(contenu.ticksRobot);
  return h.toString(16).padStart(8, "0");
}
