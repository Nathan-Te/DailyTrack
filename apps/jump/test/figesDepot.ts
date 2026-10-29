import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { declareFrozenGenerators } from "@cdj/jump-sim";

// Lot V1 : la page déclare à la simulation les niveaux figés d'avant le sac de thèmes (`src/frozen.ts`, liste écrite à la construction) et le serveur fait de même avec ses fichiers.
// Un test qui calcule le niveau d'un jour proche des niveaux figés du dépôt (les jours de démonstration) importe ce fichier pour voir les mêmes thèmes que la page et le jeu de données.
const dossier = join(import.meta.dirname, "../public/levels");
declareFrozenGenerators(
  Object.fromEntries(
    readdirSync(dossier)
      .map((f) => /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1])
      .filter((d): d is string => d !== undefined)
      .map((d) => [d, (JSON.parse(readFileSync(join(dossier, `${d}.json`), "utf8")) as { generatorVersion: number }).generatorVersion]),
  ),
);
