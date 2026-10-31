// `prefers-reduced-motion` (charte § 8, lot T5) : le mouvement réduit coupe la secousse de caméra et la gerbe ; les yeux, les traînées du vent (aplats qui défilent) et les sons restent. Une
// seule fonction, injectable en test.

/** Le joueur a-t-il demandé de réduire les mouvements ? Faux hors navigateur. */
export function mouvementReduit(fenetre: Pick<Window, "matchMedia"> | undefined = typeof window === "undefined" ? undefined : window): boolean {
  try {
    return fenetre?.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}
