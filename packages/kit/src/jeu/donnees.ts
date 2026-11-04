import { parisDay } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import { appliquerGeneration, createIdentity, generationDeReponse, type Identity } from "@cdj/profile";
import { FileEnvoi } from "../envoi";
import { creerRecords, type MagasinRecords } from "../records";
import { gameStorage } from "../stockage";
import { baseDeLaPage, type OptionsUrl } from "./session";
import { ClientJeu, type EnvoiJeu } from "./source";
import type { FicheClient } from "./types";

// Ce que l'accueil et la partie partagent pour la durée de la page : le jour de Paris, le serveur (ou rien), l'identité commune, les records locaux et la file d'envoi. **Un module à la demande** (records et envoi
// ne sont jamais dans le premier chargement) ; créé une fois, après le premier dessin de l'accueil.
export interface Donnees {
  aujourdhui: number;
  base: string | null;
  source: ClientJeu | null;
  identity: Identity;
  records: MagasinRecords;
  envoi: FileEnvoi<EnvoiJeu>;
  stockage: Storage | null;
  tactile: boolean;
  /** Le serveur annonce sa génération de données : une plus récente efface les données de ce navigateur (lot R8) et recharge la page. */
  suivreGeneration(corps: unknown): void;
}

export function creerDonnees(fiche: FicheClient, options: OptionsUrl): Donnees {
  const aujourdhui = parisDay(Date.now());
  const base = baseDeLaPage(options);
  const source = base ? new ClientJeu(base, fiche.id) : null;
  const identity = createIdentity(() => gameStorage() as Storage);
  const records = creerRecords({ cle: `${fiche.prefixe}records`, sens: fiche.colonnes.map((c) => c.sens) });
  const envoi = new FileEnvoi<EnvoiJeu>({
    source,
    identity,
    stockage: () => gameStorage() as Storage | null,
    records,
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    api: source,
  });
  // Le réseau revient, ou la page redevient visible : ce qui attendait d'être envoyé repart tout de suite.
  addEventListener("online", () => envoi.reveiller());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) envoi.reveiller();
  });
  const tactile = options.tactile === "1" || (options.tactile !== "0" && matchMedia("(pointer: coarse)").matches);
  return {
    aujourdhui,
    base,
    source,
    identity,
    records,
    envoi,
    stockage: gameStorage(),
    tactile,
    suivreGeneration(corps) {
      try {
        const s = gameStorage();
        if (s && appliquerGeneration(s, generationDeReponse(corps)) === "efface") location.reload();
      } catch {
        /* rien ne s'efface */
      }
    },
  };
}

export const dateDuJour = (jour: number): string => formatDay(jour);
