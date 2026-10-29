// Socle partagé entre les jeux du dépôt (DailyTrack, DailyJump) : aucune logique de jeu, aucune dépendance, aucun `Date` ni transcendante.
// Un module n'entre ici que lorsqu'un deuxième jeu en a besoin ; les golden des deux jeux doivent rester inchangés (docs/jump/consignes.md).

export * from "./rng";
export * from "./calendar";
export * from "./codec";
export * from "./sacThemes";
// Lot R8 : la date du lancement public est à part (`@cdj/core/lancement`) : elle lit `config/lancement.json`, et ni les simulations ni leurs
// scripts n'ont à la tirer.
