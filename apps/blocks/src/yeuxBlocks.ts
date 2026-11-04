import type { Case } from "./boites";

// Les YEUX des pièces posées (seed § 7 ; maquettes B0, question 5) : **une paire par morceau d'une pièce posée, sur sa case la plus centrale**, jamais une par case. Quand un effacement coupe une pièce en deux
// morceaux, chacun garde une paire. Pur : la scène dessine, le module commun (`@cdj/visuels/blocs`) dit comment un œil se pose et se ferme.

/** Les morceaux d'un ensemble de cases (voisines par un côté, pas par un coin), dans l'ordre de leur première case (lignes puis colonnes). */
export function morceaux(cases: readonly Case[]): Case[][] {
  const restant = new Map<number, Case>(cases.map((c) => [c.ligne * 100 + c.col, c]));
  const out: Case[][] = [];
  for (const depart of [...cases].sort((a, b) => a.ligne - b.ligne || a.col - b.col)) {
    if (!restant.has(depart.ligne * 100 + depart.col)) continue;
    const morceau: Case[] = [];
    const pile = [depart];
    restant.delete(depart.ligne * 100 + depart.col);
    while (pile.length > 0) {
      const c = pile.pop()!;
      morceau.push(c);
      for (const [dc, dl] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const cle = (c.ligne + dl) * 100 + c.col + dc;
        const v = restant.get(cle);
        if (v) {
          restant.delete(cle);
          pile.push(v);
        }
      }
    }
    out.push(morceau.sort((a, b) => a.ligne - b.ligne || a.col - b.col));
  }
  return out;
}

/** La case des yeux d'un morceau : la plus proche de son centre ; à égalité, la première (lignes puis colonnes). */
export function caseDesYeux(morceau: readonly Case[]): Case {
  const cx = morceau.reduce((s, c) => s + c.col, 0) / morceau.length;
  const cy = morceau.reduce((s, c) => s + c.ligne, 0) / morceau.length;
  let meilleur = morceau[0]!;
  let dist = Infinity;
  for (const c of morceau) {
    const d = (c.col - cx) ** 2 + (c.ligne - cy) ** 2;
    if (d < dist - 1e-9) {
      dist = d;
      meilleur = c;
    }
  }
  return meilleur;
}
