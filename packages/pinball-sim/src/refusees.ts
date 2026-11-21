// Les tables refusées par la validation (lot PB4) : la clé `thème:table:module,…` de chacune (`cleDeTable`). **Produit par `npm run valider:pinball -w @cdj/pinball-sim -- --ecrire`**, jamais à la main : l'outil valide toutes les
// tables que le générateur peut tirer (`toutesLesTables`) et écrit ici celles qu'il refuse. **Lot PBT1 : les tables sont dessinées, il n'y a plus de graine suivante** — le générateur ne passe plus à une autre table ; une table
// refusée serait un défaut de dessin à corriger (critère d'arrêt du lot : les 24 passent, la liste est vide).
// Changer le robot, la validation ou la simulation peut changer cette liste : la relancer, et **si elle change, monter `PINBALL_GENERATOR_VERSION`**.
// Dernière validation : générateur g9, 24 tables, 0 refusée(s).
export const TABLES_REFUSEES: readonly string[] = [];
