import type { ContexteAudio, Dependances, StockageMin } from "./lecteur";
import type { JeuMusique } from "./types";

// Les dépendances réelles du lecteur : le navigateur. Seul fichier du paquet qui touche `window`, `document`, `fetch`, `Audio` et le stockage ; tout le reste est injecté
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
    creerAudio: () => new Audio(),
    creerContexte: () => {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        const ctx = new Ctor();
        const session = (navigator as { audioSession?: { type: string } }).audioSession;
        if (session) session.type = "playback"; // iPhone : la musique passe aussi quand l'interrupteur est sur silence, comme le son des jeux
        return ctx as unknown as ContexteAudio;
      } catch {
        return null;
      }
    },
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
