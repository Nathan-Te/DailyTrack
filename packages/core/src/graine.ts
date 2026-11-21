// Lot PA1 — **la graine du jour d'un jeu Party** : le « niveau » d'un jour de Party est cette graine et rien d'autre (un jeu Party ne change pas d'un jour à l'autre : seuls ses tirages changent). Le
// client la calcule ici, le serveur aussi (`GET /api/<jeu>/day/<date>` la rend dans `contenu.graine`, mais le rejeu la recalcule lui-même : l'envoi ne la porte jamais). Pure : entiers seulement,
// FNV-1a sur 32 bits (le même résultat dans tous les moteurs), aucun hasard ni `Date`.

/** La graine (entier non signé de 32 bits) du jour de Paris numéro `jour` pour le jeu `code` : deux jeux n'ont pas la même, un jour ne rend jamais la graine d'un autre. */
export function graineDuJour(code: string, jour: number): number {
  let h = 0x811c9dc5;
  for (const c of `${code}|${jour}`) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
