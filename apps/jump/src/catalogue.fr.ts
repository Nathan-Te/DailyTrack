import type { Catalogue } from "@cdj/ui";
import { fr as accueil } from "./catalogue.accueil.fr";
import { fr as arrivee } from "./catalogue.arrivee.fr";
import { fr as base } from "./catalogue.base.fr";
import { fr as partie } from "./catalogue.partie.fr";
import { fr as reglages } from "./catalogue.reglages.fr";

// Le français de Jump (lot I5), toutes zones réunies : chargé avec le jeu (et pré-rempli dans le HTML à la construction : vite.config.ts). L'anglais est dans
// `catalogue.en.ts`, un autre fichier que le jeu ne charge qu'à la demande (i18n.ts) : il ne pèse pas sur le premier chargement des joueurs en français
// (budget : apps/jump/e2e/poids.spec.ts). Les textes des composants du socle, les codes d'erreur du serveur et les répliques des thèmes sont dans le
// catalogue commun de `@cdj/ui`. Une clé n'est définie qu'une fois (packages/ui/test/catalogues.test.ts).
export const CATALOGUE_FR: Catalogue = Object.assign({}, base, partie, accueil, arrivee, reglages);
