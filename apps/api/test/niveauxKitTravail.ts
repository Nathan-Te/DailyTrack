// Lot D4 — le script du fil de calcul du test `niveauxKit.test.ts` : la boucle de la plateforme (`servirNiveaux`) avec, pour seul jeu, le jeu fictif aux seuils lents.
import { parentPort } from "node:worker_threads";
import { servirNiveaux } from "../src/niveauxFil";
import { JEU_LENT } from "./niveauxKitJeu";

if (!parentPort) throw new Error("se lance dans un fil de calcul");
servirNiveaux(parentPort, [JEU_LENT]);
