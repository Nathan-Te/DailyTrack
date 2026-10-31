import { useLegacyCatalog } from "../src/legacy";

// Lot 30 : les tests qui régénèrent un niveau d'une version d'avant la 13 (golden et références v3 à v12) ont besoin du catalogue d'avant le maintien minimal du saut,
// que le jeu n'embarque plus (`src/legacy/`). `import "./legacy";` en tête du fichier.
useLegacyCatalog();
