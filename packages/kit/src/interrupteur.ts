import { demarrerInterrupteur, fetchAvecCleApercu, type Ouverture } from "@cdj/profile";
import { bandeauApercu, ecranBientot } from "@cdj/ui/src/interrupteur";

// L'interrupteur des jeux côté client, la seule copie (lot K3 ; avant : `interrupteur.ts` de Track, de Jump et de Tower, identiques au nom du jeu près). **Chargé à la demande** par
// `brancherInterrupteur` (`branche.ts`). Lit l'état des jeux (`GET /api/jeux`, repli : la liste construite où seuls les jeux déjà publics sont `on`), puis montre : le jeu (`on`), le jeu avec le
// bandeau « Aperçu » / le badge « Brouillon » (clé d'aperçu, ou aperçu de PR), ou la page « Bientôt » qui prend l'écran. Logique : `@cdj/profile`. Le nom du jeu (sa fiche : `nom`) est donné par le jeu.

function montrer(o: Ouverture, nom: string): void {
  if (o.vue === "ouvert") return;
  if (o.vue === "apercu") {
    document.body.append(bandeauApercu({ brouillon: o.brouillon }));
    return;
  }
  // « Bientôt » : le jeu n'est pas ouvert. Son écran est retiré (le joueur ne joue à rien) et la page prend la place.
  document.body.replaceChildren(ecranBientot({ nom, portail: "../" }));
}

/** Démarre l'interrupteur pour le jeu `jeu` ; `base` : l'API de la page. */
export async function demarrer(jeu: string, nom: string, base: string, stockage: Storage | null): Promise<void> {
  const o = await demarrerInterrupteur({
    jeu,
    base,
    stockage,
    adresse: location,
    remplacerAdresse: (a) => history.replaceState(history.state, "", a),
    poserCle: (cle) => {
      const original = window.fetch.bind(window);
      const avecCle = fetchAvecCleApercu(base, cle, original);
      window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => (typeof input === "string" ? avecCle(input, init ?? {}) : original(input, init))) as typeof fetch;
    },
  });
  montrer(o, nom);
}
