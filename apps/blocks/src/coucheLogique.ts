// La couche de la musique au combo (lot B6), la **décision**, pure : une couche légère s'ajoute à la musique (un arpège, ou une nappe : `@cdj/musique`, `docs/plateforme/musique.md`) quand le combo atteint ×3, et repart dès que le
// combo est perdu ou que la partie finit. C'est de l'affichage : rien ne touche la simulation ni la rediffusion. Elle passe par le bus de la musique : elle suit son volume, son « couper » et la baisse du kit, donc elle reste sous les
// effets (les demi-tons du combo, `sonsLogique.ts`).

/** Le combo à partir duquel la couche entre. */
export const SEUIL_COUCHE = 3;

/** La couche doit-elle jouer ? Le combo atteint le seuil et la partie n'est pas finie. */
export const coucheVoulue = (combo: number, finie: boolean): boolean => !finie && combo >= SEUIL_COUCHE;

export interface SuiviCouche {
  /** L'état de la partie après une pose (ou au départ) : demande l'entrée ou la sortie de la couche seulement quand elle change. */
  maj(combo: number, finie: boolean): void;
  /** La partie est détruite : la couche sort. */
  arreter(): void;
  /** Ce qu'on a demandé en dernier (pour `?debug`). */
  actif(): boolean;
}

/** Le suivi d'une partie : ne dit à la musique que les changements (jamais deux `couche(true)` de suite). `musique` est celle du kit (`null` : le jeu tourne sans, comme dans les tests). */
export function suivreCouche(musique: { couche(actif: boolean): void } | null): SuiviCouche {
  let actif = false;
  const poser = (a: boolean): void => {
    if (a === actif) return;
    actif = a;
    musique?.couche(a);
  };
  return { maj: (combo, finie) => poser(coucheVoulue(combo, finie)), arreter: () => poser(false), actif: () => actif };
}
