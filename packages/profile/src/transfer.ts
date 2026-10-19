// Code de transfert de la plateforme (lot 30 de DailyTrack, extrait au lot P0 sans changement) : retrouver son profil sur un autre navigateur
// ou un autre appareil, sans compte. Le code est l'identifiant secret du joueur (et une somme de contrôle) : rien d'autre. Le serveur fait foi :
// charger un code récupère le profil depuis le serveur, le stockage du navigateur n'en est qu'un cache. Le code se garde comme un mot de passe :
// quiconque le colle devient ce joueur ; « Changer mon code » le remplace et rend l'ancien inutilisable (révocation, `POST /api/me/code`).
//
// Forme : `CDJ2.<identifiant : 32 hexadécimaux>.<CRC-32 sur 8 hexadécimaux>` (46 caractères, qui se tapent ou se dictent).
// Les anciens codes (`CDJ1.<charge utile en base64url>.<CRC-32>`, lot 28) emportaient des records **de DailyTrack** : leur lecture reste dans
// DailyTrack (`apps/web/src/transfer.ts`), qui la passe à `decodeTransfer` (`legacy`). Sans elle, un ancien code est refusé avec un message.
import { PLAYER_ID } from "./identity";

export const TRANSFER_PREFIX = "CDJ2";
export const LEGACY_PREFIX = "CDJ1";
/** Taille maximale d'un code accepté (anti-abus : un ancien code porte quelques rediffusions de ~6 ko). */
export const MAX_CODE_LENGTH = 400_000;

/** Un record d'un ancien code (CDJ1). */
export interface TransferRecord {
  ms: number;
  splits: number[];
  medal?: string | null;
  simVersion?: number;
  replay?: string;
}

export interface TransferData {
  /** 1 : ancien code (records, pseudo) ; 2 : identifiant seul. */
  version: 1 | 2;
  id: string;
  /** Pseudo d'un ancien code (le serveur fait foi quand il connaît ce profil). */
  name: string | null;
  /** Records d'un ancien code, par identifiant de circuit : envoyés au serveur pour validation, puis ignorés. Vide pour un code CDJ2. */
  best: Record<string, TransferRecord>;
  sub: Record<string, number>;
  ranks?: Record<string, { rank: number; participants: number }>;
}

export type DecodeResult = { ok: true; data: TransferData } | { ok: false; reason: string };

/** Lecture d'un ancien code (`CDJ1`) : la charge utile et la somme de contrôle (le jeu qui les a écrits sait les lire). */
export type LegacyDecoder = (payload: string, checksum: string) => DecodeResult;

// --- Somme de contrôle ---------------------------------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (zlib) des octets, sur 8 hexadécimaux. */
export function crc32(bytes: Uint8Array): string {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

/** Octets d'un texte en base64url (lève sur un texte illisible). */
export const fromBase64Url = (text: string): Uint8Array => {
  const b = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};

// --- Encodage ---------------------------------------------------------------------------------------------------------------------
/** Le code d'un identifiant : `CDJ2.<identifiant>.<CRC-32>`. */
export function encodeTransfer(id: string): string {
  return `${TRANSFER_PREFIX}.${id}.${crc32(new TextEncoder().encode(id))}`;
}

/**
 * Lit un code collé : espaces et retours à la ligne ignorés, somme de contrôle vérifiée, contenu validé champ par champ (rien n'est pris sur
 * parole). `legacy` lit un ancien code `CDJ1` (DailyTrack).
 */
export function decodeTransfer(input: string, legacy?: LegacyDecoder): DecodeResult {
  const code = input.replace(/\s+/g, "");
  if (!code) return { ok: false, reason: "Le code est vide." };
  if (code.length > MAX_CODE_LENGTH) return { ok: false, reason: "Ce code est trop long pour être un code de transfert." };
  const parts = code.split(".");
  if (parts.length !== 3 || (parts[0] !== TRANSFER_PREFIX && parts[0] !== LEGACY_PREFIX)) return { ok: false, reason: "Ce n'est pas un code de transfert de Circuit du Jour." };
  if (parts[0] === TRANSFER_PREFIX) {
    const id = parts[1]!.toLowerCase();
    if (!PLAYER_ID.test(id)) return { ok: false, reason: "Le code est abîmé : l'identifiant n'est pas lisible. Copie-le en entier, sans rien ajouter." };
    if (crc32(new TextEncoder().encode(id)) !== parts[2]!.toLowerCase()) return { ok: false, reason: "Le code est incomplet ou abîmé (la somme de contrôle ne correspond pas). Copie-le de nouveau, en entier." };
    return { ok: true, data: { version: 2, id, name: null, best: {}, sub: {} } };
  }
  if (!legacy) return { ok: false, reason: "Ancien code (CDJ1) : charge-le d'abord dans DailyTrack, qui te donnera un code CDJ2." };
  return legacy(parts[1]!, parts[2]!);
}
