import { PREMIER_JOUR } from "@cdj/sim";
import { premierJourDuJour } from "@cdj/core/lancement";

// Lot R8 : les archives de Track commencent à la journée n° 1 de Du Jour (le lancement public), `config/lancement.json` : les circuits d'avant
// ne sont plus proposés. La recette, les aperçus et les e2e déplacent ce jour à la construction (`VITE_LANCEMENT_PREMIER_JOUR`, jamais en
// production). Un circuit d'avant reste jouable à la main (`?seed=`), comme tout circuit tiré au hasard : il n'est simplement plus listé.

type Env = { env: Record<string, string | undefined> };
function surcharge(): string | undefined {
  try {
    // Accès écrit en entier : Vite ne remplace que cette forme à la construction. Sous Node (specs Playwright), l'accès lève.
    return (import.meta as unknown as Env).env.VITE_LANCEMENT_PREMIER_JOUR;
  } catch {
    return undefined;
  }
}

/** Le premier jour des archives de Track : la journée n° 1 de Du Jour, jamais avant le circuit n° 1 de Track (`PREMIER_JOUR` de `@cdj/sim`). */
export const PREMIER_JOUR_ARCHIVES: number = Math.max(PREMIER_JOUR, premierJourDuJour(surcharge()));
