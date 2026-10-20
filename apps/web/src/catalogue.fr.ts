import type { Catalogue } from "@cdj/ui";
import { fr as accueil } from "./catalogue.accueil.fr";
import { fr as base } from "./catalogue.base.fr";
import { fr as course } from "./catalogue.course.fr";
import { fr as reglages } from "./catalogue.reglages.fr";
import { fr as salon } from "./catalogue.salon.fr";

// Le français de DailyTrack (lot I4), toutes zones réunies : chargé avec le jeu (et pré-rempli dans le HTML à la construction : vite.config.ts). L'anglais est dans
// `catalogue.en.ts`, un autre fichier que le jeu ne charge qu'à la demande (i18n.ts : un joueur en anglais, ou qui passe à l'anglais) — il ne pèse pas sur le premier
// chargement des joueurs en français (budget : apps/web/e2e/perf.spec.ts). Les textes des composants du socle et les codes d'erreur du serveur sont dans le catalogue
// commun de `@cdj/ui`. Une clé n'est définie qu'une fois (packages/ui/test/catalogues.test.ts).
export const CATALOGUE_FR: Catalogue = Object.assign({}, base, accueil, course, reglages, salon);
