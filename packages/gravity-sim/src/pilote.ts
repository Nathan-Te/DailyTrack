import { CASE, LARGEUR_MORCEAU, TAILLE } from "./constantes";
import type { Terrain } from "./monde";
import { Partie } from "./partie";

// Un PILOTE D'ESSAI (lot GR1) : il suit le chemin sûr du générateur en essayant ses coups sur des copies de la partie. **Ce n'est pas le robot des médailles** (lot GR2) : il sert à vérifier que le chemin sûr de chaque
// morceau est franchissable avec la vraie simulation (`test/pilote.test.ts`), à fournir au golden une longue partie qui touche les cinq thèmes, et au module d'essais du serveur (`smoke`, `recette:seed`) des parties valides.
// Déterministe, entier, sans rien d'aléatoire. Le jeu ne l'importe jamais (il ne part pas dans son premier chargement).

interface EtapeAbsolue {
  c0: number;
  c1: number;
  y: number;
  g: 1 | -1;
}

/** Les étapes du chemin sûr des morceaux `k` à `k + 2`, en colonnes absolues, dans l'ordre. */
function etapesDevant(terrain: Terrain, k: number): EtapeAbsolue[] {
  const sortie: EtapeAbsolue[] = [];
  for (let i = k; i <= k + 2; i++) for (const e of terrain.morceau(i).chemin) sortie.push({ c0: i * LARGEUR_MORCEAU + e.c0, c1: i * LARGEUR_MORCEAU + e.c1, y: e.y, g: e.g });
  return sortie;
}

/** Une inversion maintenant mène-t-elle à se poser sur l'étape voulue, vivant et encore vivant 45 pas plus tard ? */
function faisable(p: Partie, e: EtapeAbsolue): boolean {
  const q = p.copier();
  q.appuyer();
  for (let i = 0; i < 220 && !q.finie; i++) {
    q.avancer();
    if (q.sol && q.g === e.g) break;
  }
  if (q.finie || !q.sol || q.g !== e.g) return false;
  const colonne = Math.trunc(q.x / CASE);
  if (colonne < e.c0 - 1 || colonne > e.c1) return false;
  if (Math.trunc((q.y + (TAILLE >> 1)) / CASE) !== e.y) return false; // la bonne surface, pas une autre au passage
  for (let i = 0; i < 45 && !q.finie; i++) q.avancer();
  return !q.finie;
}

/** Joue jusqu'à la mort ou `maxTicks` : rend la liste des appuis. */
export function piloter(terrain: Terrain, maxTicks: number): { appuis: number[]; partie: Partie } {
  const p = new Partie(terrain);
  const appuis: number[] = [];
  let cache: { k: number; etapes: EtapeAbsolue[] } | null = null;
  while (!p.finie && p.tick < maxTicks) {
    const colonne = Math.trunc(p.x / CASE);
    const k = Math.trunc(colonne / LARGEUR_MORCEAU);
    if (!cache || cache.k !== k) cache = { k, etapes: etapesDevant(terrain, k) };
    // Les deux prochaines étapes : la première dont la gravité n'est pas la nôtre est visée ; on inverse au premier coup qui s'y pose (jamais plus tôt, jamais seulement trop tard).
    if (p.peutInverser) {
      const devant = cache.etapes.filter((e) => e.c1 > colonne + 1).slice(0, 2);
      const cible = devant.find((e) => e.g !== p.g);
      if (cible && faisable(p, cible)) {
        p.appuyer();
        appuis.push(p.tick);
      }
    }
    p.avancer();
  }
  return { appuis, partie: p };
}
