// Le hasard d'AFFICHAGE (lot T5) : clignements, gouttes, secousses. **Ce n'est jamais le hasard de la simulation** : la partie ne tire aucun nombre (elle est déterministe, ses entrées sont les
// commandes), et ce module n'importe rien de `@cdj/tower-sim` ni de `@cdj/core`. Il ne lit jamais `Math.random` ni l'horloge : une graine donne toujours la même suite (testable), et tirer
// des nombres ici ne change pas un octet d'une partie ni d'une rediffusion (`test/hasardAffichage.test.ts`).

/** Un générateur de nombres dans [0, 1), mulberry32, d'une graine entière. */
export function hasardAffichage(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Une graine propre à une pièce (son numéro) et à une partie d'affichage : des clignements différents d'une pièce à l'autre. */
export const graineDePiece = (id: number, partie: number): number => (Math.imul(id + 1, 0x9e3779b1) ^ Math.imul(partie + 7, 0x85ebca6b)) >>> 0;
