import type { Musique } from "@cdj/musique/branche";

// Le volume et le « couper » du kit : la musique commune (`@cdj/musique`) en tient les réglages (écran Réglages › Son) ; `main.ts` la fournit ici, comme le traducteur (`textes.ts`). La scène y lit le niveau de ses effets.
let courante: Musique | null = null;
export const fournirMusique = (m: Musique): void => {
  courante = m;
};
export const musiqueDuKit = (): Musique | null => courante;
