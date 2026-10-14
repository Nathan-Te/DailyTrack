// Code de transfert : retrouver son profil sur un autre navigateur ou un autre appareil, sans compte. Le code est l'identifiant secret du
// joueur (et une somme de contrôle) : rien d'autre. Le serveur fait foi (lot 30) : charger un code récupère pseudo, records et médailles depuis le
// serveur, le stockage du navigateur n'en est qu'un cache. Le code se garde comme un mot de passe : quiconque le colle devient ce joueur ;
// « Changer mon code » (Réglages › Profil) le remplace et rend l'ancien inutilisable.
//
// Forme : `CDJ2.<identifiant : 32 hexadécimaux>.<CRC-32 sur 8 hexadécimaux>` (46 caractères, qui se tapent ou se dictent).
// Les codes du lot 28 (`CDJ1.<charge utile en base64url>.<CRC-32>`, qui emportaient aussi les records) restent acceptés : leurs rediffusions du
// jour sont envoyées au serveur pour validation, puis ignorées (le serveur ne garde que ce qu'il a rejoué).
import { decodeReplay } from "@cdj/sim";
import { clearRanks, parseRank, type RankMark } from "./profile";

export const TRANSFER_PREFIX = "CDJ2";
export const LEGACY_PREFIX = "CDJ1";
const ID_KEY = "cdj:player";
const NAME_KEY = "cdj:name";
const NEXT_KEY = "cdj:player:next";
const BEST = "cdj:best:";
const SUB = "cdj:sub:";
const PLAYER_ID = /^[0-9a-f]{32}$/;
/** Seuls les circuits du jour comptent (identifiant `jour-AAAA-MM-JJ-g<G>[-v<n>][-<thème>]`) ; les essais et scénarios restent sur l'appareil. */
const DAY_TRACK = /^jour-\d{4}-\d{2}-\d{2}-g\d{1,3}(-v\d{1,2})?(-[a-z]{3,12})?$/;
const MEDALS = new Set(["gold", "silver", "bronze", "author"]);
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
  /** Records d'un ancien code, par identifiant de circuit : envoyés au serveur pour validation, puis ignorés. */
  best: Record<string, TransferRecord>;
  sub: Record<string, number>;
  ranks?: Record<string, RankMark>;
}

type ReadStorage = Pick<Storage, "length" | "key" | "getItem">;
type WriteStorage = ReadStorage & Pick<Storage, "setItem" | "removeItem">;

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

const fromBase64Url = (text: string): Uint8Array => {
  const b = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};

// --- Lecture du stockage ---------------------------------------------------------------------------------------------------
function keysWith(storage: ReadStorage, prefix: string): string[] {
  const out: string[] = [];
  let count = 0;
  try {
    count = storage.length;
  } catch {
    return out;
  }
  for (let i = 0; i < count; i++) {
    try {
      const k = storage.key(i);
      if (k?.startsWith(prefix)) out.push(k.slice(prefix.length));
    } catch {
      /* une entrée illisible ne doit pas empêcher les autres */
    }
  }
  return out;
}

/** L'identifiant du joueur de ce navigateur, ou `null` s'il n'en a pas encore (jamais joué). */
export function readPlayerId(storage: ReadStorage): string | null {
  const id = storage.getItem(ID_KEY);
  return id && PLAYER_ID.test(id) ? id : null;
}

// --- Encodage ---------------------------------------------------------------------------------------------------------------------
/** Le code d'un identifiant : `CDJ2.<identifiant>.<CRC-32>`. */
export function encodeTransfer(id: string): string {
  return `${TRANSFER_PREFIX}.${id}.${crc32(new TextEncoder().encode(id))}`;
}

export type DecodeResult = { ok: true; data: TransferData } | { ok: false; reason: string };

const finiteInt = (n: unknown, min: number, max: number): n is number => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;

/** Lit un code collé : espaces et retours à la ligne ignorés, somme de contrôle vérifiée, contenu validé champ par champ (rien n'est pris sur parole). */
export function decodeTransfer(input: string): DecodeResult {
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
  return decodeLegacy(parts[1]!, parts[2]!);
}

