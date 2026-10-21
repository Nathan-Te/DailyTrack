import type { Catalogue } from "@cdj/ui";
import { en as accueil } from "./catalogue.accueil.en";
import { en as arrivee } from "./catalogue.arrivee.en";
import { en as base } from "./catalogue.base.en";
import { en as partie } from "./catalogue.partie.en";
import { en as reglages } from "./catalogue.reglages.en";

// L'anglais de Jump (lot I5), toutes zones réunies : un module à part, chargé par `import()` seulement quand la langue du joueur est l'anglais (i18n.ts).
export const CATALOGUE_EN: Catalogue = Object.assign({}, base, partie, accueil, arrivee, reglages);

// Lot I6 : l'anglais du catalogue commun de @cdj/ui voyage avec celui du jeu (le même fichier chargé à la demande, i18n.ts).
export { CATALOGUE_COMMUN_EN } from "@cdj/ui";
