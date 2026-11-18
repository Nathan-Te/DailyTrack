// Les tables refusées par la validation (lot PB4) : la clé `thème:plan:module,…` de chacune (`cleDeTable`). **Produit par `npm run valider:pinball -w @cdj/pinball-sim -- --ecrire`**, jamais à la main : l'outil valide les 500
// tables que le générateur peut tirer (`toutesLesTables`) et écrit ici celles qu'il refuse. Le générateur ne les sert jamais : il passe à la graine suivante (`dailyPinball`).
// Changer le robot, la validation ou la simulation peut changer cette liste : la relancer, et **si elle change, monter `PINBALL_GENERATOR_VERSION`** (un jour déjà servi ne change pas : règle des jours figés).
// Dernière validation : générateur g8, 94 tables, 4 refusée(s).
export const TABLES_REFUSEES: readonly string[] = [
  "ocean:boucle:tourbillon,trou,bumpers,mini,spinner,mini",
  "ocean:boucle:tourbillon,trou,mini,mini,spinner,mini",
  "ocean:doublette:tourbillon,trou,bumpers,mini,spinner,mini",
  "ocean:doublette:tourbillon,trou,mini,mini,spinner,mini",
];
