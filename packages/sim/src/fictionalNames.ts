// Les pseudos des pilotes fictifs (lots 11 et 26), dans leur propre fichier (lot 36) : le Salon de démonstration les liste au premier écran, alors que le
// pilote automatique qui les fait rouler (`fictional.ts`) n'est calculé que dans un fil de travail.

/** Pseudos fictifs (acceptés par `cleanName`) : un préfixe qui ne laisse aucun doute. */
export const FICTIONAL_NAMES = [
  "Démo Renard", "Démo Mistral", "Démo Zéphyr", "Démo Orage", "Démo Cactus", "Démo Brume", "Démo Étincelle", "Démo Galet",
  "Démo Tonnerre", "Démo Plume", "Démo Cyclone", "Démo Marmotte", "Démo Comète", "Démo Bouchon", "Démo Fusée", "Démo Tortue",
  "Démo Rafale", "Démo Pirate", "Démo Lynx", "Démo Biscotte", "Démo Aurore", "Démo Crabe", "Démo Chicane", "Démo Nitro",
  "Démo Pétale", "Démo Vortex", "Démo Gaufre", "Démo Sirocco", "Démo Mulot", "Démo Turbine",
] as const;
