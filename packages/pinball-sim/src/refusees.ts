// Les tables refusées par la validation (lot PB4) : la clé `thème:module,…` de chacune (`cleDeTable`). **Produit par `npm run valider:pinball -w @cdj/pinball-sim -- --ecrire`**, jamais à la main : l'outil valide les 444
// tables que le générateur peut tirer (`toutesLesTables`) et écrit ici celles qu'il refuse. Le générateur ne les sert jamais : il passe à la graine suivante (`dailyPinball`).
// Changer le robot, la validation ou la simulation peut changer cette liste : la relancer, et **si elle change, monter `PINBALL_GENERATOR_VERSION`** (un jour déjà servi ne change pas : règle des jours figés).
// Dernière validation : générateur g3, 444 tables, 0 refusée(s).
export const TABLES_REFUSEES: readonly string[] = [];
