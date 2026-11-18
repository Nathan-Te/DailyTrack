import type { GameDefinition } from "../src/games";
import { type ContratMinimal, definirJeuNeuf } from "../src/jeux/index";
import { contratEssai, ficheEssai } from "./jeuNeufAide";

// Lot D4 — un **jeu fictif du kit dont les seuils des médailles coûtent 3 s de processeur** (le robot de Pinball en met 15 à 20) : celui du jeu jouet de `jeuNeufAide.ts`, dont les seuils tournent à vide. Il est dans le serveur
// du test **et** dans le script du fil de calcul du test (`niveauxKitTravail.ts`) : même code des deux côtés, seul le fil qui le fait tourner change.

/** Ce que coûtent les seuils du jeu fictif (ms de processeur, boucle active : elle fige le fil qui la fait tourner). */
export const SEUILS_LENTS_MS = 3_000;

export function contratLent(): ContratMinimal<{ jour: number }, never, never> {
  const base = contratEssai("score") as unknown as ContratMinimal<{ jour: number }, never, never>;
  return {
    ...base,
    seuils: (niveau) => {
      const fin = Date.now() + SEUILS_LENTS_MS;
      while (Date.now() < fin) Math.sqrt(niveau.jour); // le robot qui joue la table : du calcul, pas de l'attente
      return { author: 200, gold: 100, silver: 50, bronze: 20 };
    },
    themeDuJour: () => "plat",
  };
}

export const JEU_LENT = definirJeuNeuf<{ jour: number }, never, never, never>({ fiche: ficheEssai("score"), nom: "EssaiScore" }, () => contratLent()) as unknown as GameDefinition<never>;
