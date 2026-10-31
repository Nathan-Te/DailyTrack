import { ErreurRediffusion, type Resultat, type Rapier, type Scenario, rejouer } from "@cdj/tower-sim";
import { HttpError } from "./errors";

// Lot T4 — le rejeu d'une partie de Tower sur le serveur : **un seul point d'entrée, `rejouerPourServeur`**, derrière lequel le calcul tourne ou bien dans le fil principal (repli), ou bien dans
// **un fil de calcul** (`worker_threads`, `towerFil.ts`) — un seul par instance, avec une file bornée qui rend `503 busy` quand elle est pleine.
//
// Pourquoi un fil : un rejeu de Tower coûte de 0,2 à 0,6 s de calcul pur (Rapier en WebAssembly, ≈ 80 à 150 µs par tick), contre ≈ 15 ms pour une course de Track. Dans le fil principal il bloque
// les lectures des autres joueurs pendant tout ce temps. Mais le fil a besoin d'un fichier JavaScript à part (`dist/tower-fil.mjs`), que l'image du serveur (un seul `server.mjs`, `build-node.mjs`)
// n'embarque pas encore : tant que la plateforme n'a pas branché l'emballage (cahier des charges du lot T4), **le repli est le fil principal, protégé par le plafond de rejeux de la
// plateforme** (`spendReplays(UNITES_REJEU_TOWER)`).

/**
 * **Le poids d'un rejeu de Tower dans le plafond global de la plateforme** (`REPLAYS_PER_MINUTE` = 600 unités par minute et par instance, `spendReplays`). Une unité vaut ≈ 15 ms de calcul (une
 * course de Track, lot R7) ; un rejeu de Tower mesuré (lot T4, Node 22, `apps/api/scripts/tower-mesure.ts`) coûte 0,1 à 0,65 s (médiane ≈ 0,25 s) selon le nombre de corps : on compte **30 unités
 * (≈ 0,45 s)**, soit au plus 20 rejeux par minute et par instance (≈ 9 s de calcul par minute, le même budget que les autres jeux). Poids fixe (le prompt du lot) : un rejeu court est surfacturé, jamais un long.
 */
export const UNITES_REJEU_TOWER = 30;

/** La file d'attente du fil de calcul : au-delà, `503 busy` (le rejeu qui attend dans la file n'est pas encore commencé). */
export const FILE_MAX_TOWER = 4;

/** Un rejeu demandé : le contenu du jour (données seules : il traverse un fil) et la rediffusion (texte `base64url`). */
export interface DemandeRejeu {
  contenu: Scenario;
  rediffusion: string;
}

/** Ce qui exécute un rejeu : le fil principal, ou le fil de calcul. Lève `ErreurRediffusion` pour une rediffusion refusée par le rejeu. */
export interface ExecuteurRejeu {
  rejouer(d: DemandeRejeu): Promise<Resultat>;
  /** Arrête le fil de calcul, s'il y en a un (tests, arrêt propre). */
  fermer?(): Promise<void>;
}

/** Le repli : le rejeu dans le fil principal. Rapier est chargé une fois, à la demande (`@cdj/tower-sim/rapier`). */
export function executeurPrincipal(): ExecuteurRejeu {
  let pret: Promise<Rapier> | null = null;
  return {
    async rejouer(d) {
      pret ??= import("@cdj/tower-sim/rapier").then((m) => m.chargerRapier());
      const R = await pret;
      return rejouer(R, d.contenu, d.rediffusion);
    },
  };
}

/**
 * Les refus du rejeu (ceux que le décodage n'a pas déjà vus) en erreurs de l'API : `inachevee` → 422 `not_finished` ; `contenu_different` et `version_inconnue` → 409 `version` ;
 * le reste (`surplus`, `trop_longue`, `commandes_inconnues`, `reglages_invalides`, `format_illisible`) → 400 `invalid_replay`.
 */
export function erreurDeRediffusion(e: ErreurRediffusion): HttpError {
  switch (e.code) {
    case "inachevee":
      return new HttpError(422, "not_finished", "Cette partie n'arrive pas au bout");
    case "version_inconnue":
    case "contenu_different":
      return new HttpError(409, "version", `Une nouvelle version du jeu est disponible : recharge la page (${e.code})`);
    default:
      return new HttpError(400, "invalid_replay", `Rediffusion refusée (${e.code})`);
  }
}

/**
 * **Le point d'entrée du rejeu serveur** : exécute le rejeu (fil principal ou fil de calcul selon `executeur`) et traduit ses refus en erreurs de l'API. Le `Resultat` rendu est celui que le
 * serveur recalcule : jamais un résultat annoncé par le client.
 */
export async function rejouerPourServeur(executeur: ExecuteurRejeu, d: DemandeRejeu): Promise<Resultat> {
  try {
    return await executeur.rejouer(d);
  } catch (e) {
    if (e instanceof ErreurRediffusion) throw erreurDeRediffusion(e);
    throw e;
  }
}
