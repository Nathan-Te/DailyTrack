import { initialiserGeneration } from "@cdj/profile";
import { gameStorage } from "./stockage";
import type { EcranMessage, MessageEnDirect } from "./message";

// Le branchement d'un jeu à la plateforme, **premier chargement** (lot K3) : deux fonctions, une ligne chacune dans le `generationInit.ts` et le `interrupteurInit.ts` du jeu. Comme
// `@cdj/musique/branche`, ce fichier reste minuscule : tout le reste est à la demande (`import()`), et il n'importe de `@cdj/profile` que ce que tout jeu charge déjà.

/**
 * Lot R8 : noter qu'un navigateur sans donnée de jeu est neuf, **avant** que le reste du jeu écrive quoi que ce soit (à appeler en tête de `main.ts`). La démonstration (`?api=demo`, `demonstration()`)
 * n'écrit rien dans le vrai stockage et ne parle à aucun serveur : pas de génération à noter. Ne lève jamais (stockage ou adresse refusés : rien ne s'efface).
 */
export function noterGeneration(demonstration: () => boolean): void {
  try {
    const store = demonstration() ? null : gameStorage();
    if (store) initialiserGeneration(store);
  } catch {
    /* stockage refusé : rien ne s'efface */
  }
}

/**
 * Lot P : lance la lecture de l'état des jeux (`interrupteur.ts`, **à la demande**) ; `nom` : le nom du jeu (sa fiche). Un jeu `on` ne l'attend pas ; un lien d'aperçu (`apercu`) ou une clé d'aperçu déjà gardée est attendu :
 * la clé part dans l'en-tête `X-Preview-Key` avant le premier appel à l'API. `base` : l'API de la page (jamais `demo`). Rend la promesse à attendre, ou `undefined`.
 */
export function brancherInterrupteur(jeu: string, nom: string, base: string, apercu: boolean): Promise<void> | undefined {
  const stockage = gameStorage();
  const l = import("./interrupteur").then((m) => m.demarrer(jeu, nom, base, stockage));
  return apercu || stockage?.getItem(`cdj:apercu:${jeu}`) ? l : undefined;
}

/**
 * Le message en direct **à la demande** (lot K3) : le bandeau, sa surveillance et son placement (`message.ts`, ≈ 1,8 ko) ne sont chargés qu'au **premier écran qui a le droit de l'afficher** ; avant, et pour un
 * jeu qui n'en montre jamais, rien n'est dans le premier chargement. `charger` est un `import()` du jeu qui monte le message avec ses options. Le dernier écran demandé est rejoué à l'arrivée du module ;
 * un message arrive de toute façon du réseau, jamais tout de suite.
 */
export function messageALaDemande(charger: () => Promise<MessageEnDirect>): MessageEnDirect {
  let m: MessageEnDirect | undefined;
  let p: Promise<void> | undefined;
  let voulu: EcranMessage | null = null;
  return {
    montrer(e) {
      voulu = e;
      if (m) return m.montrer(e);
      if (e !== null) p ??= charger().then((x) => ((m = x), m.montrer(voulu)));
    },
    etat: () => m?.etat() ?? { ecran: voulu, id: null, ton: null, dessine: false, lectures: 0 },
  };
}
