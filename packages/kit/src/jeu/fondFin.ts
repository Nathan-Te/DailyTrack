// Le fondu de fin de partie (lot B6), pur : quand la partie est jouée mais que l'écran de fin n'est pas encore là (« Plus de place ! » chez Blocks), la musique **retombe** doucement ; à l'écran de fin
// elle **remonte**. Un jeu dont la partie finit d'un coup (aucun `finEnCours`) fait les deux à la suite : elle retombe, puis remonte quand la chute est finie. Seuls les jeux assemblés par `brancherJeu`
// passent par là ; Track, Jump et Tower gardent leur propre musique de fin.

/** Le niveau où la musique retombe à la fin d'une partie (1 = la musique pleine ; en partie le kit la tient à 0,6). */
export const NIVEAU_FIN = 0.35;
/** Combien de temps la musique met à retomber (secondes) : environ la durée de « Plus de place ! ». */
export const FONDU_RETOMBEE_S = 1.2;
/** Combien de temps elle met à remonter à l'écran de fin (secondes). */
export const FONDU_REMONTEE_S = 1.5;

export interface FondFin {
  /** La partie est jouée, l'écran de fin n'est pas encore là : la musique retombe (une seule fois par partie). */
  retomber(): void;
  /** L'écran de fin s'ouvre : la musique remonte à 1. */
  remonter(): void;
  /** Une nouvelle partie : tout repart de zéro. */
  reinitialiser(): void;
}

export function creerFondFin(musique: { baisser(niveau: number, duree?: number): void }, planifier: (ms: number, fn: () => void) => void): FondFin {
  let retombee = false;
  let jeton = 0;
  const retomber = (): void => {
    if (retombee) return;
    retombee = true;
    musique.baisser(NIVEAU_FIN, FONDU_RETOMBEE_S);
  };
  return {
    retomber,
    remonter() {
      const j = ++jeton;
      if (retombee) return musique.baisser(1, FONDU_REMONTEE_S);
      // Aucune retombée en cours (la partie a fini d'un coup) : elle retombe, puis remonte quand la chute est finie, sauf si une autre partie a commencé entre-temps.
      retomber();
      planifier(FONDU_RETOMBEE_S * 1000, () => void (j === jeton && retombee && musique.baisser(1, FONDU_REMONTEE_S)));
    },
    reinitialiser() {
      jeton++;
      retombee = false;
    },
  };
}