/** Ancien code (lot 28) : charge utile en base64url (JSON), identifiant, pseudo et records. */
function decodeLegacy(payload: string, checksum: string): DecodeResult {
  let bytes: Uint8Array;
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(payload)) throw new Error("caractères");
    bytes = fromBase64Url(payload);
  } catch {
    return { ok: false, reason: "Le code est abîmé (caractères illisibles). Copie-le en entier, sans rien ajouter." };
  }
  if (crc32(bytes) !== checksum.toLowerCase()) return { ok: false, reason: "Le code est incomplet ou abîmé (la somme de contrôle ne correspond pas). Copie-le de nouveau, en entier." };
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as Record<string, unknown>;
  } catch {
    return { ok: false, reason: "Le contenu du code est illisible." };
  }
  if (!raw || typeof raw !== "object" || raw.v !== 1) return { ok: false, reason: "Ce code vient d'une autre version du jeu." };
  if (typeof raw.id !== "string" || !PLAYER_ID.test(raw.id)) return { ok: false, reason: "Le code ne contient pas d'identifiant de joueur valide." };
  const name = typeof raw.name === "string" && raw.name.length <= 40 ? raw.name : null;

  const best: Record<string, TransferRecord> = {};
  for (const [trackId, value] of Object.entries((raw.best ?? {}) as Record<string, unknown>)) {
    if (!DAY_TRACK.test(trackId) || !value || typeof value !== "object") continue;
    const r = value as Record<string, unknown>;
    if (!finiteInt(r.ms, 1, 3_600_000) || !Array.isArray(r.splits) || r.splits.length > 64 || !r.splits.every((s) => typeof s === "number" && Number.isFinite(s))) continue;
    const rec: TransferRecord = { ms: r.ms, splits: r.splits as number[] };
    if (typeof r.medal === "string" && MEDALS.has(r.medal)) rec.medal = r.medal;
    if (finiteInt(r.simVersion, 0, 100_000)) rec.simVersion = r.simVersion;
    if (typeof r.replay === "string" && /^[A-Za-z0-9_-]{1,400000}$/.test(r.replay)) {
      try {
        decodeReplay(r.replay); // une rediffusion illisible ne servirait à rien au serveur : on la laisse de côté, le temps reste
        rec.replay = r.replay;
      } catch {
        /* abandonnée */
      }
    }
    best[trackId] = rec;
  }
  const sub: Record<string, number> = {};
  for (const [trackId, ms] of Object.entries((raw.sub ?? {}) as Record<string, unknown>)) {
    if (DAY_TRACK.test(trackId) && finiteInt(ms, 1, 3_600_000)) sub[trackId] = ms;
  }
  const ranks: Record<string, RankMark> = {};
  for (const [date, value] of Object.entries((raw.ranks ?? {}) as Record<string, unknown>)) {
    const mark = /^\d{4}-\d{2}-\d{2}$/.test(date) ? parseRank(value) : null;
    if (mark) ranks[date] = mark;
  }
  return { ok: true, data: { version: 1, id: raw.id, name, best, sub, ...(Object.keys(ranks).length ? { ranks } : {}) } };
}

/** Rediffusions d'un ancien code à envoyer au serveur pour validation (une par jour, la date vient du circuit). */
export function legacyReplays(data: TransferData): { date: string; replay: string }[] {
  const out: { date: string; replay: string }[] = [];
  for (const [trackId, r] of Object.entries(data.best)) {
    const date = /^jour-(\d{4}-\d{2}-\d{2})/.exec(trackId)?.[1];
    if (date && r.replay) out.push({ date, replay: r.replay });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

// --- Application -------------------------------------------------------------------------------------------------------------------
/**
 * Circuits d'aujourd'hui dont ce navigateur a un record avec sa rediffusion que le serveur n'a pas confirmé (fait hors ligne, ou sous un pseudo
 * refusé) : ils survivent à un changement d'identité, pour être envoyés au serveur au nom du nouveau profil (qui garde le meilleur).
 */
export function pendingTrackIds(storage: ReadStorage, today: string): string[] {
  const out: string[] = [];
  for (const trackId of keysWith(storage, BEST)) {
    if (!DAY_TRACK.test(trackId) || !trackId.startsWith(`jour-${today}-`)) continue;
    try {
      const r = JSON.parse(storage.getItem(BEST + trackId) ?? "null") as TransferRecord | null;
      const confirmed = Number(storage.getItem(SUB + trackId));
      if (r?.replay && Number.isFinite(r.ms) && !(Number.isFinite(confirmed) && confirmed > 0 && confirmed <= r.ms)) out.push(trackId);
    } catch {
      /* illisible : ignoré */
    }
  }
  return out;
}

/**
 * Change l'identité de ce navigateur : identifiant (et pseudo connu) remplacés, cache des records et des places effacé — il appartenait à
 * l'ancienne identité, la synchronisation le remplira avec le profil du serveur. Les records de `keep` (voir `pendingTrackIds`) restent. Les
 * temps « confirmés » appartiennent à l'ancien identifiant : ils partent tous. Les réglages (son, caméra, commandes tactiles) et les
 * essais ne bougent pas. Rend `false` si le stockage refuse l'écriture.
 */
export function applyIdentity(identity: { id: string; name: string | null }, storage: WriteStorage, keep: readonly string[] = []): boolean {
  try {
    for (const k of keysWith(storage, BEST)) if (DAY_TRACK.test(k) && !keep.includes(k)) storage.removeItem(BEST + k);
    for (const k of keysWith(storage, SUB)) if (DAY_TRACK.test(k)) storage.removeItem(SUB + k);
    clearRanks(storage);
    storage.removeItem(NEXT_KEY);
    for (const k of keysWith(storage, "cdj:notice:")) storage.removeItem(`cdj:notice:${k}`);
    storage.setItem(ID_KEY, identity.id);
    if (identity.name) storage.setItem(NAME_KEY, identity.name);
    else storage.removeItem(NAME_KEY);
    return true;
  } catch {
    return false;
  }
}
