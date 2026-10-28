// Lot N2 : la visibilité de la page, pour tout ce qui ne doit rien faire quand l'onglet est caché (le message en direct ne se relit que sur une page visible). Le seul
// endroit du socle qui lit `document.visibilityState` ; `@cdj/profile` (qui ne touche jamais au document) la reçoit en paramètre.

export interface VisibiliteDeLaPage {
  /** L'onglet est-il visible ? Vrai hors navigateur. */
  visible: () => boolean;
  /** S'abonner aux changements de visibilité ; rend de quoi se désabonner. */
  surVisibilite: (rappel: () => void) => () => void;
}

export function visibiliteDeLaPage(doc: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener"> | undefined = typeof document === "undefined" ? undefined : document): VisibiliteDeLaPage {
  return {
    visible: () => !doc || doc.visibilityState === "visible",
    surVisibilite: (rappel) => {
      if (!doc) return () => {};
      doc.addEventListener("visibilitychange", rappel);
      return () => doc.removeEventListener("visibilitychange", rappel);
    },
  };
}
