export type Medaille = "author" | "gold" | "silver" | "bronze";
/** Les seuils des médailles, en points : le Diamant (`author`), l'or, l'argent, le bronze. Strictement croissants du bronze au Diamant. */
export interface Seuils {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}
