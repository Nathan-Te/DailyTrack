// Le bouton fantôme (lot K3) : un cycle d'états qui **saute ceux qui n'existent pas** (règle G1 : un fantôme se débloque en finissant). Le cycle de Tower (Aucun → Ma meilleure → Diamant) et celui de
// Jump (le tien → le premier → aucun) ne diffèrent que par la liste et par ce qui est disponible ; la forme du fantôme (trajectoire d'une voiture, rediffusion, silhouette de tour) reste au jeu.

/**
 * L'état d'après `courant` dans `ordre` (en bouclant), en sautant ceux que `disponible` refuse. Un état courant qui n'existe plus mène au suivant possible ; si rien n'est possible : `repli`.
 */
export function suivantDisponible<E extends string>(ordre: readonly E[], courant: E, disponible: (e: E) => boolean, repli: E): E {
  const i = ordre.indexOf(courant);
  for (let k = 1; k <= ordre.length; k++) {
    const e = ordre[(i + k) % ordre.length]!;
    if (disponible(e)) return e;
  }
  return repli;
}
