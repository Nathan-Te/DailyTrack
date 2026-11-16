// Lot K8 — **le relâchement d'une action** : `PartieDuJeu.actionRelachee?(id)`. Le kit ne signalait que l'appui (`action`) ; un jeu dont une action se TIENT (le batteur d'un flipper) écoutait lui-même le clavier,
// le toucher et la manette. Ce module garde, pour chaque action de la partie, **qui la tient** (une source : `clavier:<code>`, `manette:<id>`, `ecran:<id>`…) et ne dit « relâchée » qu'au départ de la dernière
// source : deux touches de la même action (ou la touche et la manette) ne la relâchent pas à la première levée. **Pur** (aucun DOM) : `partie.ts` y branche le clavier et la manette, les tests le jouent seul.
// La source du clavier est le **code de la touche pressée** : au relâchement on relâche ce que CETTE pression a déclenché, quelles que soient les touches choisies entre-temps par le joueur (réglages
// ouverts pendant que la touche est tenue) et les modificateurs du moment : jamais une action « coincée ».
export interface Tenues {
  /** Une source presse l'action (déjà passée à `PartieDuJeu.action`). */
  presser(id: string, source: string): void;
  /** Une source se lève : toute action qu'elle tenait est relâchée, si plus aucune autre source ne la tient. Sans effet si la source ne tenait rien. */
  relacherSource(source: string): void;
  /** Toutes les actions tenues sont relâchées (pause, fin de partie, fenêtre qui perd le focus), dans l'ordre où elles ont été pressées. */
  toutRelacher(): void;
  /** Oublie tout sans rien relâcher (la partie va être détruite). */
  vider(): void;
  /** Les actions tenues en ce moment. */
  tenues(): string[];
}

export function creerTenues(relacher: (id: string) => void): Tenues {
  const parAction = new Map<string, Set<string>>(); // action → sources qui la tiennent
  const lever = (id: string, source: string): void => {
    const sources = parAction.get(id);
    if (!sources?.delete(source)) return;
    if (sources.size === 0) {
      parAction.delete(id);
      relacher(id);
    }
  };
  return {
    presser(id, source) {
      let s = parAction.get(id);
      if (!s) parAction.set(id, (s = new Set()));
      s.add(source);
    },
    relacherSource(source) {
      for (const id of [...parAction.keys()]) lever(id, source);
    },
    toutRelacher() {
      const ids = [...parAction.keys()];
      parAction.clear();
      for (const id of ids) relacher(id);
    },
    vider: () => parAction.clear(),
    tenues: () => [...parAction.keys()],
  };
}
