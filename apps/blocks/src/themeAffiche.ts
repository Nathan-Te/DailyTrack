import { themeDuJour } from "@cdj/blocks-sim";
import { parisDay } from "@cdj/clock";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
import { lireEssai } from "./essai";

// Le thème affiché d'un jour : `?theme=` (essai local, jamais en production), sinon celui du jour (le sac de thèmes commun, `@cdj/blocks-sim`). Un thème n'a aucun effet de jeu : il ne change ni la suite, ni le classement.
export const themeAffiche = (jour: number): string => lireEssai(typeof location === "undefined" ? "" : location.search, BUILD_RESTRICTED, parisDay(Date.now())).theme ?? themeDuJour(jour);
