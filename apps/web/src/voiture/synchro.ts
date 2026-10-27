// Lot 51 — **la voiture sur tous les appareils d'un même profil** : le choix du Garage (voiture, couleur, motif, teinte du motif) est gardé par le serveur, par joueur ;
// `cdj:track:garage` n'en est que la copie locale (avec les voitures vues et la pastille « Nouveau »). Chargé à la demande (jamais dans le premier chargement) : après le
// premier écran, quand le jeu a lu son profil (`GET /api/me` rend le choix du serveur : aucune requête de plus), à l'ouverture du Garage et quand on y choisit.
//
// Règles :
//   - **le dernier choix l'emporte, à la minute près** : chaque choix porte la minute où il a été fait (`minute`) ; celui du serveur est appliqué s'il est plus récent
//     (ou de la même minute mais différent : le serveur fait foi), le local est envoyé s'il l'est (`envoye` : la minute que le serveur connaît) ;
//   - **hors connexion** le choix reste local et part au prochain passage (lecture du profil, retour du réseau) ; un joueur que le serveur ne connaît pas encore (jamais
//     classé : 404) garde le sien chez lui, il part après sa première course ;
//   - **le serveur refuse une voiture qu'il ne croit pas débloquée** : l'appareil reprend alors ce que le serveur garde (la Sparrow en orange sans rien) ;
//   - la voiture reçue est forcément débloquée : elle s'ajoute aux voitures débloquées de l'appareil (sinon, avant d'ouvrir le Garage, il l'ignorerait).
// Stockage, réseau et horloge sont injectés : la synchronisation se teste sans navigateur (`test/voitureSynchro.test.ts`).
import type { ApiResult } from "@cdj/profile";
import type { ReponseChoix } from "../api";
import { gameStorage } from "../storage";
import { CHOIX_DEFAUT, ecrire, lire, lireChoix, type ChoixVoiture, type Garde } from "./choix";

type Stockage = Pick<Storage, "getItem" | "setItem">;

/** L'API du choix de voiture (`LeaderboardApi.choisirVoiture`), ou `null` (aucun serveur, démonstration). */
export type ApiChoix = { choisirVoiture?(playerId: string, voiture: ChoixVoiture, minute: number): Promise<ApiResult<ReponseChoix>> } | null;

export const minuteDe = (ms: number): number => Math.floor(ms / 60_000);
const entier = (x: unknown): number | null => (typeof x === "number" && Number.isInteger(x) && x >= 0 ? x : null);

/** Le choix du serveur (`{ voiture, minute }`), ou `null` s'il est absent ou illisible. */
export function choixDuServeur(brut: unknown): { voiture: ChoixVoiture; minute: number } | null {
  const o = brut as { voiture?: unknown; minute?: unknown } | null;
  const voiture = lireChoix(o?.voiture);
  const minute = entier(o?.minute);
  return voiture && minute !== null ? { voiture, minute } : null;
}

const memes = (a: ChoixVoiture, b: ChoixVoiture) => a.id === b.id && a.couleur === b.couleur && a.motif === b.motif && a.teinteMotif === b.teinteMotif;

/** Le Garage vient de faire un choix sur cet appareil : sa minute est notée et il attend d'être envoyé. */
export function noterChoixLocal(maintenant = Date.now(), stockage: Stockage = gameStorage()): void {
  ecrire(() => stockage, { minute: minuteDe(maintenant), attente: true });
}

/** Le choix local qui attend d'être envoyé (plus récent que ce que le serveur connaît), ou `null`. */
export function choixEnAttente(stockage: Stockage = gameStorage()): { voiture: ChoixVoiture; minute: number } | null {
  const g: Garde = lire(() => stockage);
  const voiture = lireChoix(g);
  const minute = entier(g.minute);
  return voiture && minute !== null && (g.attente === true || minute > (entier(g.envoye) ?? 0)) ? { voiture, minute } : null;
}

