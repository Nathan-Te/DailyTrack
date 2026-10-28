// Lot 53 : « Retrouver mon profil » — le premier lancement d'une application ajoutée à l'écran d'accueil (iPhone). Sur iPhone, une application web
// ajoutée à l'écran d'accueil a **son propre stockage**, séparé de Safari : le joueur y arrive sans son profil (nouvel identifiant, ni records, ni pseudo,
// ni voitures, ni série). Ce module décide **s'il faut proposer** de le retrouver et fait le travail sans DOM : lire un code collé, demander le profil au
// serveur (injecté), adopter l'identité. L'identifiant ne passe jamais dans une adresse (lot 32) : le seul moyen de le transmettre de Safari à
// l'application est le code de transfert `CDJ2`, copié dans Safari puis collé ici (presse-papiers ou champ). Stockage et réseau sont injectés.
import { NAME_KEY, PLAYER_ID, noteIdentityChange, readIdentity, writeIdentity, type KeyValueStore, type ListableStore } from "./identity";
import { decodeTransfer } from "./transfer";
import { call, type ApiResult, type FetchLike } from "./client";

/** « Retrouver mon profil » passé (ou fait) : la carte ne revient pas. Réglage gardé (`CLES_GARDEES`), nommé dans les mentions légales. */
export const RETROUVER_VU_KEY = "cdj:retrouver:vu";

/**
 * La carte est-elle à proposer ? Seulement **en mode application**, **sans profil** dans ce stockage et si elle n'a pas été passée. Un stockage
 * illisible ne la propose pas (rien à retrouver de façon sûre).
 */
export function retrouverAPropos(storage: Pick<KeyValueStore, "getItem"> | null, application: boolean): boolean {
  if (!application || !storage) return false;
  try {
    return !readIdentity(storage).exists && storage.getItem(RETROUVER_VU_KEY) !== "1";
  } catch {
    return false;
  }
}

/** La carte est passée : elle ne revient pas. Ne lève jamais. */
export function marquerRetrouverVu(storage: Pick<KeyValueStore, "setItem"> | null): void {
  try {
    storage?.setItem(RETROUVER_VU_KEY, "1");
  } catch {
    /* tant qu'elle ne peut pas se souvenir, elle reviendra */
  }
}

/** Le code `CDJ2.<32 hexadécimaux>.<8 hexadécimaux>` que contient un texte collé (le presse-papiers peut porter d'autres mots), ou le texte tel quel. */
export function extraireCode(texte: string): string {
  const m = /CDJ2\s*\.\s*[0-9a-f]{32}\s*\.\s*[0-9a-f]{8}/i.exec(texte);
  return m ? m[0] : texte;
}

export type CodeSaisi = { ok: true; id: string } | { ok: false; erreur: "vide" | "illisible" | "deja" };

/** Lit un code saisi ou collé : vide, illisible (autre texte, somme de contrôle, ancien code `CDJ1`) ou déjà celui de ce navigateur. */
export function lireCodeSaisi(saisi: string, storage: Pick<KeyValueStore, "getItem"> | null): CodeSaisi {
  if (!saisi.trim()) return { ok: false, erreur: "vide" };
  const d = decodeTransfer(extraireCode(saisi));
  if (!d.ok || d.data.version !== 2 || !PLAYER_ID.test(d.data.id)) return { ok: false, erreur: "illisible" };
  try {
    if (storage?.getItem("cdj:player") === d.data.id) return { ok: false, erreur: "deja" };
  } catch {
    /* illisible : on laisse passer */
  }
  return { ok: true, id: d.data.id };
}

/** Ce que le serveur dit d'un profil (`GET /api/portail/profil`), réduit à ce que la carte montre. */
export interface ProfilTrouve {
  pseudo: string;
  /** Le plus grand nombre de jours finis dans un jeu : « 12 jours » aide à reconnaître son profil. */
  jours: number;
}

/** Le profil d'un identifiant, tel que le serveur le rend (`lire` est injecté : `GET /api/portail/profil` avec `X-Player-Id`). */
export async function trouverProfil(id: string, lire: (id: string) => Promise<ApiResult<{ pseudo: string; jeux: { joursFinis: number }[] }>>): Promise<ApiResult<ProfilTrouve>> {
  const r = await lire(id);
  if (!r.ok) return r;
  return { ok: true, data: { pseudo: r.data.pseudo, jours: r.data.jeux.reduce((max, j) => Math.max(max, j.joursFinis), 0) } };
}

/**
 * Adopte le profil retrouvé : identifiant et pseudo remplacés (`writeIdentity`) et révision d'identité avancée (lot P4 : chaque jeu vide son cache de
 * l'ancienne identité à son prochain démarrage), la carte ne revient pas. Rend faux si le stockage refuse d'écrire (rien n'est alors adopté).
 */
export function adopterProfil(storage: ListableStore, id: string, pseudo: string): boolean {
  try {
    writeIdentity({ id, name: pseudo }, storage);
    if (storage.getItem(NAME_KEY) !== pseudo) return false;
  } catch {
    return false;
  }
  noteIdentityChange(storage, "code");
  marquerRetrouverVu(storage);
  return true;
}

/** Ce que rend `verifierRetrouver` : le profil trouvé (et de quoi l'adopter après confirmation), ou la raison du refus (un code du serveur ou du réseau : `erreur.<code>`). */
export type Retrouve =
  | { ok: true; pseudo: string; jours: number; adopter: () => boolean }
  | { ok: false; erreur: "vide" | "illisible" | "deja" | { code: string } };

/**
 * Le parcours de « Retrouver mon profil » pour une application : lit le code saisi ou collé, demande le profil au serveur (`GET /api/portail/profil`, l'identifiant en
 * `X-Player-Id`, jamais dans l'adresse : la route est la même pour tous les jeux, sur la même origine) et rend de quoi l'adopter. **Rien n'est écrit** avant que le joueur
 * confirme (`adopter`). Ne lève jamais.
 */
export async function verifierRetrouver(o: { saisi: string; base: string; stockage: ListableStore; fetchImpl?: FetchLike }): Promise<Retrouve> {
  const code = lireCodeSaisi(o.saisi, o.stockage);
  if (!code.ok) return { ok: false, erreur: code.erreur };
  const r = await trouverProfil(code.id, (id) => call(o.base, "GET", "/api/portail/profil", undefined, 8000, { "X-Player-Id": id }, o.fetchImpl));
  if (!r.ok) return { ok: false, erreur: { code: r.code } };
  return { ok: true, pseudo: r.data.pseudo, jours: r.data.jours, adopter: () => adopterProfil(o.stockage, code.id, r.data.pseudo) };
}
