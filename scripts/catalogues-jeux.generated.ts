// GÉNÉRÉ par `npm run fiches` (lot K1 : config/jeux/<id>.json → traductions) — NE PAS MODIFIER À LA MAIN : changer la fiche du jeu, puis relancer la commande.
// Un test vérifie que ce fichier est à jour.
import { CATALOGUE_CIBLES } from "../apps/cibles/src/catalogue";
import { CATALOGUE_BLOCKS } from "../apps/blocks/src/catalogue";
import { CATALOGUE_RUSH } from "../apps/rush/src/catalogue";

type Bilingue = { fr: Record<string, string>; en: Record<string, string> };
// [nom (de l'application), fichiers, catalogue, titre dans le document].
export const CATALOGUES_JEUX_NEUFS: [string, string, Bilingue, string][] = [
  ["apps/cibles", "apps/cibles/src/catalogue.*.ts", CATALOGUE_CIBLES as unknown as Bilingue, "Cibles"],
  ["apps/blocks", "apps/blocks/src/catalogue.*.ts", CATALOGUE_BLOCKS as unknown as Bilingue, "Blocks"],
  ["apps/rush", "apps/rush/src/catalogue.*.ts", CATALOGUE_RUSH as unknown as Bilingue, "Rush"],
];
