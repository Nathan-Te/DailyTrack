import { parisDay } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import { createIdentity, type Identity } from "@cdj/profile";
import { baseApi, HttpTowerSource, type SourceTower } from "./apiTower";
import { Envoi } from "./envoi";
import { BUILD_API_URL, gameStorage } from "./stockage";
import { type OptionsUrl, PRODUCTION } from "./urlOptions";

// Ce que l'accueil et le jeu partagent pour la durée de la page (lot T4) : le jour de Paris, le serveur (ou rien : `?api=`, `VITE_API_URL`, règle R7), l'identité commune, l'envoi des parties. Créé une
// fois par l'accueil et donné au jeu. Premier chargement : aucune simulation, aucune scène ici.

export interface Session {
  /** Aujourd'hui à Paris (numéro de jour civil). */
  aujourdhui: number;
  base: string | null;
  source: SourceTower | null;
  identity: Identity;
  envoi: Envoi;
  tactile: boolean;
}

export function creerSession(options: OptionsUrl): Session {
  const aujourdhui = parisDay(Date.now());
  const base = baseApi(options.api, BUILD_API_URL, location.origin, PRODUCTION);
  const source = base ? new HttpTowerSource(base) : null;
  const identity = createIdentity(() => gameStorage() as Storage);
  const envoi = new Envoi({
    source,
    identity,
    stockage: () => gameStorage() as Storage | null,
    aujourdhui: () => formatDay(parisDay(Date.now())),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  });
  // Le réseau revient, ou la page redevient visible : ce qui attend d'être envoyé repart tout de suite.
  addEventListener("online", () => envoi.reveiller());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) envoi.reveiller();
  });
  const tactile = options.tactile === "1" || (options.tactile !== "0" && matchMedia("(pointer: coarse)").matches);
  return { aujourdhui, base, source, identity, envoi, tactile };
}
