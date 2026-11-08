import { ouvrirContexteAudio } from "@cdj/core/audio";
import type { ContexteAudio, Dependances, StockageMin } from "./lecteur";
import type { JeuMusique } from "./types";

// Les dépendances réelles du lecteur : le navigateur. Seul fichier du paquet qui touche `window`, `document`, `fetch`, Web Audio et le stockage (lot S2 : jamais d'élément `<audio>`) ; tout le reste est injecté
// (donc testé sans navigateur). Chargé avec le lecteur, à la demande.

/** Le dossier de la musique sur le site : à la racine de l'origine, comme `/api/` (les jeux sont sous `/track/`, `/jump/`, `/tower/`). */
export const BASE_MUSIQUE = "/musique/";

function stockageDeLOnglet(): StockageMin | null {
  try {
    const s = window.sessionStorage;
    void s.length;
    return s;
  } catch {
    return null;
  }
}

export function depsNavigateur(jeu: JeuMusique, stockage: StockageMin | null): Dependances {
  return {
    jeu,
    base: BASE_MUSIQUE,
    stockage,
    session: stockageDeLOnglet(),
    chargerListe: (url) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
    telecharger: (url) => fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))))),
    // Lot S2 : la session audio `ambient` est posée par la fonction commune : la musique se mêle à celle du joueur, elle ne la coupe pas.
    creerContexte: () => ouvrirContexteAudio<ContexteAudio>(),
    cachee: () => document.hidden,
    ecouter: (cible, type, fn) => {
      const t: EventTarget = cible === "fenetre" ? window : document;
      t.addEventListener(type, fn);
      return () => t.removeEventListener(type, fn);
    },
    maintenant: () => Date.now(),
    hasard: () => Math.random(),
    planifier: (ms, fn) => void setTimeout(fn, ms),
  };
}
