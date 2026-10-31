import { demarrerInterrupteur, fetchAvecCleApercu, type Ouverture } from "@cdj/profile";
import { bandeauApercu, ecranBientot } from "@cdj/ui/src/interrupteur";
import { gameStorage } from "./stockage";

// Lot P — l'interrupteur des jeux, côté Tower (chargé à la demande par `interrupteurInit.ts`). Lit l'état des jeux (`GET /api/jeux`, repli : la liste construite où seuls les jeux déjà publics sont
// `on`), puis montre : le jeu (`on`), le jeu avec le bandeau « Aperçu » / le badge « Brouillon » (clé d'aperçu, ou aperçu de PR), ou la page « Bientôt » qui prend l'écran. Logique : `@cdj/profile`.

const JEU = "tower";

function montrer(o: Ouverture): void {
  if (o.vue === "ouvert") return;
  if (o.vue === "apercu") {
    document.body.append(bandeauApercu({ brouillon: o.brouillon }));
    return;
  }
  // « Bientôt » : le jeu n'est pas ouvert. Son écran est retiré (le joueur ne joue à rien) et la page prend la place.
  document.body.replaceChildren(ecranBientot({ nom: "Tower", portail: "../" }));
}

/** Démarre l'interrupteur pour Tower ; `base` : l'API de la page. */
export async function demarrer(base: string): Promise<void> {
  const o = await demarrerInterrupteur({
    jeu: JEU,
    base,
    stockage: gameStorage(),
    adresse: location,
    remplacerAdresse: (a) => history.replaceState(history.state, "", a),
    poserCle: (cle) => {
      const original = window.fetch.bind(window);
      const avecCle = fetchAvecCleApercu(base, cle, original);
      window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => (typeof input === "string" ? avecCle(input, init ?? {}) : original(input, init))) as typeof fetch;
    },
  });
  montrer(o);
}
