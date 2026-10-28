// Généré par `npm run etats:modules -w @cdj/jump-sim` (lot 28) à partir de `modules/etats.json` : ne pas modifier à la main.
// Un test vérifie que ce fichier est exactement celui que le script écrirait (sinon : « relancer etats:modules »).

/**
 * Lot 28 — **reprise depuis l'état B des blocs alternés** : les variantes (par morceau) à blocs alternés dont la reprise sur le point de passage qui les précède, les blocs étant dans
 * l'état B (celui que la reprise garde depuis la version 12), n'a pas de solution jouable par un humain, à l'une des phases essayées de leur horloge. Le générateur g22 ne les pose jamais
 * (`daily.ts`) ; le détail est dans `modules/etats.json`.
 */
export const ALT_B_REFUSED: Readonly<Record<string, readonly number[]>> = {"laser-alterne-portes":[6]};
