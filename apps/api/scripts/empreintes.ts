import { createHash } from "node:crypto";

// Lot R6 (le garde-fou des jours) : l'empreinte de ce que chaque jeu SERT pour un jour, calculée par le code d'une construction. Lot K4b : chaque jeu a son module
// (`<id>-empreintes.ts`, nommé par `jours.fabrication.empreinte` de sa fiche) qui exporte `empreinteJour(jour, dossier)` ; ce fichier-ci n'a que ce qu'ils partagent. Ces modules ne dépendent que des
// paquets `@cdj/*` (aucune route, aucune base) : « Mettre en production » les copie, avec `empreintes-jours.ts`, dans le dépôt du code actuellement en production pour comparer, jour par jour, ce que
// la production sert et ce que servira la nouvelle construction (`scripts/mise-en-production.mjs empreintes`, `comparer`). Le test `jours-passes.test.ts` s'en sert aussi.

export interface EmpreinteJour {
  /** Identifiant du circuit, du niveau ou du contenu (`jour-AAAA-MM-JJ-g<N>`). */
  id: string;
  /** SHA-256 (16 premiers caractères hexadécimaux) de ce qui définit le jour. */
  h: string;
  /** Vrai si le jour est valide : ni circuit de secours (Track), ni niveau de secours (Jump), contenu intact (Tower). */
  ok: boolean;
}

export const sha = (x: unknown): string => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 16);
