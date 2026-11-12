import type { Boite } from "./niveaux";

// L'index spatial (lot V2) : une grille de cellules cubiques où chaque boîte est rangée dans toutes les cellules qu'elle recouvre. **Une optimisation, pas un changement de règles** : la simulation teste les mêmes boîtes
// dans le MÊME ORDRE (celui du niveau) qu'avant, seulement sans celles qui sont loin ; le golden reste identique au bit près. Le coût du rejeu vient des boîtes testées : un niveau entier compte des centaines de boîtes.
// Tout est entier (aucune fonction transcendante) ; la clé d'une cellule est un entier sûr (< 2⁵³).
/** Le côté d'une cellule : 4 m (un peu plus que la boîte du joueur et qu'un pas de dash). */
export const CELLULE = 4_000_000;
/** Une boîte qui recouvre plus de cellules que cela est « grande » : elle est essayée à chaque requête (un sol immense ne remplit pas la grille). */
const CELLULES_MAX = 96;
const DECALAGE = 1 << 19;
const BASE = 1 << 20;
const cle = (cx: number, cy: number, cz: number): number => ((cx + DECALAGE) * BASE + (cy + DECALAGE)) * BASE + (cz + DECALAGE);

/** En dessous de ce nombre de boîtes, l'index coûte plus qu'il ne rapporte : on les essaie toutes (comme avant le lot V2). */
const PETIT = 64;

export class Grille {
  private readonly cellules = new Map<number, number[]>();
  private readonly grandes: number[] = [];
  private readonly vues: Int32Array;
  private tour = 0;
  /** Sans index : toutes les boîtes sont des candidates (un petit niveau, ou la référence exhaustive des tests). */
  private readonly tout: readonly number[] | null;
  private readonly sortie: number[] = [];

  constructor(
    private readonly boites: readonly Boite[],
    exhaustif = false,
  ) {
    this.vues = new Int32Array(boites.length);
    this.tout = exhaustif || boites.length <= PETIT ? boites.map((_, i) => i) : null;
    if (this.tout) return;
    boites.forEach((b, i) => {
      const x0 = Math.floor(b.x0 / CELLULE);
      const y0 = Math.floor(b.y0 / CELLULE);
      const z0 = Math.floor(b.z0 / CELLULE);
      const x1 = Math.floor(b.x1 / CELLULE);
      const y1 = Math.floor(b.y1 / CELLULE);
      const z1 = Math.floor(b.z1 / CELLULE);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > CELLULES_MAX) {
        this.grandes.push(i);
        return;
      }
      for (let x = x0; x <= x1; x++)
        for (let y = y0; y <= y1; y++)
          for (let z = z0; z <= z1; z++) {
            const k = cle(x, y, z);
            const l = this.cellules.get(k);
            if (l) l.push(i);
            else this.cellules.set(k, [i]);
          }
    });
  }

  /** Le nombre de boîtes rangées dans la grille et le nombre de grandes (pour les mesures). */
  get taille(): { dansLaGrille: number; grandes: number } {
    return { dansLaGrille: this.tout ? 0 : this.boites.length - this.grandes.length, grandes: this.grandes.length };
  }

  /**
   * Les indices (CROISSANTS : l'ordre du niveau) des boîtes dont une cellule touche la boîte de requête. Une boîte qui chevauche la requête d'un volume positif partage forcément une cellule avec elle : la liste contient
   * toutes les boîtes qui peuvent la chevaucher, et quelques autres que l'appelant écarte par son propre test. **La liste rendue appartient à la grille** : elle ne se garde pas et ne se modifie pas.
   */
  chercher(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): readonly number[] {
    if (this.tout) return this.tout;
    const a0 = Math.floor(x0 / CELLULE);
    const b0 = Math.floor(y0 / CELLULE);
    const c0 = Math.floor(z0 / CELLULE);
    const a1 = Math.floor(x1 / CELLULE);
    const b1 = Math.floor(y1 / CELLULE);
    const c1 = Math.floor(z1 / CELLULE);
    // Le cas courant : une seule cellule non vide et aucune grande boîte, la liste de la cellule est déjà dans l'ordre.
    let unique: number[] | null = null;
    let plusieurs = this.grandes.length > 0;
    for (let x = a0; x <= a1 && !plusieurs; x++)
      for (let y = b0; y <= b1 && !plusieurs; y++)
        for (let z = c0; z <= c1; z++) {
          const l = this.cellules.get(cle(x, y, z));
          if (!l) continue;
          if (unique) {
            plusieurs = true;
            break;
          }
          unique = l;
        }
    if (!plusieurs) return unique ?? VIDE;
    if (this.tour >= 2_000_000_000) {
      this.vues.fill(0);
      this.tour = 0;
    }
    const t = ++this.tour;
    const vues = this.vues;
    const sortie = this.sortie;
    sortie.length = 0;
    for (const i of this.grandes) {
      vues[i] = t;
      sortie.push(i);
    }
    for (let x = a0; x <= a1; x++)
      for (let y = b0; y <= b1; y++)
        for (let z = c0; z <= c1; z++) {
          const l = this.cellules.get(cle(x, y, z));
          if (!l) continue;
          for (let k = 0; k < l.length; k++) {
            const i = l[k]!;
            if (vues[i] !== t) {
              vues[i] = t;
              sortie.push(i);
            }
          }
        }
    // L'ordre du niveau : le résultat d'une collision dépend de l'ordre dans lequel les boîtes sont essayées.
    if (sortie.length > 1) sortie.sort((a, b) => a - b);
    return sortie;
  }
}
const VIDE: readonly number[] = [];