/** Applique un choix du serveur sur cet appareil ; vrai si la voiture, sa couleur, son motif ou sa teinte ont changé. */
function appliquer(s: { voiture: ChoixVoiture; minute: number }, stockage: Stockage): boolean {
  const avant = lireChoix(lire(() => stockage));
  const debloquees = lire(() => stockage).debloquees;
  const deja = Array.isArray(debloquees) ? (debloquees as unknown[]) : [];
  ecrire(() => stockage, {
    id: s.voiture.id,
    couleur: s.voiture.couleur,
    motif: s.voiture.motif,
    teinteMotif: s.voiture.teinteMotif,
    minute: s.minute,
    envoye: s.minute,
    attente: false,
    ...(s.voiture.id === CHOIX_DEFAUT.id || deja.includes(s.voiture.id) ? {} : { debloquees: [...deja, s.voiture.id] }),
  });
  return !avant || !memes(avant, s.voiture);
}

/**
 * Recale cet appareil sur le choix du serveur (`serveur` : ce qu'il a rendu — `null` : rien d'enregistré) : le plus récent gagne. Rend `"change"` si la voiture de cet
 * appareil a changé, `"envoyer"` si le choix local est le plus récent (à envoyer), `"rien"` sinon.
 */
export function recaler(serveur: unknown, stockage: Stockage = gameStorage(), maintenant = Date.now()): "change" | "envoyer" | "rien" {
  const s = choixDuServeur(serveur);
  const g: Garde = lire(() => stockage);
  const local = lireChoix(g);
  const L = entier(g.minute) ?? 0;
  // Un choix fait ici qui n'est pas encore parti l'emporte sur le serveur à égalité de minute (deux choix dans la même minute : le plus récent est celui de cet appareil).
  const enAttente = g.attente === true;
  if (s && (s.minute > L || (s.minute === L && !enAttente && (!local || !memes(local, s.voiture))))) return appliquer(s, stockage) ? "change" : "rien";
  if (s && s.minute === L && !enAttente) {
    if ((entier(g.envoye) ?? 0) < L) ecrire(() => stockage, { envoye: L }); // le serveur a déjà ce choix
    return "rien";
  }
  // Le serveur n'a rien (ou un choix plus ancien) : le choix local part, s'il y en a un autre que celui par défaut ; un choix d'avant le lot 51 n'a pas de minute : il prend celle-ci.
  if (local && (enAttente || !(L === 0 && memes(local, CHOIX_DEFAUT)))) {
    if (L === 0) ecrire(() => stockage, { minute: minuteDe(maintenant), attente: true });
    return "envoyer";
  }
  return "rien";
}

/** Envoie le choix local qui attend ; rend vrai si la voiture de cet appareil a changé (le serveur en gardait un autre, plus récent, ou a refusé celui-ci). */
export async function envoyerChoix(api: ApiChoix, playerId: string, stockage: Stockage = gameStorage()): Promise<boolean> {
  const attente = choixEnAttente(stockage);
  if (!attente || !api?.choisirVoiture) return false;
  const r = await api.choisirVoiture(playerId, attente.voiture, attente.minute);
  if (!r.ok) return false; // hors ligne, joueur pas encore classé (404), débit : le choix reste là et repartira
  if (r.data.enregistre) {
    // Parti. Si le joueur a encore choisi pendant l'aller-retour, ce nouveau choix attend toujours.
    const g: Garde = lire(() => stockage);
    const inchange = entier(g.minute) === attente.minute && memes(lireChoix(g) ?? CHOIX_DEFAUT, attente.voiture);
    ecrire(() => stockage, { envoye: attente.minute, ...(inchange ? { attente: false } : {}) });
    return false;
  }
  // Refusé : une voiture que le serveur ne croit pas débloquée, ou un choix plus récent déjà gardé. L'appareil reprend ce que le serveur garde (la Sparrow en orange sans rien).
  const garde = choixDuServeur({ voiture: r.data.voiture, minute: r.data.minute });
  return appliquer(garde ?? { voiture: { ...CHOIX_DEFAUT }, minute: attente.minute }, stockage);
}

/** Lecture du profil (ou du Garage) faite : recale cet appareil sur le serveur, puis envoie le choix local s'il est plus récent. Vrai si la voiture a changé. */
export async function synchroniserChoix(serveur: unknown, api: ApiChoix, playerId: string, stockage: Stockage = gameStorage(), maintenant = Date.now()): Promise<boolean> {
  const cap = recaler(serveur, stockage, maintenant);
  const envoye = cap === "rien" ? false : cap === "envoyer" ? await envoyerChoix(api, playerId, stockage) : false;
  return cap === "change" || envoye;
}
